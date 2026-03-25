'use client';

import { Icon } from '@/features/model-builder/components/icons';
import { datasets, libraryBlocks } from '@/lib/constants/builder-data';
import type { BlockType } from '@/types/builder';

type SidebarProps = {
  selectedDatasetId: string;
  onDatasetSelect: (datasetId: string) => void;
  onBlockDragStart: (type: BlockType) => void;
  onBlockDragEnd: () => void;
};

export function Sidebar({
  selectedDatasetId,
  onDatasetSelect,
  onBlockDragStart,
  onBlockDragEnd,
}: SidebarProps) {
  return (
    <aside className="flex h-full flex-col gap-5 bg-surface p-4">
      <section className="grid gap-2.5">
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-muted">
          Dataset Selection
        </h2>
        <div className="grid gap-2">
          {datasets.map((dataset) => (
            <button
              key={dataset.id}
              type="button"
              onClick={() => onDatasetSelect(dataset.id)}
              className={[
                'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[13px] font-semibold transition-colors',
                dataset.id === selectedDatasetId
                  ? 'bg-primary/10 text-primary'
                  : 'text-[#4b5b77] hover:bg-white/60',
              ].join(' ')}
            >
              <Icon name={dataset.icon} />
              <span>{dataset.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="sticky top-4 grid content-start gap-2.5 self-start">
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-muted">
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
                  block.accent === 'primary' ? 'text-primary' : 'text-tertiary',
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
        <button type="button" className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-muted hover:bg-white/60">
          <Icon name="help" />
          <span className="text-[13px] font-semibold">Help Center</span>
        </button>
        <button type="button" className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-muted hover:bg-white/60">
          <Icon name="check" />
          <span className="text-[13px] font-semibold">System Status</span>
          <span className="ml-auto h-2 w-2 rounded-full bg-emerald-400" />
        </button>
      </section>
    </aside>
  );
}
