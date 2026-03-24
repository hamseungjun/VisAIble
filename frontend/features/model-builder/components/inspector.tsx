import { useState } from 'react';
import { stats } from '@/lib/constants/builder-data';
import type { TrainingJobStatus } from '@/types/builder';

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

export function Inspector({ trainingStatus }: InspectorProps) {
  const [metricMode, setMetricMode] = useState<'loss' | 'accuracy'>('loss');
  const [seriesMode, setSeriesMode] = useState<'train' | 'val'>('train');
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
