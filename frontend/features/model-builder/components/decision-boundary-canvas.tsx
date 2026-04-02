'use client';

import { useEffect, useRef, useState } from 'react';

type BoundaryAnchor = { x: number; y: number; label: number };

type DecisionBoundaryCanvasProps = {
  anchors: BoundaryAnchor[];
  predictions: number[] | null | undefined;
  classLabels?: string[] | null;
  className?: string;
};

const CLASS_COLORS: Record<number, string> = {
  0: '#ff6b6b',
  1: '#ff8a4c',
  2: '#f7b733',
  3: '#9ad94f',
  4: '#31c48d',
  5: '#22c7d6',
  6: '#4c8dff',
  7: '#6d6bff',
  8: '#c26bff',
  9: '#5b6b82',
};

const CLASS_COLORS_RGB: Record<number, [number, number, number]> = {
  0: [255, 107, 107],
  1: [255, 138, 76],
  2: [247, 183, 51],
  3: [154, 217, 79],
  4: [49, 196, 141],
  5: [34, 199, 214],
  6: [76, 141, 255],
  7: [109, 107, 255],
  8: [194, 107, 255],
  9: [91, 107, 130],
};

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mixChannel(color: number, base: number, tintStrength: number) {
  return Math.round(color * tintStrength + base * (1 - tintStrength));
}

