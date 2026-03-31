import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Icon } from '@/features/model-builder/components/icons';
import { predictDigit, predictSample } from '@/lib/api/model-builder';
import { datasets } from '@/lib/constants/builder-data';
import type { DatasetItem, TrainingJobStatus } from '@/types/builder';

type InspectorProps = {
  trainingStatus: TrainingJobStatus | null;
  liveHistory: {
    loss: number[];
    accuracy: number[];
    validationLoss: number[];
    validationAccuracy: number[];
  };
  showDecisionBoundary?: boolean;
  showMnistCanvas?: boolean;
};

const GRAPH_WIDTH = 320;
const GRAPH_HEIGHT = 200;
const GRAPH_PADDING_X = 14;
const GRAPH_PADDING_Y = 12;
const MAX_GRAPH_POINTS = 120;

function compressSeries(values: number[], maxPoints: number) {
  if (values.length <= maxPoints) {
    return values;
  }

  const bucketSize = values.length / maxPoints;
  const compressed: number[] = [];

  for (let index = 0; index < maxPoints; index += 1) {
    const start = Math.floor(index * bucketSize);
    const end = Math.max(start + 1, Math.floor((index + 1) * bucketSize));
    const bucket = values.slice(start, end);
    const average = bucket.reduce((sum, value) => sum + value, 0) / bucket.length;
    compressed.push(average);
  }

  return compressed;
}

function buildPath(values: number[], width: number, height: number, domain: [number, number]) {
  if (values.length === 0) {
    return '';
  }

  const [min, max] = domain;
  const range = max - min || 1;

  return values
    .map((value, index) => {
      const x =
        GRAPH_PADDING_X +
        (index / Math.max(values.length - 1, 1)) * (width - GRAPH_PADDING_X * 2);
      const y =
        height -
        GRAPH_PADDING_Y -
        ((value - min) / range) * (height - GRAPH_PADDING_Y * 2);
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function buildSinglePointY(values: number[], height: number, domain: [number, number]) {
  if (values.length !== 1) {
    return null;
  }

  const [min, max] = domain;
  const range = max - min || 1;
  return (
    height -
    GRAPH_PADDING_Y -
    ((values[0] - min) / range) * (height - GRAPH_PADDING_Y * 2)
  );
}

function extractMnistPixels(canvas: HTMLCanvasElement) {
  const sourceContext = canvas.getContext('2d');
  if (!sourceContext) {
    return [];
  }

  const sourceWidth = canvas.width;
  const sourceHeight = canvas.height;
  const sourceImage = sourceContext.getImageData(0, 0, sourceWidth, sourceHeight);
  const threshold = 16;

  let minX = sourceWidth;
  let minY = sourceHeight;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < sourceHeight; y += 1) {
    for (let x = 0; x < sourceWidth; x += 1) {
      const offset = (y * sourceWidth + x) * 4;
      const intensity = sourceImage.data[offset];
      if (intensity <= threshold) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return [];
  }

  const cropWidth = maxX - minX + 1;
  const cropHeight = maxY - minY + 1;
  const workingCanvas = document.createElement('canvas');
  workingCanvas.width = 28;
  workingCanvas.height = 28;
  const workingContext = workingCanvas.getContext('2d');
  if (!workingContext) {
    return [];
  }

  workingContext.fillStyle = '#000000';
  workingContext.fillRect(0, 0, 28, 28);
  workingContext.imageSmoothingEnabled = true;

  const normalizedDigitSize = 20;
  const scale = Math.min(normalizedDigitSize / cropWidth, normalizedDigitSize / cropHeight);
  const scaledWidth = Math.max(1, Math.round(cropWidth * scale));
  const scaledHeight = Math.max(1, Math.round(cropHeight * scale));
  const offsetX = Math.floor((28 - scaledWidth) / 2);
  const offsetY = Math.floor((28 - scaledHeight) / 2);

  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = cropWidth;
  croppedCanvas.height = cropHeight;
  const croppedContext = croppedCanvas.getContext('2d');
  if (!croppedContext) {
    return [];
  }

  croppedContext.putImageData(sourceImage, -minX, -minY);
  workingContext.drawImage(
    croppedCanvas,
    0,
    0,
    cropWidth,
    cropHeight,
    offsetX,
    offsetY,
    scaledWidth,
    scaledHeight,
  );

  const centeredImage = workingContext.getImageData(0, 0, 28, 28);
  let totalMass = 0;
  let massX = 0;
  let massY = 0;

  for (let y = 0; y < 28; y += 1) {
    for (let x = 0; x < 28; x += 1) {
      const offset = (y * 28 + x) * 4;
      const intensity = centeredImage.data[offset] / 255;
      totalMass += intensity;
      massX += x * intensity;
      massY += y * intensity;
    }
  }

  if (totalMass > 0) {
    const centroidX = massX / totalMass;
    const centroidY = massY / totalMass;
    const shiftX = Math.round(13.5 - centroidX);
    const shiftY = Math.round(13.5 - centroidY);

    if (shiftX !== 0 || shiftY !== 0) {
      const recenteredCanvas = document.createElement('canvas');
      recenteredCanvas.width = 28;
      recenteredCanvas.height = 28;
      const recenteredContext = recenteredCanvas.getContext('2d');
      if (!recenteredContext) {
        return [];
      }

      recenteredContext.fillStyle = '#000000';
      recenteredContext.fillRect(0, 0, 28, 28);
      recenteredContext.putImageData(centeredImage, shiftX, shiftY);
      const recenteredImage = recenteredContext.getImageData(0, 0, 28, 28).data;

      return Array.from({ length: 28 * 28 }, (_, index) => recenteredImage[index * 4] / 255);
    }
  }

  return Array.from({ length: 28 * 28 }, (_, index) => centeredImage.data[index * 4] / 255);
}

function getDatasetFromStatus(trainingStatus: TrainingJobStatus | null) {
  if (!trainingStatus?.datasetId) {
    return null;
  }

  return datasets.find((dataset) => dataset.id === trainingStatus.datasetId) ?? null;
}

function getTopPredictions(probabilities: number[], labels: string[], count = 5) {
  return probabilities
    .map((probability, index) => ({
      index,
      label: labels[index] ?? `Class ${index}`,
      probability,
    }))
    .sort((left, right) => right.probability - left.probability)
    .slice(0, count);
}

async function extractSamplePixels(imageSrc: string, dataset: DatasetItem): Promise<number[]> {
  const [channels, height, width] =
    dataset.inputShape?.split('x').map((value) => Number(value.trim())) ?? [1, 28, 28];

  const image = new Image();
  image.src = imageSrc;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Sample image failed to load'));
  });

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Preview canvas is not available');
  }

  context.drawImage(image, 0, 0, width, height);
  const { data } = context.getImageData(0, 0, width, height);

  if (channels === 1) {
    return Array.from({ length: width * height }, (_, index) => {
      const offset = index * 4;
      return (0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2]) / 255;
    });
  }

  const pixels: number[] = [];
  for (let channel = 0; channel < 3; channel += 1) {
    for (let index = 0; index < width * height; index += 1) {
      pixels.push(data[index * 4 + channel] / 255);
    }
  }
  return pixels;
}

