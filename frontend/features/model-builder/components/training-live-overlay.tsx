'use client';

import { useEffect, useRef } from 'react';
import type { CanvasNode, DatasetItem, TrainingJobStatus } from '@/types/builder';

type TrainingLiveOverlayProps = {
  dataset: DatasetItem;
  nodes: CanvasNode[];
  trainingStatus: TrainingJobStatus | null;
  isAvailable: boolean;
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
};

type OverlayStage = {
  id: string;
  kind: 'input' | 'cnn' | 'pooling' | 'dropout' | 'flatten' | 'linear' | 'output';
  label: string;
  meta: string;
  accent: string;
  size: {
    width: number;
    height: number;
    depth: number;
  };
};

function fieldValue(node: CanvasNode, label: string, fallback: string) {
  return node.fields.find((field) => field.label === label)?.value ?? fallback;
}

function parseShape(shape?: string) {
  const values = (shape ?? '1 x 1 x 1')
    .split('x')
    .map((item) => Number(item.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (values.length === 3) {
    return { channels: values[0], height: values[1], width: values[2] };
  }

  if (values.length === 1) {
    return { channels: 1, height: 1, width: values[0] };
  }

  return { channels: 1, height: values[0] ?? 1, width: values[1] ?? 1 };
}

function convOutput(size: number, kernel: number, padding: number, stride: number) {
  return Math.max(1, Math.floor((size + padding * 2 - kernel) / stride + 1));
}

function normalizeKernel(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes('x')) {
    return Number(normalized.split('x')[0]?.trim() ?? '1');
  }
  return Number(normalized || '1');
}

function buildOverlayStages(dataset: DatasetItem, nodes: CanvasNode[]): OverlayStage[] {
  const input = parseShape(dataset.inputShape);
  const stages: OverlayStage[] = [
    {
      id: `${dataset.id}-input`,
      kind: 'input',
      label: 'Input',
      meta: `${input.channels}x${input.height}x${input.width}`,
      accent: 'emerald',
      size: { width: 62, height: 62, depth: 2 },
    },
  ];

  let channels = input.channels;
  let height = input.height;
  let width = input.width;
  let flattened = false;

  nodes.forEach((node, index) => {
    if (node.type === 'cnn') {
      const outChannels = Number(fieldValue(node, 'Channel Out', String(channels)));
      const kernel = normalizeKernel(fieldValue(node, 'Kernel Size', '3x3'));
      const padding = Number(fieldValue(node, 'Padding', '1'));
      const stride = Number(fieldValue(node, 'Stride', '1'));
      height = convOutput(height, kernel, padding, stride);
      width = convOutput(width, kernel, padding, stride);
      channels = outChannels;
      flattened = false;
      stages.push({
        id: node.id,
        kind: 'cnn',
        label: `Conv ${index + 1}`,
        meta: `${channels}c ${height}x${width}`,
        accent: 'amber',
        size: {
          width: Math.max(58, Math.min(120, 40 + Math.sqrt(width) * 9)),
          height: Math.max(42, Math.min(108, 24 + Math.sqrt(height) * 8)),
          depth: Math.max(3, Math.min(8, Math.ceil(Math.log2(channels + 1)))),
        },
      });
      return;
    }

    if (node.type === 'pooling') {
      const poolType = fieldValue(node, 'Pool Type', 'MaxPool');
      if (poolType === 'AdaptiveAvgPool') {
        height = 1;
        width = 1;
      } else {
        const kernel = normalizeKernel(fieldValue(node, 'Kernel Size', '2x2'));
        const padding = Number(fieldValue(node, 'Padding', '0'));
        const rawStride = fieldValue(node, 'Stride', '').trim();
        const stride = rawStride === '' || rawStride.toLowerCase() === 'none' ? kernel : Number(rawStride);
        height = convOutput(height, kernel, padding, stride);
        width = convOutput(width, kernel, padding, stride);
      }
      flattened = false;
      stages.push({
        id: node.id,
        kind: 'pooling',
        label: 'Pool',
        meta: `${height}x${width}`,
        accent: 'violet',
        size: {
          width: Math.max(48, Math.min(84, 28 + Math.sqrt(width) * 7)),
          height: Math.max(18, Math.min(36, 10 + Math.sqrt(height) * 3)),
          depth: 3,
        },
      });
      return;
    }

    if (node.type === 'dropout') {
      stages.push({
        id: node.id,
        kind: 'dropout',
        label: 'Dropout',
        meta: `p ${fieldValue(node, 'Probability', '0.30')}`,
        accent: 'rose',
        size: { width: 42, height: 84, depth: 1 },
      });
      return;
    }

    if (node.type === 'linear') {
      if (!flattened) {
        const features = channels * height * width;
        stages.push({
          id: `${node.id}-flatten`,
          kind: 'flatten',
          label: 'Flatten',
          meta: `${features}f`,
          accent: 'emerald',
          size: { width: 22, height: 74, depth: 1 },
        });
        width = features;
        height = 1;
        channels = 1;
        flattened = true;
      }

      const output = Number(fieldValue(node, 'Output', '128'));
      stages.push({
        id: node.id,
        kind: index === nodes.length - 1 ? 'output' : 'linear',
        label: index === nodes.length - 1 ? 'Output' : `Linear ${index + 1}`,
        meta: `${output}n`,
        accent: 'blue',
        size: {
          width: 22,
          height: Math.max(54, Math.min(138, 48 + Math.log10(output + 1) * 36)),
          depth: 1,
        },
      });
      width = output;
      height = 1;
      channels = 1;
    }
  });

  return stages;
}

function stagePalette(accent: string) {
  if (accent === 'amber') {
    return {
      border: 'border-[#f2b37d]',
      fill: 'bg-[linear-gradient(180deg,#fffaf4_0%,#fff1e4_100%)]',
      glow: 'shadow-[0_18px_40px_rgba(229,137,57,0.18)]',
      text: 'text-[#b25b1f]',
    };
  }

  if (accent === 'violet') {
    return {
      border: 'border-[#c5b6ff]',
      fill: 'bg-[linear-gradient(180deg,#faf7ff_0%,#f1ebff_100%)]',
      glow: 'shadow-[0_18px_40px_rgba(123,90,214,0.16)]',
      text: 'text-[#6746bd]',
    };
  }

  if (accent === 'rose') {
    return {
      border: 'border-[#f0b6c4]',
      fill: 'bg-[linear-gradient(180deg,#fff8fb_0%,#fff0f4_100%)]',
      glow: 'shadow-[0_18px_40px_rgba(212,90,122,0.16)]',
      text: 'text-[#b43b5c]',
    };
  }

  if (accent === 'blue') {
    return {
      border: 'border-[#bfd1ff]',
      fill: 'bg-[linear-gradient(180deg,#f7faff_0%,#eef4ff_100%)]',
      glow: 'shadow-[0_18px_40px_rgba(17,81,255,0.16)]',
      text: 'text-[#315dc8]',
    };
  }

  return {
    border: 'border-[#bfe4d9]',
    fill: 'bg-[linear-gradient(180deg,#f5fffb_0%,#eafaf4_100%)]',
    glow: 'shadow-[0_18px_40px_rgba(22,155,138,0.14)]',
    text: 'text-[#0b7d6f]',
  };
}

function renderToCanvas(
  canvas: HTMLCanvasElement,
  pixels: number[][] | number[][][],
  type: 'grayscale',
) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    return;
  }

  const isRgb = Array.isArray(pixels[0]) && Array.isArray((pixels as number[][][])[0]?.[0]);
  let height = 0;
  let width = 0;

  if (isRgb) {
    const p3d = pixels as number[][][];
    height = p3d[0]?.length ?? 0;
    width = p3d[0]?.[0]?.length ?? 0;
  } else {
    const p2d = pixels as number[][];
    height = p2d.length;
    width = p2d[0]?.length ?? 0;
  }

  if (height === 0 || width === 0) {
    return;
  }

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const image = ctx.createImageData(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      if (isRgb) {
        const p3d = pixels as number[][][];
        image.data[idx] = p3d[0][y][x];
        image.data[idx + 1] = p3d[1][y][x];
        image.data[idx + 2] = p3d[2][y][x];
      } else {
        const p2d = pixels as number[][];
        const value = p2d[y][x];
        image.data[idx] = value;
        image.data[idx + 1] = value;
        image.data[idx + 2] = value;
      }
      image.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
}

