export const optimizerOrder = ['SGD', 'AdaGrad', 'SGD+Momentum', 'RMS Prop', 'ADAM'] as const;

export type OptimizerName = (typeof optimizerOrder)[number];

export type OptimizerParamKey = 'momentum' | 'weightDecay' | 'rho';

export type OptimizerParams = {
  momentum: string;
  weightDecay: string;
  rho: string;
};

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
    };
  }
> = {
  SGD: {
    learningRates: ['0.0005', '0.001', '0.003', '0.005', '0.01'],
    defaultLearningRate: '0.01',
    parameter: {
      key: 'weightDecay',
      label: 'Weight Decay',
      values: ['0', '0.0001', '0.0005', '0.001', '0.003'],
      defaultValue: '0.0005',
    },
  },
  AdaGrad: {
    learningRates: ['0.0005', '0.001', '0.003', '0.005', '0.01'],
    defaultLearningRate: '0.01',
    parameter: {
      key: 'weightDecay',
      label: 'Weight Decay',
      values: ['0', '0.0001', '0.0005', '0.001', '0.003'],
      defaultValue: '0.0001',
    },
  },
  'SGD+Momentum': {
    learningRates: ['0.0005', '0.001', '0.003', '0.005', '0.01'],
    defaultLearningRate: '0.01',
    parameter: {
      key: 'momentum',
      label: 'Momentum',
      values: ['0.80', '0.85', '0.90', '0.95', '0.99'],
      defaultValue: '0.90',
    },
  },
  'RMS Prop': {
    learningRates: ['0.0001', '0.0003', '0.0005', '0.001', '0.003'],
    defaultLearningRate: '0.001',
    parameter: {
      key: 'rho',
      label: 'Rho',
      values: ['0.90', '0.95', '0.99'],
      defaultValue: '0.99',
    },
  },
  ADAM: {
    learningRates: ['0.00001', '0.0001', '0.0003', '0.0005', '0.001'],
    defaultLearningRate: '0.001',
    parameter: {
      key: 'weightDecay',
      label: 'Weight Decay',
      values: ['0', '0.00001', '0.0001', '0.0005', '0.001'],
      defaultValue: '0.0001',
    },
  },
};
