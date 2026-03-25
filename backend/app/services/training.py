import gzip
import math
import struct
from dataclasses import dataclass
from pathlib import Path
from threading import Lock, Thread
from time import sleep
from uuid import uuid4

import numpy as np
import torch
from torch import nn
from torch.optim import Adagrad, Adam, RMSprop, SGD
from torch.utils.data import DataLoader, Subset, TensorDataset

from app.schemas.training import CanvasNodePayload, EpochMetrics, TrainModelRequest
from app.services.datasets import DATA_DIR, ensure_mnist_downloaded, get_dataset_runtime_spec


BATCH_SIZE = 128
RANDOM_STATE = 42
TRAINING_JOBS: dict[str, dict[str, object]] = {}
TRAINING_LOCK = Lock()


class TrainingStoppedError(Exception):
    pass


@dataclass
class CompiledModel:
    model: nn.Module
    architecture: list[str]


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


def build_stratified_loaders() -> tuple[DataLoader, DataLoader, int, int]:
    dataset = load_mnist_dataset()
    _, labels = dataset.tensors

    generator = np.random.default_rng(RANDOM_STATE)
    train_index_parts: list[np.ndarray] = []
    validation_index_parts: list[np.ndarray] = []

    for class_id in torch.unique(labels).tolist():
        class_indices = np.where(labels.numpy() == class_id)[0]
        shuffled = generator.permutation(class_indices)
        split_index = int(len(shuffled) * 0.8)
        train_index_parts.append(shuffled[:split_index])
        validation_index_parts.append(shuffled[split_index:])

    train_indices = np.concatenate(train_index_parts)
    validation_indices = np.concatenate(validation_index_parts)
    train_indices = generator.permutation(train_indices)
    validation_indices = generator.permutation(validation_indices)

    train_loader = DataLoader(
        Subset(dataset, train_indices.tolist()),
        batch_size=BATCH_SIZE,
        shuffle=True,
    )
    validation_loader = DataLoader(
        Subset(dataset, validation_indices.tolist()),
        batch_size=BATCH_SIZE,
        shuffle=False,
    )

    return train_loader, validation_loader, len(train_indices), len(validation_indices)


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


def _pooling_module(pool_type: str, kernel_size: int, stride: int, padding: int) -> nn.Module:
    if pool_type == "AdaptiveAvgPool":
        return nn.AdaptiveAvgPool2d((1, 1))
    if pool_type == "AvgPool":
        return nn.AvgPool2d(kernel_size=kernel_size, stride=stride, padding=padding)
    if pool_type == "MaxPool":
        return nn.MaxPool2d(kernel_size=kernel_size, stride=stride, padding=padding)
    raise ValueError(f"Unsupported pooling type: {pool_type}")


def _parse_pooling_stride(field_map: dict[str, str], kernel_size: int) -> int:
    value = field_map.get("Stride", "").strip().lower()
    if value == "" or value == "none":
        return kernel_size
    return int(value)


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

        if node.type == "pooling":
            if flattened:
                raise ValueError("Pooling blocks must come before Linear blocks")

            pool_type = field_map.get("Pool Type", "MaxPool")
            if pool_type == "AdaptiveAvgPool":
                layers.append(_pooling_module(pool_type, 1, 1, 0))
                architecture.append(f"{node.title}: AdaptiveAvgPool2d((1, 1))")
                current_height = 1
                current_width = 1
                continue

            padding = _parse_int(field_map, "Padding")
            kernel_size = _parse_kernel_size(field_map.get("Kernel Size", "2"))
            stride = _parse_pooling_stride(field_map, kernel_size)

            layers.append(_pooling_module(pool_type, kernel_size, stride, padding))
            architecture.append(
                f"{node.title}: {pool_type}(kernel={kernel_size}, stride={stride}, padding={padding})",
            )

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


def _get_training_device() -> torch.device:
    if torch.cuda.is_available():
        return torch.device("cuda")

    mps_backend = getattr(torch.backends, "mps", None)
    if mps_backend is not None and mps_backend.is_available():
        return torch.device("mps")

    return torch.device("cpu")


def _wait_for_job(job_id: str | None) -> None:
    if job_id is None:
        return

    while True:
        job = get_training_job(job_id)
        if job is None:
            raise TrainingStoppedError("Training job not found")

        status = job.get("status")
        if status == "stopped":
            raise TrainingStoppedError("Training stopped")
        if status != "paused":
            return

        sleep(0.15)


def _train_one_epoch(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    device: torch.device,
    optimizer,
    job_id: str | None = None,
    batch_progress_callback=None,
) -> tuple[float, float]:
    model.train(True)

    loss_sum = 0.0
    correct = 0
    total = 0

    for batch_index, (inputs, targets) in enumerate(loader, start=1):
        _wait_for_job(job_id)

        inputs = inputs.to(device)
        targets = targets.to(device)

        optimizer.zero_grad()

        logits = model(inputs)
        loss = criterion(logits, targets)
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


