'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Icon } from '@/features/model-builder/components/icons';
import { datasets, libraryBlocks } from '@/lib/constants/builder-data';
import type { BlockAccent, BlockType, DatasetItem } from '@/types/builder';

type SidebarProps = {
  selectedDatasetId: string;
  activeWorkspace: 'builder' | 'tutorial' | 'competition';
  hasCompetitionRoom?: boolean;
  selectedDataset?: DatasetItem | null;
  availableBlockTypes: BlockType[];
  onDatasetSelect: (datasetId: string) => void;
  onWorkspaceSelect: (workspace: 'builder' | 'tutorial' | 'competition') => void;
  onBlockDragStart: (type: BlockType) => void;
  onBlockDragEnd: () => void;
};

type StudyClassKey = 'mlp' | 'cnn' | 'augmentation';

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

function getStudyClassKey(datasetId: string): StudyClassKey {
  if (datasetId === 'fashion_mnist') {
    return 'cnn';
  }

  if (datasetId === 'cifar10') {
    return 'augmentation';
  }

  return 'mlp';
}

function getStudyClassMeta(datasetId: string) {
  const classKey = getStudyClassKey(datasetId);

  if (classKey === 'cnn') {
    return {
      label: 'CNN',
      icon: 'panel' as const,
      paletteClass: 'bg-[#fff4ea] text-[#b95b16]',
    };
  }

  if (classKey === 'augmentation') {
    return {
      label: 'Data Augmentation',
      icon: 'flask' as const,
      paletteClass: 'bg-[#ebfbf5] text-[#0b7d6f]',
    };
  }

  return {
    label: 'MLP',
    icon: 'layers' as const,
    paletteClass: 'bg-[#edf3ff] text-[#2456c9]',
  };
}

