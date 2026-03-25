'use client';

import { useRef, useState } from 'react';
import { Icon } from '@/features/model-builder/components/icons';
import type { BlockType, CanvasNode, DatasetItem } from '@/types/builder';

type CanvasProps = {
  selectedDataset: DatasetItem;
  nodes: CanvasNode[];
  draggingBlock: BlockType | null;
  zoom: number;
  onRemoveNode: (id: string) => void;
  onUpdateNodeField: (id: string, fieldLabel: string, value: string) => void;
  onUpdateNodeActivation: (id: string, activation: string) => void;
  onDropBlock: (type: BlockType, index?: number) => void;
};

type NodeDimensionInfo = {
  inputLabel: string;
  outputLabel: string;
};

function getDroppedBlockType(event: React.DragEvent, fallback: BlockType | null) {
  const droppedBlock =
    event.dataTransfer.getData('application/x-builder-block') ||
    event.dataTransfer.getData('text/plain');

  if (droppedBlock === 'linear' || droppedBlock === 'cnn' || droppedBlock === 'pooling') {
    return droppedBlock;
  }

  return fallback;
}

function getInsertionIndex(
  event: React.DragEvent<HTMLElement>,
  container: HTMLDivElement | null,
  count: number,
) {
  if (!container || count === 0) {
    return 0;
  }

  const cards = Array.from(container.querySelectorAll<HTMLElement>('[data-node-card="true"]'));

  for (let index = 0; index < cards.length; index += 1) {
    const rect = cards[index].getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;

    if (event.clientY < midpoint) {
      return index;
    }
  }

  return count;
}

function fieldValue(node: CanvasNode, label: string, fallback: string) {
  return node.fields.find((field) => field.label === label)?.value ?? fallback;
}

