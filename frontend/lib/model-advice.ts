import type { CanvasNode, DatasetItem } from '@/types/builder';

export type NodeDimensionInfo = {
  inputLabel: string;
  outputLabel: string;
};

export type NodeAdviceInfo = {
  hasError: boolean;
  message: string | null;
  suggestedFields: Record<string, string>;
  fieldErrors: string[];
  suggestedActivation: string | null;
  activationError: boolean;
  activationHint: string | null;
};

type ShapeState = {
  channels: number;
  height: number;
  width: number;
  flattened: boolean;
  features: number | null;
};

function fieldValue(node: CanvasNode, label: string, fallback: string) {
  return node.fields.find((field) => field.label === label)?.value ?? fallback;
}

function parseNumeric(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseDatasetShape(dataset: DatasetItem): ShapeState {
  const dims = dataset.inputShape?.split('x').map((item) => Number(item.trim())) ?? [1, 1, 1];

  if (dims.length === 3) {
    return {
      channels: dims[0] ?? 1,
      height: dims[1] ?? 1,
      width: dims[2] ?? 1,
      flattened: false,
      features: null,
    };
  }

  return {
    channels: 1,
    height: 1,
    width: dims.at(-1) ?? 1,
    flattened: true,
    features: dims.at(-1) ?? 1,
  };
}

function parseKernelSize(value: string) {
  if (value.toLowerCase().includes('x')) {
    return parseNumeric(value.toLowerCase().split('x')[0]?.trim() ?? '3', 3);
  }

  return parseNumeric(value, 3);
}

function parsePoolingStride(value: string, kernelSize: number) {
  const normalized = value.trim().toLowerCase();
  if (normalized === '' || normalized === 'none') {
    return kernelSize;
  }
  return parseNumeric(value, kernelSize);
}

function convOutputSize(size: number, kernelSize: number, padding: number, stride: number) {
  return Math.floor((size + 2 * padding - kernelSize) / stride + 1);
}

function poolingOutputSize(size: number, kernelSize: number, padding: number, stride: number) {
  return Math.floor((size + 2 * padding - kernelSize) / stride + 1);
}

export function getHintMask(expectedValue: string, currentValue: string) {
  if (expectedValue.length <= 1) {
    return expectedValue;
  }

  const prefix = expectedValue[0] ?? '';
  const suffix = currentValue.startsWith(prefix) ? currentValue.slice(1) : currentValue;
  const digits = suffix.replace(/\D/g, '').slice(0, Math.max(expectedValue.length - 1, 0));

  return `${prefix}${digits}${'_'.repeat(Math.max(expectedValue.length - 1 - digits.length, 0))}`;
}

export function buildHintedValue(rawValue: string, expectedValue: string) {
  const digits = rawValue.replace(/\D/g, '');
  const prefix = expectedValue[0] ?? '';
  const suffix = digits.startsWith(prefix) ? digits.slice(1) : digits;
  return `${prefix}${suffix.slice(0, Math.max(expectedValue.length - 1, 0))}`;
}

export function analyzeModelNodes(selectedDataset: DatasetItem, nodes: CanvasNode[]) {
  const dimensions: Record<string, NodeDimensionInfo> = {};
  const advice: Record<string, NodeAdviceInfo> = {};
  const current = parseDatasetShape(selectedDataset);

  nodes.forEach((node) => {
    const suggestedFields: Record<string, string> = {};
    const fieldErrors: string[] = [];
    const messages: string[] = [];

    if (node.type === 'cnn') {
      const expectedChannelIn = current.channels;
      const channelIn = parseNumeric(fieldValue(node, 'Channel In', String(expectedChannelIn)), expectedChannelIn);
      const channelOut = parseNumeric(fieldValue(node, 'Channel Out', String(channelIn)), channelIn);
      const kernelSize = parseKernelSize(fieldValue(node, 'Kernel Size', '3x3'));
      const padding = parseNumeric(fieldValue(node, 'Padding', '1'), 1);
      const stride = parseNumeric(fieldValue(node, 'Stride', '1'), 1);
      const outputHeight = convOutputSize(current.height, kernelSize, padding, stride);
      const outputWidth = convOutputSize(current.width, kernelSize, padding, stride);

      if (channelIn !== expectedChannelIn) {
        suggestedFields['Channel In'] = String(expectedChannelIn);
        fieldErrors.push('Channel In');
        messages.push('입력 채널 수가 맞지 않습니다.');
      }

      if (kernelSize <= 0 || stride <= 0 || outputHeight <= 0 || outputWidth <= 0) {
        fieldErrors.push('Kernel Size', 'Stride', 'Padding');
        messages.push('커널 또는 스트라이드 설정을 다시 확인해주세요.');
      }

      dimensions[node.id] = {
        inputLabel: `${expectedChannelIn} x ${current.height} x ${current.width}`,
        outputLabel: `${channelOut} x ${outputHeight} x ${outputWidth}`,
      };

      current.channels = channelOut;
      current.height = outputHeight;
      current.width = outputWidth;
      current.features = null;
      current.flattened = false;
    } else if (node.type === 'pooling') {
      const poolType = fieldValue(node, 'Pool Type', 'MaxPool');
      if (poolType === 'AdaptiveAvgPool') {
        dimensions[node.id] = {
          inputLabel: `${current.channels} x ${current.height} x ${current.width}`,
          outputLabel: `${current.channels} x 1 x 1`,
        };

        current.height = 1;
        current.width = 1;
        current.features = null;
        current.flattened = false;
      } else {
        const kernelSize = parseKernelSize(fieldValue(node, 'Kernel Size', '2x2'));
        const padding = parseNumeric(fieldValue(node, 'Padding', '0'), 0);
        const stride = parsePoolingStride(fieldValue(node, 'Stride', ''), kernelSize);
        const outputHeight = poolingOutputSize(current.height, kernelSize, padding, stride);
        const outputWidth = poolingOutputSize(current.width, kernelSize, padding, stride);

        if (kernelSize <= 0 || stride <= 0 || outputHeight <= 0 || outputWidth <= 0) {
          fieldErrors.push('Kernel Size', 'Stride', 'Padding');
          messages.push('풀링 설정으로 인해 출력 크기가 올바르지 않습니다.');
        }

        dimensions[node.id] = {
          inputLabel: `${current.channels} x ${current.height} x ${current.width}`,
          outputLabel: `${current.channels} x ${outputHeight} x ${outputWidth}`,
        };

        current.height = outputHeight;
        current.width = outputWidth;
        current.features = null;
        current.flattened = false;
      }
    } else if (node.type === 'dropout') {
      dimensions[node.id] = current.flattened
        ? {
            inputLabel: `${current.features ?? current.width}`,
            outputLabel: `${current.features ?? current.width}`,
          }
        : {
            inputLabel: `${current.channels} x ${current.height} x ${current.width}`,
            outputLabel: `${current.channels} x ${current.height} x ${current.width}`,
          };
    } else {
      const expectedInput = current.flattened
        ? (current.features ?? current.width)
        : current.channels * current.height * current.width;
      const actualInput = parseNumeric(fieldValue(node, 'Input', String(expectedInput)), expectedInput);
      const outputFeatures = parseNumeric(fieldValue(node, 'Output', '128'), 128);

      if (actualInput !== expectedInput) {
        suggestedFields.Input = String(expectedInput);
        fieldErrors.push('Input');
        messages.push('입력 차원이 잘못되었습니다.');
      }

      if (outputFeatures <= 0) {
        fieldErrors.push('Output');
        messages.push('출력값 설정이 올바르지 않습니다.');
      }

      dimensions[node.id] = {
        inputLabel: `${expectedInput}`,
        outputLabel: `${outputFeatures}`,
      };

      current.features = outputFeatures;
      current.flattened = true;
    }

    advice[node.id] = {
      hasError: fieldErrors.length > 0,
      message: messages.length > 0 ? messages[0] ?? null : null,
      suggestedFields,
      fieldErrors: Array.from(new Set(fieldErrors)),
      suggestedActivation: null,
      activationError: false,
      activationHint: null,
    };
  });

  const lastNode = nodes.at(-1);
  const classCount = selectedDataset.classCount;
  if (lastNode?.type === 'linear' && classCount != null) {
    const outputValue = parseNumeric(fieldValue(lastNode, 'Output', String(classCount)), classCount);
    const outputMismatch = outputValue !== classCount;
    const activationMismatch = lastNode.activation !== 'None';
    const existing = advice[lastNode.id];
    const messages = [existing?.message].filter(Boolean) as string[];

    if (outputMismatch || activationMismatch) {
      messages.push('마지막 레이어 설정이 데이터셋과 맞지 않습니다.');

      advice[lastNode.id] = {
        hasError: true,
        message: messages.at(-1) ?? null,
        suggestedFields: {
          ...(existing?.suggestedFields ?? {}),
          ...(outputMismatch ? { Output: String(classCount) } : {}),
        },
        fieldErrors: Array.from(
          new Set([...(existing?.fieldErrors ?? []), ...(outputMismatch ? ['Output'] : [])]),
        ),
        suggestedActivation: activationMismatch ? 'None' : existing?.suggestedActivation ?? null,
        activationError: activationMismatch,
        activationHint: activationMismatch ? 'N___' : null,
      };
    }
  }

  return { dimensions, advice };
}
