'use client';

import Image from 'next/image';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/features/model-builder/components/icons';
import { searchStocks } from '@/lib/api/stocks';
import { datasets, libraryBlocks } from '@/lib/constants/builder-data';
import { stockPlaygroundPresets } from '@/lib/constants/stock-playground';
import type { BlockAccent, BlockType, DatasetItem, StockPreset, WorkspaceMode } from '@/types/builder';

type SidebarProps = {
  selectedDatasetId: string;
  activeWorkspace: WorkspaceMode;
  hasCompetitionRoom?: boolean;
  selectedDataset?: DatasetItem | null;
  availableBlockTypes: BlockType[];
  minaHighlightBlockType?: BlockType | null;
  selectedTutorialLessonId?: string | null;
  selectedStock?: StockPreset | null;
  onDatasetSelect: (datasetId: string) => void;
  onTutorialLessonSelect?: (lessonId: string) => void;
  onStockSelect?: (stock: StockPreset) => void;
  onBlockDragStart: (type: BlockType) => void;
  onBlockDragEnd: () => void;
};

type TutorialLesson = {
  id: string;
  code: string;
  title: string;
  track: string;
  datasetId: string;
  icon: 'layers' | 'panel' | 'flask';
  paletteClass: string;
  accentClassName: string;
  summary: string;
  bullets: string[];
};

function accentClassName(accent: BlockAccent) {
  const palette: Record<BlockAccent, string> = {
    blue: 'text-[#2456c9]',
    amber: 'text-[#b95b16]',
    violet: 'text-[#6846bd]',
    rose: 'text-[#b43b5c]',
    emerald: 'text-[#0b7d6f]',
  };

  return palette[accent];
}

function accentSurfaceClassName(accent: BlockAccent) {
  const palette: Record<BlockAccent, string> = {
    blue: 'from-[#edf3ff] to-[#e5edff] text-[#2456c9]',
    amber: 'from-[#fff4ea] to-[#ffeddc] text-[#b95b16]',
    violet: 'from-[#f4efff] to-[#eee6ff] text-[#6846bd]',
    rose: 'from-[#fff0f4] to-[#ffe7ed] text-[#b43b5c]',
    emerald: 'from-[#ebfbf5] to-[#e1f7ef] text-[#0b7d6f]',
  };

  return palette[accent];
}

const tutorialLessons: TutorialLesson[] = [
  {
    id: 'mlp-1-1',
    code: 'MLP 1-1',
    title: 'Dense Network Warmup',
    track: 'MLP Track',
    datasetId: 'mnist',
    icon: 'layers',
    paletteClass: 'bg-[#edf3ff] text-[#2456c9]',
    accentClassName: 'text-[#2456c9]',
    summary: '현재 MLP 튜토리얼 흐름 그대로, 손글씨 숫자를 펼쳐서 처음으로 분류해보는 입문 수업입니다.',
    bullets: [
      'MNIST 입력 차원과 Linear 입력/출력을 연결하는 기본 흐름을 익힙니다.',
      'Optimizer, Learning Rate, Batch Size, Epoch가 학습에 어떻게 연결되는지 처음 감각적으로 봅니다.',
      '처음 만든 MLP가 손글씨 숫자를 읽으며 미션으로 이어지는 구조를 그대로 경험합니다.',
    ],
  },
  {
    id: 'mlp-1-2',
    code: 'MLP 1-2',
    title: 'Stack One More Layer',
    track: 'MLP Track',
    datasetId: 'mnist',
    icon: 'layers',
    paletteClass: 'bg-[#edf3ff] text-[#2456c9]',
    accentClassName: 'text-[#2456c9]',
    summary: '은닉층을 하나 더 쌓아 단순한 MLP보다 더 복잡한 패턴을 표현하게 만드는 확장 수업입니다.',
    bullets: [
      '한 층짜리 MLP보다 더 깊은 구조가 왜 필요한지 비교합니다.',
      '층을 추가했을 때 표현력과 학습 안정성이 어떻게 바뀌는지 관찰합니다.',
      '깊이를 늘릴수록 튜닝 포인트가 같이 늘어난다는 점을 자연스럽게 익힙니다.',
    ],
  },
  {
    id: 'cnn-1-1',
    code: 'CNN 1-1',
    title: 'From Dense to Filters',
    track: 'CNN Track',
    datasetId: 'fashion_mnist',
    icon: 'panel',
    paletteClass: 'bg-[#fff4ea] text-[#b95b16]',
    accentClassName: 'text-[#b95b16]',
    summary: 'MLP의 한계를 확인한 뒤, 이미지의 공간 정보를 살리는 CNN을 처음 도입하는 전환 수업입니다.',
    bullets: [
      '이미지를 펼쳐버리는 MLP와 달리 CNN이 왜 지역 패턴을 먼저 본다고 말하는지 연결합니다.',
      '컨볼루션과 pooling이 어떤 순서로 특징을 압축하는지 처음 익힙니다.',
      '패션 이미지처럼 형태 정보가 중요한 데이터에서 CNN의 강점을 체감하게 합니다.',
    ],
  },
  {
    id: 'cnn-1-2',
    code: 'CNN 1-2',
    title: 'Deep Feature Builder',
    track: 'CNN Track',
    datasetId: 'fashion_mnist',
    icon: 'panel',
    paletteClass: 'bg-[#fff4ea] text-[#b95b16]',
    accentClassName: 'text-[#b95b16]',
    summary: 'CNN을 한 층 더 깊게 쌓아 더 다양한 특징을 뽑아내고, 성능 변화를 직접 비교하는 수업입니다.',
    bullets: [
      '컨볼루션 층이 늘어날수록 더 추상적인 특징이 쌓인다는 점을 봅니다.',
      '채널 수와 깊이가 늘수록 계산량과 표현력이 함께 커진다는 점을 체감합니다.',
      '단순 CNN과 깊은 CNN의 차이를 같은 데이터셋에서 바로 비교할 수 있습니다.',
    ],
  },
  {
    id: 'cnn-1-3',
    code: 'CNN 1-3',
    title: 'Generalization With Augmentation',
    track: 'CNN Track',
    datasetId: 'cifar10',
    icon: 'flask',
    paletteClass: 'bg-[#ebfbf5] text-[#0b7d6f]',
    accentClassName: 'text-[#0b7d6f]',
    summary: 'CNN이 과적합되는 순간을 잡아내고, 데이터 증강으로 더 튼튼한 시야를 만드는 실전 수업입니다.',
    bullets: [
      '같은 구조라도 데이터 다양성이 부족하면 검증 성능이 쉽게 흔들린다는 점을 확인합니다.',
      'MixUp, CutMix 같은 증강이 왜 일반화 성능 개선에 연결되는지 실험적으로 이해합니다.',
      '실전 이미지 분류에서는 모델 구조만큼 데이터 준비가 중요하다는 감각을 얻게 됩니다.',
    ],
  },
];

