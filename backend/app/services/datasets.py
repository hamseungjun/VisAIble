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


def ensure_mnist_downloaded() -> dict[str, object]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    downloaded: list[str] = []
    existing: list[str] = []

    for filename, url in MNIST_FILES.items():
        target_path = DATA_DIR / filename

        if target_path.exists():
            existing.append(filename)
            continue

        response = requests.get(url, timeout=60)
        response.raise_for_status()
        target_path.write_bytes(response.content)
        downloaded.append(filename)

    return {
        "downloaded": downloaded,
        "path": str(DATA_DIR),
        "files": sorted(downloaded + existing),
    }
