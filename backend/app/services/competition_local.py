import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, Subset, TensorDataset

from app.schemas.competition import (
    CompetitionPrepareSubmissionRequest,
    CompetitionPreparedSubmission,
)
from app.services.datasets import (
    MNIST_DATA_DIR,
    ensure_cifar10_downloaded,
    ensure_mnist_downloaded,
    ensure_tiny_imagenet_downloaded,
    get_dataset_runtime_spec,
)
from app.services.training import (
    RANDOM_STATE,
    TRAINED_CLASSIFIERS,
    TRAINING_LOCK,
    _classification_transform,
    _read_idx_images,
    _read_idx_labels,
    get_training_job,
)


PUBLIC_EVAL_CONFIG = {
    "mnist": 100,
    "fashion_mnist": 100,
    "cifar10": 100,
    "imagenet": 12,
}
PRIVATE_EVAL_CONFIG = {
    "mnist": 100,
    "fashion_mnist": 100,
    "cifar10": 100,
    "imagenet": 12,
}
EVAL_BATCH_SIZE = 64


def _build_eval_split_loaders(
    dataset,
    labels: np.ndarray,
    dataset_id: str,
) -> tuple[DataLoader, DataLoader]:
    public_per_class = PUBLIC_EVAL_CONFIG.get(dataset_id, 20)
    private_per_class = PRIVATE_EVAL_CONFIG.get(dataset_id, 20)
    rng = np.random.default_rng(RANDOM_STATE)
    public_indices: list[int] = []
    private_indices: list[int] = []

    for class_id in np.unique(labels).tolist():
        class_indices = np.where(labels == class_id)[0]
        shuffled = rng.permutation(class_indices).tolist()
        public_count = min(len(shuffled), public_per_class)
        remaining = shuffled[public_count:]
        private_count = min(len(remaining), private_per_class)
        public_indices.extend(shuffled[:public_count])
        private_indices.extend(remaining[:private_count])

    if not public_indices or not private_indices:
        raise ValueError("Competition evaluation split is empty for the selected dataset")

    public_loader = DataLoader(Subset(dataset, public_indices), batch_size=EVAL_BATCH_SIZE, shuffle=False)
    private_loader = DataLoader(Subset(dataset, private_indices), batch_size=EVAL_BATCH_SIZE, shuffle=False)
    return public_loader, private_loader


def _build_mnist_eval_dataset() -> tuple[TensorDataset, np.ndarray]:
    ensure_mnist_downloaded()
    test_images = _read_idx_images(MNIST_DATA_DIR / "t10k-images-idx3-ubyte.gz")
    test_labels = _read_idx_labels(MNIST_DATA_DIR / "t10k-labels-idx1-ubyte.gz")
    return TensorDataset(test_images, test_labels), test_labels.cpu().numpy()


def _build_fashion_mnist_eval_dataset():
    from torchvision import datasets

    transform = _classification_transform("fashion_mnist", 28)
    dataset = datasets.FashionMNIST(
        root=str(MNIST_DATA_DIR.parent / "fashion_mnist"),
        train=False,
        download=True,
        transform=transform,
    )
    return dataset, np.array(dataset.targets, dtype=np.int64)


def _build_cifar10_eval_dataset():
    from torchvision import datasets

    ensure_cifar10_downloaded()
    transform = _classification_transform("cifar10", 32)
    dataset = datasets.CIFAR10(
        root=str(MNIST_DATA_DIR.parent / "cifar10"),
        train=False,
        download=False,
        transform=transform,
    )
    return dataset, np.array(dataset.targets, dtype=np.int64)


def _build_imagenet_eval_dataset():
    from torchvision import datasets

    imagenet_root = ensure_tiny_imagenet_downloaded()
    validation_dir = imagenet_root / "val-by-class"
    dataset = datasets.ImageFolder(
        str(validation_dir),
        transform=_classification_transform("imagenet", 64),
    )
    samples = getattr(dataset, "samples", [])
    labels = np.array([label for _, label in samples], dtype=np.int64)
    return dataset, labels


def _build_competition_eval_loaders(dataset_id: str) -> tuple[DataLoader, DataLoader]:
    get_dataset_runtime_spec(dataset_id)
    if dataset_id == "mnist":
        dataset, labels = _build_mnist_eval_dataset()
        return _build_eval_split_loaders(dataset, labels, dataset_id)
    if dataset_id == "fashion_mnist":
        dataset, labels = _build_fashion_mnist_eval_dataset()
        return _build_eval_split_loaders(dataset, labels, dataset_id)
    if dataset_id == "cifar10":
        dataset, labels = _build_cifar10_eval_dataset()
        return _build_eval_split_loaders(dataset, labels, dataset_id)
    if dataset_id == "imagenet":
        dataset, labels = _build_imagenet_eval_dataset()
        return _build_eval_split_loaders(dataset, labels, dataset_id)
    raise ValueError(f"Competition dataset '{dataset_id}' is not supported")


def _evaluate_accuracy(model: nn.Module, device: torch.device, loader: DataLoader) -> float:
    correct = 0
    total = 0
    model.eval()
    with torch.no_grad():
        for inputs, targets in loader:
            inputs = inputs.to(device)
            targets = targets.to(device)
            logits = model(inputs)
            batch_size = targets.size(0)
            correct += (logits.argmax(dim=1) == targets).sum().item()
            total += batch_size

    if total == 0:
        raise ValueError("Competition evaluation set is empty")
    return round(correct / total, 4)


def prepare_competition_submission(payload: CompetitionPrepareSubmissionRequest) -> CompetitionPreparedSubmission:
    training_job = get_training_job(payload.jobId)
    if training_job is None or training_job.get("status") != "completed":
        raise ValueError("Completed training job is required before submission")

    with TRAINING_LOCK:
        trained = TRAINED_CLASSIFIERS.get(payload.jobId)
    if trained is None:
        raise ValueError("No trained model is available for this job")

    model, device, trained_dataset_id = trained
    if trained_dataset_id != payload.datasetId:
        raise ValueError("Competition submissions must use the room dataset")

    public_loader, private_loader = _build_competition_eval_loaders(payload.datasetId)
    public_score = _evaluate_accuracy(model, device, public_loader)
    private_score = _evaluate_accuracy(model, device, private_loader)

    metrics = training_job.get("metrics") or []
    latest_metric = metrics[-1] if metrics else {}
    train_accuracy = round(float(latest_metric.get("trainAccuracy", 0.0)), 4)
    validation_accuracy = round(float(latest_metric.get("validationAccuracy", 0.0)), 4)

    return CompetitionPreparedSubmission(
        roomCode=payload.roomCode,
        participantId=payload.participantId,
        datasetId=payload.datasetId,
        jobId=payload.jobId,
        optimizer=payload.optimizer,
        batchSize=payload.batchSize,
        trainAccuracy=train_accuracy,
        validationAccuracy=validation_accuracy,
        publicScore=public_score,
        privateScore=private_score,
    )