export function DecisionBoundaryCanvas({ anchors, predictions, classLabels, className = '' }: DecisionBoundaryCanvasProps) {
  const bottomCanvasRef = useRef<HTMLCanvasElement>(null);
  const topCanvasRef = useRef<HTMLCanvasElement>(null);
  const [activeIdx, setActiveIdx] = useState<0 | 1>(1); // Top starts fully covering bottom
  const activeIdxRef = useRef<0 | 1>(1);

  // Transition locking mechanism to avoid rapid draw stuttering
  const isTransitioning = useRef(false);
  const pendingProps = useRef<{ anchors: BoundaryAnchor[]; predictions: number[] | null | undefined } | null>(null);

  useEffect(() => {
    if (!bottomCanvasRef.current || !topCanvasRef.current || anchors.length === 0) return;

    // Queue the latest data update
    pendingProps.current = { anchors, predictions };

    const tryDrawAndSwap = () => {
      // If a transition is currently running, don't overlap.
      if (isTransitioning.current) return;
      
      const props = pendingProps.current;
      if (!props) return;
      pendingProps.current = null;

      isTransitioning.current = true;
      const nextIdx = activeIdxRef.current === 1 ? 0 : 1;
      const canvas = nextIdx === 0 ? bottomCanvasRef.current! : topCanvasRef.current!;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) {
        isTransitioning.current = false;
        return;
      }

      // 1. Setup Scaling
      const gridRes = 220;
      const width = canvas.width;
      const height = canvas.height;

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of props.anchors) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }

      const dx = maxX - minX || 1;
      const dy = maxY - minY || 1;
      minX -= dx * 0.02; maxX += dx * 0.02;
      minY -= dy * 0.02; maxY += dy * 0.02;

      const scaleX = width / (maxX - minX);
      const scaleY = height / (maxY - minY);

      const scaledAnchors = props.anchors.map((a, i) => ({
        x: (a.x - minX) * scaleX,
        y: (a.y - minY) * scaleY,
        trueLabel: a.label,
        predictedLabel: props.predictions && props.predictions.length > i ? props.predictions[i] : -1,
      }));

      // 2. Clear Background
      ctx.fillStyle = '#f4f7fb';
      ctx.fillRect(0, 0, width, height);

      // 3. Draw Decision Boundary
      if (props.predictions && props.predictions.length > 0) {
        const virtualCanvas = document.createElement('canvas');
        virtualCanvas.width = gridRes;
        virtualCanvas.height = gridRes;
        const vCtx = virtualCanvas.getContext('2d', { alpha: false })!;
        const imgData = vCtx.createImageData(gridRes, gridRes);
        const data = imgData.data;
        const labelGrid = new Int16Array(gridRes * gridRes).fill(-1);
        const confidenceGrid = new Float32Array(gridRes * gridRes);

        for (let gy = 0; gy < gridRes; gy++) {
          for (let gx = 0; gx < gridRes; gx++) {
            const cx = gx * (width / gridRes) + (width / gridRes) / 2;
            const cy = gy * (height / gridRes) + (height / gridRes) / 2;

            const K = 12;
            const topK = new Array(K).fill(null).map(() => ({ distSq: Infinity, label: -1 }));

            for (const a of scaledAnchors) {
              const distSq = (cx - a.x) ** 2 + (cy - a.y) ** 2;
              if (distSq < topK[K - 1].distSq) {
                let i = K - 2;
                while (i >= 0 && topK[i].distSq > distSq) {
                  topK[i+1] = topK[i];
                  i--;
                }
                topK[i+1] = { distSq, label: a.predictedLabel };
              }
            }

            const weights: Record<number, number> = {};
            let bestLabel = -1;
            let bestWeight = 0;
            let secondWeight = 0;
            
            for (let i = 0; i < K; i++) {
              const lbl = topK[i].label;
              if (lbl === -1) continue;
              const weight = 1 / Math.max(Math.sqrt(topK[i].distSq), 1);
              weights[lbl] = (weights[lbl] || 0) + weight;
            }

            for (const [labelText, weight] of Object.entries(weights)) {
              const lbl = Number(labelText);
              if (weight > bestWeight) {
                secondWeight = bestWeight;
                bestWeight = weight;
                bestLabel = lbl;
              } else if (weight > secondWeight) {
                secondWeight = weight;
              }
            }

            const cellIdx = gy * gridRes + gx;
            const idx = cellIdx * 4;
            if (bestLabel !== -1 && CLASS_COLORS_RGB[bestLabel]) {
               const [r, g, b] = CLASS_COLORS_RGB[bestLabel];
               const confidence = Math.min(
                 Math.max((bestWeight - secondWeight) / Math.max(bestWeight, 0.0001), 0.18),
                 0.92,
               );
               const tintStrength = 0.18 + confidence * 0.14;
               labelGrid[cellIdx] = bestLabel;
               confidenceGrid[cellIdx] = confidence;
               data[idx] = mixChannel(r, 244, tintStrength);
               data[idx+1] = mixChannel(g, 247, tintStrength);
               data[idx+2] = mixChannel(b, 251, tintStrength);
               data[idx+3] = 255;
            } else {
               data[idx] = 244; data[idx+1] = 247; data[idx+2] = 251; data[idx+3] = 255;
            }
          }
        }

        for (let gy = 1; gy < gridRes - 1; gy++) {
          for (let gx = 1; gx < gridRes - 1; gx++) {
            const idx = gy * gridRes + gx;
            const current = labelGrid[idx];
            if (current === -1) continue;

            const left = labelGrid[idx - 1];
            const right = labelGrid[idx + 1];
            const top = labelGrid[idx - gridRes];
            const bottom = labelGrid[idx + gridRes];
            const isBoundary =
              current !== left || current !== right || current !== top || current !== bottom;

            if (!isBoundary) continue;

            const alpha = Math.round((120 + (1 - confidenceGrid[idx]) * 80) * 0.9);
            const pixelIdx = idx * 4;
            data[pixelIdx] = 255;
            data[pixelIdx + 1] = 255;
            data[pixelIdx + 2] = 255;
            data[pixelIdx + 3] = alpha;
          }
        }

        vCtx.putImageData(imgData, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(virtualCanvas, 0, 0, width, height);
      }

      // 4. Draw Anchor Points
      for (const a of scaledAnchors) {
        ctx.beginPath();
        ctx.arc(a.x, a.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = CLASS_COLORS[a.trueLabel] || '#cccccc';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // 5. Swap visibility
      activeIdxRef.current = nextIdx;
      setActiveIdx(nextIdx);

      // 6. Release lock after fade duration
      setTimeout(() => {
        isTransitioning.current = false;
        if (pendingProps.current && pendingProps.current.predictions !== props.predictions) {
          tryDrawAndSwap();
        }
      }, 500); 
    };

    tryDrawAndSwap();
  }, [anchors, predictions]);

  return (
    <div className={['flex flex-col gap-2', className].join(' ')}>
      <div className="relative aspect-square w-full overflow-hidden rounded-[12px] shadow-sm bg-[#f8fafc]">
        <div
          className="pointer-events-none absolute inset-0 z-20 opacity-70"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <canvas
          ref={bottomCanvasRef}
          width={400}
          height={400}
          className="absolute inset-0 h-full w-full object-cover z-0 opacity-100"
          style={{ filter: 'blur(0.9px)' }}
        />
        <canvas
          ref={topCanvasRef}
          width={400}
          height={400}
          className={`absolute inset-0 h-full w-full object-cover z-10 transition-opacity duration-500 ease-in-out ${activeIdx === 1 ? 'opacity-100' : 'opacity-0'}`}
          style={{ filter: 'blur(0.9px)' }}
        />
      </div>
      {classLabels && classLabels.length > 0 ? (
        <div className="grid grid-cols-5 gap-x-2 gap-y-1 rounded-[12px] border border-[rgba(129,149,188,0.2)] bg-white/70 p-2 shadow-[inset_0_1px_4px_rgba(255,255,255,0.5),0_2px_4px_rgba(129,149,188,0.1)]">
          {classLabels.map((label, idx) => {
            const color = CLASS_COLORS[idx] || '#cccccc';
            return (
              <div key={idx} className="flex items-center gap-1.5 overflow-hidden">
                <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                <span className="truncate text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#5c6d89]" title={label}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
