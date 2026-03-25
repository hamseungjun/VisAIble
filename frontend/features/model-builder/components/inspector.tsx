import { useState } from 'react';
import type { TrainingJobStatus } from '@/types/builder';

type InspectorProps = {
  trainingStatus: TrainingJobStatus | null;
  liveHistory: {
    loss: number[];
    accuracy: number[];
    validationLoss: number[];
    validationAccuracy: number[];
  };
};

const GRAPH_WIDTH = 320;
const GRAPH_HEIGHT = 180;
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

export function Inspector({
  trainingStatus,
  liveHistory = { loss: [], accuracy: [], validationLoss: [], validationAccuracy: [] },
}: InspectorProps) {
  const safeLiveHistory = {
    loss: liveHistory.loss ?? [],
    accuracy: liveHistory.accuracy ?? [],
    validationLoss: liveHistory.validationLoss ?? [],
    validationAccuracy: liveHistory.validationAccuracy ?? [],
  };
  const [metricMode, setMetricMode] = useState<'loss' | 'accuracy'>('loss');
  const metrics = trainingStatus?.metrics ?? [];
  const latestMetric = metrics.at(-1);
  const displayTrainLoss = [
    ...metrics.map((item) => item.trainLoss),
    ...safeLiveHistory.loss,
  ];
  const displayTrainAccuracy = [
    ...metrics.map((item) => item.trainAccuracy),
    ...safeLiveHistory.accuracy,
  ];
  const validationLossValues = [
    ...metrics.map((item) => item.validationLoss),
    ...safeLiveHistory.validationLoss,
  ];
  const validationAccuracyValues = [
    ...metrics.map((item) => item.validationAccuracy),
    ...safeLiveHistory.validationAccuracy,
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
  const statusLines = trainingStatus?.error
    ? [trainingStatus.error]
    : latestMetric
      ? [
          `Val Acc ${Math.round(latestMetric.validationAccuracy * 10000) / 100}%`,
          `Val Loss ${latestMetric.validationLoss}`,
          trainingStatus?.device ? `Device ${trainingStatus.device}` : null,
        ].filter((value): value is string => value !== null)
      : [
          trainingStatus?.device ? `Device ${trainingStatus.device}` : 'Run training to see validation metrics.',
        ];
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

  return (
    <aside className="grid content-start gap-4 bg-[linear-gradient(180deg,#fbfcff_0%,#f7f9ff_100%)] p-4">
      <section className="rounded-[22px] bg-panel/80 p-3.5">
        <div className="mb-3 flex items-center justify-between">
          <strong className="font-display text-lg font-bold text-ink">Decision Boundary</strong>
          <span className="text-muted">↗</span>
        </div>
        <div className="relative h-[270px] overflow-hidden rounded-[18px] bg-white/85">
          <div className="absolute inset-x-[-20px] bottom-[-10px] top-[118px] rounded-[46%_34%_24%_8%/28%_22%_26%_12%] bg-[rgba(194,212,251,0.45)]" />
          <span className="absolute left-[46px] top-[56px] h-2 w-2 rounded-full bg-[#6695ff]" />
          <span className="absolute left-[148px] top-[68px] h-2 w-2 rounded-full bg-[#6695ff]" />
          <span className="absolute left-[98px] top-[130px] h-2 w-2 rounded-full bg-[#6695ff]" />
          <span className="absolute left-[224px] top-[218px] h-2 w-2 rounded-full bg-[#5d93a6]" />
          <span className="absolute left-[184px] top-[268px] h-2 w-2 rounded-full bg-[#5d93a6]" />
          <span className="absolute left-[262px] top-[244px] h-2 w-2 rounded-full bg-[#5d93a6]" />

          <div className="absolute bottom-3 right-4 flex gap-4 text-[11px] text-muted">
            <span className="flex items-center gap-2">
              <i className="h-2 w-2 rounded-full bg-primary" />
              Class A
            </span>
            <span className="flex items-center gap-2">
              <i className="h-2 w-2 rounded-full bg-tertiary" />
              Class B
            </span>
          </div>
        </div>
      </section>

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
            preserveAspectRatio="none"
            className="h-[160px] w-full overflow-visible"
          >
            <path
              d={`M${GRAPH_PADDING_X} 36H${GRAPH_WIDTH - GRAPH_PADDING_X}M${GRAPH_PADDING_X} 90H${GRAPH_WIDTH - GRAPH_PADDING_X}M${GRAPH_PADDING_X} 144H${GRAPH_WIDTH - GRAPH_PADDING_X}`}
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

        <div className="mt-4 rounded-[16px] bg-[linear-gradient(135deg,rgba(17,81,255,0.05),rgba(10,96,127,0.08))] px-3.5 py-3">
          <div className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">
            Training Status
          </div>
          <div className="grid gap-1 text-[13px] font-semibold text-ink">
            {statusLines.map((line) => (
              <span
                key={line}
                className={trainingStatus?.error ? 'break-words text-[#b54708]' : undefined}
              >
                {line}
              </span>
            ))}
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
      </section>
    </aside>
  );
}
