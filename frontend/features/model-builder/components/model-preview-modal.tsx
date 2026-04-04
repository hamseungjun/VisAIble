'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/features/model-builder/components/icons';
import { generateModelCode } from '@/lib/model-code';
import type {
  BlockAccent,
  CanvasNode,
  DatasetItem,
  OptimizerParamsForCode,
} from '@/types/builder';

type ModelPreviewModalProps = {
  dataset: DatasetItem;
  nodes: CanvasNode[];
  optimizer: string;
  learningRate: string;
  epochs: string;
  optimizerParams: OptimizerParamsForCode;
  onClose: () => void;
};

type DatasetRuntimePreview = {
  inputChannels: number;
  inputHeight: number;
  inputWidth: number;
  inputFeatures: number | null;
  numClasses: number;
  startsFlattened: boolean;
};

type ArchitectureStep = {
  id: string;
  kind: 'input' | 'cnn' | 'pooling' | 'flatten' | 'dropout' | 'linear';
  title: string;
  subtitle: string;
  opLabel: string;
  inShape: string;
  outShape: string;
  accent: BlockAccent;
  isOutput: boolean;
};

type FigureSize = {
  width: number;
  height: number;
};

type DiagramDensity = 'normal' | 'compact' | 'dense' | 'schematic';
type LinearScale = {
  min: number;
  max: number;
};

const LAYER_VISUAL_HEIGHT = 220;
const LAYER_PRE_VISUAL_OFFSET = 148;
const CONNECTOR_AXIS_OFFSET = LAYER_PRE_VISUAL_OFFSET + LAYER_VISUAL_HEIGHT / 2 - 12;

function fieldValue(node: CanvasNode, label: string, fallback: string) {
  return node.fields.find((field) => field.label === label)?.value ?? fallback;
}

function parseDatasetRuntime(dataset: DatasetItem): DatasetRuntimePreview {
  const classCountByDataset: Record<string, number> = {
    mnist: 10,
    fashion_mnist: 10,
    cifar10: 10,
    imagenet: 200,
  };

  const rawShape = dataset.inputShape?.split('x').map((item) => Number(item.trim())) ?? [1, 1, 1];
  const [inputChannels, inputHeight, inputWidth] =
    rawShape.length === 3 ? rawShape : [1, 1, rawShape.at(-1) ?? 1];

  return {
    inputChannels,
    inputHeight,
    inputWidth,
    inputFeatures: null,
    numClasses: classCountByDataset[dataset.id] ?? 10,
    startsFlattened: false,
  };
}

function convOutputSize(size: number, kernelSize: number, padding: number, stride: number) {
  return Math.floor(((size + 2 * padding - kernelSize) / stride) + 1);
}

function normalizeKernelSize(value: string) {
  if (value.toLowerCase().includes('x')) {
    const [left] = value.toLowerCase().split('x');
    return Number(left.trim());
  }

  return Number(value);
}

function normalizePoolingStride(value: string, kernelSize: number) {
  const normalized = value.trim().toLowerCase();
  if (normalized === '' || normalized === 'none') {
    return kernelSize;
  }
  return Number(value);
}

function normalizeDropoutProbability(value: string) {
  const probability = Number(value);

  if (!Number.isFinite(probability)) {
    return '0.30';
  }

  return Math.min(0.95, Math.max(0, probability)).toFixed(2);
}

