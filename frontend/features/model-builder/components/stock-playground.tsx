'use client';

import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from 'react';
import { Icon } from '@/features/model-builder/components/icons';
import { trainStockModel } from '@/lib/api/stocks';
import type { StockPlaygroundNode, StockPreset, StockTrainingResult } from '@/types/builder';

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

type StockBlockTemplate = Omit<StockPlaygroundNode, 'id'>;

const stockBlockTemplates: StockBlockTemplate[] = [
  {
    type: 'lstm',
    title: 'LSTM Layer',
    icon: 'chip',
    accent: 'emerald',
    fields: [
      { label: 'Input Size', value: '1' },
      { label: 'Hidden Size', value: '48' },
      { label: 'Num Layers', value: '1' },
    ],
    activation: 'None',
    activationOptions: ['None'],
  },
  {
    type: 'dropout',
    title: 'Dropout Layer',
    icon: 'dropout',
    accent: 'rose',
    fields: [{ label: 'Probability', value: '0.15' }],
    activation: 'None',
    activationOptions: ['None'],
  },
  {
    type: 'linear',
    title: 'Linear Layer',
    icon: 'layers',
    accent: 'blue',
    fields: [
      { label: 'Input', value: '48' },
      { label: 'Output', value: '1' },
    ],
    activation: 'None',
    activationOptions: ['None', 'ReLU', 'Tanh', 'GELU', 'Sigmoid'],
  },
];

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

function cloneTemplate(type: StockPlaygroundNode['type'], count: number): StockPlaygroundNode {
  const template = stockBlockTemplates.find((item) => item.type === type);
  if (!template) {
    throw new Error(`Unknown stock block type: ${type}`);
  }

  return {
    ...template,
    id: `stock-${type}-${count}`,
    fields: template.fields.map((field) => ({ ...field })),
    activationOptions: [...template.activationOptions],
  };
}

function defaultStockNodes() {
  return [
    cloneTemplate('lstm', 1),
    cloneTemplate('dropout', 2),
    cloneTemplate('linear', 3),
  ];
}

function blockLibrarySurface(accent: StockPlaygroundNode['accent']) {
  const palette = {
    blue: 'from-[#edf3ff] to-[#e5edff] text-[#2456c9]',
    amber: 'from-[#fff4ea] to-[#ffeddc] text-[#b95b16]',
    violet: 'from-[#f4efff] to-[#eee6ff] text-[#6846bd]',
    rose: 'from-[#fff0f4] to-[#ffe7ed] text-[#b43b5c]',
    emerald: 'from-[#ebfbf5] to-[#e1f7ef] text-[#0b7d6f]',
  } as const;

  return palette[accent];
}

function blockAccentBar(accent: StockPlaygroundNode['accent']) {
  const palette = {
    blue: 'bg-[#4f7dff]',
    amber: 'bg-[#e58a3a]',
    violet: 'bg-[#8b67eb]',
    rose: 'bg-[#de6d8c]',
    emerald: 'bg-[#19a38f]',
  } as const;

  return palette[accent];
}

function blockTone(accent: StockPlaygroundNode['accent']) {
  const palette = {
    blue: {
      card: 'bg-[#edf4ff]',
      bar: 'bg-[#2463eb]',
      chip: 'bg-[#dbe8ff] text-[#2456c9]',
    },
    amber: {
      card: 'bg-[#fff1e6]',
      bar: 'bg-[#de7a2d]',
      chip: 'bg-[#ffe1cc] text-[#b95b16]',
    },
    violet: {
      card: 'bg-[#f2eeff]',
      bar: 'bg-[#7b5ad6]',
      chip: 'bg-[#e5dcff] text-[#6846bd]',
    },
    rose: {
      card: 'bg-[#fff0f4]',
      bar: 'bg-[#d45a7a]',
      chip: 'bg-[#ffdbe6] text-[#b43b5c]',
    },
    emerald: {
      card: 'bg-[#ddf5ef]',
      bar: 'bg-[#169b8a]',
      chip: 'bg-[#c8ede3] text-[#0b7d6f]',
    },
  } as const;

  return palette[accent];
}

function fieldValue(node: StockPlaygroundNode, label: string, fallback: string) {
  return node.fields.find((field) => field.label === label)?.value ?? fallback;
}

