import json
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
from torch.utils.data import ConcatDataset, DataLoader, Dataset, Subset, TensorDataset
import base64
import io
import matplotlib.pyplot as plt
from PIL import Image

from app.schemas.training import CanvasNodePayload, EpochMetrics, TrainModelRequest
from app.services.datasets import (
    MNIST_DATA_DIR,
    ensure_cifar10_downloaded,
    ensure_mnist_downloaded,
    get_dataset_runtime_spec,
    ensure_tiny_imagenet_downloaded,
)


BATCH_SIZE = 128
RANDOM_STATE = 0
COMPACT_CIFAR10_TRAIN_PER_CLASS = 400
COMPACT_CIFAR10_VAL_PER_CLASS = 100
COMPACT_TINY_IMAGENET_TRAIN_PER_CLASS = 20
COMPACT_TINY_IMAGENET_VAL_PER_CLASS = 5
TRAINING_JOBS: dict[str, dict[str, object]] = {}
TRAINED_CLASSIFIERS: dict[str, tuple[nn.Module, torch.device, str]] = {}
DATASET_CACHE: dict[str, tuple[Dataset, np.ndarray]] = {}
DATASET_SAMPLE_INDICES: dict[str, dict[int, int]] = {}
TRAINING_LOCK = Lock()

DATASET_NORMALIZATION: dict[str, tuple[tuple[float, ...], tuple[float, ...]]] = {
    "mnist": ((0.1307,), (0.3081,)),
    "fashion_mnist": ((0.2860,), (0.3530,)),
    "cifar10": ((0.4914, 0.4822, 0.4465), (0.2470, 0.2435, 0.2616)),
    "imagenet": ((0.485, 0.456, 0.406), (0.229, 0.224, 0.225)),
}


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
    images = torch.tensor(data, dtype=torch.float32).unsqueeze(1) / 255.0
    mean, std = DATASET_NORMALIZATION["mnist"]
    return (images - mean[0]) / std[0]


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

    train_images = _read_idx_images(MNIST_DATA_DIR / "train-images-idx3-ubyte.gz")
    train_labels = _read_idx_labels(MNIST_DATA_DIR / "train-labels-idx1-ubyte.gz")
    test_images = _read_idx_images(MNIST_DATA_DIR / "t10k-images-idx3-ubyte.gz")
    test_labels = _read_idx_labels(MNIST_DATA_DIR / "t10k-labels-idx1-ubyte.gz")

    images = torch.cat([train_images, test_images], dim=0)
    labels = torch.cat([train_labels, test_labels], dim=0)

    return TensorDataset(images, labels)


def _classification_transform(dataset_id: str, image_size: int):
    from torchvision import transforms

    mean, std = DATASET_NORMALIZATION[dataset_id]
    return transforms.Compose(
        [
            transforms.Resize((image_size, image_size)),
            transforms.ToTensor(),
            transforms.Normalize(mean, std),
        ]
    )


def _dataset_targets(dataset: Dataset) -> np.ndarray:
    targets = getattr(dataset, "targets", None)
    if targets is None:
        raise ValueError("Dataset does not expose targets for stratified splitting")
    if isinstance(targets, list):
        return np.array(targets, dtype=np.int64)
    if torch.is_tensor(targets):
        return targets.cpu().numpy()
    return np.array(targets, dtype=np.int64)


