import type { DatasetItem, OptimizerParamsForCode } from '@/types/builder';
import type { CanvasNode } from '@/types/builder';

function activationToTorch(name: string) {
  const mapping: Record<string, string> = {
    ReLU: 'nn.ReLU()',
    'Leaky ReLU': 'nn.LeakyReLU()',
    GELU: 'nn.GELU()',
    Sigmoid: 'nn.Sigmoid()',
    Tanh: 'nn.Tanh()',
    Softplus: 'nn.Softplus()',
    ELU: 'nn.ELU()',
    SELU: 'nn.SELU()',
    Swish: 'nn.SiLU()',
  };

  return mapping[name] ?? 'nn.ReLU()';
}

function fieldValue(node: CanvasNode, label: string, fallback: string) {
  return node.fields.find((field) => field.label === label)?.value ?? fallback;
}

function poolingStrideArg(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === '' || normalized === 'none') {
    return '';
  }
  return `, stride=${value}`;
}

function optimizerCode(
  optimizer: string,
  learningRate: string,
  optimizerParams: OptimizerParamsForCode,
) {
  if (optimizer === 'SGD') {
    return `torch.optim.SGD(model.parameters(), lr=${learningRate}, momentum=${optimizerParams.momentum}, weight_decay=${optimizerParams.weightDecay})`;
  }
  if (optimizer === 'AdaGrad') {
    return `torch.optim.Adagrad(model.parameters(), lr=${learningRate}, weight_decay=${optimizerParams.weightDecay})`;
  }
  if (optimizer === 'RMS Prop') {
    return `torch.optim.RMSprop(model.parameters(), lr=${learningRate}, alpha=${optimizerParams.rho}, weight_decay=${optimizerParams.weightDecay})`;
  }
  return `torch.optim.Adam(model.parameters(), lr=${learningRate}, weight_decay=${optimizerParams.weightDecay})`;
}

