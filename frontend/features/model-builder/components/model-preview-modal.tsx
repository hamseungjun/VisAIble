'use client';

import { useEffect, useState } from 'react';
import { generateModelCode } from '@/lib/model-code';
import type { CanvasNode, DatasetItem, OptimizerParamsForCode } from '@/types/builder';

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
  kind: 'input' | 'cnn' | 'linear' | 'pooling';
  title: string;
  subtitle: string;
  inShape: string;
  outShape: string;
  accent: 'primary' | 'tertiary' | 'neutral';
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
  };

  if (dataset.id === 'titanic') {
    return {
      inputChannels: 1,
      inputHeight: 1,
      inputWidth: 10,
      inputFeatures: 10,
      numClasses: 2,
      startsFlattened: true,
    };
  }

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

function buildArchitectureSteps(dataset: DatasetItem, nodes: CanvasNode[]): ArchitectureStep[] {
  const runtime = parseDatasetRuntime(dataset);
  const steps: ArchitectureStep[] = [
    {
      id: `${dataset.id}-input`,
      kind: 'input',
      title: 'Input Layer',
      subtitle: dataset.label,
      inShape: dataset.inputShape ?? 'Input',
      outShape: dataset.inputShape ?? 'Input',
      accent: 'neutral',
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
        inShape: `${channelIn} x ${currentHeight} x ${currentWidth}`,
        outShape: `${channelOut} x ${outHeight} x ${outWidth}`,
        accent: 'tertiary',
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
          subtitle: 'AdaptiveAvgPool 1x1',
          inShape: `${currentChannels} x ${currentHeight} x ${currentWidth}`,
          outShape: `${currentChannels} x 1 x 1`,
          accent: 'tertiary',
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
        subtitle: `${poolType} ${kernelSize}x${kernelSize}`,
        inShape: `${currentChannels} x ${currentHeight} x ${currentWidth}`,
        outShape: `${currentChannels} x ${outHeight} x ${outWidth}`,
        accent: 'tertiary',
        isOutput: false,
      });

      currentHeight = outHeight;
      currentWidth = outWidth;
      return;
    }

    const inputFeatures = flattened
      ? (currentFeatures ?? runtime.inputFeatures ?? currentChannels * currentHeight * currentWidth)
      : currentChannels * currentHeight * currentWidth;
    const outputFeatures = Number(fieldValue(node, 'Output', '128'));

    steps.push({
      id: node.id,
      kind: 'linear',
      title: isLastNode && outputFeatures === runtime.numClasses ? 'Output Layer' : node.title,
      subtitle:
        isLastNode && outputFeatures === runtime.numClasses
          ? `${runtime.numClasses} logits`
          : `${node.activation} activation`,
      inShape: String(inputFeatures),
      outShape: String(outputFeatures),
      accent: 'primary',
      isOutput: isLastNode && outputFeatures === runtime.numClasses,
    });

    currentFeatures = outputFeatures;
    flattened = true;
  });

  return steps;
}

function stepColors(accent: ArchitectureStep['accent'], isOutput: boolean) {
  if (isOutput) {
    return {
      panel: 'bg-white border-[#bfd2f6]',
      chip: 'bg-[#edf4ff] text-primary',
      bar: 'bg-primary',
    };
  }

  if (accent === 'tertiary') {
    return {
      panel: 'bg-white border-[#f0d2c4]',
      chip: 'bg-[#fff1ea] text-[#c86e44]',
      bar: 'bg-[#e68252]',
    };
  }

  if (accent === 'primary') {
    return {
      panel: 'bg-white border-[#cad7f6]',
      chip: 'bg-[#edf4ff] text-primary',
      bar: 'bg-primary',
    };
  }

  return {
    panel: 'bg-white border-[#bfded6]',
    chip: 'bg-[#ebfaf6] text-[#169b8a]',
    bar: 'bg-[#169b8a]',
  };
}