function buildArchitectureSteps(dataset: DatasetItem, nodes: CanvasNode[]): ArchitectureStep[] {
  const runtime = parseDatasetRuntime(dataset);
  const steps: ArchitectureStep[] = [
    {
      id: `${dataset.id}-input`,
      kind: 'input',
      title: 'Input',
      subtitle: '',
      opLabel: 'Data tensor',
      inShape: dataset.inputShape ?? 'Input',
      outShape: dataset.inputShape ?? 'Input',
      accent: 'emerald',
      isOutput: false,
    },
  ];

  let currentChannels = runtime.inputChannels;
  let currentHeight = runtime.inputHeight;
  let currentWidth = runtime.inputWidth;
  let currentFeatures = runtime.inputFeatures;
  let flattened = runtime.startsFlattened;

  nodes.forEach((node, index) => {
    const isLastNode = index === nodes.length - 1;

    if (node.type === 'cnn') {
      const channelIn = Number(fieldValue(node, 'Channel In', String(currentChannels)));
      const channelOut = Number(fieldValue(node, 'Channel Out', '16'));
      const kernelSize = normalizeKernelSize(fieldValue(node, 'Kernel Size', '3x3'));
      const padding = Number(fieldValue(node, 'Padding', '1'));
      const stride = Number(fieldValue(node, 'Stride', '1'));
      const outHeight = convOutputSize(currentHeight, kernelSize, padding, stride);
      const outWidth = convOutputSize(currentWidth, kernelSize, padding, stride);

      steps.push({
        id: node.id,
        kind: 'cnn',
        title: node.title,
        subtitle: `${node.activation} activation`,
        opLabel: `Conv ${kernelSize}x${kernelSize}, s${stride}, p${padding}`,
        inShape: `${channelIn} x ${currentHeight} x ${currentWidth}`,
        outShape: `${channelOut} x ${outHeight} x ${outWidth}`,
        accent: 'amber',
        isOutput: false,
      });

      currentChannels = channelOut;
      currentHeight = outHeight;
      currentWidth = outWidth;
      return;
    }

    if (node.type === 'pooling') {
      const poolType = fieldValue(node, 'Pool Type', 'MaxPool');
      if (poolType === 'AdaptiveAvgPool') {
        steps.push({
          id: node.id,
          kind: 'pooling',
          title: node.title,
          subtitle: 'Feature compression',
          opLabel: 'AdaptiveAvgPool 1x1',
          inShape: `${currentChannels} x ${currentHeight} x ${currentWidth}`,
          outShape: `${currentChannels} x 1 x 1`,
          accent: 'violet',
          isOutput: false,
        });

        currentHeight = 1;
        currentWidth = 1;
        return;
      }

      const kernelSize = normalizeKernelSize(fieldValue(node, 'Kernel Size', '2x2'));
      const padding = Number(fieldValue(node, 'Padding', '0'));
      const stride = normalizePoolingStride(fieldValue(node, 'Stride', ''), kernelSize);
      const outHeight = convOutputSize(currentHeight, kernelSize, padding, stride);
      const outWidth = convOutputSize(currentWidth, kernelSize, padding, stride);

      steps.push({
        id: node.id,
        kind: 'pooling',
        title: node.title,
        subtitle: 'Spatial downsampling',
        opLabel: `${poolType} ${kernelSize}x${kernelSize}`,
        inShape: `${currentChannels} x ${currentHeight} x ${currentWidth}`,
        outShape: `${currentChannels} x ${outHeight} x ${outWidth}`,
        accent: 'violet',
        isOutput: false,
      });

      currentHeight = outHeight;
      currentWidth = outWidth;
      return;
    }

    if (node.type === 'dropout') {
      const shape = flattened
        ? String(currentFeatures ?? runtime.inputFeatures ?? currentWidth)
        : `${currentChannels} x ${currentHeight} x ${currentWidth}`;

      steps.push({
        id: node.id,
        kind: 'dropout',
        title: node.title,
        subtitle: 'Regularization',
        opLabel: `Dropout p=${normalizeDropoutProbability(fieldValue(node, 'Probability', '0.30'))}`,
        inShape: shape,
        outShape: shape,
        accent: 'rose',
        isOutput: false,
      });
      return;
    }

    const inputFeatures = flattened
      ? (currentFeatures ?? runtime.inputFeatures ?? currentChannels * currentHeight * currentWidth)
      : currentChannels * currentHeight * currentWidth;

    if (!flattened) {
      steps.push({
        id: `${node.id}-flatten`,
        kind: 'flatten',
        title: 'Flatten',
        subtitle: 'Tensor reshape',
        opLabel: 'Flatten',
        inShape: `${currentChannels} x ${currentHeight} x ${currentWidth}`,
        outShape: String(inputFeatures),
        accent: 'emerald',
        isOutput: false,
      });
      flattened = true;
    }

    const outputFeatures = Number(fieldValue(node, 'Output', '128'));

    steps.push({
      id: node.id,
      kind: 'linear',
      title: isLastNode && outputFeatures === runtime.numClasses ? 'Classifier' : node.title,
      subtitle:
        isLastNode && outputFeatures === runtime.numClasses
          ? `${runtime.numClasses} output logits`
          : `${node.activation} activation`,
      opLabel: `Linear ${inputFeatures}→${outputFeatures}`,
      inShape: String(inputFeatures),
      outShape: String(outputFeatures),
      accent: 'blue',
      isOutput: isLastNode && outputFeatures === runtime.numClasses,
    });

    currentFeatures = outputFeatures;
  });

  return steps;
}

function stepColors(accent: BlockAccent, isOutput: boolean) {
  if (isOutput) {
    return {
      panel: 'bg-[#eff5ff] border-[#b8cef7]',
      chip: 'bg-[#dbe8ff] text-[#2456c9]',
      line: 'border-[#7ea3f1]',
      bar: 'bg-[#2456c9]',
      dot: 'bg-[#2456c9]',
    };
  }

  const palette: Record<
    BlockAccent,
    { panel: string; chip: string; line: string; bar: string; dot: string }
  > = {
    blue: {
      panel: 'bg-[#f5f9ff] border-[#c8d9fb]',
      chip: 'bg-[#dbe8ff] text-[#2456c9]',
      line: 'border-[#98b8f6]',
      bar: 'bg-[#2463eb]',
      dot: 'bg-[#2456c9]',
    },
    amber: {
      panel: 'bg-[#fff8f1] border-[#f1c9a8]',
      chip: 'bg-[#ffe2cb] text-[#b95b16]',
      line: 'border-[#edb27c]',
      bar: 'bg-[#de7a2d]',
      dot: 'bg-[#b95b16]',
    },
    violet: {
      panel: 'bg-[#faf7ff] border-[#d7c9fa]',
      chip: 'bg-[#e8defe] text-[#6846bd]',
      line: 'border-[#b69ae9]',
      bar: 'bg-[#7b5ad6]',
      dot: 'bg-[#6846bd]',
    },
    rose: {
      panel: 'bg-[#fff7f9] border-[#f3c6d2]',
      chip: 'bg-[#ffdce5] text-[#b43b5c]',
      line: 'border-[#ea9bb2]',
      bar: 'bg-[#d45a7a]',
      dot: 'bg-[#b43b5c]',
    },
    emerald: {
      panel: 'bg-[#f3fcf9] border-[#bfe4d9]',
      chip: 'bg-[#d7f0e8] text-[#0b7d6f]',
      line: 'border-[#86ccb9]',
      bar: 'bg-[#169b8a]',
      dot: 'bg-[#0b7d6f]',
    },
  };

  return palette[accent];
}

