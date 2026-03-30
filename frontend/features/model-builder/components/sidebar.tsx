'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Icon } from '@/features/model-builder/components/icons';
import { datasets, libraryBlocks } from '@/lib/constants/builder-data';
import type { BlockAccent, BlockType } from '@/types/builder';

type SidebarProps = {
  selectedDatasetId: string;
  activeWorkspace: 'builder' | 'competition';
  onDatasetSelect: (datasetId: string) => void;
  onWorkspaceSelect: (workspace: 'builder' | 'competition') => void;
  onBlockDragStart: (type: BlockType) => void;
  onBlockDragEnd: () => void;
};

function accentClassName(accent: BlockAccent) {
  const palette: Record<BlockAccent, string> = {
    blue: 'text-[#2456c9]',
    amber: 'text-[#b95b16]',
    violet: 'text-[#6846bd]',
    rose: 'text-[#b43b5c]',
    emerald: 'text-[#0b7d6f]',
  };

  return palette[accent];
}

export function Sidebar({
  selectedDatasetId,
  activeWorkspace,
  onDatasetSelect,
  onWorkspaceSelect,
  onBlockDragStart,
  onBlockDragEnd,
}: SidebarProps) {
  const [hoveredDatasetId, setHoveredDatasetId] = useState<string | null>(null);
  const hoveredDataset =
    datasets.find((dataset) => dataset.id === hoveredDatasetId) ?? null;

  return (
    <aside className="flex h-full flex-col gap-5 bg-surface p-4">
      {activeWorkspace !== 'competition' ? (
        <section className="grid gap-2.5">
            <h2 className="text-[12px] font-extrabold uppercase tracking-[0.2em] text-muted">
              Dataset Selection
            </h2>
            <div className="relative grid gap-2">
              {datasets.map((dataset) => (
                <button
                  key={dataset.id}
                  type="button"
                  onClick={() => onDatasetSelect(dataset.id)}
                  onMouseEnter={() => setHoveredDatasetId(dataset.id)}
                  onMouseLeave={() => setHoveredDatasetId((current) => (current === dataset.id ? null : current))}
                  className={[
                    'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[14px] font-semibold transition-colors',
                    dataset.id === selectedDatasetId
                      ? 'bg-primary/10 text-primary'
                      : 'text-[#4b5b77] hover:bg-white/60',
                  ].join(' ')}
                >
                  <Icon name={dataset.icon} />
                  <span>{dataset.label}</span>
                </button>
              ))}

              {hoveredDataset ? (
                <div className="pointer-events-none absolute left-[calc(100%+16px)] top-0 z-30 hidden w-[360px] rounded-[22px] bg-white px-4 py-4 shadow-[0_24px_56px_rgba(13,27,51,0.18)] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.16)] xl:block">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">
                        Dataset Detail
                      </div>
                      <div className="mt-1 truncate font-display text-base font-bold text-ink">
                        {hoveredDataset.label}
                      </div>
                    </div>
                    <div className="rounded-full bg-[#eef3ff] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary">
                      {hoveredDataset.classCount ?? '-'} classes
                    </div>
                  </div>

                  <div className="grid gap-2 text-[12px] leading-5 text-[#53637f]">
                    <p>{hoveredDataset.descriptionKo}</p>
                    <p>{hoveredDataset.shapeDescriptionKo}</p>
                    <p>{hoveredDataset.classesDescriptionKo}</p>
                  </div>

                  {hoveredDataset.sampleClasses?.length ? (
                    <div className="mt-3">
                      <div className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">
                        Class Samples
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {hoveredDataset.sampleClasses.map((sample) => (
                          <div
                            key={`${hoveredDataset.id}-${sample.label}`}
                            className="overflow-hidden rounded-[16px] bg-[#f6f8ff] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.12)]"
                          >
                            {sample.imageSrc ? (
                              <div className="relative h-24 w-full">
                                <Image
                                  src={sample.imageSrc}
                                  alt={`${hoveredDataset.label} ${sample.label}`}
                                  fill
                                  unoptimized
                                  className="object-cover"
                                />
                              </div>
                            ) : (
                              <div className="grid h-24 w-full place-items-center bg-[linear-gradient(135deg,#edf3ff,#dfe8fb)] text-[13px] font-extrabold uppercase tracking-[0.12em] text-[#51627e]">
                                {sample.label}
                              </div>
                            )}
                            <div className="px-2.5 py-2 text-[11px] font-semibold text-ink">
                              {sample.label}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-[16px] bg-[#f6f8ff] px-3 py-2">
                      <div className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-muted">
                        Input Shape
                      </div>
                      <div className="mt-1 font-mono text-[12px] font-semibold text-ink">
                        {hoveredDataset.inputShape}
                      </div>
                    </div>
                    <div className="rounded-[16px] bg-[#f6f8ff] px-3 py-2">
                      <div className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-muted">
                        Class Num
                      </div>
                      <div className="mt-1 text-[12px] font-semibold text-ink">
                        {hoveredDataset.classCount ?? '-'}
                      </div>
                    </div>
                    <div className="rounded-[16px] bg-[#f6f8ff] px-3 py-2">
                      <div className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-muted">
                        Samples
                      </div>
                      <div className="mt-1 text-[12px] font-semibold text-ink">
                        {hoveredDataset.records}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
      ) : null}

      <section className="sticky top-4 grid content-start gap-2.5 self-start">
          <h2 className="text-[12px] font-extrabold uppercase tracking-[0.2em] text-muted">
            Block Library
          </h2>
          <div className="grid gap-2.5">
            {libraryBlocks.map((block) => (
              <button
                key={block.id}
                type="button"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'copy';
                  event.dataTransfer.setData('application/x-builder-block', block.id);
                  event.dataTransfer.setData('text/plain', block.id);
                  onBlockDragStart(block.id);
                }}
                onDragEnd={onBlockDragEnd}
                className="ghost-border flex cursor-grab items-start gap-3 rounded-[20px] bg-white/85 px-3.5 py-4 text-left shadow-[0_12px_28px_rgba(13,27,51,0.05)] transition-transform hover:-translate-y-0.5 active:cursor-grabbing"
              >
                <div
                  className={[
                    'grid h-7 w-7 place-items-center',
                    accentClassName(block.accent),
                  ].join(' ')}
                >
                  <Icon name={block.icon} />
                </div>
                <div className="grid gap-1">
                  <h3 className="font-display text-base font-bold text-ink">{block.title}</h3>
                  <p className="text-[13px] leading-5 text-muted">{block.description}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

      <section className="mt-auto grid gap-1 pt-3">
        <button
          type="button"
          onClick={() => onWorkspaceSelect('competition')}
          className={[
            'flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors',
            activeWorkspace === 'competition'
              ? 'bg-primary/10 text-primary'
              : 'text-muted hover:bg-white/60',
          ].join(' ')}
        >
          <Icon name="rocket" />
          <span className="text-[14px] font-semibold">Competition</span>
        </button>
        <button
          type="button"
          onClick={() => onWorkspaceSelect('builder')}
          className={[
            'flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors',
            activeWorkspace === 'builder'
              ? 'bg-white/70 text-[#41526d]'
              : 'text-muted hover:bg-white/60',
          ].join(' ')}
        >
          <Icon name="check" />
          <span className="text-[14px] font-semibold">Training Mode</span>
          <span className="ml-auto h-2 w-2 rounded-full bg-emerald-400" />
        </button>
      </section>
    </aside>
  );
}
