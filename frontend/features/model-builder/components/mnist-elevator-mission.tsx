'use client';

import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { Icon } from '@/features/model-builder/components/icons';
import { predictDigit, predictSample } from '@/lib/api/model-builder';
import { extractMnistPixels } from '@/lib/mnist-canvas';
import type { DatasetItem, TrainingChallengeSample, TrainingJobStatus } from '@/types/builder';

type MnistElevatorMissionProps = {
  variant?: 'elevator' | 'laundry';
  dataset?: DatasetItem | null;
  phase: 'intro' | 'mission' | 'complete';
  trainingStatus: TrainingJobStatus | null;
  challengeSamplesOverride?: TrainingChallengeSample[] | null;
  isMissionComplete: boolean;
  onMissionComplete: () => void;
  onMissionFail?: (summary: { correctCount: number; totalCount: number }) => void;
  onMinimize: () => void;
  onStartQuest?: () => void;
  onExitQuest?: () => void;
};

type DialogueScene = {
  name: string;
  role: string;
  text: string;
};

type LaundryEvaluationResult = {
  targetIndex: number;
  predictedIndex: number | null;
  confidence: number | null;
  isCorrect: boolean | null;
};

type LaundrySampleVariant = {
  targetIndex: number;
  dx: number;
  dy: number;
  scale: number;
  rotateDeg: number;
};

type LaundrySampleAsset = {
  targetIndex: number;
  label: string;
  imageSrc: string | null;
  pixels: number[] | null;
};

const EMPTY_SAMPLE_CLASSES: NonNullable<DatasetItem['sampleClasses']> = [];
const EMPTY_CLASS_LABELS: string[] = [];
const EMPTY_CHALLENGE_SAMPLES: TrainingChallengeSample[] = [];

const LAUNDRY_PASS_COUNT = 7;
const FIXED_LAUNDRY_VARIANTS: LaundrySampleVariant[] = [
  { targetIndex: 6, dx: -2, dy: 1, scale: 0.94, rotateDeg: -6 },
  { targetIndex: 0, dx: 1, dy: -1, scale: 0.96, rotateDeg: 5 },
  { targetIndex: 4, dx: -1, dy: 2, scale: 0.95, rotateDeg: -5 },
  { targetIndex: 2, dx: 2, dy: 0, scale: 0.93, rotateDeg: 6 },
  { targetIndex: 7, dx: -2, dy: 1, scale: 0.92, rotateDeg: -7 },
  { targetIndex: 5, dx: 2, dy: -1, scale: 0.92, rotateDeg: 7 },
  { targetIndex: 6, dx: 0, dy: 2, scale: 0.9, rotateDeg: 4 },
  { targetIndex: 4, dx: 1, dy: 1, scale: 0.91, rotateDeg: -4 },
  { targetIndex: 0, dx: -1, dy: 0, scale: 0.94, rotateDeg: -3 },
  { targetIndex: 2, dx: 1, dy: -2, scale: 0.9, rotateDeg: 3 },
];

const missionFloors = [9, 8, 7, 6, 5, 4, 3, 2, 1];
const introScenes: DialogueScene[] = [
  {
    name: 'Emergency System',
    role: 'Broadcast',
    text: '네오 세종 타워의 버튼 없는 엘리베이터가 전역 정지 상태에 들어갔습니다. 승객들은 원하는 층으로 이동하지 못하고 있습니다.',
  },
  {
    name: 'Mina',
    role: 'Maintenance AI',
    text: '큰일났어! 엘리베이터가 멈춰버렸잖아! 숫자를 읽는 손글씨 인식 AI가 고장 나서, 승객들이 층수를 입력해도 전부 무시되고 있어.',
  },
  {
    name: 'Mina',
    role: 'Mission Brief',
    text: '네가 해야 할 일은 하나야. MNIST 숫자를 다시 학습시켜서 손글씨 숫자를 정확히 판별하게 만들어. 그러면 버튼 없는 엘리베이터도 다시 움직일 수 있어.',
  },
];

const laundryIntroScenes: DialogueScene[] = [
  {
    name: 'Laundry Hub',
    role: 'Broadcast',
    text: 'VisAible 세탁소는 기계에 넣기만 하면 AI가 세탁물을 자동으로 분류해줍니다. 그런데 지금 그 AI가 고장 나서 세탁물이 전부 한 줄에 엉켜 쌓이고 있어요.',
  },
  {
    name: 'Mina',
    role: 'Maintenance AI',
    text: '상황이 꽤 심각해. 셔츠, 가방, 신발을 가려내던 분류기가 멈춰서 세탁소 라인이 완전히 혼잡해졌어. 지금 바로 AI 코어를 다시 살려야 해.',
  },
  {
    name: 'Mina',
    role: 'Mission Brief',
    text: '이번 에피소드에서는 CNN으로 세탁물 분류 AI를 다시 학습시킬 거야. 의류 특징을 제대로 읽어내면 각 세탁물이 맞는 바구니로 자동 분류되기 시작할 거야.',
  },
];

function randomFloor() {
  return missionFloors[Math.floor(Math.random() * missionFloors.length)] ?? 5;
}

function isMissionFloor(value: number): boolean {
  return missionFloors.includes(value);
}

function resolveMissionFloor(predictedLabel: number, classLabels: string[]): number | null {
  const classLabel = classLabels[predictedLabel]?.trim() ?? '';
  const parsedLabel = Number.parseInt(classLabel, 10);
  if (Number.isFinite(parsedLabel) && isMissionFloor(parsedLabel)) {
    return parsedLabel;
  }

  return isMissionFloor(predictedLabel) ? predictedLabel : null;
}

function randomIndex(length: number) {
  if (length <= 0) {
    return 0;
  }
  return Math.floor(Math.random() * length);
}

async function extractSamplePixels(imageSrc: string, dataset: DatasetItem): Promise<number[]> {
  const [channels, height, width] =
    dataset.inputShape?.split('x').map((value) => Number(value.trim())) ?? [1, 28, 28];

  const image = new Image();
  image.src = imageSrc;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Sample image failed to load'));
  });

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Preview canvas is not available');
  }

  context.drawImage(image, 0, 0, width, height);
  const { data } = context.getImageData(0, 0, width, height);

  if (channels === 1) {
    return Array.from({ length: width * height }, (_, index) => {
      const offset = index * 4;
      return (0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2]) / 255;
    });
  }

  const pixels: number[] = [];
  for (let channel = 0; channel < 3; channel += 1) {
    for (let index = 0; index < width * height; index += 1) {
      pixels.push(data[index * 4 + channel] / 255);
    }
  }
  return pixels;
}

function pixelsToImageSrc(pixels: number[], width = 28, height = 28): string | null {
  if (typeof document === 'undefined' || pixels.length !== width * height) {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }

  const imageData = context.createImageData(width, height);
  for (let index = 0; index < pixels.length; index += 1) {
    const value = Math.max(0, Math.min(255, Math.round(pixels[index] * 255)));
    const offset = index * 4;
    imageData.data[offset] = value;
    imageData.data[offset + 1] = value;
    imageData.data[offset + 2] = value;
    imageData.data[offset + 3] = 255;
  }
  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

async function buildLaundrySampleAsset(
  imageSrc: string,
  dataset: DatasetItem,
  variant: LaundrySampleVariant,
): Promise<{ imageSrc: string; pixels: number[] }> {
  const [channels, height, width] =
    dataset.inputShape?.split('x').map((value) => Number(value.trim())) ?? [1, 28, 28];

  const image = new Image();
  image.src = imageSrc;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Sample image failed to load'));
  });

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Preview canvas is not available');
  }

  context.fillStyle = '#000000';
  context.fillRect(0, 0, width, height);
  context.save();
  context.translate(width / 2 + variant.dx, height / 2 + variant.dy);
  context.rotate((variant.rotateDeg * Math.PI) / 180);
  context.scale(variant.scale, variant.scale);
  context.drawImage(image, -width / 2, -height / 2, width, height);
  context.restore();

  const rendered = context.getImageData(0, 0, width, height);
  const pixels =
    channels === 1
      ? Array.from({ length: width * height }, (_, index) => {
          const offset = index * 4;
          return (
            (0.299 * rendered.data[offset] +
              0.587 * rendered.data[offset + 1] +
              0.114 * rendered.data[offset + 2]) /
            255
          );
        })
      : Array.from({ length: width * height * channels }, (_, index) => rendered.data[index] / 255);

  return {
    imageSrc: canvas.toDataURL('image/png'),
    pixels,
  };
}

