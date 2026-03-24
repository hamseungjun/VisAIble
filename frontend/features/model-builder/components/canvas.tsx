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

function getDroppedBlockType(event: React.DragEvent, fallback: BlockType | null) {
  const droppedBlock = event.dataTransfer.getData('application/x-builder-block');

  if (droppedBlock === 'linear' || droppedBlock === 'cnn') {
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

function NodeCard({
  node,
  onRemove,
  onFieldChange,
  onActivationChange,
}: {
  node: CanvasNode;
  onRemove: () => void;
  onFieldChange: (fieldLabel: string, value: string) => void;
  onActivationChange: (activation: string) => void;
}) {
  const isCnn = node.type === 'cnn';
  const fieldCountLabel = `${node.fields.length} settings`;

  return (
    <article
      className={[
        'relative w-full max-w-[680px] rounded-[28px] px-3.5 pb-2.5 pt-3 shadow-[0_12px_24px_rgba(13,27,51,0.08)]',
        node.accent === 'primary' ? 'bg-panel/95' : 'bg-[#ffe7da]',
      ].join(' ')}
    >
      <div
        className={[
          'absolute inset-x-3 top-0 h-[7px] rounded-b-[10px] rounded-t-[999px]',
          node.accent === 'primary' ? 'bg-primary' : 'bg-[#e68252]',
        ].join(' ')}
      />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[14px] w-[72px] -translate-x-1/2 -translate-y-[35%] rounded-full border-[3px] border-background bg-white/82 shadow-[0_6px_14px_rgba(13,27,51,0.06)]" />
      <div className="pointer-events-none absolute left-1/2 bottom-[-8px] h-[16px] w-[52px] -translate-x-1/2 rounded-b-[14px] bg-background/92 shadow-[inset_0_2px_0_rgba(129,149,188,0.14)]" />

      <div className="flex items-start justify-between gap-2 border-b border-line pb-1.5">
        <div className="min-w-0 grid gap-0.5">
          <strong className="truncate font-display text-[13px] font-bold uppercase tracking-[-0.02em] text-ink">
            {node.title}
          </strong>
          <div className="flex flex-wrap gap-1">
            <span className="rounded-full bg-white/72 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-muted">
              {fieldCountLabel}
            </span>
            <span className="rounded-full bg-white/72 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-muted">
              {node.activation}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
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
    <article className="relative w-full max-w-[680px] rounded-[28px] bg-[#d9f3ef] px-3.5 pb-2.5 pt-3 shadow-[0_12px_24px_rgba(13,27,51,0.08)]">
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

  return (
    <main className="relative min-h-[680px] overflow-hidden bg-background">
      <div className="canvas-grid absolute inset-0 opacity-35" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(17,81,255,0.06),transparent_42%),radial-gradient(circle_at_78%_72%,rgba(10,96,127,0.1),transparent_26%)]" />

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
          'relative flex min-h-[680px] flex-col items-center px-4 pb-10 pt-8 transition-colors sm:px-8',
          draggingBlock ? 'bg-primary/[0.03]' : '',
        ].join(' ')}
      >
        <div className="relative w-full max-w-[900px] overflow-hidden rounded-[32px] border border-white/50 bg-white/28 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-sm">
          <div className="px-5 py-5">
            <div
              ref={stackRef}
              className="mx-auto flex max-w-[680px] flex-col items-center transition-transform duration-150"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
            >
              <DataBlockCard dataset={selectedDataset} />

              {nodes.length === 0 ? (
                <div className="-mt-2 w-full rounded-b-[24px] border border-dashed border-primary/25 bg-white/72 px-5 py-6 text-center text-[13px] font-semibold text-muted">
                  Drag a layer anywhere into this stack to attach it under the data block.
                </div>
              ) : null}

              {hoverIndex === 0 ? (
                <div className="z-10 -mt-1 mb-1 h-2.5 w-full max-w-[680px] rounded-full bg-primary/18 ring-2 ring-primary/35" />
              ) : null}

              {nodes.map((node, index) => (
                <div key={node.id} className="-mt-2.5 flex w-full flex-col items-center first:mt-0">
                  <div data-node-card="true" className="w-full">
                    <NodeCard
                      node={node}
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
                    <div className="z-10 my-1 h-2.5 w-full max-w-[680px] rounded-full bg-primary/18 ring-2 ring-primary/35" />
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
            Drag anywhere on the stack to place {draggingBlock === 'linear' ? 'Linear Layer' : 'CNN Layer'}
          </div>
        ) : null}
      </div>
    </main>
  );
}
