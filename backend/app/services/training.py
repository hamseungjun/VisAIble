import gzip
import math
import struct
from dataclasses import dataclass
from pathlib import Path
from threading import Lock, Thread
from uuid import uuid4

import numpy as np
import torch
import torch.nn.functional as F
from sklearn.decomposition import PCA
from sklearn.model_selection import train_test_split
from torch import nn
from torch.optim import Adagrad, Adam, RMSprop, SGD
from torch.utils.data import DataLoader, Dataset, Subset, TensorDataset

from app.schemas.training import CanvasNodePayload, EpochMetrics, TrainModelRequest
from app.services.datasets import DATA_DIR, ensure_mnist_downloaded, get_dataset_runtime_spec


BATCH_SIZE = 32
RANDOM_STATE = 42
TRAINING_JOBS: dict[str, dict[str, object]] = {}
TRAINED_CLASSIFIERS: dict[str, tuple[nn.Module, torch.device, str]] = {}
TRAINING_LOCK = Lock()


@dataclass
class CompiledModel:
    model: nn.Module
    architecture: list[str]


class TripletSubsetDataset(Dataset):
    def __init__(self, subset: Subset):
        self.subset = subset
        dataset = subset.dataset
        if not isinstance(dataset, TensorDataset):
            raise ValueError("Triplet training expects a TensorDataset")

        _, labels = dataset.tensors
        subset_indices = np.array(subset.indices)
        subset_labels = labels[subset_indices].numpy()

        self.label_to_indices: dict[int, np.ndarray] = {}
        for label in np.unique(subset_labels):
            self.label_to_indices[int(label)] = subset_indices[subset_labels == label]

        self.available_labels = sorted(self.label_to_indices.keys())

    def __len__(self) -> int:
        return len(self.subset)

    def __getitem__(self, index: int):
        anchor_image, anchor_label = self.subset[index]
        anchor_label_int = int(anchor_label.item())
        dataset = self.subset.dataset
        if not isinstance(dataset, TensorDataset):
            raise ValueError("Triplet training expects a TensorDataset")

        anchor_global_index = int(self.subset.indices[index])
        positive_index = anchor_global_index
        while positive_index == anchor_global_index:
            positive_index = int(np.random.choice(self.label_to_indices[anchor_label_int]))
        positive_image = dataset[positive_index][0]

        negative_labels = [label for label in self.available_labels if label != anchor_label_int]
        negative_label = int(np.random.choice(negative_labels))
        negative_index = int(np.random.choice(self.label_to_indices[negative_label]))
        negative_image = dataset[negative_index][0]

        return anchor_image, positive_image, negative_image, anchor_label


class TripletEmbeddingNet(nn.Module):
    def __init__(self, embedding_dim: int = 64):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 16, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(16, 32, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),
        )
        self.projection = nn.Sequential(
            nn.Flatten(),
            nn.Linear(32 * 7 * 7, 128),
            nn.ReLU(),
            nn.Linear(128, embedding_dim),
        )

    def forward(self, inputs: torch.Tensor) -> torch.Tensor:
        projected = self.projection(self.features(inputs))
        return F.normalize(projected, p=2, dim=1)


def _read_idx_images(path: Path) -> torch.Tensor:
    with gzip.open(path, "rb") as handle:
        magic, count, rows, cols = struct.unpack(">IIII", handle.read(16))
        if magic != 2051:
            raise ValueError(f"Invalid MNIST image file: {path.name}")
        buffer = handle.read()

    data = np.frombuffer(buffer, dtype=np.uint8).reshape(count, rows, cols)
    return torch.tensor(data, dtype=torch.float32).unsqueeze(1) / 255.0


def _read_idx_labels(path: Path) -> torch.Tensor:
    with gzip.open(path, "rb") as handle:
        magic, count = struct.unpack(">II", handle.read(8))
        if magic != 2049:
            raise ValueError(f"Invalid MNIST label file: {path.name}")
        buffer = handle.read()

    data = np.frombuffer(buffer, dtype=np.uint8).reshape(count)
    return torch.tensor(data, dtype=torch.long)


def load_mnist_dataset() -> TensorDataset:
    ensure_mnist_downloaded()

    train_images = _read_idx_images(DATA_DIR / "train-images-idx3-ubyte.gz")
    train_labels = _read_idx_labels(DATA_DIR / "train-labels-idx1-ubyte.gz")
    test_images = _read_idx_images(DATA_DIR / "t10k-images-idx3-ubyte.gz")
    test_labels = _read_idx_labels(DATA_DIR / "t10k-labels-idx1-ubyte.gz")

    images = torch.cat([train_images, test_images], dim=0)
    labels = torch.cat([train_labels, test_labels], dim=0)

    return TensorDataset(images, labels)