function parseDatasetShape(dataset: DatasetItem) {
  const dims = dataset.inputShape?.split('x').map((item) => Number(item.trim())) ?? [1, 1, 1];

  if (dims.length === 3) {
    return {
      channels: dims[0] ?? 1,
      height: dims[1] ?? 1,
      width: dims[2] ?? 1,
      flattened: false,
      features: null as number | null,
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
    return Number(value.toLowerCase().split('x')[0]?.trim() ?? '3');
  }

  return Number(value);
}

function parsePoolingStride(value: string, kernelSize: number) {
  const normalized = value.trim().toLowerCase();
  if (normalized === '' || normalized === 'none') {
    return kernelSize;
  }
  return Number(value);
}

function convOutputSize(size: number, kernelSize: number, padding: number, stride: number) {
  return Math.floor(((size + 2 * padding - kernelSize) / stride) + 1);
}

function poolingOutputSize(size: number, kernelSize: number, padding: number, stride: number) {
  return Math.floor(((size + 2 * padding - kernelSize) / stride) + 1);
}

function getNodeDimensions(selectedDataset: DatasetItem, nodes: CanvasNode[]): Record<string, NodeDimensionInfo> {
  const dimensionMap: Record<string, NodeDimensionInfo> = {};
  const current = parseDatasetShape(selectedDataset);

  nodes.forEach((node) => {
    if (node.type === 'cnn') {
      const channelIn = Number(fieldValue(node, 'Channel In', String(current.channels)));
      const channelOut = Number(fieldValue(node, 'Channel Out', String(channelIn)));
      const kernelSize = parseKernelSize(fieldValue(node, 'Kernel Size', '3x3'));
      const padding = Number(fieldValue(node, 'Padding', '1'));
      const stride = Number(fieldValue(node, 'Stride', '1'));
      const outputHeight = convOutputSize(current.height, kernelSize, padding, stride);
      const outputWidth = convOutputSize(current.width, kernelSize, padding, stride);

      dimensionMap[node.id] = {
        inputLabel: `${channelIn} x ${current.height} x ${current.width}`,
        outputLabel: `${channelOut} x ${outputHeight} x ${outputWidth}`,
      };

      current.channels = channelOut;
      current.height = outputHeight;
      current.width = outputWidth;
      current.features = null;
      current.flattened = false;
      return;
    }

    if (node.type === 'pooling') {
      const poolType = fieldValue(node, 'Pool Type', 'MaxPool');
      if (poolType === 'AdaptiveAvgPool') {
        dimensionMap[node.id] = {
          inputLabel: `${current.channels} x ${current.height} x ${current.width}`,
          outputLabel: `${current.channels} x 1 x 1`,
        };

        current.height = 1;
        current.width = 1;
        current.features = null;
        current.flattened = false;
        return;
      }

      const kernelSize = parseKernelSize(fieldValue(node, 'Kernel Size', '2x2'));
      const padding = Number(fieldValue(node, 'Padding', '0'));
      const stride = parsePoolingStride(fieldValue(node, 'Stride', ''), kernelSize);
      const outputHeight = poolingOutputSize(current.height, kernelSize, padding, stride);
      const outputWidth = poolingOutputSize(current.width, kernelSize, padding, stride);

      dimensionMap[node.id] = {
        inputLabel: `${current.channels} x ${current.height} x ${current.width}`,
        outputLabel: `${current.channels} x ${outputHeight} x ${outputWidth}`,
      };

      current.height = outputHeight;
      current.width = outputWidth;
      current.features = null;
      current.flattened = false;
      return;
    }

    const inputFeatures = current.flattened
      ? (current.features ?? current.width)
      : current.channels * current.height * current.width;
    const outputFeatures = Number(fieldValue(node, 'Output', '128'));

    dimensionMap[node.id] = {
      inputLabel: `${inputFeatures}`,
      outputLabel: `${outputFeatures}`,
    };

    current.features = outputFeatures;
    current.flattened = true;
  });

  return dimensionMap;
}

function NodeCard({
  node,
  dimensions,
  onRemove,
  onFieldChange,
  onActivationChange,
}: {
  node: CanvasNode;
  dimensions?: NodeDimensionInfo;
  onRemove: () => void;
  onFieldChange: (fieldLabel: string, value: string) => void;
  onActivationChange: (activation: string) => void;
}) {
  const isCnn = node.type === 'cnn';
  const isPooling = node.type === 'pooling';
  const isAdaptivePooling = isPooling && fieldValue(node, 'Pool Type', 'MaxPool') === 'AdaptiveAvgPool';
  const fieldCountLabel = `${node.fields.length} settings`;
  const poolingTypeLabel = isPooling ? fieldValue(node, 'Pool Type', 'MaxPool') : node.activation;
  const cardBackgroundClass = isPooling
    ? 'bg-[#f3ecff]'
    : node.accent === 'primary'
      ? 'bg-panel/95'
      : 'bg-[#ffe7da]';
  const accentBarClass = isPooling
    ? 'bg-[#8b63d9]'
    : node.accent === 'primary'
      ? 'bg-primary'
      : 'bg-[#e68252]';

  return (
    <article
      className={[
        'relative w-full max-w-[760px] rounded-[28px] px-3.5 pb-2.5 pt-3 shadow-[0_12px_24px_rgba(13,27,51,0.08)]',
        cardBackgroundClass,
      ].join(' ')}
    >
      <div
        className={[
          'absolute inset-x-3 top-0 h-[7px] rounded-b-[10px] rounded-t-[999px]',
          accentBarClass,
        ].join(' ')}
      />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[14px] w-[72px] -translate-x-1/2 -translate-y-[35%] rounded-full border-[3px] border-background bg-white/82 shadow-[0_6px_14px_rgba(13,27,51,0.06)]" />
      <div className="pointer-events-none absolute left-1/2 bottom-[-8px] h-[16px] w-[52px] -translate-x-1/2 rounded-b-[14px] bg-background/92 shadow-[inset_0_2px_0_rgba(129,149,188,0.14)]" />

      <div className="flex items-start gap-3 border-b border-line pb-1.5">
        <div className="min-w-0 flex-1 grid gap-0.5">
          <strong className="truncate font-display text-[13px] font-bold uppercase tracking-[-0.02em] text-ink">
            {node.title}
          </strong>
          <div className="flex flex-wrap gap-1">
            <span className="rounded-full bg-white/72 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-muted">
              {fieldCountLabel}
            </span>
            <span className="rounded-full bg-white/72 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-muted">
              {poolingTypeLabel}
            </span>
          </div>
        </div>

        {dimensions ? (
          <div className="hidden min-w-0 flex-[1.2] items-center justify-end xl:flex">
            <div className="flex w-full max-w-[460px] items-center gap-3 rounded-[12px] bg-[rgba(255,255,255,0.42)] px-2.5 py-1.5 shadow-[inset_0_0_0_1px_rgba(129,149,188,0.10)]">
              <div className="shrink-0 text-[7px] font-extrabold uppercase tracking-[0.14em] text-muted">
                Tensor Size
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-3 text-[10px] font-semibold text-ink">
                <div className="min-w-0 font-mono">
                  <span className="mr-1 text-[8px] font-extrabold uppercase tracking-[0.12em] text-muted">
                    In
                  </span>
                  {dimensions.inputLabel}
                </div>
                <div className="text-muted/70">→</div>
                <div className="min-w-0 font-mono">
                  <span className="mr-1 text-[8px] font-extrabold uppercase tracking-[0.12em] text-muted">
                    Out
                  </span>
                  {dimensions.outputLabel}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex shrink-0 items-start gap-2">
          <div className="flex items-center gap-1 pt-1">
            <Icon name="dots" className="h-3 w-3 text-muted/70" />
            <button
              type="button"
              onClick={onRemove}
              className="grid h-7 w-7 place-items-center rounded-full bg-[#eef3ff] text-base font-bold leading-none text-muted transition-colors hover:bg-[#dbe7ff] hover:text-ink"
              aria-label={`Remove ${node.title}`}
            >
              ×
            </button>
          </div>
        </div>
      </div>

      {dimensions ? (
        <div className="mt-2 xl:hidden">
          <div className="flex w-full items-center gap-3 rounded-[12px] bg-[rgba(255,255,255,0.42)] px-2.5 py-1.5 shadow-[inset_0_0_0_1px_rgba(129,149,188,0.10)]">
            <div className="shrink-0 text-[7px] font-extrabold uppercase tracking-[0.14em] text-muted">
              Tensor Size
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-3 text-[10px] font-semibold text-ink">
              <div className="min-w-0 font-mono">
                <span className="mr-1 text-[8px] font-extrabold uppercase tracking-[0.12em] text-muted">
                  In
                </span>
                {dimensions.inputLabel}
              </div>
              <div className="text-muted/70">→</div>
              <div className="min-w-0 font-mono">
                <span className="mr-1 text-[8px] font-extrabold uppercase tracking-[0.12em] text-muted">
                  Out
                </span>
                {dimensions.outputLabel}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isCnn ? (
        <div className="mt-2 grid gap-1.5">
          <div className="grid min-w-0 gap-1.5 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,0.82fr)_minmax(0,1fr)]">
            {node.fields.slice(0, 3).map((field) => (
              <label
                key={field.label}
                className="grid min-w-0 gap-0.5 rounded-[16px] bg-white/72 px-2.5 py-1.5 shadow-[inset_0_0_0_1px_rgba(129,149,188,0.1)]"
              >
                <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#44506a]">
                  {field.label}
                </span>
                <input
                  value={field.value}
                  onChange={(event) => onFieldChange(field.label, event.target.value)}
                  className="w-full min-w-0 rounded-[12px] border border-transparent bg-white px-3 py-1.5 text-[12px] font-semibold text-ink shadow-[inset_0_-2px_0_rgba(129,149,188,0.12)] outline-none ring-0 transition-shadow focus:border-primary/30 focus:shadow-[0_0_0_3px_rgba(17,81,255,0.12)]"
                />
              </label>
            ))}
          </div>

          <div className="grid min-w-0 gap-1.5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.4fr)]">
            {node.fields.slice(3).map((field) => (
              <label
                key={field.label}
                className="grid min-w-0 gap-0.5 rounded-[16px] bg-white/72 px-2.5 py-1.5 shadow-[inset_0_0_0_1px_rgba(129,149,188,0.1)]"
              >
                <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#44506a]">
                  {field.label}
                </span>
                <input
                  value={field.value}
                  onChange={(event) => onFieldChange(field.label, event.target.value)}
                  className="w-full min-w-0 rounded-[12px] border border-transparent bg-white px-3 py-1.5 text-[12px] font-semibold text-ink shadow-[inset_0_-2px_0_rgba(129,149,188,0.12)] outline-none ring-0 transition-shadow focus:border-primary/30 focus:shadow-[0_0_0_3px_rgba(17,81,255,0.12)]"
                />
              </label>
            ))}

            <label className="grid gap-0.5 rounded-[16px] bg-white/72 px-2.5 py-1.5 shadow-[inset_0_0_0_1px_rgba(129,149,188,0.1)]">
              <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#44506a]">
                Activation Function
              </span>
              <div className="relative">
                <select
                  value={node.activation}
                  onChange={(event) => onActivationChange(event.target.value)}
                  className="w-full appearance-none rounded-[12px] border border-transparent bg-white px-3 py-1.5 text-[12px] font-semibold text-ink shadow-[inset_0_-2px_0_rgba(129,149,188,0.12)] outline-none ring-0 transition-shadow focus:border-primary/30 focus:shadow-[0_0_0_3px_rgba(17,81,255,0.12)]"
                >
                  {node.activationOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <Icon name="chevron" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              </div>
            </label>
          </div>
        </div>
      ) : isPooling ? (
        <div className="mt-2 grid gap-1.5">
          <div className="grid gap-1.5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]">
            {node.fields
              .filter((field) => !isAdaptivePooling || field.label === 'Pool Type')
              .map((field) => {
              const isPoolType = field.label === 'Pool Type';
              const isCompactField = field.label === 'Stride' || field.label === 'Padding';

              return (
                <label
                  key={field.label}
                  className={[
                    'grid min-w-0 gap-0.5 rounded-[16px] px-2.5 py-1.5 shadow-[inset_0_0_0_1px_rgba(129,149,188,0.1)]',
                    isPoolType ? 'bg-white/72' : 'bg-white/72',
                    isCompactField ? 'xl:max-w-[170px]' : '',
                  ].join(' ')}
                >
                  <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#44506a]">
                    {field.label}
                  </span>
                  {isPoolType ? (
                    <div className="relative">
                      <select
                        value={field.value}
                        onChange={(event) => onFieldChange(field.label, event.target.value)}
                        className="w-full appearance-none rounded-[12px] border border-transparent bg-white px-3 py-1.5 text-[12px] font-semibold text-ink shadow-[inset_0_-2px_0_rgba(129,149,188,0.12)] outline-none ring-0 transition-shadow focus:border-primary/30 focus:shadow-[0_0_0_3px_rgba(17,81,255,0.12)]"
                      >
                        <option value="MaxPool">MaxPool</option>
                        <option value="AvgPool">AvgPool</option>
                        <option value="AdaptiveAvgPool">AdaptiveAvgPool (1x1)</option>
                      </select>
                      <Icon
                        name="chevron"
                        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                      />
                    </div>
                  ) : (
                  <input
                    value={field.value}
                    onChange={(event) => onFieldChange(field.label, event.target.value)}
                    placeholder={field.label === 'Stride' ? 'None' : undefined}
                    className={[
                      'w-full min-w-0 rounded-[12px] border border-transparent bg-white px-3 py-1.5 text-[12px] font-semibold text-ink shadow-[inset_0_-2px_0_rgba(129,149,188,0.12)] outline-none ring-0 transition-shadow focus:border-[#e68252]/40 focus:shadow-[0_0_0_3px_rgba(230,130,82,0.14)]',
                      isCompactField ? 'text-center' : '',
                      ].join(' ')}
                    />
                  )}
                </label>
              );
            })}
          </div>

          <div className="flex justify-end rounded-[16px] bg-white/62 px-3 py-2 shadow-[inset_0_0_0_1px_rgba(129,149,188,0.1)]">
            {isAdaptivePooling ? (
              <div className="rounded-full bg-[#f4efff] px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#7b57c6]">
                Output Size 1 x 1
              </div>
            ) : (
              <div className="rounded-full bg-[#f4efff] px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#7b57c6]">
                Feature Map Resize
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-2 grid gap-1.5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.15fr)] xl:items-end">
          {node.fields.map((field) => (
            <label
              key={field.label}
              className="grid min-w-0 gap-0.5 rounded-[16px] bg-white/72 px-2.5 py-1.5 shadow-[inset_0_0_0_1px_rgba(129,149,188,0.1)]"
            >
              <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#44506a]">
                {field.label}
              </span>
              <input
                value={field.value}
                onChange={(event) => onFieldChange(field.label, event.target.value)}
                inputMode="numeric"
                className="w-full min-w-0 rounded-[12px] border border-transparent bg-white px-3 py-1.5 text-center text-[12px] font-semibold text-ink shadow-[inset_0_-2px_0_rgba(129,149,188,0.12)] outline-none ring-0 transition-shadow focus:border-primary/30 focus:shadow-[0_0_0_3px_rgba(17,81,255,0.12)]"
              />
            </label>
          ))}

          <label className="grid gap-0.5 rounded-[16px] bg-white/72 px-2.5 py-1.5 shadow-[inset_0_0_0_1px_rgba(129,149,188,0.1)]">
            <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#44506a]">
              Activation Function
            </span>
            <div className="relative">
              <select
                value={node.activation}
                onChange={(event) => onActivationChange(event.target.value)}
                className="w-full appearance-none rounded-[12px] border border-transparent bg-white px-3 py-1.5 text-[12px] font-semibold text-ink shadow-[inset_0_-2px_0_rgba(129,149,188,0.12)] outline-none ring-0 transition-shadow focus:border-primary/30 focus:shadow-[0_0_0_3px_rgba(17,81,255,0.12)]"
              >
                {node.activationOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <Icon name="chevron" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            </div>
          </label>
        </div>
      )}
    </article>
  );
}

function DataBlockCard({ dataset }: { dataset: DatasetItem }) {
  return (
    <article className="relative w-full max-w-[760px] rounded-[28px] bg-[#d9f3ef] px-3.5 pb-2.5 pt-3 shadow-[0_12px_24px_rgba(13,27,51,0.08)]">
      <div className="absolute inset-x-3 top-0 h-[7px] rounded-b-[10px] rounded-t-[999px] bg-[#169b8a]" />
      <div className="pointer-events-none absolute left-1/2 bottom-[-8px] h-[16px] w-[52px] -translate-x-1/2 rounded-b-[14px] bg-background/92 shadow-[inset_0_2px_0_rgba(129,149,188,0.14)]" />

      <div className="flex items-start justify-between gap-2 border-b border-line pb-1.5">
        <div className="min-w-0 grid gap-0.5">
          <strong className="truncate font-display text-[13px] font-bold uppercase tracking-[-0.02em] text-ink">
            Data
          </strong>
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            Fixed source block
          </span>
        </div>
        <div className="shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#169b8a]">
          locked
        </div>
      </div>

      <div className="mt-2 grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_180px]">
        <label className="grid gap-0.5 rounded-[16px] bg-white/72 px-2.5 py-1.5 shadow-[inset_0_0_0_1px_rgba(129,149,188,0.1)]">
          <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#44506a]">
            Dataset
          </span>
          <div className="rounded-[12px] bg-white px-3 py-1.5 text-[12px] font-semibold text-ink shadow-[inset_0_-2px_0_rgba(129,149,188,0.12)]">
            {dataset.label}
          </div>
        </label>

        <label className="grid gap-0.5 rounded-[16px] bg-white/72 px-2.5 py-1.5 shadow-[inset_0_0_0_1px_rgba(129,149,188,0.1)]">
          <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#44506a]">
            Input shape
          </span>
          <div className="rounded-[12px] bg-white px-3 py-1.5 text-[12px] font-semibold text-ink shadow-[inset_0_-2px_0_rgba(129,149,188,0.12)]">
            {dataset.inputShape ?? '-'}
          </div>
        </label>
      </div>
    </article>
  );
}

export function Canvas({
  selectedDataset,
  nodes,
  draggingBlock,
  zoom,
  onRemoveNode,
  onUpdateNodeField,
  onUpdateNodeActivation,
  onDropBlock,
}: CanvasProps) {
  const stackRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const nodeDimensions = getNodeDimensions(selectedDataset, nodes);

  return (
    <main className="relative min-h-[760px] overflow-hidden bg-background">
      <div className="pointer-events-none canvas-grid absolute inset-0 opacity-35" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(17,81,255,0.06),transparent_42%),radial-gradient(circle_at_78%_72%,rgba(10,96,127,0.1),transparent_26%)]" />

      <div
        onDragOver={(event) => {
          event.preventDefault();

          const droppedBlock = getDroppedBlockType(event, draggingBlock);

          if (!droppedBlock) {
            setHoverIndex(null);
            return;
          }

          setHoverIndex(getInsertionIndex(event, stackRef.current, nodes.length));
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setHoverIndex(null);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();

          const droppedBlock = getDroppedBlockType(event, draggingBlock);

          if (!droppedBlock) {
            return;
          }

          const insertionIndex = getInsertionIndex(event, stackRef.current, nodes.length);
          setHoverIndex(null);
          onDropBlock(droppedBlock, insertionIndex);
        }}
        className={[
          'relative flex min-h-[760px] flex-col items-center px-4 pb-8 pt-3 transition-colors sm:px-6',
          draggingBlock ? 'bg-primary/[0.03]' : '',
        ].join(' ')}
      >
        <div className="relative w-full max-w-[1080px] overflow-hidden rounded-[32px] border border-white/50 bg-white/28 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-sm">
          <div className="px-5 py-4">
            <div
              ref={stackRef}
              className="mx-auto flex max-w-[760px] flex-col items-center transition-transform duration-150"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
            >
              <DataBlockCard dataset={selectedDataset} />

              {nodes.length === 0 ? (
                <div className="-mt-2 w-full rounded-b-[24px] border border-dashed border-primary/25 bg-white/72 px-5 py-6 text-center text-[13px] font-semibold text-muted">
                  Drag a layer anywhere into this stack to attach it under the data block.
                </div>
              ) : null}

              {hoverIndex === 0 ? (
                <div className="z-10 -mt-1 mb-1 h-2.5 w-full max-w-[760px] rounded-full bg-primary/18 ring-2 ring-primary/35" />
              ) : null}

              {nodes.map((node, index) => (
                <div key={node.id} className="-mt-2.5 flex w-full flex-col items-center first:mt-0">
                  <div data-node-card="true" className="w-full">
                    <NodeCard
                      node={node}
                      dimensions={nodeDimensions[node.id]}
                      onRemove={() => onRemoveNode(node.id)}
                      onFieldChange={(fieldLabel, value) =>
                        onUpdateNodeField(node.id, fieldLabel, value)
                      }
                      onActivationChange={(activation) =>
                        onUpdateNodeActivation(node.id, activation)
                      }
                    />
                  </div>
                  {hoverIndex === index + 1 ? (
                    <div className="z-10 my-1 h-2.5 w-full max-w-[760px] rounded-full bg-primary/18 ring-2 ring-primary/35" />
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/60 px-5 py-3.5">
            <div className="rounded-full bg-white/80 px-3.5 py-2 text-[12px] font-semibold text-muted shadow-panel">
              Delete: click the `×` button on the top-right of a block
            </div>
            <div className="rounded-full bg-[#edf3ff] px-3 py-1.5 text-[12px] font-bold text-primary">
              {nodes.length} blocks
            </div>
          </div>
        </div>
        {draggingBlock ? (
          <div className="pointer-events-none absolute inset-x-5 bottom-5 rounded-2xl border border-dashed border-primary/40 bg-white/80 px-4 py-2.5 text-center text-[13px] font-semibold text-primary backdrop-blur-md">
            Drag anywhere on the stack to place {draggingBlock === 'linear' ? 'Linear Layer' : draggingBlock === 'cnn' ? 'CNN Layer' : 'Pooling Layer'}
          </div>
        ) : null}
      </div>
    </main>
  );
}