function FeatureMapPreview({
  inputImage,
  featureMap,
}: {
  inputImage: number[][] | null;
  featureMap: number[][] | null;
}) {
  const inputRef = useRef<HTMLCanvasElement>(null);
  const featureMapRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (inputImage && inputRef.current) {
      renderToCanvas(inputRef.current, inputImage, 'grayscale');
    }
  }, [inputImage]);

  useEffect(() => {
    if (featureMap && featureMapRef.current) {
      renderToCanvas(featureMapRef.current, featureMap, 'grayscale');
    }
  }, [featureMap]);

  return (
    <div className="grid h-full gap-3 rounded-[24px] border border-[rgba(129,149,188,0.14)] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(245,248,255,0.92))] p-4 shadow-[0_18px_40px_rgba(13,27,51,0.08)]">
      <div>
        <div className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#7b8da9]">
          Feature Map
        </div>
        <div className="mt-1 text-[13px] font-semibold leading-5 text-[#52637e]">
          이 Conv 레이어가 현재 입력 이미지에서 잡아낸 대표 특징입니다.
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex h-full flex-col rounded-[18px] border border-[rgba(129,149,188,0.12)] bg-white p-3">
          <div className="mb-2 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#7b8da9]">
            Input
          </div>
          <div className="flex-1 overflow-hidden rounded-[14px] bg-black">
            <canvas
              ref={inputRef}
              className="h-full w-full object-contain"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
        </div>
        <div className="flex h-full flex-col rounded-[18px] border border-[rgba(129,149,188,0.12)] bg-white p-3">
          <div className="mb-2 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#7b8da9]">
            Activation
          </div>
          <div className="flex-1 overflow-hidden rounded-[14px] bg-white">
            {featureMap ? (
              <canvas
                ref={featureMapRef}
                className="h-full w-full object-contain"
                style={{ imageRendering: 'pixelated' }}
                />
              ) : (
                <div className="flex h-full items-center justify-center px-3 text-center text-[11px] font-semibold text-[#7b8da9]">
                  학습이 시작되면 feature map이 여기에 나타납니다.
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StageFigure({ stage, isLast }: { stage: OverlayStage; isLast: boolean }) {
  const palette = stagePalette(stage.accent);
  let visual: JSX.Element;

  if (stage.kind === 'cnn') {
    visual = (
      <div className="relative" style={{ width: stage.size.width + (stage.size.depth - 1) * 8, height: stage.size.height + (stage.size.depth - 1) * 6 }}>
        {Array.from({ length: stage.size.depth }).map((_, index) => (
          <div
            key={`${stage.id}-${index}`}
            className={[
              'absolute rounded-[14px] border',
              palette.border,
              palette.fill,
              palette.glow,
            ].join(' ')}
            style={{
              width: stage.size.width,
              height: stage.size.height,
              left: index * 8,
              top: (stage.size.depth - 1 - index) * 6,
              opacity: 0.42 + index * 0.09,
            }}
          />
        ))}
      </div>
    );
  } else if (stage.kind === 'pooling') {
    visual = (
      <div className="relative" style={{ width: stage.size.width + 16, height: stage.size.height + 18 }}>
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`${stage.id}-${index}`}
            className={[
              'absolute rounded-full border',
              palette.border,
              palette.fill,
              palette.glow,
            ].join(' ')}
            style={{ width: stage.size.width, height: stage.size.height, left: index * 7, top: (2 - index) * 6 }}
          />
        ))}
      </div>
    );
  } else if (stage.kind === 'dropout') {
    visual = (
      <div className={['relative rounded-[14px] border border-dashed', palette.border, palette.fill, palette.glow].join(' ')} style={{ width: stage.size.width, height: stage.size.height }}>
        <span className="absolute left-[10px] top-[16px] h-2.5 w-2.5 rounded-full bg-[#d45a7a]" />
        <span className="absolute right-[10px] top-[34px] h-2.5 w-2.5 rounded-full bg-[#d45a7a]/40" />
        <span className="absolute left-[12px] bottom-[18px] h-2.5 w-2.5 rounded-full bg-[#d45a7a]" />
      </div>
    );
  } else if (stage.kind === 'flatten') {
    visual = (
      <div className="flex flex-col items-center gap-2">
        <div className="h-12 w-[2px] rounded-full bg-[#43b7a5]" />
        <div className="rounded-full border border-[#86ccb9] bg-[#ecfffa] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#0b7d6f] shadow-[0_10px_22px_rgba(11,125,111,0.18)]">
          vec
        </div>
      </div>
    );
  } else if (stage.kind === 'linear' || stage.kind === 'output') {
    visual = (
      <div className={['rounded-[12px] border', palette.border, palette.fill, palette.glow].join(' ')} style={{ width: stage.size.width, height: stage.size.height }} />
    );
  } else {
    visual = (
      <div className={['rounded-[14px] border', palette.border, palette.fill, palette.glow].join(' ')} style={{ width: stage.size.width, height: stage.size.height }} />
    );
  }

  return (
    <div className="relative pl-7 transition-all">
      {!isLast ? <div className="absolute bottom-[-40px] left-[17px] top-[60px] w-px bg-[linear-gradient(180deg,rgba(17,81,255,0.36),rgba(17,81,255,0.08))]" /> : null}
      <div className="absolute left-0 top-[50px] h-9 w-9 rounded-full border border-[rgba(17,81,255,0.12)] bg-white text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#315dc8] shadow-[0_12px_26px_rgba(13,27,51,0.08)] flex items-center justify-center">
        {isLast ? '✓' : ''}
      </div>
      <div 
        className={[
          'rounded-[26px] border px-5 py-4 shadow-[0_20px_48px_rgba(13,27,51,0.08)] backdrop-blur-sm transition-all',
          'border-[rgba(129,149,188,0.14)] bg-white/88'
        ].join(' ')}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#7b8da9]">{stage.kind}</div>
            <div className="mt-1.5 font-display text-[18px] font-bold leading-none text-[#12213f]">{stage.label}</div>
          </div>
          <div className="flex min-h-[88px] min-w-[98px] items-center justify-center">{visual}</div>
        </div>
        <div className="mt-3 inline-flex rounded-full bg-[#f3f6fd] px-3 py-1 text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#506587]">
          {stage.meta}
        </div>
      </div>
    </div>
  );
}

