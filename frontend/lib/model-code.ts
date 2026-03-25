import type { DatasetItem, OptimizerParamsForCode } from '@/types/builder';
import type { CanvasNode } from '@/types/builder';

function activationToTorch(name: string) {
  const mapping: Record<string, string> = {
    None: 'nn.Identity()',
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

function optimizerCode(
  optimizer: string,
  learningRate: string,
  optimizerParams: OptimizerParamsForCode,
) {
  if (optimizer === 'SGD') {
    return `torch.optim.SGD(model.parameters(), lr=${learningRate}, weight_decay=${optimizerParams.weightDecay})`;
  }
  if (optimizer === 'SGD+Momentum') {
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
    'from torch.utils.data import DataLoader',
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
  lines.push(`# Rule: the final block must be nn.Linear(n, ${classCount}) with no extra activation.`);
  lines.push('');
  lines.push('def train_model(train_dataset, val_dataset):');
  lines.push("    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')");
  lines.push('    training_model = GeneratedModel().to(device)');
  lines.push('    criterion = nn.CrossEntropyLoss()');
  lines.push(
    `    optimizer = ${optimizerCode(optimizer, learningRate, optimizerParams).replaceAll('model.', 'training_model.')}`,
  );
  lines.push('    train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)');
  lines.push('    val_loader = DataLoader(val_dataset, batch_size=32, shuffle=False)');
  lines.push('');
  lines.push(`    for epoch in range(${epochs}):`);
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
  lines.push('');
  lines.push('            train_loss += loss.item() * targets.size(0)');
  lines.push('            train_correct += (logits.argmax(dim=1) == targets).sum().item()');
  lines.push('            train_total += targets.size(0)');
  lines.push('');
  lines.push('        training_model.eval()');
  lines.push('        val_loss = 0.0');
  lines.push('        val_correct = 0');
  lines.push('        val_total = 0');
  lines.push('        with torch.no_grad():');
  lines.push('            for inputs, targets in val_loader:');
  lines.push('                inputs = inputs.to(device)');
  lines.push('                targets = targets.to(device)');
  lines.push('                logits = training_model(inputs)');
  lines.push('                loss = criterion(logits, targets)');
  lines.push('                val_loss += loss.item() * targets.size(0)');
  lines.push('                val_correct += (logits.argmax(dim=1) == targets).sum().item()');
  lines.push('                val_total += targets.size(0)');
  lines.push('');
  lines.push("        print(f\"Epoch {epoch + 1}/" + epochs + ": \"");
  lines.push("              f\"train_loss={train_loss / train_total:.4f}, \"");
  lines.push("              f\"train_acc={train_correct / train_total:.4f}, \"");
  lines.push("              f\"val_loss={val_loss / val_total:.4f}, \"");
  lines.push("              f\"val_acc={val_correct / val_total:.4f}\")");
  lines.push('');
  lines.push('    return training_model');
  lines.push('');
  lines.push(`# Dataset: ${dataset.label}`);

  return lines.join('\n');
}
