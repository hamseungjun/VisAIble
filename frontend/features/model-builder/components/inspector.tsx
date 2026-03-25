import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { predictDigit } from '@/lib/api/model-builder';
import { stats } from '@/lib/constants/builder-data';
import type { DecisionBoundaryPoint, TrainingJobStatus } from '@/types/builder';

type InspectorProps = {
  trainingStatus: TrainingJobStatus | null;
};

function buildPath(values: number[], width: number, height: number) {
  if (values.length === 0) {
    return '';
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * (height - 16) - 8;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

const CLASS_COLORS = [
  '#1151ff',
  '#0a607f',
  '#d47b00',
  '#1b9e77',
  '#d94873',
  '#7a51c5',
  '#00a1ab',
  '#5b6f00',
  '#bd3f00',
  '#4663d6',
];

function rotatePoint(point: DecisionBoundaryPoint, azimuthDeg: number, elevationDeg: number) {
  const azimuth = (azimuthDeg * Math.PI) / 180;
  const elevation = (elevationDeg * Math.PI) / 180;

  const x1 = point.x * Math.cos(azimuth) - point.y * Math.sin(azimuth);
  const y1 = point.x * Math.sin(azimuth) + point.y * Math.cos(azimuth);
  const z1 = point.z;

  const y2 = y1 * Math.cos(elevation) - z1 * Math.sin(elevation);
  const z2 = y1 * Math.sin(elevation) + z1 * Math.cos(elevation);

  return { x: x1, y: y2, z: z2, label: point.label };
}

function extractMnistPixels(canvas: HTMLCanvasElement) {
  const downsampled = document.createElement('canvas');
  downsampled.width = 28;
  downsampled.height = 28;
  const downsampledContext = downsampled.getContext('2d');
  if (!downsampledContext) {
    return [];
  }
  downsampledContext.imageSmoothingEnabled = true;
  downsampledContext.drawImage(canvas, 0, 0, 28, 28);
  const imageData = downsampledContext.getImageData(0, 0, 28, 28).data;

  const pixels: number[] = [];
  for (let index = 0; index < imageData.length; index += 4) {
    pixels.push(imageData[index] / 255);
  }
  return pixels;
}

export function Inspector({ trainingStatus }: InspectorProps) {
  const [metricMode, setMetricMode] = useState<'loss' | 'accuracy'>('loss');
  const [seriesMode, setSeriesMode] = useState<'train' | 'val'>('train');
  const [decisionEpoch, setDecisionEpoch] = useState(1);
  const [decisionAngle, setDecisionAngle] = useState(45);
  const [digitPrediction, setDigitPrediction] = useState<{
    predictedLabel: number;
    confidence: number;
  } | null>(null);
  const [predictError, setPredictError] = useState<string | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const metrics = trainingStatus?.metrics ?? [];
  const latestMetric = metrics.at(-1);
  const displayTrainLoss = [
    ...metrics.map((item) => item.trainLoss),
    ...(trainingStatus?.status === 'running' && trainingStatus.liveTrainLoss != null
      ? [trainingStatus.liveTrainLoss]
      : []),
  ];
  const displayTrainAccuracy = [
    ...metrics.map((item) => item.trainAccuracy),
    ...(trainingStatus?.status === 'running' && trainingStatus.liveTrainAccuracy != null
      ? [trainingStatus.liveTrainAccuracy]
      : []),
  ];
  const validationLossValues = metrics.map((item) => item.validationLoss);
  const validationAccuracyValues = metrics.map((item) => item.validationAccuracy);
  const activeValues =
    metricMode === 'loss'
      ? seriesMode === 'train'
        ? displayTrainLoss
        : validationLossValues
      : seriesMode === 'train'
        ? displayTrainAccuracy
        : validationAccuracyValues;
  const activePath = buildPath(activeValues, 320, 180);
  const summaryLabel = `${seriesMode === 'train' ? 'Train' : 'Val'} ${metricMode === 'loss' ? 'Loss' : 'Accuracy'}`;
  const summaryValue =
    metricMode === 'loss'
      ? seriesMode === 'train'
        ? trainingStatus?.status === 'running' && trainingStatus.liveTrainLoss != null
          ? trainingStatus.liveTrainLoss.toFixed(4)
          : latestMetric
            ? latestMetric.trainLoss.toFixed(4)
            : '--'
        : latestMetric
          ? latestMetric.validationLoss.toFixed(4)
          : '--'
      : seriesMode === 'train'
        ? trainingStatus?.status === 'running' && trainingStatus.liveTrainAccuracy != null
          ? `${(trainingStatus.liveTrainAccuracy * 100).toFixed(2)}%`
          : latestMetric
            ? `${(latestMetric.trainAccuracy * 100).toFixed(2)}%`
            : '--'
        : latestMetric
          ? `${(latestMetric.validationAccuracy * 100).toFixed(2)}%`
          : '--';
  const secondaryLabel = `${seriesMode === 'train' ? 'Val' : 'Train'} ${metricMode === 'loss' ? 'Loss' : 'Accuracy'}`;
  const secondaryValue =
    metricMode === 'loss'
      ? seriesMode === 'train'
        ? latestMetric
          ? latestMetric.validationLoss.toFixed(4)
          : '--'
        : trainingStatus?.status === 'running' && trainingStatus.liveTrainLoss != null
          ? trainingStatus.liveTrainLoss.toFixed(4)
          : latestMetric
            ? latestMetric.trainLoss.toFixed(4)
            : '--'
      : seriesMode === 'train'
        ? latestMetric
          ? `${(latestMetric.validationAccuracy * 100).toFixed(2)}%`
          : '--'
        : trainingStatus?.status === 'running' && trainingStatus.liveTrainAccuracy != null
          ? `${(trainingStatus.liveTrainAccuracy * 100).toFixed(2)}%`
          : latestMetric
            ? `${(latestMetric.trainAccuracy * 100).toFixed(2)}%`
            : '--';
  const activeStroke =
    metricMode === 'loss'
      ? seriesMode === 'train'
        ? '#1151ff'
        : '#0a607f'
      : seriesMode === 'train'
        ? '#1151ff'
        : '#0a607f';
  const progressPercent =
    trainingStatus?.epochs && trainingStatus.currentEpoch
      ? Math.min(
          (((trainingStatus.currentEpoch - 1) +
            ((trainingStatus.currentBatch ?? 0) / Math.max(trainingStatus.totalBatches ?? 1, 1))) /
            trainingStatus.epochs) *
            100,
          100,
        )
      : trainingStatus?.epochs && metrics.length > 0
        ? Math.min((metrics.length / trainingStatus.epochs) * 100, 100)
        : 0;
  const epochLabel = trainingStatus?.epochs
    ? `${trainingStatus.currentEpoch ?? metrics.length} / ${trainingStatus.epochs} epochs`
    : '0 / 0 epochs';
  const boundaryEpochs = trainingStatus?.decisionBoundaryEpochs ?? [];
  const boundaryEpochUpperBound = Math.max(boundaryEpochs.length, 1);

  useEffect(() => {
    setDecisionEpoch((prev) => Math.min(Math.max(prev, 1), boundaryEpochUpperBound));
  }, [boundaryEpochUpperBound]);

  const boundaryPoints = boundaryEpochs.find((snapshot) => snapshot.epoch === decisionEpoch)?.points ?? [];
  const rotatedBoundaryPoints = useMemo(
    () => boundaryPoints.map((point) => rotatePoint(point, decisionAngle, 20)),
    [boundaryPoints, decisionAngle],
  );
  const cameraBounds = useMemo(() => {
    const rotatedAllPoints = boundaryEpochs.flatMap((snapshot) =>
      snapshot.points.map((point) => rotatePoint(point, decisionAngle, 20)),
    );
    if (rotatedAllPoints.length === 0) {
      return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
    }

    const xValues = rotatedAllPoints.map((point) => point.x);
    const yValues = rotatedAllPoints.map((point) => point.y);
    return {
      minX: Math.min(...xValues),
      maxX: Math.max(...xValues),
      minY: Math.min(...yValues),
      maxY: Math.max(...yValues),
    };
  }, [boundaryEpochs, decisionAngle]);
  const xRange = cameraBounds.maxX - cameraBounds.minX || 1;
  const yRange = cameraBounds.maxY - cameraBounds.minY || 1;
  const projectedBoundaryPoints = [...rotatedBoundaryPoints]
    .sort((left, right) => left.z - right.z)
    .map((point) => {
      const normalizedX = (point.x - cameraBounds.minX) / xRange;
      const normalizedY = (point.y - cameraBounds.minY) / yRange;
      const depthScale = 0.75 + ((point.z + 4) / 8) * 0.7;
      return {
        cx: 22 + normalizedX * 256,
        cy: 228 - normalizedY * 184,
        r: Math.min(Math.max(1.4 * depthScale, 1.1), 2.7),
        opacity: Math.min(Math.max(0.28 + ((point.z + 4) / 8) * 0.62, 0.2), 0.92),
        fill: CLASS_COLORS[point.label % CLASS_COLORS.length],
      };
    });
  const canUseDigitCanvas =
    trainingStatus?.status === 'completed' && trainingStatus.datasetId === 'mnist' && !!trainingStatus.jobId;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    context.fillStyle = '#000000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.lineWidth = 18;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#ffffff';
  }, [canUseDigitCanvas]);

  const drawAt = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !isDrawing) {
      return;
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    context.lineTo(x, y);
    context.stroke();
  };

  const startDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    setIsDrawing(true);
    context.beginPath();
    context.moveTo(x, y);
  };

  const stopDrawing = () => {
    if (!isDrawing) {
      return;
    }
    setIsDrawing(false);
    void runPrediction();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    context.fillStyle = '#000000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    setDigitPrediction(null);
    setPredictError(null);
  };

  async function runPrediction() {
    if (!trainingStatus?.jobId || !canUseDigitCanvas) {
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const pixels = extractMnistPixels(canvas);
    if (pixels.length !== 28 * 28) {
      return;
    }

    setIsPredicting(true);
    setPredictError(null);
    try {
      const result = await predictDigit(trainingStatus.jobId, pixels);
      setDigitPrediction({
        predictedLabel: result.predictedLabel,
        confidence: result.confidence,
      });
    } catch (error) {
      setPredictError(error instanceof Error ? error.message : 'Prediction failed');
    } finally {
      setIsPredicting(false);
    }
  }

  return (
    <aside className="grid content-start gap-4 bg-[linear-gradient(180deg,#fbfcff_0%,#f7f9ff_100%)] p-4">
      <section className="rounded-[22px] bg-panel/80 p-3.5">
        <div className="mb-3 flex items-center justify-between">
          <strong className="font-display text-lg font-bold text-ink">Decision Boundary</strong>
          <span className="text-muted">↗</span>
        </div>
        <div className="relative h-[270px] overflow-hidden rounded-[18px] bg-white/85 p-2.5">
          <svg viewBox="0 0 300 250" className="h-[210px] w-full">
            <path
              d="M22 32V228M86 32V228M150 32V228M214 32V228M278 32V228M22 228H278M22 182H278M22 136H278M22 90H278M22 44H278"
              fill="none"
              stroke="rgba(129,149,188,0.22)"
              strokeWidth="0.8"
            />
            {projectedBoundaryPoints.map((point, index) => (
              <circle
                key={`${index}-${point.cx.toFixed(2)}-${point.cy.toFixed(2)}`}
                cx={point.cx}
                cy={point.cy}
                r={point.r}
                fill={point.fill}
                opacity={point.opacity}
              />
            ))}
          </svg>

          <div className="absolute inset-x-3 bottom-10 grid gap-2 rounded-xl bg-white/88 p-2 shadow-[inset_0_0_0_1px_rgba(129,149,188,0.18)]">
            <label className="grid gap-1">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
                Epoch {decisionEpoch} / {boundaryEpochUpperBound}
              </span>
              <input
                type="range"
                min={1}
                max={boundaryEpochUpperBound}
                step={1}
                value={decisionEpoch}
                onChange={(event) => setDecisionEpoch(Number(event.target.value))}
                className="h-1.5 cursor-pointer appearance-none rounded-full bg-[#d9e4fb] accent-primary"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
                3D View Angle {decisionAngle}°
              </span>
              <input
                type="range"
                min={0}
                max={360}
                step={10}
                value={decisionAngle}
                onChange={(event) => setDecisionAngle(Number(event.target.value))}
                className="h-1.5 cursor-pointer appearance-none rounded-full bg-[#d9e4fb] accent-tertiary"
              />
            </label>
          </div>

          <div className="absolute bottom-3 right-4 flex gap-4 text-[11px] text-muted">
            <span className="flex items-center gap-2">
              <i className="h-2 w-2 rounded-full bg-primary" />
              Digits 0-9
            </span>
          </div>
        </div>
      </section>

      {canUseDigitCanvas ? (
        <section className="rounded-[22px] bg-panel/80 p-3.5">
          <div className="mb-3 flex items-center justify-between">
            <strong className="font-display text-lg font-bold text-ink">MNIST Canvas</strong>
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
              Draw & Predict
            </span>
          </div>

          <div className="grid gap-3">
            <canvas
              ref={canvasRef}
              width={280}
              height={280}
              className="h-[220px] w-full touch-none rounded-[14px] bg-black"
              onPointerDown={startDrawing}
              onPointerMove={drawAt}
              onPointerUp={stopDrawing}
              onPointerLeave={stopDrawing}
            />
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={clearCanvas}
                className="rounded-full border border-[#c7d6ef] px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-muted"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  void runPrediction();
                }}
                className="rounded-full bg-primary px-4 py-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-white"
                disabled={isPredicting}
              >
                {isPredicting ? 'Predicting...' : 'Predict'}
              </button>
            </div>

            {digitPrediction ? (
              <div className="rounded-[14px] bg-white/80 px-3 py-2 text-sm text-ink">
                Predicted Digit: <strong>{digitPrediction.predictedLabel}</strong> (
                {(digitPrediction.confidence * 100).toFixed(1)}%)
              </div>
            ) : null}
            {predictError ? (
              <div className="rounded-[14px] bg-[#ffeef1] px-3 py-2 text-sm text-[#a4384f]">
                {predictError}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="rounded-[22px] bg-panel/80 p-3.5">
        <div className="mb-3 flex items-start justify-between">
          <strong className="font-display text-lg font-bold text-ink">Training Metrics</strong>
          <div className="flex rounded-full bg-white/75 p-1 text-[11px] font-extrabold uppercase tracking-[0.16em]">
            <button
              type="button"
              onClick={() => setMetricMode('loss')}
              className={[
                'rounded-full px-3 py-1 transition-colors',
                metricMode === 'loss' ? 'bg-primary text-white' : 'text-muted',
              ].join(' ')}
            >
              Loss
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('accuracy')}
              className={[
                'rounded-full px-3 py-1 transition-colors',
                metricMode === 'accuracy' ? 'bg-primary text-white' : 'text-muted',
              ].join(' ')}
            >
              Accuracy
            </button>
          </div>
        </div>

        <div className="mb-3 flex items-center justify-end">
          <div className="flex gap-3 text-xs font-extrabold uppercase tracking-[0.16em]">
            <button
              type="button"
              onClick={() => setSeriesMode('train')}
              className={seriesMode === 'train' ? 'text-primary' : 'text-muted'}
            >
              Train
            </button>
            <button
              type="button"
              onClick={() => setSeriesMode('val')}
              className={seriesMode === 'val' ? 'text-tertiary' : 'text-muted'}
            >
              Val
            </button>
          </div>
        </div>

        <div className="rounded-[18px] bg-white/85 p-3">
          <svg viewBox="0 0 320 180" preserveAspectRatio="none" className="h-[160px] w-full">
            <path
              d="M0 36H320M0 90H320M0 144H320"
              fill="none"
              stroke="rgba(129,149,188,0.26)"
            />
            {activePath ? (
              <path d={activePath} fill="none" stroke={activeStroke} strokeWidth="4" />
            ) : null}
          </svg>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="grid gap-1">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted">
              {summaryLabel}
            </span>
            <strong className="font-display text-[2rem] font-bold text-primary">
              {summaryValue}
            </strong>
          </div>
          <div className="grid gap-1">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted">
              {secondaryLabel}
            </span>
            <strong className="font-display text-[2rem] font-bold text-tertiary">
              {secondaryValue}
            </strong>
          </div>
        </div>
      </section>

      <section className="grid gap-4 px-1 pt-1">
        <div className="rounded-[18px] bg-white/70 px-3 py-3 shadow-[inset_0_0_0_1px_rgba(129,149,188,0.12)]">
          <div className="mb-2 flex items-center justify-between text-[12px] font-bold uppercase tracking-[0.12em] text-muted">
            <span>Progress</span>
            <span>{epochLabel}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#d9e4fb]">
            <span
              className="block h-full rounded-full bg-[linear-gradient(90deg,#1151ff,#3a6cff)] transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {stats.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-6">
            <span className="text-base text-[#364761]">{item.label}</span>
            <strong className="font-display text-base font-bold text-ink">
              {item.label === 'Epochs Completed' && trainingStatus?.epochs
                ? `${trainingStatus.currentEpoch ?? metrics.length} / ${trainingStatus.epochs}`
                : item.label === 'Batch Size'
                  ? '128'
                  : item.label === 'Total Parameters' && trainingStatus?.architecture.length
                    ? `${trainingStatus.architecture.length} blocks`
                    : item.value}
            </strong>
          </div>
        ))}
      </section>
    </aside>
  );
}