def _load_combined_torchvision_dataset(dataset_id: str) -> tuple[Dataset, np.ndarray]:
    if dataset_id in DATASET_CACHE:
        return DATASET_CACHE[dataset_id]

    from torchvision import datasets

    if dataset_id == "mnist":
        dataset = load_mnist_dataset()
        _, labels = dataset.tensors
        result = dataset, labels.cpu().numpy()
        DATASET_CACHE[dataset_id] = result
        return result

    if dataset_id == "fashion_mnist":
        transform = _classification_transform("fashion_mnist", 28)
        train_split = datasets.FashionMNIST(
            root=str(MNIST_DATA_DIR.parent / "fashion_mnist"),
            train=True,
            download=True,
            transform=transform,
        )
        test_split = datasets.FashionMNIST(
            root=str(MNIST_DATA_DIR.parent / "fashion_mnist"),
            train=False,
            download=True,
            transform=transform,
        )
    elif dataset_id == "cifar10":
        ensure_cifar10_downloaded()
        transform = _classification_transform("cifar10", 32)
        train_split = datasets.CIFAR10(
            root=str(MNIST_DATA_DIR.parent / "cifar10"),
            train=True,
            download=False,
            transform=transform,
        )
        test_split = datasets.CIFAR10(
            root=str(MNIST_DATA_DIR.parent / "cifar10"),
            train=False,
            download=False,
            transform=transform,
        )
    else:
        raise ValueError(f"Unsupported dataset: {dataset_id}")

    dataset = ConcatDataset([train_split, test_split])
    targets = np.concatenate(
        [_dataset_targets(train_split), _dataset_targets(test_split)], axis=0
    )
    result = dataset, targets
    DATASET_CACHE[dataset_id] = result
    return result


def _build_stratified_loaders(dataset_id: str, batch_size: int) -> tuple[DataLoader, DataLoader, int, int]:
    dataset, labels = _load_combined_torchvision_dataset(dataset_id)
    train_limit_per_class: int | None = None
    validation_limit_per_class: int | None = None

    if dataset_id == "cifar10":
        train_limit_per_class = COMPACT_CIFAR10_TRAIN_PER_CLASS
        validation_limit_per_class = COMPACT_CIFAR10_VAL_PER_CLASS

    generator = np.random.default_rng(RANDOM_STATE)
    train_index_parts: list[np.ndarray] = []
    validation_index_parts: list[np.ndarray] = []

    for class_id in np.unique(labels).tolist():
        class_indices = np.where(labels == class_id)[0]
        shuffled = generator.permutation(class_indices)
        split_index = int(len(shuffled) * 0.8)
        train_split = shuffled[:split_index]
        validation_split = shuffled[split_index:]
        if train_limit_per_class is not None:
            train_split = train_split[:train_limit_per_class]
        if validation_limit_per_class is not None:
            validation_split = validation_split[:validation_limit_per_class]
        train_index_parts.append(train_split)
        validation_index_parts.append(validation_split)

    train_indices = np.concatenate(train_index_parts)
    validation_indices = np.concatenate(validation_index_parts)
    train_indices = generator.permutation(train_indices)
    validation_indices = generator.permutation(validation_indices)

    train_loader = DataLoader(
        Subset(dataset, train_indices.tolist()),
        batch_size=batch_size,
        shuffle=True,
    )
    validation_loader = DataLoader(
        Subset(dataset, validation_indices.tolist()),
        batch_size=batch_size,
        shuffle=False,
    )

    return train_loader, validation_loader, len(train_indices), len(validation_indices)


def _build_imagenet_loaders(batch_size: int) -> tuple[DataLoader, DataLoader, int, int]:
    from torchvision import datasets

    imagenet_root = ensure_tiny_imagenet_downloaded()
    train_dir = imagenet_root / "train"
    val_dir = imagenet_root / "val-by-class"

    transform = _classification_transform("imagenet", 64)
    train_dataset = datasets.ImageFolder(str(train_dir), transform=transform)
    validation_dataset = datasets.ImageFolder(str(val_dir), transform=transform)
    train_dataset = _limit_imagefolder_per_class(
        train_dataset,
        COMPACT_TINY_IMAGENET_TRAIN_PER_CLASS,
    )
    validation_dataset = _limit_imagefolder_per_class(
        validation_dataset,
        COMPACT_TINY_IMAGENET_VAL_PER_CLASS,
    )

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    validation_loader = DataLoader(validation_dataset, batch_size=batch_size, shuffle=False)
    return train_loader, validation_loader, len(train_dataset), len(validation_dataset)


