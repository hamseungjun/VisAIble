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
  0: '#ef4444', // red
  1: '#f97316', // orange
  2: '#f59e0b', // amber
  3: '#84cc16', // lime
  4: '#10b981', // emerald
  5: '#06b6d4', // cyan
  6: '#3b82f6', // blue
  7: '#8b5cf6', // violet
  8: '#d946ef', // fuchsia
  9: '#334155', // slate dark
};

const CLASS_COLORS_RGB: Record<number, [number, number, number]> = {
  0: [239, 68, 68],
  1: [249, 115, 22],
  2: [245, 158, 11],
  3: [132, 204, 22],
  4: [16, 185, 129],
  5: [6, 182, 212],
  6: [59, 130, 246],
  7: [139, 92, 246],
  8: [217, 70, 239],
  9: [51, 65, 85],
};

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
      const gridRes = 200; // Even higher resolution for ultra-smoothness
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
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, width, height);

      // 3. Draw Decision Boundary (k-NN Majority Vote)
      if (props.predictions && props.predictions.length > 0) {
        const virtualCanvas = document.createElement('canvas');
        virtualCanvas.width = gridRes;
        virtualCanvas.height = gridRes;
        const vCtx = virtualCanvas.getContext('2d', { alpha: false })!;
        const imgData = vCtx.createImageData(gridRes, gridRes);
        const data = imgData.data;

        for (let gy = 0; gy < gridRes; gy++) {
          for (let gx = 0; gx < gridRes; gx++) {
            const cx = gx * (width / gridRes) + (width / gridRes) / 2;
            const cy = gy * (height / gridRes) + (height / gridRes) / 2;

            const K = 9; // Increased pool for more organic, rounded shapes
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

            const counts: Record<number, number> = {};
            let bestLabel = -1;
            let maxCount = 0;
            
            for (let i = 0; i < K; i++) {
              const lbl = topK[i].label;
              if (lbl === -1) continue;
              counts[lbl] = (counts[lbl] || 0) + 1;
              if (counts[lbl] > maxCount) {
                maxCount = counts[lbl];
                bestLabel = lbl;
              }
            }

            const idx = (gy * gridRes + gx) * 4;
            if (bestLabel !== -1 && CLASS_COLORS_RGB[bestLabel]) {
               const [r, g, b] = CLASS_COLORS_RGB[bestLabel];
               data[idx] = Math.round(r * 0.4 + 248 * 0.6);
               data[idx+1] = Math.round(g * 0.4 + 250 * 0.6);
               data[idx+2] = Math.round(b * 0.4 + 252 * 0.6);
               data[idx+3] = 255;
            } else {
               data[idx] = 248; data[idx+1] = 250; data[idx+2] = 252; data[idx+3] = 255;
            }
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
        <canvas
          ref={bottomCanvasRef}
          width={400}
          height={400}
          className="absolute inset-0 h-full w-full object-cover z-0 opacity-100"
          style={{ filter: 'blur(0.6px)' }}
        />
        <canvas
          ref={topCanvasRef}
          width={400}
          height={400}
          className={`absolute inset-0 h-full w-full object-cover z-10 transition-opacity duration-500 ease-in-out ${activeIdx === 1 ? 'opacity-100' : 'opacity-0'}`}
          style={{ filter: 'blur(0.6px)' }}
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