function parseDims(shape: string) {
  return shape
    .split('x')
    .map((item) => Number(item.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function figureSizeForShape(shape: string, kind: ArchitectureStep['kind']): FigureSize {
  const dims = parseDims(shape);

  if (kind === 'cnn' || dims.length >= 3) {
    const [channels = 1, height = 1, width = 1] = dims.length >= 3 ? dims : [1, dims[0] ?? 1, dims[1] ?? 1];
    return {
      width: Math.max(42, Math.min(104, 28 + Math.sqrt(width) * 10)),
      height: Math.max(52, Math.min(128, 34 + Math.sqrt(height * Math.max(channels, 1)) * 8)),
    };
  }

  const features = dims[0] ?? 1;
  return {
    width: Math.max(52, Math.min(150, 36 + Math.log10(features + 1) * 34)),
    height: Math.max(52, Math.min(110, 44 + Math.log10(features + 1) * 16)),
  };
}

function LayerFigure({ step }: { step: ArchitectureStep }) {
  const colors = stepColors(step.accent, step.isOutput);
  const shape = step.kind === 'input' ? step.outShape : step.outShape;
  const dims = parseDims(shape);
  const size = figureSizeForShape(shape, step.kind);
  const depth = step.kind === 'cnn' || dims.length >= 3 ? Math.max(2, Math.min(5, Math.ceil((dims[0] ?? 1) / 16))) : 1;

  return (
    <div className="flex w-[148px] shrink-0 flex-col items-center">
      <div className="text-center text-[13px] font-bold text-ink">{step.title}</div>
      <div className="mt-1 text-center text-[11px] font-semibold text-[#6f86ad]">{step.subtitle}</div>

      <div className="relative mt-5 flex h-[190px] w-full items-center justify-center">
        {step.kind === 'cnn' || step.kind === 'input' || step.kind === 'pooling' ? (
          <div className="relative">
            {Array.from({ length: depth }).map((_, index) => (
              <div
                key={`${step.id}-${index}`}
                className={[
                  'absolute rounded-[4px] border shadow-[0_6px_12px_rgba(13,27,51,0.08)]',
                  step.kind === 'pooling' ? 'bg-[#fff3ee] border-[#efb496]' : colors.panel,
                ].join(' ')}
                style={{
                  width: size.width,
                  height: step.kind === 'pooling' ? Math.max(22, size.height * 0.34) : size.height,
                  left: index * 8,
                  top: -index * 6,
                }}
              />
            ))}
            <div
              className="opacity-0"
              style={{
                width: size.width + (depth - 1) * 8,
                height:
                  (step.kind === 'pooling' ? Math.max(22, size.height * 0.34) : size.height) +
                  (depth - 1) * 6,
              }}
            />
          </div>
        ) : (
          <div
            className={[
              'rounded-[2px] border shadow-[0_6px_12px_rgba(13,27,51,0.08)]',
              step.isOutput ? 'bg-[#d9d9d9] border-[#bfbfbf]' : 'bg-[#e8e8e8] border-[#cfcfcf]',
            ].join(' ')}
            style={{
              width: Math.max(28, Math.min(58, size.width * 0.42)),
              height: Math.max(96, Math.min(164, size.height * 1.35)),
            }}
          />
        )}
      </div>

      <div className="mt-3 rounded-full border border-[rgba(129,149,188,0.12)] bg-white px-3 py-1 text-[11px] font-mono text-[#43536f]">
        {step.outShape}
      </div>
    </div>
  );
}

function FigureConnector() {
  return (
    <div className="flex w-[64px] shrink-0 items-center justify-center pt-12">
      <div className="relative h-[4px] w-full bg-[rgba(129,149,188,0.22)]">
        <div className="absolute right-[-2px] top-1/2 h-4 w-4 -translate-y-1/2 rotate-45 border-r-[3px] border-t-[3px] border-[rgba(129,149,188,0.5)] bg-transparent" />
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
                  'absolute top-1.5 h-[42px] w-[42px] rounded-full bg-white shadow-[0_10px_24px_rgba(17,81,255,0.16)] transition-transform duration-300',
                  viewMode === 'architecture' ? 'translate-x-0' : 'translate-x-[88px]',
                ].join(' ')}
              />
              <button
                type="button"
                onClick={() => setViewMode('architecture')}
                className={[
                  'relative z-10 flex h-[42px] w-[42px] items-center justify-center rounded-full text-[11px] font-extrabold uppercase tracking-[0.14em] transition-colors',
                  viewMode === 'architecture' ? 'text-primary' : 'text-muted',
                ].join(' ')}
              >
                Arch
              </button>
              <button
                type="button"
                onClick={() => setViewMode('code')}
                className={[
                  'relative z-10 ml-[46px] flex h-[42px] w-[42px] items-center justify-center rounded-full text-[11px] font-extrabold uppercase tracking-[0.14em] transition-colors',
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
                    <div className="text-sm text-muted">Figure-style network diagram with layer-wise output dimensions.</div>
                  </div>
                  <div className="rounded-full border border-[rgba(129,149,188,0.14)] bg-white px-4 py-2 text-xs font-extrabold uppercase tracking-[0.16em] text-primary">
                    {nodes.length} Layers
                  </div>
                </div>

                <div className="overflow-x-auto pb-3">
                  <div className="flex min-w-max items-start gap-0 px-2 py-6">
                    {steps.map((step, index) => (
                      <div key={step.id} className="flex items-start">
                        <LayerFigure step={step} />
                        {index !== steps.length - 1 ? <FigureConnector /> : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-5 text-[12px] text-muted">
                  <span className="flex items-center gap-2">
                    <i className="h-3 w-3 rounded-[2px] border border-[#cfcfcf] bg-[#e8e8e8]" />
                    Fully connected
                  </span>
                  <span className="flex items-center gap-2">
                    <i className="h-3 w-3 rounded-[2px] border border-[#f0d2c4] bg-[#fff1ea]" />
                    Convolution + activation
                  </span>
                  <span className="flex items-center gap-2">
                    <i className="h-3 w-3 rounded-[2px] border border-[#efb496] bg-[#fff3ee]" />
                    Pooling
                  </span>
                  <span className="flex items-center gap-2">
                    <i className="h-3 w-3 rounded-[2px] border border-[#bfd2f6] bg-[#edf4ff]" />
                    Output logits
                  </span>
                </div>
              </section>

              <section className="rounded-[28px] border border-[rgba(129,149,188,0.14)] bg-white p-5 shadow-[0_16px_32px_rgba(13,27,51,0.05)]">
                <div className="font-display text-xl font-bold text-ink">Layer Summary</div>
                <div className="mt-1 text-sm text-muted">
                  Final linear layer must match the dataset class count and output raw logits.
                </div>

                <div className="mt-5 grid gap-3">
                  {steps.map((step, index) => (
                    <div
                      key={`${step.id}-summary`}
                      className="rounded-[18px] border border-[rgba(129,149,188,0.12)] bg-[#fbfcff] px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <strong className="font-display text-base font-bold text-ink">
                          {index + 1}. {step.title}
                        </strong>
                        {step.isOutput ? (
                          <span className="rounded-full bg-primary px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-white">
                            Output
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 font-mono text-sm text-[#3b4b67]">
                        {step.inShape} {'->'} {step.outShape}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <section className="min-w-0 rounded-[28px] bg-[#0f172a] p-5 text-white shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)]">
              <div className="mb-3 flex items-center justify-between">
                <strong className="font-display text-xl font-bold">Generated Code</strong>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                  PyTorch
                </span>
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