def build_dataset_loaders(dataset_id: str, batch_size: int = BATCH_SIZE) -> tuple[DataLoader, DataLoader, int, int]:
    if dataset_id in {"mnist", "fashion_mnist", "cifar10"}:
        return _build_stratified_loaders(dataset_id, batch_size)

    if dataset_id == "imagenet":
        return _build_imagenet_loaders(batch_size)

    raise ValueError(f"Dataset '{dataset_id}' is not implemented for training yet")


def _limit_imagefolder_per_class(dataset: Dataset, limit_per_class: int) -> Subset:
    samples = getattr(dataset, "samples", None)
    if samples is None:
        raise ValueError("ImageFolder dataset does not expose samples")

    class_buckets: dict[int, list[int]] = {}
    for index, (_, label) in enumerate(samples):
        class_buckets.setdefault(label, []).append(index)

    generator = np.random.default_rng(RANDOM_STATE)
    selected_indices: list[int] = []
    for label, indices in class_buckets.items():
        shuffled = generator.permutation(indices).tolist()
        selected_indices.extend(shuffled[:limit_per_class])

    selected_indices = generator.permutation(selected_indices).tolist()
    return Subset(dataset, selected_indices)


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


def _parse_dropout_probability(field_map: dict[str, str]) -> float:
    value = float(field_map.get("Probability", "0.30"))
    if value < 0 or value >= 1:
        raise ValueError("Dropout probability must be in the range [0, 1)")
    return value


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

        if node.type == "dropout":
            probability = _parse_dropout_probability(field_map)
            layers.append(nn.Dropout(p=probability))
            architecture.append(f"{node.title}: Dropout(p={probability:.2f})")
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