export function Sidebar({
  selectedDatasetId,
  activeWorkspace,
  hasCompetitionRoom = false,
  selectedDataset,
  availableBlockTypes,
  onDatasetSelect,
  onWorkspaceSelect,
  onBlockDragStart,
  onBlockDragEnd,
}: SidebarProps) {
  const [hoveredDatasetId, setHoveredDatasetId] = useState<string | null>(null);
  const [isCompetitionDatasetOpen, setIsCompetitionDatasetOpen] = useState(false);
  const [activeGuideBlockId, setActiveGuideBlockId] = useState<BlockType | null>(null);
  const [openedTutorialDatasetId, setOpenedTutorialDatasetId] = useState<string | null>(null);
  const hoveredDataset =
    datasets.find((dataset) => dataset.id === hoveredDatasetId) ?? null;
  const tutorialDatasets = datasets.filter(
    (dataset) => dataset.id === 'mnist' || dataset.id === 'fashion_mnist' || dataset.id === 'cifar10',
  );
  const activeTutorialDataset =
    activeWorkspace === 'tutorial' && openedTutorialDatasetId === selectedDatasetId
      ? (selectedDataset ?? datasets.find((dataset) => dataset.id === selectedDatasetId) ?? null)
      : null;
  const activeGuideBlock =
    libraryBlocks.find((block) => block.id === activeGuideBlockId && availableBlockTypes.includes(block.id)) ?? null;
  const visibleBlocks =
    activeWorkspace === 'tutorial'
      ? libraryBlocks.filter((block) => availableBlockTypes.includes(block.id))
      : libraryBlocks;

  return (
    <aside className="flex h-full flex-col gap-5 bg-surface p-4">
      <section className="grid gap-2.5">
        <h2 className="ui-label text-[12px] tracking-[0.2em]">
          Workspace
        </h2>
        <div className="grid gap-2.5">
          <button
            type="button"
            onClick={() => onWorkspaceSelect('tutorial')}
            className={[
              'flex items-center gap-3 rounded-[20px] px-3.5 py-4 text-left transition-all',
              activeWorkspace === 'tutorial'
                ? 'bg-[linear-gradient(135deg,#2456c9,#4f7cff)] text-white shadow-[0_14px_28px_rgba(36,86,201,0.22)]'
                : 'bg-white text-[#41526d] shadow-[0_12px_28px_rgba(13,27,51,0.05)] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.12)] hover:-translate-y-0.5 hover:bg-[#f8fbff]',
            ].join(' ')}
          >
            <span
              className={[
                'grid h-10 w-10 place-items-center rounded-[14px]',
                activeWorkspace === 'tutorial'
                  ? 'bg-white/14 text-white'
                  : 'bg-[#edf3ff] text-[#2456c9]',
              ].join(' ')}
            >
              <Icon name="layers" />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-bold">VisAible Tutorial</span>
              <span
                className={[
                  'mt-1 block text-[12px] font-semibold',
                  activeWorkspace === 'tutorial' ? 'text-white/78' : 'text-[#70819a]',
                ].join(' ')}
              >
                모델을 쌓고 학습 결과를 바로 확인
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => onWorkspaceSelect('builder')}
            className={[
              'flex items-center gap-3 rounded-[20px] px-3.5 py-4 text-left transition-all',
              activeWorkspace === 'builder'
                ? 'bg-[linear-gradient(135deg,#0b7d6f,#1aa794)] text-white shadow-[0_14px_28px_rgba(11,125,111,0.2)]'
                : 'bg-white text-[#41526d] shadow-[0_12px_28px_rgba(13,27,51,0.05)] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.12)] hover:-translate-y-0.5 hover:bg-[#f8fbff]',
            ].join(' ')}
          >
            <span
              className={[
                'grid h-10 w-10 place-items-center rounded-[14px]',
                activeWorkspace === 'builder'
                  ? 'bg-white/14 text-white'
                  : 'bg-[#edf8f6] text-[#0b7d6f]',
              ].join(' ')}
            >
              <Icon name="flask" />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-bold">VisAible Lab</span>
              <span
                className={[
                  'mt-1 block text-[12px] font-semibold',
                  activeWorkspace === 'builder' ? 'text-white/78' : 'text-[#70819a]',
                ].join(' ')}
              >
                curriculum의 VisAible Lab 흐름으로 단계별 학습
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => onWorkspaceSelect('competition')}
            className={[
              'flex items-center gap-3 rounded-[20px] px-3.5 py-4 text-left transition-all',
              activeWorkspace === 'competition'
                ? 'bg-[linear-gradient(135deg,#1151ff,#2f6cff)] text-white shadow-[0_14px_28px_rgba(17,81,255,0.22)]'
                : 'bg-white text-[#41526d] shadow-[0_12px_28px_rgba(13,27,51,0.05)] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.12)] hover:-translate-y-0.5 hover:bg-[#f8fbff]',
            ].join(' ')}
          >
            <span
              className={[
                'grid h-10 w-10 place-items-center rounded-[14px]',
                activeWorkspace === 'competition'
                  ? 'bg-white/14 text-white'
                  : 'bg-[#edf3ff] text-primary',
              ].join(' ')}
            >
              <Icon name="trophy" />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-bold">VisAible Competition</span>
              <span
                className={[
                  'mt-1 block text-[12px] font-semibold',
                  activeWorkspace === 'competition' ? 'text-white/78' : 'text-[#70819a]',
                ].join(' ')}
              >
                대회 모드에서 바로 제출까지 진행
              </span>
            </span>
          </button>
        </div>
      </section>

      {activeWorkspace === 'builder' ? (
        <section className="grid gap-2.5">
            <h2 className="ui-label text-[12px] tracking-[0.2em]">
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
                    'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[14px] font-semibold transition-colors',
                    dataset.id === selectedDatasetId
                      ? 'bg-primary/10 text-primary'
                      : 'text-[#4b5b77] hover:bg-white/60',
                  ].join(' ')}
                >
                  <Icon name={dataset.icon} />
                  <span>{dataset.label}</span>
                </button>
              ))}

              {hoveredDataset ? (
                <div className="pointer-events-none fixed left-[calc(clamp(264px,18vw,372px)+clamp(20px,2vw,40px)+32px)] top-4 z-40 hidden xl:block">
                  <DatasetDetailPanel
                    dataset={hoveredDataset}
                    widthClassName="w-[640px]"
                    largeSamples
                  />
                </div>
              ) : null}
            </div>
          </section>
      ) : null}

      {activeWorkspace === 'tutorial' ? (
        <section className="grid gap-2.5">
          <h2 className="ui-label text-[12px] tracking-[0.2em]">
            Class Selection
          </h2>
          <div className="relative grid gap-2">
            {tutorialDatasets.map((dataset) => {
              const classMeta = getStudyClassMeta(dataset.id);

              return (
                <button
                  key={dataset.id}
                  type="button"
                  onClick={() => {
                    onDatasetSelect(dataset.id);
                    setOpenedTutorialDatasetId(dataset.id);
                  }}
                  className={[
                    'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[14px] font-semibold transition-colors',
                    dataset.id === selectedDatasetId
                      ? 'bg-primary/10 text-primary'
                      : 'text-[#4b5b77] hover:bg-white/60',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'grid h-8 w-8 place-items-center rounded-[12px]',
                      classMeta.paletteClass,
                    ].join(' ')}
                  >
                    <Icon name={classMeta.icon} />
                  </span>
                  <span>{classMeta.label}</span>
                </button>
              );
            })}

            {activeTutorialDataset ? (
              <div className="fixed left-[calc(clamp(264px,18vw,372px)+clamp(20px,2vw,40px)+32px)] top-4 z-40 hidden xl:block">
                <TutorialDatasetPanel
                  dataset={activeTutorialDataset}
                  onClose={() => setOpenedTutorialDatasetId(null)}
                />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeWorkspace === 'competition' && hasCompetitionRoom && selectedDataset ? (
        <section className="relative grid gap-2.5">
          <h2 className="ui-label text-[12px] tracking-[0.2em]">
            Classroom
          </h2>
          <div className="rounded-[22px] bg-white px-4 py-4 shadow-[0_12px_28px_rgba(13,27,51,0.06)] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.12)]">
            <div className="ui-label">
              Selected Dataset
            </div>
            <div className="mt-2 font-display text-[18px] font-bold leading-[1.2] text-ink">
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
            <div className="fixed left-[calc(clamp(264px,18vw,372px)+clamp(20px,2vw,40px)+32px)] top-4 z-40 hidden xl:block">
              <DatasetDetailPanel
                dataset={selectedDataset}
                widthClassName="w-[680px]"
                largeSamples
                onClose={() => setIsCompetitionDatasetOpen(false)}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="sticky top-4 grid content-start gap-2.5 self-start">
          <h2 className="ui-label text-[12px] tracking-[0.2em]">
            Block Library
          </h2>
          <div className="grid gap-2.5">
            {visibleBlocks.map((block) => (
              <div
                key={block.id}
                className="ghost-border relative rounded-[20px] bg-white/85 shadow-[0_12px_28px_rgba(13,27,51,0.05)]"
              >
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
                  className="flex w-full cursor-grab items-start gap-3 rounded-[20px] px-3.5 py-4 pr-12 text-left transition-transform hover:-translate-y-0.5 active:cursor-grabbing"
                >
                  <div
                    className={[
                      'grid h-7 w-7 place-items-center',
                      accentClassName(block.accent),
                    ].join(' ')}
                  >
                    <Icon name={block.icon} />
                  </div>
                  <div className="grid gap-1">
                    <h3 className="font-display text-[18px] font-bold leading-[1.18] text-ink">{block.title}</h3>
                    <p className="text-[15px] leading-[1.3] text-muted">{block.description}</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveGuideBlockId(block.id)}
                  aria-label={`${block.title} 설명 보기`}
                  className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-[#f5f7fb] text-[#9daecc] transition hover:bg-[#eef3fb] hover:text-[#8498bb]"
                >
                  <Icon name="help" className="h-4.5 w-4.5" />
                </button>
              </div>
            ))}
          </div>
        </section>

      {activeGuideBlock ? (
        <LayerGuideModal block={activeGuideBlock} onClose={() => setActiveGuideBlockId(null)} />
      ) : null}
    </aside>
  );
}

const tutorialCopy: Record<
  StudyClassKey,
  {
    eyebrow: string;
    title: string;
    summary: string;
    bullets: string[];
    accentClassName: string;
  }
> = {
  mlp: {
    eyebrow: 'Study Focus',
    title: 'MLP Class',
    summary:
      '숫자 이미지를 펼쳐서 완전연결층으로 분류하는 가장 기본적인 흐름을 익히는 수업입니다.',
    bullets: [
      '입력과 출력이 어떻게 연결되는지 먼저 감각적으로 볼 수 있습니다.',
      '은닉층이 늘어날수록 더 복잡한 패턴을 표현한다는 점을 이해하기 좋습니다.',
      'CNN으로 넘어가기 전에 신경망의 기본 구조를 잡는 데 적합합니다.',
    ],
    accentClassName: 'text-[#2456c9]',
  },
  cnn: {
    eyebrow: 'Study Focus',
    title: 'CNN Class',
    summary:
      '이미지에서 작은 필터가 패턴을 찾고, pooling으로 핵심 정보를 남기는 흐름을 배우는 수업입니다.',
    bullets: [
      '컨볼루션이 모서리와 질감 같은 로컬 특징을 찾는 방식에 집중합니다.',
      '채널이 늘수록 더 다양한 특징을 동시에 본다는 점을 익힐 수 있습니다.',
      '왜 이미지에는 MLP보다 CNN이 더 잘 맞는지 자연스럽게 비교할 수 있습니다.',
    ],
    accentClassName: 'text-[#b95b16]',
  },
  augmentation: {
    eyebrow: 'Study Focus',
    title: 'Data Augmentation Class',
    summary:
      '같은 이미지라도 조금씩 바뀐 입력을 보여주면 모델이 더 일반화된 규칙을 배운다는 점을 설명하는 수업입니다.',
    bullets: [
      'flip, crop, color 변화가 들어와도 같은 대상을 같은 클래스로 보게 만드는 감각을 익힙니다.',
      '같은 구조라도 데이터 준비 방식에 따라 성능 차이가 날 수 있다는 점을 보여줍니다.',
      '실전 데이터가 흔들리거나 다양한 환경에서 들어올 때 왜 augmentation이 중요한지 연결해줍니다.',
    ],
    accentClassName: 'text-[#0b7d6f]',
  },
};

function TutorialDatasetPanel({
  dataset,
  onClose,
}: {
  dataset: DatasetItem;
  onClose: () => void;
}) {
  const copy = tutorialCopy[getStudyClassKey(dataset.id)];
  const previewSamples = (dataset.sampleClasses ?? []).slice(0, 4);

  return (
    <div className="flex max-h-[calc(100vh-40px)] w-[min(860px,calc(100vw-460px))] min-w-[720px] flex-col overflow-hidden rounded-[30px] border border-[rgba(110,132,174,0.24)] bg-[linear-gradient(180deg,#ffffff,#f8fbff)] px-6 py-5 shadow-[0_34px_80px_rgba(13,27,51,0.2)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-extrabold uppercase tracking-[0.2em] text-[#70819a]">
            {copy.eyebrow}
          </div>
          <div className="mt-2 font-display text-[32px] font-bold leading-[1.02] tracking-[-0.04em] text-[#10213b]">
            {copy.title}
          </div>
          <div className="mt-3 max-w-[700px] text-[14px] leading-6.5 text-[#53637f]">
            {copy.summary}
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
            <div className={`text-[11px] font-extrabold uppercase tracking-[0.18em] ${copy.accentClassName}`}>
              VisAible Lab
            </div>
            <div className="mt-3 grid gap-2.5">
              {copy.bullets.map((item) => (
                <div
                  key={item}
                  className="rounded-[18px] border border-[rgba(129,149,188,0.14)] bg-white px-4 py-3 text-[13px] leading-6 text-[#53637f] shadow-[0_10px_24px_rgba(13,27,51,0.04)]"
                >
                  {item}
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.28)] p-6 backdrop-blur-sm">
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
    </div>
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
          <div className={largeSamples ? 'mt-1.5 truncate font-display text-[24px] font-bold leading-none text-ink' : 'mt-1 truncate font-display text-[20px] font-bold text-ink'}>
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
          <div className={largeSamples ? 'mt-1.5 font-mono text-[18px] font-semibold text-ink' : 'mt-1 font-mono text-[14px] font-semibold text-ink'}>
            {dataset.inputShape}
          </div>
        </div>
        <div className={largeSamples ? 'rounded-[18px] bg-[#f6f8ff] px-3.5 py-3.5' : 'rounded-[16px] bg-[#f6f8ff] px-3 py-2'}>
          <div className={largeSamples ? 'text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted' : 'text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted'}>
            Class Num
          </div>
          <div className={largeSamples ? 'mt-1.5 text-[18px] font-semibold text-ink' : 'mt-1 text-[14px] font-semibold text-ink'}>
            {dataset.classCount ?? '-'}
          </div>
        </div>
        <div className={largeSamples ? 'rounded-[18px] bg-[#f6f8ff] px-3.5 py-3.5' : 'rounded-[16px] bg-[#f6f8ff] px-3 py-2'}>
          <div className={largeSamples ? 'text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted' : 'text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted'}>
            Samples
          </div>
          <div className={largeSamples ? 'mt-1.5 text-[18px] font-semibold text-ink' : 'mt-1 text-[14px] font-semibold text-ink'}>
            {dataset.records}
          </div>
        </div>
      </div>
    </div>
  );
}
