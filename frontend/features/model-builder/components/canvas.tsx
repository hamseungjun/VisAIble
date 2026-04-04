'use client';

import type { DragEvent, HTMLAttributes } from 'react';
import { useMemo, useRef, useState } from 'react';
import { Icon } from '@/features/model-builder/components/icons';
import { libraryBlocks } from '@/lib/constants/builder-data';
import { analyzeModelNodes, type NodeAdviceInfo, type NodeDimensionInfo } from '@/lib/model-advice';
import type { BlockAccent, BlockType, CanvasNode, DatasetItem } from '@/types/builder';

type CanvasProps = {
  selectedDataset: DatasetItem;
  nodes: CanvasNode[];
  draggingBlock: BlockType | null;
  zoom: number;
  tutorialTargetNodeType?: BlockType | null;
  tutorialTargetNodeOccurrence?: number | null;
  tutorialTargetFieldLabel?: string | null;
  tutorialTargetFieldName?: string | null;
  tutorialSecondaryTargetNodeType?: BlockType | null;
  tutorialSecondaryTargetNodeOccurrence?: number | null;
  tutorialSecondaryTargetFieldLabel?: string | null;
  tutorialSecondaryTargetFieldName?: string | null;
  tutorialTargetActivationName?: string | null;
  onRemoveNode: (id: string) => void;
  isNodeRemovable?: (node: CanvasNode) => boolean;
  onUpdateNodeField: (id: string, fieldLabel: string, value: string) => void;
  onUpdateNodeActivation: (id: string, activation: string) => void;
  onMoveNode: (id: string, index: number) => void;
  onDropBlock: (type: BlockType, index?: number) => void;
};

function getDroppedBlockType(event: DragEvent, fallback: BlockType | null) {
  const droppedBlock =
    event.dataTransfer.getData('application/x-builder-block') ||
    event.dataTransfer.getData('text/plain');

  if (
    droppedBlock === 'linear' ||
    droppedBlock === 'cnn' ||
    droppedBlock === 'pooling' ||
    droppedBlock === 'dropout'
  ) {
    return droppedBlock;
  }

  return fallback;
}

function getDraggedNodeId(event: DragEvent) {
  const nodeId = event.dataTransfer.getData('application/x-builder-node');
  return nodeId || null;
}

