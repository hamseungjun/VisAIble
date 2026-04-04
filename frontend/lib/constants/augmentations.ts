import type { TrainingAugmentationId, TrainingAugmentationParams } from '@/types/builder';

export const augmentationGroups: Array<{
  id: string;
  title: string;
  description: string;
  options: Array<{
    id: TrainingAugmentationId;
    label: string;
    description: string;
  }>;
}> = [
  {
    id: 'mixing',
    title: 'Mixing',
    description: '샘플을 섞어 일반화를 높입니다.',
    options: [
      {
        id: 'mixup',
        label: 'MixUp',
        description: '이미지와 라벨을 비율로 섞어 일반화 성능을 높입니다.',
      },
      {
        id: 'cutmix',
        label: 'CutMix',
        description: '다른 이미지의 패치를 붙여 부분 특징에도 강해지게 만듭니다.',
      },
    ],
  },
  {
    id: 'geometry',
    title: 'Geometric',
    description: '위치 변화에 강해집니다.',
    options: [
      {
        id: 'random_crop',
        label: 'Random Crop',
        description: '조금씩 다른 프레이밍으로 보면서 위치 편향을 줄입니다.',
      },
      {
        id: 'flip_rotate',
        label: 'Random Horizontal Flip',
        description: '좌우 반전으로 방향이 달라져도 같은 특징을 보게 합니다.',
      },
    ],
  },
  {
    id: 'color',
    title: 'Color & Contrast',
    description: '조명 변화에 적응합니다.',
    options: [
      {
        id: 'color_jitter',
        label: 'Color Jitter',
        description: '밝기, 대비, 채도, hue를 흔들어 색 변화에 적응시킵니다.',
      },
      {
        id: 'contrast_boost',
        label: 'Contrast Boost',
        description: '대비를 키워 경계와 텍스처 변화를 더 많이 보게 합니다.',
      },
    ],
  },
  {
    id: 'tone',
    title: 'Tone Shift',
    description: '형태 중심으로 봅니다.',
    options: [
      {
        id: 'grayscale',
        label: 'Grayscale',
        description: '일부 이미지를 회색조로 바꿔 색상 의존도를 낮춥니다.',
      },
    ],
  },
];

export const augmentationParameterConfig: Record<
  TrainingAugmentationId,
  {
    label: string;
    min: number;
    max: number;
    defaultValue: number;
    suffix: string;
  }
> = {
  mixup: {
    label: 'Mix Ratio',
    min: 10,
    max: 80,
    defaultValue: 45,
    suffix: '%',
  },
  cutmix: {
    label: 'Patch Size',
    min: 24,
    max: 56,
    defaultValue: 38,
    suffix: '%',
  },
  flip_rotate: {
    label: 'Flip Chance',
    min: 10,
    max: 100,
    defaultValue: 50,
    suffix: '%',
  },
  random_crop: {
    label: 'Zoom',
    min: 108,
    max: 145,
    defaultValue: 122,
    suffix: '%',
  },
  color_jitter: {
    label: 'Jitter',
    min: 0,
    max: 40,
    defaultValue: 18,
    suffix: '%',
  },
  contrast_boost: {
    label: 'Contrast',
    min: 100,
    max: 170,
    defaultValue: 135,
    suffix: '%',
  },
  grayscale: {
    label: 'Grayscale',
    min: 0,
    max: 100,
    defaultValue: 100,
    suffix: '%',
  },
};

export const defaultAugmentationParams: TrainingAugmentationParams = Object.fromEntries(
  Object.entries(augmentationParameterConfig).map(([augmentationId, config]) => [
    augmentationId,
    config.defaultValue,
  ]),
) as TrainingAugmentationParams;
