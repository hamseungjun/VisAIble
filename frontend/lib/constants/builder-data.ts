import type { DatasetItem, LibraryBlock, StatItem } from '@/types/builder';

export const datasets: DatasetItem[] = [
  {
    id: 'mnist',
    icon: 'stack',
    label: 'MNIST Digit Set',
    inputShape: '1 x 28 x 28',
    records: '70,000 samples',
    domain: 'Handwritten digits',
  },
  {
    id: 'cifar10',
    icon: 'chip',
    label: 'CIFAR-10 Images',
    inputShape: '3 x 32 x 32',
    records: '60,000 samples',
    domain: 'Image classification',
  },
  {
    id: 'titanic',
    icon: 'grid',
    label: 'Titanic Survival',
    inputShape: '1 x 10',
    records: '891 rows',
    domain: 'Tabular prediction',
  },
  {
    id: 'imdb',
    icon: 'file',
    label: 'IMDB Reviews',
    inputShape: '1 x 500',
    records: '50,000 reviews',
    domain: 'Sentiment analysis',
  },
];

export const libraryBlocks: LibraryBlock[] = [
  {
    id: 'linear',
    title: 'Linear Layer',
    description: 'Fully connected neural network layer.',
    icon: 'layers',
    accent: 'primary',
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
    accent: 'tertiary',
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
];

export const stats: StatItem[] = [
  { label: 'Total Parameters', value: '142,501' },
  { label: 'Batch Size', value: '32' },
  { label: 'Epochs Completed', value: '48 / 100' },
];