def build_stratified_loaders() -> tuple[DataLoader, DataLoader, int, int, Subset, Subset]:
    dataset = load_mnist_dataset()
    _, labels = dataset.tensors

    indices = np.arange(len(labels))
    train_indices, validation_indices = train_test_split(
        indices,
        test_size=0.2,
        random_state=RANDOM_STATE,
        shuffle=True,
        stratify=labels.numpy(),
    )

    train_subset = Subset(dataset, train_indices.tolist())
    validation_subset = Subset(dataset, validation_indices.tolist())
    train_loader = DataLoader(train_subset, batch_size=BATCH_SIZE, shuffle=True)
    validation_loader = DataLoader(validation_subset, batch_size=BATCH_SIZE, shuffle=False)

    return (
        train_loader,
        validation_loader,
        len(train_indices),
        len(validation_indices),
        train_subset,
        validation_subset,
    )


def _parse_int(field_map: dict[str, str], label: str) -> int:
    value = field_map.get(label)
    if value is None:
        raise ValueError(f"Missing field: {label}")
    return int(value)


def _parse_kernel_size(value: str) -> int:
    if "x" in value.lower():
        left, right = value.lower().split("x", maxsplit=1)
        kernel_h = int(left.strip())
        kernel_w = int(right.strip())
        if kernel_h != kernel_w:
            raise ValueError("Only square kernel sizes are supported")
        return kernel_h

    return int(value)


def _activation_module(name: str) -> nn.Module:
    activations: dict[str, nn.Module] = {
        "None": nn.Identity(),
        "ReLU": nn.ReLU(),
        "Leaky ReLU": nn.LeakyReLU(),
        "GELU": nn.GELU(),
        "Sigmoid": nn.Sigmoid(),
        "Tanh": nn.Tanh(),
        "Softplus": nn.Softplus(),
        "ELU": nn.ELU(),
        "SELU": nn.SELU(),
        "Swish": nn.SiLU(),
    }

    if name not in activations:
        raise ValueError(f"Unsupported activation: {name}")

    return activations[name]


def _conv_output_size(size: int, kernel_size: int, padding: int, stride: int) -> int:
    next_size = math.floor(((size + 2 * padding - kernel_size) / stride) + 1)
    if next_size <= 0:
        raise ValueError("Convolution settings shrink the feature map to zero")
    return next_size


def compile_model(
    nodes: list[CanvasNodePayload],
    input_channels: int,
    input_height: int,
    input_width: int,
    num_classes: int,
    starts_flattened: bool = False,
    input_features: int | None = None,
) -> CompiledModel:
    if not nodes:
        raise ValueError("Add at least one block before training")

    last_node = nodes[-1]
    if last_node.type != "linear":
        raise ValueError(
            f"The last block must be a Linear layer with Output={num_classes} for this dataset",
        )

    layers: list[nn.Module] = []
    architecture: list[str] = []

    current_channels = input_channels
    current_height = input_height
    current_width = input_width
    current_features: int | None = input_features
    flattened = starts_flattened

    for index, node in enumerate(nodes):
        field_map = {field.label: field.value for field in node.fields}
        is_last_node = index == len(nodes) - 1

        if node.type == "cnn":
            if flattened:
                raise ValueError("CNN blocks must come before Linear blocks")

            channel_in = _parse_int(field_map, "Channel In")
            channel_out = _parse_int(field_map, "Channel Out")
            padding = _parse_int(field_map, "Padding")
            stride = _parse_int(field_map, "Stride")
            kernel_size = _parse_kernel_size(field_map.get("Kernel Size", "3"))

            if channel_in != current_channels:
                raise ValueError(
                    f"{node.title} expects Channel In={channel_in}, but current feature map has {current_channels} channels",
                )

            layers.extend(
                [
                    nn.Conv2d(
                        in_channels=channel_in,
                        out_channels=channel_out,
                        kernel_size=kernel_size,
                        stride=stride,
                        padding=padding,
                    ),
                    _activation_module(node.activation),
                ]
            )
            architecture.append(
                f"{node.title}: Conv2d({channel_in}->{channel_out}, kernel={kernel_size}, stride={stride}, padding={padding}) + {node.activation}",
            )

            current_channels = channel_out
            current_height = _conv_output_size(current_height, kernel_size, padding, stride)
            current_width = _conv_output_size(current_width, kernel_size, padding, stride)
            continue

        if node.type != "linear":
            raise ValueError(f"Unsupported block type: {node.type}")

        if not flattened:
            layers.append(nn.Flatten())
            current_features = current_channels * current_height * current_width
            flattened = True
            architecture.append(
                f"Flatten: {current_channels} x {current_height} x {current_width} -> {current_features}",
            )

        if current_features is None:
            raise ValueError("Linear block has no input features")

        expected_input = _parse_int(field_map, "Input")
        output_features = _parse_int(field_map, "Output")

        if expected_input != current_features:
            raise ValueError(
                f"{node.title} expects Input={expected_input}, but current feature size is {current_features}",
            )

        if is_last_node and output_features != num_classes:
            raise ValueError(
                f"The final Linear layer must end with Output={num_classes} for this dataset",
            )

        linear_layer = nn.Linear(current_features, output_features)
        layers.append(linear_layer)

        if is_last_node:
            architecture.append(
                f"{node.title}: Linear({current_features}->{output_features}) [output layer]",
            )
        else:
            layers.append(_activation_module(node.activation))
            architecture.append(
                f"{node.title}: Linear({current_features}->{output_features}) + {node.activation}",
            )
        current_features = output_features

    if not flattened:
        layers.append(nn.Flatten())
        current_features = current_channels * current_height * current_width
        architecture.append(
            f"Flatten: {current_channels} x {current_height} x {current_width} -> {current_features}",
        )

    return CompiledModel(model=nn.Sequential(*layers), architecture=architecture)