function getInsertionIndex(
  event: DragEvent<HTMLElement>,
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

function getCardInsertionIndex(
  event: DragEvent<HTMLElement>,
  index: number,
) {
  const rect = event.currentTarget.getBoundingClientRect();
  const midpoint = rect.top + rect.height / 2;
  return event.clientY < midpoint ? index : index + 1;
}

function blockTone(accent: BlockAccent) {
  const palette: Record<
    BlockAccent,
    {
      card: string;
      bar: string;
      chip: string;
      focus: string;
      icon: string;
    }
  > = {
    blue: {
      card: 'bg-[#edf4ff]',
      bar: 'bg-[#2463eb]',
      chip: 'bg-[#dbe8ff] text-[#2456c9]',
      focus: 'focus:border-[#2463eb]/30 focus:shadow-[0_0_0_3px_rgba(36,99,235,0.12)]',
      icon: 'text-[#2456c9]',
    },
    amber: {
      card: 'bg-[#fff1e6]',
      bar: 'bg-[#de7a2d]',
      chip: 'bg-[#ffe1cc] text-[#b95b16]',
      focus: 'focus:border-[#de7a2d]/35 focus:shadow-[0_0_0_3px_rgba(222,122,45,0.14)]',
      icon: 'text-[#b95b16]',
    },
    violet: {
      card: 'bg-[#f2eeff]',
      bar: 'bg-[#7b5ad6]',
      chip: 'bg-[#e5dcff] text-[#6846bd]',
      focus: 'focus:border-[#7b5ad6]/35 focus:shadow-[0_0_0_3px_rgba(123,90,214,0.14)]',
      icon: 'text-[#6846bd]',
    },
    rose: {
      card: 'bg-[#fff0f4]',
      bar: 'bg-[#d45a7a]',
      chip: 'bg-[#ffdbe6] text-[#b43b5c]',
      focus: 'focus:border-[#d45a7a]/35 focus:shadow-[0_0_0_3px_rgba(212,90,122,0.14)]',
      icon: 'text-[#b43b5c]',
    },
    emerald: {
      card: 'bg-[#ddf5ef]',
      bar: 'bg-[#169b8a]',
      chip: 'bg-[#c8ede3] text-[#0b7d6f]',
      focus: 'focus:border-[#169b8a]/30 focus:shadow-[0_0_0_3px_rgba(22,155,138,0.12)]',
      icon: 'text-[#0b7d6f]',
    },
  };

  return palette[accent];
}

function fieldValue(node: CanvasNode, label: string, fallback: string) {
  return node.fields.find((field) => field.label === label)?.value ?? fallback;
}

function parseNumeric(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function formatParamCount(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  }
  return `${value}`;
}

function estimateTotalParameterCount(selectedDataset: DatasetItem, nodes: CanvasNode[]) {
  const current = parseDatasetShape(selectedDataset);
  let totalParams = 0;

  nodes.forEach((node) => {
    if (node.type === 'cnn') {
      const channelIn = parseNumeric(fieldValue(node, 'Channel In', String(current.channels)), current.channels);
      const channelOut = parseNumeric(fieldValue(node, 'Channel Out', String(channelIn)), channelIn);
      const kernelSize = parseKernelSize(fieldValue(node, 'Kernel Size', '3x3'));
      const padding = parseNumeric(fieldValue(node, 'Padding', '1'), 1);
      const stride = parseNumeric(fieldValue(node, 'Stride', '1'), 1);

      totalParams += channelOut * channelIn * kernelSize * kernelSize + channelOut;
      current.channels = channelOut;
      current.height = convOutputSize(current.height, kernelSize, padding, stride);
      current.width = convOutputSize(current.width, kernelSize, padding, stride);
      current.flattened = false;
      current.features = null;
      return;
    }

    if (node.type === 'pooling') {
      const poolType = fieldValue(node, 'Pool Type', 'MaxPool');
      if (poolType === 'AdaptiveAvgPool') {
        current.height = 1;
        current.width = 1;
      } else {
        const kernelSize = parseKernelSize(fieldValue(node, 'Kernel Size', '2x2'));
        const padding = parseNumeric(fieldValue(node, 'Padding', '0'), 0);
        const stride = parsePoolingStride(fieldValue(node, 'Stride', ''), kernelSize);
        current.height = convOutputSize(current.height, kernelSize, padding, stride);
        current.width = convOutputSize(current.width, kernelSize, padding, stride);
      }
      current.flattened = false;
      current.features = null;
      return;
    }

    if (node.type === 'dropout') {
      return;
    }

    const inputFeatures = current.flattened
      ? (current.features ?? current.width)
      : current.channels * current.height * current.width;
    const actualInput = parseNumeric(fieldValue(node, 'Input', String(inputFeatures)), inputFeatures);
    const outputFeatures = parseNumeric(fieldValue(node, 'Output', '128'), 128);

    totalParams += actualInput * outputFeatures + outputFeatures;
    current.flattened = true;
    current.features = outputFeatures;
  });

  return totalParams;
}

function advisedFieldClassName(hasFieldError: boolean) {
  if (!hasFieldError) {
    return '';
  }

  return '!border-[#dc2626] !bg-[#fff5f5] !text-[#b91c1c] !shadow-[0_0_0_3px_rgba(220,38,38,0.08)] focus:!border-[#dc2626] focus:!text-[#b91c1c] focus:!shadow-[0_0_0_3px_rgba(220,38,38,0.14)]';
}

function advisedSelectClassName(hasError: boolean) {
  if (!hasError) {
    return '';
  }

  return '!border-[#dc2626] !bg-[#fff5f5] !text-[#b91c1c] !shadow-[0_0_0_3px_rgba(220,38,38,0.08)] focus:!border-[#dc2626] focus:!text-[#b91c1c] focus:!shadow-[0_0_0_3px_rgba(220,38,38,0.14)]';
}

function accentTextClassName(accent: BlockAccent) {
  const palette: Record<BlockAccent, string> = {
    blue: 'text-[#2456c9]',
    amber: 'text-[#b95b16]',
    violet: 'text-[#6846bd]',
    rose: 'text-[#b43b5c]',
    emerald: 'text-[#0b7d6f]',
  };

  return palette[accent];
}

function NodeFieldInput({
  fieldLabel,
  value,
  suggestedValue,
  hasFieldError,
  inputMode,
  placeholder,
  className,
  onChange,
}: {
  fieldLabel: string;
  value: string;
  suggestedValue?: string;
  hasFieldError: boolean;
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
  placeholder?: string;
  className: string;
  onChange: (value: string) => void;
}) {
  const suggestionPlaceholder =
    hasFieldError && suggestedValue
      ? `${suggestedValue[0] ?? ''}${'_'.repeat(Math.max(suggestedValue.length - 1, 0))}`
      : placeholder;

  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      inputMode={inputMode}
      placeholder={suggestionPlaceholder}
      className={[
        className,
        hasFieldError && suggestedValue ? 'placeholder:text-[#dc2626]/45 placeholder:tracking-[0.08em]' : '',
        advisedFieldClassName(hasFieldError),
      ].join(' ')}
      aria-label={fieldLabel}
    />
  );
}

