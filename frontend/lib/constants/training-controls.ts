export const optimizerOrder = ['SGD', 'AdaGrad', 'RMS Prop', 'ADAM'] as const;
export const batchSizeOptions = [1, 8, 16, 32, 64, 128] as const;

export type OptimizerName = (typeof optimizerOrder)[number];

export type OptimizerParamKey = 'momentum' | 'rho';

export type OptimizerParams = {
  momentum: string;
  rho: string;
};

const sharedLearningRates = [
  '0.00001',
  '0.00002',
  '0.00003',
  '0.00004',
  '0.00005',
  '0.0001',
  '0.0002',
  '0.0003',
  '0.0004',
  '0.0005',
  '0.001',
  '0.002',
  '0.003',
  '0.004',
  '0.005',
  '0.01',
];

export const optimizerConfigs: Record<
  OptimizerName,
  {
    learningRates: string[];
    defaultLearningRate: string;
    parameter: {
      key: OptimizerParamKey;
      label: string;
      values: string[];
      defaultValue: string;
    } | null;
  }
> = {
  SGD: {
    learningRates: sharedLearningRates,
    defaultLearningRate: '0.01',
    parameter: {
      key: 'momentum',
      label: 'Momentum',
      values: ['0.80', '0.85', '0.90', '0.95', '0.99'],
      defaultValue: '0.90',
    },
  },
  AdaGrad: {
    learningRates: sharedLearningRates,
    defaultLearningRate: '0.01',
    parameter: null,
  },
  'RMS Prop': {
    learningRates: sharedLearningRates,
    defaultLearningRate: '0.001',
    parameter: {
      key: 'rho',
      label: 'Rho',
      values: ['0.90', '0.95', '0.99'],
      defaultValue: '0.99',
    },
  },
  ADAM: {
    learningRates: sharedLearningRates,
    defaultLearningRate: '0.001',
    parameter: null,
  },
};
