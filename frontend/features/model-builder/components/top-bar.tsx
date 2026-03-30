'use client';

import { Icon } from '@/features/model-builder/components/icons';
import {
  optimizerConfigs,
  optimizerOrder,
  type OptimizerName,
  type OptimizerParams,
} from '@/lib/constants/training-controls';
import type { CanvasNode, TrainingJobStatus } from '@/types/builder';

type TopBarProps = {
  learningRate: string;
  epochs: string;
  optimizer: OptimizerName;
  optimizerParams: OptimizerParams;
  selectedDatasetLabel: string;
  layerCount: number;
  nodes: CanvasNode[];
  trainingStatus: TrainingJobStatus | null;
  hasActiveJob: boolean;
  isTraining: boolean;
  onLearningRateChange: (value: string) => void;
  onEpochChange: (value: string) => void;
  onOptimizerChange: (value: OptimizerName) => void;
  onOptimizerParamChange: (key: keyof OptimizerParams, value: string) => void;
  onTrainingStart: () => void;
  onTrainingPause: () => void;
  onTrainingStop: () => void;
  onModelPreview: () => void;
  onReset: () => void;
};

type ActionButton = {
  key: 'start' | 'pause' | 'stop' | 'preview' | 'reset';
  label: string;
  hint: string;
  icon: 'play' | 'rocket' | 'pause' | 'stop' | 'architecture' | 'reset';
  onClick: () => void;
  disabled: boolean;
  className: string;
  iconWrapClassName: string;
  wide?: boolean;
};

