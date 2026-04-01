'use client';

import { useEffect, useRef } from 'react';

type FeatureMapPanelProps = {
  nodeId: string | null;
  inputImage: number[][] | null;
  data: {
    featureMaps: number[][][];
    filters: number[][][];
  } | null;
};

function renderToCanvas(canvas: HTMLCanvasElement, pixels: number[][] | number[][][], type: 'activation' | 'weight' | 'grayscale') {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;

  // Determine if it's RGB (3D) or Single Channel (2D)
  const isRGB = Array.isArray(pixels[0]) && Array.isArray(pixels[0][0]);
  
  let h = 0;
  let w = 0;
  
  if (isRGB) {
    const p3d = pixels as number[][][];
    h = p3d[0].length;
    w = p3d[0][0].length;
  } else {
    const p2d = pixels as number[][];
    h = p2d.length;
    w = p2d[0]?.length || 0;
  }

  if (h === 0 || w === 0) return;

  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }

  const imgData = ctx.createImageData(w, h);
  const data = imgData.data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;

      if (isRGB) {
        const p3d = pixels as number[][][];
        // p3d is [C, H, W]
        data[idx] = p3d[0][y][x];     // R
        data[idx + 1] = p3d[1][y][x]; // G
        data[idx + 2] = p3d[2][y][x]; // B
      } else {
        const p2d = pixels as number[][];
        const val = p2d[y][x];
        
        if (type === 'activation') {
          data[idx] = Math.round(val * 0.8 + 20);     // R
          data[idx + 1] = Math.round(val * 0.9 + 10); // G
          data[idx + 2] = Math.round(150 - val * 0.4); // B
        } else if (type === 'grayscale') {
          data[idx] = val;
          data[idx + 1] = val;
          data[idx + 2] = val;
        } else {
          if (val > 128) {
            const intensity = (val - 128) * 2;
            data[idx] = 255;
            data[idx + 1] = 255 - intensity;
            data[idx + 2] = 255 - intensity;
          } else {
            const intensity = (128 - val) * 2;
            data[idx] = 255 - intensity;
            data[idx + 1] = 255 - intensity;
            data[idx + 2] = 255;
          }
        }
      }
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

export function FeatureMapPanel({ nodeId, inputImage, data }: FeatureMapPanelProps) {
  const inputRef = useRef<HTMLCanvasElement>(null);
  const fMapRefs = [useRef<HTMLCanvasElement>(null)];
  const filterRefs = [useRef<HTMLCanvasElement>(null)];

  useEffect(() => {
    if (!nodeId || !data) return;

    if (inputImage && inputRef.current) {
      renderToCanvas(inputRef.current, inputImage, 'grayscale');
    }

    if (data.featureMaps[0] && fMapRefs[0].current) {
      renderToCanvas(fMapRefs[0].current, data.featureMaps[0], 'grayscale');
    }

    data.filters.forEach((filter, i) => {
      if (filterRefs[i].current) renderToCanvas(filterRefs[i].current!, filter, 'grayscale');
    });
  }, [nodeId, inputImage, data]);

  if (!nodeId) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 h-16 w-16 rounded-full bg-[#f3f6fd] flex items-center justify-center text-[#315dc8]/40">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
        </div>
        <div className="font-display text-[18px] font-bold text-[#12213f]">No Layer Selected</div>
        <p className="mt-2 text-sm text-[#7b8da9]">Click a Conv layer on the left to see its real-time feature maps and filter weights.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-8 p-6">
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#7b8da9]">Visualization</div>
            <div className="mt-1 font-display text-[20px] font-bold text-[#12213f]">Feature Map</div>
          </div>
          <div className="rounded-full bg-[#eef3ff] px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#315dc8]">interactive sync</div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="group relative overflow-hidden rounded-[24px] border border-[rgba(129,149,188,0.14)] bg-white/60 p-3 shadow-sm transition-all hover:bg-white hover:shadow-md">
            <div className="mb-2 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#7b8da9]">Input Image</div>
            <div className="aspect-square w-full overflow-hidden rounded-[16px] bg-black">
              <canvas 
                ref={inputRef} 
                className="h-full w-full object-contain opacity-80" 
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
          </div>
          <div className="group relative overflow-hidden rounded-[24px] border border-[rgba(129,149,188,0.14)] bg-white/60 p-3 shadow-sm transition-all hover:bg-white hover:shadow-md">
            <div className="mb-2 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#7b8da9]">Feature Map</div>
            <div className="aspect-square w-full overflow-hidden rounded-[16px] bg-black">
              <canvas 
                ref={fMapRefs[0]} 
                className="h-full w-full object-contain opacity-90" 
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#7b8da9]">Weights</div>
            <div className="mt-1 font-display text-[20px] font-bold text-[#12213f]">Filters (Kernels)</div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {[0].map((i) => (
            <div key={`filter-${i}`} className="group relative overflow-hidden rounded-[24px] border border-[rgba(129,149,188,0.14)] bg-white/60 p-3 shadow-sm transition-all hover:bg-white hover:shadow-md max-w-[200px]">
              <div className="mb-2 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#7b8da9]">Filter</div>
              <div className="aspect-square w-full overflow-hidden rounded-[16px] bg-black">
                <canvas 
                  ref={filterRefs[i]} 
                  className="h-full w-full object-contain opacity-90" 
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
