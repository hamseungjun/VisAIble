'use client';

import type { CanvasNode, DatasetItem } from '@/types/builder';

type ModelPreviewModalProps = {
  dataset: DatasetItem;
  nodes: CanvasNode[];
  onClose: () => void;
};

function PreviewLayer({ node }: { node: CanvasNode }) {
  const isCnn = node.type === 'cnn';

  return (
    <div className="flex shrink-0 flex-col items-center gap-3">
      <div className="text-center text-sm font-semibold text-[#3bcf50]">
        {isCnn ? 'Convolutional layer' : 'Dense layer'}
      </div>
      <div className="flex items-end gap-2">
        {isCnn ? (
          <>
            <div className="h-40 w-10 rounded-[10px] border border-[#e68a8a] bg-[#f7c9c9]" />
            <div className="h-40 w-10 rounded-[10px] border border-[#e68a8a] bg-[#f7c9c9]" />
          </>
        ) : (
          <div className="h-40 w-12 rounded-[10px] border border-[#e2c56f] bg-[#ffefba]" />
        )}
      </div>
      <div className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-muted shadow-sm">
        {node.title}
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex shrink-0 items-center px-3 pt-8 text-2xl text-ink/70">
      <span>&rarr;</span>
    </div>
  );
}

export function ModelPreviewModal({ dataset, nodes, onClose }: ModelPreviewModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-[rgba(13,27,51,0.36)] backdrop-blur-sm">
      <div className="mx-auto mt-10 flex h-[calc(100vh-5rem)] w-[min(1200px,calc(100%-2rem))] flex-col overflow-hidden rounded-[32px] bg-white shadow-[0_30px_80px_rgba(13,27,51,0.22)]">
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <div className="grid gap-1">
            <strong className="font-display text-2xl font-bold text-ink">Model Preview</strong>
            <span className="text-sm text-muted">
              {dataset.label} based architecture flow
            </span>
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

        <div className="flex-1 overflow-auto px-6 py-8">
          <div className="flex min-w-max items-center gap-0">
            <div className="flex shrink-0 flex-col items-center gap-3">
              <div className="text-center text-sm font-semibold text-[#3bcf50]">Input layer</div>
              <div className="flex h-20 w-28 items-center justify-center rounded-[8px] border border-[#9fbbe8] bg-[#d9e7ff] text-sm font-bold text-ink">
                {dataset.id.toUpperCase()}
              </div>
              <div className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-muted shadow-sm">
                {dataset.inputShape ?? 'Input'}
              </div>
            </div>

            <Arrow />

            {nodes.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-line px-8 py-10 text-center text-muted">
                Add layers to generate a preview.
              </div>
            ) : (
              nodes.map((node, index) => (
                <div key={node.id} className="flex items-center">
                  <PreviewLayer node={node} />
                  <Arrow />
                  {index === nodes.length - 1 ? (
                    <div className="flex shrink-0 flex-col items-center gap-3">
                      <div className="text-center text-sm font-semibold text-[#3bcf50]">Output layer</div>
                      <div className="h-16 w-12 rounded-[10px] border border-[#f0c96d] bg-[#fff0bf]" />
                      <div className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-muted shadow-sm">
                        Prediction
                      </div>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