function parseDims(shape: string) {
  return shape
    .split('x')
    .map((item) => Number(item.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function figureSizeForShape(shape: string, kind: ArchitectureStep['kind']): FigureSize {
  const dims = parseDims(shape);

  if (kind === 'cnn' || kind === 'pooling' || kind === 'input' || dims.length >= 3) {
    const [channels = 1, height = 1, width = 1] =
      dims.length >= 3 ? dims : [1, dims[0] ?? 1, dims[1] ?? 1];
    return {
      width: Math.max(42, Math.min(128, 20 + Math.sqrt(width) * 9 + Math.log2(channels + 1) * 10)),
      height:
        kind === 'pooling'
          ? Math.max(18, Math.min(56, 10 + Math.sqrt(height * width) * 1.4))
          : Math.max(48, Math.min(138, 22 + Math.sqrt(height * width) * 2.1)),
    };
  }

  if (kind === 'flatten') {
    return { width: 112, height: 40 };
  }

  if (kind === 'dropout') {
    return { width: 68, height: 126 };
  }

  const features = dims[0] ?? 1;
  return {
    width: Math.max(58, Math.min(156, 42 + Math.log10(features + 1) * 36)),
    height: Math.max(56, Math.min(116, 44 + Math.log10(features + 1) * 18)),
  };
}

function formatShapeForBadge(shape: string) {
  return shape.replaceAll(' x ', 'x');
}

function describeStepRole(step: ArchitectureStep) {
  if (step.kind === 'input') {
    return 'Raw input';
  }

  if (step.kind === 'cnn') {
    return 'Feature extractor';
  }

  if (step.kind === 'pooling') {
    return 'Spatial compression';
  }

  if (step.kind === 'flatten') {
    return 'Vectorization';
  }

  if (step.kind === 'dropout') {
    return 'Regularization';
  }

  return step.isOutput ? 'Final classifier' : 'Dense projection';
}

function describeShapeTransition(step: ArchitectureStep) {
  const inputDims = parseDims(step.inShape);
  const outputDims = parseDims(step.outShape);

  if (step.kind === 'cnn') {
    const inputChannels = inputDims[0] ?? 1;
    const outputChannels = outputDims[0] ?? 1;
    const outputHeight = outputDims[1] ?? 1;
    const outputWidth = outputDims[2] ?? 1;
    return `${inputChannels}ch -> ${outputChannels}ch, ${outputHeight}x${outputWidth} map`;
  }

  if (step.kind === 'pooling') {
    const inputHeight = inputDims[1] ?? 1;
    const inputWidth = inputDims[2] ?? 1;
    const outputHeight = outputDims[1] ?? 1;
    const outputWidth = outputDims[2] ?? 1;
    return `${inputHeight}x${inputWidth} -> ${outputHeight}x${outputWidth}`;
  }

  if (step.kind === 'flatten') {
    return `${inputDims.join('x')} -> vector ${step.outShape}`;
  }

  if (step.kind === 'dropout') {
    return 'Keeps shape, drops random activations';
  }

  if (step.kind === 'linear') {
    const outputFeatures = outputDims[0] ?? 1;
    return step.isOutput ? `${outputFeatures} class logits` : `${outputFeatures} hidden features`;
  }

  return formatShapeForBadge(step.outShape);
}

function describeStepArtifact(step: ArchitectureStep) {
  if (step.kind === 'input') {
    return 'Image tensor';
  }

  if (step.kind === 'cnn') {
    return 'Feature map';
  }

  if (step.kind === 'pooling') {
    return 'Compressed map';
  }

  if (step.kind === 'flatten') {
    return 'Feature vector';
  }

  if (step.kind === 'dropout') {
    return 'Masked activations';
  }

  return step.isOutput ? 'Class logits' : 'Hidden vector';
}

function describeConnectorAction(nextStep: ArchitectureStep) {
  if (nextStep.kind === 'cnn') {
    return 'extract features';
  }

  if (nextStep.kind === 'pooling') {
    return 'downsample';
  }

  if (nextStep.kind === 'flatten') {
    return 'flatten';
  }

  if (nextStep.kind === 'dropout') {
    return 'regularize';
  }

  return nextStep.isOutput ? 'classify' : 'project';
}

function getDiagramDensity(stepCount: number): DiagramDensity {
  if (stepCount >= 10) {
    return 'schematic';
  }

  if (stepCount >= 8) {
    return 'dense';
  }

  if (stepCount >= 6) {
    return 'compact';
  }

  return 'normal';
}

function compactStepTitle(step: ArchitectureStep, density: DiagramDensity) {
  if (density === 'schematic') {
    if (step.kind === 'input') {
      return 'Input';
    }
    if (step.kind === 'cnn') {
      return 'Conv';
    }
    if (step.kind === 'pooling') {
      return 'Pool';
    }
    if (step.kind === 'dropout') {
      return 'Drop';
    }
    if (step.kind === 'flatten') {
      return 'Flatten';
    }
    if (step.kind === 'linear') {
      return step.isOutput ? 'Output' : 'Linear';
    }
  }

  if (density !== 'dense') {
    return step.title;
  }

  if (step.kind === 'linear') {
    return step.isOutput ? 'Output' : 'Linear';
  }

  if (step.kind === 'pooling') {
    return 'Pool';
  }

  return step.title;
}

function compactStepSubtitle(step: ArchitectureStep, density: DiagramDensity) {
  if (density === 'dense' || density === 'schematic') {
    return null;
  }

  if (density === 'compact' && step.kind === 'linear') {
    return null;
  }

  return step.subtitle;
}

function compactOpLabel(step: ArchitectureStep, density: DiagramDensity) {
  if (density === 'schematic') {
    return '';
  }

  if (density === 'normal') {
    return step.opLabel;
  }

  if (step.kind === 'input') {
    return 'input';
  }

  if (step.kind === 'flatten') {
    return 'flatten';
  }

  if (step.kind === 'linear') {
    return step.opLabel.replace(/^Linear\s+/i, '');
  }

  if (step.kind === 'cnn') {
    return density === 'dense' ? 'conv' : step.opLabel.replace(/^Conv\s+/i, 'conv ');
  }

  if (step.kind === 'pooling') {
    return density === 'dense' ? 'pool' : step.opLabel;
  }

  if (step.kind === 'dropout') {
    return density === 'dense' ? 'drop' : step.opLabel.replace(/^Dropout\s+/i, 'drop ');
  }

  return step.opLabel;
}

function getLinearScale(steps: ArchitectureStep[]): LinearScale {
  const values = steps
    .filter((step) => step.kind === 'linear')
    .map((step) => parseDims(step.outShape)[0] ?? 1)
    .filter((value) => Number.isFinite(value) && value > 0);

  if (values.length === 0) {
    return { min: 1, max: 1 };
  }

  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function linearFigureDimensions(
  features: number,
  density: DiagramDensity,
  scale: LinearScale,
): FigureSize {
  const minLog = Math.log10(scale.min + 1);
  const maxLog = Math.log10(scale.max + 1);
  const currentLog = Math.log10(features + 1);
  const ratio = maxLog === minLog ? 1 : (currentLog - minLog) / (maxLog - minLog);

  const presets =
    density === 'schematic'
      ? { width: 22, minHeight: 54, maxHeight: 102 }
      : density === 'dense'
      ? { width: 26, minHeight: 64, maxHeight: 126 }
      : density === 'compact'
        ? { width: 32, minHeight: 92, maxHeight: 184 }
        : { width: 38, minHeight: 118, maxHeight: 240 };

  return {
    width: presets.width,
    height: Math.round(presets.minHeight + ratio * (presets.maxHeight - presets.minHeight)),
  };
}

function shapeSummaryLabel(step: ArchitectureStep) {
  if (step.kind === 'linear') {
    const features = parseDims(step.outShape)[0] ?? 1;
    return `${features} neurons`;
  }

  if (step.kind === 'flatten') {
    const features = parseDims(step.outShape)[0] ?? 1;
    return `${features} features`;
  }

  if (step.kind === 'input') {
    return step.outShape;
  }

  if (step.kind === 'cnn' || step.kind === 'pooling') {
    return step.outShape.replaceAll(' x ', 'x');
  }

  if (step.kind === 'dropout') {
    return 'dropout';
  }

  return step.outShape;
}

function blockLabelTone(step: ArchitectureStep) {
  if (step.kind === 'linear') {
    return 'bg-white/88 text-[#4263a8]';
  }

  if (step.kind === 'input' || step.kind === 'flatten') {
    return 'bg-white/84 text-[#557187]';
  }

  return 'bg-white/84 text-[#516683]';
}

function schematicCaption(step: ArchitectureStep) {
  const dims = parseDims(step.outShape);
  if (step.kind === 'input') return (step.outShape || '').replaceAll(' x ', 'x');
  if (step.kind === 'cnn') return `${dims[0] ?? 1}c ${dims[1] ?? 1}x${dims[2] ?? 1}`;
  if (step.kind === 'pooling') return `${(dims[1] ?? 1)}x${(dims[2] ?? 1)}`;
  if (step.kind === 'flatten') return `${dims[0] ?? 1}f`;
  if (step.kind === 'dropout') return 'drop';
  if (step.kind === 'linear') return `${dims[0] ?? 1}n`;
  return step.outShape;
}

function chunkSteps<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function SchematicConnector() {
  return (
    <div className="flex w-[26px] shrink-0 items-center justify-center">
      <div className="relative h-[8px] w-full rounded-full bg-[rgba(129,149,188,0.16)]">
        <div className="absolute inset-y-[1px] left-[2px] right-[10px] rounded-full bg-[linear-gradient(90deg,#9fb9ff,#5f84ff)] shadow-[0_0_16px_rgba(95,132,255,0.35)]" />
        <div className="absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rotate-45 rounded-[2px] border-r-[2px] border-t-[2px] border-[#5f84ff] bg-transparent" />
      </div>
    </div>
  );
}

function SchematicFigure({
  step,
  linearScale,
}: {
  step: ArchitectureStep;
  linearScale: LinearScale;
}) {
  const colors = stepColors(step.accent, step.isOutput);
  const dims = parseDims(step.outShape);
  const spatialWidth = dims.at(-1) ?? 1;
  const spatialHeight = dims.length >= 2 ? (dims.at(-2) ?? 1) : 1;
  const channels = dims.length >= 3 ? (dims[0] ?? 1) : 1;
  const size = figureSizeForShape(step.outShape, step.kind);
  const linearFeatures = dims[0] ?? 1;
  const linearDimensions = step.kind === 'linear'
    ? linearFigureDimensions(linearFeatures, 'schematic', linearScale)
    : null;
  const frameWidth = Math.min(72, Math.max(36, 18 + Math.sqrt(spatialWidth) * 8 + Math.log2(channels + 1) * 6));
  const frameHeight = Math.min(62, Math.max(30, 14 + Math.sqrt(spatialHeight) * 7));
  const cnnDepth = Math.max(3, Math.min(7, Math.ceil(Math.log2(channels + 1) / 1.05)));
  const cnnOffsetX = Math.max(4, Math.min(9, 3 + Math.log2(channels + 1) * 1.1));
  const cnnOffsetY = Math.max(3, Math.min(8, 2 + Math.log2(channels + 1) * 0.95));
  const cnnFrontWidth = Math.max(32, Math.min(74, 14 + Math.sqrt(spatialWidth) * 8 + Math.log2(channels + 1) * 3.2));
  const cnnFrontHeight = Math.max(28, Math.min(64, 14 + Math.sqrt(spatialHeight) * 8));
  const cnnVisualWidth = cnnFrontWidth + (cnnDepth - 1) * cnnOffsetX;
  const cnnVisualHeight = cnnFrontHeight + (cnnDepth - 1) * cnnOffsetY;
  const title = compactStepTitle(step, 'schematic');
  const caption = schematicCaption(step);

  let visual: JSX.Element;
  if (step.kind === 'flatten') {
    visual = (
      <div className="flex flex-col items-center gap-2">
        <div className="h-10 w-[2px] rounded-full bg-[#43b7a5]" />
        <div className="rounded-full border border-[#86ccb9] bg-[#ecfffa] px-3.5 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#0b7d6f] shadow-[0_8px_18px_rgba(11,125,111,0.18)]">
          vec
        </div>
      </div>
    );
  } else if (step.kind === 'cnn') {
    visual = (
      <div className="relative" style={{ width: cnnVisualWidth, height: cnnVisualHeight }}>
        {Array.from({ length: cnnDepth }).map((_, i) => (
          <div
            key={`${step.id}-${i}`}
            className={['absolute rounded-[8px] border shadow-[0_12px_30px_rgba(13,27,51,0.14)]', colors.panel].join(' ')}
            style={{
              width: cnnFrontWidth,
              height: cnnFrontHeight,
              left: i * cnnOffsetX,
              top: (cnnDepth - 1 - i) * cnnOffsetY,
              opacity: 0.35 + i * 0.1,
            }}
          />
        ))}
        <div
          className={['pointer-events-none absolute rounded-[10px] border border-white/50 bg-[linear-gradient(135deg,rgba(255,255,255,0.34),transparent_58%)]', colors.line].join(' ')}
          style={{
            width: cnnFrontWidth,
            height: cnnFrontHeight,
            left: (cnnDepth - 1) * cnnOffsetX,
            top: 0,
          }}
        />
      </div>
    );
  } else if (step.kind === 'pooling') {
    visual = (
      <div className="relative">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={`${step.id}-${i}`}
            className={['absolute rounded-full border shadow-[0_10px_24px_rgba(13,27,51,0.12)]', colors.panel].join(' ')}
            style={{ width: 54, height: 24, left: i * 6, top: -i * 7 }}
          />
        ))}
        <div className="opacity-0" style={{ width: 68, height: 40 }} />
      </div>
    );
  } else if (step.kind === 'dropout') {
    visual = (
      <div className={['relative rounded-[8px] border border-dashed shadow-[0_10px_24px_rgba(212,90,122,0.16)]', colors.panel].join(' ')} style={{ width: 40, height: 86 }}>
        <span className={['absolute left-[9px] top-[16px] h-2.5 w-2.5 rounded-full', colors.dot].join(' ')} />
        <span className={['absolute right-[9px] top-[34px] h-2.5 w-2.5 rounded-full opacity-30', colors.dot].join(' ')} />
        <span className={['absolute left-[11px] bottom-[18px] h-2.5 w-2.5 rounded-full', colors.dot].join(' ')} />
      </div>
    );
  } else if (step.kind === 'linear') {
    visual = (
      <div
        className={['rounded-[6px] border shadow-[0_10px_24px_rgba(13,27,51,0.12)]', colors.panel].join(' ')}
        style={{ width: linearDimensions?.width ?? size.width, height: (linearDimensions?.height ?? size.height) + 10 }}
      />
    );
  } else {
    visual = (
      <div className="relative">
        <div className={['rounded-[6px] border shadow-[0_10px_24px_rgba(13,27,51,0.12)]', colors.panel].join(' ')} style={{ width: frameWidth + 6, height: frameHeight + 6 }} />
      </div>
    );
  }

  return (
    <div className="grid min-w-0 flex-1 justify-items-center" style={{ gridTemplateRows: '18px 122px 22px' }}>
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#203152]">{title}</div>
      <div className="flex h-full items-center justify-center">{visual}</div>
      <div className="rounded-full bg-white/90 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#4d6287] shadow-[0_6px_18px_rgba(13,27,51,0.08)]">
        {caption}
      </div>
    </div>
  );
}

function LayerFigure({
  step,
  index,
  density,
  linearScale,
}: {
  step: ArchitectureStep;
  index: number;
  density: DiagramDensity;
  linearScale: LinearScale;
}) {
  const colors = stepColors(step.accent, step.isOutput);
  const size = figureSizeForShape(step.outShape, step.kind);
  const dims = parseDims(step.outShape);
  const spatialWidth = dims.at(-1) ?? 1;
  const spatialHeight = dims.length >= 2 ? (dims.at(-2) ?? 1) : 1;
  const channels = dims.length >= 3 ? (dims[0] ?? 1) : 1;
  const depth =
    step.kind === 'cnn' || step.kind === 'input'
      ? Math.max(2, Math.min(density === 'schematic' ? 5 : 8, Math.ceil(Math.log2(channels + 1))))
      : step.kind === 'pooling'
        ? 3
        : 1;
  const title = compactStepTitle(step, density);
  const subtitle = compactStepSubtitle(step, density);
  const opLabel = compactOpLabel(step, density);
  const blockHeight = density === 'dense' ? 148 : density === 'compact' ? 168 : 200;
  const titleClass =
    density === 'schematic'
      ? 'text-[15px]'
      : density === 'dense'
      ? 'text-[18px]'
      : density === 'compact'
        ? 'text-[22px]'
        : 'text-[clamp(22px,2vw,28px)]';
  const linearFeatures = parseDims(step.outShape)[0] ?? 1;
  const linearDimensions =
    step.kind === 'linear'
      ? linearFigureDimensions(linearFeatures, density, linearScale)
      : null;
  const blockLabel = shapeSummaryLabel(step);
  const captionClass = [
    'mt-3 whitespace-nowrap rounded-full font-extrabold uppercase shadow-[0_6px_18px_rgba(13,27,51,0.08)]',
    density === 'schematic'
      ? 'px-1.5 py-1 text-[6px] tracking-[0.06em]'
      : density === 'dense'
      ? 'px-1.5 py-1 text-[7px] tracking-[0.08em]'
      : density === 'compact'
        ? 'px-2 py-1 text-[8px] tracking-[0.1em]'
        : 'px-2.5 py-1 text-[9px] tracking-[0.12em]',
    blockLabelTone(step),
  ].join(' ');
  const frameWidth = Math.min(
    density === 'schematic' ? 76 : density === 'dense' ? 88 : density === 'compact' ? 118 : 142,
    Math.max(46, 22 + Math.sqrt(spatialWidth) * 11 + Math.log2(channels + 1) * 10),
  );
  const frameHeight = Math.min(
    density === 'schematic' ? 72 : density === 'dense' ? 96 : density === 'compact' ? 122 : 146,
    Math.max(42, 18 + Math.sqrt(spatialHeight) * 12),
  );
  const cnnDepth = Math.max(2, Math.min(density === 'schematic' ? 4 : 5, Math.ceil(Math.log2(channels + 1) / 1.4)));
  const cnnDepthOffset = density === 'schematic' ? 4 : density === 'dense' ? 6 : 9;
  const cnnDepthWidth = Math.max(
    density === 'schematic' ? 8 : density === 'dense' ? 10 : 14,
    Math.min(density === 'schematic' ? 14 : density === 'dense' ? 22 : 30, 8 + Math.log2(channels + 1) * 4),
  );
  const poolWidth = Math.min(
    density === 'schematic' ? 56 : density === 'dense' ? 74 : density === 'compact' ? 92 : 108,
    Math.max(44, Math.sqrt(spatialWidth) * 8 + 18),
  );
  const poolHeight = Math.max(
    density === 'schematic' ? 24 : density === 'dense' ? 26 : 34,
    Math.min(density === 'schematic' ? 56 : density === 'dense' ? 72 : 92, Math.sqrt(spatialHeight) * 7 + 16),
  );
  const dropoutWidth = density === 'schematic' ? 42 : density === 'dense' ? 54 : density === 'compact' ? 64 : 72;
  const dropoutHeight = density === 'schematic' ? 86 : density === 'dense' ? 110 : density === 'compact' ? 132 : 152;
  const visualHeight =
    density === 'schematic' ? 150 : LAYER_VISUAL_HEIGHT;
  const gridRows =
    density === 'schematic'
      ? `0px 44px 0px ${visualHeight}px 28px 14px`
      : `28px 72px 34px ${LAYER_VISUAL_HEIGHT}px 36px 20px`;
  const chipClass = [
    'max-w-full self-center rounded-full font-extrabold uppercase tracking-[0.16em]',
    density === 'schematic'
      ? 'hidden'
      : density === 'dense'
      ? 'px-2.5 py-1 text-[8px]'
      : density === 'compact'
        ? 'px-3 py-1 text-[9px]'
        : 'px-4 py-1.5 text-[10px]',
    colors.chip,
  ].join(' ');
  const layerBadgeClass = [
    'w-fit self-center rounded-full bg-[#eef3ff] font-extrabold uppercase tracking-[0.18em] text-[#5b6f95]',
    density === 'schematic'
      ? 'hidden'
      : density === 'dense'
        ? 'px-2.5 py-1 text-[9px]'
        : 'px-3 py-1.5 text-[10px]',
  ].join(' ');
  const channelCaption =
    step.kind === 'cnn'
      ? density === 'schematic'
        ? `${channels}ch`
        : `${channels} channels`
      : '';

  if (step.kind === 'flatten') {
    return (
      <div className="grid min-w-0 flex-1 justify-items-center" style={{ gridTemplateRows: gridRows }}>
        <div />
        <div className="text-center self-center">
          <div className="font-display text-[clamp(20px,1.8vw,24px)] font-bold text-ink">Flatten</div>
          <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6f86ad]">
            {blockLabel}
          </div>
        </div>
        <div />
        <div className="flex h-full items-center justify-center self-center">
          <div className="flex flex-col items-center gap-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6f86ad]">flatten</div>
            <div className="h-10 w-[2px] rounded-full bg-[#86ccb9]" />
            <div className="rounded-full border border-[#bfe4d9] bg-[#f3fcf9] px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#0b7d6f] shadow-[0_10px_24px_rgba(13,27,51,0.06)]">
              vectorized
            </div>
          </div>
        </div>
        <div />
        <div />
      </div>
    );
  }

  return (
    <div className="grid min-w-0 flex-1 justify-items-center" style={{ gridTemplateRows: gridRows }}>
      <div className={layerBadgeClass}>Layer {index + 1}</div>
      <div className="text-center self-center">
        <div className={['font-display font-bold leading-[0.95] text-ink', titleClass].join(' ')}>
          {title}
        </div>
        {subtitle ? (
          <div className={['font-semibold text-[#6f86ad]', density === 'compact' ? 'mt-1 text-[10px]' : 'mt-2 text-[11px]'].join(' ')}>
            {subtitle}
          </div>
        ) : null}
      </div>

      <div className={chipClass}>
        <span className="block truncate">{opLabel}</span>
      </div>

      <div className="relative flex h-full w-full items-center justify-center self-center">
        {step.kind === 'cnn' ? (
          <div className="flex flex-col items-center justify-center">
            <div className="relative">
              {Array.from({ length: cnnDepth }).map((_, layerIndex) => (
                <div
                  key={`${step.id}-${layerIndex}`}
                  className={[
                    'absolute rounded-[6px] border shadow-[0_10px_24px_rgba(13,27,51,0.08)]',
                    colors.panel,
                  ].join(' ')}
                  style={{
                    width: frameWidth,
                    height: frameHeight,
                    left: layerIndex * cnnDepthOffset,
                    top: -layerIndex * cnnDepthOffset,
                  }}
                />
              ))}
              <div
                className={['absolute rounded-r-[8px] border-y border-r shadow-[0_10px_24px_rgba(13,27,51,0.08)]', colors.panel, colors.line].join(' ')}
                style={{
                  width: cnnDepthWidth,
                  height: frameHeight,
                  right: -cnnDepthWidth - 6,
                  top: -((cnnDepth - 1) * cnnDepthOffset) / 2,
                }}
              />
              <div
                className="opacity-0"
                style={{
                  width: frameWidth + cnnDepthWidth + (cnnDepth - 1) * cnnDepthOffset + 6,
                  height: frameHeight + (cnnDepth - 1) * cnnDepthOffset,
                }}
              />
            </div>
          </div>
        ) : step.kind === 'input' ? (
          <div className="flex flex-col items-center justify-center">
            <div className="relative">
              {Array.from({ length: 2 }).map((_, layerIndex) => (
                <div
                  key={`${step.id}-${layerIndex}`}
                  className={[
                    'absolute rounded-[6px] border shadow-[0_10px_24px_rgba(13,27,51,0.08)]',
                    colors.panel,
                  ].join(' ')}
                  style={{
                    width: frameWidth,
                    height: frameHeight,
                    left: layerIndex * (density === 'dense' ? 8 : 12),
                    top: -layerIndex * (density === 'dense' ? 6 : 10),
                  }}
                />
              ))}
              <div
                className="opacity-0"
                style={{
                  width: frameWidth + (density === 'dense' ? 8 : 12),
                  height: frameHeight + (density === 'dense' ? 6 : 10),
                }}
              />
            </div>
          </div>
        ) : step.kind === 'pooling' ? (
          <div className="flex flex-col items-center justify-center">
            <div className="relative">
              {Array.from({ length: 3 }).map((_, layerIndex) => (
                <div
                  key={`${step.id}-${layerIndex}`}
                  className={[
                    'absolute rounded-[999px] border shadow-[0_10px_24px_rgba(13,27,51,0.08)]',
                    colors.panel,
                  ].join(' ')}
                  style={{
                    width: poolWidth,
                    height: poolHeight,
                    left: layerIndex * (density === 'dense' ? 6 : 8),
                    top: -layerIndex * (density === 'dense' ? 8 : 10),
                  }}
                />
              ))}
              <div
                className="opacity-0"
                style={{
                  width: poolWidth + 16,
                  height: poolHeight + 20,
                }}
              />
            </div>
          </div>
        ) : step.kind === 'dropout' ? (
          <div className="flex flex-col items-center justify-center">
            <div
              className={[
                'relative rounded-[8px] border border-dashed shadow-[0_10px_24px_rgba(13,27,51,0.08)]',
                colors.panel,
              ].join(' ')}
              style={{
                width: dropoutWidth,
                height: dropoutHeight,
              }}
            >
              {Array.from({ length: 4 }).map((_, dotIndex) => (
                <span
                  key={`${step.id}-dot-${dotIndex}`}
                  className={[
                    'absolute rounded-full',
                    density === 'dense' ? 'h-2 w-2' : 'h-3 w-3',
                    colors.dot,
                  ].join(' ')}
                  style={{
                    left: `${density === 'dense' ? 16 : 20 + (dotIndex % 2) * 18}px`,
                    top: `${density === 'dense' ? 18 : 26 + Math.floor(dotIndex / 2) * 38}px`,
                    opacity: dotIndex === 1 || dotIndex === 2 ? 0.24 : 0.88,
                  }}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center">
            <div
              className={['rounded-[6px] border shadow-[0_10px_24px_rgba(13,27,51,0.08)]', colors.panel].join(' ')}
              style={{
                width: linearDimensions?.width ?? size.width,
                height: linearDimensions?.height ?? size.height,
              }}
            />
          </div>
        )}
      </div>

      <div className={captionClass}>{blockLabel}</div>
      <div className="self-start text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6f86ad]">
        {channelCaption}
      </div>
    </div>
  );
}

function FigureConnector({ action, density }: { action: string; density: DiagramDensity }) {
  return (
    <div
      className={[
        'flex shrink-0 flex-col items-center justify-start',
        density === 'schematic'
          ? 'w-[16px]'
          : density === 'dense'
            ? 'w-[26px]'
            : density === 'compact'
              ? 'w-[42px]'
              : 'w-[72px] xl:w-[88px]',
      ].join(' ')}
      style={{ paddingTop: CONNECTOR_AXIS_OFFSET }}
    >
      {density === 'normal' ? (
        <div
          className={[
            'rounded-full border border-[rgba(129,149,188,0.12)] bg-white font-extrabold uppercase text-[#7086aa] shadow-[0_10px_22px_rgba(13,27,51,0.06)]',
            'mb-2 px-2 py-1 text-[9px] tracking-[0.14em]',
          ].join(' ')}
        >
          {action}
        </div>
      ) : null}
      <div
        className={[
          'relative rounded-full bg-[rgba(129,149,188,0.12)]',
          density === 'schematic' ? 'h-[6px] w-full' : density === 'dense' ? 'h-[8px] w-full' : 'h-[10px] w-full',
        ].join(' ')}
      >
        <div className="absolute inset-y-[1px] left-[4px] right-[14px] rounded-full bg-[linear-gradient(90deg,rgba(159,185,255,0.68),rgba(86,121,255,0.96))]" />
        <div
          className={[
            'absolute right-0 top-1/2 -translate-y-1/2 rotate-45 bg-transparent',
            density === 'schematic'
              ? 'h-3 w-3 rounded-[2px] border-r-[2px] border-t-[2px] border-[#6b89ff]'
              : density === 'dense'
              ? 'h-4 w-4 rounded-[3px] border-r-[3px] border-t-[3px] border-[#6b89ff]'
              : 'h-5 w-5 rounded-[4px] border-r-[4px] border-t-[4px] border-[#6b89ff]',
          ].join(' ')}
        />
      </div>
    </div>
  );
}

export function ModelPreviewModal({
  dataset,
  nodes,
  optimizer,
  learningRate,
  epochs,
  optimizerParams,
  onClose,
}: ModelPreviewModalProps) {
  const [viewMode, setViewMode] = useState<'architecture' | 'code'>('architecture');
  const [copied, setCopied] = useState(false);
  const modelCode = generateModelCode(
    dataset,
    nodes,
    optimizer,
    learningRate,
    epochs,
    optimizerParams,
  );
  const steps = buildArchitectureSteps(dataset, nodes);
  const density = getDiagramDensity(steps.length);
  const linearScale = getLinearScale(steps);
  const schematicRowSize =
    steps.length <= 6 ? steps.length : steps.length >= 16 ? 5 : 6;
  const schematicRows = chunkSteps(steps, schematicRowSize);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(modelCode);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[rgba(13,27,51,0.36)] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mx-auto mt-10 flex h-[calc(100vh-5rem)] w-[min(1220px,calc(100%-2rem))] flex-col overflow-hidden rounded-[32px] bg-white shadow-[0_30px_80px_rgba(13,27,51,0.22)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <div className="grid gap-1">
            <strong className="font-display text-2xl font-bold text-ink">Model Preview</strong>
            <span className="text-sm text-muted">Architecture and generated PyTorch code</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex rounded-full bg-[#eef3ff] p-1.5 shadow-[inset_0_0_0_1px_rgba(129,149,188,0.12)]">
              <span
                className={[
                  'absolute top-1.5 h-[42px] w-[78px] rounded-full bg-white shadow-[0_10px_24px_rgba(17,81,255,0.16)] transition-transform duration-300',
                  viewMode === 'architecture' ? 'translate-x-0' : 'translate-x-[86px]',
                ].join(' ')}
              />
              <button
                type="button"
                onClick={() => setViewMode('architecture')}
                className={[
                  'relative z-10 flex h-[42px] w-[78px] items-center justify-center rounded-full text-[11px] font-extrabold uppercase tracking-[0.18em] transition-colors',
                  viewMode === 'architecture' ? 'text-primary' : 'text-muted',
                ].join(' ')}
              >
                Arch
              </button>
              <button
                type="button"
                onClick={() => setViewMode('code')}
                className={[
                  'relative z-10 ml-2 flex h-[42px] w-[78px] items-center justify-center rounded-full text-[11px] font-extrabold uppercase tracking-[0.18em] transition-colors',
                  viewMode === 'code' ? 'text-primary' : 'text-muted',
                ].join(' ')}
              >
                Code
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid h-11 w-11 place-items-center rounded-full bg-[#f2f5fb] text-2xl text-muted transition-colors hover:text-ink"
              aria-label="Close preview"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-6">
          {viewMode === 'architecture' ? (
            <div className="min-w-0">
              <section className="min-w-0 rounded-[28px] bg-[linear-gradient(180deg,#fdfdfe_0%,#f7f8fb_100%)] p-6 shadow-[inset_0_0_0_1px_rgba(129,149,188,0.12)]">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="font-display text-xl font-bold text-ink">Architecture Flow</div>
                    <div className="text-sm text-muted">
                      Scan left to right. Every layer stays in one canvas so the tensor flow is readable at a glance.
                    </div>
                  </div>
                  <div className="rounded-full border border-[rgba(129,149,188,0.14)] bg-white px-4 py-2 text-xs font-extrabold uppercase tracking-[0.16em] text-primary">
                    {steps.length} Stages
                  </div>
                </div>

                <div className="rounded-[24px] border border-[rgba(129,149,188,0.14)] bg-[radial-gradient(circle_at_top,rgba(255,255,255,1),rgba(239,244,255,0.98))] px-4 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                    <div className="grid gap-5 px-1 py-2">
                      {schematicRows.map((row, rowIndex) => (
                        <div key={`schematic-row-${rowIndex}`} className="grid gap-3">
                          <div className="rounded-[20px] border border-[rgba(129,149,188,0.12)] bg-white/70 px-3 py-4 shadow-[0_20px_40px_rgba(13,27,51,0.04)] backdrop-blur-[2px]">
                            <div className="flex items-center gap-0">
                              {row.map((step, index) => (
                                <div key={step.id} className="flex min-w-0 flex-1 items-center">
                                  <SchematicFigure step={step} linearScale={linearScale} />
                                  {index !== row.length - 1 ? <SchematicConnector /> : null}
                                </div>
                              ))}
                            </div>
                          </div>
                          {rowIndex !== schematicRows.length - 1 ? (
                            <div className="flex justify-center">
                              <div className="flex flex-col items-center gap-1 text-[#5f84ff]">
                                <div className="h-6 w-[2px] rounded-full bg-[linear-gradient(180deg,rgba(95,132,255,0.2),rgba(95,132,255,0.75))]" />
                                <div className="h-3 w-3 rotate-45 border-b-[2px] border-r-[2px] border-[#5f84ff]" />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-[12px] text-muted">
                  {[
                    { label: 'Input / reshape', accent: 'emerald' as const },
                    { label: 'Linear / classifier', accent: 'blue' as const },
                    { label: 'Convolution', accent: 'amber' as const },
                    { label: 'Pooling', accent: 'violet' as const },
                    { label: 'Dropout', accent: 'rose' as const },
                  ].map((item) => {
                    const colors = stepColors(item.accent, false);
                    return (
                      <span key={item.label} className="flex items-center gap-2">
                        <i className={['h-3 w-3 rounded-[3px] border', colors.line, colors.panel].join(' ')} />
                        {item.label}
                      </span>
                    );
                  })}
                </div>
              </section>
            </div>
          ) : (
            <section className="min-w-0 rounded-[28px] bg-[#0f172a] p-5 text-white shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)]">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <strong className="font-display text-xl font-bold">Generated Code</strong>
                  <div className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                    PyTorch
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopyCode()}
                  className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-extrabold uppercase tracking-[0.14em] text-slate-100 transition-colors hover:bg-white/16"
                >
                  <Icon name="copy" className="h-3.5 w-3.5" />
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="overflow-auto rounded-[18px] bg-black/20 p-4 text-[12px] leading-6 text-slate-100">
                <code>{modelCode}</code>
              </pre>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