function numeric(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stackWarnings(nodes: StockPlaygroundNode[]) {
  const warnings: string[] = [];
  let currentSize = 1;
  let seenLinear = false;
  let hasLstm = false;

  nodes.forEach((node) => {
    if (node.type === 'lstm') {
      if (seenLinear) {
        warnings.push('LSTM 블럭은 Linear head보다 앞에 있어야 합니다.');
      }
      const inputSize = numeric(fieldValue(node, 'Input Size', String(currentSize)), currentSize);
      const hiddenSize = numeric(fieldValue(node, 'Hidden Size', '48'), 48);
      if (inputSize !== currentSize) {
        warnings.push(`${node.title}의 Input Size를 ${currentSize}로 맞춰주세요.`);
      }
      currentSize = hiddenSize;
      hasLstm = true;
      return;
    }

    if (node.type === 'dropout') {
      const probability = numeric(fieldValue(node, 'Probability', '0.15'), 0.15);
      if (probability < 0 || probability >= 1) {
        warnings.push('Dropout Probability는 0 이상 1 미만이어야 합니다.');
      }
      return;
    }

    seenLinear = true;
    const inputSize = numeric(fieldValue(node, 'Input', String(currentSize)), currentSize);
    const outputSize = numeric(fieldValue(node, 'Output', '1'), 1);
    if (inputSize !== currentSize) {
      warnings.push(`${node.title}의 Input을 ${currentSize}로 맞춰주세요.`);
    }
    currentSize = outputSize;
  });

  if (!hasLstm) {
    warnings.push('최소 1개의 LSTM Layer가 필요합니다.');
  }
  const lastNode = nodes.at(-1);
  if (!lastNode || lastNode.type !== 'linear' || numeric(fieldValue(lastNode, 'Output', '1'), 1) !== 1) {
    warnings.push('마지막 블럭은 Output 1의 Linear Layer여야 합니다.');
  }

  return Array.from(new Set(warnings));
}

export function StockPlayground({ selectedStock }: StockPlaygroundProps) {
  const [nodes, setNodes] = useState<StockPlaygroundNode[]>(defaultStockNodes);
  const [draggingType, setDraggingType] = useState<StockPlaygroundNode['type'] | null>(null);
  const [lookbackWindow, setLookbackWindow] = useState('30');
  const [forecastDays, setForecastDays] = useState('14');
  const [epochs, setEpochs] = useState('35');
  const [batchSize, setBatchSize] = useState('32');
  const [learningRate, setLearningRate] = useState('0.001');
  const [metricMode, setMetricMode] = useState<'loss' | 'accuracy'>('loss');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StockTrainingResult | null>(null);
  const warnings = useMemo(() => stackWarnings(nodes), [nodes]);
  const lstmNode = nodes.find((node) => node.type === 'lstm') ?? null;
  const stackStatus = warnings.length ? 'Needs Review' : 'Ready To Train';
  const stackStatusTone = warnings.length ? 'text-[#a16207] bg-[#fff7d6]' : 'text-[#0b7d6f] bg-[#e8faf4]';

  useEffect(() => {
    setError(null);
    setResult(null);
  }, [selectedStock.ticker]);

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

  const addNode = (type: StockPlaygroundNode['type'], index?: number) => {
    setNodes((current) => {
      const nextNode = cloneTemplate(type, current.length + 1);
      const next = [...current];
      const insertAt = index == null ? next.length : Math.max(0, Math.min(index, next.length));
      next.splice(insertAt, 0, nextNode);
      return next;
    });
  };

  const moveNode = (index: number, direction: -1 | 1) => {
    setNodes((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(nextIndex, 0, moved);
      return next;
    });
  };

  const updateNodeField = (id: string, label: string, value: string) => {
    setNodes((current) =>
      current.map((node) =>
        node.id !== id
          ? node
          : {
              ...node,
              fields: node.fields.map((field) =>
                field.label === label ? { ...field, value } : field,
              ),
            },
      ),
    );
  };

  const updateNodeActivation = (id: string, value: string) => {
    setNodes((current) =>
      current.map((node) => (node.id === id ? { ...node, activation: value } : node)),
    );
  };

  const removeNode = (id: string) => {
    setNodes((current) => current.filter((node) => node.id !== id));
  };

  const handleDrop = (event: DragEvent<HTMLElement>, index?: number) => {
    event.preventDefault();
    if (!draggingType) {
      return;
    }
    addNode(draggingType, index);
    setDraggingType(null);
  };

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
        hiddenSize: numeric(fieldValue(nodes.find((node) => node.type === 'lstm') ?? cloneTemplate('lstm', 0), 'Hidden Size', '48'), 48),
        learningRate: Number(learningRate),
        nodes,
      });
      setResult(nextResult);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '주식 Playground를 실행하지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="grid min-h-0 gap-3">
      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="ui-surface overflow-hidden px-4 py-4">
          <div className="ui-subtle-surface px-6 py-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="ui-section-title">Playground Builder</div>
                <div className="mt-2 font-display text-[30px] font-bold tracking-[-0.045em] text-[#10213b]">
                  Stock Forecast Lab
                </div>
                <div className="mt-2 max-w-[720px] text-[14px] leading-6 text-[#54657f]">
                  직접 LSTM 스택을 조립하고, 시계열 흐름을 학습한 뒤 검증 구간과 미래 거래일 예측을 한 화면에서 확인합니다.
                </div>
              </div>
              <div className="rounded-[22px] border border-white/80 bg-white/94 px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                <div className="ui-section-title">Selected Market</div>
                <div className="mt-1 font-display text-[24px] font-bold text-primary">{selectedStock.ticker}</div>
                <div className="text-[12px] font-semibold text-[#5d718f]">{selectedStock.label}</div>
                <div className="mt-3 inline-flex rounded-full bg-[#f4f7fb] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#60718a]">
                  {selectedStock.sector}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-2.5 md:grid-cols-4">
              <OverviewChip label="Ticker" value={selectedStock.ticker} muted={selectedStock.label} badgeLabel="market" />
              <OverviewChip label="Stack Depth" value={`${nodes.length} Layers`} muted="LSTM / Dropout / Linear" badgeLabel="stack" />
              <OverviewChip label="Primary Hidden" value={`${numeric(fieldValue(lstmNode ?? cloneTemplate('lstm', 0), 'Hidden Size', '48'), 48)}`} muted="sequence width" badgeLabel="shape" />
              <OverviewChip label="Build Status" value={stackStatus} muted={warnings.length ? `${warnings.length} checks` : 'shape aligned'} toneClassName={stackStatusTone} badgeLabel="status" />
            </div>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[300px_minmax(0,1.2fr)]">
              <div className="ui-subtle-surface px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="ui-section-title">Block Library</div>
                    <div className="mt-1 text-[13px] leading-6 text-[#5d718f]">
                      필요한 레이어를 골라 스택에 쌓아보세요.
                    </div>
                  </div>
                  <span className="rounded-full bg-[#eef4ff] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-primary">
                    {stockBlockTemplates.length} blocks
                  </span>
                </div>
                <div className="mt-3 grid gap-2.5">
                  {stockBlockTemplates.map((block) => (
                    <div
                      key={block.type}
                      className="relative w-full overflow-hidden rounded-[22px] border border-[#d9e2ef] bg-[linear-gradient(180deg,#ffffff,#f8fbff)] shadow-[0_10px_24px_rgba(13,27,51,0.04)]"
                    >
                      <div className={['pointer-events-none absolute inset-y-3 left-0 w-1 rounded-r-full opacity-90', blockAccentBar(block.accent)].join(' ')} />
                      <button
                        type="button"
                        draggable
                        onDragStart={() => setDraggingType(block.type)}
                        onDragEnd={() => setDraggingType(null)}
                        onClick={() => addNode(block.type)}
                        className="flex min-h-[76px] w-full cursor-grab items-center gap-3 rounded-[22px] px-4 py-3.5 text-left transition-transform hover:-translate-y-0.5 hover:bg-white/80 active:cursor-grabbing"
                      >
                        <div className={['grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-gradient-to-br', blockLibrarySurface(block.accent)].join(' ')}>
                          <Icon name={block.icon} className="h-5 w-5" />
                        </div>
                        <div className="grid gap-0.5">
                          <h3 className="text-[16px] font-semibold leading-[1.2] tracking-[-0.02em] text-[#16233b]">
                            {block.title}
                          </h3>
                          <div className="text-[11px] font-medium tracking-[-0.01em] text-[#8391a8]">
                            Drag to add
                          </div>
                        </div>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDrop(event)}
                className="ui-subtle-surface px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="ui-section-title">Model Stack</div>
                    <div className="mt-1 text-[13px] leading-6 text-[#5d718f]">위에서 아래로 순서대로 실행됩니다.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNodes(defaultStockNodes());
                      setResult(null);
                      setError(null);
                    }}
                    className="rounded-[14px] border border-white/80 bg-white/92 px-4 py-2 text-[12px] font-extrabold tracking-[0.04em] text-primary shadow-[0_8px_20px_rgba(15,23,42,0.04)] transition hover:bg-[#f8fbff]"
                  >
                    Reset Stack
                  </button>
                </div>

                <div className="mt-4 rounded-[22px] border border-dashed border-[#d5deeb] bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(245,248,252,0.92))] px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-[13px] font-semibold text-[#5d718f]">
                      Sequence flow: input window {'->'} recurrent encoder {'->'} prediction head
                    </div>
                    <div className="rounded-full bg-white px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#60718a] shadow-[0_6px_14px_rgba(15,23,42,0.04)]">
                      {nodes.length} active steps
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  {nodes.map((node, index) => (
                    <article
                      key={node.id}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleDrop(event, index)}
                      className={[
                        'relative w-full rounded-[clamp(24px,2vw,30px)] px-[clamp(12px,1vw,18px)] pb-[clamp(10px,0.9vw,16px)] pt-[clamp(12px,1vw,16px)] shadow-[0_12px_24px_rgba(13,27,51,0.08)]',
                        blockTone(node.accent).card,
                      ].join(' ')}
                    >
                      <div className={['absolute inset-x-3 top-0 h-[7px] rounded-b-[10px] rounded-t-[999px]', blockTone(node.accent).bar].join(' ')} />
                      <div className="pointer-events-none absolute left-1/2 top-0 h-[14px] w-[72px] -translate-x-1/2 -translate-y-[35%] rounded-full border-[3px] border-background bg-white/82 shadow-[0_6px_14px_rgba(13,27,51,0.06)]" />
                      <div className="pointer-events-none absolute left-1/2 bottom-[-8px] h-[16px] w-[52px] -translate-x-1/2 rounded-b-[14px] bg-background/92 shadow-[inset_0_2px_0_rgba(129,149,188,0.14)]" />
                      {index < nodes.length - 1 ? (
                        <div className="pointer-events-none absolute bottom-[-18px] left-9 top-full z-10 w-px bg-[linear-gradient(180deg,rgba(191,204,225,0.9),rgba(191,204,225,0))]" />
                      ) : null}
                      <div className="flex items-start gap-[clamp(12px,1vw,16px)] border-b border-line pb-[clamp(8px,0.8vw,10px)]">
                        <div className="min-w-0 flex-1 grid gap-0.5">
                          <strong className="truncate text-[clamp(15px,1.1vw,17px)] font-semibold tracking-[-0.015em] text-ink">
                            {node.title}
                          </strong>
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="rounded-full bg-white/72 px-[clamp(8px,0.8vw,10px)] py-[clamp(3px,0.35vw,5px)] text-[clamp(10px,0.75vw,11px)] font-bold uppercase tracking-[0.12em] text-muted">
                              {node.fields.length} settings
                            </span>
                            <span className={['rounded-full px-[clamp(8px,0.8vw,10px)] py-[clamp(3px,0.35vw,5px)] text-[clamp(10px,0.75vw,11px)] font-bold uppercase tracking-[0.12em]', blockTone(node.accent).chip].join(' ')}>
                              {node.type === 'lstm'
                                ? `hidden ${fieldValue(node, 'Hidden Size', '48')}`
                                : node.type === 'dropout'
                                  ? `p=${fieldValue(node, 'Probability', '0.15')}`
                                  : node.activation}
                            </span>
                            <span className="rounded-full bg-white/72 px-[clamp(8px,0.8vw,10px)] py-[clamp(3px,0.35vw,5px)] text-[clamp(10px,0.75vw,11px)] font-bold uppercase tracking-[0.12em] text-muted">
                              step {index + 1}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => moveNode(index, -1)}
                            className="rounded-full border border-white/80 bg-[#f2f6fd] px-3 py-1.5 text-[11px] font-extrabold text-[#60718a]"
                          >
                            Up
                          </button>
                          <button
                            type="button"
                            onClick={() => moveNode(index, 1)}
                            className="rounded-full border border-white/80 bg-[#f2f6fd] px-3 py-1.5 text-[11px] font-extrabold text-[#60718a]"
                          >
                            Down
                          </button>
                          <button
                            type="button"
                            onClick={() => removeNode(node.id)}
                            className="rounded-full border border-[#ffd6dc] bg-[#fff1f2] px-3 py-1.5 text-[11px] font-extrabold text-[#b42318]"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="mt-2 grid gap-1.5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.15fr)] xl:items-end">
                        {node.fields.map((field) => (
                          <label
                            key={field.label}
                            className="grid min-w-0 gap-0.5 rounded-[16px] bg-white/72 px-2.5 py-1.5 shadow-[inset_0_0_0_1px_rgba(129,149,188,0.1)]"
                          >
                            <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#44506a]">
                              {field.label}
                            </span>
                            <input
                              value={field.value}
                              onChange={(event) => updateNodeField(node.id, field.label, event.target.value)}
                              className="w-full min-w-0 rounded-[12px] border border-transparent bg-white px-3 py-1.5 text-center text-[14px] font-semibold text-ink shadow-[inset_0_-2px_0_rgba(129,149,188,0.12)] outline-none ring-0 transition-shadow focus:border-primary/30 focus:shadow-[0_0_0_3px_rgba(17,81,255,0.12)]"
                            />
                          </label>
                        ))}
                        {node.activationOptions.length > 1 ? (
                          <label className="grid gap-0.5 rounded-[16px] bg-white/72 px-2.5 py-1.5 shadow-[inset_0_0_0_1px_rgba(129,149,188,0.1)]">
                            <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#44506a]">
                              Activation Function
                            </span>
                            <div className="relative">
                              <select
                                value={node.activation}
                                onChange={(event) => updateNodeActivation(node.id, event.target.value)}
                                className="w-full appearance-none rounded-[12px] border border-transparent bg-white px-3 py-1.5 text-[13px] font-semibold text-ink shadow-[inset_0_-2px_0_rgba(129,149,188,0.12)] outline-none ring-0 transition-shadow focus:border-primary/30 focus:shadow-[0_0_0_3px_rgba(17,81,255,0.12)]"
                              >
                                {node.activationOptions.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                              <Icon name="chevron" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                            </div>
                          </label>
                        ) : (
                          <div className="flex justify-end rounded-[16px] bg-white/62 px-3 py-2 shadow-[inset_0_0_0_1px_rgba(129,149,188,0.1)]">
                            <div className={['rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em]', blockTone(node.accent).chip].join(' ')}>
                              {node.type === 'lstm' ? 'Sequence Encoder' : 'Training-Time Regularization'}
                            </div>
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>

            {warnings.length ? (
              <div className="mt-3 rounded-[20px] border border-[#fde68a] bg-[#fffbeb] px-4 py-4 text-[13px] leading-6 text-[#8a6411] shadow-[0_8px_20px_rgba(15,23,42,0.03)]">
                {warnings.map((warning) => (
                  <div key={warning}>{warning}</div>
                ))}
              </div>
            ) : null}
        </div>

        <div className="ui-surface grid content-start gap-2.5 px-3.5 py-3.5">
          <RailPanel title="Market Snapshot" icon="chip">
            <div className="grid gap-2">
              <RailMetricRow label="Ticker" value={selectedStock.ticker} />
              <RailMetricRow label="Company" value={selectedStock.label} />
              <RailMetricRow label="Sector" value={selectedStock.sector} />
              <RailMetricRow label="Mode" value="LSTM Forecast" />
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
        </div>
      </div>

      <ChartCard
        title="Large Forecast Graph"
        subtitle="실제 종가, 검증 구간 예측, 미래 거래일 예측을 하나의 대형 차트로 정리했습니다."
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

      <div className="sticky bottom-3 z-20">
        <div className="rounded-[30px] border border-white/80 bg-[linear-gradient(180deg,rgba(251,253,255,0.97),rgba(239,245,255,0.94))] px-3 py-3 shadow-[0_24px_60px_rgba(15,23,42,0.16)] backdrop-blur-xl">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.95fr)_minmax(360px,0.95fr)]">
            <div className="rounded-[24px] border border-[#d7e2f2] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(244,248,255,0.88))] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_10px_24px_rgba(15,23,42,0.05)]">
              <div className="grid gap-2.5 lg:grid-cols-[1fr_1fr_0.8fr_0.9fr_1fr]">
                <ControlField label="Lookback Window" value={lookbackWindow} onChange={setLookbackWindow} />
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
                      {isLoading ? 'Training sequence model' : 'Run forecasting'}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNodes(defaultStockNodes());
                    setResult(null);
                    setError(null);
                  }}
                  className="flex min-w-0 items-center gap-3 rounded-[20px] border border-white/80 bg-white/90 px-4 py-3.5 text-left text-[#28405f] shadow-[0_8px_20px_rgba(15,23,42,0.04)] transition hover:bg-white"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-white">
                    <Icon name="reset" className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-[15px] font-bold leading-none">Reset</span>
                    <span className="mt-1 block text-[12px] font-semibold leading-none text-[#61758f]">Clear stack</span>
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
    <div className="rounded-[18px] border border-white/80 bg-white/92 px-4 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
      <div className="ui-section-title">{label}</div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="font-display text-[18px] font-bold text-[#10213b]">{value}</div>
        <div className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] ${toneClassName}`}>
          {badgeLabel}
        </div>
      </div>
      <div className="mt-1 text-[12px] font-semibold text-[#71839d]">{muted}</div>
    </div>
  );
}

function RailPanel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: 'chip' | 'play';
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
      <span className="text-[12px] font-semibold text-[#60718a]">{label}</span>
      <span
        className={[
          'max-w-[60%] truncate text-right font-display text-[14px] font-bold text-[#10213b]',
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
