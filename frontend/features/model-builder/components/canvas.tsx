'use client';

import type { DragEvent, HTMLAttributes } from 'react';
import { useRef, useState } from 'react';
import { Icon } from '@/features/model-builder/components/icons';
import { libraryBlocks } from '@/lib/constants/builder-data';
import { analyzeModelNodes, type NodeAdviceInfo, type NodeDimensionInfo } from '@/lib/model-advice';
import type { BlockAccent, BlockType, CanvasNode, DatasetItem } from '@/types/builder';

type CanvasProps = {
  selectedDataset: DatasetItem;
  nodes: CanvasNode[];
  draggingBlock: BlockType | null;
  zoom: number;
  tutorialTargetFieldName?: string | null;
  tutorialTargetActivationName?: string | null;
  onRemoveNode: (id: string) => void;
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
        'relative w-full max-w-[clamp(820px,68vw,1360px)] cursor-grab rounded-[clamp(24px,2vw,30px)] px-[clamp(12px,1vw,18px)] pb-[clamp(10px,0.9vw,16px)] pt-[clamp(12px,1vw,16px)] shadow-[0_12px_24px_rgba(13,27,51,0.08)] active:cursor-grabbing',
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
          <strong className="truncate font-display text-[clamp(15px,1.15vw,18px)] font-bold uppercase tracking-[-0.02em] text-ink">
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
          <div className="hidden min-w-0 flex-[1.2] items-center justify-end xl:flex">
            <div className="flex w-full max-w-[clamp(460px,32vw,560px)] items-center gap-3 rounded-[14px] bg-[rgba(255,255,255,0.42)] px-[clamp(10px,0.9vw,12px)] py-[clamp(7px,0.6vw,9px)] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.10)]">
              <div className="shrink-0 text-[clamp(10px,0.75vw,11px)] font-extrabold uppercase tracking-[0.14em] text-muted">
                Tensor Size
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-3 text-[clamp(11px,0.85vw,12px)] font-semibold text-ink">
                <div className="min-w-0 font-mono">
                  <span className="mr-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
                    In
                  </span>
                  {dimensions.inputLabel}
                </div>
                <div className="text-muted/70">→</div>
                <div className="min-w-0 font-mono">
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
          <div className="flex w-full items-center gap-3 rounded-[14px] bg-[rgba(255,255,255,0.42)] px-[clamp(10px,0.9vw,12px)] py-[clamp(7px,0.6vw,9px)] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.10)]">
            <div className="shrink-0 text-[clamp(10px,0.75vw,11px)] font-extrabold uppercase tracking-[0.14em] text-muted">
              Tensor Size
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-3 text-[clamp(11px,0.85vw,12px)] font-semibold text-ink">
              <div className="min-w-0 font-mono">
                <span className="mr-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
                  In
                </span>
                {dimensions.inputLabel}
              </div>
              <div className="text-muted/70">→</div>
              <div className="min-w-0 font-mono">
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

            <label className="grid gap-0.5 rounded-[18px] bg-white/72 px-[clamp(10px,0.9vw,12px)] py-[clamp(8px,0.75vw,10px)] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.1)]">
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
    <article className={['relative w-full max-w-[clamp(820px,68vw,1360px)] rounded-[clamp(24px,2vw,30px)] px-[clamp(12px,1vw,18px)] pb-[clamp(10px,0.9vw,16px)] pt-[clamp(12px,1vw,16px)] shadow-[0_12px_24px_rgba(13,27,51,0.08)]', tone.card].join(' ')}>
      <div className={['absolute inset-x-3 top-0 h-[7px] rounded-b-[10px] rounded-t-[999px]', tone.bar].join(' ')} />
      <div className="pointer-events-none absolute left-1/2 bottom-[-8px] h-[16px] w-[52px] -translate-x-1/2 rounded-b-[14px] bg-background/92 shadow-[inset_0_2px_0_rgba(129,149,188,0.14)]" />

      <div className="border-b border-line pb-[clamp(8px,0.8vw,10px)]">
        <strong className="truncate font-display text-[clamp(18px,1.35vw,22px)] font-bold tracking-[-0.03em] text-ink">
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
  tutorialTargetFieldName,
  tutorialTargetActivationName,
  onRemoveNode,
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
  const starterBlocks = libraryBlocks.slice(0, 4);

  return (
    <main
      className="ui-surface relative min-h-[clamp(840px,76vh,1240px)] overflow-hidden bg-[linear-gradient(180deg,#f9fbff,#f4f8fd)]"
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
          'relative flex min-h-[clamp(860px,78vh,1280px)] flex-col items-center px-4 pb-10 pt-5 transition-colors sm:px-6 xl:px-[clamp(24px,2vw,40px)]',
          draggingBlock || draggingNodeId ? 'bg-primary/[0.03]' : '',
        ].join(' ')}
      >
        <div className="relative w-full max-w-[clamp(920px,74vw,1480px)] overflow-hidden rounded-[32px] border border-[#dbe5f1] bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(247,250,253,0.96))] shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm">
          <div className="border-b border-[#e2e8f0] px-[clamp(20px,1.6vw,24px)] py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="ui-section-title">Builder Canvas</div>
                <div className="mt-1 text-[15px] font-semibold text-[#5f7088]">
                  블록을 쌓으면서 모델 흐름을 시각적으로 확인할 수 있는 작업 공간입니다.
                </div>
              </div>
              <div className="rounded-full bg-[#eef3ff] px-4 py-2 text-[12px] font-bold text-primary">
                {nodes.length === 0 ? 'Drop blocks to begin' : `${nodes.length} layers in canvas`}
              </div>
            </div>
          </div>
          <div className="px-[clamp(20px,1.6vw,24px)] py-[clamp(24px,2vw,28px)]">
            <div
              ref={stackRef}
              className="mx-auto flex w-full max-w-[clamp(860px,70vw,1360px)] flex-col items-start transition-transform duration-150"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
            >
              <DataBlockCard dataset={selectedDataset} />

              {nodes.length === 0 ? (
                <div className="-mt-2 w-full rounded-b-[28px] border border-dashed border-primary/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,248,255,0.92))] px-[clamp(20px,1.8vw,28px)] py-[clamp(24px,2.2vw,32px)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <div className="grid min-h-[clamp(220px,28vh,360px)] content-center gap-[clamp(20px,2vw,28px)]">
                    <div className="mx-auto max-w-[clamp(560px,58vw,760px)] text-center">
                      <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-primary/70">
                        빌더 시작
                      </div>
                      <div className="mt-3 font-display text-[clamp(24px,2.2vw,30px)] font-bold tracking-[-0.04em] text-ink">
                        첫 번째 모델 구조를 만들어보세요
                      </div>
                      <p className="mt-3 text-[clamp(14px,1.1vw,15px)] leading-[clamp(24px,1.9vw,28px)] text-[#60728d]">
                        왼쪽 레이어 카드를 이 캔버스로 끌어오면 데이터 블록 아래에 바로 연결돼요.
                        보통은 CNN이나 선형 레이어부터 시작하고, 필요하면 풀링과 드롭아웃을 이어 붙이면 됩니다.
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {starterBlocks.map((block) => (
                        <div
                          key={`starter-${block.id}`}
                          className="rounded-[22px] bg-white/88 px-4 py-4 text-left shadow-[0_18px_38px_rgba(13,27,51,0.06)] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.1)]"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={[
                                'grid h-10 w-10 place-items-center rounded-[14px] bg-[#f5f8ff]',
                                accentTextClassName(block.accent),
                              ].join(' ')}
                            >
                              <Icon name={block.icon} className="h-5 w-5" />
                            </div>
                            <div className="font-display text-[17px] font-bold text-ink">
                              {block.title}
                            </div>
                          </div>
                          <p className="mt-3 text-[13px] leading-6 text-[#677996]">
                            {block.description}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mx-auto flex items-center gap-3 rounded-full bg-[#eef3ff] px-[clamp(16px,1.4vw,20px)] py-[clamp(10px,1vw,12px)] text-[clamp(12px,1vw,13px)] font-bold text-primary shadow-[0_14px_30px_rgba(17,81,255,0.08)]">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-white">
                        <Icon name="play" className="h-4 w-4" />
                      </span>
                      이 영역 아무 곳에나 블록을 놓으면 모델 구성이 시작됩니다.
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
                    className="relative w-full max-w-[clamp(820px,68vw,1320px)] rounded-[32px] transition-all duration-150"
                  >
                    <NodeCard
                      node={node}
                      dimensions={nodeDimensions[node.id]}
                      advice={nodeAdvice[node.id]}
                      tutorialTargetFieldLabel={
                        tutorialTargetFieldName && node.type === 'linear' && index === nodes.length - 1
                          ? 'Output'
                          : undefined
                      }
                      tutorialTargetName={tutorialTargetFieldName ?? undefined}
                      tutorialTargetActivationName={
                        tutorialTargetActivationName && node.type === 'linear' && index === nodes.length - 1
                          ? tutorialTargetActivationName
                          : undefined
                      }
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
                  </div>
                  {hoverIndex === index + 1 ? (
                    <div className="z-10 my-1 h-2.5 w-full rounded-full bg-primary/18 ring-2 ring-primary/35" />
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/60 px-5 py-3.5">
            <div className="rounded-full bg-white/80 px-3.5 py-2 text-[13px] font-semibold text-muted shadow-panel">
              블록을 끌어오면 추가되고, 이미 있는 블록은 다시 끌어서 위치를 바꿀 수 있어요.
            </div>
            <div className="rounded-full bg-[#edf3ff] px-3 py-1.5 text-[13px] font-bold text-primary">
              블록 {nodes.length}개
            </div>
          </div>
        </div>
        {draggingBlock || draggingNodeId ? (
          <>
            <div className="pointer-events-none absolute inset-x-5 bottom-5 rounded-2xl border border-dashed border-primary/40 bg-white/88 px-4 py-3 text-center text-[14px] font-semibold text-primary shadow-[0_18px_40px_rgba(17,81,255,0.08)] backdrop-blur-md">
              {draggingNodeId
                ? '블록을 원하는 위치로 옮기거나, 아래 휴지통에 놓아 삭제할 수 있어요.'
                : `${draggingBlock === 'linear' ? '선형 레이어' : draggingBlock === 'cnn' ? 'CNN 레이어' : draggingBlock === 'pooling' ? '풀링 레이어' : '드롭아웃 레이어'}를 스택 위로 끌어와 추가해보세요.`}
            </div>
            {draggingNodeId ? (
              <div
                onDragOver={(event) => {
                  if (!getDraggedNodeId(event)) {
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
                  if (!droppedNodeId) {
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
