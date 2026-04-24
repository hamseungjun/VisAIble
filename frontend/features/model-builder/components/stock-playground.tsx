'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Icon } from '@/features/model-builder/components/icons';
import { trainStockModel } from '@/lib/api/stocks';
import type { StockPreset, StockTrainingResult } from '@/types/builder';

type StockPlaygroundProps = {
  selectedStock: StockPreset;
};

type ChartPoint = {
  key: string;
  value: number;
};

type ChartSeries = {
  label: string;
  color: string;
  dashed?: boolean;
  points: ChartPoint[];
};

const GRAPH_WIDTH = 320;
const GRAPH_HEIGHT = 200;
const GRAPH_PADDING_X = 14;
const GRAPH_PADDING_Y = 12;
const MAX_GRAPH_POINTS = 120;
const DEFAULT_ARCHITECTURE = ['LSTM(1->48, layers=1)', 'Dropout(p=0.15)', 'Linear(48->1)'];

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

export function StockPlayground({ selectedStock }: StockPlaygroundProps) {
  const [lookbackWindow, setLookbackWindow] = useState('30');
  const [forecastDays, setForecastDays] = useState('14');
  const [epochs, setEpochs] = useState('35');
  const [batchSize, setBatchSize] = useState('32');
  const [learningRate, setLearningRate] = useState('0.001');
  const [metricMode, setMetricMode] = useState<'loss' | 'accuracy'>('loss');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StockTrainingResult | null>(null);
  const [isLstmLearnMoreOpen, setIsLstmLearnMoreOpen] = useState(false);

  useEffect(() => {
    setError(null);
    setResult(null);
  }, [selectedStock.ticker]);

  const architecture = result?.architecture ?? DEFAULT_ARCHITECTURE;

  const priceSeries = useMemo<ChartSeries[]>(() => {
    if (!result) {
      return [];
    }

    return [
      {
        label: 'Actual Close',
        color: '#2456c9',
        points: result.history.map((point) => ({ key: point.date, value: point.actual })),
      },
      {
        label: 'Validation Forecast',
        color: '#ef6b3b',
        dashed: true,
        points: result.backtest.map((point) => ({ key: point.date, value: point.predicted })),
      },
      {
        label: 'Future Forecast',
        color: '#0b7d6f',
        dashed: true,
        points: result.forecast.map((point) => ({ key: point.date, value: point.predicted })),
      },
    ];
  }, [result]);

  const batchAccuracySeries = useMemo<ChartSeries[]>(() => {
    if (!result) {
      return [];
    }
    return [
      {
        label: 'Direction Accuracy',
        color: '#0b7d6f',
        points: result.batchMetrics.map((point) => ({
          key: String(point.step),
          value: point.directionAccuracy * 100,
        })),
      },
    ];
  }, [result]);

  const batchLossSeries = useMemo<ChartSeries[]>(() => {
    if (!result) {
      return [];
    }
    return [
      {
        label: 'Batch Loss',
        color: '#ef6b3b',
        points: result.batchMetrics.map((point) => ({
          key: String(point.step),
          value: point.trainLoss,
        })),
      },
      {
        label: 'Validation Loss',
        color: '#2456c9',
        dashed: true,
        points: result.losses.map((point) => ({
          key: String(point.epoch * 1000),
          value: point.validationLoss,
        })),
      },
    ];
  }, [result]);

  const trainingMetricView = useMemo(() => {
    const trainValues =
      metricMode === 'loss'
        ? result?.losses.map((point) => point.trainLoss) ?? []
        : result?.losses.map((point) => point.trainDirectionAccuracy) ?? [];
    const validationValues =
      metricMode === 'loss'
        ? result?.losses.map((point) => point.validationLoss) ?? []
        : result?.losses.map((point) => point.validationDirectionAccuracy) ?? [];
    const compressedTrainValues = compressSeries(trainValues, MAX_GRAPH_POINTS);
    const compressedValidationValues = compressSeries(validationValues, MAX_GRAPH_POINTS);
    const allValues = [...compressedTrainValues, ...compressedValidationValues];
    const domain: [number, number] =
      allValues.length > 0
        ? [Math.min(...allValues), Math.max(...allValues)]
        : [0, 1];
    const latestMetric = result?.losses.at(-1);

    return {
      hasData: allValues.length > 0,
      trainPath: buildPath(compressedTrainValues, GRAPH_WIDTH, GRAPH_HEIGHT, domain),
      validationPath: buildPath(compressedValidationValues, GRAPH_WIDTH, GRAPH_HEIGHT, domain),
      trainSinglePointY: buildSinglePointY(compressedTrainValues, GRAPH_HEIGHT, domain),
      validationSinglePointY: buildSinglePointY(compressedValidationValues, GRAPH_HEIGHT, domain),
      summaryLabel: `Train ${metricMode === 'loss' ? 'Loss' : 'Accuracy'}`,
      summaryValue:
        metricMode === 'loss'
          ? latestMetric
            ? latestMetric.trainLoss.toFixed(4)
            : '--'
          : latestMetric
            ? `${(latestMetric.trainDirectionAccuracy * 100).toFixed(2)}%`
            : '--',
      secondaryLabel: `Val ${metricMode === 'loss' ? 'Loss' : 'Accuracy'}`,
      secondaryValue:
        metricMode === 'loss'
          ? latestMetric
            ? latestMetric.validationLoss.toFixed(4)
            : '--'
          : latestMetric
            ? `${(latestMetric.validationDirectionAccuracy * 100).toFixed(2)}%`
            : '--',
    };
  }, [metricMode, result]);

  const handleTrain = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const nextResult = await trainStockModel({
        ticker: selectedStock.ticker,
        lookbackWindow: Number(lookbackWindow),
        forecastDays: Number(forecastDays),
        epochs: Number(epochs),
        batchSize: Number(batchSize),
        hiddenSize: 48,
        learningRate: Number(learningRate),
      });
      setResult(nextResult);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '주식 Playground를 실행하지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setLookbackWindow('30');
    setForecastDays('14');
    setEpochs('35');
    setBatchSize('32');
    setLearningRate('0.001');
    setMetricMode('loss');
    setError(null);
    setResult(null);
  };

  const introHero = (
    <div className="ui-subtle-surface px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="ui-section-title">Black-Box Playground</div>
          <div className="mt-2 font-display text-[30px] font-bold tracking-[-0.045em] text-[#10213b]">
            Stock Forecast Lab
          </div>
          <div className="mt-2 max-w-[760px] text-[14px] leading-6 text-[#54657f]">
            Playground에서는 블록을 직접 쌓지 않고, 고정된 LSTM 예측 모델을 바로 학습해보며
            lookback, epochs, batch size 같은 하이퍼파라미터가 결과에 어떤 차이를 만드는지
            빠르게 체험합니다.
          </div>
        </div>
        <div className="w-full max-w-[280px] shrink-0 rounded-[22px] border border-white/80 bg-white/94 px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
          <div className="ui-section-title">Selected Market</div>
          <div className="mt-1 font-display text-[24px] font-bold text-primary">{selectedStock.ticker}</div>
          <div className="break-words text-[12px] font-semibold text-[#5d718f]">{selectedStock.label}</div>
          <div className="mt-3 inline-flex max-w-full break-words rounded-full bg-[#f4f7fb] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#60718a]">
            {selectedStock.sector}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-2.5 md:grid-cols-4">
        <OverviewChip label="Ticker" value={selectedStock.ticker} muted={selectedStock.label} badgeLabel="market" />
        <OverviewChip label="Model" value="Default LSTM" muted="fixed sequence forecaster" badgeLabel="black-box" />
        <OverviewChip label="Forecast Horizon" value={`${forecastDays} Days`} muted="future trading sessions" badgeLabel="target" />
        <OverviewChip
          label="Last Validation"
          value={result ? result.metrics.validationRmse.toFixed(2) : 'Not Run'}
          muted={result ? 'validation rmse' : 'train once to compare settings'}
          toneClassName={result ? 'text-[#0b7d6f] bg-[#e8faf4]' : 'text-[#60718a] bg-[#f3f6fb]'}
          badgeLabel="result"
        />
      </div>
    </div>
  );

  const lstmLearnMoreCard = (
    <button
      type="button"
      onClick={() => setIsLstmLearnMoreOpen(true)}
      className="group block w-full overflow-hidden rounded-[26px] p-[1.5px] text-left transition-transform hover:-translate-y-0.5"
      style={{
        background:
          'linear-gradient(120deg, rgba(255,123,172,0.42), rgba(255,211,102,0.42), rgba(125,242,170,0.42), rgba(108,182,255,0.42), rgba(195,128,255,0.42))',
      }}
    >
      <div className="rounded-[25px] bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(249,251,255,0.94))] px-5 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="ui-section-title text-[#7b74a9]">Learn More</div>
            <div className="mt-1 font-display text-[22px] font-bold tracking-[-0.03em] text-[#14284c]">
              주식을 예측하는 LSTM에 대해 더 배워보고 싶다면?
            </div>
            <div className="mt-2 max-w-[720px] text-[13px] leading-6 text-[#62738d]">
              시계열 데이터에서 LSTM이 무엇을 기억하고, lookback window나 hidden state가 예측에 어떤 영향을 주는지
              설명하는 학습형 콘텐츠를 준비 중입니다.
            </div>
          </div>
          <div className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[linear-gradient(135deg,#f6eefe,#eef6ff)] px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#5b66c8]">
            Coming Soon
            <Icon name="rocket" className="h-4 w-4" />
          </div>
        </div>
      </div>
    </button>
  );

  return (
    <section className="grid min-h-0 min-w-0 gap-3">
      <div className="ui-surface overflow-hidden px-4 py-4">
        {!result ? introHero : null}

        {result ? (
          <div className="grid gap-3">
            <div className="mt-3">{lstmLearnMoreCard}</div>
            <div className="mt-3 grid gap-3">
              <ChartCard
                title="Large Forecast Graph"
                subtitle="실제 종가, 검증 구간 예측, 미래 거래일 예측을 가장 먼저 확인할 수 있도록 상단에 배치했습니다."
                series={priceSeries}
                height={420}
                emptyCopy="모델을 학습하면 예측 그래프가 크게 표시됩니다."
              />
              <div className="grid gap-3 xl:grid-cols-2">
                <ChartCard
                  title="Batch Direction Accuracy"
                  subtitle="각 배치에서 예측 방향이 실제 방향과 맞았는지의 비율입니다."
                  series={batchAccuracySeries}
                  height={250}
                  emptyCopy="학습 후 배치 단위 방향성 정확도가 여기에 표시됩니다."
                />
                <ChartCard
                  title="Batch Loss Trace"
                  subtitle="배치 단위 train loss와 epoch 기준 validation loss입니다."
                  series={batchLossSeries}
                  height={250}
                  emptyCopy="학습 후 손실 추적 곡선이 여기에 표시됩니다."
                />
              </div>
            </div>
            <div className="mt-3">{introHero}</div>
          </div>
        ) : null}

        <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.08fr)_340px]">
          <div className="ui-subtle-surface px-5 py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="ui-section-title">Model Capsule</div>
                  <div className="mt-1 font-display text-[24px] font-bold tracking-[-0.03em] text-[#10213b]">
                    고정된 예측 파이프라인
                  </div>
                  <div className="mt-2 max-w-[760px] text-[13px] leading-6 text-[#5d718f]">
                    여기서는 모델 구조 자체를 수정하지 않습니다. 같은 LSTM 구조를 유지한 채 학습 설정을
                    바꿔보면서, 종목과 하이퍼파라미터 변화가 예측 성능에 어떤 영향을 주는지 집중해서 볼 수
                    있습니다.
                  </div>
                </div>
                <div className="rounded-full bg-[#eef4ff] px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-primary">
                  architecture locked
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
                <div className="rounded-[24px] border border-[#d7e2f2] bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(245,248,255,0.92))] px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                  <div className="ui-section-title">Model Flow</div>
                  <div className="mt-3 flex flex-wrap items-center gap-2.5">
                    {architecture.map((item, index) => (
                      <div key={`${item}-${index}`} className="flex items-center gap-2.5">
                        <div className="rounded-[18px] border border-white/80 bg-white px-3.5 py-2 text-[12px] font-bold text-[#17315c] shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
                          {item}
                        </div>
                        {index < architecture.length - 1 ? (
                          <Icon name="chevron" className="h-4 w-4 -rotate-90 text-[#7b8da8]" />
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 grid gap-2 md:grid-cols-3">
                    <MiniNote
                      title="Input"
                      body={`최근 ${lookbackWindow}일 종가 흐름을 시퀀스로 사용`}
                    />
                    <MiniNote
                      title="Encoder"
                      body="LSTM이 시간축 패턴을 압축해 다음 가격 방향을 학습"
                    />
                    <MiniNote
                      title="Output"
                      body={`앞으로 ${forecastDays}일 구간의 흐름을 순차 예측`}
                    />
                  </div>
                </div>

                <div className="rounded-[24px] border border-[#d7e2f2] bg-[linear-gradient(180deg,rgba(238,244,255,0.92),rgba(229,238,255,0.88))] px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                  <div className="ui-section-title">How To Explore</div>
                  <div className="mt-3 grid gap-2.5">
                    <GuideStep step="1" text="같은 종목으로 lookback window를 바꿔 성능 차이를 비교해보세요." />
                    <GuideStep step="2" text="epochs와 learning rate를 바꿔 학습 곡선이 어떻게 달라지는지 보세요." />
                    <GuideStep step="3" text="여러 종목을 선택해 예측 난이도 차이도 함께 관찰해보세요." />
                  </div>
                </div>
              </div>

          </div>

          <div className="ui-surface grid content-start gap-2.5 self-start px-3.5 py-3.5">
              <RailPanel title="Market Snapshot" icon="chip">
                <div className="grid gap-2">
                  <RailMetricRow label="Ticker" value={selectedStock.ticker} />
                  <RailMetricRow label="Company" value={selectedStock.label} />
                  <RailMetricRow label="Sector" value={selectedStock.sector} />
                  <RailMetricRow label="Mode" value="Black-Box LSTM" />
                </div>
              </RailPanel>

              <RailPanel title="Experiment Setup" icon="settings">
                <div className="grid gap-2">
                  <RailMetricRow label="Lookback" value={`${lookbackWindow} days`} />
                  <RailMetricRow label="Forecast" value={`${forecastDays} days`} />
                  <RailMetricRow label="Epochs" value={epochs} />
                  <RailMetricRow label="Batch Size" value={batchSize} />
                  <RailMetricRow label="Learning Rate" value={learningRate} />
                </div>
                <div className="mt-3 rounded-[18px] bg-[linear-gradient(180deg,#f8fbff,#f2f6ff)] px-3.5 py-3 text-[12px] leading-6 text-[#5f718d] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.12)]">
                  같은 종목에서 설정을 조금씩 바꿔가며 `Val RMSE`와 방향성 정확도를 비교하면 어떤 하이퍼파라미터가 민감한지 빠르게 볼 수 있습니다.
                </div>
              </RailPanel>

              <TrainingMetricsPanel
                metricMode={metricMode}
                onMetricModeChange={setMetricMode}
                trainPath={trainingMetricView.trainPath}
                validationPath={trainingMetricView.validationPath}
                trainSinglePointY={trainingMetricView.trainSinglePointY}
                validationSinglePointY={trainingMetricView.validationSinglePointY}
                summaryLabel={trainingMetricView.summaryLabel}
                summaryValue={trainingMetricView.summaryValue}
                secondaryLabel={trainingMetricView.secondaryLabel}
                secondaryValue={trainingMetricView.secondaryValue}
                hasData={trainingMetricView.hasData}
              />

              <RailPanel title="Run Metrics" icon="play">
                <div className="grid gap-2">
                  <RailMetricRow
                    label="Last Close"
                    value={result ? `$${result.metrics.lastClose.toFixed(2)}` : '-'}
                  />
                  <RailMetricRow
                    label="Train RMSE"
                    value={result ? result.metrics.trainRmse.toFixed(2) : '-'}
                  />
                  <RailMetricRow
                    label="Val RMSE"
                    value={result ? result.metrics.validationRmse.toFixed(2) : '-'}
                  />
                  <RailMetricRow
                    label="Forecast Return"
                    value={
                      result
                        ? `${result.metrics.forecastReturnPct >= 0 ? '+' : ''}${result.metrics.forecastReturnPct.toFixed(2)}%`
                        : '-'
                    }
                    valueClassName={
                      result
                        ? result.metrics.forecastReturnPct >= 0
                          ? 'text-[#0b7d6f]'
                          : 'text-[#b42318]'
                        : undefined
                    }
                  />
                </div>
                <div className="mt-3 rounded-[18px] bg-[linear-gradient(180deg,#f8fbff,#f2f6ff)] px-3.5 py-3 text-[12px] leading-6 text-[#5f718d] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.12)]">
                  방향성 정확도는 가격 자체보다 상승·하락 흐름을 얼마나 잘 맞췄는지 보여줍니다.
                </div>
              </RailPanel>

              <RailPanel title="Reading Guide" icon="help">
                <div className="grid gap-2">
                  <GuideHint
                    title="Lookback"
                    body="너무 짧으면 최근 노이즈에 흔들리고, 너무 길면 오래된 패턴까지 같이 끌고 와서 학습이 둔해질 수 있습니다."
                  />
                  <GuideHint
                    title="Epochs"
                    body="Train Loss만 내려가고 Val Loss가 다시 오르면 과적합이 시작됐을 가능성이 큽니다."
                  />
                  <GuideHint
                    title="Forecast Return"
                    body="예측 수익률은 참고 지표일 뿐이고, 검증 RMSE와 방향성 정확도를 함께 보는 편이 더 안정적입니다."
                  />
                </div>
              </RailPanel>
          </div>
        </div>
      </div>

      {!result ? (
        <ChartCard
          title="Large Forecast Graph"
          subtitle="실제 종가, 검증 구간 예측, 미래 거래일 예측을 하나의 대형 차트로 정리했습니다."
          series={priceSeries}
          height={420}
          emptyCopy="모델을 학습하면 예측 그래프가 크게 표시됩니다."
        />
      ) : null}

      {!result ? (
        <div className="grid gap-3 xl:grid-cols-2">
          <ChartCard
            title="Batch Direction Accuracy"
            subtitle="각 배치에서 예측 방향이 실제 방향과 맞았는지의 비율입니다."
            series={batchAccuracySeries}
            height={250}
            emptyCopy="학습 후 배치 단위 방향성 정확도가 여기에 표시됩니다."
          />
          <ChartCard
            title="Batch Loss Trace"
            subtitle="배치 단위 train loss와 epoch 기준 validation loss입니다."
            series={batchLossSeries}
            height={250}
            emptyCopy="학습 후 손실 추적 곡선이 여기에 표시됩니다."
          />
        </div>
      ) : null}

      <div className="sticky bottom-3 z-20">
        <div className="rounded-[30px] border border-white/80 bg-[linear-gradient(180deg,rgba(251,253,255,0.97),rgba(239,245,255,0.94))] px-3 py-3 shadow-[0_24px_60px_rgba(15,23,42,0.16)] backdrop-blur-xl">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.95fr)_minmax(360px,0.95fr)]">
            <div className="rounded-[24px] border border-[#d7e2f2] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(244,248,255,0.88))] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_10px_24px_rgba(15,23,42,0.05)]">
              <div className="grid gap-2.5 lg:grid-cols-[1fr_1fr_0.8fr_0.9fr_1fr]">
                <ControlField label="Lookback" value={lookbackWindow} onChange={setLookbackWindow} />
                <ControlField label="Forecast Days" value={forecastDays} onChange={setForecastDays} />
                <ControlField label="Epochs" value={epochs} onChange={setEpochs} />
                <ControlField label="Batch Size" value={batchSize} onChange={setBatchSize} />
                <ControlField label="Learning Rate" value={learningRate} onChange={setLearningRate} />
              </div>
            </div>

            <div className="rounded-[24px] border border-[#d7e2f2] bg-[linear-gradient(180deg,rgba(238,244,255,0.92),rgba(229,238,255,0.88))] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_10px_24px_rgba(15,23,42,0.05)]">
              <div className="grid gap-2.5 lg:grid-cols-[1.25fr_0.95fr]">
                <button
                  type="button"
                  onClick={handleTrain}
                  disabled={isLoading}
                  className="flex min-w-0 items-center gap-3 rounded-[20px] bg-[linear-gradient(135deg,#1151ff,#2f6cff)] px-4 py-3.5 text-left text-white shadow-[0_16px_36px_rgba(17,81,255,0.24)] transition hover:opacity-95 disabled:cursor-wait disabled:opacity-70"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-white/16">
                    <Icon name={isLoading ? 'stop' : 'play'} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-[16px] font-bold leading-none">
                      {isLoading ? 'Running' : 'Start'}
                    </span>
                    <span className="mt-1 block text-[12px] font-semibold leading-none text-white/80">
                      {isLoading ? 'Training fixed LSTM model' : 'Run forecasting'}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex min-w-0 items-center gap-3 rounded-[20px] border border-white/80 bg-white/90 px-4 py-3.5 text-left text-[#28405f] shadow-[0_8px_20px_rgba(15,23,42,0.04)] transition hover:bg-white"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-white">
                    <Icon name="reset" className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-[15px] font-bold leading-none">Reset</span>
                    <span className="mt-1 block text-[12px] font-semibold leading-none text-[#61758f]">
                      Clear results
                    </span>
                  </span>
                </button>
              </div>
              {error ? (
                <div className="mt-2.5 rounded-[18px] border border-[#fecaca] bg-[#fff5f5] px-4 py-3 text-[13px] font-semibold text-[#b42318]">
                  {error}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {isLstmLearnMoreOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(15,23,42,0.28)] px-4 backdrop-blur-[2px]">
          <div className="w-full max-w-[520px] rounded-[30px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(243,247,255,0.96))] p-[1.5px] shadow-[0_30px_80px_rgba(15,23,42,0.24)]">
            <div className="rounded-[29px] bg-white/96 px-6 py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="ui-section-title">Coming Soon</div>
                  <div className="mt-2 font-display text-[30px] font-bold tracking-[-0.04em] text-[#13284b]">
                    LSTM Deep Dive
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLstmLearnMoreOpen(false)}
                  className="rounded-full border border-[#dbe5f1] bg-[#f8fbff] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#6a7f9d]"
                >
                  Close
                </button>
              </div>
              <div className="mt-4 rounded-[24px] bg-[linear-gradient(135deg,rgba(255,236,246,0.82),rgba(239,246,255,0.86),rgba(242,255,237,0.82))] px-5 py-5">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-[16px] bg-white/80 text-[#5b66c8] shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                    <Icon name="rocket" className="h-5 w-5" />
                  </div>
                  <div className="font-display text-[22px] font-bold text-[#17315c]">
                    곧 열릴 예정이에요
                  </div>
                </div>
                <div className="mt-4 text-[14px] leading-7 text-[#5f718d]">
                  앞으로 이 섹션에서는 시계열 예측용 LSTM의 동작 방식, hidden state, sequence length, overfitting,
                  그리고 주가 데이터에 맞는 해석 포인트를 더 깊게 설명할 예정입니다.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ControlField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="rounded-[18px] border border-white/80 bg-white/96 px-4 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
      <div className="ui-section-title text-[#6b809d]">{label}</div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-[14px] border border-[#d5deeb] bg-[#f8fbff] px-3 py-2.5 font-display text-[15px] font-bold text-[#153ea8] outline-none transition-colors focus:border-primary"
      />
    </label>
  );
}

function MiniNote({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[18px] border border-white/80 bg-white/92 px-4 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
      <div className="ui-section-title">{title}</div>
      <div className="mt-2 text-[12px] leading-5 text-[#60718a]">{body}</div>
    </div>
  );
}

function GuideStep({
  step,
  text,
}: {
  step: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[18px] border border-white/70 bg-white/86 px-3.5 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#e8f0ff] text-[11px] font-extrabold text-primary">
        {step}
      </div>
      <div className="text-[12px] leading-5 text-[#556883]">{text}</div>
    </div>
  );
}

function GuideHint({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[16px] border border-white/80 bg-white/92 px-3.5 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#5f7390]">
        {title}
      </div>
      <div className="mt-1.5 text-[12px] leading-5 text-[#5b6c84]">{body}</div>
    </div>
  );
}

function OverviewChip({
  label,
  value,
  muted,
  toneClassName = 'text-primary bg-[#eef4ff]',
  badgeLabel = 'info',
}: {
  label: string;
  value: string;
  muted: string;
  toneClassName?: string;
  badgeLabel?: string;
}) {
  return (
    <div className="min-w-0 rounded-[18px] border border-white/80 bg-white/92 px-4 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
      <div className="ui-section-title">{label}</div>
      <div className="mt-2 flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0 break-words font-display text-[18px] font-bold text-[#10213b]">{value}</div>
        <div className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] ${toneClassName}`}>
          {badgeLabel}
        </div>
      </div>
      <div className="mt-1 break-words text-[12px] font-semibold text-[#71839d]">{muted}</div>
    </div>
  );
}

function RailPanel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: 'chip' | 'play' | 'settings' | 'help';
  children: ReactNode;
}) {
  return (
    <div className="ui-subtle-surface px-4 py-4">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-[14px] bg-[#edf3ff] text-primary">
          <Icon name={icon} className="h-4.5 w-4.5" />
        </div>
        <div>
          <div className="ui-section-title">{title}</div>
          <div className="mt-1 font-display text-[17px] font-bold tracking-[-0.03em] text-[#10213b]">{title}</div>
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function RailMetricRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[16px] border border-white/80 bg-white/92 px-3.5 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
      <span className="min-w-0 text-[12px] font-semibold text-[#60718a]">{label}</span>
      <span
        className={[
          'max-w-[62%] break-words text-right font-display text-[14px] font-bold leading-5 text-[#10213b]',
          valueClassName ?? '',
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  );
}

function TrainingMetricsPanel({
  metricMode,
  onMetricModeChange,
  trainPath,
  validationPath,
  trainSinglePointY,
  validationSinglePointY,
  summaryLabel,
  summaryValue,
  secondaryLabel,
  secondaryValue,
  hasData,
}: {
  metricMode: 'loss' | 'accuracy';
  onMetricModeChange: (mode: 'loss' | 'accuracy') => void;
  trainPath: string;
  validationPath: string;
  trainSinglePointY: number | null;
  validationSinglePointY: number | null;
  summaryLabel: string;
  summaryValue: string;
  secondaryLabel: string;
  secondaryValue: string;
  hasData: boolean;
}) {
  return (
    <section className="rounded-[22px] bg-panel/80 p-3.5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <strong className="font-display text-[16px] font-bold text-ink">Training Metrics</strong>
        <div className="flex rounded-full bg-white/75 p-1 text-[11px] font-extrabold uppercase tracking-[0.16em]">
          <button
            type="button"
            onClick={() => onMetricModeChange('loss')}
            className={[
              'rounded-full px-3 py-1 transition-colors',
              metricMode === 'loss' ? 'bg-primary text-white' : 'text-muted',
            ].join(' ')}
          >
            Loss
          </button>
          <button
            type="button"
            onClick={() => onMetricModeChange('accuracy')}
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
        {hasData ? (
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
        ) : (
          <div className="flex aspect-[16/10] items-center justify-center rounded-[14px] border border-dashed border-[rgba(129,149,188,0.26)] bg-[#f8fbff] text-[12px] font-semibold uppercase tracking-[0.16em] text-[#7b8da9]">
            Run training to view metrics
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="grid gap-1">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted">
            {summaryLabel}
          </span>
          <strong className="font-display text-[1.8rem] font-bold text-primary">
            {summaryValue}
          </strong>
        </div>
        <div className="grid gap-1 text-right">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted">
            {secondaryLabel}
          </span>
          <strong className="font-display text-[1.8rem] font-bold text-tertiary">
            {secondaryValue}
          </strong>
        </div>
      </div>
    </section>
  );
}

function ChartCard({
  title,
  subtitle,
  series,
  emptyCopy,
  height,
}: {
  title: string;
  subtitle: string;
  series: ChartSeries[];
  emptyCopy: string;
  height: number;
}) {
  const hasSeries = series.some((item) => item.points.length > 0);

  return (
    <div className="ui-surface px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="ui-section-title">{title}</div>
          <div className="mt-2 text-[13px] leading-6 text-[#5d718f]">{subtitle}</div>
        </div>
        {hasSeries ? (
          <div className="flex flex-wrap gap-2">
            {series.map((item) => (
              <div
                key={`${title}-${item.label}`}
                className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-[#f6f8ff] px-3 py-1.5 text-[11px] font-bold text-[#4f617e]"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                {item.label}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {hasSeries ? (
        <SimpleLineChart series={series} height={height} />
      ) : (
        <div className="mt-5 rounded-[20px] border border-white/80 bg-[#f6f8ff] px-4 py-8 text-center text-[13px] leading-6 text-[#60718a]">
          {emptyCopy}
        </div>
      )}
    </div>
  );
}

function SimpleLineChart({
  series,
  height,
}: {
  series: ChartSeries[];
  height: number;
}) {
  const width = 960;
  const padding = 30;
  const keys = Array.from(new Set(series.flatMap((item) => item.points.map((point) => point.key))));
  const valuePool = series.flatMap((item) => item.points.map((point) => point.value));
  const minValue = Math.min(...valuePool);
  const maxValue = Math.max(...valuePool);
  const spread = maxValue - minValue || 1;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const keyIndex = new Map(keys.map((key, index) => [key, index]));

  const xFor = (key: string) => {
    const index = keyIndex.get(key) ?? 0;
    return padding + (keys.length <= 1 ? innerWidth / 2 : (index / (keys.length - 1)) * innerWidth);
  };

  const yFor = (value: number) => padding + innerHeight - ((value - minValue) / spread) * innerHeight;

  return (
    <div className="mt-5">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        <defs>
          <linearGradient id="playgroundChartBg" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fbfdff" />
            <stop offset="100%" stopColor="#f4f8fd" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={width} height={height} rx="22" fill="url(#playgroundChartBg)" stroke="#dbe5f1" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#d5dfef" strokeWidth="1.2" />
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#d5dfef"
          strokeWidth="1.2"
        />
        <line
          x1={padding}
          y1={(padding + (height - padding)) / 2}
          x2={width - padding}
          y2={(padding + (height - padding)) / 2}
          stroke="#e4ebf5"
          strokeWidth="1"
          strokeDasharray="5 5"
        />
        {series.map((item) => {
          const points = item.points.map((point) => `${xFor(point.key)},${yFor(point.value)}`).join(' ');
          return (
            <polyline
              key={item.label}
              points={points}
              fill="none"
              stroke={item.color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={item.dashed ? '8 7' : undefined}
            />
          );
        })}
        <text x={padding} y={18} fill="#7b8da8" fontSize="11" fontWeight="700">
          {maxValue.toFixed(2)}
        </text>
        <text x={padding} y={height - 8} fill="#7b8da8" fontSize="11" fontWeight="700">
          {minValue.toFixed(2)}
        </text>
      </svg>
    </div>
  );
}
