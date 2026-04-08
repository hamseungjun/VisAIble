'use client';

import Image from 'next/image';
import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  augmentationGroups,
  augmentationParameterConfig,
} from '@/lib/constants/augmentations';
import type { TrainingAugmentationId, TrainingAugmentationParams } from '@/types/builder';

type AugmentationPanelProps = {
  selectedAugmentations: TrainingAugmentationId[];
  onToggle: (id: TrainingAugmentationId) => void;
  augmentationParams: TrainingAugmentationParams;
  onChangeParam: (id: TrainingAugmentationId, value: number) => void;
  autoOpenGuideOnSelect?: boolean;
  activeGroupId?: string;
  onActiveGroupChange?: (groupId: string) => void;
  guideAugmentationId?: TrainingAugmentationId | null;
  onGuideAugmentationChange?: (augmentationId: TrainingAugmentationId | null) => void;
};

export function AugmentationPanel({
  selectedAugmentations,
  onToggle,
  augmentationParams,
  onChangeParam,
  autoOpenGuideOnSelect = true,
  activeGroupId: controlledActiveGroupId,
  onActiveGroupChange,
  guideAugmentationId: controlledGuideAugmentationId,
  onGuideAugmentationChange,
}: AugmentationPanelProps) {
  const [uncontrolledActiveGroupId, setUncontrolledActiveGroupId] = useState(augmentationGroups[0]?.id ?? 'mixing');
  const [uncontrolledGuideAugmentationId, setUncontrolledGuideAugmentationId] =
    useState<TrainingAugmentationId | null>(null);
  const activeGroupId = controlledActiveGroupId ?? uncontrolledActiveGroupId;
  const guideAugmentationId = controlledGuideAugmentationId ?? uncontrolledGuideAugmentationId;
  const setActiveGroupId = (groupId: string) => {
    if (controlledActiveGroupId === undefined) {
      setUncontrolledActiveGroupId(groupId);
    }
    onActiveGroupChange?.(groupId);
  };
  const setGuideAugmentationId = (augmentationId: TrainingAugmentationId | null) => {
    if (controlledGuideAugmentationId === undefined) {
      setUncontrolledGuideAugmentationId(augmentationId);
    }
    onGuideAugmentationChange?.(augmentationId);
  };
  const activeGroup =
    augmentationGroups.find((group) => group.id === activeGroupId) ?? augmentationGroups[0];

  return (
    <section
      className="mb-2.5 overflow-hidden rounded-[28px] border border-[#dbe5f1] bg-[#f8fbff] shadow-[0_16px_36px_rgba(15,23,42,0.06)] [font-family:var(--font-inter)]"
      data-tutorial-target="tutorial-augmentation-panel"
    >
      <div className="px-5 py-4">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {augmentationGroups.map((group) => {
            const selectedCount = group.options.filter((option) =>
              selectedAugmentations.includes(option.id),
            ).length;
            const active = group.id === activeGroup?.id;

            return (
              <button
                key={group.id}
                type="button"
                onClick={() => setActiveGroupId(group.id)}
                data-tutorial-target={`tutorial-augmentation-group-${group.id}`}
                className={[
                  'relative isolate rounded-[20px] px-4 py-3 text-left transition-all',
                  active
                    ? 'bg-[linear-gradient(135deg,#edf4ff,#dfeaff)] text-primary shadow-[0_12px_24px_rgba(17,81,255,0.08),inset_0_0_0_1px_rgba(17,81,255,0.14)]'
                    : 'bg-white text-[#53657f] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.12)] hover:bg-[#f4f8ff]',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-semibold tracking-[0.02em] text-current/95">
                    {group.title}
                  </span>
                  <span
                    className={[
                      'relative z-10 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                      selectedCount > 0
                        ? 'bg-white text-primary shadow-[inset_0_0_0_1px_rgba(17,81,255,0.1)]'
                        : 'bg-[#eef3fb] text-[#8da0bb]',
                    ].join(' ')}
                  >
                    {selectedCount}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {activeGroup ? (
          <div className="mt-3 rounded-[24px] bg-white px-4 py-4 shadow-[0_12px_28px_rgba(13,27,51,0.04)] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.12)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="rounded-full bg-[#edf3ff] px-3 py-1.5 text-[11px] font-semibold tracking-[0.08em] text-primary">
                {activeGroup.options.filter((option) => selectedAugmentations.includes(option.id)).length}
                {' '}
                selected
              </div>
            </div>

            <div className="mt-4 grid gap-2.5 xl:grid-cols-2">
              {activeGroup.options.map((option) => {
                const active = selectedAugmentations.includes(option.id);
                const parameterConfig = augmentationParameterConfig[option.id];
                const parameterValue =
                  augmentationParams[option.id] ?? parameterConfig.defaultValue;

                return (
                  <div
                    key={option.id}
                    role="button"
                    tabIndex={0}
                    data-tutorial-target={`tutorial-augmentation-option-${option.id}`}
                    onClick={() => {
                      if (!active) {
                        onToggle(option.id);
                      }
                      if (autoOpenGuideOnSelect) {
                        setGuideAugmentationId(option.id);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') {
                        return;
                      }
                      event.preventDefault();
                      if (!active) {
                        onToggle(option.id);
                      }
                      if (autoOpenGuideOnSelect) {
                        setGuideAugmentationId(option.id);
                      }
                    }}
                    aria-label={`${option.label} 설정 열기`}
                    className={[
                      'relative cursor-pointer rounded-[18px] px-3.5 py-3 text-left transition-all',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
                      active
                        ? 'bg-[linear-gradient(135deg,#edf4ff,#dfeaff)] text-primary shadow-[0_10px_22px_rgba(17,81,255,0.1),inset_0_0_0_1px_rgba(17,81,255,0.14)]'
                        : 'bg-[#f6f9ff] text-[#5d6f8a] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.12)] hover:bg-[#eef4ff]',
                    ].join(' ')}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggle(option.id);
                        }}
                        aria-label={active ? `${option.label} 비활성화` : `${option.label} 활성화`}
                        className="relative z-10 mt-0.5 shrink-0"
                      >
                        <span
                          className={[
                            'grid h-5 w-5 place-items-center rounded-full text-[11px] font-black transition-colors',
                            active ? 'bg-primary text-white' : 'bg-white text-[#9aabc5]',
                          ].join(' ')}
                        >
                          {active ? '✓' : ''}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (!active) {
                            onToggle(option.id);
                          }
                          if (autoOpenGuideOnSelect) {
                            setGuideAugmentationId(option.id);
                          }
                        }}
                        className="relative z-10 block min-w-0 flex-1 text-left"
                      >
                        <div className="text-[15px] font-semibold tracking-[-0.01em] text-current">
                          {option.label}
                        </div>
                        <div className="mt-1 text-[12px] font-medium text-[#7a8da8]">
                          {active ? 'Selected. Click to adjust settings.' : 'Click to select and open settings.'}
                        </div>
                      </button>
                    </div>
                    {active ? (
                      <div
                        className="relative z-10 mt-3 rounded-[16px] bg-white/78 px-3 py-3 shadow-[inset_0_0_0_1px_rgba(17,81,255,0.1)]"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[11px] font-medium tracking-[0.06em] text-[#5d6f8a]">
                            {parameterConfig.label}
                          </div>
                          <div className="text-[13px] font-semibold text-primary">
                            {parameterValue}
                            {parameterConfig.suffix}
                          </div>
                        </div>
                        <input
                          type="range"
                          min={parameterConfig.min}
                          max={parameterConfig.max}
                          value={parameterValue}
                          onChange={(event) => onChangeParam(option.id, Number(event.target.value))}
                          className="mt-2 h-1.5 w-full accent-primary"
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {guideAugmentationId ? (
        <AugmentationGuideModal
          augmentationId={guideAugmentationId}
          value={
            augmentationParams[guideAugmentationId] ??
            augmentationParameterConfig[guideAugmentationId].defaultValue
          }
          isSelected={selectedAugmentations.includes(guideAugmentationId)}
          onToggle={() => onToggle(guideAugmentationId)}
          onChangeValue={(value) => onChangeParam(guideAugmentationId, value)}
          onClose={() => setGuideAugmentationId(null)}
        />
      ) : null}
    </section>
  );
}

const augmentationGuideCopy: Record<
  TrainingAugmentationId,
  {
    title: string;
    eyebrow: string;
    summary: string;
    tip: string;
  }
> = {
  mixup: {
    title: 'MixUp',
    eyebrow: '두 이미지를 부드럽게 섞는 증강',
    summary: '고양이 사진 두 장을 비율로 섞어서 경계를 더 부드럽게 학습하게 합니다. 모델이 한 장면만 외우지 않고 클래스 사이를 더 매끈하게 구분하게 돕습니다.',
    tip: '데이터가 적거나 과적합이 빠를 때 안정적으로 성능을 올리기 좋습니다.',
  },
  cutmix: {
    title: 'CutMix',
    eyebrow: '다른 이미지의 일부 패치를 붙이는 증강',
    summary: '원본 고양이 사진 안에 다른 변형 이미지를 일부 패치로 섞습니다. 모델이 특정 한 위치만 보는 대신 부분 특징과 전체 맥락을 같이 보게 만듭니다.',
    tip: '작은 물체나 국소 패턴을 잘 보게 만들고 싶을 때 특히 유용합니다.',
  },
  flip_rotate: {
    title: 'Random Horizontal Flip',
    eyebrow: '좌우 방향이 달라도 같은 대상으로 보게 하는 증강',
    summary: '고양이 사진을 좌우로 뒤집어 보여주면서 방향이 바뀌어도 같은 특징으로 인식하게 합니다. 특정 방향만 외우지 않도록 만드는 가장 기본적인 기하학 증강입니다.',
    tip: '좌우 방향 차이가 자주 생기는 이미지에서 가장 부담 없이 넣기 좋은 기본 증강입니다.',
  },
  random_crop: {
    title: 'Random Crop',
    eyebrow: '프레이밍이 달라도 핵심을 보는 증강',
    summary: '고양이 사진을 살짝 잘라 다른 구도로 보여줍니다. 중심 위치에 대한 의존을 줄이고, 일부만 보여도 특징을 찾는 연습을 하게 합니다.',
    tip: '배경보다 대상 자체를 보게 만들고 싶을 때 가장 기본으로 쓰기 좋습니다.',
  },
  color_jitter: {
    title: 'Color Jitter',
    eyebrow: '색과 밝기 변화를 견디게 하는 증강',
    summary: '밝기, 대비, 채도, hue를 바꿔 조명 조건이 달라져도 같은 고양이로 인식하게 합니다.',
    tip: '실내외, 그림자, 화이트밸런스 차이가 큰 데이터에 특히 효과적입니다.',
  },
  contrast_boost: {
    title: 'Contrast Boost',
    eyebrow: '경계와 질감을 더 또렷하게 보게 하는 증강',
    summary: '대비를 높여 털결, 얼굴 윤곽, 배경과의 경계가 더 강하게 보이도록 만듭니다.',
    tip: '형태와 윤곽이 중요한 분류에서 비교적 직관적으로 이해하기 좋은 증강입니다.',
  },
  grayscale: {
    title: 'Grayscale',
    eyebrow: '색이 줄어도 형태 중심으로 보는 증강',
    summary: '고양이 사진을 회색조로 바꿔 색상 대신 귀 모양, 얼굴 윤곽, 자세 같은 구조적 특징을 보게 합니다.',
    tip: '색상 편향이 강할 때 형태 중심의 표현을 배우게 하는 데 도움이 됩니다.',
  },
};

function AugmentationGuideModal({
  augmentationId,
  value,
  isSelected,
  onToggle,
  onChangeValue,
  onClose,
}: {
  augmentationId: TrainingAugmentationId;
  value: number;
  isSelected: boolean;
  onToggle: () => void;
  onChangeValue: (value: number) => void;
  onClose: () => void;
}) {
  const copy = augmentationGuideCopy[augmentationId];
  const [mounted, setMounted] = useState(false);
  const [cropOffsetY, setCropOffsetY] = useState(-6);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[260] flex items-start justify-center bg-[rgba(15,23,42,0.28)] px-6 pb-6 pt-8 backdrop-blur-sm md:pt-6">
      <div
        className="relative w-full max-w-[980px] overflow-hidden rounded-[34px] bg-[linear-gradient(180deg,#ffffff,#f7fbfb)] p-6 shadow-[0_30px_80px_rgba(13,27,51,0.22)] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.14)] [font-family:var(--font-inter)] md:p-7"
        data-tutorial-target={`tutorial-augmentation-guide-${augmentationId}`}
      >
        <button
          type="button"
          onClick={onClose}
          data-tutorial-target="tutorial-augmentation-guide-close"
          className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full bg-white text-[#7b8da9] shadow-[0_12px_24px_rgba(13,27,51,0.08)] transition hover:text-[#12213f]"
          aria-label="설명 닫기"
        >
          <span className="text-[22px] leading-none">×</span>
        </button>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_360px] xl:items-start">
          <div className="rounded-[28px] bg-[linear-gradient(180deg,#eef8f7,#ffffff)] p-6 shadow-[inset_0_0_0_1px_rgba(129,149,188,0.12)] md:min-h-[470px] md:p-7">
            <div className="mb-4 flex items-center gap-3">
              <div>
                <div className="text-[12px] font-semibold tracking-[0.12em] text-[#71839d]">
                  Augmentation Guide
                </div>
                <div className="text-[26px] font-semibold tracking-[-0.03em] text-ink">{copy.title}</div>
              </div>
            </div>
            <AugmentationGuideVisual
              augmentationId={augmentationId}
              mixStrength={augmentationId === 'mixup' ? value : augmentationParameterConfig.mixup.defaultValue}
              patchScale={augmentationId === 'cutmix' ? value : augmentationParameterConfig.cutmix.defaultValue}
              flipChance={
                augmentationId === 'flip_rotate'
                  ? value
                  : augmentationParameterConfig.flip_rotate.defaultValue
              }
              cropZoom={
                augmentationId === 'random_crop'
                  ? value
                  : augmentationParameterConfig.random_crop.defaultValue
              }
              cropOffsetY={cropOffsetY}
              jitterStrength={
                augmentationId === 'color_jitter'
                  ? value
                  : augmentationParameterConfig.color_jitter.defaultValue
              }
              contrastStrength={
                augmentationId === 'contrast_boost'
                  ? value
                  : augmentationParameterConfig.contrast_boost.defaultValue
              }
              grayscaleStrength={
                augmentationId === 'grayscale'
                  ? value
                  : augmentationParameterConfig.grayscale.defaultValue
              }
            />
          </div>

          <div className="grid content-start gap-5 md:min-h-[470px]">
            <div className="rounded-[24px] bg-[linear-gradient(180deg,#ffffff,#f6fbff)] px-5 py-7 shadow-[0_10px_24px_rgba(13,27,51,0.05)] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.1)]">
              <div className="text-[11px] font-semibold tracking-[0.14em] text-[#1a6170]">
                Why It Matters
              </div>
              <div className="mt-2 text-[14px] font-semibold leading-6 text-[#3d7280]">
                {copy.eyebrow}
              </div>
              <div className="mt-2 text-[15px] leading-7 text-[#50617c]">{copy.summary}</div>
            </div>

            <div className="rounded-[22px] bg-[linear-gradient(135deg,#eef8f7,#f4fbfb)] px-5 py-7 shadow-[inset_0_0_0_1px_rgba(26,97,112,0.08)]">
              <div className="text-[12px] font-semibold tracking-[0.12em] text-[#1a6170]">
                Quick Tip
              </div>
              <div className="mt-2 text-[15px] leading-7 text-[#41526d]">{copy.tip}</div>
            </div>

            <div className="rounded-[22px] bg-white px-5 py-7 shadow-[0_10px_24px_rgba(13,27,51,0.05)] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.1)]">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[12px] font-semibold tracking-[0.12em] text-[#1a6170]">
                  Applied Parameters
                </div>
                <button
                  type="button"
                  onClick={onToggle}
                  className={[
                    'rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors',
                    isSelected
                      ? 'bg-[#e7f0ff] text-primary shadow-[inset_0_0_0_1px_rgba(17,81,255,0.12)]'
                      : 'bg-[#f2f5fb] text-[#6f819d] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.12)]',
                  ].join(' ')}
                >
                  {isSelected ? 'Selected' : 'Select augmentation'}
                </button>
              </div>
              <div className="mt-4 grid gap-4">
                {augmentationId === 'mixup' ? (
                  <GuideSlider
                    label="Mix Ratio"
                    value={value}
                    min={10}
                    max={80}
                    onChange={onChangeValue}
                    suffix="%"
                    targetName="tutorial-augmentation-slider-mixup"
                  />
                ) : null}
                {augmentationId === 'cutmix' ? (
                  <GuideSlider
                    label="Patch Size"
                    value={value}
                    min={24}
                    max={56}
                    onChange={onChangeValue}
                    suffix="%"
                    targetName="tutorial-augmentation-slider-cutmix"
                  />
                ) : null}
                {augmentationId === 'flip_rotate' ? (
                  <GuideSlider
                    label="Flip Chance"
                    value={value}
                    min={10}
                    max={100}
                    onChange={onChangeValue}
                    suffix="%"
                    targetName="tutorial-augmentation-slider-flip_rotate"
                  />
                ) : null}
                {augmentationId === 'random_crop' ? (
                  <>
                    <GuideSlider
                      label="Zoom"
                      value={value}
                      min={108}
                      max={145}
                      onChange={onChangeValue}
                      suffix="%"
                      targetName="tutorial-augmentation-slider-random_crop"
                    />
                    <GuideSlider
                      label="Vertical Focus"
                      value={cropOffsetY}
                      min={-18}
                      max={8}
                      onChange={setCropOffsetY}
                      suffix="px"
                    />
                  </>
                ) : null}
                {augmentationId === 'color_jitter' ? (
                  <GuideSlider
                    label="Jitter"
                    value={value}
                    min={0}
                    max={40}
                    onChange={onChangeValue}
                    suffix="%"
                    targetName="tutorial-augmentation-slider-color_jitter"
                  />
                ) : null}
                {augmentationId === 'contrast_boost' ? (
                  <GuideSlider
                    label="Contrast"
                    value={value}
                    min={100}
                    max={170}
                    onChange={onChangeValue}
                    suffix="%"
                  />
                ) : null}
                {augmentationId === 'grayscale' ? (
                  <GuideSlider
                    label="Grayscale"
                    value={value}
                    min={0}
                    max={100}
                    onChange={onChangeValue}
                    suffix="%"
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function AugmentationGuideVisual({
  augmentationId,
  mixStrength,
  patchScale,
  flipChance,
  cropZoom,
  cropOffsetY,
  jitterStrength,
  contrastStrength,
  grayscaleStrength,
}: {
  augmentationId: TrainingAugmentationId;
  mixStrength: number;
  patchScale: number;
  flipChance: number;
  cropZoom: number;
  cropOffsetY: number;
  jitterStrength: number;
  contrastStrength: number;
  grayscaleStrength: number;
}) {
  const primaryCatImage = '/augmentation-guides/cat-primary.jpeg';
  const secondaryCatImage = '/augmentation-guides/cat-secondary.jpeg';
  const primaryObjectPosition = 'center 18%';
  const secondaryObjectPosition = 'center 24%';

  if (augmentationId === 'mixup') {
    return (
      <div className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-3">
          <GuideImageCard title="Original" imageSrc={primaryCatImage} objectPosition={primaryObjectPosition} />
          <GuideImageCard
            title="Second Sample"
            imageSrc={secondaryCatImage}
            imageStyle={{ filter: 'saturate(1.1) brightness(1.03)' }}
            objectPosition={secondaryObjectPosition}
          />
          <GuideImageCard
            title="Mixed Output"
            imageSrc={primaryCatImage}
            imageStyle={{ filter: 'brightness(1.03) saturate(1.08)' }}
            overlayClassName="bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(87,133,255,0.24))]"
            secondImageSrc={secondaryCatImage}
            secondImageStyle={{ opacity: mixStrength / 100, filter: 'saturate(1.15)' }}
            objectPosition={primaryObjectPosition}
            secondObjectPosition={secondaryObjectPosition}
          />
        </div>
      <div className="text-center text-[14px] font-bold text-[#1a6170]">
        두 고양이 이미지를 부드럽게 섞어 클래스 경계를 매끈하게 만듭니다
      </div>
      </div>
    );
  }

  if (augmentationId === 'cutmix') {
    return (
      <div className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <GuideImageCard title="Original" imageSrc={primaryCatImage} objectPosition={primaryObjectPosition} />
          <GuideImageCard
            title="CutMix Result"
            imageSrc={primaryCatImage}
            patchImageSrc={secondaryCatImage}
            patchImageStyle={{ transform: 'scale(1.08) rotate(6deg)', filter: 'saturate(1.08)' }}
            objectPosition={primaryObjectPosition}
            patchObjectPosition={secondaryObjectPosition}
            patchFrameStyle={{ width: `${patchScale}%`, height: `${patchScale}%` }}
          />
        </div>
      <div className="text-center text-[14px] font-semibold text-[#1a6170]">
        다른 이미지의 일부 패치를 붙여 부분 특징과 전체 맥락을 같이 보게 합니다
      </div>
      </div>
    );
  }

  if (augmentationId === 'flip_rotate') {
    return (
      <GuideComparePair
        beforeTitle="Original"
        afterTitle="Random Horizontal Flip"
        beforeStyle={{}}
        afterStyle={{ transform: 'scaleX(-1)' }}
        helperText={`좌우 반전이 ${flipChance}% 확률로 적용됩니다`}
      />
    );
  }

  if (augmentationId === 'random_crop') {
    return (
      <GuideComparePair
        beforeTitle="Original"
        afterTitle="Random Crop"
        beforeStyle={{}}
        afterStyle={{ transform: `scale(${cropZoom / 100}) translate(8px, ${cropOffsetY}px)` }}
        objectPosition="center 18%"
        afterObjectPosition="center 10%"
      />
    );
  }

  if (augmentationId === 'color_jitter') {
    return (
      <GuideComparePair
        beforeTitle="Original"
        afterTitle="Color Jitter"
        beforeStyle={{}}
        afterStyle={{
          filter: `brightness(${1 + jitterStrength / 250}) contrast(${1 + jitterStrength / 180}) saturate(${1 + jitterStrength / 90}) hue-rotate(${jitterStrength}deg)`,
        }}
      />
    );
  }

  if (augmentationId === 'contrast_boost') {
    return (
      <GuideComparePair
        beforeTitle="Original"
        afterTitle="Contrast Boost"
        beforeStyle={{}}
        afterStyle={{ filter: `contrast(${contrastStrength / 100}) saturate(1.06)` }}
      />
    );
  }

  return (
    <GuideComparePair
      beforeTitle="Original"
      afterTitle="Grayscale"
      beforeStyle={{}}
      afterStyle={{ filter: `grayscale(${grayscaleStrength}%) contrast(1.08)` }}
    />
  );
}

function GuideComparePair({
  beforeTitle,
  afterTitle,
  beforeStyle,
  afterStyle,
  objectPosition = 'center 18%',
  afterObjectPosition,
  helperText = '같은 고양이 사진이 어떻게 바뀌는지 바로 비교해서 이해할 수 있습니다',
}: {
  beforeTitle: string;
  afterTitle: string;
  beforeStyle: CSSProperties;
  afterStyle: CSSProperties;
  objectPosition?: string;
  afterObjectPosition?: string;
  helperText?: string;
}) {
  const catImage = '/augmentation-guides/cat-primary.jpeg';

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <GuideImageCard title={beforeTitle} imageSrc={catImage} imageStyle={beforeStyle} objectPosition={objectPosition} />
        <GuideImageCard
          title={afterTitle}
          imageSrc={catImage}
          imageStyle={afterStyle}
          objectPosition={afterObjectPosition ?? objectPosition}
        />
      </div>
      <div className="text-center text-[14px] font-medium text-[#1a6170]">{helperText}</div>
    </div>
  );
}

function GuideImageCard({
  title,
  imageSrc,
  imageStyle,
  overlayClassName = '',
  secondImageSrc,
  secondImageStyle,
  patchImageSrc,
  patchImageStyle,
  objectPosition = 'center 18%',
  secondObjectPosition = 'center 18%',
  patchObjectPosition = 'center 18%',
  patchFrameStyle,
}: {
  title: string;
  imageSrc: string;
  imageStyle?: CSSProperties;
  overlayClassName?: string;
  secondImageSrc?: string;
  secondImageStyle?: CSSProperties;
  patchImageSrc?: string;
  patchImageStyle?: CSSProperties;
  objectPosition?: string;
  secondObjectPosition?: string;
  patchObjectPosition?: string;
  patchFrameStyle?: CSSProperties;
}) {
  return (
    <div className="grid gap-3">
      <div className="text-[12px] font-semibold tracking-[0.08em] text-[#5d6f8a]">
        {title}
      </div>
      <div className="relative h-[220px] overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.88),rgba(228,240,242,0.94))] shadow-[0_14px_34px_rgba(13,27,51,0.08)] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.12)]">
        <Image
          src={imageSrc}
          alt={title}
          fill
          className="object-cover"
          style={{ objectPosition, ...imageStyle }}
          sizes="(max-width: 768px) 100vw, 33vw"
        />
        {secondImageSrc ? (
          <Image
            src={secondImageSrc}
            alt={`${title} secondary`}
            fill
            className="object-cover"
            style={{ objectPosition: secondObjectPosition, ...secondImageStyle }}
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : null}
        {overlayClassName ? <div className={`absolute inset-0 ${overlayClassName}`} /> : null}
        {patchImageSrc ? (
          <div
            className="absolute right-[8%] top-[14%] h-[42%] w-[38%] overflow-hidden rounded-[18px] border-2 border-white/80 shadow-[0_12px_24px_rgba(13,27,51,0.18)]"
            style={patchFrameStyle}
          >
            <Image
              src={patchImageSrc}
              alt={`${title} patch`}
              fill
              className="object-cover"
              style={{ objectPosition: patchObjectPosition, ...patchImageStyle }}
              sizes="(max-width: 768px) 100vw, 20vw"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function GuideSlider({
  label,
  value,
  min,
  max,
  onChange,
  suffix,
  targetName,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  suffix: string;
  targetName?: string;
}) {
  return (
    <div data-tutorial-target={targetName}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[12px] font-medium tracking-[0.06em] text-[#5d6f8a]">
          {label}
        </div>
        <div className="text-[13px] font-semibold text-[#1a6170]">
          {value}
          {suffix}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 h-1.5 w-full accent-[#1a6170]"
      />
    </div>
  );
}