def _evaluate_model(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    device: torch.device,
    job_id: str | None = None,
    batch_progress_callback=None,
) -> tuple[float, float]:
    model.eval()

    loss_sum = 0.0
    correct = 0
    total = 0

    with torch.no_grad():
        for batch_index, (inputs, targets) in enumerate(loader, start=1):
            _wait_for_job(job_id)

            inputs = inputs.to(device)
            targets = targets.to(device)
            logits = model(inputs)
            loss = criterion(logits, targets)

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
                    }
                )

    return loss_sum / total, correct / total


def _evaluate_validation_snapshot(
    model: nn.Module,
    validation_iterator,
    loader: DataLoader,
    criterion: nn.Module,
    device: torch.device,
    job_id: str | None = None,
) -> tuple[float, float, object]:
    try:
        inputs, targets = next(validation_iterator)
    except StopIteration:
        validation_iterator = iter(loader)
        inputs, targets = next(validation_iterator)

    _wait_for_job(job_id)

    was_training = model.training
    model.eval()
    with torch.no_grad():
        inputs = inputs.to(device)
        targets = targets.to(device)
        logits = model(inputs)
        loss = criterion(logits, targets)
        accuracy = (logits.argmax(dim=1) == targets).float().mean().item()

    model.train(was_training)
    return loss.item(), accuracy, validation_iterator


def train_model(
    payload: TrainModelRequest,
    job_id: str | None = None,
    progress_callback=None,
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
    train_loader, validation_loader, train_size, validation_size = build_stratified_loaders()

    device = _get_training_device()
    model = compiled.model.to(device)
    optimizer = build_optimizer(model, payload)
    criterion = nn.CrossEntropyLoss()

    metrics: list[EpochMetrics] = []
    best_validation_accuracy = 0.0

    for epoch in range(1, payload.epochs + 1):
        validation_iter_ref = [iter(validation_loader)]
        train_step_loss, train_step_accuracy = _train_one_epoch(
            model=model,
            loader=train_loader,
            criterion=criterion,
            device=device,
            optimizer=optimizer,
            job_id=job_id,
            batch_progress_callback=(
                lambda update, current_epoch=epoch: (
                    lambda validation_snapshot: (
                        progress_callback(
                            {
                                "status": "running",
                                "currentEpoch": current_epoch,
                                "stage": "train",
                                **update,
                                "liveValidationLoss": round(validation_snapshot[0], 4),
                                "liveValidationAccuracy": round(validation_snapshot[1], 4),
                            },
                            metrics,
                            best_validation_accuracy,
                        ),
                        validation_iter_ref.__setitem__(0, validation_snapshot[2]),
                    )
                )(
                    _evaluate_validation_snapshot(
                        model=model,
                        validation_iterator=validation_iter_ref[0],
                        loader=validation_loader,
                        criterion=criterion,
                        device=device,
                        job_id=job_id,
                    )
                )
                if progress_callback is not None
                else None
            ),
        )

        train_loss, train_accuracy = _evaluate_model(
            model=model,
            loader=train_loader,
            criterion=criterion,
            device=device,
            job_id=job_id,
        )
        validation_loss, validation_accuracy = _evaluate_model(
            model=model,
            loader=validation_loader,
            criterion=criterion,
            device=device,
            job_id=job_id,
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
        if progress_callback is not None:
            progress_callback(
                {
                    "status": "running",
                    "currentEpoch": epoch,
                    "currentBatch": len(train_loader),
                    "totalBatches": len(train_loader),
                    "stage": "validation",
                    "liveTrainLoss": round(train_loss, 4),
                    "liveTrainAccuracy": round(train_accuracy, 4),
                    "liveValidationLoss": round(validation_loss, 4),
                    "liveValidationAccuracy": round(validation_accuracy, 4),
                },
                metrics,
                best_validation_accuracy,
            )

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
                "error": None,
            },
        )

        result = train_model(
            payload,
            job_id=job_id,
            progress_callback=lambda live_update, metrics, best_accuracy: _update_job(
                job_id,
                {
                    **live_update,
                    "metrics": [metric.model_dump() for metric in metrics],
                    "bestValidationAccuracy": round(best_accuracy, 4),
                },
            ),
        )
        _update_job(job_id, {"status": "completed", **result})
    except TrainingStoppedError:
        _update_job(job_id, {"status": "stopped"})
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


def pause_training_job(job_id: str) -> dict[str, str] | None:
    with TRAINING_LOCK:
        job = TRAINING_JOBS.get(job_id)
        if job is None:
            return None
        if job.get("status") == "running":
            job["status"] = "paused"
        return {"jobId": job_id, "status": str(job.get("status"))}


def resume_training_job(job_id: str) -> dict[str, str] | None:
    with TRAINING_LOCK:
        job = TRAINING_JOBS.get(job_id)
        if job is None:
            return None
        if job.get("status") == "paused":
            job["status"] = "running"
        return {"jobId": job_id, "status": str(job.get("status"))}


def stop_training_job(job_id: str) -> dict[str, str] | None:
    with TRAINING_LOCK:
        job = TRAINING_JOBS.get(job_id)
        if job is None:
            return None
        job["status"] = "stopped"
        return {"jobId": job_id, "status": "stopped"}