export function TrainingLiveOverlay({ dataset, nodes, trainingStatus, isAvailable, isOpen, onClose, onOpen }: TrainingLiveOverlayProps) {
  const stages = buildOverlayStages(dataset, nodes);
  const shouldShowOpen = isAvailable;

  if (!isOpen) {
    return shouldShowOpen ? (
      <div className="pointer-events-none absolute inset-0 z-20">
        <div className="pointer-events-auto absolute right-4 top-4">
          <button
            type="button"
            onClick={onOpen}
            className="rounded-full border border-[rgba(17,81,255,0.14)] bg-white/92 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#1151ff] shadow-[0_18px_40px_rgba(13,27,51,0.12)] backdrop-blur-sm"
          >
            Open
          </button>
        </div>
      </div>
    ) : null;
  }

  return (
    <div className="absolute inset-0 z-20 overflow-hidden rounded-[30px] border border-[rgba(129,149,188,0.14)] bg-[linear-gradient(135deg,rgba(247,250,255,0.98),rgba(238,243,255,0.98))] shadow-[0_30px_80px_rgba(13,27,51,0.14)] backdrop-blur-sm">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(17,81,255,0.08),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(22,155,138,0.08),transparent_28%)]" />
      <div className="relative flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-[rgba(129,149,188,0.12)] px-6 py-5">
          <div>
            <div className="font-display text-[28px] font-bold text-[#12213f]">Live Training View</div>
            <div className="mt-1 text-sm text-[#6d7f9d]">Architecture flow with feature maps attached to each Conv stage.</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-white/86 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#315dc8] shadow-[0_14px_30px_rgba(13,27,51,0.08)]">
              {trainingStatus?.status ?? 'ready'}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-11 w-11 place-items-center rounded-full bg-white/92 text-[24px] leading-none text-[#7b8da9] shadow-[0_14px_30px_rgba(13,27,51,0.08)] transition-colors hover:text-[#12213f]"
              aria-label="Close live training view"
            >
              ×
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          <section className="min-h-0 h-full overflow-auto px-6 py-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#7b8da9]">Model Architecture</div>
              </div>
              <div className="rounded-full bg-white/86 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#0b7d6f] shadow-[0_14px_30px_rgba(13,27,51,0.08)]">
                {stages.length} stages
              </div>
            </div>
            <div className="grid gap-5 pb-8">
              {stages.map((stage, index) => (
                <div
                  key={stage.id}
                  className={[
                    'grid gap-4',
                    stage.kind === 'cnn' ? 'xl:grid-cols-[minmax(280px,420px)_minmax(320px,1fr)] xl:items-stretch' : '',
                  ].join(' ')}
                >
                  <StageFigure stage={stage} isLast={index === stages.length - 1} />
                  {stage.kind === 'cnn' ? (
                    <FeatureMapPreview
                      inputImage={trainingStatus?.convVizInput ?? null}
                      featureMap={trainingStatus?.convVisualizations?.[stage.id]?.featureMaps?.[0] ?? null}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