export function Inspector({
  trainingStatus,
  liveHistory = { loss: [], accuracy: [], validationLoss: [], validationAccuracy: [] },
  showDecisionBoundary = true,
  showMnistCanvas: allowMnistCanvas = true,
}: InspectorProps) {
  const safeLiveHistory = {
    loss: liveHistory.loss ?? [],
    accuracy: liveHistory.accuracy ?? [],
    validationLoss: liveHistory.validationLoss ?? [],
    validationAccuracy: liveHistory.validationAccuracy ?? [],
  };
  const [metricMode, setMetricMode] = useState<'loss' | 'accuracy'>('loss');
  const [replayEpochCount, setReplayEpochCount] = useState<number | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [predictError, setPredictError] = useState<string | null>(null);
  const [digitPrediction, setDigitPrediction] = useState<{
    predictedLabel: number;
    confidence: number;
    probabilities: number[];
  } | null>(null);
  const [selectedSampleIndex, setSelectedSampleIndex] = useState(0);
  const [samplePrediction, setSamplePrediction] = useState<{
    predictedLabel: number;
    confidence: number;
    probabilities: number[];
  } | null>(null);
  const [samplePredictError, setSamplePredictError] = useState<string | null>(null);
  const [isSamplePredicting, setIsSamplePredicting] = useState(false);
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentDataset = getDatasetFromStatus(trainingStatus);
  const metrics = trainingStatus?.metrics ?? [];
  const isReplayAvailable =
    (trainingStatus?.status === 'completed' ||
      trainingStatus?.status === 'failed' ||
      trainingStatus?.status === 'stopped') &&
    metrics.length > 1;
  const isReplaying = replayEpochCount !== null;
  const visibleMetrics =
    isReplaying && replayEpochCount !== null ? metrics.slice(0, replayEpochCount) : metrics;
  const latestMetric = visibleMetrics.at(-1);

  useEffect(() => {
    setReplayEpochCount(null);
  }, [trainingStatus?.jobId, trainingStatus?.status]);

  useEffect(() => {
    if (!isReplaying || replayEpochCount === null || !isReplayAvailable) {
      return;
    }

    if (replayEpochCount >= metrics.length) {
      setReplayEpochCount(null);
      return;
    }

    const timeout = window.setTimeout(() => {
      setReplayEpochCount((current) => (current == null ? current : current + 1));
    }, 550);

    return () => window.clearTimeout(timeout);
  }, [isReplayAvailable, isReplaying, metrics.length, replayEpochCount]);

  const replayMetricsCount = isReplaying ? visibleMetrics.length : metrics.length;
  const displayTrainLoss = [
    ...visibleMetrics.map((item) => item.trainLoss),
    ...(isReplaying ? [] : safeLiveHistory.loss),
  ];
  const displayTrainAccuracy = [
    ...visibleMetrics.map((item) => item.trainAccuracy),
    ...(isReplaying ? [] : safeLiveHistory.accuracy),
  ];
  const validationLossValues = [
    ...visibleMetrics.map((item) => item.validationLoss),
    ...(isReplaying ? [] : safeLiveHistory.validationLoss),
  ];
  const validationAccuracyValues = [
    ...visibleMetrics.map((item) => item.validationAccuracy),
    ...(isReplaying ? [] : safeLiveHistory.validationAccuracy),
  ];
  const rawTrainValues = metricMode === 'loss' ? displayTrainLoss : displayTrainAccuracy;
  const rawValidationValues =
    metricMode === 'loss' ? validationLossValues : validationAccuracyValues;
  const trainValues = compressSeries(rawTrainValues, MAX_GRAPH_POINTS);
  const validationValues = compressSeries(rawValidationValues, MAX_GRAPH_POINTS);
  const allValues = [...trainValues, ...validationValues];
  const domain: [number, number] =
    allValues.length > 0
      ? [Math.min(...allValues), Math.max(...allValues)]
      : [0, 1];
  const trainPath = buildPath(trainValues, GRAPH_WIDTH, GRAPH_HEIGHT, domain);
  const validationPath = buildPath(validationValues, GRAPH_WIDTH, GRAPH_HEIGHT, domain);
  const trainSinglePointY = buildSinglePointY(trainValues, GRAPH_HEIGHT, domain);
  const validationSinglePointY = buildSinglePointY(validationValues, GRAPH_HEIGHT, domain);
  const summaryLabel = `Train ${metricMode === 'loss' ? 'Loss' : 'Accuracy'}`;
  const summaryValue =
    metricMode === 'loss'
      ? trainingStatus?.status === 'running' && trainingStatus.liveTrainLoss != null
        ? trainingStatus.liveTrainLoss.toFixed(4)
        : latestMetric
          ? latestMetric.trainLoss.toFixed(4)
          : '--'
      : trainingStatus?.status === 'running' && trainingStatus.liveTrainAccuracy != null
        ? `${(trainingStatus.liveTrainAccuracy * 100).toFixed(2)}%`
        : latestMetric
          ? `${(latestMetric.trainAccuracy * 100).toFixed(2)}%`
          : '--';
  const secondaryLabel = `Val ${metricMode === 'loss' ? 'Loss' : 'Accuracy'}`;
  const secondaryValue =
    metricMode === 'loss'
      ? trainingStatus?.status === 'running' && trainingStatus.liveValidationLoss != null
        ? trainingStatus.liveValidationLoss.toFixed(4)
        : latestMetric
          ? latestMetric.validationLoss.toFixed(4)
          : '--'
      : trainingStatus?.status === 'running' && trainingStatus.liveValidationAccuracy != null
        ? `${(trainingStatus.liveValidationAccuracy * 100).toFixed(2)}%`
        : latestMetric
          ? `${(latestMetric.validationAccuracy * 100).toFixed(2)}%`
          : '--';
  const progressEpochCount = isReplaying
    ? replayMetricsCount
    : (trainingStatus?.currentEpoch ?? metrics.length);
  const progressPercent = trainingStatus?.epochs
    ? trainingStatus.currentEpoch && !isReplaying
      ? Math.min(
          (((trainingStatus.currentEpoch - 1) +
            ((trainingStatus.currentBatch ?? 0) / Math.max(trainingStatus.totalBatches ?? 1, 1))) /
            trainingStatus.epochs) *
            100,
          100,
        )
      : Math.min((progressEpochCount / trainingStatus.epochs) * 100, 100)
    : 0;
  const epochLabel = trainingStatus?.epochs
    ? `${progressEpochCount} / ${trainingStatus.epochs} epochs`
    : '0 / 0 epochs';
  const showMnistCanvas =
    allowMnistCanvas &&
    trainingStatus?.status === 'completed' &&
    trainingStatus.datasetId === 'mnist' &&
    !!trainingStatus.jobId;
  const showSamplePredictor =
    trainingStatus?.status === 'completed' &&
    !!trainingStatus.jobId &&
    currentDataset != null &&
    currentDataset.id !== 'mnist' &&
    (currentDataset.sampleClasses?.length ?? 0) > 0 &&
    (currentDataset.classLabels?.length ?? 0) > 0;
  const selectedSample =
    showSamplePredictor && currentDataset?.sampleClasses
      ? (currentDataset.sampleClasses[selectedSampleIndex] ?? currentDataset.sampleClasses[0])
      : null;
  const digitTopPredictions =
    digitPrediction && currentDataset?.classLabels
      ? getTopPredictions(digitPrediction.probabilities, currentDataset.classLabels, 5)
      : [];
  const sampleTopPredictions =
    samplePrediction && currentDataset?.classLabels
      ? getTopPredictions(samplePrediction.probabilities, currentDataset.classLabels, 5)
      : [];

  useEffect(() => {
    if (!showMnistCanvas) {
      return;
    }
    const canvas = drawingCanvasRef.current;
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
  }, [showMnistCanvas, trainingStatus?.jobId]);

  useEffect(() => {
    setSelectedSampleIndex(0);
    setDigitPrediction(null);
    setPredictError(null);
    setSamplePrediction(null);
    setSamplePredictError(null);
  }, [trainingStatus?.jobId, trainingStatus?.datasetId]);

  const startDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawingCanvasRef.current;
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
    setDigitPrediction(null);
    setPredictError(null);
    context.beginPath();
    context.moveTo(x, y);
  };

  const drawDigit = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) {
      return;
    }
    const canvas = drawingCanvasRef.current;
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
    context.lineTo(x, y);
    context.stroke();
  };

  const clearDrawing = () => {
    const canvas = drawingCanvasRef.current;
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

  const runDigitPrediction = async () => {
    if (!trainingStatus?.jobId) {
      return;
    }
    const canvas = drawingCanvasRef.current;
    if (!canvas) {
      return;
    }

    const pixels = extractMnistPixels(canvas);
    if (pixels.length !== 28 * 28) {
      setDigitPrediction(null);
      setPredictError('Draw a single digit before predicting.');
      return;
    }

    setIsPredicting(true);
    setPredictError(null);
    try {
      const result = await predictDigit(trainingStatus.jobId, pixels);
      setDigitPrediction({
        predictedLabel: result.predictedLabel,
        confidence: result.confidence,
        probabilities: result.probabilities,
      });
    } catch (error) {
      console.error('Digit prediction failed', error);
      setPredictError(error instanceof Error ? error.message : 'Prediction failed');
    } finally {
      setIsPredicting(false);
    }
  };

  const stopDrawing = () => {
    if (!isDrawing) {
      return;
    }
    setIsDrawing(false);
  };

  const runSamplePrediction = async () => {
    if (!trainingStatus?.jobId || !currentDataset || !selectedSample?.imageSrc) {
      return;
    }

    setIsSamplePredicting(true);
    setSamplePredictError(null);
    try {
      const pixels = await extractSamplePixels(selectedSample.imageSrc, currentDataset);
      const result = await predictSample(trainingStatus.jobId, pixels);
      setSamplePrediction({
        predictedLabel: result.predictedLabel,
        confidence: result.confidence,
        probabilities: result.probabilities,
      });
    } catch (error) {
      console.error('Sample prediction failed', error);
      setSamplePredictError(error instanceof Error ? error.message : 'Sample prediction failed');
    } finally {
      setIsSamplePredicting(false);
    }
  };

  return (
    <aside className="grid content-start gap-4 bg-[linear-gradient(180deg,#fbfcff_0%,#f7f9ff_100%)] p-4">
      <section className="grid gap-4 px-1 pt-1">
        <div className="rounded-[18px] bg-white/70 px-3 py-3 shadow-[inset_0_0_0_1px_rgba(129,149,188,0.12)]">
          <div className="mb-2 flex items-center justify-between text-[12px] font-bold uppercase tracking-[0.12em] text-muted">
            <span>Progress</span>
            <div className="flex items-center gap-2">
              {isReplayAvailable ? (
                <button
                  type="button"
                  onClick={() => setReplayEpochCount(1)}
                  disabled={isReplaying}
                  className="inline-flex items-center gap-1 rounded-full bg-[#eef3ff] px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-primary transition-colors hover:bg-[#dfe9ff] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Icon name="play" className="h-3 w-3" />
                  {isReplaying ? 'Replaying' : 'Replay'}
                </button>
              ) : null}
              <span>{epochLabel}</span>
            </div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#d9e4fb]">
            <span
              className="block h-full rounded-full bg-[linear-gradient(90deg,#1151ff,#3a6cff)] transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </section>

      {showMnistCanvas ? (
        <section className="rounded-[22px] bg-panel/80 p-3.5">
          <div className="mb-3 flex items-center justify-between">
            <strong className="font-display text-lg font-bold text-ink">MNIST Canvas</strong>
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
              Draw, Then Predict
            </span>
          </div>

          <div className="grid gap-3">
            <canvas
              ref={drawingCanvasRef}
              width={280}
              height={280}
              className="h-[220px] w-full touch-none rounded-[14px] bg-black"
              onPointerDown={startDrawing}
              onPointerMove={drawDigit}
              onPointerUp={stopDrawing}
              onPointerLeave={stopDrawing}
            />

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={clearDrawing}
                className="rounded-full border border-[#c7d6ef] px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-muted"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  void runDigitPrediction();
                }}
                disabled={isPredicting}
                className="rounded-full bg-primary px-4 py-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isPredicting ? 'Predicting...' : 'Predict'}
              </button>
            </div>

            {digitPrediction ? (
              <div className="grid gap-3 rounded-[16px] bg-[linear-gradient(135deg,#ffffff,#eef4ff)] px-3.5 py-3 shadow-[0_12px_28px_rgba(17,81,255,0.08)]">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">
                      Predicted Digit
                    </div>
                    <div className="mt-1 font-display text-[32px] font-bold text-primary">
                      {digitPrediction.predictedLabel}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">
                      Confidence
                    </div>
                    <div className="mt-1 font-display text-[24px] font-bold text-ink">
                      {(digitPrediction.confidence * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="grid gap-2">
                  {digitTopPredictions.map((prediction) => (
                    <div key={prediction.index} className="grid gap-1">
                      <div className="flex items-center justify-between text-[12px] font-semibold text-ink">
                        <span>{prediction.label}</span>
                        <span>{(prediction.probability * 100).toFixed(1)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#dbe5f4]">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#1151ff,#4f7dff)]"
                          style={{ width: `${Math.max(prediction.probability * 100, 2)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
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

      {showSamplePredictor && currentDataset && selectedSample ? (
        <section className="rounded-[22px] bg-panel/80 p-3.5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <strong className="font-display text-lg font-bold text-ink">
              {currentDataset.label} Sample Predictor
            </strong>
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
              Sample Selection
            </span>
          </div>

          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              {currentDataset.sampleClasses?.map((sample, index) => {
                const active = index === selectedSampleIndex;

                return (
                  <button
                    key={`${sample.label}-${sample.imageSrc ?? index}`}
                    type="button"
                    onClick={() => {
                      setSelectedSampleIndex(index);
                      setSamplePrediction(null);
                      setSamplePredictError(null);
                    }}
                    className={[
                      'overflow-hidden rounded-[16px] border text-left transition',
                      active
                        ? 'border-[#7aa2ff] bg-white shadow-[0_14px_28px_rgba(17,81,255,0.12)]'
                        : 'border-[#dbe5f1] bg-white/80 hover:border-[#bdd1f3]',
                    ].join(' ')}
                  >
                    {sample.imageSrc ? (
                      <img
                        src={sample.imageSrc}
                        alt={sample.label}
                        className="h-24 w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-24 place-items-center bg-[#eef4ff] text-sm font-bold text-ink">
                        {sample.label}
                      </div>
                    )}
                    <div className="px-3 py-2 text-[12px] font-semibold text-ink">{sample.label}</div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="text-[12px] font-semibold text-[#5e6e86]">
                Select a sample image and inspect the model probability distribution.
              </div>
              <button
                type="button"
                onClick={() => {
                  void runSamplePrediction();
                }}
                disabled={isSamplePredicting}
                className="rounded-full bg-primary px-4 py-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSamplePredicting ? 'Predicting...' : 'Predict Sample'}
              </button>
            </div>

            {samplePrediction ? (
              <div className="grid gap-3 rounded-[16px] bg-[linear-gradient(135deg,#ffffff,#eef8ff)] px-3.5 py-3 shadow-[0_12px_28px_rgba(10,96,127,0.08)]">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">
                      Predicted Class
                    </div>
                    <div className="mt-1 font-display text-[24px] font-bold text-primary">
                      {currentDataset.classLabels?.[samplePrediction.predictedLabel] ??
                        `Class ${samplePrediction.predictedLabel}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">
                      Confidence
                    </div>
                    <div className="mt-1 font-display text-[24px] font-bold text-ink">
                      {(samplePrediction.confidence * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="grid gap-2">
                  {sampleTopPredictions.map((prediction) => (
                    <div key={prediction.index} className="grid gap-1">
                      <div className="flex items-center justify-between text-[12px] font-semibold text-ink">
                        <span>{prediction.label}</span>
                        <span>{(prediction.probability * 100).toFixed(1)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#dbe5f4]">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#0a607f,#14a3d2)]"
                          style={{ width: `${Math.max(prediction.probability * 100, 2)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {samplePredictError ? (
              <div className="rounded-[14px] bg-[#ffeef1] px-3 py-2 text-sm text-[#a4384f]">
                {samplePredictError}
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

        <div className="mb-3 flex items-center justify-end gap-4 text-[11px] font-extrabold uppercase tracking-[0.16em]">
          <span className="flex items-center gap-2 text-primary">
            <i className="h-2.5 w-2.5 rounded-full bg-primary" />
            Train
          </span>
          <span className="flex items-center gap-2 text-tertiary">
            <i className="h-2.5 w-2.5 rounded-full bg-tertiary" />
            Val
          </span>
        </div>

        <div className="rounded-[18px] bg-white/85 p-3">
          <svg
            viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
            preserveAspectRatio="xMidYMid meet"
            className="aspect-[16/10] w-full overflow-visible"
          >
            <path
              d={`M${GRAPH_PADDING_X} 48H${GRAPH_WIDTH - GRAPH_PADDING_X}M${GRAPH_PADDING_X} 100H${GRAPH_WIDTH - GRAPH_PADDING_X}M${GRAPH_PADDING_X} 152H${GRAPH_WIDTH - GRAPH_PADDING_X}`}
              fill="none"
              stroke="rgba(129,149,188,0.26)"
            />
            {trainPath ? (
              <path d={trainPath} fill="none" stroke="#1151ff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            ) : null}
            {trainSinglePointY != null ? (
              <circle cx={GRAPH_PADDING_X} cy={trainSinglePointY} r="4" fill="#1151ff" />
            ) : null}
            {validationPath ? (
              <path d={validationPath} fill="none" stroke="#0a607f" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            ) : null}
            {validationSinglePointY != null ? (
              <circle cx={GRAPH_PADDING_X} cy={validationSinglePointY} r="4" fill="#0a607f" />
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

      {showDecisionBoundary ? (
        <section className="rounded-[22px] bg-panel/80 p-3.5">
          <div className="mb-3 flex items-center justify-between">
            <strong className="font-display text-lg font-bold text-ink">Decision Boundary</strong>
            <span className="text-muted">↗</span>
          </div>
          <div className="relative aspect-square overflow-hidden rounded-[18px] bg-white/85">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(194,212,251,0.28),transparent_58%)]" />
            <div className="absolute inset-6 rounded-[20px] border border-dashed border-[rgba(129,149,188,0.28)] bg-[linear-gradient(180deg,rgba(244,247,255,0.78),rgba(236,241,252,0.48))]" />
            <div className="absolute inset-x-6 bottom-6 rounded-[16px] bg-white/88 px-3.5 py-3 text-center shadow-[0_10px_24px_rgba(13,27,51,0.06)] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.1)]">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">
                Frontend Placeholder
              </div>
              <div className="mt-2 text-[13px] font-semibold leading-6 text-[#5c6d89]">
                Decision boundary visualization area
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </aside>
  );
}
