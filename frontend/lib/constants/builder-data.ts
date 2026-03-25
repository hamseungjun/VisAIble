import type { DatasetItem, LibraryBlock, StatItem } from '@/types/builder';

export const datasets: DatasetItem[] = [
  {
    id: 'mnist',
    icon: 'stack',
    label: 'MNIST Digit Set',
    inputShape: '1 x 28 x 28',
    records: '70,000 samples',
    domain: 'Handwritten digits',
    classCount: 10,
    descriptionKo:
      '손글씨 숫자 이미지 데이터셋입니다. 흑백 28x28 이미지로 구성되며 숫자 0부터 9까지를 분류합니다.',
    shapeDescriptionKo: '입력 텐서 형태는 1채널 28x28 이미지입니다.',
    classesDescriptionKo: '클래스는 총 10개이며 숫자 0, 1, 2, 3, 4, 5, 6, 7, 8, 9입니다.',
    sampleClasses: [
      { label: '숫자 0', imageSrc: '/dataset-samples/mnist/0.png' },
      { label: '숫자 1', imageSrc: '/dataset-samples/mnist/1.png' },
      { label: '숫자 7', imageSrc: '/dataset-samples/mnist/7.png' },
      { label: '숫자 9', imageSrc: '/dataset-samples/mnist/9.png' },
    ],
  },
  {
    id: 'fashion_mnist',
    icon: 'stack',
    label: 'Fashion-MNIST',
    inputShape: '1 x 28 x 28',
    records: '70,000 samples',
    domain: 'Apparel classification',
    classCount: 10,
    descriptionKo:
      '의류 품목을 분류하는 흑백 이미지 데이터셋입니다. MNIST와 같은 크기라 CNN 실험용으로 많이 씁니다.',
    shapeDescriptionKo: '입력 텐서 형태는 1채널 28x28 이미지입니다.',
    classesDescriptionKo:
      '클래스는 총 10개이며 티셔츠/상의, 바지, 풀오버, 드레스, 코트, 샌들, 셔츠, 스니커즈, 가방, 앵클부츠입니다.',
    sampleClasses: [
      { label: '티셔츠', imageSrc: '/dataset-samples/fashion_mnist/0.png' },
      { label: '풀오버', imageSrc: '/dataset-samples/fashion_mnist/2.png' },
      { label: '가방', imageSrc: '/dataset-samples/fashion_mnist/8.png' },
      { label: '앵클부츠', imageSrc: '/dataset-samples/fashion_mnist/9.png' },
    ],
  },
  {
    id: 'cifar10',
    icon: 'chip',
    label: 'CIFAR-10 Images',
    inputShape: '3 x 32 x 32',
    records: '60,000 samples',
    domain: 'Image classification',
    classCount: 10,
    descriptionKo:
      '작은 컬러 자연 이미지 데이터셋입니다. 기본적인 이미지 분류 모델 성능을 빠르게 비교할 때 자주 사용됩니다.',
    shapeDescriptionKo: '입력 텐서 형태는 RGB 3채널 32x32 이미지입니다.',
    classesDescriptionKo:
      '클래스는 총 10개이며 비행기, 자동차, 새, 고양이, 사슴, 개, 개구리, 말, 배, 트럭입니다.',
    sampleClasses: [
      { label: '비행기', imageSrc: '/dataset-samples/cifar10/0.png' },
      { label: '자동차', imageSrc: '/dataset-samples/cifar10/1.png' },
      { label: '고양이', imageSrc: '/dataset-samples/cifar10/3.png' },
      { label: '배', imageSrc: '/dataset-samples/cifar10/8.png' },
    ],
  },
  {
    id: 'imagenet',
    icon: 'panel',
    label: 'Tiny ImageNet',
    inputShape: '3 x 64 x 64',
    records: '100,000 train / 10,000 val',
    domain: 'Compact ImageNet-style classification',
    classCount: 200,
    descriptionKo:
      'ImageNet 계열 구조를 가볍게 실험할 수 있는 축소판 데이터셋입니다. 원본보다 훨씬 작지만 다양한 사물 클래스를 유지합니다.',
    shapeDescriptionKo: '입력 텐서 형태는 RGB 3채널 64x64 이미지입니다.',
    classesDescriptionKo:
      '클래스는 총 200개입니다. 동물, 탈것, 생활 물체 등 ImageNet 계열의 다양한 카테고리로 구성됩니다.',
    sampleClasses: [
      { label: '금붕어', imageSrc: '/dataset-samples/imagenet/n01443537.jpg' },
      { label: '불도롱뇽', imageSrc: '/dataset-samples/imagenet/n01629819.jpg' },
      { label: '황소개구리', imageSrc: '/dataset-samples/imagenet/n01641577.jpg' },
      { label: '꼬리개구리', imageSrc: '/dataset-samples/imagenet/n01644900.jpg' },
    ],
  },
  {
    id: 'coco',
    icon: 'grid',
    label: 'COCO 2017',
    inputShape: '3 x 224 x 224',
    records: '5,000 val images',
    domain: 'Object classification proxy',
    classCount: 80,
    descriptionKo:
      '원래는 객체 탐지와 분할용 데이터셋이지만, 현재 빌더에서는 이미지 내 대표 객체를 기준으로 분류 형태로 사용합니다. 앱에서는 가벼운 학습을 위해 compact split으로 나눠 사용합니다.',
    shapeDescriptionKo: '입력 텐서 형태는 RGB 3채널 224x224 이미지입니다.',
    classesDescriptionKo:
      '클래스는 총 80개이며 사람, 자전거, 자동차, 개, 고양이, 의자, 병 등 일상 객체 중심으로 구성됩니다.',
    sampleClasses: [
      { label: '사람', imageSrc: '/dataset-samples/coco/1.jpg' },
      { label: '자동차', imageSrc: '/dataset-samples/coco/3.jpg' },
      { label: '고양이', imageSrc: '/dataset-samples/coco/17.jpg' },
      { label: '의자', imageSrc: '/dataset-samples/coco/62.jpg' },
    ],
  },
];

