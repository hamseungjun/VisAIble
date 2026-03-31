import gzip
import os
import shutil
import tarfile
import zipfile
from dataclasses import dataclass
from pathlib import Path

import requests


@dataclass(frozen=True)
class DatasetDefinition:
    id: str
    label: str
    input_shape: str
    records: str
    domain: str


@dataclass(frozen=True)
class DatasetRuntimeSpec:
    definition: DatasetDefinition
    input_channels: int
    input_height: int
    input_width: int
    num_classes: int
    starts_flattened: bool = False
    input_features: int | None = None
    task: str = "classification"


DATA_ROOT = Path(__file__).resolve().parents[2] / "data"
MNIST_DATA_DIR = DATA_ROOT / "mnist"
CIFAR10_DATA_DIR = DATA_ROOT / "cifar10"
TINY_IMAGENET_DIR = DATA_ROOT / "tiny-imagenet-200"
COCO_DATA_DIR = DATA_ROOT / "coco"

DATASET_DEFINITIONS = [
    DatasetDefinition(
        id="mnist",
        label="MNIST Digit Set",
        input_shape="1 x 28 x 28",
        records="70,000 samples",
        domain="Handwritten digits",
    ),
    DatasetDefinition(
        id="fashion_mnist",
        label="Fashion-MNIST",
        input_shape="1 x 28 x 28",
        records="70,000 samples",
        domain="Apparel classification",
    ),
    DatasetDefinition(
        id="cifar10",
        label="CIFAR-10 Images",
        input_shape="3 x 32 x 32",
        records="60,000 samples",
        domain="Image classification",
    ),
    DatasetDefinition(
        id="imagenet",
        label="Tiny ImageNet",
        input_shape="3 x 64 x 64",
        records="100K train / 10K val",
        domain="Compact ImageNet-style classification",
    ),
    DatasetDefinition(
        id="coco",
        label="COCO 2017",
        input_shape="3 x 224 x 224",
        records="5K val images (compact split in app)",
        domain="Object classification proxy",
    ),
]

DATASET_SPECS: dict[str, DatasetRuntimeSpec] = {
    "mnist": DatasetRuntimeSpec(
        definition=DATASET_DEFINITIONS[0],
        input_channels=1,
        input_height=28,
        input_width=28,
        num_classes=10,
    ),
    "fashion_mnist": DatasetRuntimeSpec(
        definition=DATASET_DEFINITIONS[1],
        input_channels=1,
        input_height=28,
        input_width=28,
        num_classes=10,
    ),
    "cifar10": DatasetRuntimeSpec(
        definition=DATASET_DEFINITIONS[2],
        input_channels=3,
        input_height=32,
        input_width=32,
        num_classes=10,
    ),
    "imagenet": DatasetRuntimeSpec(
        definition=DATASET_DEFINITIONS[3],
        input_channels=3,
        input_height=64,
        input_width=64,
        num_classes=200,
    ),
    "coco": DatasetRuntimeSpec(
        definition=DATASET_DEFINITIONS[4],
        input_channels=3,
        input_height=224,
        input_width=224,
        num_classes=80,
    ),
}

MNIST_FILES = {
    "train-images-idx3-ubyte.gz": "https://ossci-datasets.s3.amazonaws.com/mnist/train-images-idx3-ubyte.gz",
    "train-labels-idx1-ubyte.gz": "https://ossci-datasets.s3.amazonaws.com/mnist/train-labels-idx1-ubyte.gz",
    "t10k-images-idx3-ubyte.gz": "https://ossci-datasets.s3.amazonaws.com/mnist/t10k-images-idx3-ubyte.gz",
    "t10k-labels-idx1-ubyte.gz": "https://ossci-datasets.s3.amazonaws.com/mnist/t10k-labels-idx1-ubyte.gz",
}

CIFAR10_URLS = [
    "https://www.cs.toronto.edu/~kriz/cifar-10-python.tar.gz",
]