function NodeCard({
  node,
  dimensions,
  advice,
  tutorialTargetFieldLabel,
  tutorialTargetName,
  tutorialTargetActivationName,
  tutorialSecondaryTargetFieldLabel,
  tutorialSecondaryTargetFieldName,
  canRemove,
  onRemove,
  onFieldChange,
  onActivationChange,
  onDragStart,
  onDragEnd,
}: {
  node: CanvasNode;
  dimensions?: NodeDimensionInfo;
  advice?: NodeAdviceInfo;
  tutorialTargetFieldLabel?: string;
  tutorialTargetName?: string;
  tutorialTargetActivationName?: string;
  tutorialSecondaryTargetFieldLabel?: string;
  tutorialSecondaryTargetFieldName?: string;
  canRemove: boolean;
  onRemove: () => void;
  onFieldChange: (fieldLabel: string, value: string) => void;
  onActivationChange: (activation: string) => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}) {
  const isCnn = node.type === 'cnn';
  const isPooling = node.type === 'pooling';
  const isDropout = node.type === 'dropout';
  const isAdaptivePooling = isPooling && fieldValue(node, 'Pool Type', 'MaxPool') === 'AdaptiveAvgPool';
  const fieldCountLabel = `${node.fields.length} settings`;
  const poolingTypeLabel = isPooling
    ? fieldValue(node, 'Pool Type', 'MaxPool')
    : isDropout
      ? `p=${fieldValue(node, 'Probability', '0.30')}`
      : node.activation;
  const tone = blockTone(node.accent);
  const showAdvice = Boolean(advice?.hasError);
  const showAdviceBanner = showAdvice && advice?.message;
  const cardClassName = showAdvice
    ? 'bg-[#fff0f0] shadow-[0_16px_32px_rgba(220,38,38,0.14)] ring-1 ring-[#fca5a5]'
    : tone.card;
  const barClassName = showAdvice ? 'bg-[#dc2626]' : tone.bar;

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={[
        'relative w-full cursor-grab rounded-[clamp(24px,2vw,30px)] px-[clamp(12px,1vw,18px)] pb-[clamp(10px,0.9vw,16px)] pt-[clamp(12px,1vw,16px)] shadow-[0_12px_24px_rgba(13,27,51,0.08)] active:cursor-grabbing',
        cardClassName,
      ].join(' ')}
    >
      <div
        className={[
          'absolute inset-x-3 top-0 h-[7px] rounded-b-[10px] rounded-t-[999px]',
          barClassName,
        ].join(' ')}
      />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[14px] w-[72px] -translate-x-1/2 -translate-y-[35%] rounded-full border-[3px] border-background bg-white/82 shadow-[0_6px_14px_rgba(13,27,51,0.06)]" />
      <div className="pointer-events-none absolute left-1/2 bottom-[-8px] h-[16px] w-[52px] -translate-x-1/2 rounded-b-[14px] bg-background/92 shadow-[inset_0_2px_0_rgba(129,149,188,0.14)]" />

      {showAdviceBanner && advice?.message ? (
        <div className="mb-2 rounded-[18px] bg-[#fee2e2] px-[clamp(12px,1vw,14px)] py-[clamp(8px,0.8vw,10px)] text-[clamp(12px,0.95vw,13px)] font-bold text-[#b91c1c] shadow-[inset_0_0_0_1px_rgba(239,68,68,0.14)]">
          {advice.message}
        </div>
      ) : null}

      <div className="flex items-start gap-[clamp(12px,1vw,16px)] border-b border-line pb-[clamp(8px,0.8vw,10px)]">
        <div className="min-w-0 flex-1 grid gap-0.5">
          <strong className="truncate text-[clamp(15px,1.1vw,17px)] font-semibold tracking-[-0.015em] text-ink">
            {node.title}
          </strong>
          <div className="flex flex-wrap items-center gap-1">
            <span className="rounded-full bg-white/72 px-[clamp(8px,0.8vw,10px)] py-[clamp(3px,0.35vw,5px)] text-[clamp(10px,0.75vw,11px)] font-bold uppercase tracking-[0.12em] text-muted">
              {fieldCountLabel}
            </span>
            <span className="rounded-full bg-white/72 px-[clamp(8px,0.8vw,10px)] py-[clamp(3px,0.35vw,5px)] text-[clamp(10px,0.75vw,11px)] font-bold uppercase tracking-[0.12em] text-muted">
              {poolingTypeLabel}
            </span>
            {advice?.activationError && advice.activationHint ? (
              <span className="rounded-full bg-[#fee2e2] px-[clamp(8px,0.8vw,10px)] py-[clamp(3px,0.35vw,5px)] text-[clamp(10px,0.75vw,11px)] font-semibold tracking-normal text-[#b91c1c] opacity-75">
                {advice.activationHint}
              </span>
            ) : null}
          </div>
        </div>

        {dimensions ? (
          <div className="hidden min-w-0 flex-[1.15] items-center justify-end xl:flex">
            <div className="grid w-full max-w-[clamp(480px,32vw,580px)] grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 rounded-[14px] bg-[rgba(255,255,255,0.42)] px-[clamp(11px,0.95vw,13px)] py-[clamp(7px,0.6vw,9px)] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.10)]">
              <div className="shrink-0 text-[clamp(10px,0.75vw,11px)] font-extrabold uppercase tracking-[0.14em] text-muted">
                Tensor Size
              </div>
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-3 text-[clamp(11px,0.84vw,12px)] font-semibold text-ink">
                <div className="min-w-0 truncate whitespace-nowrap font-mono">
                  <span className="mr-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
                    In
                  </span>
                  {dimensions.inputLabel}
                </div>
                <div className="shrink-0 text-muted/70">→</div>
                <div className="min-w-0 truncate whitespace-nowrap text-right font-mono">
                  <span className="mr-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
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
            <div
              className="grid h-6 w-6 place-items-center rounded-full text-muted/70"
              aria-hidden="true"
            >
              <Icon name="dots" className="h-3 w-3" />
            </div>
            {canRemove ? (
              <button
                type="button"
                onClick={onRemove}
                className="grid h-7 w-7 place-items-center rounded-full bg-[#eef3ff] text-base font-bold leading-none text-muted transition-colors hover:bg-[#dbe7ff] hover:text-ink"
                aria-label={`Remove ${node.title}`}
              >
                ×
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {dimensions ? (
        <div className="mt-2 xl:hidden">
          <div className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 rounded-[14px] bg-[rgba(255,255,255,0.42)] px-[clamp(11px,0.95vw,13px)] py-[clamp(7px,0.6vw,9px)] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.10)]">
            <div className="shrink-0 text-[clamp(10px,0.75vw,11px)] font-extrabold uppercase tracking-[0.14em] text-muted">
              Tensor Size
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-3 text-[clamp(11px,0.84vw,12px)] font-semibold text-ink">
              <div className="min-w-0 truncate whitespace-nowrap font-mono">
                <span className="mr-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
                  In
                </span>
                {dimensions.inputLabel}
              </div>
              <div className="shrink-0 text-muted/70">→</div>
              <div className="min-w-0 truncate whitespace-nowrap text-right font-mono">
                <span className="mr-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
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
                className="grid min-w-0 gap-0.5 rounded-[18px] bg-white/72 px-[clamp(10px,0.9vw,12px)] py-[clamp(8px,0.75vw,10px)] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.1)]"
                data-tutorial-target={
                  tutorialTargetFieldLabel === field.label
                    ? tutorialTargetName
                    : tutorialSecondaryTargetFieldLabel === field.label
                      ? tutorialSecondaryTargetFieldName
                      : undefined
                }
              >
                <span className="text-[clamp(10px,0.75vw,11px)] font-extrabold uppercase tracking-[0.12em] text-[#44506a]">
                  {field.label}
                </span>
              <NodeFieldInput
                fieldLabel={field.label}
                value={field.value}
                suggestedValue={advice?.suggestedFields[field.label]}
                hasFieldError={Boolean(advice?.fieldErrors.includes(field.label))}
                className={[
                  'w-full min-w-0 rounded-[14px] border border-transparent bg-white px-[clamp(12px,1vw,14px)] py-[clamp(8px,0.75vw,10px)] text-[clamp(13px,0.95vw,14px)] font-semibold text-ink shadow-[inset_0_-2px_0_rgba(129,149,188,0.12)] outline-none ring-0 transition-shadow',
                  tone.focus,
                ].join(' ')}
                onChange={(nextValue) => onFieldChange(field.label, nextValue)}
              />
            </label>
          ))}
          </div>

          <div className="grid min-w-0 gap-1.5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.4fr)]">
            {node.fields.slice(3).map((field) => (
              <label
                key={field.label}
                className="grid min-w-0 gap-0.5 rounded-[18px] bg-white/72 px-[clamp(10px,0.9vw,12px)] py-[clamp(8px,0.75vw,10px)] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.1)]"
                data-tutorial-target={
                  tutorialTargetFieldLabel === field.label
                    ? tutorialTargetName
                    : tutorialSecondaryTargetFieldLabel === field.label
                      ? tutorialSecondaryTargetFieldName
                      : undefined
                }
              >
                <span className="text-[clamp(10px,0.75vw,11px)] font-extrabold uppercase tracking-[0.12em] text-[#44506a]">
                  {field.label}
                </span>
                <NodeFieldInput
                  fieldLabel={field.label}
                  value={field.value}
                  suggestedValue={advice?.suggestedFields[field.label]}
                  hasFieldError={Boolean(advice?.fieldErrors.includes(field.label))}
                  className="w-full min-w-0 rounded-[14px] border border-transparent bg-white px-[clamp(12px,1vw,14px)] py-[clamp(8px,0.75vw,10px)] text-[clamp(13px,0.95vw,14px)] font-semibold text-ink shadow-[inset_0_-2px_0_rgba(129,149,188,0.12)] outline-none ring-0 transition-shadow focus:border-primary/30 focus:shadow-[0_0_0_3px_rgba(17,81,255,0.12)]"
                  onChange={(nextValue) => onFieldChange(field.label, nextValue)}
                />
              </label>
            ))}

            <label
              className="grid gap-0.5 rounded-[18px] bg-white/72 px-[clamp(10px,0.9vw,12px)] py-[clamp(8px,0.75vw,10px)] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.1)]"
              data-tutorial-target={tutorialTargetActivationName}
            >
              <span className="shrink-0 text-[clamp(10px,0.75vw,11px)] font-extrabold uppercase tracking-[0.12em] text-[#44506a]">
                Activation Function
              </span>
              <div className="relative">
                <select
                  value={node.activation}
                  onChange={(event) => onActivationChange(event.target.value)}
                  className={[
                    'w-full appearance-none rounded-[14px] border border-transparent bg-white px-[clamp(12px,1vw,14px)] py-[clamp(8px,0.75vw,10px)] text-[clamp(13px,0.95vw,14px)] font-semibold text-ink shadow-[inset_0_-2px_0_rgba(129,149,188,0.12)] outline-none ring-0 transition-shadow',
                    tone.focus,
                    advisedSelectClassName(Boolean(advice?.activationError)),
                  ].join(' ')}
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
                  data-tutorial-target={
                    tutorialTargetFieldLabel === field.label
                      ? tutorialTargetName
                      : tutorialSecondaryTargetFieldLabel === field.label
                        ? tutorialSecondaryTargetFieldName
                        : undefined
                  }
                >
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#44506a]">
                    {field.label}
                  </span>
                  {isPoolType ? (
                    <div className="relative">
                      <select
                        value={field.value}
                        onChange={(event) => onFieldChange(field.label, event.target.value)}
                        className={[
                          'w-full appearance-none rounded-[12px] border border-transparent bg-white px-3 py-1.5 text-[13px] font-semibold text-ink shadow-[inset_0_-2px_0_rgba(129,149,188,0.12)] outline-none ring-0 transition-shadow',
                          tone.focus,
                        ].join(' ')}
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
                    <NodeFieldInput
                      fieldLabel={field.label}
                      value={field.value}
                      suggestedValue={advice?.suggestedFields[field.label]}
                      hasFieldError={Boolean(advice?.fieldErrors.includes(field.label))}
                      placeholder={field.label === 'Stride' ? 'None' : undefined}
                      className={[
                        'w-full min-w-0 rounded-[12px] border border-transparent bg-white px-3 py-1.5 text-[13px] font-semibold text-ink shadow-[inset_0_-2px_0_rgba(129,149,188,0.12)] outline-none ring-0 transition-shadow',
                        tone.focus,
                        isCompactField ? 'text-center' : '',
                      ].join(' ')}
                      onChange={(nextValue) => onFieldChange(field.label, nextValue)}
                    />
                  )}
                </label>
              );
            })}
          </div>

          <div className="flex justify-end rounded-[16px] bg-white/62 px-3 py-2 shadow-[inset_0_0_0_1px_rgba(129,149,188,0.1)]">
            {isAdaptivePooling ? (
              <div className={['rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em]', tone.chip].join(' ')}>
                Output Size 1 x 1
              </div>
            ) : (
              <div className={['rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em]', tone.chip].join(' ')}>
                Feature Map Resize
              </div>
            )}
          </div>
        </div>
      ) : isDropout ? (
        <div className="mt-2 grid gap-1.5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] xl:items-end">
          {node.fields.map((field) => (
            <label
              key={field.label}
              className="grid min-w-0 gap-0.5 rounded-[16px] bg-white/72 px-2.5 py-1.5 shadow-[inset_0_0_0_1px_rgba(129,149,188,0.1)]"
              data-tutorial-target={
                tutorialTargetFieldLabel === field.label ? tutorialTargetName : undefined
              }
            >
              <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#44506a]">
                {field.label}
              </span>
              <NodeFieldInput
                fieldLabel={field.label}
                value={field.value}
                suggestedValue={advice?.suggestedFields[field.label]}
                hasFieldError={Boolean(advice?.fieldErrors.includes(field.label))}
                inputMode="decimal"
                className={[
                  'w-full min-w-0 rounded-[12px] border border-transparent bg-white px-3 py-1.5 text-center text-[14px] font-semibold text-ink shadow-[inset_0_-2px_0_rgba(129,149,188,0.12)] outline-none ring-0 transition-shadow',
                  tone.focus,
                ].join(' ')}
                onChange={(nextValue) => onFieldChange(field.label, nextValue)}
              />
            </label>
          ))}

          <div className="flex justify-end rounded-[16px] bg-white/62 px-3 py-2 shadow-[inset_0_0_0_1px_rgba(129,149,188,0.1)]">
            <div className={['rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em]', tone.chip].join(' ')}>
              Training-Time Regularization
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-2 grid gap-1.5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.15fr)] xl:items-end">
          {node.fields.map((field) => (
            <label
              key={field.label}
              className="grid min-w-0 gap-0.5 rounded-[16px] bg-white/72 px-2.5 py-1.5 shadow-[inset_0_0_0_1px_rgba(129,149,188,0.1)]"
              data-tutorial-target={
                tutorialTargetFieldLabel === field.label ? tutorialTargetName : undefined
              }
            >
              <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#44506a]">
                {field.label}
              </span>
              <NodeFieldInput
                fieldLabel={field.label}
                value={field.value}
                suggestedValue={advice?.suggestedFields[field.label]}
                hasFieldError={Boolean(advice?.fieldErrors.includes(field.label))}
                inputMode="numeric"
                className={[
                  'w-full min-w-0 rounded-[12px] border border-transparent bg-white px-3 py-1.5 text-center text-[14px] font-semibold text-ink shadow-[inset_0_-2px_0_rgba(129,149,188,0.12)] outline-none ring-0 transition-shadow',
                  tone.focus,
                ].join(' ')}
                onChange={(nextValue) => onFieldChange(field.label, nextValue)}
              />
            </label>
          ))}

          <label
            className="grid gap-0.5 rounded-[16px] bg-white/72 px-2.5 py-1.5 shadow-[inset_0_0_0_1px_rgba(129,149,188,0.1)]"
            data-tutorial-target={tutorialTargetActivationName}
          >
            <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#44506a]">
              Activation Function
            </span>
            <div className="relative">
              <select
                value={node.activation}
                onChange={(event) => onActivationChange(event.target.value)}
                className={[
                  'w-full appearance-none rounded-[12px] border border-transparent bg-white px-3 py-1.5 text-[13px] font-semibold text-ink shadow-[inset_0_-2px_0_rgba(129,149,188,0.12)] outline-none ring-0 transition-shadow',
                  tone.focus,
                  advisedSelectClassName(Boolean(advice?.activationError)),
                ].join(' ')}
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
  const tone = blockTone('emerald');

  return (
    <article className={['relative w-full rounded-[clamp(24px,2vw,30px)] px-[clamp(8px,0.7vw,12px)] pb-[clamp(10px,0.9vw,16px)] pt-[clamp(10px,0.8vw,14px)] shadow-[0_12px_24px_rgba(13,27,51,0.08)]', tone.card].join(' ')}>
      <div className={['absolute inset-x-2 top-0 h-[7px] rounded-b-[10px] rounded-t-[999px]', tone.bar].join(' ')} />
      <div className="pointer-events-none absolute left-1/2 bottom-[-8px] h-[16px] w-[52px] -translate-x-1/2 rounded-b-[14px] bg-background/92 shadow-[inset_0_2px_0_rgba(129,149,188,0.14)]" />

      <div className="border-b border-line pb-[clamp(8px,0.8vw,10px)]">
        <strong className="truncate text-[clamp(17px,1.28vw,21px)] font-semibold tracking-[-0.02em] text-ink">
          Dataset
        </strong>
      </div>

      <div className="mt-2 grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_clamp(180px,16vw,240px)]">
        <label className="grid gap-0.5 rounded-[18px] bg-white/72 px-[clamp(10px,0.9vw,12px)] py-[clamp(8px,0.75vw,10px)] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.1)]">
          <span className="text-[clamp(10px,0.75vw,11px)] font-extrabold uppercase tracking-[0.12em] text-[#44506a]">
            Dataset
          </span>
          <div className="rounded-[14px] bg-white px-[clamp(12px,1vw,14px)] py-[clamp(8px,0.75vw,10px)] text-[clamp(13px,0.95vw,14px)] font-semibold text-ink shadow-[inset_0_-2px_0_rgba(129,149,188,0.12)]">
            {dataset.label}
          </div>
        </label>

        <label className="grid gap-0.5 rounded-[18px] bg-white/72 px-[clamp(10px,0.9vw,12px)] py-[clamp(8px,0.75vw,10px)] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.1)]">
          <span className="text-[clamp(10px,0.75vw,11px)] font-extrabold uppercase tracking-[0.12em] text-[#44506a]">
            Input shape
          </span>
          <div className="rounded-[14px] bg-white px-[clamp(12px,1vw,14px)] py-[clamp(8px,0.75vw,10px)] text-[clamp(13px,0.95vw,14px)] font-semibold text-ink shadow-[inset_0_-2px_0_rgba(129,149,188,0.12)]">
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
  tutorialTargetNodeType,
  tutorialTargetNodeOccurrence,
  tutorialTargetFieldLabel,
  tutorialTargetFieldName,
  tutorialSecondaryTargetNodeType,
  tutorialSecondaryTargetNodeOccurrence,
  tutorialSecondaryTargetFieldLabel,
  tutorialSecondaryTargetFieldName,
  tutorialTargetActivationName,
  onRemoveNode,
  isNodeRemovable,
  onUpdateNodeField,
  onUpdateNodeActivation,
  onMoveNode,
  onDropBlock,
}: CanvasProps) {
  const stackRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [trashHover, setTrashHover] = useState(false);
  const { dimensions: nodeDimensions, advice: nodeAdvice } = analyzeModelNodes(selectedDataset, nodes);
  const totalParameterCount = useMemo(
    () => estimateTotalParameterCount(selectedDataset, nodes),
    [selectedDataset, nodes],
  );
  const starterBlocks = libraryBlocks.slice(0, 4);
  const starterBlockDescriptions: Record<string, string> = {
    linear: '입력 특징을 다음 단계로 연결해 주는 기본 레이어예요.',
    cnn: '이미지의 패턴을 찾을 때 자주 쓰는 합성곱 레이어예요.',
    pooling: '특징 맵 크기를 줄여서 핵심 정보만 남겨주는 레이어예요.',
    dropout: '학습 중 일부 값을 쉬게 해서 과적합을 줄여주는 레이어예요.',
  };
  const canRemoveNode = (node: CanvasNode) => isNodeRemovable?.(node) ?? true;
  const removableNodeCount = nodes.filter(canRemoveNode).length;
  const draggingNode = nodes.find((node) => node.id === draggingNodeId) ?? null;
  const draggingNodeRemovable = draggingNode ? canRemoveNode(draggingNode) : false;

  return (
    <main
      className={[
        'ui-surface relative overflow-hidden bg-[linear-gradient(180deg,#f9fbff,#f4f8fd)]',
        nodes.length === 0 ? 'min-h-0' : 'min-h-[clamp(840px,76vh,1240px)]',
      ].join(' ')}
      data-tutorial-target="tutorial-builder-canvas"
    >
      <div className="pointer-events-none canvas-grid absolute inset-0 opacity-[0.2]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(17,81,255,0.08),transparent_42%),radial-gradient(circle_at_78%_72%,rgba(10,96,127,0.08),transparent_26%)]" />

      <div
        onDragOver={(event) => {
          event.preventDefault();

          const droppedBlock = getDroppedBlockType(event, draggingBlock);
          const draggedNodeId = getDraggedNodeId(event);

          if (!droppedBlock && !draggedNodeId) {
            setHoverIndex(null);
            return;
          }

          if (draggedNodeId) {
            setTrashHover(false);
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
          const draggedNodeId = getDraggedNodeId(event);
          const insertionIndex = getInsertionIndex(event, stackRef.current, nodes.length);

          if (draggedNodeId) {
            setHoverIndex(null);
            setDraggingNodeId(null);
            setTrashHover(false);
            onMoveNode(draggedNodeId, insertionIndex);
            return;
          }

          if (!droppedBlock) {
            return;
          }

          setHoverIndex(null);
          setTrashHover(false);
          onDropBlock(droppedBlock, insertionIndex);
        }}
        className={[
          'relative flex flex-col items-center px-1.5 pb-10 pt-5 transition-colors sm:px-2.5 xl:px-3',
          nodes.length === 0 ? 'min-h-0' : 'min-h-[clamp(860px,78vh,1280px)]',
          draggingBlock || draggingNodeId ? 'bg-primary/[0.03]' : '',
        ].join(' ')}
      >
        <div className="relative w-full overflow-hidden rounded-[32px] border border-[#dbe5f1] bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(247,250,253,0.96))] shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm">
          <div className="border-b border-[#e2e8f0] px-[clamp(16px,1.2vw,22px)] py-[18px]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="ui-section-title">Builder Canvas</div>
              <div className="rounded-full bg-[#eef3ff] px-3 py-1.5 text-[11px] font-bold text-primary">
                {nodes.length === 0 ? 'Drop blocks to begin' : `${nodes.length} layers in canvas`}
              </div>
            </div>
          </div>
          <div className="px-[clamp(10px,0.9vw,14px)] py-[clamp(20px,1.6vw,24px)]">
            <div
              ref={stackRef}
              className="flex w-full flex-col items-start transition-transform duration-150"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
            >
              <DataBlockCard dataset={selectedDataset} />

              {nodes.length === 0 ? (
                <div className="-mt-2 w-full rounded-b-[28px] border border-dashed border-primary/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,248,255,0.92))] px-[clamp(18px,1.5vw,24px)] py-[clamp(20px,1.8vw,26px)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <div className="grid content-start gap-[clamp(20px,2vw,28px)] pt-[clamp(8px,1vw,14px)]">
                    <div className="mx-auto w-full max-w-[980px] text-center">
                      <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-primary/70">
                        빌더 시작
                      </div>
                      <div className="mt-2.5 font-display text-[clamp(22px,2vw,28px)] font-bold tracking-[-0.04em] text-ink">
                        첫 번째 모델 구조를 만들어보세요
                      </div>
                      <p className="mx-auto mt-4 max-w-[920px] text-[clamp(15px,1.05vw,17px)] leading-[1.85] text-[#7a89a4]">
                        왼쪽 레이어 카드를 이 캔버스로 끌어오면 데이터 블록 아래에 바로 연결돼요.
                        보통은 CNN이나 선형 레이어부터 시작하고, 필요하면 풀링과 드롭아웃을 이어 붙이면 됩니다.
                      </p>
                    </div>

                    <div className="mx-auto grid w-full max-w-none gap-4 lg:grid-cols-4">
                      {starterBlocks.map((block) => (
                        <div
                          key={`starter-${block.id}`}
                          className="h-full min-h-[132px] rounded-[20px] bg-white/88 px-4.5 py-4.5 text-left shadow-[0_18px_38px_rgba(13,27,51,0.06)] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.1)]"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={[
                                'grid h-9 w-9 place-items-center rounded-[13px] bg-[#f5f8ff]',
                                accentTextClassName(block.accent),
                              ].join(' ')}
                            >
                              <Icon name={block.icon} className="h-4.5 w-4.5" />
                            </div>
                            <div className="font-display text-[14px] font-bold text-ink">
                              {block.title}
                            </div>
                          </div>
                          <p className="mt-3.5 text-[clamp(12.5px,0.84vw,14px)] leading-[1.6] text-[#7b89a2]">
                            {starterBlockDescriptions[block.id] ?? ''}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mx-auto mt-1 flex w-full max-w-[680px] items-center justify-center gap-3 rounded-full bg-[#eef3ff] px-5 py-3 text-center text-[clamp(15px,1vw,17px)] font-extrabold text-primary shadow-[0_14px_32px_rgba(17,81,255,0.08)]">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-primary shadow-[0_8px_18px_rgba(17,81,255,0.08)]">
                        <Icon name="play" className="h-3.5 w-3.5" />
                      </span>
                      <span>이 영역 아무 곳이나 블록을 놓으면 모델 구성이 시작됩니다.</span>
                    </div>
                  </div>
                </div>
              ) : null}

              {hoverIndex === 0 ? (
                <div className="z-10 -mt-1 mb-1 h-2.5 w-full rounded-full bg-primary/18 ring-2 ring-primary/35" />
              ) : null}

              {nodes.map((node, index) => (
                <div key={node.id} className="-mt-2.5 flex w-full flex-col items-start first:mt-0">
                  <div
                    data-node-card="true"
                    onDragOver={(event) => {
                      const draggedNodeId = getDraggedNodeId(event);
                      if (!draggedNodeId) {
                        return;
                      }

                      event.preventDefault();
                      event.stopPropagation();
                      setTrashHover(false);
                      setHoverIndex(getCardInsertionIndex(event, index));
                    }}
                    onDrop={(event) => {
                      const draggedNodeId = getDraggedNodeId(event);
                      if (!draggedNodeId) {
                        return;
                      }

                      event.preventDefault();
                      event.stopPropagation();
                      const insertionIndex = getCardInsertionIndex(event, index);
                      setDraggingNodeId(null);
                      setTrashHover(false);
                      setHoverIndex(null);
                      onMoveNode(draggedNodeId, insertionIndex);
                    }}
                    className="relative w-full rounded-[32px] transition-all duration-150"
                  >
                    {(() => {
                      const nodeOccurrenceIndex =
                        nodes.slice(0, index + 1).filter((currentNode) => currentNode.type === node.type).length - 1;
                      const isPrimaryTargetNode = tutorialTargetNodeType
                        ? node.type === tutorialTargetNodeType &&
                          nodeOccurrenceIndex === (tutorialTargetNodeOccurrence ?? 0)
                        : tutorialTargetFieldName && node.type === 'linear' && index === nodes.length - 1;
                      const isSecondaryTargetNode = tutorialSecondaryTargetNodeType
                        ? node.type === tutorialSecondaryTargetNodeType &&
                          nodeOccurrenceIndex === (tutorialSecondaryTargetNodeOccurrence ?? 0)
                        : tutorialSecondaryTargetFieldName &&
                          node.type === 'linear' &&
                          index === nodes.length - 2;

                      return (
                    <NodeCard
                      node={node}
                      dimensions={nodeDimensions[node.id]}
                      advice={nodeAdvice[node.id]}
                      tutorialTargetFieldLabel={
                        isPrimaryTargetNode
                          ? (tutorialTargetFieldLabel ?? 'Output')
                          : isSecondaryTargetNode
                            ? (tutorialSecondaryTargetFieldLabel ?? 'Output')
                          : undefined
                      }
                      tutorialTargetName={
                        isPrimaryTargetNode
                          ? tutorialTargetFieldName ?? undefined
                          : isSecondaryTargetNode
                            ? tutorialSecondaryTargetFieldName ?? undefined
                            : undefined
                      }
                      tutorialTargetActivationName={
                        isPrimaryTargetNode
                          ? tutorialTargetActivationName ?? undefined
                          : undefined
                      }
                      tutorialSecondaryTargetFieldLabel={undefined}
                      tutorialSecondaryTargetFieldName={undefined}
                      canRemove={canRemoveNode(node)}
                      onRemove={() => onRemoveNode(node.id)}
                      onFieldChange={(fieldLabel, value) =>
                        onUpdateNodeField(node.id, fieldLabel, value)
                      }
                      onActivationChange={(activation) =>
                        onUpdateNodeActivation(node.id, activation)
                      }
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('application/x-builder-node', node.id);
                        event.dataTransfer.setDragImage(event.currentTarget, 72, 24);
                        setDraggingNodeId(node.id);
                        setTrashHover(false);
                      }}
                      onDragEnd={() => {
                        setDraggingNodeId(null);
                        setHoverIndex(null);
                        setTrashHover(false);
                      }}
                    />
                      );
                    })()}
                  </div>
                  {hoverIndex === index + 1 ? (
                    <div className="z-10 my-1 h-2.5 w-full rounded-full bg-primary/18 ring-2 ring-primary/35" />
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-4 border-t border-white/60 px-5 pb-6 pt-4.5">
            <div className="rounded-full bg-[#f5f8fd] px-5 py-2.5 text-[13px] font-bold text-[#5f7088]">
              Parameters {formatParamCount(totalParameterCount)}
            </div>
            <div className="rounded-full bg-[#edf3ff] px-5 py-2.5 text-[13px] font-bold text-primary">
              블록 {nodes.length}개
            </div>
          </div>
        </div>
        {draggingBlock || draggingNodeId ? (
          <>
            <div className="pointer-events-none absolute inset-x-5 bottom-5 rounded-2xl border border-dashed border-primary/40 bg-white/88 px-4 py-3 text-center text-[14px] font-semibold text-primary shadow-[0_18px_40px_rgba(17,81,255,0.08)] backdrop-blur-md">
              {draggingNodeId
                ? draggingNodeRemovable
                  ? '블록을 원하는 위치로 옮기거나, 아래 휴지통에 놓아 삭제할 수 있어요.'
                  : '이 레슨에서는 모델 구조를 지우지 않고, 위치만 다시 정렬할 수 있어요.'
                : `${draggingBlock === 'linear' ? '선형 레이어' : draggingBlock === 'cnn' ? 'CNN 레이어' : draggingBlock === 'pooling' ? '풀링 레이어' : '드롭아웃 레이어'}를 스택 위로 끌어와 추가해보세요.`}
            </div>
            {draggingNodeId && removableNodeCount > 0 ? (
              <div
                onDragOver={(event) => {
                  if (!getDraggedNodeId(event) || !draggingNodeRemovable) {
                    return;
                  }

                  event.preventDefault();
                  event.stopPropagation();
                  setTrashHover(true);
                  setHoverIndex(null);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setTrashHover(false);
                  }
                }}
                onDrop={(event) => {
                  const droppedNodeId = getDraggedNodeId(event);
                  if (!droppedNodeId || !draggingNodeRemovable) {
                    return;
                  }

                  event.preventDefault();
                  event.stopPropagation();
                  setTrashHover(false);
                  setDraggingNodeId(null);
                  setHoverIndex(null);
                  onRemoveNode(droppedNodeId);
                }}
                className={[
                  'fixed bottom-6 left-1/2 z-[160] flex min-w-[320px] -translate-x-1/2 items-center justify-center gap-3 rounded-[22px] border px-6 py-4 text-[15px] font-bold shadow-[0_30px_72px_rgba(13,27,51,0.3)] transition-all duration-150',
                  trashHover
                    ? 'border-[#ef4444] bg-[#fff1f2] text-[#b91c1c] ring-4 ring-[#fecdd3] scale-[1.08]'
                    : 'border-[#fbcfe8] bg-white text-[#c2416d] ring-1 ring-[rgba(244,114,182,0.18)] backdrop-blur-md',
                ].join(' ')}
              >
                <span className="grid h-11 w-11 place-items-center rounded-full bg-[#fff0f4] text-[22px] leading-none shadow-[inset_0_0_0_1px_rgba(244,114,182,0.18)]">
                  🗑
                </span>
                <div className="grid gap-0.5 text-center">
                  <span>Drop here to delete</span>
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] opacity-70">
                    Trash Zone
                  </span>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