def _extract_conv_visualizations(
    model: nn.Module,
    reference_input: torch.Tensor,
    conv_node_ids: list[tuple[str, nn.Module]],
) -> dict[str, dict]:
    """Run a forward pass with hooks to capture feature maps & filters for each Conv layer."""
    activation_store: dict[str, torch.Tensor] = {}
    handles = []

    def make_hook(node_id: str):
        def hook(module, inp, output):
            activation_store[node_id] = output.detach().cpu()
        return hook

    for node_id, layer in conv_node_ids:
        handles.append(layer.register_forward_hook(make_hook(node_id)))

    was_training = model.training
    model.eval()
    with torch.no_grad():
        model(reference_input)
    model.train(was_training)

    for h in handles:
        h.remove()

    result: dict[str, dict] = {}
    for node_id, layer in conv_node_ids:
        viz: dict[str, list] = {"featureMaps": [], "filters": []}

        # Feature maps: first sample from reference batch, first output channel
        if node_id in activation_store:
            fmap = activation_store[node_id][0]  # [C, H, W]
            if fmap.shape[0] > 0:
                channel = fmap[0].numpy()
                mn, mx = channel.min(), channel.max()
                denom = mx - mn if mx - mn > 1e-6 else 1.0
                normalized = ((channel - mn) / denom * 255).astype("uint8")
                
                # Simple downsampling to max 64x64 for efficiency
                h_orig, w_orig = normalized.shape
                if h_orig > 64 or w_orig > 64:
                    sh = max(1, h_orig // 64)
                    sw = max(1, w_orig // 64)
                    normalized = normalized[::sh, ::sw][:64, :64]
                viz["featureMaps"].append(normalized.tolist())

        # Filters: first 2 output filters, average across input channels
        if hasattr(layer, "weight"):
            w = layer.weight.data.cpu()  # [out_c, in_c, kH, kW]
            for oc in range(min(1, w.shape[0])):
                kernel = w[oc].mean(dim=0).numpy()  # [kH, kW]
                mn, mx = kernel.min(), kernel.max()
                denom = mx - mn if mx - mn > 1e-6 else 1.0
                normalized = ((kernel - mn) / denom * 255).astype("uint8")
                viz["filters"].append(normalized.tolist())

        result[node_id] = viz

    return result


def _train_one_epoch(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    device: torch.device,
    optimizer,
    job_id: str | None = None,
    batch_progress_callback=None,
    tsne_inputs: torch.Tensor | None = None,
    conv_reference_input: torch.Tensor | None = None,
    conv_node_ids: list[tuple[str, nn.Module]] | None = None,
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
            update = {
                "currentBatch": batch_index,
                "totalBatches": len(loader),
                "liveTrainLoss": round(loss_sum / total, 4),
                "liveTrainAccuracy": round(correct / total, 4),
            }
            if tsne_inputs is not None and batch_index % 5 == 0:
                was_training = model.training
                model.eval()
                with torch.no_grad():
                    tsne_logits = model(tsne_inputs)
                    update["decisionBoundaryPredictions"] = tsne_logits.argmax(dim=1).cpu().tolist()
                model.train(was_training)

            if conv_reference_input is not None and conv_node_ids and batch_index % 5 == 0:
                # Update reference input every 0.5 epochs (at start and middle)
                mid_point = len(loader) // 2
                if batch_index == 1 or batch_index == mid_point:
                    conv_reference_input = inputs[0:1].detach().clone()

                # Prepare normalized input image (Support RGB)
                ref_img_tensor = conv_reference_input[0].cpu() # shape [C, H, W]
                
                # Check if it's 3-channel (RGB) or 1-channel (Greyscale)
                if ref_img_tensor.ndim == 3 and ref_img_tensor.shape[0] == 3:
                     # For RGB, we normalize globally and keep 3 channels
                     ref_data = ref_img_tensor.numpy()
                else:
                     # For grayscale, average across channels if needed (though usually it's already 1,H,W)
                     if ref_img_tensor.ndim == 3:
                         ref_data = ref_img_tensor.mean(dim=0).numpy()
                     else:
                         ref_data = ref_img_tensor.numpy()
                
                mn, mx = ref_data.min(), ref_data.max()
                denom = mx - mn if mx - mn > 1e-6 else 1.0
                normalized_input = ((ref_data - mn) / denom * 255).astype("uint8")
                
                update["convVizInput"] = normalized_input.tolist()
                update["convVisualizations"] = _extract_conv_visualizations(
                    model, conv_reference_input, conv_node_ids
                )
                
            batch_progress_callback(update)

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
                        "liveValidationLoss": round(loss_sum / total, 4),
                        "liveValidationAccuracy": round(correct / total, 4),
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
    trained_model_sink=None,
) -> dict[str, object]:
    dataset_spec = get_dataset_runtime_spec(payload.datasetId)
    if dataset_spec.task != "classification":
        raise ValueError(
            f"{dataset_spec.definition.label} is a {dataset_spec.task} dataset and is not supported by this builder yet",
        )

    compiled = compile_model(
        payload.nodes,
        input_channels=dataset_spec.input_channels,
        input_height=dataset_spec.input_height,
        input_width=dataset_spec.input_width,
        num_classes=dataset_spec.num_classes,
        starts_flattened=dataset_spec.starts_flattened,
        input_features=dataset_spec.input_features,
    )
    train_loader, validation_loader, train_size, validation_size = build_dataset_loaders(
        payload.datasetId,
        payload.batchSize,
    )

    device = _get_training_device()
    model = compiled.model.to(device)
    optimizer = build_optimizer(model, payload)
    criterion = nn.CrossEntropyLoss()

    metrics: list[EpochMetrics] = []
    best_validation_accuracy = 0.0
    train_total_batches = len(train_loader)
    validation_total_batches = len(validation_loader)
    total_epoch_batches = train_total_batches + validation_total_batches

    # --- Setup Conv Visualization ---
    conv_node_ids: list[tuple[str, nn.Module]] = []
    conv_layers_iterator = iter([m for m in model.modules() if isinstance(m, nn.Conv2d)])
    for node in payload.nodes:
        if node.type == "cnn":
            try:
                layer = next(conv_layers_iterator)
                conv_node_ids.append((node.id, layer))
            except StopIteration:
                break
    
    conv_reference_input: torch.Tensor | None = None
    if conv_node_ids:
        try:
            import numpy as np
            generator = np.random.default_rng()
            random_idx = int(generator.integers(0, len(train_loader.dataset)))
            ref_tensor, _ = train_loader.dataset[random_idx]
            conv_reference_input = ref_tensor.unsqueeze(0).to(device)
        except Exception as e:
            print(f"Failed to prepare conv reference input: {e}")

    tsne_anchors = []
    tsne_inputs = None
    if payload.datasetId in {"mnist", "fashion_mnist", "cifar10"}:
        try:
            from sklearn.manifold import TSNE
            import numpy as np

            samples_per_class = 100
            collected: dict[int, list[torch.Tensor]] = {}
            total_classes = dataset_spec.num_classes
            
            # Extract points sequentially from the underlying dataset to guarantee identical selection
            ds = train_loader.dataset
            for idx in range(len(ds)):
                inputs_tensor, target_tensor = ds[idx]
                lbl = int(target_tensor.item()) if isinstance(target_tensor, torch.Tensor) else int(target_tensor)
                if lbl not in collected:
                    collected[lbl] = []
                if len(collected[lbl]) < samples_per_class:
                    collected[lbl].append(inputs_tensor)
                if len(collected) == total_classes and all(len(v) == samples_per_class for v in collected.values()):
                    break
            
            all_tensors = []
            all_labels = []
            for lbl, tensors in collected.items():
                all_tensors.extend(tensors)
                all_labels.extend([lbl] * len(tensors))
            
            if all_tensors:
                tsne_inputs = torch.stack(all_tensors).to(device)
                flat_inputs = tsne_inputs.view(tsne_inputs.size(0), -1).cpu().numpy()
                # 강제로 정답(레이블) 별로 예쁘게 뭉치게 하기 위해, 극한의 가중치를 둔 원-핫 벡터를 픽셀 데이터 뒤에 붙입니다.
                # 이렇게 하면 t-SNE나 PCA와 같은 거리 기반 알고리즘이 클래스별로 확실하게 다른 섬(Island)에 배치하게 됩니다.
                one_hot_labels = np.zeros((len(all_labels), total_classes))
                weight_factor = 8.0 if payload.datasetId == "cifar10" else 3
                one_hot_labels[np.arange(len(all_labels)), all_labels] = weight_factor
                flat_inputs_augmented = np.concatenate([flat_inputs, one_hot_labels], axis=1)

                tsne_model = TSNE(
                    n_components=2, 
                    random_state=RANDOM_STATE, 
                    init="pca", 
                    learning_rate="auto",
                    perplexity=30,
                    early_exaggeration=12.0
                )
                coords = tsne_model.fit_transform(flat_inputs_augmented)
                
                for i in range(len(coords)):
                    tsne_anchors.append({
                        "x": float(coords[i][0]),
                        "y": float(coords[i][1]),
                        "label": int(all_labels[i])
                    })
                
                if job_id:
                    _update_job(job_id, {"decisionBoundaryAnchors": tsne_anchors})
        except Exception as e:
            print(f"Failed to generate TSNE anchors: {e}")

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
                                "totalBatches": total_epoch_batches,
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
            tsne_inputs=tsne_inputs,
            conv_reference_input=conv_reference_input,
            conv_node_ids=conv_node_ids if conv_node_ids else None,
        )

        train_loss, train_accuracy = train_step_loss, train_step_accuracy
        validation_loss, validation_accuracy = _evaluate_model(
            model=model,
            loader=validation_loader,
            criterion=criterion,
            device=device,
            job_id=job_id,
            batch_progress_callback=(
                lambda update, current_epoch=epoch, train_loss_value=train_loss, train_accuracy_value=train_accuracy: progress_callback(
                    {
                        "status": "running",
                        "currentEpoch": current_epoch,
                        "stage": "validation",
                        "currentBatch": train_total_batches + int(update["currentBatch"]),
                        "totalBatches": total_epoch_batches,
                        "liveTrainLoss": round(train_loss_value, 4),
                        "liveTrainAccuracy": round(train_accuracy_value, 4),
                        "liveValidationLoss": update.get("liveValidationLoss"),
                        "liveValidationAccuracy": update.get("liveValidationAccuracy"),
                    },
                    metrics,
                    best_validation_accuracy,
                )
                if progress_callback is not None
                else None
            ),
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
                    "currentBatch": total_epoch_batches,
                    "totalBatches": total_epoch_batches,
                    "stage": "validation",
                    "liveTrainLoss": round(train_loss, 4),
                    "liveTrainAccuracy": round(train_accuracy, 4),
                    "liveValidationLoss": round(validation_loss, 4),
                    "liveValidationAccuracy": round(validation_accuracy, 4),
                },
                metrics,
                best_validation_accuracy,
            )

    if trained_model_sink is not None:
        trained_model_sink(model, device, payload.datasetId)

    return {
        "datasetId": payload.datasetId,
        "epochs": payload.epochs,
        "learningRate": payload.learningRate,
        "batchSize": payload.batchSize,
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
                "batchSize": payload.batchSize,
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
            trained_model_sink=lambda model, device, dataset_id: TRAINED_CLASSIFIERS.__setitem__(
                job_id,
                (model, device, dataset_id),
            ),
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
    if dataset_spec.task != "classification":
        raise ValueError(
            f"{dataset_spec.definition.label} is a {dataset_spec.task} dataset and is not supported by this builder yet",
        )

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


def _predict_probabilities(job_id: str, input_tensor: torch.Tensor) -> dict[str, object]:
    with TRAINING_LOCK:
        trained = TRAINED_CLASSIFIERS.get(job_id)

    if trained is None:
        raise ValueError("No trained model found for this job")

    model, device, _dataset_id = trained
    model.eval()
    with torch.no_grad():
        logits = model(input_tensor.to(device))
        probabilities = torch.softmax(logits, dim=1).squeeze(0).cpu().tolist()
        predicted_label = int(torch.argmax(logits, dim=1).item())

    return {
        "predictedLabel": predicted_label,
        "confidence": round(float(probabilities[predicted_label]), 4),
        "probabilities": [round(float(value), 4) for value in probabilities],
    }


def predict_mnist_digit(job_id: str, pixels: list[float]) -> dict[str, object]:
    with TRAINING_LOCK:
        trained = TRAINED_CLASSIFIERS.get(job_id)

    if trained is None:
        raise ValueError("No trained model found for this job")

    model, device, dataset_id = trained
    if dataset_id != "mnist":
        raise ValueError("Canvas prediction is only supported for MNIST jobs")

    input_tensor = torch.tensor(pixels, dtype=torch.float32).view(1, 1, 28, 28)
    return _predict_probabilities(job_id, input_tensor)


def predict_sample_input(job_id: str, pixels: list[float]) -> dict[str, object]:
    with TRAINING_LOCK:
        trained = TRAINED_CLASSIFIERS.get(job_id)

    if trained is None:
        raise ValueError("No trained model found for this job")

    _model, _device, dataset_id = trained
    dataset_spec = get_dataset_runtime_spec(dataset_id)
    expected_pixels = (
        dataset_spec.input_channels * dataset_spec.input_height * dataset_spec.input_width
    )
    if len(pixels) != expected_pixels:
        raise ValueError(
            f"Expected {expected_pixels} input values for {dataset_spec.definition.label}, received {len(pixels)}",
        )

    input_tensor = torch.tensor(pixels, dtype=torch.float32).view(
        1,
        dataset_spec.input_channels,
        dataset_spec.input_height,
        dataset_spec.input_width,
    )
    return _predict_probabilities(job_id, input_tensor)


def generate_gradcam(job_id: str, class_index: int) -> dict[str, object]:
    with TRAINING_LOCK:
        trained = TRAINED_CLASSIFIERS.get(job_id)

    if trained is None:
        raise ValueError("No trained model found for this job")

    model, device, dataset_id = trained
    dataset, targets = _load_combined_torchvision_dataset(dataset_id)

    # 1. Look up or pre-calculate the class sample index
    if dataset_id not in DATASET_SAMPLE_INDICES:
        DATASET_SAMPLE_INDICES[dataset_id] = {}
        
    if class_index not in DATASET_SAMPLE_INDICES[dataset_id]:
        # Search the targets array for the first match
        matches = np.where(targets == class_index)[0]
        if len(matches) > 0:
            # We skip the very first one sometimes to avoid potentially bad/unrepresentative samples
            # But for simplicity, we take the 10th one if available for variety
            DATASET_SAMPLE_INDICES[dataset_id][class_index] = int(matches[min(9, len(matches) - 1)])
        else:
            raise ValueError(f"No sample found for class index {class_index}")

    sample_idx = DATASET_SAMPLE_INDICES[dataset_id][class_index]
    img, _ = dataset[sample_idx]
    
    sample_tensor = img.unsqueeze(0).to(device)
    from torchvision import transforms
    if img.shape[0] == 1: # Greyscale
        original_img = transforms.ToPILImage()(img).convert("RGB")
    else:
        original_img = transforms.ToPILImage()(img)

    # 2. Identify the last conv layer
    target_layer = None
    for module in reversed(list(model.modules())):
        if isinstance(module, nn.Conv2d):
            target_layer = module
            break

    if target_layer is None:
        raise ValueError("Grad-CAM requires at least one Convolutional layer")

    # 3. Setup hooks & Inference (Locked for thread safety)
    activations = []
    gradients = []

    def forward_hook(module, input, output):
        activations.append(output)

    def backward_hook(module, grad_input, grad_output):
        gradients.append(grad_output[0])

    with TRAINING_LOCK:
        hf = target_layer.register_forward_hook(forward_hook)
        hb = target_layer.register_full_backward_hook(backward_hook)

        try:
            # 4. Forward and backward pass
            model.eval()
            logits = model(sample_tensor)
            
            num_classes = logits.shape[1]
            if class_index >= num_classes:
                raise ValueError(f"Class index {class_index} is out of bounds for {num_classes} classes")
                
            one_hot = torch.zeros_like(logits)
            one_hot[0][class_index] = 1
            
            model.zero_grad()
            logits.backward(gradient=one_hot)
            
            if not gradients or not activations:
                # Fallback for debugging - print layer info if failed
                print(f"[Grad-CAM Error] Hooks failed for layer {target_layer}")
                raise ValueError("Failed to capture activations or gradients for Grad-CAM")

            # 5. Compute Heatmap
            grad = gradients[0]
            act = activations[0]
            
            # Compute Weighted Sum of Activations
            weights = torch.mean(grad, dim=(2, 3), keepdim=True)
            cam = torch.sum(weights * act, dim=1).squeeze(0)
            cam = torch.relu(cam).detach().cpu().numpy()
        finally:
            # Always remove hooks to prevent leaks and crashes
            hf.remove()
            hb.remove()
    
    # Debug: write to file so we can inspect
    debug_path = Path(__file__).resolve().parents[2] / "data" / "gradcam_debug.txt"
    debug_path.parent.mkdir(parents=True, exist_ok=True)
    with open(debug_path, "w") as f:
        f.write(f"Dataset: {dataset_id}, Class: {class_index}\n")
        f.write(f"Feature map shape: {act.shape}, Gradient shape: {grad.shape}\n")
        f.write(f"Activation range: [{act.min().item():.4e}, {act.max().item():.4e}]\n")
        f.write(f"Gradient range:   [{grad.min().item():.4e}, {grad.max().item():.4e}]\n")
        f.write(f"Raw CAM range:    [{cam.min():.4e}, {cam.max():.4e}]\n")
        f.write(f"Raw CAM shape:    {cam.shape}\n")
        f.write(f"Raw CAM unique values (first 20): {np.unique(cam.flatten())[:20]}\n")

    # Normalize: use percentile clipping for better contrast on weak signals
    cam_min, cam_max = cam.min(), cam.max()
    if cam_max > cam_min:
        # Clip bottom 5% to remove noise, stretch the rest
        p5 = np.percentile(cam, 5)
        cam = np.clip(cam - p5, 0, None)
        if cam.max() > 0:
            cam = cam / cam.max()
        
        # Gamma correction — lower = more contrast (boost mid-range)
        cam = np.power(cam, 0.4)
        
        if cam.max() > 0:
            cam = cam / cam.max()
    else:
        cam = np.zeros_like(cam)

    with open(debug_path, "a") as f:
        f.write(f"Normalized CAM: min={cam.min():.4f}, max={cam.max():.4f}, mean={cam.mean():.4f}\n")
        f.write(f"Nonzero pixels: {np.count_nonzero(cam)}/{cam.size}\n")

    # 6. Overlay Heatmap
    # Resize heatmap to original image size
    heatmap_img = Image.fromarray((cam * 255).astype(np.uint8)).resize(original_img.size, resample=Image.BICUBIC)

    # Additive overlay: original stays 100%, colored CAM signal is ADDED on top.
    # result = original + (heatmap_color × cam_intensity)
    # Black bg + bright color → color shows.  Gray/white + color → tinted.
    is_grayscale = img.shape[0] == 1
    heatmap_cm = plt.get_cmap('jet' if is_grayscale else 'inferno')
    heatmap_colored = heatmap_cm(np.array(heatmap_img) / 255.0)
    heatmap_colored = (heatmap_colored[:, :, :3] * 255).astype(np.uint8)
    heatmap_pil = Image.fromarray(heatmap_colored)

    cam_resized = np.array(
        Image.fromarray((cam * 255).astype(np.uint8)).resize(
            original_img.size, resample=Image.BICUBIC,
        )
    ).astype(np.float32) / 255.0

    orig_arr = np.array(original_img).astype(np.float32)
    heat_arr = np.array(heatmap_pil).astype(np.float32)
    cam_3ch = cam_resized[:, :, np.newaxis]

    blended_arr = orig_arr + heat_arr * cam_3ch
    blended_arr = np.clip(blended_arr, 0, 255).astype(np.uint8)
    blended = Image.fromarray(blended_arr)

    # 7. Encode both images to base64 (Original resolution)
    def to_b64(img_pil):
        buffered = io.BytesIO()
        img_pil.save(buffered, format="JPEG")
        return base64.b64encode(buffered.getvalue()).decode("utf-8")

    grad_cam_b64 = to_b64(blended)
    original_b64 = to_b64(original_img)

    # 8. Probabilities for output
    probabilities = torch.softmax(logits, dim=1).squeeze(0).detach().cpu().tolist()
    predicted_label = int(torch.argmax(logits, dim=1).item())

    return {
        "gradCamImage": f"data:image/jpeg;base64,{grad_cam_b64}",
        "originalImage": f"data:image/jpeg;base64,{original_b64}",
        "predictedLabel": predicted_label,
        "confidence": float(torch.max(torch.softmax(logits, dim=1)).item()),
        "probabilities": probabilities,
    }