TINY_IMAGENET_URLS = [
    "https://cs231n.stanford.edu/tiny-imagenet-200.zip",
    "http://cs231n.stanford.edu/tiny-imagenet-200.zip",
]

COCO_VAL_URLS = [
    "https://images.cocodataset.org/zips/val2017.zip",
]

COCO_ANNOTATIONS_URLS = [
    "https://images.cocodataset.org/annotations/annotations_trainval2017.zip",
]


def _build_direct_session() -> requests.Session:
    session = requests.Session()
    # Ignore broken system proxy settings when downloading public dataset assets.
    session.trust_env = False
    return session


def ensure_mnist_downloaded() -> dict[str, object]:
    MNIST_DATA_DIR.mkdir(parents=True, exist_ok=True)

    downloaded: list[str] = []
    existing: list[str] = []

    for filename, url in MNIST_FILES.items():
        target_path = MNIST_DATA_DIR / filename

        if target_path.exists() and _is_valid_mnist_file(target_path):
            existing.append(filename)
            continue

        if target_path.exists():
            target_path.unlink()

        _download_file([url], target_path)
        if not _is_valid_mnist_file(target_path):
            target_path.unlink(missing_ok=True)
            raise ValueError(f"Downloaded MNIST file is invalid: {filename}")
        downloaded.append(filename)

    return {
        "downloaded": downloaded,
        "path": str(MNIST_DATA_DIR),
        "files": sorted(downloaded + existing),
    }


def get_dataset_definition(dataset_id: str) -> DatasetDefinition | None:
    return next((dataset for dataset in DATASET_DEFINITIONS if dataset.id == dataset_id), None)


def get_dataset_runtime_spec(dataset_id: str) -> DatasetRuntimeSpec:
    spec = DATASET_SPECS.get(dataset_id)
    if spec is None:
        raise ValueError(f"Dataset '{dataset_id}' is not implemented yet")
    return spec


def get_imagenet_root() -> Path:
    configured_root = os.getenv("IMAGENET_ROOT")
    if configured_root:
        return Path(configured_root)
    return TINY_IMAGENET_DIR


def get_coco_root() -> Path:
    configured_root = os.getenv("COCO_ROOT")
    if configured_root:
        return Path(configured_root)
    return COCO_DATA_DIR


def ensure_cifar10_downloaded() -> Path:
    extracted_dir = CIFAR10_DATA_DIR / "cifar-10-batches-py"
    if extracted_dir.exists():
        return CIFAR10_DATA_DIR

    CIFAR10_DATA_DIR.mkdir(parents=True, exist_ok=True)
    archive_path = CIFAR10_DATA_DIR / "cifar-10-python.tar.gz"
    _download_file(CIFAR10_URLS, archive_path)
    _extract_archive(archive_path, CIFAR10_DATA_DIR)
    if not extracted_dir.exists():
        raise ValueError("CIFAR-10 archive was downloaded but extraction did not produce cifar-10-batches-py")
    return CIFAR10_DATA_DIR


def ensure_tiny_imagenet_downloaded() -> Path:
    train_dir = TINY_IMAGENET_DIR / "train"
    val_dir = TINY_IMAGENET_DIR / "val-by-class"
    if train_dir.exists() and val_dir.exists():
        return TINY_IMAGENET_DIR

    DATA_ROOT.mkdir(parents=True, exist_ok=True)
    archive_path = DATA_ROOT / "tiny-imagenet-200.zip"
    _download_file(TINY_IMAGENET_URLS, archive_path)
    _ensure_valid_archive(archive_path)
    _extract_archive(archive_path, DATA_ROOT)
    _prepare_tiny_imagenet_validation_split(TINY_IMAGENET_DIR)
    return TINY_IMAGENET_DIR