export const libraryBlocks: LibraryBlock[] = [
  {
    id: 'linear',
    title: 'Linear Layer',
    description: 'Fully connected neural network layer.',
    icon: 'layers',
    accent: 'blue',
    defaults: {
      fields: [
        { label: 'Input', value: '784' },
        { label: 'Output', value: '128' },
      ],
      activation: 'ReLU',
      activationOptions: ['None', 'ReLU', 'Leaky ReLU', 'GELU', 'Sigmoid', 'Tanh', 'Softplus'],
    },
  },
  {
    id: 'cnn',
    title: 'CNN Layer',
    description: 'Convolutional neural network layer.',
    icon: 'panel',
    accent: 'amber',
    defaults: {
      fields: [
        { label: 'Channel In', value: '1' },
        { label: 'Channel Out', value: '16' },
        { label: 'Kernel Size', value: '3x3' },
        { label: 'Padding', value: '1' },
        { label: 'Stride', value: '1' },
      ],
      activation: 'ReLU',
      activationOptions: ['None', 'ReLU', 'ELU', 'SELU', 'GELU', 'Swish', 'Tanh'],
    },
  },
  {
    id: 'pooling',
    title: 'Pooling Layer',
    description: 'Downsample feature maps with max or average pooling.',
    icon: 'pool',
    accent: 'violet',
    defaults: {
      fields: [
        { label: 'Pool Type', value: 'MaxPool' },
        { label: 'Kernel Size', value: '2x2' },
        { label: 'Stride', value: '' },
        { label: 'Padding', value: '0' },
      ],
      activation: 'None',
      activationOptions: ['None'],
    },
  },
  {
    id: 'dropout',
    title: 'Dropout Layer',
    description: 'Regularize features by randomly masking activations during training.',
    icon: 'dropout',
    accent: 'rose',
    defaults: {
      fields: [{ label: 'Probability', value: '0.30' }],
      activation: 'None',
      activationOptions: ['None'],
    },
  },
];

export const stats: StatItem[] = [
  { label: 'Total Parameters', value: '142,501' },
  { label: 'Batch Size', value: '128' },
  { label: 'Epochs Completed', value: '48 / 100' },
];