def build_optimizer(model: nn.Module, payload: TrainModelRequest):
    learning_rate = payload.learningRate
    weight_decay = float(payload.optimizerParams.weightDecay)
    momentum = float(payload.optimizerParams.momentum)
    rho = float(payload.optimizerParams.rho)

    if payload.optimizer == "SGD":
        return SGD(model.parameters(), lr=learning_rate, weight_decay=weight_decay)
    if payload.optimizer == "SGD+Momentum":
        return SGD(
            model.parameters(),
            lr=learning_rate,
            momentum=momentum,
            weight_decay=weight_decay,
        )
    if payload.optimizer == "AdaGrad":
        return Adagrad(model.parameters(), lr=learning_rate, weight_decay=weight_decay)
    if payload.optimizer == "RMS Prop":
        return RMSprop(
            model.parameters(),
            lr=learning_rate,
            alpha=rho,
            weight_decay=weight_decay,
        )
    if payload.optimizer == "ADAM":
        return Adam(model.parameters(), lr=learning_rate, weight_decay=weight_decay)

    raise ValueError(f"Unsupported optimizer: {payload.optimizer}")


def _run_epoch(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    device: torch.device,
    optimizer=None,
    batch_progress_callback=None,
) -> tuple[float, float]:
    is_training = optimizer is not None
    model.train(is_training)

    loss_sum = 0.0
    correct = 0
    total = 0

    context = torch.enable_grad() if is_training else torch.no_grad()
    with context:
        for batch_index, (inputs, targets) in enumerate(loader, start=1):
            inputs = inputs.to(device)
            targets = targets.to(device)

            if is_training:
                optimizer.zero_grad()

            logits = model(inputs)
            loss = criterion(logits, targets)

            if is_training:
                loss.backward()
                optimizer.step()

            batch_size = targets.size(0)
            loss_sum += loss.item() * batch_size
            predictions = logits.argmax(dim=1)
            correct += (predictions == targets).sum().item()
            total += batch_size

            if batch_progress_callback is not None:
                batch_progress_callback(
                    {
                        "currentBatch": batch_index,
                        "totalBatches": len(loader),
                        "liveTrainLoss": round(loss_sum / total, 4),
                        "liveTrainAccuracy": round(correct / total, 4),
                    }
                )

    return loss_sum / total, correct / total


def _run_triplet_epoch(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    device: torch.device,
    optimizer: torch.optim.Optimizer,
) -> float:
    model.train(True)
    loss_sum = 0.0
    total = 0

    for anchors, positives, negatives, _ in loader:
        anchors = anchors.to(device)
        positives = positives.to(device)
        negatives = negatives.to(device)

        optimizer.zero_grad()
        loss = criterion(model(anchors), model(positives), model(negatives))
        loss.backward()
        optimizer.step()

        batch_size = anchors.size(0)
        loss_sum += loss.item() * batch_size
        total += batch_size

    return loss_sum / max(total, 1)


