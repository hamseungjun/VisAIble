'use client';

import { Icon } from '@/features/model-builder/components/icons';
import {
  batchSizeOptions,
  optimizerConfigs,
  optimizerOrder,
  type OptimizerName,
  type OptimizerParams,
} from '@/lib/constants/training-controls';
import type { CanvasNode, TrainingJobStatus } from '@/types/builder';

type TopBarProps = {
  learningRate: string;
  epochs: string;
  batchSize: number;
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
  onBatchSizeChange: (value: number) => void;
  onOptimizerChange: (value: OptimizerName) => void;
  onOptimizerParamChange: (key: keyof OptimizerParams, value: string) => void;
  onTrainingStart: () => void;
  onTrainingPause: () => void;
  onTrainingStop: () => void;
  onModelPreview: () => void;
  onReset: () => void;
  onLogoClick: () => void;
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
  compact?: boolean;
};

export function TopBar({
  learningRate,
  epochs,
  batchSize,
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
  onBatchSizeChange,
  onOptimizerChange,
  onOptimizerParamChange,
  onTrainingStart,
  onTrainingPause,
  onTrainingStop,
  onModelPreview,
  onReset,
  onLogoClick,
}: TopBarProps) {
  const optimizerConfig = optimizerConfigs[optimizer];
  const learningRates = optimizerConfig.learningRates;
  const optimizerField = optimizerConfig.parameter;
  const batchSizeIndex = Math.max(0, batchSizeOptions.indexOf(batchSize as (typeof batchSizeOptions)[number]));
  const learningRateIndex = Math.max(0, learningRates.indexOf(learningRate));
  const optimizerParamIndex =
    optimizerField == null
      ? 0
      : Math.max(0, optimizerField.values.indexOf(optimizerParams[optimizerField.key]));
  const totalParameters = estimateTotalParameters(nodes);
  const summaryItems = [
    { label: 'Dataset', value: selectedDatasetLabel },
    { label: 'Layers', value: `${layerCount}` },
    { label: 'Epochs', value: epochs },
    { label: 'Parameters', value: totalParameters.toLocaleString() },
  ];
  const trainingState = trainingStatus?.status ?? (isTraining ? 'running' : 'idle');
  const trainingStateLabel =
    trainingState === 'running' ? 'Training in progress' : trainingState === 'paused' ? 'Paused' : 'Ready';
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
      compact: true,
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
      compact: true,
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
      compact: true,
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
    <header className="ui-surface px-4 py-4 lg:px-5 lg:py-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(260px,0.78fr)_minmax(520px,1.44fr)_minmax(280px,0.92fr)]">
        <section className="flex min-w-0 flex-col justify-start gap-3 rounded-[24px] bg-[linear-gradient(145deg,rgba(11,17,29,0.98),rgba(28,44,76,0.95))] px-[clamp(14px,1vw,18px)] py-[clamp(14px,1vw,16px)] text-white shadow-[0_22px_44px_rgba(17,24,39,0.22)] xl:w-full">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-white/50">
                Visual Deep Learning Studio
              </div>
              <button
                type="button"
                onClick={onLogoClick}
                className="mt-1 font-display text-[clamp(2rem,2.2vw,2.7rem)] font-bold tracking-[-0.07em] text-white transition-opacity hover:opacity-85"
              >
                VisAible
              </button>
            </div>
            <div className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[11px] font-bold text-white/75">
              {trainingStateLabel}
            </div>
          </div>

          <div className="grid gap-[clamp(8px,0.75vw,11px)] sm:grid-cols-2 xl:grid-cols-2">
            {summaryItems.map((item) => (
              <div
                key={item.label}
                className="rounded-[18px] border border-white/10 bg-white/8 px-3.5 py-3"
              >
                <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/52">
                  {item.label}
                </div>
                <div className="mt-1.5 break-words font-display text-[15px] font-bold leading-[1.15] text-white">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="ui-subtle-surface grid min-w-0 gap-[clamp(10px,0.9vw,14px)] px-[clamp(16px,1.2vw,20px)] py-[clamp(14px,1vw,18px)] sm:grid-cols-2 xl:w-full">
          <div className="sm:col-span-2">
            <div className="ui-section-title">Training Controls</div>
            <div className="mt-1 text-[14px] font-semibold text-[#64748b]">
              자주 조절하는 값들만 위쪽에 모아서, 현재 설정을 한눈에 읽기 쉽게 정리했습니다.
            </div>
          </div>
          <div className="rounded-[20px] border border-[#dce5f1] bg-white px-4 py-[clamp(12px,0.9vw,14px)] shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
            <span className="ui-section-title">
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
                className="h-1 w-full max-w-[clamp(260px,34vw,420px)] accent-primary"
              />
              <code className="block min-w-[78px] text-right font-display text-[13px] font-bold tabular-nums text-[#153ea8]">
                {learningRate}
              </code>
            </div>
          </div>

          <div className="rounded-[20px] border border-[#dce5f1] bg-white px-4 py-[clamp(12px,0.9vw,14px)] shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
            <span className="ui-section-title">
              Batch Size
            </span>
            <div className="mt-2.5 flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={batchSizeOptions.length - 1}
                step={1}
                value={batchSizeIndex}
                onChange={(event) =>
                  onBatchSizeChange(batchSizeOptions[Number(event.target.value)] ?? batchSizeOptions[0])
                }
                className="h-1 w-full max-w-[clamp(260px,34vw,420px)] accent-primary"
              />
              <code className="block min-w-[78px] text-right font-display text-[13px] font-bold tabular-nums text-[#153ea8]">
                {batchSize}
              </code>
            </div>
          </div>

          <div className="rounded-[20px] border border-[#dce5f1] bg-white px-4 py-[clamp(12px,0.9vw,14px)] shadow-[0_10px_24px_rgba(15,23,42,0.04)] sm:col-span-2">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="max-w-[280px]">
                <span className="ui-section-title">
                  Optimizer
                </span>
                <div className="relative mt-2.5 max-w-[280px]">
                  <select
                    value={optimizer}
                    onChange={(event) => onOptimizerChange(event.target.value as OptimizerName)}
                    className="w-full appearance-none rounded-[14px] border border-[#d5deeb] bg-[#f8fbff] px-3 py-2.5 pr-9 font-display text-[15px] font-bold text-[#153ea8] outline-none transition-colors focus:border-primary"
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

              <div className="max-w-[220px]">
                <span className="ui-section-title">
                  Epochs
                </span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={epochs}
                  onChange={(event) => onEpochChange(event.target.value)}
                  className="mt-2.5 w-full rounded-[14px] border border-[#d5deeb] bg-[#f8fbff] px-3 py-2.5 font-display text-[15px] font-bold text-[#153ea8] outline-none transition-colors focus:border-primary"
                />
              </div>

              {optimizerField && optimizer !== 'SGD' ? (
                <div className="max-w-[280px]">
                  <span className="ui-section-title">
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
                      className="h-1 w-full accent-primary"
                    />
                    <code className="block min-w-[78px] text-right font-display text-[13px] font-bold tabular-nums text-[#153ea8]">
                      {optimizerParams[optimizerField.key]}
                    </code>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="ui-subtle-surface flex min-w-0 flex-col gap-[clamp(8px,0.8vw,12px)] px-[clamp(14px,1.1vw,18px)] py-[clamp(14px,1vw,18px)] xl:w-full">
          <div>
            <div className="ui-section-title">Actions</div>
            <div className="mt-1 text-[14px] font-semibold text-[#64748b]">
              학습 실행, 일시정지, 미리보기, 초기화를 여기서 바로 제어할 수 있어요.
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-2">
            {actionButtons.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                data-tutorial-target={action.key === 'start' ? 'tutorial-start-button' : undefined}
                className={[
                  'group flex items-center gap-3 rounded-[18px] border px-3.5 text-left transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 xl:px-4',
                  action.compact ? 'py-2.5 xl:py-3' : 'py-3 xl:py-3.5',
                  action.wide ? 'sm:col-span-2 xl:col-span-2' : '',
                  action.className,
                ].join(' ')}
              >
                <span
                  className={[
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.08)] xl:h-10 xl:w-10',
                    action.iconWrapClassName,
                  ].join(' ')}
                >
                  <Icon name={action.icon} className="h-5 w-5 shrink-0 xl:h-[22px] xl:w-[22px]" />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-[15px] font-bold leading-none xl:text-base">
                    {action.label}
                  </span>
                  {action.compact ? null : (
                    <span className="mt-1 block text-[12px] font-semibold leading-none opacity-70 xl:text-[12.5px]">
                      {action.hint}
                    </span>
                  )}
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