function DialogueBox({
  name,
  role,
  text,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: {
  name: string;
  role: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <div className="relative z-20 max-w-full px-2 pt-6">
      <div
        className="absolute left-8 top-0 z-20 inline-flex min-h-[38px] items-center rounded-full bg-[#f8fafc] px-5 py-1.5 text-[15px] font-black uppercase tracking-[0.04em] text-black shadow-[0_8px_16px_rgba(0,0,0,0.16)] ring-1 ring-[rgba(255,255,255,0.82)]"
      >
        {name}
      </div>
      <div
        className="relative overflow-hidden rounded-[30px] border-[4px] border-white/92 bg-[linear-gradient(180deg,rgba(5,10,20,0.99),rgba(10,18,32,0.96))] px-8 pb-6 pt-11 text-white shadow-[0_24px_50px_rgba(0,0,0,0.42)] backdrop-blur-md"
      >
        <div className="text-[12px] font-extrabold uppercase tracking-[0.22em] text-[#a9c4ff]">
          {role}
        </div>
        <p className="mt-3 text-[15px] font-semibold leading-[1.55] text-white">
          {text}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          {secondaryLabel && onSecondary ? (
            <button
              type="button"
              onClick={onSecondary}
              className="rounded-full border border-white/20 px-4 py-2 text-[12px] font-extrabold uppercase tracking-[0.14em] text-white/82 transition hover:bg-white/8 hover:text-white"
            >
              {secondaryLabel}
            </button>
          ) : null}
          {actionLabel && onAction ? (
            <button
              type="button"
              onClick={onAction}
              className="rounded-full bg-[linear-gradient(135deg,#f97316,#fb923c)] px-5 py-2.5 text-[12px] font-extrabold uppercase tracking-[0.14em] text-white shadow-[0_12px_28px_rgba(249,115,22,0.28)]"
            >
              {actionLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function MnistElevatorMission({
  variant = 'elevator',
  dataset = null,
  phase,
  trainingStatus,
  challengeSamplesOverride = null,
  isMissionComplete,
  onMissionComplete,
  onMissionFail,
  onMinimize,
  onStartQuest,
  onExitQuest,
}: MnistElevatorMissionProps) {
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const elevatorShaftRef = useRef<HTMLDivElement | null>(null);
  const floorLabelRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const missionInitKeyRef = useRef<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [predictError, setPredictError] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<{
    predictedLabel: number;
    confidence: number;
  } | null>(null);
  const [samplePrediction, setSamplePrediction] = useState<{
    predictedLabel: number;
    confidence: number;
  } | null>(null);
  const [samplePredictError, setSamplePredictError] = useState<string | null>(null);
  const [selectedSampleIndex, setSelectedSampleIndex] = useState(0);
  const [targetSampleIndex, setTargetSampleIndex] = useState(0);
  const [laundryTargets, setLaundryTargets] = useState<number[]>([]);
  const [laundryRoundIndex, setLaundryRoundIndex] = useState(0);
  const [laundryCorrectCount, setLaundryCorrectCount] = useState(0);
  const [laundryAttemptFinished, setLaundryAttemptFinished] = useState(false);
  const [laundryResults, setLaundryResults] = useState<LaundryEvaluationResult[]>([]);
  const [laundrySampleAssets, setLaundrySampleAssets] = useState<LaundrySampleAsset[]>([]);
  const [elevatorCarTop, setElevatorCarTop] = useState(16);
  const [targetFloor, setTargetFloor] = useState(5);
  const [currentFloor, setCurrentFloor] = useState(1);
  const [invalidPredictionFloor, setInvalidPredictionFloor] = useState<number | null>(null);
  const [sceneIndex, setSceneIndex] = useState(0);

  const isLaundryVariant = variant === 'laundry';
  const lastMetric = trainingStatus?.metrics?.at(-1) ?? null;
  const isMissionReady =
    trainingStatus?.status === 'completed' &&
    trainingStatus.datasetId === (isLaundryVariant ? 'fashion_mnist' : 'mnist') &&
    !!trainingStatus.jobId;
  const currentScene = (isLaundryVariant ? laundryIntroScenes : introScenes)[sceneIndex] ??
    (isLaundryVariant ? laundryIntroScenes[0] : introScenes[0]);
  const sampleClasses = useMemo(
    () => dataset?.sampleClasses ?? EMPTY_SAMPLE_CLASSES,
    [dataset?.sampleClasses],
  );
  const classLabels = useMemo(
    () => dataset?.classLabels ?? EMPTY_CLASS_LABELS,
    [dataset?.classLabels],
  );
  const activeChallengeSamples = useMemo(
    () => challengeSamplesOverride ?? trainingStatus?.challengeSamples ?? EMPTY_CHALLENGE_SAMPLES,
    [challengeSamplesOverride, trainingStatus?.challengeSamples],
  );
  const activeChallengeKey = useMemo(
    () =>
      activeChallengeSamples
        .slice(0, 10)
        .map((sample) => `${sample.targetIndex}:${sample.predictedIndex}:${sample.confidence.toFixed(4)}`)
        .join('|'),
    [activeChallengeSamples],
  );
  const challengeLaundryAssets = useMemo(() => {
    if (!isLaundryVariant || activeChallengeSamples.length === 0) {
      return [];
    }

    return activeChallengeSamples.map((sample, index) => ({
      targetIndex: sample.targetIndex,
      label:
        classLabels[sample.targetIndex] ??
        sampleClasses[sample.targetIndex]?.label ??
        `Item ${index + 1}`,
      imageSrc: pixelsToImageSrc(sample.pixels),
      pixels: sample.pixels,
    })) satisfies LaundrySampleAsset[];
  }, [activeChallengeSamples, classLabels, isLaundryVariant, sampleClasses]);
  const selectedSample = sampleClasses[selectedSampleIndex] ?? sampleClasses[0] ?? null;
  const currentLaundryTargetIndex = laundryTargets[laundryRoundIndex] ?? targetSampleIndex;
  const targetSample = sampleClasses[currentLaundryTargetIndex] ?? sampleClasses[0] ?? null;
  const currentLaundryAsset = (challengeLaundryAssets[laundryRoundIndex] ?? laundrySampleAssets[laundryRoundIndex]) ?? null;
  const currentLaundryInput = isLaundryVariant ? currentLaundryAsset : selectedSample;
  const portraitSrc = useMemo(() => {
    if (phase === 'complete' || isMissionComplete) {
      return '/images/mnist-quest-mina-happy.svg';
    }

    if (phase === 'intro') {
      if (sceneIndex < 2) {
        return '/images/mnist-quest-mina-worried.svg';
      }
      return '/images/mnist-quest-mina-focused.svg';
    }

    if (isLaundryVariant ? samplePredictError : predictError) {
      return '/images/mnist-quest-mina-worried.svg';
    }

    if (isMissionReady) {
      return '/images/mnist-quest-mina-focused.svg';
    }

    return '/images/mnist-quest-mina-worried.svg';
  }, [isLaundryVariant, isMissionComplete, isMissionReady, phase, predictError, samplePredictError, sceneIndex]);
  const expressionLabel = useMemo(() => {
    if (phase === 'complete' || isMissionComplete) {
      return 'Relieved';
    }

    if (phase === 'intro' && sceneIndex < 2) {
      return 'Alarmed';
    }

    if (isLaundryVariant ? samplePredictError : predictError) {
      return 'Concerned';
    }

    return 'Focused';
  }, [isLaundryVariant, isMissionComplete, phase, predictError, samplePredictError, sceneIndex]);
  const isCompactResultLayout = true;

  useEffect(() => {
    setSceneIndex(0);
  }, [phase]);

  useEffect(() => {
    if (!isMissionReady) {
      missionInitKeyRef.current = null;
      return;
    }

    const missionInitKey = [
      variant,
      phase,
      trainingStatus?.jobId ?? 'no-job',
      activeChallengeKey,
      sampleClasses.length,
    ].join('::');
    if (missionInitKeyRef.current === missionInitKey) {
      return;
    }
    missionInitKeyRef.current = missionInitKey;

    if (isLaundryVariant) {
      let cancelled = false;

      void (async () => {
        if (activeChallengeSamples.length >= 10) {
          const nextTargets = activeChallengeSamples.slice(0, 10).map((sample) => sample.targetIndex);
          const nextAssets = challengeLaundryAssets.slice(0, 10);
          if (cancelled) {
            return;
          }
          setLaundryTargets(nextTargets);
          setLaundrySampleAssets(nextAssets);
          setLaundryRoundIndex(0);
          setLaundryCorrectCount(0);
          setLaundryAttemptFinished(false);
          setLaundryResults(
            nextTargets.map((targetIndex) => ({
              targetIndex,
              predictedIndex: null,
              confidence: null,
              isCorrect: null,
            })),
          );
          setTargetSampleIndex(nextTargets[0] ?? 0);
          setSelectedSampleIndex(0);
          setSamplePrediction(null);
          setSamplePredictError(null);
          return;
        }

        const nextTargets =
          sampleClasses.length >= 10
            ? FIXED_LAUNDRY_VARIANTS.map((variant) => variant.targetIndex)
            : Array.from({ length: 10 }, () => randomIndex(sampleClasses.length));

        const nextAssets =
          dataset && sampleClasses.length >= 10
            ? await Promise.all(
                FIXED_LAUNDRY_VARIANTS.map(async (variant) => {
                  const sample = sampleClasses[variant.targetIndex];
                  if (!sample?.imageSrc) {
                    return {
                      targetIndex: variant.targetIndex,
                      label: sample?.label ?? `Item ${variant.targetIndex}`,
                      imageSrc: sample?.imageSrc ?? null,
                      pixels: null,
                    } satisfies LaundrySampleAsset;
                  }

                  const transformed = await buildLaundrySampleAsset(sample.imageSrc, dataset, variant);
                  return {
                    targetIndex: variant.targetIndex,
                    label: sample.label,
                    imageSrc: transformed.imageSrc,
                    pixels: transformed.pixels,
                  } satisfies LaundrySampleAsset;
                }),
              )
            : nextTargets.map((targetIndex) => {
                const sample = sampleClasses[targetIndex] ?? null;
                return {
                  targetIndex,
                  label: sample?.label ?? `Item ${targetIndex}`,
                  imageSrc: sample?.imageSrc ?? null,
                  pixels: null,
                } satisfies LaundrySampleAsset;
              });

        if (cancelled) {
          return;
        }

        setLaundryTargets(nextTargets);
        setLaundrySampleAssets(nextAssets);
        setLaundryRoundIndex(0);
        setLaundryCorrectCount(0);
        setLaundryAttemptFinished(false);
        setLaundryResults(
          nextTargets.map((targetIndex) => ({
            targetIndex,
            predictedIndex: null,
            confidence: null,
            isCorrect: null,
          })),
        );
        setTargetSampleIndex(nextTargets[0] ?? 0);
        setSelectedSampleIndex(0);
        setSamplePrediction(null);
        setSamplePredictError(null);
      })();

      return () => {
        cancelled = true;
      };
    } else {
      setTargetFloor(randomFloor());
    }
    setCurrentFloor(1);
    setInvalidPredictionFloor(null);
    setPrediction(null);
    setPredictError(null);
  }, [
    phase,
    challengeLaundryAssets,
    dataset,
    activeChallengeSamples,
    activeChallengeKey,
    isLaundryVariant,
    isMissionReady,
    sampleClasses,
    sampleClasses.length,
    trainingStatus?.jobId,
  ]);

  useEffect(() => {
    if (isLaundryVariant) {
      return;
    }

    if (!isMissionReady) {
      return;
    }

    const canvas = drawingCanvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.fillStyle = '#000000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.lineWidth = 18;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#ffffff';
  }, [isLaundryVariant, isMissionReady]);

  const missionDialogue = useMemo(() => {
    if (isLaundryVariant) {
      if (phase === 'complete' || isMissionComplete) {
        return '좋아! 세탁소 분류 코어가 복구돼서 의류가 다시 종류별로 자동 분류되기 시작했어.';
      }

      if (!isMissionReady) {
        return '아직 분류 코어가 비어 있어. 왼쪽에서 CNN 블록을 쌓고 Start 버튼으로 학습을 시작하면 세탁소 콘솔이 활성화될 거야.';
      }

      if (laundryAttemptFinished) {
        return laundryCorrectCount >= LAUNDRY_PASS_COUNT
          ? `좋아! 총 10개 중 ${laundryCorrectCount}개를 맞혔어. 이제 세탁소 분류 라인을 다시 가동할 수 있어.`
          : `총 10개 중 ${laundryCorrectCount}개만 맞혔어. 적어도 ${LAUNDRY_PASS_COUNT}개는 맞혀야 세탁소 라인을 다시 맡길 수 있어.`;
      }

      return `이번 평가는 총 10개의 세탁물을 순서대로 검사합니다. 현재 ${laundryRoundIndex + 1}번째 세탁물이 입력으로 들어왔어. 빨래 분류하기 버튼으로 분류 결과를 확인해보자.`;
    }

    if (phase === 'complete' || isMissionComplete) {
      return '해냈어! 숫자 인식 코어가 복구됐고, 버튼 없는 엘리베이터가 다시 정확한 층으로 움직이기 시작했어.';
    }

    if (!isMissionReady) {
      return '아직 인식 코어가 비어 있어. 왼쪽에서 Linear 블록을 캔버스에 올리고, Start 버튼으로 학습을 시작하면 미션 콘솔이 활성화될 거야.';
    }

    return `좋아, 지금 승객이 ${targetFloor}층을 요청했어. 캔버스에 ${targetFloor}를 손글씨로 적고 Predict Floor를 눌러. 이번엔 절대 틀리면 안 돼!`;
  }, [isLaundryVariant, isMissionComplete, isMissionReady, laundryAttemptFinished, laundryCorrectCount, laundryRoundIndex, phase, targetFloor, targetSample?.label]);
  const clampedCurrentFloor = Math.max(1, Math.min(currentFloor, 9));
  const displayedCurrentFloor = invalidPredictionFloor === null ? clampedCurrentFloor : null;
  const elevatorCarHeight = 40;
  const elevatorVisualOffset = 4;
  const activeError = isLaundryVariant ? samplePredictError : predictError;
  const activePrediction = isLaundryVariant ? samplePrediction : prediction;
  const resolvedActiveMissionFloor =
    !isLaundryVariant && activePrediction
      ? resolveMissionFloor(activePrediction.predictedLabel, classLabels)
      : null;
  const laundryBackgroundImage =
    phase === 'complete' || isMissionComplete
      ? '/images/tutorial/laundry-normal.png'
      : '/images/tutorial/laundry-error.png';
  const scenarioEpisodeLabel = isLaundryVariant ? 'Episode 02' : 'Episode 01';
  const consoleEyebrow = isLaundryVariant ? 'Laundry Sorting Console' : 'Elevator Control Console';
  const introBadgeLabel = isLaundryVariant ? 'Laundry Alert' : scenarioEpisodeLabel;
  const leftQuestLabel = isLaundryVariant
    ? phase === 'complete'
      ? 'Sorting Restored'
      : 'Laundry Mission'
    : phase === 'complete'
      ? 'Quest Cleared'
      : 'Active Quest';
  const leftExpressionLabel = isLaundryVariant ? 'Sorter Mood' : 'Expression';
  const consoleTitle =
    phase === 'complete'
      ? isLaundryVariant
        ? '세탁 분류 복구 보고'
        : '임무 완료 보고'
      : isLaundryVariant
        ? '세탁물 분류 미션'
        : '층수 인식 미션';
  const topBadgeLabel =
    phase === 'complete'
      ? 'Quest Cleared'
      : isMissionReady
        ? isLaundryVariant
          ? '10-item check'
          : `Target ${targetFloor}F`
        : 'Training Required';
  const topMetricLabel = isLaundryVariant ? 'Target Item' : 'Target Floor';
  const topMetricValue = isLaundryVariant ? '10 items' : `${targetFloor}F`;
  const topMetricChip = isLaundryVariant ? `${Math.min(laundryRoundIndex + 1, 10)} / 10` : 'Passenger Call';
  const coreStatusSuffix = isLaundryVariant
    ? (activePrediction
        ? classLabels[activePrediction.predictedLabel] ?? `Class ${activePrediction.predictedLabel}`
        : 'Sorter Idle')
    : invalidPredictionFloor !== null
      ? `Read ${invalidPredictionFloor}F · Hold`
      : `Current ${clampedCurrentFloor}F`;
  const latestLaundryMismatch = useMemo(() => {
    if (!isLaundryVariant) {
      return null;
    }

    for (let index = laundryResults.length - 1; index >= 0; index -= 1) {
      const result = laundryResults[index];
      if (result && result.isCorrect === false && result.predictedIndex !== null) {
        const targetLabel = classLabels[result.targetIndex] ?? sampleClasses[result.targetIndex]?.label ?? 'Unknown';
        const predictedLabel =
          classLabels[result.predictedIndex] ?? sampleClasses[result.predictedIndex]?.label ?? 'Unknown';
        return `${targetLabel}을(를) ${predictedLabel}(으)로 헷갈려요!`;
      }
    }
    return null;
  }, [classLabels, isLaundryVariant, laundryResults, sampleClasses]);

  useEffect(() => {
    const syncElevatorCarPosition = () => {
      const shaftNode = elevatorShaftRef.current;
      if (!shaftNode || displayedCurrentFloor === null) {
        return;
      }

      const floorNode = floorLabelRefs.current[displayedCurrentFloor];
      if (!floorNode) {
        return;
      }

      const shaftRect = shaftNode.getBoundingClientRect();
      const floorRect = floorNode.getBoundingClientRect();
      const nextTop =
        floorRect.top -
        shaftRect.top +
        floorRect.height / 2 -
        elevatorCarHeight / 2 +
        elevatorVisualOffset;
      const maxTop = shaftRect.height - elevatorCarHeight;
      setElevatorCarTop(Math.min(Math.max(nextTop, 0), maxTop));
    };

    const frameId = window.requestAnimationFrame(syncElevatorCarPosition);
    const handleResize = () => syncElevatorCarPosition();
    window.addEventListener('resize', handleResize);

    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncElevatorCarPosition) : null;
    if (observer) {
      if (elevatorShaftRef.current) {
        observer.observe(elevatorShaftRef.current);
      }
      missionFloors.forEach((floor) => {
        const node = floorLabelRefs.current[floor];
        if (node) {
          observer.observe(node);
        }
      });
    }

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      observer?.disconnect();
    };
  }, [displayedCurrentFloor, isCompactResultLayout]);

  const startDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    setIsDrawing(true);
    setPredictError(null);
    setPrediction(null);
    context.beginPath();
    context.moveTo(x, y);
  };

  const drawDigit = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) {
      return;
    }

    const canvas = drawingCanvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    context.lineTo(x, y);
    context.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) {
      return;
    }

    setIsDrawing(false);
  };

  const clearDrawing = () => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.fillStyle = '#000000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    setPrediction(null);
    setPredictError(null);
  };

  const runPrediction = async () => {
    if (!trainingStatus?.jobId || !isMissionReady) {
      return;
    }

    if (isLaundryVariant) {
      if (!dataset || !currentLaundryInput?.imageSrc) {
        return;
      }

      setIsPredicting(true);
      setSamplePredictError(null);
      try {
        const pixels =
          'pixels' in currentLaundryInput && currentLaundryInput.pixels
            ? currentLaundryInput.pixels
            : await extractSamplePixels(currentLaundryInput.imageSrc, dataset);
        const result = await predictSample(trainingStatus.jobId, pixels);
        setSamplePrediction({
          predictedLabel: result.predictedLabel,
          confidence: result.confidence,
        });
        setLaundryResults((current) =>
          current.map((item, index) =>
            index === laundryRoundIndex
              ? {
                  ...item,
                  predictedIndex: result.predictedLabel,
                  confidence: result.confidence,
                  isCorrect: result.predictedLabel === currentLaundryTargetIndex,
                }
              : item,
          ),
        );

        if (result.predictedLabel === currentLaundryTargetIndex) {
          const nextCorrectCount = laundryCorrectCount + 1;
          const nextRoundIndex = laundryRoundIndex + 1;
          setLaundryCorrectCount(nextCorrectCount);

          if (nextRoundIndex >= 10) {
            setLaundryAttemptFinished(true);
            if (nextCorrectCount >= LAUNDRY_PASS_COUNT) {
              onMissionComplete();
            }
          } else {
            setLaundryRoundIndex(nextRoundIndex);
            setTargetSampleIndex(laundryTargets[nextRoundIndex] ?? randomIndex(sampleClasses.length));
            setSelectedSampleIndex(0);
          }
        } else {
          const predictedLabel = classLabels[result.predictedLabel] ?? `Class ${result.predictedLabel}`;
          const targetLabel = targetSample?.label ?? 'Target item';
          setSamplePredictError(
            `${targetLabel}을(를) ${predictedLabel}(으)로 헷갈렸어요. 아직 비슷한 종류를 안정적으로 구분하지 못하고 있습니다.`,
          );
          const nextRoundIndex = laundryRoundIndex + 1;
          if (nextRoundIndex >= 10) {
            setLaundryAttemptFinished(true);
          } else {
            setLaundryRoundIndex(nextRoundIndex);
            setTargetSampleIndex(laundryTargets[nextRoundIndex] ?? randomIndex(sampleClasses.length));
            setSelectedSampleIndex(0);
          }
        }
      } catch (error) {
        setSamplePredictError(error instanceof Error ? error.message : '예측 중 문제가 발생했습니다.');
      } finally {
        setIsPredicting(false);
      }
      return;
    }

    const canvas = drawingCanvasRef.current;
    if (!canvas) {
      return;
    }

    const pixels = extractMnistPixels(canvas);
    if (pixels.length !== 28 * 28) {
      setPrediction(null);
      setPredictError('숫자 하나를 또렷하게 써야 인식 코어가 읽을 수 있어.');
      return;
    }

    setIsPredicting(true);
    setPredictError(null);
    setInvalidPredictionFloor(null);
    try {
      const result = await predictDigit(trainingStatus.jobId, pixels);
      const resolvedFloor = resolveMissionFloor(result.predictedLabel, classLabels);
      setPrediction({
        predictedLabel: result.predictedLabel,
        confidence: result.confidence,
      });
      setInvalidPredictionFloor(resolvedFloor === null ? result.predictedLabel : null);
      if (resolvedFloor !== null) {
        setCurrentFloor(resolvedFloor);
      }

      if (resolvedFloor === targetFloor) {
        onMissionComplete();
      } else if (resolvedFloor === null) {
        setPredictError(
          `엘리베이터가 ${result.predictedLabel}로 읽었지만 이 건물은 1층부터 9층까지만 이동할 수 있어. 숫자를 더 또렷하게 써서 다시 예측해보자.`,
        );
      } else {
        setPredictError(
          `엘리베이터가 ${resolvedFloor}층으로 오인식했어. 목표는 ${targetFloor}층이야. 조금 더 또렷하고 크게 써보자.`,
        );
      }
    } catch (error) {
      setPredictError(error instanceof Error ? error.message : '예측 중 문제가 발생했습니다.');
    } finally {
      setIsPredicting(false);
    }
  };

  if (phase === 'intro') {
    return (
      <div className="pointer-events-none fixed inset-0 z-[88] overflow-y-auto bg-[rgba(2,6,15,0.8)] backdrop-blur-[4px]">
        <div
          className={[
            'absolute inset-0',
            isLaundryVariant
              ? 'bg-[radial-gradient(circle_at_16%_18%,rgba(34,197,94,0.14),transparent_20%),radial-gradient(circle_at_82%_16%,rgba(56,189,248,0.16),transparent_22%),linear-gradient(180deg,rgba(8,18,28,0.96),rgba(8,12,20,0.98))]'
              : 'bg-[radial-gradient(circle_at_18%_18%,rgba(249,115,22,0.22),transparent_22%),radial-gradient(circle_at_78%_18%,rgba(59,130,246,0.18),transparent_22%),linear-gradient(180deg,rgba(10,16,28,0.96),rgba(8,13,24,0.98))]',
          ].join(' ')}
        />
        <div className="relative flex min-h-screen items-start justify-center px-6 py-8 md:px-8 md:py-10">
          <div className="pointer-events-auto w-full max-w-[min(1260px,calc(100vw-88px))]">
            <div className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,#111827,#0b1220)] shadow-[0_40px_110px_rgba(0,0,0,0.44)]">
              <div className="relative h-[min(74vh,760px)] min-h-[620px] overflow-hidden">
                <div
                  className={[
                    'absolute inset-0',
                    isLaundryVariant
                      ? 'bg-[radial-gradient(circle_at_28%_22%,rgba(125,211,252,0.12),transparent_24%),linear-gradient(180deg,#162234_0%,#0c1422_100%)]'
                      : 'bg-[radial-gradient(circle_at_50%_28%,rgba(251,191,36,0.18),transparent_28%),linear-gradient(180deg,#1f2937_0%,#111827_100%)]',
                  ].join(' ')}
                />
                <div
                  className={[
                    'absolute top-0 h-full',
                    isLaundryVariant
                      ? 'inset-x-[7%] bg-[linear-gradient(180deg,#1d2c3d,#131d2b)]'
                      : 'inset-x-[18%] bg-[linear-gradient(180deg,#2a3348,#151b2c)]',
                  ].join(' ')}
                >
                  {isLaundryVariant ? (
                    <>
                      <img
                        src={laundryBackgroundImage}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 h-full w-full object-cover opacity-[0.88]"
                      />
                      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,17,28,0.28),rgba(7,17,28,0.52))]" />
                    </>
                  ) : (
                    <>
                      <div className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-[#475569]" />
                      <div className="absolute inset-y-0 left-[8%] w-[2px] bg-[#334155]" />
                      <div className="absolute inset-y-0 right-[8%] w-[2px] bg-[#334155]" />
                    </>
                  )}
                </div>
                <div className="absolute inset-x-0 top-0 h-[20%] bg-[linear-gradient(180deg,rgba(0,0,0,0.26),transparent)]" />
                <div className="absolute inset-x-0 bottom-0 h-[28%] bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.54))]" />

                <img
                  src={portraitSrc}
                  alt="Mina portrait"
                  className="absolute bottom-0 left-[4%] h-[72%] max-h-[620px] w-auto drop-shadow-[0_28px_40px_rgba(0,0,0,0.45)]"
                />

                <div className="absolute left-[6%] top-[8%] z-20 inline-flex items-center gap-3 rounded-full border border-white/14 bg-[rgba(8,13,24,0.84)] px-4 py-2.5 shadow-[0_18px_36px_rgba(0,0,0,0.22)] backdrop-blur-md">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white">
                    {introBadgeLabel}
                  </span>
                  <span className="rounded-full border border-[#fef3c7]/60 bg-[#fff7dd] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#7c5b00]">
                    {expressionLabel}
                  </span>
                </div>

                <div className="absolute bottom-8 left-[34%] right-8 max-w-[760px]">
                  <DialogueBox
                    name={currentScene.name}
                    role={currentScene.role}
                    text={currentScene.text}
                    secondaryLabel={sceneIndex > 0 ? 'Prev' : undefined}
                    onSecondary={
                      sceneIndex > 0
                        ? () => setSceneIndex((current) => Math.max(0, current - 1))
                        : undefined
                    }
                    actionLabel={sceneIndex === (isLaundryVariant ? laundryIntroScenes.length : introScenes.length) - 1 ? 'Accept Quest' : 'Next'}
                    onAction={() => {
                      if (sceneIndex === (isLaundryVariant ? laundryIntroScenes.length : introScenes.length) - 1) {
                        onStartQuest?.();
                        return;
                      }
                      setSceneIndex((current) =>
                        Math.min(
                          current + 1,
                          (isLaundryVariant ? laundryIntroScenes.length : introScenes.length) - 1,
                        ),
                      );
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const activeLaundryBoardColor = (result: LaundryEvaluationResult, index: number) => {
    if (result.isCorrect === false) {
      return 'border-[#fda4af] bg-[#fff1f2]';
    }
    if (result.isCorrect === true) {
      return 'border-[#93c5fd] bg-[#eff6ff]';
    }
    if (index === laundryRoundIndex && !laundryAttemptFinished) {
      return 'border-[#bfdbfe] bg-[#f8fbff] ring-2 ring-[#2563eb]/25';
    }
    return 'border-[#dbe5f1] bg-white';
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-[88] overflow-y-auto bg-[rgba(2,6,15,0.74)] backdrop-blur-[4px]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(59,130,246,0.24),transparent_24%),radial-gradient(circle_at_82%_14%,rgba(249,115,22,0.16),transparent_22%),linear-gradient(180deg,rgba(10,16,28,0.96),rgba(8,13,24,0.98))]" />
      <div
        className={[
          'relative flex min-h-screen justify-center px-4 py-3 md:px-5 md:py-4',
          isCompactResultLayout ? 'items-center' : 'items-start',
        ].join(' ')}
      >
        <div className="pointer-events-auto w-full max-w-[min(1280px,calc(100vw-88px))]">
          <div
            className={[
              'mx-auto grid w-fit max-w-full xl:grid-cols-[300px_minmax(760px,1fr)]',
              isCompactResultLayout ? 'gap-3' : 'gap-5',
            ].join(' ')}
          >
            <section className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,#111827,#0b1220)] shadow-[0_32px_90px_rgba(0,0,0,0.4)]">
              <div
                className={[
                  'absolute inset-0',
                  isLaundryVariant
                    ? 'bg-[radial-gradient(circle_at_22%_18%,rgba(34,197,94,0.12),transparent_24%),radial-gradient(circle_at_78%_16%,rgba(125,211,252,0.14),transparent_20%),linear-gradient(180deg,rgba(17,24,39,0.12),rgba(2,6,23,0.06))]'
                    : 'bg-[radial-gradient(circle_at_18%_20%,rgba(59,130,246,0.12),transparent_22%),radial-gradient(circle_at_84%_18%,rgba(249,115,22,0.12),transparent_18%)]',
                ].join(' ')}
              />
              {isLaundryVariant ? (
                <>
                  <img
                    src={laundryBackgroundImage}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full object-cover opacity-[0.26]"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,13,24,0.12),rgba(8,13,24,0.3))]" />
                </>
              ) : null}
              <div
                className={[
                  'relative px-5',
                  isCompactResultLayout ? 'min-h-[448px] py-3' : 'min-h-[500px] py-4',
                ].join(' ')}
              >
                {isLaundryVariant ? (
                  <div className="absolute inset-x-[10%] top-0 h-full bg-[linear-gradient(180deg,#223243,#141d2c)]">
                    <img
                      src={laundryBackgroundImage}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 h-full w-full object-cover opacity-[0.9]"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,17,29,0.18),rgba(10,17,29,0.42))]" />
                  </div>
                ) : (
                  <div className="absolute inset-x-[14%] top-0 h-full bg-[linear-gradient(180deg,#263247,#161e2f)]">
                    <div className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-[#475569]" />
                    <div className="absolute inset-y-0 left-[12%] w-[2px] bg-[#334155]" />
                    <div className="absolute inset-y-0 right-[12%] w-[2px] bg-[#334155]" />
                  </div>
                )}

                <div
                  className={[
                    'relative z-20 flex items-start justify-between gap-4',
                    isCompactResultLayout ? 'pt-4' : 'pt-2',
                  ].join(' ')}
                >
                  <div className="grid gap-3">
                    <div className="inline-flex items-center gap-2.5 rounded-full border border-white/14 bg-[rgba(8,13,24,0.88)] px-3.5 py-2 shadow-[0_18px_36px_rgba(0,0,0,0.24)] backdrop-blur-md">
                      <span
                        className={[
                          'h-2.5 w-2.5 rounded-full',
                          phase === 'complete' ? 'bg-emerald-400' : 'bg-[#60a5fa]',
                        ].join(' ')}
                      />
                      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white">
                        {leftQuestLabel}
                      </span>
                    </div>

                    <div className="inline-flex items-center gap-3 rounded-[18px] border border-white/14 bg-[rgba(8,13,24,0.88)] px-3.5 py-2.5 shadow-[0_18px_36px_rgba(0,0,0,0.24)] backdrop-blur-md">
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#93c5fd]">
                        {leftExpressionLabel}
                      </span>
                      <span className="rounded-full border border-[#dbeafe]/70 bg-white px-3 py-1 text-[12px] font-black uppercase tracking-[0.12em] text-[#10213b]">
                        {expressionLabel}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onMinimize}
                    className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/8 text-white/80 transition hover:bg-white/14 hover:text-white"
                    aria-label="퀘스트 최소화"
                  >
                    <span className="text-[18px] font-bold leading-none">×</span>
                  </button>
                </div>

                <div
                  className={[
                    'relative z-10 flex',
                    isCompactResultLayout ? 'mt-10 min-h-[205px] items-end justify-center' : 'mt-6 min-h-[180px] items-end',
                  ].join(' ')}
                >
                  {isCompactResultLayout ? (
                    <div className="pointer-events-none absolute bottom-[-14px] left-1/2 h-[190px] w-[190px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(96,165,250,0.18),rgba(96,165,250,0.06)_45%,transparent_72%)] blur-[6px]" />
                  ) : null}
                  <img
                    src={portraitSrc}
                    alt="Mina portrait"
                    className={[
                      'w-auto max-w-none drop-shadow-[0_28px_40px_rgba(0,0,0,0.45)] animate-mascot-float',
                      isCompactResultLayout ? 'mb-[-10px] h-[236px]' : 'ml-3 mb-[-4px] h-[248px]',
                    ].join(' ')}
                  />
                </div>

                <div className={['relative z-20', isCompactResultLayout ? 'mt-4' : 'mt-5'].join(' ')}>
                  <DialogueBox
                    name={phase === 'complete' ? 'Mina' : 'Mina'}
                    role={phase === 'complete' ? 'Mission Complete' : 'Operator Dialogue'}
                    text={missionDialogue}
                    actionLabel={phase === 'complete' ? 'Exit Quest' : undefined}
                    onAction={phase === 'complete' ? onExitQuest : undefined}
                  />
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-[34px] border border-[#d9e2ef] bg-[linear-gradient(180deg,#ffffff,#f6f9fd)] shadow-[0_32px_90px_rgba(0,0,0,0.22)]">
              <div className={['border-b border-[#e2e8f0] px-6', isCompactResultLayout ? 'py-4' : 'py-5'].join(' ')}>
                <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#7c8ca5]">
                      {consoleEyebrow}
                      </div>
                    <h3
                      className={[
                        'mt-2 font-display font-bold tracking-[-0.04em] text-[#10213b]',
                        isCompactResultLayout ? 'text-[20px]' : 'text-[26px]',
                      ].join(' ')}
                    >
                      {consoleTitle}
                    </h3>
                  </div>
                  <div className={['rounded-full bg-[#eef3ff] font-bold text-primary', isCompactResultLayout ? 'px-3 py-1.5 text-[11px]' : 'px-4 py-2 text-[12px]'].join(' ')}>
                    {topBadgeLabel}
                  </div>
                </div>
              </div>

              <div className={['px-5', isCompactResultLayout ? 'py-3' : 'py-5'].join(' ')}>
                <div className={['grid lg:grid-cols-3', isCompactResultLayout ? 'gap-2' : 'gap-4'].join(' ')}>
                  <div className={['rounded-[22px] border border-[#dbe5f1] bg-white px-4 shadow-[0_14px_30px_rgba(15,23,42,0.05)]', isCompactResultLayout ? 'py-2' : 'py-4'].join(' ')}>
                    <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#7c8ca5]">
                      {isLaundryVariant ? 'Evaluation Set' : topMetricLabel}
                    </div>
                    <div className={['flex items-end justify-between gap-3', isCompactResultLayout ? 'mt-2' : 'mt-3'].join(' ')}>
                      <div className={['font-display font-bold tracking-[-0.04em] text-[#10213b]', isCompactResultLayout ? 'text-[28px]' : 'text-[34px]'].join(' ')}>
                        {topMetricValue}
                      </div>
                      <div className="rounded-full bg-[#eef3ff] px-3 py-1.5 text-[11px] font-bold text-primary">
                        {topMetricChip}
                      </div>
                    </div>
                  </div>

                  <div className={['rounded-[22px] border border-[#dbe5f1] bg-white px-4 shadow-[0_14px_30px_rgba(15,23,42,0.05)]', isCompactResultLayout ? 'py-2' : 'py-4'].join(' ')}>
                    <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#7c8ca5]">
                      Core Status
                    </div>
                      <div className={['flex items-end justify-between gap-3', isCompactResultLayout ? 'mt-2' : 'mt-3'].join(' ')}>
                      <div className={['font-display font-bold tracking-[-0.04em] text-[#10213b]', isCompactResultLayout ? 'text-[22px]' : 'text-[26px]'].join(' ')}>
                        {isMissionReady ? 'Online' : 'Offline'}
                      </div>
                      <div className="text-[13px] font-semibold text-[#5f7088]">
                        {coreStatusSuffix}
                      </div>
                    </div>
                  </div>

                  <div className={['rounded-[22px] border border-[#dbe5f1] bg-white px-4 shadow-[0_14px_30px_rgba(15,23,42,0.05)]', isCompactResultLayout ? 'py-2' : 'py-4'].join(' ')}>
                    <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#7c8ca5]">
                      Validation Accuracy
                    </div>
                    <div className={['flex items-end justify-between gap-3', isCompactResultLayout ? 'mt-2' : 'mt-3'].join(' ')}>
                      <div className={['font-display font-bold tracking-[-0.04em] text-[#10213b]', isCompactResultLayout ? 'text-[28px]' : 'text-[34px]'].join(' ')}>
                        {lastMetric ? `${(lastMetric.validationAccuracy * 100).toFixed(1)}%` : '--'}
                      </div>
                      {activePrediction ? (
                        <div className="rounded-full bg-[#eef3ff] px-3 py-1.5 text-[11px] font-bold text-primary">
                          {isLaundryVariant
                            ? `Sorted ${classLabels[activePrediction.predictedLabel] ?? `Class ${activePrediction.predictedLabel}`}`
                            : `Read ${(resolvedActiveMissionFloor ?? activePrediction.predictedLabel)}F`}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className={['grid xl:grid-cols-[250px_minmax(0,1fr)]', isCompactResultLayout ? 'mt-2 gap-2.5' : 'mt-5 gap-5'].join(' ')}>
                  <div className="grid gap-4">
                    <div className={['rounded-[26px] border border-[#dbe5f1] bg-[linear-gradient(180deg,#f8fbff,#ffffff)] shadow-[0_14px_30px_rgba(15,23,42,0.05)]', isCompactResultLayout ? 'p-3' : 'p-5'].join(' ')}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#7c8ca5]">
                            {isLaundryVariant ? 'Sorter Status' : 'Elevator Status'}
                          </div>
                          <div className={['font-semibold text-[#5f7088]', isCompactResultLayout ? 'mt-1 text-[13px]' : 'mt-2 text-[15px]'].join(' ')}>
                            {isLaundryVariant
                              ? '분류 결과에 따라 세탁물이 해당 바구니 라인으로 이동합니다.'
                              : '인식 결과에 따라 실제 엘리베이터가 층을 이동합니다.'}
                          </div>
                        </div>
                        <div className="rounded-full bg-[#dbeafe] px-3.5 py-1.5 text-[12px] font-black tracking-[0.08em] text-[#1d4ed8] shadow-[0_8px_18px_rgba(37,99,235,0.12)]">
                          {isLaundryVariant
                            ? activePrediction
                              ? classLabels[activePrediction.predictedLabel] ?? 'Sorted'
                              : targetSample?.label ?? 'Standby'
                            : invalidPredictionFloor !== null
                              ? `Read ${invalidPredictionFloor}F · Hold`
                              : `Current ${clampedCurrentFloor}F`}
                        </div>
                      </div>

                      <div className={['flex justify-center', isCompactResultLayout ? 'mt-3' : 'mt-5'].join(' ')}>
                        {isLaundryVariant ? (
                          <div className="grid w-full gap-3">
                            <div className="rounded-[24px] border border-[#d9e2ef] bg-[linear-gradient(180deg,#eef4ff,#ffffff)] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.9)]">
                              <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#7c8ca5]">
                                Evaluation Board
                              </div>
                              <div className="mt-3 grid grid-cols-5 gap-2.5">
                                {laundryResults.map((result, index) => {
                                  const sample = laundrySampleAssets[index] ?? sampleClasses[result.targetIndex] ?? null;
                                  return (
                                    <div
                                      key={`laundry-board-${index}-${result.targetIndex}`}
                                      className={[
                                        'rounded-[14px] border p-2 shadow-[0_8px_18px_rgba(15,23,42,0.05)] transition-all',
                                        activeLaundryBoardColor(result, index),
                                      ].join(' ')}
                                    >
                                      <div className="flex aspect-square items-center justify-center rounded-[10px] bg-white">
                                        {sample?.imageSrc ? (
                                          <img
                                            src={sample.imageSrc}
                                            alt={sample.label}
                                            className="h-full w-full rounded-[10px] object-contain p-1"
                                          />
                                        ) : (
                                          <div className="h-10 w-10 rounded-[10px] bg-slate-100" />
                                        )}
                                      </div>
                                      <div className="mt-1.5 text-center text-[9px] font-bold leading-tight text-[#475569]">
                                        {sample?.label ?? `Item ${index + 1}`}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="rounded-[24px] border border-[#d9e2ef] bg-white px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                              <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#7c8ca5]">
                                Confusion Note
                              </div>
                              <div className="mt-2 text-[15px] font-bold text-[#10213b]">
                                {latestLaundryMismatch ?? '아직 큰 혼동 없이 평가가 진행 중입니다.'}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className={['grid items-start', isCompactResultLayout ? 'grid-cols-[82px_96px] gap-3' : 'grid-cols-[96px_116px] gap-4'].join(' ')}>
                            <div className={['grid gap-1.5', isCompactResultLayout ? 'py-2' : 'py-4'].join(' ')}>
                              {missionFloors.map((floor) => (
                                <div
                                  key={floor}
                                  ref={(node) => {
                                    floorLabelRefs.current[floor] = node;
                                  }}
                                  className={[
                                    isCompactResultLayout
                                      ? 'flex h-7 items-center justify-between rounded-[12px] px-2.5 text-[11px] font-black transition-all'
                                      : 'flex h-8 items-center justify-between rounded-[14px] px-3 text-[12px] font-black transition-all',
                                    targetFloor === floor && !isMissionComplete
                                      ? 'animate-floor-pulse bg-[#dbeafe] text-[#1d4ed8] shadow-[0_10px_22px_rgba(59,130,246,0.14)]'
                                      : displayedCurrentFloor === floor
                                        ? 'bg-[#eff6ff] text-[#1e3a8a]'
                                        : 'bg-white/84 text-[#64748b]',
                                  ].join(' ')}
                                >
                                  <span>{floor}F</span>
                                  {targetFloor === floor ? (
                                    <span className="text-[10px] uppercase tracking-[0.14em]">
                                      {isMissionComplete ? 'Arrived' : 'Call'}
                                    </span>
                                  ) : displayedCurrentFloor === floor ? (
                                    <span className="text-[10px] uppercase tracking-[0.14em] text-[#2563eb]">
                                      Now
                                    </span>
                                  ) : null}
                                </div>
                              ))}
                            </div>

                            <div
                              ref={elevatorShaftRef}
                              className={['relative rounded-[32px] border border-[#d9e2ef] bg-[linear-gradient(180deg,#eef4ff,#ffffff)] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.9)]', isCompactResultLayout ? 'h-[205px]' : 'h-[320px]'].join(' ')}
                            >
                              <div className="absolute inset-4 rounded-[24px] border border-dashed border-[#c8d5ea]" />
                              <div className="absolute inset-y-4 left-1/2 w-[4px] -translate-x-1/2 rounded-full bg-[linear-gradient(180deg,#dbeafe,#93c5fd,#dbeafe)] opacity-85" />
                              <div className="absolute inset-y-4 left-[calc(50%-22px)] w-[2px] rounded-full bg-[#d9e2ef]" />
                              <div className="absolute inset-y-4 left-[calc(50%+20px)] w-[2px] rounded-full bg-[#d9e2ef]" />
                              <div
                                className="absolute left-1/2 z-10 h-10 w-[92px] -translate-x-1/2 rounded-[16px] border border-[#1d4ed8] bg-[linear-gradient(180deg,#60a5fa,#2563eb)] shadow-[0_12px_24px_rgba(37,99,235,0.28)] transition-all duration-700 ease-in-out"
                                style={{
                                  top: `${elevatorCarTop}px`,
                                }}
                              >
                                <div className="mx-auto mt-2 flex h-6 w-[56px] items-center justify-center rounded-[10px] bg-white/18 text-[12px] font-extrabold text-white">
                                  {displayedCurrentFloor === null ? 'HOLD' : `${displayedCurrentFloor}F`}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>

                  <div className="grid gap-4">
                    <div className={['rounded-[26px] border border-[#dbe5f1] bg-[linear-gradient(180deg,#ffffff,#f8fbff)] shadow-[0_14px_30px_rgba(15,23,42,0.05)]', isCompactResultLayout ? 'p-3' : 'p-5'].join(' ')}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#7c8ca5]">
                            {isLaundryVariant ? 'Laundry Item Input' : 'Handwriting Input'}
                          </div>
                          <div className={['font-semibold text-[#5f7088]', isCompactResultLayout ? 'mt-1 text-[13px]' : 'mt-2 text-[15px]'].join(' ')}>
                            {isMissionReady
                              ? isLaundryVariant
                                ? `Evaluation Board의 ${laundryRoundIndex + 1}번째 세탁물이 입력으로 들어왔습니다. 빨래 분류하기 버튼으로 결과를 확인하세요.`
                                : `${targetFloor}층을 손글씨로 적어 엘리베이터를 호출하세요.`
                              : '먼저 모델을 학습해야 미션 콘솔이 활성화됩니다.'}
                          </div>
                        </div>
                        {!isCompactResultLayout ? (
                          <div className="rounded-[18px] bg-[#0f172a] px-4 py-3 text-white shadow-[0_14px_30px_rgba(15,23,42,0.18)]">
                            <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/54">
                              {isLaundryVariant ? 'Laundry Request' : 'Passenger Request'}
                            </div>
                            <div className="mt-2 flex items-end gap-2">
                              <div className="font-display text-[42px] font-bold leading-none">
                                {isLaundryVariant ? targetSample?.label ?? 'Laundry' : targetFloor}
                              </div>
                              <div className="pb-1 text-[13px] font-semibold text-white/74">
                                {isLaundryVariant ? 'item' : '층'}
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div
                        className={[
                          'grid gap-3 lg:items-stretch',
                          isLaundryVariant
                            ? 'lg:grid-cols-[220px_minmax(260px,1fr)]'
                            : 'lg:grid-cols-[minmax(0,220px)_190px]',
                          isCompactResultLayout ? 'mt-2.5' : 'mt-5',
                        ].join(' ')}
                      >
                        {isLaundryVariant ? (
                          <div className="grid gap-2.5">
                            <div className="flex aspect-square w-full max-w-[220px] items-center justify-center rounded-[22px] border border-[#cbd5e1] bg-[linear-gradient(180deg,#f8fbff,#ffffff)] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.7)]">
                              {currentLaundryInput?.imageSrc ? (
                                <img
                                  src={currentLaundryInput.imageSrc}
                                  alt={currentLaundryInput.label}
                                  className="h-full w-full rounded-[18px] object-contain"
                                />
                              ) : (
                                <div className="text-[13px] font-semibold text-[#5f7088]">No sample</div>
                              )}
                            </div>
                            <div className="rounded-[16px] border border-[#dbe5f1] bg-[#f8fbff] px-3 py-2 text-[12px] font-semibold text-[#5f7088]">
                              Evaluation Board의 세탁물이 순서대로 입력됩니다.
                            </div>
                          </div>
                        ) : (
                          <canvas
                            ref={drawingCanvasRef}
                            width={280}
                            height={280}
                            className={[
                              'aspect-square w-full max-w-[220px] touch-none rounded-[22px] border border-[#cbd5e1] bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]',
                              isCompactResultLayout ? 'h-auto' : 'h-auto',
                            ].join(' ')}
                            onPointerDown={startDrawing}
                            onPointerMove={drawDigit}
                            onPointerUp={stopDrawing}
                            onPointerLeave={stopDrawing}
                          />
                        )}

                        <div className={['flex h-full flex-col justify-center', isCompactResultLayout ? 'gap-2' : 'gap-3'].join(' ')}>
                          <div className={['rounded-[18px] bg-[#0f172a] px-4 text-white shadow-[0_14px_30px_rgba(15,23,42,0.18)]', isCompactResultLayout ? 'py-2.5' : 'py-3'].join(' ')}>
                            <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/54">
                              {isLaundryVariant ? 'Current Laundry Input' : 'Passenger Request'}
                            </div>
                            <div className="mt-2 flex items-end gap-2">
                              <div className={['font-display font-bold leading-none', isCompactResultLayout ? 'text-[32px]' : 'text-[42px]'].join(' ')}>
                                {isLaundryVariant ? `Item ${laundryRoundIndex + 1}` : targetFloor}
                              </div>
                              <div className="pb-1 text-[13px] font-semibold text-white/74">
                                {isLaundryVariant ? 'of 10' : '층'}
                              </div>
                            </div>
                          </div>
                          <div className={['grid', isCompactResultLayout ? 'gap-1.5' : 'gap-2'].join(' ')}>
                            {!isLaundryVariant ? (
                              <button
                                type="button"
                                onClick={clearDrawing}
                                className={['rounded-full border border-[#c7d6ef] bg-white px-4 font-extrabold uppercase tracking-[0.14em] text-muted shadow-sm', isCompactResultLayout ? 'py-2 text-[12px]' : 'py-3 text-[13px]'].join(' ')}
                              >
                                Clear
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => {
                                void runPrediction();
                              }}
                              disabled={!isMissionReady || isPredicting || (isLaundryVariant && laundryAttemptFinished)}
                              className={['rounded-full bg-[linear-gradient(135deg,#1151ff,#3d73ff)] px-4 font-extrabold uppercase tracking-[0.14em] text-white shadow-[0_12px_28px_rgba(17,81,255,0.2)] disabled:cursor-not-allowed disabled:opacity-60', isCompactResultLayout ? 'py-2 text-[12px]' : 'py-3 text-[13px]'].join(' ')}
                            >
                              {isPredicting
                                ? isLaundryVariant
                                  ? '분류 중...'
                                  : 'Reading...'
                                : isLaundryVariant
                                  ? '빨래 분류하기'
                                  : 'Predict Floor'}
                            </button>
                          </div>

                          {isLaundryVariant && activePrediction ? (
                            <div className="rounded-[20px] border border-[#dce6f6] bg-[linear-gradient(135deg,#ffffff,#eef4ff)] px-4 py-3 shadow-[0_12px_28px_rgba(17,81,255,0.08)]">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">
                                    Prediction Result
                                  </div>
                                  <div className="mt-2 text-[30px] font-bold leading-none text-primary">
                                    {classLabels[activePrediction.predictedLabel] ?? `Class ${activePrediction.predictedLabel}`}
                                  </div>
                                  <div
                                    className={[
                                      'mt-2 inline-flex rounded-full px-3 py-1 text-[11px] font-bold',
                                      activePrediction.predictedLabel === currentLaundryTargetIndex
                                        ? 'bg-[#dbeafe] text-[#1d4ed8]'
                                        : 'bg-[#fee2e2] text-[#b42318]',
                                    ].join(' ')}
                                  >
                                    {activePrediction.predictedLabel === currentLaundryTargetIndex ? 'Correct' : 'Retry'}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">
                                    Confidence
                                  </div>
                                  <div className="mt-2 text-[26px] font-bold leading-none text-[#10213b]">
                                    {(activePrediction.confidence * 100).toFixed(1)}%
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {activeError ? (
                        <div className={['rounded-[18px] bg-[#fff1f2] px-4 text-[13px] font-semibold text-[#b42318]', isCompactResultLayout ? 'mt-2.5 py-2.5' : 'mt-4 py-3'].join(' ')}>
                          {activeError}
                        </div>
                      ) : null}

                      {activePrediction && !isLaundryVariant ? (
                        <div className={['rounded-[22px] border border-[#dce6f6] bg-[linear-gradient(135deg,#ffffff,#eef4ff)] px-4 shadow-[0_12px_28px_rgba(17,81,255,0.08)]', isCompactResultLayout ? 'mt-2 py-2.5' : 'mt-4 py-5'].join(' ')}>
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">
                                Prediction Result
                              </div>
                              <div className="mt-2 flex items-end gap-3">
                                <div className={['font-display font-bold text-primary', isCompactResultLayout ? 'text-[30px]' : 'text-[36px]'].join(' ')}>
                                  {isLaundryVariant
                                    ? classLabels[activePrediction.predictedLabel] ?? `Class ${activePrediction.predictedLabel}`
                                    : `${(resolvedActiveMissionFloor ?? activePrediction.predictedLabel)}F`}
                                </div>
                                <div
                                  className={[
                                    'rounded-full px-3 py-1.5 text-[11px] font-bold',
                                    (isLaundryVariant
                                      ? activePrediction.predictedLabel === currentLaundryTargetIndex
                                      : resolvedActiveMissionFloor === targetFloor)
                                      ? 'bg-[#dcfce7] text-[#166534]'
                                      : 'bg-[#fee2e2] text-[#b42318]',
                                  ].join(' ')}
                                >
                                  {(isLaundryVariant
                                    ? activePrediction.predictedLabel === currentLaundryTargetIndex
                                    : resolvedActiveMissionFloor === targetFloor)
                                    ? 'Correct'
                                    : 'Retry'}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">
                                Confidence
                              </div>
                              <div className={['font-display font-bold text-ink', isCompactResultLayout ? 'mt-1 text-[24px]' : 'mt-2 text-[28px]'].join(' ')}>
                                {(activePrediction.confidence * 100).toFixed(1)}%
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {isLaundryVariant && laundryAttemptFinished && !isMissionComplete ? (
                        <div
                          className={[
                            'rounded-[20px] border px-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)]',
                            laundryCorrectCount >= LAUNDRY_PASS_COUNT
                              ? 'border-[#bbf7d0] bg-[linear-gradient(135deg,#f0fdf4,#dcfce7)] text-[#166534]'
                              : 'border-[#fecdd3] bg-[linear-gradient(135deg,#fff1f2,#ffe4e6)] text-[#b42318]',
                            isCompactResultLayout ? 'mt-2 py-2.5' : 'mt-4 py-4',
                          ].join(' ')}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="text-[11px] font-extrabold uppercase tracking-[0.16em]">
                                {laundryCorrectCount >= LAUNDRY_PASS_COUNT ? 'Sorter Ready' : 'Still Not Enough'}
                              </div>
                              <div className={['font-semibold', isCompactResultLayout ? 'mt-1 text-[12px]' : 'mt-2 text-[14px]'].join(' ')}>
                                {laundryCorrectCount >= LAUNDRY_PASS_COUNT
                                  ? `총 10개 중 ${laundryCorrectCount}개를 맞혀 통과 기준 ${LAUNDRY_PASS_COUNT}개를 넘겼습니다. 이제 분류 라인을 다시 돌릴 수 있어요.`
                                  : `총 10개 중 ${laundryCorrectCount}개만 맞혔습니다. 통과하려면 적어도 ${LAUNDRY_PASS_COUNT}개를 맞혀야 합니다.`}
                              </div>
                            </div>
                            {!isMissionComplete && laundryCorrectCount < LAUNDRY_PASS_COUNT ? (
                              <button
                                type="button"
                                onClick={() => onMissionFail?.({ correctCount: laundryCorrectCount, totalCount: 10 })}
                                className={['rounded-full bg-[linear-gradient(135deg,#1151ff,#3d73ff)] px-5 font-extrabold uppercase tracking-[0.14em] text-white shadow-[0_12px_28px_rgba(17,81,255,0.22)]', isCompactResultLayout ? 'py-2 text-[11px]' : 'py-2.5 text-[12px]'].join(' ')}
                              >
                                Upgrade Model
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ) : null}

                      {(phase === 'complete' || isMissionComplete) ? (
                        <div className={['rounded-[20px] border border-[#bbf7d0] bg-[linear-gradient(135deg,#f0fdf4,#dcfce7)] px-4 text-[#166534] shadow-[0_12px_28px_rgba(34,197,94,0.12)]', isCompactResultLayout ? 'mt-2 py-2' : 'mt-4 py-4'].join(' ')}>
                          <div className="flex items-center gap-3">
                            <div className={['grid place-items-center rounded-full bg-white', isCompactResultLayout ? 'h-9 w-9' : 'h-11 w-11'].join(' ')}>
                              <Icon name="play" className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#15803d]">
                                Quest Complete
                              </div>
                              <div className={['font-semibold', isCompactResultLayout ? 'mt-0.5 text-[12px]' : 'mt-1 text-[14px]'].join(' ')}>
                                {isLaundryVariant
                                  ? '세탁물 이미지를 올바르게 분류해서 자동 세탁 분류 라인을 복구했습니다.'
                                  : '손글씨 숫자를 올바른 층수로 해석해서 버튼 없는 엘리베이터를 복구했습니다.'}
                              </div>
                            </div>
                          </div>
                          <div className={['flex justify-end', isCompactResultLayout ? 'mt-2' : 'mt-4'].join(' ')}>
                            <button
                              type="button"
                              onClick={onExitQuest}
                              className={['rounded-full bg-[linear-gradient(135deg,#16a34a,#22c55e)] px-5 font-extrabold uppercase tracking-[0.14em] text-white shadow-[0_12px_28px_rgba(34,197,94,0.24)]', isCompactResultLayout ? 'py-2 text-[11px]' : 'py-2.5 text-[12px]'].join(' ')}
                            >
                              Finish And Exit
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
