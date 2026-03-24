from fastapi import APIRouter, HTTPException

from app.services.datasets import (
    DATASET_DEFINITIONS,
    DatasetDefinition,
    ensure_mnist_downloaded,
)

router = APIRouter(tags=["datasets"])


def _serialize_dataset(dataset: DatasetDefinition) -> dict[str, str]:
    return {
        "id": dataset.id,
        "label": dataset.label,
        "inputShape": dataset.input_shape,
        "records": dataset.records,
        "domain": dataset.domain,
    }


@router.get("/datasets")
def list_datasets() -> dict[str, list[dict[str, str]]]:
    return {"datasets": [_serialize_dataset(dataset) for dataset in DATASET_DEFINITIONS]}


@router.post("/datasets/mnist/prepare")
def prepare_mnist() -> dict[str, object]:
    dataset = next((item for item in DATASET_DEFINITIONS if item.id == "mnist"), None)

    if dataset is None:
        raise HTTPException(status_code=404, detail="MNIST dataset definition not found")

    result = ensure_mnist_downloaded()

    return {
        "dataset": _serialize_dataset(dataset),
        "downloaded": result["downloaded"],
        "path": result["path"],
        "files": result["files"],
    }