export function Sidebar({
  selectedDatasetId,
  activeWorkspace,
  hasCompetitionRoom = false,
  selectedDataset,
  availableBlockTypes,
  minaHighlightBlockType = null,
  selectedTutorialLessonId = null,
  selectedStock,
  onDatasetSelect,
  onTutorialLessonSelect,
  onStockSelect,
  onBlockDragStart,
  onBlockDragEnd,
}: SidebarProps) {
  const [hoveredDatasetId, setHoveredDatasetId] = useState<string | null>(null);
  const [isCompetitionDatasetOpen, setIsCompetitionDatasetOpen] = useState(false);
  const [activeGuideBlockId, setActiveGuideBlockId] = useState<BlockType | null>(null);
  const [openedTutorialLessonId, setOpenedTutorialLessonId] = useState<string | null>(
    selectedTutorialLessonId,
  );
  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [stockSearchResults, setStockSearchResults] = useState<StockPreset[]>(stockPlaygroundPresets);
  const [stockSearchBusy, setStockSearchBusy] = useState(false);
  const hoveredDataset =
    datasets.find((dataset) => dataset.id === hoveredDatasetId) ?? null;
  const activeTutorialLesson =
    activeWorkspace === 'tutorial'
      ? (tutorialLessons.find((lesson) => lesson.id === openedTutorialLessonId) ?? null)
      : null;
  const activeTutorialDataset =
    activeTutorialLesson
      ? (selectedDataset?.id === activeTutorialLesson.datasetId
          ? selectedDataset
          : datasets.find((dataset) => dataset.id === activeTutorialLesson.datasetId) ?? null)
      : null;
  const activeGuideBlock =
    libraryBlocks.find((block) => block.id === activeGuideBlockId && availableBlockTypes.includes(block.id)) ?? null;
  const visibleBlocks =
    activeWorkspace === 'tutorial'
      ? libraryBlocks.filter((block) => availableBlockTypes.includes(block.id))
      : libraryBlocks;
  const selectedStockPreset =
    selectedStock ?? stockPlaygroundPresets[0];

  useEffect(() => {
    if (activeWorkspace !== 'playground') {
      return;
    }

    const query = stockSearchQuery.trim();
    if (!query) {
      setStockSearchResults(stockPlaygroundPresets);
      setStockSearchBusy(false);
      return;
    }

    let active = true;
    setStockSearchBusy(true);
    const timer = window.setTimeout(() => {
      void searchStocks(query)
        .then((results) => {
          if (!active) {
            return;
          }
          setStockSearchResults(results);
        })
        .catch(() => {
          if (!active) {
            return;
          }
          const lowered = query.toLowerCase();
          setStockSearchResults(
            stockPlaygroundPresets.filter((item) =>
              [item.ticker, item.label, item.sector].some((value) =>
                value.toLowerCase().includes(lowered),
              ),
            ),
          );
        })
        .finally(() => {
          if (active) {
            setStockSearchBusy(false);
          }
        });
    }, 280);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [activeWorkspace, stockSearchQuery]);

  return (
    <aside className="relative z-10 min-w-0 overflow-hidden ui-surface flex h-full flex-col gap-4 px-5 py-5">
      {activeWorkspace === 'builder' ? (
        <section className="grid gap-2.5">
            <h2 className="ui-section-title">
              Dataset Selection
            </h2>
            <div className="relative grid gap-2">
              {datasets.map((dataset) => (
                <button
                  key={dataset.id}
                  type="button"
                  onClick={() => onDatasetSelect(dataset.id)}
                  onMouseEnter={() => setHoveredDatasetId(dataset.id)}
                  onMouseLeave={() => setHoveredDatasetId((current) => (current === dataset.id ? null : current))}
                  className={[
                    'flex items-center gap-3 rounded-[18px] border px-3.5 py-3 text-left text-[13px] font-semibold transition-colors',
                    dataset.id === selectedDatasetId
                      ? 'border-primary/25 bg-primary/10 text-primary shadow-[0_8px_20px_rgba(17,81,255,0.08)]'
                      : 'border-transparent text-[#4b5b77] hover:border-[#d9e2ef] hover:bg-white/80',
                  ].join(' ')}
                >
                  <Icon name={dataset.icon} />
                  <span>{dataset.label}</span>
                </button>
              ))}

              {hoveredDataset ? (
                <FloatingInfoPanel interactive={false}>
                  <DatasetDetailPanel
                    dataset={hoveredDataset}
                    widthClassName="w-[min(680px,calc(100vw-360px))]"
                    largeSamples
                  />
                </FloatingInfoPanel>
              ) : null}
            </div>
          </section>
      ) : null}

      {activeWorkspace === 'tutorial' ? (
        <section className="grid gap-2.5">
          <h2 className="ui-section-title">
            Class Selection
          </h2>
          <div className="relative grid gap-2">
            {tutorialLessons.map((lesson) => {
              return (
                <button
                  key={lesson.id}
                  type="button"
                  onClick={() => {
                    onDatasetSelect(lesson.datasetId);
                    setOpenedTutorialLessonId(lesson.id);
                    onTutorialLessonSelect?.(lesson.id);
                  }}
                  className={[
                    'flex items-start gap-3 rounded-[18px] border px-3.5 py-3 text-left transition-colors',
                    (selectedTutorialLessonId ?? openedTutorialLessonId) === lesson.id
                      ? 'border-primary/25 bg-primary/10 text-primary shadow-[0_8px_20px_rgba(17,81,255,0.08)]'
                      : 'border-transparent text-[#4b5b77] hover:border-[#d9e2ef] hover:bg-white/80',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'grid h-8 w-8 place-items-center rounded-[12px]',
                      lesson.paletteClass,
                    ].join(' ')}
                  >
                    <Icon name={lesson.icon} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#7c8ca5]">
                      {lesson.code}
                    </div>
                    <div className="mt-1 text-[13px] font-bold leading-5 text-[#10213b]">
                      {lesson.title}
                    </div>
                  </span>
                </button>
              );
            })}

          </div>
        </section>
      ) : null}

      {activeWorkspace === 'competition' && hasCompetitionRoom && selectedDataset ? (
        <section className="relative grid gap-2.5">
          <h2 className="ui-section-title">
            Classroom
          </h2>
          <div className="rounded-[22px] bg-white px-4 py-4 shadow-[0_12px_28px_rgba(13,27,51,0.06)] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.12)]">
            <div className="ui-label">
              Selected Dataset
            </div>
            <div className="mt-2 font-display text-[16px] font-bold leading-[1.2] text-ink">
              {selectedDataset.label}
            </div>
            <div className="mt-2 text-[13px] font-semibold text-[#60708b]">
              {selectedDataset.inputShape ?? '-'} · {selectedDataset.records ?? '-'}
            </div>
            <button
              type="button"
              onClick={() => setIsCompetitionDatasetOpen((current) => !current)}
              className="mt-4 w-full rounded-[16px] bg-[#edf3ff] px-4 py-3 text-[13px] font-extrabold tracking-[0.04em] text-primary transition hover:bg-[#e1ebff]"
            >
              데이터셋 정보 보기
            </button>
          </div>

          {isCompetitionDatasetOpen ? (
            <FloatingInfoPanel>
              <DatasetDetailPanel
                dataset={selectedDataset}
                widthClassName="w-[min(680px,calc(100vw-360px))]"
                largeSamples
                onClose={() => setIsCompetitionDatasetOpen(false)}
              />
            </FloatingInfoPanel>
          ) : null}
        </section>
      ) : null}

      {activeWorkspace === 'playground' ? (
        <section className="grid gap-3">
          <h2 className="ui-section-title">Stock Prediction</h2>
          <label className="rounded-[20px] border border-[#d9e2ef] bg-white px-4 py-3 shadow-[0_10px_24px_rgba(13,27,51,0.04)]">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#70819a]">
              Search Ticker
            </div>
            <input
              value={stockSearchQuery}
              onChange={(event) => setStockSearchQuery(event.target.value)}
              placeholder="AAPL, Tesla, AMD..."
              className="mt-2 w-full border-none bg-transparent font-display text-[18px] font-bold text-[#10213b] outline-none placeholder:font-semibold placeholder:text-[#9badc3]"
            />
            <div className="mt-2 text-[11px] font-semibold text-[#7386a3]">
              {stockSearchBusy ? '검색 중...' : '티커 또는 회사명으로 검색해서 바로 학습할 수 있습니다.'}
            </div>
          </label>
          <div className="grid gap-2 min-w-0">
            {stockSearchResults.map((preset) => {
              const active = preset.ticker === selectedStockPreset?.ticker;
              return (
                <button
                  key={preset.ticker}
                  type="button"
                  onClick={() => onStockSelect?.(preset)}
                  className={[
                    'min-w-0 overflow-hidden rounded-[18px] border px-3.5 py-3 text-left transition-colors',
                    active
                      ? 'border-primary/25 bg-primary/10 shadow-[0_8px_20px_rgba(17,81,255,0.08)]'
                      : 'border-transparent hover:border-[#d9e2ef] hover:bg-white/80',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[14px] bg-[#edf3ff] text-primary">
                      <Icon name="chip" className="h-4.5 w-4.5" />
                    </span>
                    <span className="min-w-0 flex-1 overflow-hidden">
                      <div className="flex min-w-0 items-center justify-between gap-2">
                        <span className="min-w-0 truncate font-display text-[15px] font-bold text-[#10213b]">
                          {preset.label}
                        </span>
                        <span className="shrink-0 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-extrabold tracking-[0.12em] text-[#6280aa]">
                          {preset.ticker}
                        </span>
                      </div>
                      <div className="mt-1 truncate text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#6a7f9d]">
                        {preset.sector}
                      </div>
                      <div className="mt-2 overflow-hidden break-words text-[12px] leading-5 text-[#5b6c84]">
                        {preset.description}
                      </div>
                    </span>
                  </div>
                </button>
              );
            })}
            {!stockSearchResults.length && !stockSearchBusy ? (
              <div className="rounded-[18px] border border-dashed border-[#d9e2ef] px-4 py-4 text-[12px] leading-5 text-[#6b809d]">
                검색 결과가 없습니다. 티커 기호를 정확히 입력해 보세요.
              </div>
            ) : null}
          </div>

          {selectedStockPreset ? (
            <div className="rounded-[22px] border border-[#d9e2ef] bg-[linear-gradient(180deg,#ffffff,#f8fbff)] px-4 py-4 shadow-[0_10px_24px_rgba(13,27,51,0.04)]">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#70819a]">
                Selected Ticker
              </div>
              <div className="mt-2 font-display text-[20px] font-bold text-[#10213b]">
                {selectedStockPreset.ticker}
              </div>
              <div className="mt-1 break-words text-[13px] font-semibold text-[#4d607d]">
                {selectedStockPreset.label}
              </div>
              <div className="mt-3 break-words rounded-[16px] bg-[#f5f8ff] px-3.5 py-3 text-[12px] leading-5 text-[#5b6c84]">
                {selectedStockPreset.description}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeWorkspace !== 'playground' ? (
        <section className="sticky top-4 grid w-full content-start gap-2 self-stretch">
          <h2 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#7f8ea6]">
            Block Library
          </h2>
          <div className="grid gap-2.5" data-tutorial-target="tutorial-block-library">
            {visibleBlocks.map((block) => (
              <div
                key={block.id}
                className={[
                  'relative w-full overflow-hidden rounded-[22px] border bg-[linear-gradient(180deg,#ffffff,#f8fbff)] shadow-[0_10px_24px_rgba(13,27,51,0.04)]',
                  minaHighlightBlockType === block.id
                    ? 'ui-amber-advice animate-amber-pulse ring-0'
                    : 'border-[#d9e2ef]',
                ].join(' ')}
                data-tutorial-target={block.id === 'linear' ? 'tutorial-linear-block' : undefined}
              >
                <div
                  className={[
                    'pointer-events-none absolute inset-y-3 left-0 w-1 rounded-r-full opacity-90',
                    block.accent === 'blue'
                      ? 'bg-[#4f7dff]'
                      : block.accent === 'amber'
                        ? 'bg-[#e58a3a]'
                        : block.accent === 'violet'
                          ? 'bg-[#8b67eb]'
                          : block.accent === 'rose'
                            ? 'bg-[#de6d8c]'
                            : 'bg-[#19a38f]',
                  ].join(' ')}
                />
                <button
                  type="button"
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'copy';
                    event.dataTransfer.setData('application/x-builder-block', block.id);
                    event.dataTransfer.setData('text/plain', block.id);
                    onBlockDragStart(block.id);
                  }}
                  onDragEnd={onBlockDragEnd}
                  className={[
                    'flex min-h-[76px] w-full cursor-grab items-center gap-3 rounded-[22px] px-4 py-3.5 pr-14 text-left transition-transform hover:-translate-y-0.5 hover:bg-white/80 active:cursor-grabbing',
                    minaHighlightBlockType === block.id ? 'bg-white/40' : '',
                  ].join(' ')}
                >
                  <div
                    className={[
                      'grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-gradient-to-br',
                      accentSurfaceClassName(block.accent),
                    ].join(' ')}
                  >
                    <Icon name={block.icon} className="h-5 w-5" />
                  </div>
                  <div className="grid gap-0.5">
                    <h3 className="text-[16px] font-semibold leading-[1.2] tracking-[-0.02em] text-[#16233b]">
                      {block.title}
                    </h3>
                    {minaHighlightBlockType === block.id ? (
                      <div className="text-[11px] font-extrabold tracking-[0.04em] text-[#2456c9]">
                        Mina 추천: 이 블록을 추가해보세요
                      </div>
                    ) : (
                      <div className="text-[11px] font-medium tracking-[-0.01em] text-[#8391a8]">
                        Drag to add
                      </div>
                    )}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveGuideBlockId(block.id)}
                  aria-label={`${block.title} 설명 보기`}
                  className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-[#e3eaf4] bg-[#f7faff] text-[#9daecc] transition hover:bg-[#eef3fb] hover:text-[#8498bb]"
                >
                  <Icon name="help" className="h-4.5 w-4.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {activeGuideBlock ? (
        <LayerGuideModal block={activeGuideBlock} onClose={() => setActiveGuideBlockId(null)} />
      ) : null}
    </aside>
  );
}

function TutorialLessonPanel({
  lesson,
  dataset,
  onClose,
}: {
  lesson: TutorialLesson;
  dataset: DatasetItem;
  onClose: () => void;
}) {
  const trackLessons = tutorialLessons.filter((item) => item.track === lesson.track);
  const previewSamples = (dataset.sampleClasses ?? []).slice(0, 4);

  return (
    <div className="flex max-h-[calc(100vh-40px)] w-[min(860px,calc(100vw-460px))] min-w-[720px] flex-col overflow-hidden rounded-[30px] border border-[rgba(110,132,174,0.24)] bg-[linear-gradient(180deg,#ffffff,#f8fbff)] px-6 py-5 shadow-[0_34px_80px_rgba(13,27,51,0.2)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-extrabold uppercase tracking-[0.2em] text-[#70819a]">
            {lesson.track}
          </div>
          <div className="mt-2 font-display text-[26px] font-bold leading-[1.04] tracking-[-0.04em] text-[#10213b]">
            {lesson.title}
          </div>
          <div className="mt-3 max-w-[700px] text-[14px] leading-6.5 text-[#53637f]">
            {lesson.summary}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-[#fecaca] bg-[#fff1f2] px-4 py-2 text-[13px] font-extrabold uppercase tracking-[0.16em] text-[#b42318] shadow-[0_8px_18px_rgba(180,35,24,0.16)] transition hover:bg-[#ffe4e6]"
        >
          Close
        </button>
      </div>

      <div className="mt-4 grid min-h-0 flex-1 gap-4 overflow-y-auto pr-1 md:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <div className="grid content-start gap-3">
          <div className="rounded-[22px] border border-[rgba(129,149,188,0.18)] bg-[linear-gradient(135deg,#eef4ff,#f8fbff)] px-4 py-4 shadow-[0_12px_28px_rgba(13,27,51,0.05)]">
            <div className={`text-[11px] font-extrabold uppercase tracking-[0.18em] ${lesson.accentClassName}`}>
              Lesson Focus
            </div>
            <div className="mt-3 grid gap-2.5">
              {lesson.bullets.map((item) => (
                <div
                  key={item}
                  className="rounded-[18px] border border-[rgba(129,149,188,0.14)] bg-white px-4 py-3 text-[13px] leading-6 text-[#53637f] shadow-[0_10px_24px_rgba(13,27,51,0.04)]"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[22px] border border-[rgba(129,149,188,0.18)] bg-white px-4 py-4 shadow-[0_12px_28px_rgba(13,27,51,0.05)]">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#71839d]">
              Track Roadmap
            </div>
            <div className="mt-3 grid gap-2">
              {trackLessons.map((item) => (
                <div
                  key={item.id}
                  className={[
                    'rounded-[16px] border px-3.5 py-3 text-[12px] leading-5.5',
                    item.id === lesson.id
                      ? 'border-primary/20 bg-[#edf3ff] text-[#10213b]'
                      : 'border-[rgba(129,149,188,0.12)] bg-[#f6f8ff] text-[#53637f]',
                  ].join(' ')}
                >
                  <div className="font-extrabold uppercase tracking-[0.14em] text-[#70819a]">
                    {item.code}
                  </div>
                  <div className="mt-1 font-bold text-[#10213b]">{item.title}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-3">
            <div className="rounded-[18px] bg-[#f6f8ff] px-3.5 py-3">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
                Input
              </div>
              <div className="mt-2 font-mono text-[17px] font-semibold text-ink">
                {dataset.inputShape}
              </div>
            </div>
            <div className="rounded-[18px] bg-[#f6f8ff] px-3.5 py-3">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
                Classes
              </div>
              <div className="mt-2 text-[17px] font-semibold text-ink">
                {dataset.classCount ?? '-'}
              </div>
            </div>
            <div className="rounded-[18px] bg-[#f6f8ff] px-3.5 py-3">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
                Samples
              </div>
              <div className="mt-2 text-[17px] font-semibold text-ink">
                {dataset.records}
              </div>
            </div>
          </div>
        </div>

        <div className="grid content-start gap-3">
          <div className="rounded-[22px] border border-[rgba(129,149,188,0.18)] bg-white px-4 py-4 shadow-[0_12px_28px_rgba(13,27,51,0.05)]">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#71839d]">
              Class Info
            </div>
            <div className="mt-3 grid gap-2">
              <div className="rounded-[16px] bg-[#f6f8ff] px-3.5 py-3 text-[12px] leading-5.5 text-[#53637f]">
                {dataset.descriptionKo}
              </div>
              <div className="rounded-[16px] bg-[#f6f8ff] px-3.5 py-3 text-[12px] leading-5.5 text-[#53637f]">
                {dataset.shapeDescriptionKo}
              </div>
              <div className="rounded-[16px] bg-[#f6f8ff] px-3.5 py-3 text-[12px] leading-5.5 text-[#53637f]">
                {dataset.classesDescriptionKo}
              </div>
            </div>
          </div>

          {previewSamples.length ? (
            <div className="rounded-[22px] border border-[rgba(129,149,188,0.18)] bg-white px-4 py-4 shadow-[0_12px_28px_rgba(13,27,51,0.05)]">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#71839d]">
                Sample Preview
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                {previewSamples.map((sample) => (
                  <div
                    key={`${dataset.id}-tutorial-${sample.label}`}
                    className="overflow-hidden rounded-[18px] border border-[rgba(129,149,188,0.12)] bg-[#f6f8ff] px-2.5 py-2.5 shadow-[0_8px_20px_rgba(13,27,51,0.03)]"
                  >
                    {sample.imageSrc ? (
                      <div className="relative h-20 overflow-hidden rounded-[14px] bg-white">
                        <Image
                          src={sample.imageSrc}
                          alt={`${dataset.label} ${sample.label}`}
                          fill
                          unoptimized
                          className={dataset.id === 'cifar10' ? 'object-cover' : 'object-contain p-2'}
                        />
                      </div>
                    ) : (
                      <div className="grid h-20 place-items-center rounded-[14px] bg-[linear-gradient(135deg,#edf3ff,#dfe8fb)] text-[12px] font-extrabold uppercase tracking-[0.12em] text-[#51627e]">
                        {sample.label}
                      </div>
                    )}
                    <div className="pt-2 text-center text-[11px] font-semibold text-[#10213b]">
                      {sample.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FloatingInfoPanel({
  children,
  interactive = true,
}: {
  children: ReactNode;
  interactive?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [panelLeft, setPanelLeft] = useState(0);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const updatePosition = () => {
      const viewportWidth = window.innerWidth;
      const shellWidth = Math.min(2320, Math.max(viewportWidth - 8, 0));
      const shellOffset = Math.max((viewportWidth - shellWidth) / 2, 0);
      const sidebarWidth = Math.min(Math.max(viewportWidth * 0.17, 272), 356);
      setPanelLeft(Math.round(shellOffset + sidebarWidth + 10));
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [mounted]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      className={[
        'fixed top-[6.1rem] z-[220] hidden xl:block',
        interactive ? 'pointer-events-auto' : 'pointer-events-none',
      ].join(' ')}
      style={{ left: `${panelLeft}px`, right: '16px' }}
    >
      {children}
    </div>,
    document.body,
  );
}

const blockGuideCopy: Record<
  BlockType,
  {
    eyebrow: string;
    summary: string;
    bullets: string[];
    tip: string;
  }
> = {
  linear: {
    eyebrow: '입력을 다음 특징 공간으로 변환',
    summary: 'Linear Layer는 들어온 값을 가중치와 곱해서 새로운 특징으로 다시 정리해 주는 레이어입니다.',
    bullets: [
      '주로 마지막 분류 단계나 평탄화된 특징 벡터 처리에 사용됩니다.',
      '입력 크기와 출력 크기를 정해서 정보의 압축 또는 확장을 조절합니다.',
      'CNN 뒤에 붙이면 이미지 특징을 최종 클래스 점수로 연결할 때 유용합니다.',
    ],
    tip: '입력이 784인데 출력이 128이면, 784개 특징을 128개 중요한 특징으로 압축하는 느낌입니다.',
  },
  cnn: {
    eyebrow: '이미지에서 패턴을 찾는 핵심 레이어',
    summary: 'CNN Layer는 작은 필터가 이미지를 훑으면서 선, 모서리, 질감 같은 패턴을 찾아내는 역할을 합니다.',
    bullets: [
      '이미지 전체를 한 번에 보는 대신 작은 창으로 반복해서 특징을 추출합니다.',
      '채널 수를 늘리면 더 다양한 패턴을 배울 수 있습니다.',
      '초반에는 단순한 패턴, 뒤로 갈수록 더 복잡한 패턴을 잡는 데 자주 쓰입니다.',
    ],
    tip: '처음 시작할 때는 `1 -> 16` 또는 `3 -> 16` 정도로 가볍게 두고 쌓아보는 편이 안정적입니다.',
  },
  pooling: {
    eyebrow: '중요한 정보만 남기고 크기를 줄임',
    summary: 'Pooling Layer는 특징 맵을 줄여서 계산량을 낮추고, 핵심적인 반응만 남기도록 도와줍니다.',
    bullets: [
      'MaxPool은 가장 강한 반응을 남기고, AvgPool은 평균적인 반응을 남깁니다.',
      '공간 크기를 줄이기 때문에 뒤쪽 레이어가 더 가볍게 동작합니다.',
      'CNN 다음에 자주 붙어 특징을 정리하는 역할을 합니다.',
    ],
    tip: '`2x2` 풀링은 가로세로 크기를 절반 정도로 줄이는 가장 기본적인 선택입니다.',
  },
  dropout: {
    eyebrow: '과하게 외우는 것을 막아주는 안전장치',
    summary: 'Dropout Layer는 학습 중 일부 뉴런을 잠깐씩 쉬게 해서 모델이 특정 경로만 지나치게 믿지 않도록 합니다.',
    bullets: [
      '훈련 데이터에만 너무 맞춰지는 과적합을 줄이는 데 도움이 됩니다.',
      '보통 모델 뒤쪽, 특히 Linear Layer 바로 앞이나 중간에 두는 경우가 가장 흔합니다.',
      '확률이 높을수록 더 많이 쉬게 하므로 너무 크게 잡으면 학습이 약해질 수 있습니다.',
    ],
    tip: 'CNN 여러 개를 쌓은 뒤 분류용 Linear Layer로 넘어가기 직전에 넣는 구성이 가장 무난합니다. 처음에는 `0.2 ~ 0.3` 정도로 시작해 보세요.',
  },
};

function LayerGuideModal({
  block,
  onClose,
}: {
  block: (typeof libraryBlocks)[number];
  onClose: () => void;
}) {
  const copy = blockGuideCopy[block.id];
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) {
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
          <div className="rounded-[28px] bg-[linear-gradient(180deg,#eef4ff,#ffffff)] p-6 shadow-[inset_0_0_0_1px_rgba(129,149,188,0.12)]">
            <div className="mb-4 flex items-center gap-3">
              <div
                className={[
                  'grid h-12 w-12 place-items-center rounded-[18px] bg-white',
                  accentClassName(block.accent),
                ].join(' ')}
              >
                <Icon name={block.icon} className="h-6 w-6" />
              </div>
              <div>
                <div className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-[#71839d]">
                  Layer Guide
                </div>
                <div className="font-display text-[26px] font-bold text-ink">{block.title}</div>
              </div>
            </div>
            <BlockGuideVisual blockId={block.id} accent={block.accent} />
          </div>

          <div className="grid content-start gap-5">
            <div>
              <div className="text-[13px] font-extrabold uppercase tracking-[0.18em] text-primary/70">
                {copy.eyebrow}
              </div>
              <div className="mt-2 text-[19px] leading-9 text-[#50617c]">{copy.summary}</div>
            </div>

            <div className="grid gap-4">
              {copy.bullets.map((item) => (
                <div
                  key={item}
                  className="rounded-[20px] bg-white px-5 py-4 text-[16px] leading-8 text-[#50617c] shadow-[0_10px_24px_rgba(13,27,51,0.05)] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.1)]"
                >
                  {item}
                </div>
              ))}
            </div>

            <div className="rounded-[22px] bg-[linear-gradient(135deg,#edf4ff,#f4f8ff)] px-5 py-5 shadow-[inset_0_0_0_1px_rgba(17,81,255,0.08)]">
              <div className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-primary">
                Quick Tip
              </div>
              <div className="mt-2 text-[16px] leading-8 text-[#41526d]">{copy.tip}</div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function BlockGuideVisual({
  blockId,
  accent,
}: {
  blockId: BlockType;
  accent: BlockAccent;
}) {
  const accentClass = accentClassName(accent);

  if (blockId === 'linear') {
    return (
      <div className="grid gap-5">
        <NetworkGuideSvg tone="linear" />
        <div className={`text-center text-[14px] font-bold ${accentClass}`}>입력 뉴런들이 hidden layer에 모이고, hidden 표현이 다시 output 뉴런으로 수렴하며 최종 값을 만듭니다</div>
      </div>
    );
  }

  if (blockId === 'cnn') {
    return (
      <div className="grid gap-5">
        <ConvolutionGuideSvg />
        <div className={`text-center text-[14px] font-bold ${accentClass}`}>2x2 커널이 5x5 입력을 한 칸씩 왼쪽에서 오른쪽으로, 줄이 끝나면 아래로 내려가며 4x4 출력의 각 칸을 순서대로 만듭니다</div>
      </div>
    );
  }

  if (blockId === 'pooling') {
    return (
      <div className="grid gap-5">
        <PoolingGuideSvg />
        <div className={`text-center text-[14px] font-bold ${accentClass}`}>정확히 2x2 네 칸을 한 번에 보고 가장 큰 값 하나만 남겨, 4x4 activation map을 2x2로 줄입니다</div>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <NetworkGuideSvg tone="dropout" />
      <div className={`text-center text-[14px] font-bold ${accentClass}`}>Linear 구조 위에서 hidden 노드 일부만 꺼졌다 켜지며, 특정 뉴런 경로에만 과하게 의존하는 현상을 줄입니다</div>
    </div>
  );
}

type GuideCell = {
  index: number;
  col: number;
  row: number;
  x: number;
  y: number;
};

function buildGuideGrid({
  columns,
  rows,
  startX,
  startY,
  cell,
  gap,
}: {
  columns: number;
  rows: number;
  startX: number;
  startY: number;
  cell: number;
  gap: number;
}): GuideCell[] {
  return Array.from({ length: columns * rows }, (_, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    return {
      index,
      col,
      row,
      x: startX + col * (cell + gap),
      y: startY + row * (cell + gap),
    };
  });
}

function animationOffsets(cells: GuideCell[], origin: GuideCell) {
  return cells.map((cell) => `${cell.x - origin.x} ${cell.y - origin.y}`).join(';');
}

function NetworkGuideSvg({ tone }: { tone: 'linear' | 'dropout' }) {
  const isDropout = tone === 'dropout';
  const inputColor = isDropout ? '#cf476b' : '#2563eb';
  const hiddenColor = isDropout ? '#de6285' : '#5a86ff';
  const outputColor = isDropout ? '#f08aa3' : '#91b4ff';
  const lineColor = isDropout ? 'rgba(207,71,107,0.22)' : 'rgba(91,140,255,0.22)';
  const glowColor = isDropout ? '#ff97b4' : '#86aefe';
  const viewWidth = 520;
  const viewHeight = 320;
  const inputX = 84;
  const hiddenX = 260;
  const outputX = 436;
  const inputYs = [82, 122, 162, 202, 242];
  const hiddenYs = [60, 94, 128, 162, 196, 230];
  const outputYs = [110, 162, 214];
  const droppedHidden = new Set([1, 4]);
  const activePaths = [
    { from: [inputX, inputYs[0]], to: [hiddenX, hiddenYs[0]], begin: '0s' },
    { from: [inputX, inputYs[2]], to: [hiddenX, hiddenYs[2]], begin: '0.25s' },
    { from: [inputX, inputYs[4]], to: [hiddenX, hiddenYs[5]], begin: '0.5s' },
    { from: [hiddenX, hiddenYs[0]], to: [outputX, outputYs[0]], begin: '0.15s' },
    { from: [hiddenX, hiddenYs[2]], to: [outputX, outputYs[1]], begin: '0.4s' },
    { from: [hiddenX, hiddenYs[5]], to: [outputX, outputYs[2]], begin: '0.65s' },
  ];

  return (
    <div
      className={[
        'relative mx-auto h-[320px] w-full max-w-[520px] overflow-hidden rounded-[36px] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.12)]',
        isDropout
          ? 'bg-[radial-gradient(circle_at_20%_18%,rgba(212,90,122,0.2),transparent_30%),linear-gradient(180deg,#fff8fa_0%,#fff0f4_100%)]'
          : 'bg-[radial-gradient(circle_at_20%_20%,rgba(112,160,255,0.28),transparent_32%),linear-gradient(180deg,#f7faff_0%,#eaf1ff_100%)]',
      ].join(' ')}
    >
      <div className={`absolute inset-x-8 top-6 flex items-center justify-between text-[11px] font-extrabold uppercase tracking-[0.2em] ${isDropout ? 'text-[#ba5b74]' : 'text-[#6d82ae]'}`}>
        <span>Input Neurons</span>
        <span>Hidden Layer</span>
        <span>Output</span>
      </div>

      <svg viewBox={`0 0 ${viewWidth} ${viewHeight}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
        {inputYs.flatMap((inputY, inputIndex) =>
          hiddenYs.map((hiddenY, hiddenIndex) => (
            <line
              key={`ih-${inputIndex}-${hiddenIndex}`}
              x1={inputX}
              y1={inputY}
              x2={hiddenX}
              y2={hiddenY}
              stroke={lineColor}
              strokeWidth={hiddenIndex === 2 || hiddenIndex === 3 ? 2.4 : 1.9}
              strokeLinecap="round"
              opacity={isDropout && droppedHidden.has(hiddenIndex) ? 0.12 : 1}
            />
          )),
        )}
        {hiddenYs.flatMap((hiddenY, hiddenIndex) =>
          outputYs.map((outputY, outputIndex) => (
            <line
              key={`ho-${hiddenIndex}-${outputIndex}`}
              x1={hiddenX}
              y1={hiddenY}
              x2={outputX}
              y2={outputY}
              stroke={lineColor}
              strokeWidth={1.9}
              strokeLinecap="round"
              opacity={isDropout && droppedHidden.has(hiddenIndex) ? 0.12 : 1}
            />
          )),
        )}

        {activePaths.map((motion, index) => (
          <circle key={index} r="5.5" fill={glowColor} opacity="0.92">
            <animateMotion
              dur="2.8s"
              begin={motion.begin}
              repeatCount="indefinite"
              path={`M ${motion.from[0]} ${motion.from[1]} L ${motion.to[0]} ${motion.to[1]}`}
            />
            <animate attributeName="opacity" values="0;1;1;0" dur="2.8s" begin={motion.begin} repeatCount="indefinite" />
          </circle>
        ))}

        {inputYs.map((y, index) => (
          <g key={`input-${index}`}>
            <circle cx={inputX} cy={y} r="17" fill="#ffffff" opacity="0.88" />
            <circle cx={inputX} cy={y} r="12.5" fill={inputColor} />
          </g>
        ))}

        {hiddenYs.map((y, index) => {
          const dropped = isDropout && droppedHidden.has(index);
          return (
            <g key={`hidden-${index}`}>
              <circle cx={hiddenX} cy={y} r="16" fill="#ffffff" opacity="0.9" />
              <circle cx={hiddenX} cy={y} r="12" fill={dropped ? '#f8ced9' : hiddenColor}>
                {dropped ? <animate attributeName="opacity" values="1;0.14;1" dur="2s" begin={`${index * 0.2}s`} repeatCount="indefinite" /> : null}
              </circle>
              {dropped ? (
                <>
                  <circle cx={hiddenX} cy={y} r="19" fill="rgba(255,255,255,0.18)" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="4 5">
                    <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" begin={`${index * 0.2}s`} repeatCount="indefinite" />
                  </circle>
                  <line x1={hiddenX - 8} y1={y - 8} x2={hiddenX + 8} y2={y + 8} stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round">
                    <animate attributeName="opacity" values="1;0.3;1" dur="2s" begin={`${index * 0.2}s`} repeatCount="indefinite" />
                  </line>
                  <line x1={hiddenX + 8} y1={y - 8} x2={hiddenX - 8} y2={y + 8} stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round">
                    <animate attributeName="opacity" values="1;0.3;1" dur="2s" begin={`${index * 0.2}s`} repeatCount="indefinite" />
                  </line>
                </>
              ) : null}
            </g>
          );
        })}

        {outputYs.map((y, index) => (
          <g key={`output-${index}`}>
            <circle cx={outputX} cy={y} r="18" fill="#ffffff" opacity="0.92" />
            <circle cx={outputX} cy={y} r="13" fill={outputColor} />
          </g>
        ))}
      </svg>

      <div className={`absolute left-8 bottom-7 rounded-[16px] bg-white/88 px-4 py-2.5 text-[11px] font-bold shadow-[0_10px_24px_rgba(13,27,51,0.08)] ${isDropout ? 'text-[#b04361]' : 'text-[#2d56c7]'}`}>
        {isDropout ? 'random hidden neurons turn off during training' : 'every input connects to every hidden neuron'}
      </div>
      <div className={`absolute right-8 bottom-7 rounded-[16px] px-4 py-2.5 text-[11px] font-bold shadow-[0_10px_24px_rgba(13,27,51,0.08)] ${isDropout ? 'bg-[#fff1f4] text-[#b04361]' : 'bg-white/88 text-[#2d56c7]'}`}>
        {isDropout ? 'dropout mask: 2 hidden neurons OFF' : 'fully connected MLP'}
      </div>
    </div>
  );
}

function ConvolutionGuideSvg() {
  const inputX = 36;
  const inputY = 84;
  const inputCell = 34;
  const inputGap = 8;
  const outputX = 334;
  const outputY = 92;
  const outputCell = 26;
  const outputGap = 8;
  const digitCells = new Set([2, 7, 12, 17, 22, 21, 20]);
  const inputGrid = buildGuideGrid({ columns: 5, rows: 5, startX: inputX, startY: inputY, cell: inputCell, gap: inputGap });
  const outputGrid = buildGuideGrid({ columns: 4, rows: 4, startX: outputX, startY: outputY, cell: outputCell, gap: outputGap });
  const edgeValues = [0, 2, -2, 0, 0, 2, -2, 0, 0, 2, -2, 0, 0, 1, -2, 0];
  const scanWindows = outputGrid.map((cell) => inputGrid[cell.row * 5 + cell.col]);
  const kernelOffsets = animationOffsets(scanWindows, scanWindows[0]);
  const outputOffsets = animationOffsets(outputGrid, outputGrid[0]);
  const kernelSize = inputCell * 2 + inputGap;
  const arrowY = 164;
  const inputRight = inputX + inputCell * 5 + inputGap * 4;
  const connectorStart = inputRight + 18;
  const connectorEnd = outputX - 18;
  const connectorWidth = connectorEnd - connectorStart;

  return (
    <div className="relative mx-auto h-[336px] w-full max-w-[520px] overflow-hidden rounded-[36px] bg-[radial-gradient(circle_at_18%_16%,rgba(255,188,92,0.24),transparent_28%),linear-gradient(180deg,#fff9f1_0%,#fff1e4_100%)] p-6 shadow-[inset_0_0_0_1px_rgba(255,188,92,0.14)]">
      <div className="absolute left-6 top-5 rounded-full bg-[rgba(255,255,255,0.72)] px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#8d5a21]">
        Convolution
      </div>
      <svg viewBox="0 0 520 336" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <text x="38" y="64" fill="#9a6b36" fontSize="11" fontWeight="700" letterSpacing="0.16em">
          INPUT 5x5
        </text>
        <text x="336" y="64" fill="#9a6b36" fontSize="11" fontWeight="700" letterSpacing="0.16em">
          OUTPUT 4x4
        </text>

        {inputGrid.map((cell) => {
          const isDigit = digitCells.has(cell.index);
          return (
            <g key={`in-${cell.index}`}>
              <rect
                x={cell.x}
                y={cell.y}
                width={inputCell}
                height={inputCell}
                rx="10"
                fill={isDigit ? '#f8fbff' : 'rgba(255,255,255,0.08)'}
                stroke={isDigit ? 'rgba(255,208,139,0.42)' : 'rgba(255,255,255,0.08)'}
              />
              <text
                x={cell.x + inputCell / 2}
                y={cell.y + inputCell / 2 + 4}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill={isDigit ? '#7a4a14' : 'rgba(122,74,20,0.42)'}
              >
                {isDigit ? '1' : '0'}
              </text>
            </g>
          );
        })}

        {outputGrid.map((cell) => (
          <g key={`out-${cell.index}`}>
            <rect
              x={cell.x}
              y={cell.y}
              width={outputCell}
              height={outputCell}
              rx="8"
              fill="rgba(255,188,92,0.18)"
              stroke="rgba(205,132,49,0.18)"
            />
            <text
              x={cell.x + outputCell / 2}
              y={cell.y + outputCell / 2 + 4}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fill="#8a5417"
            >
              {edgeValues[cell.index] > 0 ? `+${edgeValues[cell.index]}` : edgeValues[cell.index]}
            </text>
          </g>
        ))}

        <rect x={scanWindows[0].x} y={scanWindows[0].y} width={kernelSize} height={kernelSize} rx="12" fill="rgba(255,180,84,0.16)" stroke="#ffd08b" strokeWidth="2.5">
          <animateTransform attributeName="transform" type="translate" values={kernelOffsets} dur="6.4s" repeatCount="indefinite" calcMode="discrete" />
        </rect>
        <rect x={scanWindows[0].x} y={scanWindows[0].y} width={kernelSize} height={kernelSize} rx="12" fill="url(#convKernelGlow)">
          <animateTransform attributeName="transform" type="translate" values={kernelOffsets} dur="6.4s" repeatCount="indefinite" calcMode="discrete" />
        </rect>

        <rect x={outputGrid[0].x} y={outputGrid[0].y} width={outputCell} height={outputCell} rx="8" fill="rgba(255,255,255,0.32)" stroke="rgba(205,132,49,0.62)" strokeWidth="2">
          <animateTransform attributeName="transform" type="translate" values={outputOffsets} dur="6.4s" repeatCount="indefinite" calcMode="discrete" />
        </rect>

        <path d={`M ${connectorStart} ${arrowY} L ${connectorEnd} ${arrowY}`} stroke="rgba(205,132,49,0.2)" strokeWidth="6" strokeLinecap="round" />
        <path d={`M ${connectorStart} ${arrowY} L ${connectorEnd} ${arrowY}`} stroke="rgba(205,132,49,0.56)" strokeWidth="2.5" strokeLinecap="round" />
        <path d={`M ${connectorEnd - 10} ${arrowY - 7} L ${connectorEnd} ${arrowY} L ${connectorEnd - 10} ${arrowY + 7}`} fill="none" stroke="rgba(205,132,49,0.72)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={connectorStart + 10} cy={arrowY} r="5" fill="#ffd08b">
          <animateMotion dur="1.4s" repeatCount="indefinite" path={`M 0 0 L ${connectorWidth - 24} 0`} />
          <animate attributeName="opacity" values="0;1;1;0" dur="1.4s" repeatCount="indefinite" />
        </circle>

        <defs>
          <linearGradient id="convKernelGlow" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,208,139,0.34)" />
            <stop offset="100%" stopColor="rgba(255,208,139,0)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute left-[194px] top-[54px] rounded-[12px] bg-[#fff7ed] px-3 py-1.5 text-[10px] font-bold text-[#c2410c] shadow-[0_10px_24px_rgba(255,180,84,0.12)]">
        edge filter [-1 +1; -1 +1]
      </div>
      <div className="absolute right-6 bottom-6 rounded-[16px] bg-[#fff7ed] px-4 py-2.5 text-[11px] font-bold text-[#c2410c] shadow-[0_10px_24px_rgba(255,180,84,0.18)]">
        row-major scan, stride 1
      </div>
    </div>
  );
}

function PoolingGuideSvg() {
  const values = [0.15, 0.42, 0.31, 0.18, 0.67, 0.94, 0.21, 0.74, 0.23, 0.58, 0.83, 0.36, 0.12, 0.26, 0.69, 0.97];
  const picked = new Set([5, 7, 9, 15]);
  const inputX = 38;
  const inputY = 88;
  const inputCell = 34;
  const inputGap = 8;
  const outputX = 360;
  const outputY = 126;
  const outputCell = 34;
  const outputGap = 14;
  const inputGrid = buildGuideGrid({ columns: 4, rows: 4, startX: inputX, startY: inputY, cell: inputCell, gap: inputGap });
  const outputGrid = buildGuideGrid({ columns: 2, rows: 2, startX: outputX, startY: outputY, cell: outputCell, gap: outputGap });
  const windowOrigins = [inputGrid[0], inputGrid[2], inputGrid[8], inputGrid[10]];
  const pickedCells = [inputGrid[5], inputGrid[7], inputGrid[9], inputGrid[15]];
  const outputValues = [0.94, 0.74, 0.58, 0.97];
  const windowOffsets = animationOffsets(windowOrigins, windowOrigins[0]);
  const pickOffsets = animationOffsets(pickedCells, pickedCells[0]);
  const outputOffsets = animationOffsets(outputGrid, outputGrid[0]);
  const windowSize = inputCell * 2 + inputGap;
  const arrowY = 170;
  const inputRight = inputX + inputCell * 4 + inputGap * 3;
  const connectorStart = inputRight + 18;
  const connectorEnd = outputX - 18;
  const connectorWidth = connectorEnd - connectorStart;

  return (
    <div className="relative mx-auto h-[336px] w-full max-w-[520px] overflow-hidden rounded-[36px] bg-[radial-gradient(circle_at_18%_18%,rgba(123,90,214,0.18),transparent_30%),linear-gradient(180deg,#faf7ff_0%,#f1ecff_100%)] p-6 shadow-[inset_0_0_0_1px_rgba(123,90,214,0.1)]">
      <div className="absolute inset-x-6 top-5 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#7d68b2]">
        <span>Before</span>
        <span>Max Pool</span>
        <span>After</span>
      </div>
      <svg viewBox="0 0 520 336" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <text x="40" y="66" fill="#7d68b2" fontSize="11" fontWeight="700" letterSpacing="0.16em">
          ACTIVATION 4x4
        </text>
        <text x="362" y="102" fill="#7d68b2" fontSize="11" fontWeight="700" letterSpacing="0.16em">
          POOLED 2x2
        </text>

        {inputGrid.map((cell) => {
          const value = values[cell.index];
          const isPicked = picked.has(cell.index);
          return (
            <g key={cell.index}>
              <rect
                x={cell.x}
                y={cell.y}
                width={inputCell}
                height={inputCell}
                rx="8"
                fill={isPicked ? 'rgba(123,90,214,0.92)' : 'rgba(123,90,214,0.12)'}
                stroke={isPicked ? 'rgba(123,90,214,0.94)' : 'rgba(123,90,214,0.08)'}
              />
              <text
                x={cell.x + inputCell / 2}
                y={cell.y + inputCell / 2 + 4}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill={isPicked ? '#ffffff' : '#7d68b2'}
              >
                {value.toFixed(2).slice(1)}
              </text>
            </g>
          );
        })}

        <rect x={windowOrigins[0].x} y={windowOrigins[0].y} width={windowSize} height={windowSize} rx="12" fill="rgba(123,90,214,0.08)" stroke="#9f84ef" strokeWidth="2.5">
          <animateTransform attributeName="transform" type="translate" values={windowOffsets} dur="4s" repeatCount="indefinite" calcMode="discrete" />
        </rect>

        <rect x={pickedCells[0].x} y={pickedCells[0].y} width={inputCell} height={inputCell} rx="10" fill="none" stroke="#ffffff" strokeWidth="2.5">
          <animateTransform attributeName="transform" type="translate" values={pickOffsets} dur="4s" repeatCount="indefinite" calcMode="discrete" />
        </rect>

        <path d={`M ${connectorStart} ${arrowY} L ${connectorEnd} ${arrowY}`} stroke="rgba(123,90,214,0.16)" strokeWidth="6" strokeLinecap="round" />
        <path d={`M ${connectorStart} ${arrowY} L ${connectorEnd} ${arrowY}`} stroke="rgba(123,90,214,0.48)" strokeWidth="2.5" strokeLinecap="round" />
        <path d={`M ${connectorEnd - 10} ${arrowY - 7} L ${connectorEnd} ${arrowY} L ${connectorEnd - 10} ${arrowY + 7}`} fill="none" stroke="rgba(123,90,214,0.66)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={connectorStart + 10} cy={arrowY} r="5" fill="#9f84ef">
          <animateMotion dur="1.2s" repeatCount="indefinite" path={`M 0 0 L ${connectorWidth - 24} 0`} />
          <animate attributeName="opacity" values="0;1;1;0" dur="1.2s" repeatCount="indefinite" />
        </circle>

        {outputGrid.map((cell, index) => {
          const value = outputValues[index];
          return (
            <g key={value}>
              <rect x={cell.x} y={cell.y} width={outputCell} height={outputCell} rx="10" fill="rgba(123,90,214,0.9)">
                <animate attributeName="opacity" values="0.28;1;1;1" dur="4s" begin={`${index * 1}s`} repeatCount="indefinite" />
              </rect>
              <text x={cell.x + outputCell / 2} y={cell.y + outputCell / 2 + 5} textAnchor="middle" fontSize="12" fontWeight="700" fill="#ffffff">
                {value.toFixed(2).slice(1)}
              </text>
            </g>
          );
        })}

        <rect x={outputGrid[0].x} y={outputGrid[0].y} width={outputCell} height={outputCell} rx="10" fill="none" stroke="rgba(255,255,255,0.82)" strokeWidth="2.5">
          <animateTransform attributeName="transform" type="translate" values={outputOffsets} dur="4s" repeatCount="indefinite" calcMode="discrete" />
        </rect>
      </svg>
      <div className="absolute right-6 bottom-6 rounded-[16px] bg-white/88 px-4 py-2.5 text-[11px] font-bold text-[#6f56b6] shadow-[0_10px_24px_rgba(123,90,214,0.12)]">
        keep only the max from each 2x2 block
      </div>
    </div>
  );
}

function DatasetDetailPanel({
  dataset,
  widthClassName,
  largeSamples,
  onClose,
}: {
  dataset: DatasetItem;
  widthClassName: string;
  largeSamples?: boolean;
  onClose?: () => void;
}) {
  return (
    <div
      className={[
        widthClassName,
        'rounded-[22px] bg-white shadow-[0_24px_56px_rgba(13,27,51,0.18)] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.16)]',
        largeSamples
          ? 'max-h-[calc(100vh-0.5rem)] min-h-[44rem] overflow-y-auto px-6 pt-[1.375rem] pb-[2.5rem]'
          : 'px-5 py-5',
      ].join(' ')}
    >
      <div className={largeSamples ? 'mb-4 flex flex-wrap items-start justify-between gap-3.5' : 'mb-3 flex flex-wrap items-start justify-between gap-3'}>
        <div className="min-w-0 flex-1">
          <div className={largeSamples ? 'text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted' : 'text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted'}>
            Dataset Detail
          </div>
          <div className={largeSamples ? 'mt-1.5 truncate font-display text-[20px] font-bold leading-none text-ink' : 'mt-1 truncate font-display text-[18px] font-bold text-ink'}>
            {dataset.label}
          </div>
        </div>
        <div className="flex flex-none items-center gap-2 self-start">
          <div className={largeSamples ? 'rounded-full bg-[#eef3ff] px-3.5 py-1.5 text-[12px] font-extrabold uppercase tracking-[0.14em] text-primary' : 'rounded-full bg-[#eef3ff] px-3.5 py-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-primary'}>
            {dataset.classCount ?? '-'} classes
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className={largeSamples ? 'rounded-full border border-[#fecaca] bg-[#fff1f2] px-4 py-2 text-[13px] font-extrabold uppercase tracking-[0.16em] text-[#b42318] shadow-[0_8px_18px_rgba(180,35,24,0.16)] transition hover:bg-[#ffe4e6]' : 'rounded-full border border-[#fecaca] bg-[#fff1f2] px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#b42318] shadow-[0_8px_18px_rgba(180,35,24,0.16)] transition hover:bg-[#ffe4e6]'}
            >
              Close
            </button>
          ) : null}
        </div>
      </div>

      <div className={largeSamples ? 'grid gap-2.5 text-[14px] leading-7 text-[#53637f]' : 'grid gap-2 text-[14px] leading-6 text-[#53637f]'}>
        <p>{dataset.descriptionKo}</p>
        <p>{dataset.shapeDescriptionKo}</p>
        <p>{dataset.classesDescriptionKo}</p>
      </div>

      {(dataset.infoSampleClasses ?? dataset.sampleClasses)?.length ? (
        <div className={largeSamples ? 'mt-5' : 'mt-3'}>
          <div className={largeSamples ? 'mb-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted' : 'mb-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted'}>
            Class Samples
          </div>
          <div className={largeSamples ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-2 gap-2'}>
            {(dataset.infoSampleClasses ?? dataset.sampleClasses ?? []).map((sample) => (
              <div
                key={`${dataset.id}-${sample.label}`}
                className={[
                  'overflow-hidden rounded-[16px] bg-[#f6f8ff] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.12)]',
                  largeSamples ? 'px-4 py-4' : '',
                ].join(' ')}
              >
                {sample.imageSrc ? (
                  <div
                    className={[
                      'relative overflow-hidden rounded-[14px] bg-white',
                      largeSamples ? 'mx-auto h-24 w-24' : 'h-24 w-full',
                    ].join(' ')}
                  >
                    <Image
                      src={sample.imageSrc}
                      alt={`${dataset.label} ${sample.label}`}
                      fill
                      unoptimized
                      className={largeSamples ? 'object-contain p-2' : 'object-cover'}
                    />
                  </div>
                ) : (
                  <div
                    className={[
                      'grid place-items-center bg-[linear-gradient(135deg,#edf3ff,#dfe8fb)] text-[13px] font-extrabold uppercase tracking-[0.12em] text-[#51627e]',
                      largeSamples ? 'mx-auto h-24 w-24 rounded-[14px]' : 'h-24 w-full',
                    ].join(' ')}
                  >
                    {sample.label}
                  </div>
                )}
                <div className={largeSamples ? 'pt-3 text-center text-[16px] font-semibold text-ink' : 'px-2.5 py-2 text-[13px] font-semibold text-ink'}>
                  {sample.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className={largeSamples ? 'mt-5 grid gap-2.5 sm:grid-cols-3' : 'mt-3 grid gap-2 sm:grid-cols-3'}>
        <div className={largeSamples ? 'rounded-[18px] bg-[#f6f8ff] px-3.5 py-3.5' : 'rounded-[16px] bg-[#f6f8ff] px-3 py-2'}>
          <div className={largeSamples ? 'text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted' : 'text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted'}>
            Input Shape
          </div>
          <div className={largeSamples ? 'mt-1.5 font-mono text-[16px] font-semibold text-ink' : 'mt-1 font-mono text-[13px] font-semibold text-ink'}>
            {dataset.inputShape}
          </div>
        </div>
        <div className={largeSamples ? 'rounded-[18px] bg-[#f6f8ff] px-3.5 py-3.5' : 'rounded-[16px] bg-[#f6f8ff] px-3 py-2'}>
          <div className={largeSamples ? 'text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted' : 'text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted'}>
            Class Num
          </div>
          <div className={largeSamples ? 'mt-1.5 text-[16px] font-semibold text-ink' : 'mt-1 text-[13px] font-semibold text-ink'}>
            {dataset.classCount ?? '-'}
          </div>
        </div>
        <div className={largeSamples ? 'rounded-[18px] bg-[#f6f8ff] px-3.5 py-3.5' : 'rounded-[16px] bg-[#f6f8ff] px-3 py-2'}>
          <div className={largeSamples ? 'text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted' : 'text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted'}>
            Samples
          </div>
          <div className={largeSamples ? 'mt-1.5 text-[16px] font-semibold text-ink' : 'mt-1 text-[13px] font-semibold text-ink'}>
            {dataset.records}
          </div>
        </div>
      </div>
    </div>
  );
}