def _collect_embeddings(
    model: nn.Module,
    loader: DataLoader,
    device: torch.device,
) -> tuple[np.ndarray, np.ndarray]:
    model.eval()
    embeddings: list[np.ndarray] = []
    labels: list[np.ndarray] = []

    with torch.no_grad():
        for inputs, targets in loader:
            outputs = model(inputs.to(device))
            embeddings.append(outputs.cpu().numpy())
            labels.append(targets.numpy())

    return np.vstack(embeddings), np.concatenate(labels)


def _build_decision_boundary_points(
    pca_values: np.ndarray,
    labels: np.ndarray,
    epoch: int,
    max_points: int = 1200,
) -> dict[str, object]:
    per_class_budget = max(max_points // 10, 1)
    rng = np.random.default_rng(RANDOM_STATE + epoch)
    selected_indices: list[int] = []

    for label in sorted(np.unique(labels)):
        label_indices = np.where(labels == label)[0]
        if len(label_indices) <= per_class_budget:
            picked = label_indices
        else:
            picked = rng.choice(label_indices, size=per_class_budget, replace=False)
        selected_indices.extend(int(index) for index in picked)

    if len(selected_indices) > max_points:
        selected_indices = selected_indices[:max_points]

    points = [
        {
            "x": round(float(pca_values[index, 0]), 4),
            "y": round(float(pca_values[index, 1]), 4),
            "z": round(float(pca_values[index, 2]), 4),
            "label": int(labels[index]),
        }
        for index in selected_indices
    ]

    return {"epoch": epoch, "points": points}


def train_model(
    payload: TrainModelRequest,
    progress_callback=None,
    model_store_id: str | None = None,
) -> dict[str, object]:
    dataset_spec = get_dataset_runtime_spec(payload.datasetId)
    compiled = compile_model(
        payload.nodes,
        input_channels=dataset_spec.input_channels,
        input_height=dataset_spec.input_height,
        input_width=dataset_spec.input_width,
        num_classes=dataset_spec.num_classes,
        starts_flattened=dataset_spec.starts_flattened,
        input_features=dataset_spec.input_features,
    )
    (
        train_loader,
        validation_loader,
        train_size,
        validation_size,
        train_subset,
        validation_subset,
    ) = build_stratified_loaders()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = compiled.model.to(device)
    optimizer = build_optimizer(model, payload)
    criterion = nn.CrossEntropyLoss()
    triplet_model = TripletEmbeddingNet(embedding_dim=64).to(device)
    triplet_optimizer = Adam(triplet_model.parameters(), lr=payload.learningRate)
    triplet_criterion = nn.TripletMarginLoss(margin=1.0, p=2)

    triplet_loader = DataLoader(
        TripletSubsetDataset(train_subset),
        batch_size=BATCH_SIZE,
        shuffle=True,
    )
    triplet_eval_loader = DataLoader(validation_subset, batch_size=BATCH_SIZE, shuffle=False)

    metrics: list[EpochMetrics] = []
    decision_boundary_epochs: list[dict[str, object]] = []
    best_validation_accuracy = 0.0

    for epoch in range(1, payload.epochs + 1):
        train_loss, train_accuracy = _run_epoch(
            model=model,
            loader=train_loader,
            criterion=criterion,
            device=device,
            optimizer=optimizer,
            batch_progress_callback=(
                lambda update, current_epoch=epoch: progress_callback(
                    {
                        "status": "running",
                        "currentEpoch": current_epoch,
                        "stage": "train",
                        **update,
                    },
                    metrics,
                    best_validation_accuracy,
                    decision_boundary_epochs,
                )
                if progress_callback is not None
                else None
            ),
        )
        validation_loss, validation_accuracy = _run_epoch(
            model=model,
            loader=validation_loader,
            criterion=criterion,
            device=device,
        )

        best_validation_accuracy = max(best_validation_accuracy, validation_accuracy)
        metrics.append(
            EpochMetrics(
                epoch=epoch,
                trainLoss=round(train_loss, 4),
                trainAccuracy=round(train_accuracy, 4),
                validationLoss=round(validation_loss, 4),
                validationAccuracy=round(validation_accuracy, 4),
            )
        )
        _run_triplet_epoch(
            model=triplet_model,
            loader=triplet_loader,
            criterion=triplet_criterion,
            device=device,
            optimizer=triplet_optimizer,
        )
        epoch_embeddings, epoch_labels = _collect_embeddings(
            model=triplet_model,
            loader=triplet_eval_loader,
            device=device,
        )
        pca = PCA(n_components=3)
        pca_result = pca.fit_transform(epoch_embeddings)
        decision_boundary_epochs.append(
            _build_decision_boundary_points(
                pca_values=pca_result,
                labels=epoch_labels,
                epoch=epoch,
            )
        )

        if progress_callback is not None:
            progress_callback(
                {
                    "status": "running",
                    "currentEpoch": epoch,
                    "currentBatch": len(train_loader),
                    "totalBatches": len(train_loader),
                    "stage": "triplet",
                    "liveTrainLoss": round(train_loss, 4),
                    "liveTrainAccuracy": round(train_accuracy, 4),
                },
                metrics,
                best_validation_accuracy,
                decision_boundary_epochs,
            )

    if model_store_id is not None:
        with TRAINING_LOCK:
            TRAINED_CLASSIFIERS[model_store_id] = (model, device, payload.datasetId)

    return {
        "datasetId": payload.datasetId,
        "epochs": payload.epochs,
        "learningRate": payload.learningRate,
        "optimizer": payload.optimizer,
        "trainSize": train_size,
        "validationSize": validation_size,
        "numClasses": dataset_spec.num_classes,
        "device": str(device),
        "architecture": compiled.architecture,
        "metrics": [metric.model_dump() for metric in metrics],
        "bestValidationAccuracy": round(best_validation_accuracy, 4),
        "decisionBoundaryEpochs": decision_boundary_epochs,
    }


def _update_job(job_id: str, updates: dict[str, object]) -> None:
    with TRAINING_LOCK:
        current = TRAINING_JOBS.get(job_id, {})
        current.update(updates)
        TRAINING_JOBS[job_id] = current


def _run_training_job(job_id: str, payload: TrainModelRequest) -> None:
    try:
        _update_job(
            job_id,
            {
                "status": "running",
                "datasetId": payload.datasetId,
                "epochs": payload.epochs,
                "learningRate": payload.learningRate,
                "optimizer": payload.optimizer,
                "metrics": [],
                "architecture": [],
                "bestValidationAccuracy": 0.0,
                "decisionBoundaryEpochs": [],
                "error": None,
            },
        )

        result = train_model(
            payload,
            progress_callback=lambda live_update, metrics, best_accuracy, boundary_epochs: _update_job(
                job_id,
                {
                    **live_update,
                    "metrics": [metric.model_dump() for metric in metrics],
                    "bestValidationAccuracy": round(best_accuracy, 4),
                    "decisionBoundaryEpochs": boundary_epochs,
                },
            ),
            model_store_id=job_id,
        )
        _update_job(job_id, {"status": "completed", **result})
    except Exception as error:  # pragma: no cover - background failures still need surfacing
        _update_job(job_id, {"status": "failed", "error": str(error)})


def start_training_job(payload: TrainModelRequest) -> dict[str, str]:
    dataset_spec = get_dataset_runtime_spec(payload.datasetId)
    compile_model(
        payload.nodes,
        input_channels=dataset_spec.input_channels,
        input_height=dataset_spec.input_height,
        input_width=dataset_spec.input_width,
        num_classes=dataset_spec.num_classes,
        starts_flattened=dataset_spec.starts_flattened,
        input_features=dataset_spec.input_features,
    )

    job_id = uuid4().hex
    with TRAINING_LOCK:
        TRAINING_JOBS[job_id] = {
            "jobId": job_id,
            "status": "queued",
            "metrics": [],
            "architecture": [],
            "decisionBoundaryEpochs": [],
            "error": None,
        }

    thread = Thread(target=_run_training_job, args=(job_id, payload), daemon=True)
    thread.start()

    return {"jobId": job_id, "status": "queued"}


def get_training_job(job_id: str) -> dict[str, object] | None:
    with TRAINING_LOCK:
        job = TRAINING_JOBS.get(job_id)
        if job is None:
            return None
        return dict(job)


def predict_mnist_digit(job_id: str, pixels: list[float]) -> dict[str, object]:
    with TRAINING_LOCK:
        trained = TRAINED_CLASSIFIERS.get(job_id)
    if trained is None:
        raise ValueError("No trained model found for this job")

    model, device, dataset_id = trained
    if dataset_id != "mnist":
        raise ValueError("Digit canvas prediction is supported only for MNIST")

    model.eval()
    tensor = torch.tensor(pixels, dtype=torch.float32).view(1, 1, 28, 28).to(device)
    with torch.no_grad():
        logits = model(tensor)
        probabilities = torch.softmax(logits, dim=1).squeeze(0).cpu().tolist()
        predicted_label = int(torch.argmax(logits, dim=1).item())

    return {
        "predictedLabel": predicted_label,
        "confidence": round(float(probabilities[predicted_label]), 4),
        "probabilities": [round(float(probability), 4) for probability in probabilities],
    }