export function TopBar({
  learningRate,
  epochs,
  optimizer,
  optimizerParams,
  selectedDatasetLabel,
  layerCount,
  nodes = [],
  trainingStatus,
  hasActiveJob,
  isTraining,
  onLearningRateChange,
  onEpochChange,
  onOptimizerChange,
  onOptimizerParamChange,
  onTrainingStart,
  onTrainingPause,
  onTrainingStop,
  onModelPreview,
  onReset,
}: TopBarProps) {
  const optimizerConfig = optimizerConfigs[optimizer];
  const learningRates = optimizerConfig.learningRates;
  const optimizerField = optimizerConfig.parameter;
  const formattedDeviceLabel = formatDeviceLabel(trainingStatus?.device);
  const learningRateIndex = Math.max(0, learningRates.indexOf(learningRate));
  const optimizerParamIndex = Math.max(
    0,
    optimizerField.values.indexOf(optimizerParams[optimizerField.key]),
  );
  const totalParameters = estimateTotalParameters(nodes);
  const summaryItems = [
    { label: 'Dataset', value: selectedDatasetLabel },
    { label: 'Layers', value: `${layerCount}` },
    { label: 'Epochs', value: epochs },
    { label: 'Optimizer', value: optimizer },
    { label: 'Batch Size', value: '128' },
    { label: 'Total Parameters', value: totalParameters.toLocaleString() },
  ];
  const trainingState = trainingStatus?.status ?? (isTraining ? 'running' : 'idle');
  const statusChipClassName =
    trainingState === 'failed'
      ? 'bg-[#ffe4e1] text-[#c2412d]'
      : trainingState === 'paused'
        ? 'bg-[#eef3ff] text-primary'
        : trainingState === 'running'
          ? 'bg-[#e9f7ef] text-[#15803d]'
          : 'bg-[rgba(17,81,255,0.08)] text-primary';
  const statusLabel = trainingState === 'failed' ? 'error' : trainingState;
  const primaryTrainingLabel =
    trainingState === 'paused' ? 'Resume' : isTraining ? 'Running' : 'Start';
  const actionButtons: ActionButton[] = [
    {
      key: 'start',
      label: primaryTrainingLabel,
      hint: trainingState === 'paused' ? 'Continue current job' : 'Run training',
      icon: trainingState === 'paused' ? 'play' : isTraining ? 'rocket' : 'play',
      onClick: onTrainingStart,
      disabled: trainingState === 'running',
      className:
        'bg-[linear-gradient(135deg,#1151ff,#2d66ff)] text-white shadow-float',
      iconWrapClassName: 'bg-white/16 text-white',
    },
    {
      key: 'pause',
      label: 'Pause',
      hint: 'Temporarily hold',
      icon: 'pause',
      onClick: onTrainingPause,
      disabled: !hasActiveJob || trainingState === 'paused' || trainingState === 'stopped',
      className:
        'bg-[#edf3ff] text-primary shadow-[inset_0_0_0_1px_rgba(17,81,255,0.08)]',
      iconWrapClassName: 'bg-white text-primary',
    },
    {
      key: 'stop',
      label: 'Stop',
      hint: 'End and reset job',
      icon: 'stop',
      onClick: onTrainingStop,
      disabled: !hasActiveJob || trainingState === 'stopped',
      className:
        'bg-[#fff1e8] text-[#c4683b] shadow-[inset_0_0_0_1px_rgba(196,104,59,0.08)]',
      iconWrapClassName: 'bg-white text-[#c4683b]',
    },
    {
      key: 'preview',
      label: 'Preview',
      hint: 'Model code and figure',
      icon: 'architecture',
      onClick: onModelPreview,
      disabled: false,
      className:
        'bg-white text-primary shadow-[inset_0_0_0_1px_rgba(17,81,255,0.08)]',
      iconWrapClassName: 'bg-[#edf3ff] text-primary',
    },
    {
      key: 'reset',
      label: 'Reset',
      hint: 'Clear board',
      icon: 'reset',
      onClick: onReset,
      disabled: false,
      className:
        'bg-[#d6e2f8] text-navy shadow-[inset_0_0_0_1px_rgba(54,71,97,0.08)]',
      iconWrapClassName: 'bg-white/85 text-navy',
      wide: true,
    },
  ];

  return (
    <header className="border-b border-line bg-white/80 px-4 py-2.5 backdrop-blur-xl lg:px-5 lg:py-3">
      <div className="grid gap-2.5 xl:grid-cols-[minmax(280px,1.1fr)_minmax(420px,1.35fr)_minmax(260px,0.95fr)]">
        <section className="glass-panel ghost-border flex min-w-0 flex-col justify-start gap-2 rounded-[24px] px-5 py-3 shadow-panel">
          <div className="flex items-start justify-between gap-3">
            <div className="font-display text-[2rem] font-bold tracking-[-0.06em] text-primary">
              VisAIble
            </div>
            <div className="shrink-0 rounded-full bg-[rgba(17,81,255,0.08)] px-3 py-1 text-right">
              <div className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-muted">
                Device
              </div>
              <div className="font-display text-xs font-bold uppercase text-primary">
                {formattedDeviceLabel}
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {summaryItems.map((item) => (
              <div
                key={item.label}
                className="rounded-[18px] bg-[rgba(17,81,255,0.06)] px-3.5 py-2.5"
              >
                <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">
                  {item.label}
                </div>
                <div className="mt-1 truncate font-display text-sm font-bold text-ink">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-panel ghost-border grid min-w-0 gap-2.5 rounded-[24px] px-4 py-3 shadow-panel sm:grid-cols-2">
          <div className="rounded-[20px] bg-white/75 px-4 py-2.5 shadow-[inset_0_0_0_1px_rgba(129,149,188,0.12)]">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">
              Learning Rate
            </span>
            <div className="mt-2.5 flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={learningRates.length - 1}
                step={1}
                value={learningRateIndex}
                onChange={(event) =>
                  onLearningRateChange(learningRates[Number(event.target.value)] ?? learningRates[0])
                }
                className="h-1 w-full max-w-[280px] accent-primary"
              />
              <code className="block min-w-[72px] text-right font-display text-xs font-bold tabular-nums text-primary">
                {learningRate}
              </code>
            </div>
          </div>

          <div className="rounded-[20px] bg-white/75 px-4 py-2.5 shadow-[inset_0_0_0_1px_rgba(129,149,188,0.12)]">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">
              {optimizerField.label}
            </span>
            <div className="mt-2.5 flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={optimizerField.values.length - 1}
                step={1}
                value={optimizerParamIndex}
                onChange={(event) =>
                  onOptimizerParamChange(
                    optimizerField.key,
                    optimizerField.values[Number(event.target.value)] ?? optimizerField.values[0],
                  )
                }
                className="h-1 w-full max-w-[280px] accent-primary"
              />
              <code className="block min-w-[72px] text-right font-display text-xs font-bold tabular-nums text-primary">
                {optimizerParams[optimizerField.key]}
              </code>
            </div>
          </div>

          <div className="rounded-[20px] bg-white/75 px-4 py-2.5 shadow-[inset_0_0_0_1px_rgba(129,149,188,0.12)] sm:col-span-2">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,280px)_140px]">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">
                  Optimizer
                </span>
                <div className="relative mt-2.5 max-w-[280px]">
                  <select
                    value={optimizer}
                    onChange={(event) => onOptimizerChange(event.target.value as OptimizerName)}
                    className="w-full appearance-none rounded-[14px] border border-line bg-white/80 px-3 py-2.5 pr-9 font-display text-sm font-bold text-primary outline-none transition-colors focus:border-primary"
                  >
                    {optimizerOrder.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <Icon
                    name="chevron"
                    className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-primary"
                  />
                </div>
              </div>

              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">
                  Epochs
                </span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={epochs}
                  onChange={(event) => onEpochChange(event.target.value)}
                  className="mt-2.5 w-full rounded-[14px] border border-line bg-white/80 px-3 py-2.5 font-display text-sm font-bold text-primary outline-none transition-colors focus:border-primary"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="glass-panel ghost-border flex min-w-0 flex-col gap-2 rounded-[24px] px-4 py-3 shadow-panel">
          <div className="mb-0.5 flex items-center justify-between px-1">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">
              Quick Actions
            </span>
            <span
              className={[
                'rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em]',
                statusChipClassName,
              ].join(' ')}
            >
              {statusLabel}
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-2">
            {actionButtons.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                className={[
                  'group flex items-center gap-3 rounded-[18px] px-3.5 py-3 text-left transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50',
                  action.wide ? 'sm:col-span-2 xl:col-span-2' : '',
                  action.className,
                ].join(' ')}
              >
                <span
                  className={[
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.08)]',
                    action.iconWrapClassName,
                  ].join(' ')}
                >
                  <Icon name={action.icon} className="h-5 w-5 shrink-0" />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-sm font-bold leading-none">
                    {action.label}
                  </span>
                  <span className="mt-1 block text-[11px] font-semibold leading-none opacity-70">
                    {action.hint}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </header>
  );
}

function fieldValue(node: CanvasNode, label: string, fallback: string) {
  return node.fields.find((field) => field.label === label)?.value ?? fallback;
}

function parseKernelSize(value: string) {
  if (value.toLowerCase().includes('x')) {
    return Number(value.toLowerCase().split('x')[0]?.trim() ?? '1');
  }
  return Number(value);
}

function estimateTotalParameters(nodes: CanvasNode[]) {
  let total = 0;

  nodes.forEach((node) => {
    if (node.type === 'cnn') {
      const channelIn = Number(fieldValue(node, 'Channel In', '1'));
      const channelOut = Number(fieldValue(node, 'Channel Out', '1'));
      const kernel = parseKernelSize(fieldValue(node, 'Kernel Size', '3x3'));
      total += channelOut * channelIn * kernel * kernel + channelOut;
      return;
    }

    if (node.type === 'linear') {
      const input = Number(fieldValue(node, 'Input', '1'));
      const output = Number(fieldValue(node, 'Output', '1'));
      total += input * output + output;
    }
  });

  return total;
}

function formatDeviceLabel(device?: string | null) {
  if (!device) {
    return 'Auto';
  }

  return device.toUpperCase();
}
