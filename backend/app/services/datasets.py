from dataclasses import dataclass
import gzip
from pathlib import Path


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


DATASET_DEFINITIONS = [
    DatasetDefinition(
        id="mnist",
        label="MNIST Digit Set",
        input_shape="1 x 28 x 28",
        records="70,000 samples",
        domain="Handwritten digits",
    ),
    DatasetDefinition(
        id="cifar10",
        label="CIFAR-10 Images",
        input_shape="3 x 32 x 32",
        records="60,000 samples",
        domain="Image classification",
    ),
    DatasetDefinition(
        id="titanic",
        label="Titanic Survival",
        input_shape="1 x 10",
        records="891 rows",
        domain="Tabular prediction",
    ),
    DatasetDefinition(
        id="imdb",
        label="IMDB Reviews",
        input_shape="1 x 500",
        records="50,000 reviews",
        domain="Sentiment analysis",
    ),
]

MNIST_FILES = {
    "train-images-idx3-ubyte.gz": "https://ossci-datasets.s3.amazonaws.com/mnist/train-images-idx3-ubyte.gz",
    "train-labels-idx1-ubyte.gz": "https://ossci-datasets.s3.amazonaws.com/mnist/train-labels-idx1-ubyte.gz",
    "t10k-images-idx3-ubyte.gz": "https://ossci-datasets.s3.amazonaws.com/mnist/t10k-images-idx3-ubyte.gz",
    "t10k-labels-idx1-ubyte.gz": "https://ossci-datasets.s3.amazonaws.com/mnist/t10k-labels-idx1-ubyte.gz",
}

DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "mnist"
MNIST_SPEC = DatasetRuntimeSpec(
    definition=DATASET_DEFINITIONS[0],
    input_channels=1,
    input_height=28,
    input_width=28,
    num_classes=10,
    starts_flattened=False,
    input_features=None,
)


def ensure_mnist_downloaded() -> dict[str, object]:
    import requests

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    downloaded: list[str] = []
    existing: list[str] = []

    for filename, url in MNIST_FILES.items():
        target_path = DATA_DIR / filename

        if target_path.exists() and _is_valid_mnist_file(target_path):
            existing.append(filename)
            continue

        if target_path.exists():
            target_path.unlink()

        response = requests.get(url, timeout=60)
        response.raise_for_status()
        target_path.write_bytes(response.content)
        if not _is_valid_mnist_file(target_path):
            target_path.unlink(missing_ok=True)
            raise ValueError(f"Downloaded MNIST file is invalid: {filename}")
        downloaded.append(filename)

    return {
        "downloaded": downloaded,
        "path": str(DATA_DIR),
        "files": sorted(downloaded + existing),
    }


def get_dataset_definition(dataset_id: str) -> DatasetDefinition | None:
    return next((dataset for dataset in DATASET_DEFINITIONS if dataset.id == dataset_id), None)


def get_dataset_runtime_spec(dataset_id: str) -> DatasetRuntimeSpec:
    if dataset_id == "mnist":
        return MNIST_SPEC

    raise ValueError(f"Dataset '{dataset_id}' is not implemented yet")


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