export function generateModelCode(
  dataset: DatasetItem,
  nodes: CanvasNode[],
  optimizer: string,
  learningRate: string,
  epochs: string,
  optimizerParams: OptimizerParamsForCode,
) {
  const datasetClassCount: Record<string, number> = {
    mnist: 10,
  };
  const classCount = datasetClassCount[dataset.id] ?? 10;
  const lines = [
    'import torch',
    'from torch import nn',
    'from torch.utils.data import DataLoader, TensorDataset',
    'from torchvision import datasets, transforms',
    '',
    `EPOCHS = ${epochs}`,
    `BATCH_SIZE = 128`,
    `LEARNING_RATE = ${learningRate}`,
    `RANDOM_STATE = 42`,
    '',
    'class GeneratedModel(nn.Module):',
    '    def __init__(self):',
    '        super().__init__()',
    '        self.feature_extractor = nn.Sequential(',
  ];

  let flattened = false;
  nodes.forEach((node, index) => {
    const isLastNode = index === nodes.length - 1;
    if (node.type === 'cnn') {
      lines.push(
        `            nn.Conv2d(${fieldValue(node, 'Channel In', '1')}, ${fieldValue(node, 'Channel Out', '16')}, kernel_size=${fieldValue(node, 'Kernel Size', '3').replace('x', ', ')}, stride=${fieldValue(node, 'Stride', '1')}, padding=${fieldValue(node, 'Padding', '1')}),`,
      );
      lines.push(`            ${activationToTorch(node.activation)},`);
      return;
    }

    if (node.type === 'pooling') {
      const poolType = fieldValue(node, 'Pool Type', 'MaxPool');
      if (poolType === 'AdaptiveAvgPool') {
        lines.push('            nn.AdaptiveAvgPool2d((1, 1)),');
        return;
      }

      const poolLayer = poolType === 'AvgPool' ? 'nn.AvgPool2d' : 'nn.MaxPool2d';
      const kernelValue = fieldValue(node, 'Kernel Size', '2').replace('x', ', ');
      const strideArg = poolingStrideArg(fieldValue(node, 'Stride', ''));
      lines.push(
        `            ${poolLayer}(kernel_size=${kernelValue}${strideArg}, padding=${fieldValue(node, 'Padding', '0')}),`,
      );
      return;
    }

    if (!flattened) {
      lines.push('            nn.Flatten(),');
      flattened = true;
    }

    const linearIn = fieldValue(node, 'Input', '784');
    const linearOut = fieldValue(node, 'Output', '128');
    lines.push(`            nn.Linear(${linearIn}, ${linearOut}),`);
    if (!isLastNode) {
      lines.push(`            ${activationToTorch(node.activation)},`);
    }
  });

  if (!flattened) {
    lines.push('            nn.Flatten(),');
  }

  lines.push('        )');
  lines.push('');
  lines.push('    def forward(self, x):');
  lines.push('        return self.feature_extractor(x)');
  lines.push('');
  lines.push(`# Rule: the final block must be nn.Linear(n, ${classCount}) and must output logits.`);
  lines.push('# Do not apply ReLU or Softmax after the final linear layer before CrossEntropyLoss.');
  lines.push('');
  lines.push('def load_mnist_dataset():');
  lines.push("    transform = transforms.ToTensor()");
  lines.push("    train_split = datasets.MNIST(root='./data', train=True, download=True, transform=transform)");
  lines.push("    test_split = datasets.MNIST(root='./data', train=False, download=True, transform=transform)");
  lines.push('');
  lines.push('    images = torch.cat([train_split.data, test_split.data], dim=0).float().unsqueeze(1) / 255.0');
  lines.push('    labels = torch.cat([train_split.targets, test_split.targets], dim=0).long()');
  lines.push('    return images, labels');
  lines.push('');
  lines.push('def build_stratified_datasets(images, labels, train_ratio=0.8, seed=RANDOM_STATE):');
  lines.push('    generator = torch.Generator().manual_seed(seed)');
  lines.push('    train_indices = []');
  lines.push('    val_indices = []');
  lines.push('');
  lines.push('    for class_id in torch.unique(labels).tolist():');
  lines.push('        class_indices = torch.where(labels == class_id)[0]');
  lines.push('        permuted = class_indices[torch.randperm(class_indices.numel(), generator=generator)]');
  lines.push('        split_index = int(permuted.numel() * train_ratio)');
  lines.push('        train_indices.append(permuted[:split_index])');
  lines.push('        val_indices.append(permuted[split_index:])');
  lines.push('');
  lines.push('    train_indices = torch.cat(train_indices)');
  lines.push('    val_indices = torch.cat(val_indices)');
  lines.push('');
  lines.push('    train_dataset = TensorDataset(images[train_indices], labels[train_indices])');
  lines.push('    val_dataset = TensorDataset(images[val_indices], labels[val_indices])');
  lines.push('    return train_dataset, val_dataset');
  lines.push('');
  lines.push('def evaluate_model(model, loader, criterion, device):');
  lines.push('    model.eval()');
  lines.push('    loss_sum = 0.0');
  lines.push('    correct = 0');
  lines.push('    total = 0');
  lines.push('');
  lines.push('    with torch.no_grad():');
  lines.push('        for inputs, targets in loader:');
  lines.push('            inputs = inputs.to(device)');
  lines.push('            targets = targets.to(device)');
  lines.push('            logits = model(inputs)');
  lines.push('            loss = criterion(logits, targets)');
  lines.push('');
  lines.push('            loss_sum += loss.item() * targets.size(0)');
  lines.push('            correct += (logits.argmax(dim=1) == targets).sum().item()');
  lines.push('            total += targets.size(0)');
  lines.push('');
  lines.push('    return loss_sum / total, correct / total');
  lines.push('');
  lines.push('def get_training_device():');
  lines.push("    if torch.cuda.is_available():");
  lines.push("        return torch.device('cuda')");
  lines.push('');
  lines.push("    mps_backend = getattr(torch.backends, 'mps', None)");
  lines.push('    if mps_backend is not None and mps_backend.is_available():');
  lines.push("        return torch.device('mps')");
  lines.push('');
  lines.push("    return torch.device('cpu')");
  lines.push('');
  lines.push('def train_model():');
  lines.push('    device = get_training_device()');
  lines.push('    images, labels = load_mnist_dataset()');
  lines.push('    train_dataset, val_dataset = build_stratified_datasets(images, labels)');
  lines.push('    training_model = GeneratedModel().to(device)');
  lines.push('    criterion = nn.CrossEntropyLoss()');
  lines.push(
    `    optimizer = ${optimizerCode(optimizer, learningRate, optimizerParams).replaceAll('model.', 'training_model.')}`,
  );
  lines.push('    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)');
  lines.push('    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False)');
  lines.push('');
  lines.push("    print(f'Using device: {device}')");
  lines.push("    print(f'Train samples: {len(train_dataset)} | Val samples: {len(val_dataset)}')");
  lines.push('');
  lines.push('    for epoch in range(EPOCHS):');
  lines.push('        training_model.train()');
  lines.push('        train_loss = 0.0');
  lines.push('        train_correct = 0');
  lines.push('        train_total = 0');
  lines.push('');
  lines.push('        for inputs, targets in train_loader:');
  lines.push('            inputs = inputs.to(device)');
  lines.push('            targets = targets.to(device)');
  lines.push('            optimizer.zero_grad()');
  lines.push('            logits = training_model(inputs)');
  lines.push('            loss = criterion(logits, targets)');
  lines.push('            loss.backward()');
  lines.push('            optimizer.step()');
  lines.push('            train_loss += loss.item() * targets.size(0)');
  lines.push('            train_correct += (logits.argmax(dim=1) == targets).sum().item()');
  lines.push('            train_total += targets.size(0)');
  lines.push('');
  lines.push('        train_eval_loss, train_eval_acc = evaluate_model(training_model, train_loader, criterion, device)');
  lines.push('        val_loss, val_acc = evaluate_model(training_model, val_loader, criterion, device)');
  lines.push('');
  lines.push('        print(');
  lines.push("            f\"Epoch {epoch + 1}/{EPOCHS}: \"");
  lines.push("              f\"train_step_loss={train_loss / train_total:.4f}, \"");
  lines.push("              f\"train_step_acc={train_correct / train_total:.4f}, \"");
  lines.push("              f\"train_eval_loss={train_eval_loss:.4f}, \"");
  lines.push("              f\"train_eval_acc={train_eval_acc:.4f}, \"");
  lines.push("              f\"val_loss={val_loss:.4f}, \"");
  lines.push("              f\"val_acc={val_acc:.4f}\"");
  lines.push('        )');
  lines.push('');
  lines.push('    return training_model');
  lines.push('');
  lines.push("if __name__ == '__main__':");
  lines.push('    train_model()');
  lines.push('');
  lines.push(`# Dataset: ${dataset.label}`);

  return lines.join('\n');
}
