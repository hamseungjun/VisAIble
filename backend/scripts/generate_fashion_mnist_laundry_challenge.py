import json
import random
import sys
from pathlib import Path

import torch
from torch import nn
from torch.optim import AdamW

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services.training import (  # noqa: E402
    DATASET_NORMALIZATION,
    RANDOM_STATE,
    _build_stratified_loaders,
    _sample_to_pixels,
)


OUTPUT_PATH = (
    Path(__file__).resolve().parents[1] / "app" / "data" / "fashion_mnist_laundry_challenge.json"
)
PREVIEW_PATH = (
    Path(__file__).resolve().parents[1] / "app" / "data" / "fashion_mnist_laundry_challenge_preview.png"
)
CLASS_LABELS = [
    "T-shirt/top",
    "Trouser",
    "Pullover",
    "Dress",
    "Coat",
    "Sandal",
    "Shirt",
    "Sneaker",
    "Bag",
    "Ankle boot",
]
BATCH_SIZE = 128
EPOCHS = 10
LEARNING_RATE = 0.001
DEVICE = (
    torch.device("mps")
    if torch.backends.mps.is_available()
    else torch.device("cuda" if torch.cuda.is_available() else "cpu")
)


class FashionMLP(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.network = nn.Sequential(
            nn.Flatten(),
            nn.Linear(28 * 28, 128),
            nn.ReLU(),
            nn.Linear(128, 10),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.network(x)


class FashionCNN(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 32, kernel_size=3, stride=1, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(kernel_size=2, stride=2),
            nn.Conv2d(32, 64, kernel_size=3, stride=1, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(kernel_size=2, stride=2),
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(3136, 128),
            nn.ReLU(),
            nn.Linear(128, 10),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.features(x)
        return self.classifier(x)


def set_seed(seed: int) -> None:
    random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def train_model(model: nn.Module, train_loader) -> None:
    model.to(DEVICE)
    optimizer = AdamW(model.parameters(), lr=LEARNING_RATE)
    criterion = nn.CrossEntropyLoss()
    model.train()

    for epoch in range(EPOCHS):
        running_correct = 0
        running_total = 0
        for inputs, targets in train_loader:
            inputs = inputs.to(DEVICE)
            targets = targets.to(DEVICE)
            optimizer.zero_grad(set_to_none=True)
            logits = model(inputs)
            loss = criterion(logits, targets)
            loss.backward()
            optimizer.step()

            running_correct += int((logits.argmax(dim=1) == targets).sum().item())
            running_total += int(targets.size(0))

        train_accuracy = running_correct / max(running_total, 1)
        print(f"{model.__class__.__name__}: epoch {epoch + 1}/{EPOCHS} train_acc={train_accuracy:.4f}")


def evaluate_models(mlp: nn.Module, cnn: nn.Module, validation_loader):
    mlp.eval()
    cnn.eval()
    rows: list[dict[str, object]] = []

    with torch.no_grad():
        for inputs, targets in validation_loader:
            inputs_device = inputs.to(DEVICE)
            mlp_logits = mlp(inputs_device)
            cnn_logits = cnn(inputs_device)
            mlp_probabilities = torch.softmax(mlp_logits, dim=1).cpu()
            cnn_probabilities = torch.softmax(cnn_logits, dim=1).cpu()
            targets_cpu = targets.cpu()

            for index in range(targets_cpu.size(0)):
                target_index = int(targets_cpu[index].item())
                mlp_pred = int(torch.argmax(mlp_probabilities[index]).item())
                cnn_pred = int(torch.argmax(cnn_probabilities[index]).item())
                mlp_conf = float(mlp_probabilities[index, mlp_pred].item())
                cnn_conf = float(cnn_probabilities[index, cnn_pred].item())
                mlp_target_conf = float(mlp_probabilities[index, target_index].item())
                cnn_target_conf = float(cnn_probabilities[index, target_index].item())
                rows.append(
                    {
                        "targetIndex": target_index,
                        "pixels": _sample_to_pixels(inputs[index], "fashion_mnist"),
                        "mlpPredictedIndex": mlp_pred,
                        "mlpConfidence": mlp_conf,
                        "mlpTargetConfidence": mlp_target_conf,
                        "cnnPredictedIndex": cnn_pred,
                        "cnnConfidence": cnn_conf,
                        "cnnTargetConfidence": cnn_target_conf,
                        "mlpCorrect": mlp_pred == target_index,
                        "cnnCorrect": cnn_pred == target_index,
                    }
                )

    return rows


def select_samples(rows: list[dict[str, object]]) -> list[dict[str, object]]:
    both_correct = [
        row
        for row in rows
        if bool(row["mlpCorrect"]) and bool(row["cnnCorrect"])
    ]
    mlp_wrong_cnn_correct = [
        row
        for row in rows
        if (not bool(row["mlpCorrect"])) and bool(row["cnnCorrect"])
    ]
    mlp_wrong_cnn_correct.sort(
        key=lambda row: (
            float(row["cnnConfidence"]),
            float(row["cnnTargetConfidence"]) - float(row["mlpTargetConfidence"]),
            -float(row["mlpTargetConfidence"]),
            -float(row["mlpConfidence"]),
        ),
        reverse=True,
    )

    def pick_diverse_samples(
        candidates: list[dict[str, object]],
        count: int,
        used_pixel_keys: set[tuple[float, ...]],
        preferred_limit_per_class: int,
    ) -> list[dict[str, object]]:
        picked: list[dict[str, object]] = []
        per_class_counts: dict[int, int] = {}

        for class_limit in (preferred_limit_per_class, preferred_limit_per_class + 1, 10):
            for row in candidates:
                pixel_key = tuple(row["pixels"])
                target_index = int(row["targetIndex"])
                if pixel_key in used_pixel_keys:
                    continue
                if per_class_counts.get(target_index, 0) >= class_limit:
                    continue
                picked.append(row)
                used_pixel_keys.add(pixel_key)
                per_class_counts[target_index] = per_class_counts.get(target_index, 0) + 1
                if len(picked) >= count:
                    return picked
        return picked

    selected_gain: list[dict[str, object]] = []
    used_pixel_keys: set[tuple[float, ...]] = set()
    selected_gain = pick_diverse_samples(
        mlp_wrong_cnn_correct,
        count=10,
        used_pixel_keys=used_pixel_keys,
        preferred_limit_per_class=1,
    )

    if len(selected_gain) < 10:
        raise RuntimeError(
            f"Not enough diverse mlp_fail_cnn_win samples found: {len(selected_gain)}"
        )

    combined = [
        {
            "targetIndex": int(row["targetIndex"]),
            "predictedIndex": int(row["cnnPredictedIndex"]),
            "confidence": round(float(row["cnnConfidence"]), 4),
            "pixels": list(row["pixels"]),
            "selectionKind": "mlp_fail_cnn_win",
            "mlpPredictedIndex": int(row["mlpPredictedIndex"]),
            "mlpConfidence": round(float(row["mlpConfidence"]), 4),
            "cnnPredictedIndex": int(row["cnnPredictedIndex"]),
            "cnnConfidence": round(float(row["cnnConfidence"]), 4),
            "mlpTargetConfidence": round(float(row["mlpTargetConfidence"]), 4),
            "cnnTargetConfidence": round(float(row["cnnTargetConfidence"]), 4),
            "targetLabel": CLASS_LABELS[int(row["targetIndex"])],
            "mlpPredictedLabel": CLASS_LABELS[int(row["mlpPredictedIndex"])],
            "cnnPredictedLabel": CLASS_LABELS[int(row["cnnPredictedIndex"])],
        }
        for row in selected_gain
    ]
    random.Random(20260405).shuffle(combined)
    return combined


def save_preview(samples: list[dict[str, object]]) -> None:
    import matplotlib.pyplot as plt
    import numpy as np

    figure, axes = plt.subplots(2, 5, figsize=(10, 5))
    figure.patch.set_facecolor("white")
    for axis, sample in zip(axes.flatten(), samples):
        pixels = np.array(sample["pixels"], dtype=np.float32).reshape(28, 28)
        axis.imshow(pixels, cmap="gray")
        axis.axis("off")
        axis.set_title(
            f"{sample['targetLabel']}\nMLP:{sample['mlpPredictedLabel']}\nCNN:{sample['cnnPredictedLabel']}",
            fontsize=8,
        )
        border_color = "#dc2626"
        for spine in axis.spines.values():
            spine.set_visible(True)
            spine.set_linewidth(2)
            spine.set_edgecolor(border_color)

    PREVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)
    plt.tight_layout()
    plt.savefig(PREVIEW_PATH, dpi=180)
    plt.close(figure)


def main() -> None:
    set_seed(RANDOM_STATE)
    train_loader, validation_loader, train_size, validation_size = _build_stratified_loaders(
        "fashion_mnist",
        batch_size=BATCH_SIZE,
    )
    print(f"Using device: {DEVICE}")
    print(f"Train size: {train_size}, validation size: {validation_size}")

    mlp = FashionMLP()
    cnn = FashionCNN()

    train_model(mlp, train_loader)
    train_model(cnn, train_loader)

    rows = evaluate_models(mlp, cnn, validation_loader)
    samples = select_samples(rows)

    payload = {
        "datasetId": "fashion_mnist",
        "selectionRule": "10 MLP-fails/CNN-high-confidence samples from validation",
        "mlpArchitecture": ["Linear(784,128)", "Linear(128,10)"],
        "cnnArchitecture": [
            "Conv(1,32,3,padding=1)",
            "Pool(2)",
            "Conv(32,64,3,padding=1)",
            "Pool(2)",
            "Linear(3136,128)",
            "Linear(128,10)",
        ],
        "epochs": EPOCHS,
        "batchSize": BATCH_SIZE,
        "learningRate": LEARNING_RATE,
        "normalization": {
            "mean": list(DATASET_NORMALIZATION["fashion_mnist"][0]),
            "std": list(DATASET_NORMALIZATION["fashion_mnist"][1]),
        },
        "samples": samples,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    save_preview(samples)

    print(f"Saved challenge JSON to {OUTPUT_PATH}")
    print(f"Saved preview image to {PREVIEW_PATH}")


if __name__ == "__main__":
    main()
