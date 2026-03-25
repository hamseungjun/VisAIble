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

function fieldValue(node: CanvasNode, label: string, fallback: string) {
  return node.fields.find((field) => field.label === label)?.value ?? fallback;
}

function parseDatasetRuntime(dataset: DatasetItem): DatasetRuntimePreview {
  const classCountByDataset: Record<string, number> = {
    mnist: 10,
    fashion_mnist: 10,
    cifar10: 10,
    imagenet: 200,
    coco: 80,
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
      subtitle: dataset.label,
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
      width: Math.max(44, Math.min(106, 30 + Math.sqrt(width) * 10)),
      height: Math.max(54, Math.min(132, 38 + Math.sqrt(height * Math.max(channels, 1)) * 8)),
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

function LayerFigure({ step, index }: { step: ArchitectureStep; index: number }) {
  const colors = stepColors(step.accent, step.isOutput);
  const size = figureSizeForShape(step.outShape, step.kind);
  const dims = parseDims(step.outShape);
  const depth =
    step.kind === 'cnn' || step.kind === 'input'
      ? Math.max(2, Math.min(5, Math.ceil((dims[0] ?? 1) / 16)))
      : step.kind === 'pooling'
        ? 3
        : 1;

  return (
    <div className="flex w-[180px] shrink-0 flex-col items-center">
      <div className="rounded-full bg-[#eef3ff] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#5b6f95]">
        Layer {index + 1}
      </div>
      <div className="mt-3 text-center font-display text-[15px] font-bold text-ink">{step.title}</div>
      <div className="mt-1 text-center text-[11px] font-semibold text-[#6f86ad]">{step.subtitle}</div>

      <div className={['mt-3 rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em]', colors.chip].join(' ')}>
        {step.opLabel}
      </div>

      <div className="relative mt-5 flex h-[188px] w-full items-center justify-center">
        {step.kind === 'cnn' || step.kind === 'input' || step.kind === 'pooling' ? (
          <div className="relative">
            {Array.from({ length: depth }).map((_, layerIndex) => (
              <div
                key={`${step.id}-${layerIndex}`}
                className={[
                  'absolute rounded-[6px] border shadow-[0_10px_24px_rgba(13,27,51,0.08)]',
                  colors.panel,
                ].join(' ')}
                style={{
                  width: size.width,
                  height: step.kind === 'pooling' ? Math.max(20, size.height * 0.28) : size.height,
                  left: layerIndex * 10,
                  top: -layerIndex * 8,
                }}
              />
            ))}
            <div
              className="opacity-0"
              style={{
                width: size.width + (depth - 1) * 10,
                height:
                  (step.kind === 'pooling' ? Math.max(20, size.height * 0.28) : size.height) +
                  (depth - 1) * 8,
              }}
            />
          </div>
        ) : step.kind === 'flatten' ? (
          <div className="relative">
            <div className={['rounded-full border shadow-[0_10px_24px_rgba(13,27,51,0.08)]', colors.panel].join(' ')} style={{ width: size.width, height: size.height }} />
            <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold uppercase tracking-[0.18em] text-[#597086]">
              reshape
            </div>
          </div>
        ) : step.kind === 'dropout' ? (
          <div
            className={['relative rounded-[8px] border border-dashed shadow-[0_10px_24px_rgba(13,27,51,0.08)]', colors.panel].join(' ')}
            style={{ width: size.width, height: size.height }}
          >
            {Array.from({ length: 4 }).map((_, dotIndex) => (
              <span
                key={`${step.id}-dot-${dotIndex}`}
                className={['absolute h-2.5 w-2.5 rounded-full', colors.dot].join(' ')}
                style={{
                  left: `${18 + (dotIndex % 2) * 24}px`,
                  top: `${22 + Math.floor(dotIndex / 2) * 38}px`,
                  opacity: dotIndex === 1 || dotIndex === 2 ? 0.24 : 0.88,
                }}
              />
            ))}
          </div>
        ) : (
          <div
            className={['rounded-[4px] border shadow-[0_10px_24px_rgba(13,27,51,0.08)]', colors.panel].join(' ')}
            style={{
              width: Math.max(30, Math.min(62, size.width * 0.4)),
              height: Math.max(102, Math.min(166, size.height * 1.38)),
            }}
          />
        )}
      </div>

      <div className="mt-4 grid w-full gap-2">
        <div className="rounded-[16px] border border-[rgba(129,149,188,0.12)] bg-white/90 px-3 py-2 text-center">
          <div className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-muted">Input</div>
          <div className="mt-1 font-mono text-[11px] text-[#41536f]">{step.inShape}</div>
        </div>
        <div className={['rounded-[16px] border px-3 py-2 text-center', colors.line, colors.panel].join(' ')}>
          <div className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-muted">Output</div>
          <div className="mt-1 font-mono text-[11px] text-[#41536f]">{step.outShape}</div>
        </div>
      </div>
    </div>
  );
}

function FigureConnector() {
  return (
    <div className="flex w-[72px] shrink-0 items-center justify-center pt-[88px]">
      <div className="relative h-[2px] w-full bg-[rgba(129,149,188,0.28)]">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-dashed border-[rgba(129,149,188,0.4)]" />
        <div className="absolute right-[-2px] top-1/2 h-3.5 w-3.5 -translate-y-1/2 rotate-45 border-r-2 border-t-2 border-[rgba(129,149,188,0.52)] bg-transparent" />
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
            <span className="text-sm text-muted">
              {dataset.label} architecture and generated PyTorch code
            </span>
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
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_300px]">
              <section className="min-w-0 rounded-[28px] bg-[linear-gradient(180deg,#fdfdfe_0%,#f7f8fb_100%)] p-6 shadow-[inset_0_0_0_1px_rgba(129,149,188,0.12)]">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="font-display text-xl font-bold text-ink">Architecture Flow</div>
                    <div className="text-sm text-muted">
                      Paper-style network diagram with explicit operator labels and tensor transitions.
                    </div>
                  </div>
                  <div className="rounded-full border border-[rgba(129,149,188,0.14)] bg-white px-4 py-2 text-xs font-extrabold uppercase tracking-[0.16em] text-primary">
                    {steps.length} Stages
                  </div>
                </div>

                <div className="rounded-[24px] border border-[rgba(129,149,188,0.1)] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.95),rgba(247,248,251,0.88))] px-2 py-5">
                  <div className="overflow-x-auto pb-3">
                    <div className="flex min-w-max items-start gap-0 px-2 py-4">
                      {steps.map((step, index) => (
                        <div key={step.id} className="flex items-start">
                          <LayerFigure step={step} index={index} />
                          {index !== steps.length - 1 ? <FigureConnector /> : null}
                        </div>
                      ))}
                    </div>
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

              <section className="rounded-[28px] border border-[rgba(129,149,188,0.14)] bg-white p-5 shadow-[0_16px_32px_rgba(13,27,51,0.05)]">
                <div className="font-display text-xl font-bold text-ink">Layer Summary</div>
                <div className="mt-1 text-sm text-muted">
                  Final linear layer must match the dataset class count and output raw logits.
                </div>

                <div className="mt-5 grid gap-3">
                  {steps.map((step, index) => {
                    const colors = stepColors(step.accent, step.isOutput);
                    return (
                      <div
                        key={`${step.id}-summary`}
                        className={['rounded-[18px] border px-4 py-3', colors.line, colors.panel].join(' ')}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <strong className="font-display text-base font-bold text-ink">
                            {index + 1}. {step.title}
                          </strong>
                          <span className={['rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em]', colors.chip].join(' ')}>
                            {step.opLabel}
                          </span>
                        </div>
                        <div className="mt-2 text-[12px] font-semibold text-[#5d6f8f]">{step.subtitle}</div>
                        <div className="mt-2 font-mono text-sm text-[#3b4b67]">
                          {step.inShape} {'->'} {step.outShape}
                        </div>
                      </div>
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
