'use client';

import { Icon } from '@/features/model-builder/components/icons';
import {
  optimizerConfigs,
  optimizerOrder,
  type OptimizerName,
  type OptimizerParams,
} from '@/lib/constants/training-controls';

type TopBarProps = {
  learningRate: string;
  optimizer: OptimizerName;
  optimizerParams: OptimizerParams;
  selectedDatasetLabel: string;
  layerCount: number;
  onLearningRateChange: (value: string) => void;
  onOptimizerChange: (value: OptimizerName) => void;
  onOptimizerParamChange: (key: keyof OptimizerParams, value: string) => void;
  onTrainingStart: () => void;
  onModelPreview: () => void;
  onReset: () => void;
};

export function TopBar({
  learningRate,
  optimizer,
  optimizerParams,
  selectedDatasetLabel,
  layerCount,
  onLearningRateChange,
  onOptimizerChange,
  onOptimizerParamChange,
  onTrainingStart,
  onModelPreview,
  onReset,
}: TopBarProps) {
  const optimizerConfig = optimizerConfigs[optimizer];
  const learningRates = optimizerConfig.learningRates;
  const optimizerField = optimizerConfig.parameter;
  const learningRateIndex = Math.max(0, learningRates.indexOf(learningRate));
  const optimizerParamIndex = Math.max(
    0,
    optimizerField.values.indexOf(optimizerParams[optimizerField.key]),
  );
  const summaryItems = [
    { label: 'Dataset', value: selectedDatasetLabel },
    { label: 'Layers', value: `${layerCount}` },
    { label: 'Optimizer', value: optimizer },
    { label: optimizerField.label, value: optimizerParams[optimizerField.key] },
  ];

  return (
    <header className="border-b border-line bg-white/80 px-4 py-3 backdrop-blur-xl lg:px-5 lg:py-3.5">
      <div className="grid gap-3 xl:grid-cols-[minmax(280px,1.1fr)_minmax(420px,1.35fr)_minmax(260px,0.95fr)]">
        <section className="glass-panel ghost-border flex min-w-0 flex-col justify-between gap-3 rounded-[24px] px-5 py-3 shadow-panel">
          <div className="font-display text-[2rem] font-bold tracking-[-0.06em] text-primary">
            VisAIble
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
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

        <section className="glass-panel ghost-border grid min-w-0 gap-3 rounded-[24px] px-4 py-3 shadow-panel sm:grid-cols-2">
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
        </section>

        <section className="glass-panel ghost-border flex min-w-0 flex-col justify-between gap-3 rounded-[24px] px-4 py-3 shadow-panel">
          <div className="rounded-[20px] bg-[linear-gradient(135deg,rgba(17,81,255,0.08),rgba(10,96,127,0.12))] px-4 py-2.5">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">
              Quick Actions
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <button
              type="button"
              onClick={onTrainingStart}
              className="rounded-[18px] bg-button-primary px-4 py-3 font-display text-sm font-bold text-white shadow-float transition-transform hover:-translate-y-0.5"
            >
              Training Start
            </button>
            <button
              type="button"
              onClick={onModelPreview}
              className="rounded-[18px] bg-white px-4 py-3 font-display text-sm font-bold text-primary shadow-panel transition-transform hover:-translate-y-0.5"
            >
              Model Preview
            </button>
            <button
              type="button"
              onClick={onReset}
              className="sm:col-span-2 xl:col-span-1 rounded-[18px] bg-[#d6e2f8] px-4 py-3 font-display text-sm font-bold text-navy shadow-panel transition-transform hover:-translate-y-0.5"
            >
              Reset Board
            </button>
          </div>
        </section>
      </div>
    </header>
  );
}
