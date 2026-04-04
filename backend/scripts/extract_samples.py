import os
import sys
from pathlib import Path

# Add backend to path for imports
sys.path.append(str(Path(__file__).resolve().parents[1]))

import torch
import numpy as np
from PIL import Image
from torchvision import datasets, transforms
from app.services.training import _load_combined_torchvision_dataset

FRONTEND_PUBLIC_DIR = Path(__file__).resolve().parents[2] / "frontend" / "public" / "dataset-samples"

def extract_and_save():
    datasets_to_extract = ["mnist", "fashion_mnist", "cifar10"]
    
    for dataset_id in datasets_to_extract:
        print(f"Extracting samples for {dataset_id}...")
        save_dir = FRONTEND_PUBLIC_DIR / dataset_id
        save_dir.mkdir(parents=True, exist_ok=True)
        
        dataset, targets = _load_combined_torchvision_dataset(dataset_id)
        
        for class_idx in range(10):
            matches = np.where(targets == class_idx)[0]
            if len(matches) > 0:
                # Use the 10th match (index 9) for variety, or the last one if fewer than 10
                sample_idx = int(matches[min(9, len(matches) - 1)])
                img_tensor, _ = dataset[sample_idx]
                
                # Convert to PIL
                if img_tensor.shape[0] == 1:
                    img = transforms.ToPILImage()(img_tensor).convert("L")
                else:
                    img = transforms.ToPILImage()(img_tensor).convert("RGB")
                
                output_path = save_dir / f"{class_idx}.png"
                img.save(output_path)
                print(f"  Saved class {class_idx} to {output_path}")

if __name__ == "__main__":
    extract_and_save()