def ensure_coco_compact_downloaded() -> Path:
    coco_root = get_coco_root()
    val_dir = coco_root / "val2017"
    annotation_path = coco_root / "annotations" / "instances_val2017.json"
    if val_dir.exists() and annotation_path.exists():
        return coco_root

    coco_root.mkdir(parents=True, exist_ok=True)
    val_archive = coco_root / "val2017.zip"
    annotations_archive = coco_root / "annotations_trainval2017.zip"
    _download_file(COCO_VAL_URLS, val_archive)
    _download_file(COCO_ANNOTATIONS_URLS, annotations_archive)
    _ensure_valid_archive(val_archive)
    _ensure_valid_archive(annotations_archive)
    _extract_archive(val_archive, coco_root)
    _extract_archive(annotations_archive, coco_root)
    if not val_dir.exists() or not annotation_path.exists():
        raise ValueError("COCO compact assets were downloaded but required val2017 files are still missing")
    return coco_root


def _is_valid_mnist_file(path: Path) -> bool:
    try:
        with gzip.open(path, "rb") as handle:
            if "images" in path.name:
                return len(handle.read(16)) == 16
            if "labels" in path.name:
                return len(handle.read(8)) == 8
    except OSError:
        return False

    return False


def _download_file(urls: list[str], target_path: Path) -> None:
    if target_path.exists() and target_path.stat().st_size > 0:
        return

    target_path.parent.mkdir(parents=True, exist_ok=True)
    last_error: Exception | None = None

    with _build_direct_session() as session:
        for url in urls:
            for verify in (True, False):
                try:
                    with session.get(url, stream=True, timeout=120, verify=verify) as response:
                        response.raise_for_status()
                        with target_path.open("wb") as handle:
                            for chunk in response.iter_content(chunk_size=1024 * 1024):
                                if chunk:
                                    handle.write(chunk)
                    return
                except requests.RequestException as exc:
                    last_error = exc
                    target_path.unlink(missing_ok=True)

    raise ValueError(f"Failed to download dataset asset for {target_path.name}: {last_error}")


def _extract_archive(archive_path: Path, destination: Path) -> None:
    if archive_path.suffix == ".zip":
        with zipfile.ZipFile(archive_path, "r") as archive:
            archive.extractall(destination)
        return

    if archive_path.suffixes[-2:] == [".tar", ".gz"] or archive_path.suffix == ".tgz":
        with tarfile.open(archive_path, "r:gz") as archive:
            archive.extractall(destination)
        return

    raise ValueError(f"Unsupported archive format: {archive_path.name}")


def _ensure_valid_archive(path: Path) -> None:
    if path.suffix == ".zip":
        try:
            with zipfile.ZipFile(path, "r") as archive:
                if archive.testzip() is not None:
                    raise ValueError(f"Corrupted zip member found in {path.name}")
        except (zipfile.BadZipFile, ValueError):
            path.unlink(missing_ok=True)
            raise ValueError(f"Downloaded archive is invalid: {path.name}. Retry the download.")

    if path.suffixes[-2:] == [".tar", ".gz"] or path.suffix == ".tgz":
        try:
            with tarfile.open(path, "r:gz"):
                pass
        except tarfile.TarError:
            path.unlink(missing_ok=True)
            raise ValueError(f"Downloaded archive is invalid: {path.name}. Retry the download.")


def _prepare_tiny_imagenet_validation_split(root: Path) -> None:
    annotations_path = root / "val" / "val_annotations.txt"
    raw_image_dir = root / "val" / "images"
    prepared_val_dir = root / "val-by-class"
    if prepared_val_dir.exists():
        return
    if not annotations_path.exists() or not raw_image_dir.exists():
        raise ValueError("Tiny ImageNet validation assets are incomplete")

    prepared_val_dir.mkdir(parents=True, exist_ok=True)
    for line in annotations_path.read_text().splitlines():
        if not line.strip():
            continue
        image_name, class_id, *_ = line.split("\t")
        source_path = raw_image_dir / image_name
        class_dir = prepared_val_dir / class_id
        class_dir.mkdir(parents=True, exist_ok=True)
        if source_path.exists():
            shutil.copy2(source_path, class_dir / image_name)
