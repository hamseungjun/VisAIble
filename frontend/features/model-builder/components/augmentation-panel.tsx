'use client';

import Image from 'next/image';
import { useState, type CSSProperties } from 'react';
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
};

export function AugmentationPanel({
  selectedAugmentations,
  onToggle,
  augmentationParams,
  onChangeParam,
}: AugmentationPanelProps) {
  const [activeGroupId, setActiveGroupId] = useState(augmentationGroups[0]?.id ?? 'mixing');
  const [guideAugmentationId, setGuideAugmentationId] = useState<TrainingAugmentationId | null>(null);
  const activeGroup =
    augmentationGroups.find((group) => group.id === activeGroupId) ?? augmentationGroups[0];

  return (
    <section className="mb-2.5 overflow-hidden rounded-[28px] border border-[#dbe5f1] bg-[#f8fbff] shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
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
                className={[
                  'rounded-[20px] px-4 py-3 text-left transition-all',
                  active
                    ? 'bg-[linear-gradient(135deg,#edf4ff,#dfeaff)] text-primary shadow-[0_12px_24px_rgba(17,81,255,0.08),inset_0_0_0_1px_rgba(17,81,255,0.14)]'
                    : 'bg-white text-[#53657f] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.12)] hover:bg-[#f4f8ff]',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-extrabold uppercase tracking-[0.14em]">
                    {group.title}
                  </span>
                  <span
                    className={[
                      'rounded-full px-2.5 py-1 text-[11px] font-extrabold',
                      selectedCount > 0
                        ? 'bg-white text-primary shadow-[inset_0_0_0_1px_rgba(17,81,255,0.1)]'
                        : 'bg-[#eef3fb] text-[#8da0bb]',
                    ].join(' ')}
                  >
                    {selectedCount}
                  </span>
                </div>
                <div className="mt-2 text-[12px] font-semibold leading-5 text-inherit/80">
                  {group.description}
                </div>
              </button>
            );
          })}
        </div>

        {activeGroup ? (
          <div className="mt-3 rounded-[24px] bg-white px-4 py-4 shadow-[0_12px_28px_rgba(13,27,51,0.04)] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.12)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#5d6f8a]">
                  {activeGroup.title}
                </div>
                <div className="mt-1 text-[13px] font-semibold leading-6 text-[#6a7b96]">
                  {activeGroup.description}
                </div>
              </div>
              <div className="rounded-full bg-[#edf3ff] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-primary">
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
                    className={[
                      'relative rounded-[18px] px-3.5 py-3 text-left transition-all',
                      active
                        ? 'bg-[linear-gradient(135deg,#edf4ff,#dfeaff)] text-primary shadow-[0_10px_22px_rgba(17,81,255,0.1),inset_0_0_0_1px_rgba(17,81,255,0.14)]'
                        : 'bg-[#f6f9ff] text-[#5d6f8a] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.12)] hover:bg-[#eef4ff]',
                    ].join(' ')}
                  >
                    <button
                      type="button"
                      onClick={() => onToggle(option.id)}
                      className="block w-full pr-9 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={[
                            'grid h-5 w-5 place-items-center rounded-full text-[11px] font-black',
                            active ? 'bg-primary text-white' : 'bg-white text-[#9aabc5]',
                          ].join(' ')}
                        >
                          {active ? '✓' : ''}
                        </span>
                        <span className="text-[14px] font-bold">{option.label}</span>
                      </div>
                      <div className="mt-2 text-[12px] font-semibold leading-5 text-inherit/80">
                        {option.description}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setGuideAugmentationId(option.id)}
                      aria-label={`${option.label} 설명 보기`}
                      className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-white/88 text-[11px] font-black text-[#7f92ae] shadow-[0_6px_14px_rgba(13,27,51,0.08)] transition hover:text-[#12324a]"
                    >
                      ?
                    </button>
                    {active ? (
                      <div className="mt-3 rounded-[16px] bg-white/78 px-3 py-3 shadow-[inset_0_0_0_1px_rgba(17,81,255,0.1)]">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#5d6f8a]">
                            {parameterConfig.label}
                          </div>
                          <div className="text-[13px] font-bold text-primary">
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
  onClose,
}: {
  augmentationId: TrainingAugmentationId;
  onClose: () => void;
}) {
  const copy = augmentationGuideCopy[augmentationId];
  const [mixStrength, setMixStrength] = useState(augmentationParameterConfig.mixup.defaultValue);
  const [patchScale, setPatchScale] = useState(augmentationParameterConfig.cutmix.defaultValue);
  const [flipChance, setFlipChance] = useState(augmentationParameterConfig.flip_rotate.defaultValue);
  const [cropZoom, setCropZoom] = useState(augmentationParameterConfig.random_crop.defaultValue);
  const [cropOffsetY, setCropOffsetY] = useState(-6);
  const [jitterStrength, setJitterStrength] = useState(
    augmentationParameterConfig.color_jitter.defaultValue,
  );
  const [contrastStrength, setContrastStrength] = useState(
    augmentationParameterConfig.contrast_boost.defaultValue,
  );
  const [grayscaleStrength, setGrayscaleStrength] = useState(
    augmentationParameterConfig.grayscale.defaultValue,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.28)] p-6 backdrop-blur-sm">
      <div className="relative w-full max-w-[1120px] overflow-hidden rounded-[34px] bg-[linear-gradient(180deg,#ffffff,#f7fbfb)] p-7 shadow-[0_30px_80px_rgba(13,27,51,0.22)] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.14)] md:p-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full bg-white text-[#7b8da9] shadow-[0_12px_24px_rgba(13,27,51,0.08)] transition hover:text-[#12213f]"
          aria-label="설명 닫기"
        >
          <span className="text-[22px] leading-none">×</span>
        </button>

        <div className="grid gap-6 md:grid-cols-[540px_minmax(0,1fr)] md:gap-8">
          <div className="rounded-[28px] bg-[linear-gradient(180deg,#eef8f7,#ffffff)] p-6 shadow-[inset_0_0_0_1px_rgba(129,149,188,0.12)]">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-[18px] bg-white text-[#1a6170] shadow-[0_8px_18px_rgba(26,97,112,0.1)]">
                <span className="text-[22px]">?</span>
              </div>
              <div>
                <div className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-[#71839d]">
                  Augmentation Guide
                </div>
                <div className="font-display text-[26px] font-bold text-ink">{copy.title}</div>
              </div>
            </div>
            <AugmentationGuideVisual
              augmentationId={augmentationId}
              mixStrength={mixStrength}
              patchScale={patchScale}
              flipChance={flipChance}
              cropZoom={cropZoom}
              cropOffsetY={cropOffsetY}
              jitterStrength={jitterStrength}
              contrastStrength={contrastStrength}
              grayscaleStrength={grayscaleStrength}
            />
          </div>

          <div className="grid content-start gap-5">
            <div>
              <div className="text-[13px] font-extrabold uppercase tracking-[0.18em] text-[#1a6170]">
                {copy.eyebrow}
              </div>
              <div className="mt-2 text-[19px] leading-9 text-[#50617c]">{copy.summary}</div>
            </div>

            <div className="rounded-[22px] bg-[linear-gradient(135deg,#eef8f7,#f4fbfb)] px-5 py-5 shadow-[inset_0_0_0_1px_rgba(26,97,112,0.08)]">
              <div className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-[#1a6170]">
                Quick Tip
              </div>
              <div className="mt-2 text-[16px] leading-8 text-[#41526d]">{copy.tip}</div>
            </div>

            <div className="rounded-[22px] bg-white px-5 py-5 shadow-[0_10px_24px_rgba(13,27,51,0.05)] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.1)]">
              <div className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-[#1a6170]">
                Try Parameters
              </div>
              <div className="mt-4 grid gap-4">
                {augmentationId === 'mixup' ? (
                  <GuideSlider
                    label="Mix Ratio"
                    value={mixStrength}
                    min={10}
                    max={80}
                    onChange={setMixStrength}
                    suffix="%"
                  />
                ) : null}
                {augmentationId === 'cutmix' ? (
                  <GuideSlider
                    label="Patch Size"
                    value={patchScale}
                    min={24}
                    max={56}
                    onChange={setPatchScale}
                    suffix="%"
                  />
                ) : null}
                {augmentationId === 'flip_rotate' ? (
                  <GuideSlider
                    label="Flip Chance"
                    value={flipChance}
                    min={10}
                    max={100}
                    onChange={setFlipChance}
                    suffix="%"
                  />
                ) : null}
                {augmentationId === 'random_crop' ? (
                  <>
                    <GuideSlider
                      label="Zoom"
                      value={cropZoom}
                      min={108}
                      max={145}
                      onChange={setCropZoom}
                      suffix="%"
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
                    value={jitterStrength}
                    min={0}
                    max={40}
                    onChange={setJitterStrength}
                    suffix="%"
                  />
                ) : null}
                {augmentationId === 'contrast_boost' ? (
                  <GuideSlider
                    label="Contrast"
                    value={contrastStrength}
                    min={100}
                    max={170}
                    onChange={setContrastStrength}
                    suffix="%"
                  />
                ) : null}
                {augmentationId === 'grayscale' ? (
                  <GuideSlider
                    label="Grayscale"
                    value={grayscaleStrength}
                    min={0}
                    max={100}
                    onChange={setGrayscaleStrength}
                    suffix="%"
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
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
        <div className="text-center text-[14px] font-bold text-[#1a6170]">
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
      <div className="text-center text-[14px] font-bold text-[#1a6170]">{helperText}</div>
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
      <div className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-[#5d6f8a]">
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
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  suffix: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#5d6f8a]">
          {label}
        </div>
        <div className="text-[13px] font-bold text-[#1a6170]">
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
