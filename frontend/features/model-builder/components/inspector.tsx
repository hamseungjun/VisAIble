import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/features/model-builder/components/icons';
import {
  generateGradCam,
  getDecisionBoundaryAnchors,
  predictDigit,
  predictSample,
} from '@/lib/api/model-builder';
import { extractMnistPixels } from '@/lib/mnist-canvas';
import { DecisionBoundaryCanvas } from './decision-boundary-canvas';
import { datasets } from '@/lib/constants/builder-data';
import type { DatasetItem, TrainingJobStatus } from '@/types/builder';

type InspectorProps = {
  trainingStatus: TrainingJobStatus | null;
  selectedDataset?: DatasetItem | null;
  liveHistory: {
    loss: number[];
    accuracy: number[];
    validationLoss: number[];
    validationAccuracy: number[];
  };
  showDecisionBoundary?: boolean;
  showMnistCanvas?: boolean;
  onDigitPredictionComplete?: () => void;
  metricModeOverride?: 'loss' | 'accuracy';
  onMetricModeChange?: (mode: 'loss' | 'accuracy') => void;
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
  selectedDataset = null,
  liveHistory = { loss: [], accuracy: [], validationLoss: [], validationAccuracy: [] },
  showDecisionBoundary = true,
  showMnistCanvas: allowMnistCanvas = true,
  onDigitPredictionComplete,
  metricModeOverride,
  onMetricModeChange,
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

  const [gradCamResult, setGradCamResult] = useState<{
    gradCamImage: string;
    originalImage: string;
    predictedLabel: number;
    confidence: number;
    probabilities: number[];
  } | null>(null);
  const [isGradCamLoading, setIsGradCamLoading] = useState(false);
  const [gradCamError, setGradCamError] = useState<string | null>(null);
  const [selectedGradCamIndex, setSelectedGradCamIndex] = useState<number | null>(null);
  const [isGradCamGuideOpen, setIsGradCamGuideOpen] = useState(false);
  const [precomputedAnchors, setPrecomputedAnchors] = useState<
    Array<{ x: number; y: number; label: number }>
  >([]);
  const [isBoundaryLoading, setIsBoundaryLoading] = useState(false);
  const currentDataset = selectedDataset ?? getDatasetFromStatus(trainingStatus);
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
    if (metricModeOverride) {
      setMetricMode(metricModeOverride);
    }
  }, [metricModeOverride]);

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
  const hasConvLayer =
    (trainingStatus?.architecture ?? []).some((layer) => layer.includes('Conv2d('));
  const activeBoundaryAnchors =
    trainingStatus?.datasetId === currentDataset?.id &&
    trainingStatus?.decisionBoundaryAnchors &&
    trainingStatus.decisionBoundaryAnchors.length > 0
      ? trainingStatus.decisionBoundaryAnchors
      : precomputedAnchors;

  useEffect(() => {
    const datasetId = currentDataset?.id;
    if (!datasetId || !['mnist', 'fashion_mnist', 'cifar10'].includes(datasetId)) {
      setPrecomputedAnchors([]);
      setIsBoundaryLoading(false);
      return;
    }

    let cancelled = false;
    setIsBoundaryLoading(true);
    getDecisionBoundaryAnchors(datasetId)
      .then((response) => {
        if (!cancelled) {
          setPrecomputedAnchors(response.anchors ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPrecomputedAnchors([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsBoundaryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentDataset?.id]);
  const showGradCam =
    showSamplePredictor &&
    currentDataset != null &&
    (currentDataset.id === 'fashion_mnist' || currentDataset.id === 'cifar10') &&
    hasConvLayer;
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
  const gradCamTopPredictions =
    gradCamResult && currentDataset?.classLabels
      ? getTopPredictions(gradCamResult.probabilities, currentDataset.classLabels, 5)
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
    setGradCamResult(null);
    setGradCamError(null);
    setSelectedGradCamIndex(null);
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
      onDigitPredictionComplete?.();
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

  const runGradCam = async (classIndex: number) => {
    if (!trainingStatus?.jobId) return;

    setSelectedGradCamIndex(classIndex);
    setIsGradCamLoading(true);
    setGradCamResult(null);
    setGradCamError(null);
    try {
      const result = await generateGradCam(trainingStatus.jobId, classIndex);
      setGradCamResult(result);
    } catch (error) {
      console.error('Grad-CAM failed', error);
      setGradCamError(error instanceof Error ? error.message : 'Grad-CAM generation failed');
    } finally {
      setIsGradCamLoading(false);
    }
  };

  return (
    <aside className="ui-surface grid content-start gap-4 bg-[linear-gradient(180deg,#fbfcff_0%,#f7f9ff_100%)] p-4">
      <section className="grid gap-4 px-1 pt-1">
        <div className="rounded-[20px] border border-[#d9e2ef] bg-[linear-gradient(180deg,#ffffff,#f8fbff)] px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
          <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
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
              <span className="text-[10px]">{epochLabel}</span>
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
        <section className="rounded-[22px] border border-[#d9e2ef] bg-[linear-gradient(180deg,#ffffff,#f7faff)] p-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)]" data-tutorial-target="tutorial-mnist-canvas">
          <div className="mb-3 flex items-center justify-between">
            <strong className="font-display text-[16px] font-bold text-ink">MNIST Canvas</strong>
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
              Draw, Then Predict
            </span>
          </div>

          <div className="grid gap-3">
            <canvas
              ref={drawingCanvasRef}
              width={280}
              height={280}
              className="h-[220px] w-full touch-none rounded-[16px] border border-[#cbd5e1] bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
              onPointerDown={startDrawing}
              onPointerMove={drawDigit}
              onPointerUp={stopDrawing}
              onPointerLeave={stopDrawing}
            />

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={clearDrawing}
                className="rounded-full border border-[#c7d6ef] bg-white px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-muted shadow-sm"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  void runDigitPrediction();
                }}
                disabled={isPredicting}
                className="rounded-full bg-[linear-gradient(135deg,#1151ff,#3d73ff)] px-4 py-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-white shadow-[0_10px_22px_rgba(17,81,255,0.2)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isPredicting ? 'Predicting...' : 'Predict'}
              </button>
            </div>

            {digitPrediction ? (
              <div className="grid gap-3 rounded-[18px] border border-[#dce6f6] bg-[linear-gradient(135deg,#ffffff,#eef4ff)] px-4 py-4 shadow-[0_12px_28px_rgba(17,81,255,0.08)]">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">
                      Predicted Digit
                    </div>
                    <div className="mt-1 font-display text-[28px] font-bold text-primary">
                      {digitPrediction.predictedLabel}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">
                      Confidence
                    </div>
                    <div className="mt-1 font-display text-[20px] font-bold text-ink">
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

      {showGradCam && currentDataset ? (
        <section className="rounded-[22px] border border-[#d9e2ef] bg-[linear-gradient(180deg,#ffffff,#f8fbff)] p-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <strong className="font-display text-[16px] font-bold text-ink">
              {currentDataset.label} Grad-CAM
            </strong>
            <button
              type="button"
              onClick={() => setIsGradCamGuideOpen(true)}
              aria-label="Grad-CAM 설명 보기"
              className="grid h-9 w-9 place-items-center rounded-full bg-[#f5f7fb] text-[#9daecc] transition hover:bg-[#eef3fb] hover:text-[#8498bb]"
            >
              <Icon name="help" className="h-8 w-8" />
            </button>
          </div>

          <div className="grid gap-4">
            <div className="grid grid-cols-5 gap-2">
              {currentDataset.classLabels?.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => void runGradCam(index)}
                  disabled={isGradCamLoading}
                  className={[
                    'flex flex-col items-center gap-1.5 rounded-[12px] border py-2.5 transition-all',
                    selectedGradCamIndex === index
                      ? 'border-primary bg-primary/5 shadow-[0_4px_12px_rgba(17,81,255,0.1)]'
                      : 'border-[#dbe5f1] bg-white/60 hover:border-[#bdd1f3] hover:bg-white',
                  ].join(' ')}
                >
                  <div className="overflow-hidden rounded-full border border-[rgba(129,149,188,0.2)] bg-white p-1 shadow-sm">
                    {currentDataset.sampleClasses?.[index]?.imageSrc ? (
                      <img 
                        src={currentDataset.sampleClasses[index].imageSrc} 
                        alt={label} 
                        className="h-7 w-7 rounded-full object-cover grayscale-[0.4]" 
                      />
                    ) : (
                      <div className="h-7 w-7 bg-slate-100" />
                    )}
                  </div>
                  <span className={[
                    'text-[9px] font-bold uppercase tracking-tight',
                    selectedGradCamIndex === index ? 'text-primary' : 'text-muted'
                  ].join(' ')}>
                    {label.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>

            {isGradCamLoading ? (
              <div className="flex h-48 flex-col items-center justify-center rounded-[20px] border border-dashed border-[#dbe5f1] bg-white/40">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Analyzing Attention ...</span>
              </div>
            ) : gradCamResult ? (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="flex gap-3">
                  <div className="flex-1 overflow-hidden rounded-[16px] border border-[rgba(129,149,188,0.14)] bg-black shadow-md">
                    <div className="bg-black/80 py-1 text-center text-[9px] font-bold uppercase tracking-widest text-white">Input</div>
                    <img 
                      src={gradCamResult.originalImage} 
                      alt="Original" 
                      className="aspect-square w-full object-contain" 
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </div>
                  <div className="flex-1 overflow-hidden rounded-[16px] border border-[rgba(129,149,188,0.14)] bg-black shadow-md">
                    <div className="bg-black/80 py-1 text-center text-[9px] font-bold uppercase tracking-widest text-white">Grad-CAM</div>
                    <img 
                      src={gradCamResult.gradCamImage} 
                      alt="Grad-CAM" 
                      className="aspect-square w-full object-contain" 
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </div>
                </div>
                <div className="mt-2 text-center text-[10px] font-bold text-muted uppercase tracking-wider">
                  Target: {currentDataset.classLabels?.[selectedGradCamIndex ?? 0]}
                </div>

                <div className="mt-4 grid gap-3 rounded-[20px] bg-white/80 p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">Model Belief</div>
                      <div className="mt-0.5 font-display text-[18px] font-bold text-primary">
                        {currentDataset.classLabels?.[gradCamResult.predictedLabel]}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">Confidence</div>
                      <div className="mt-0.5 font-display text-[18px] font-bold text-ink">
                        {(gradCamResult.confidence * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2.5">
                    {gradCamTopPredictions.map((prediction) => (
                      <div key={prediction.index} className="grid gap-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold text-ink">
                          <span>{prediction.label}</span>
                          <span className="text-muted">{(prediction.probability * 100).toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[#f0f4fa]">
                          <div
                            className="h-full rounded-full bg-[linear-gradient(90deg,#1151ff,#4f7dff)] shadow-[0_0_8px_rgba(17,81,255,0.3)] transition-all duration-700"
                            style={{ width: `${Math.max(prediction.probability * 100, 2)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : gradCamError ? (
              <div className="rounded-[16px] bg-[#ffeef1] p-3 text-xs font-semibold text-[#a4384f]">
                {gradCamError}
              </div>
            ) : (
              <div className="flex h-32 flex-col items-center justify-center rounded-[20px] border border-dashed border-[#dbe5f1] bg-white/40 text-center px-6">
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7b8da9]">Select a class above to see where the model focuses its attention</span>
              </div>
            )}
          </div>
        </section>
      ) : showSamplePredictor && currentDataset && selectedSample ? (
        <section className="rounded-[22px] border border-[#d9e2ef] bg-[linear-gradient(180deg,#ffffff,#f8fbff)] p-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <strong className="font-display text-[1rem] font-bold text-ink">
              {currentDataset.label} Sample Predictor
            </strong>
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
              Sample Selection
            </span>
          </div>

          <div className="grid gap-2.5">
            <div className="grid grid-cols-5 gap-2">
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
                      'flex flex-col items-center gap-1.5 rounded-[12px] border py-2.5 transition-all',
                      active
                        ? 'border-primary bg-primary/5 shadow-[0_4px_12px_rgba(17,81,255,0.1)]'
                        : 'border-[#dbe5f1] bg-white/60 hover:border-[#bdd1f3] hover:bg-white',
                    ].join(' ')}
                  >
                    <div className="overflow-hidden rounded-full border border-[rgba(129,149,188,0.2)] bg-white p-1 shadow-sm">
                      {sample.imageSrc ? (
                        <img
                          src={sample.imageSrc}
                          alt={sample.label}
                          className="h-7 w-7 rounded-full object-cover grayscale-[0.25]"
                        />
                      ) : (
                        <div className="h-7 w-7 bg-slate-100" />
                      )}
                    </div>
                    <span
                      className={[
                        'text-[9px] font-bold uppercase tracking-tight text-center',
                        active ? 'text-primary' : 'text-muted',
                      ].join(' ')}
                    >
                      {sample.label.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] font-semibold leading-5 text-[#5e6e86]">
                Select a sample image and inspect the model probability distribution.
              </div>
              <button
                type="button"
                onClick={() => {
                  void runSamplePrediction();
                }}
                disabled={isSamplePredicting}
                className="rounded-full bg-primary px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-70"
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
                    <div className="mt-1 font-display text-[20px] font-bold text-primary">
                      {currentDataset.classLabels?.[samplePrediction.predictedLabel] ??
                        `Class ${samplePrediction.predictedLabel}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">
                      Confidence
                    </div>
                    <div className="mt-1 font-display text-[20px] font-bold text-ink">
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

      <section
        className="rounded-[22px] bg-panel/80 p-3.5"
        data-tutorial-target="tutorial-training-metrics"
      >
        <div className="mb-3 flex items-start justify-between">
          <strong className="font-display text-[16px] font-bold text-ink">Training Metrics</strong>
          <div className="flex rounded-full bg-white/75 p-1 text-[11px] font-extrabold uppercase tracking-[0.16em]">
            <button
              type="button"
              onClick={() => {
                setMetricMode('loss');
                onMetricModeChange?.('loss');
              }}
              className={[
                'rounded-full px-3 py-1 transition-colors',
                metricMode === 'loss' ? 'bg-primary text-white' : 'text-muted',
              ].join(' ')}
            >
              Loss
            </button>
            <button
              type="button"
              onClick={() => {
                setMetricMode('accuracy');
                onMetricModeChange?.('accuracy');
              }}
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
            <strong className="font-display text-[16px] font-bold text-ink">Decision Boundary</strong>
            <span className="text-muted">↗</span>
          </div>
          <div className="grid gap-2 rounded-[18px] border border-dashed border-[rgba(129,149,188,0.28)] bg-[linear-gradient(180deg,rgba(244,247,255,0.78),rgba(236,241,252,0.48))] p-2">
            {activeBoundaryAnchors.length > 0 ? (
              <DecisionBoundaryCanvas
                anchors={activeBoundaryAnchors}
                predictions={trainingStatus?.decisionBoundaryPredictions}
                classLabels={currentDataset?.classLabels}
              />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded-[12px] border border-dashed border-[rgba(129,149,188,0.3)] bg-[rgba(247,250,255,0.6)]">
                <span className="text-sm font-semibold uppercase tracking-[0.16em] text-[#7b8da9] animate-pulse">
                  {isBoundaryLoading ? 'Loading ...' : 'No Data'}
                </span>
              </div>
            )}
          </div>
        </section>
      ) : null}
      {isGradCamGuideOpen ? (
        <GradCamGuideModal onClose={() => setIsGradCamGuideOpen(false)} />
      ) : null}
    </aside>
  );
}

function GradCamGuideModal({ onClose }: { onClose: () => void }) {
  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[260] flex items-start justify-center bg-[rgba(15,23,42,0.28)] px-6 pb-6 pt-14 backdrop-blur-sm">
      <div className="relative w-full max-w-[1120px] overflow-hidden rounded-[34px] bg-[linear-gradient(180deg,#ffffff,#f7faff)] p-7 shadow-[0_30px_80px_rgba(13,27,51,0.22)] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.14)] md:p-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full bg-white text-[#7b8da9] shadow-[0_12px_24px_rgba(13,27,51,0.08)] transition hover:text-[#12213f]"
          aria-label="설명 닫기"
        >
          <span className="text-[22px] leading-none">×</span>
        </button>

        <div className="grid gap-6 md:grid-cols-[540px_minmax(0,1fr)] md:gap-8">
          <div className="rounded-[28px] bg-[linear-gradient(180deg,#f3f7ff,#ffffff)] p-6 shadow-[inset_0_0_0_1px_rgba(129,149,188,0.12)]">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-[18px] bg-white text-primary">
                <Icon name="help" className="h-6 w-6" />
              </div>
              <div>
                <div className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-[#71839d]">
                  Visualization Guide
                </div>
                <div className="font-display text-[26px] font-bold text-ink">Grad-CAM 이란?</div>
              </div>
            </div>
            
            <div className="overflow-hidden rounded-[24px] bg-white shadow-md">
              <img 
                src="/images/gradcam_guide.png" 
                alt="Grad-CAM Cat and Dog Example" 
                className="w-full object-cover"
              />
            </div>
            <div className="mt-4 text-center text-[14px] font-bold text-primary">
              인공지능이 분류할 때, 이미지의 어떤 부분을 보고 그렇게 판단했는지 시각적으로 보여줍니다.
            </div>
          </div>

          <div className="grid content-start gap-5">
            <div>
              <div className="text-[13px] font-extrabold uppercase tracking-[0.18em] text-primary/70">
                모델의 판단 근거를 시각화하는 도구
              </div>
              <div className="mt-2 text-[19px] leading-9 text-[#50617c]">
                Grad-CAM은 신경망의 그래디언트(Gradient) 정보를 활용하여 특징 맵상의 중요도를 히트맵으로 표현합니다.
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[20px] bg-white px-5 py-4 text-[14px] leading-7 text-[#50617c] shadow-[0_10px_24px_rgba(13,27,51,0.05)] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.1)]">
                붉게 표시된 영역일수록 모델이 해당 클래스를 판별하는 데 결정적인 역할을 한 부분입니다.
              </div>
              <div className="rounded-[20px] bg-white px-5 py-4 text-[14px] leading-7 text-[#50617c] shadow-[0_10px_24px_rgba(13,27,51,0.05)] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.1)]">
                모델이 엉뚱한 곳을 보고 있다면 데이터셋의 노이즈나 잘못된 학습 방향을 의심해볼 수 있습니다.
              </div>
              <div className="rounded-[20px] bg-white px-5 py-4 text-[14px] leading-7 text-[#50617c] shadow-[0_10px_24px_rgba(13,27,51,0.05)] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.1)]">
                주로 마지막 컨볼루션(CNN) 레이어의 출력을 기반으로 계산하여 공간적인 정보를 보존합니다.
              </div>
            </div>

            <div className="rounded-[22px] bg-[linear-gradient(135deg,#edf4ff,#f4f8ff)] px-5 py-5 shadow-[inset_0_0_0_1px_rgba(17,81,255,0.08)]">
              <div className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-primary">
                Quick Tip
              </div>
              <div className="mt-2 text-[14px] leading-7 text-[#41526d]">
                학습이 잘 된 모델은 인식하려는 사물의 핵심적인 특징(예: 개/고양이의 얼굴, 바지의 실루엣 등)에 강하게 반응합니다.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
