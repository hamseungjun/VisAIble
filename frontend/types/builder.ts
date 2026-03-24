export type DatasetItem = {
  id: string;
  label: string;
  icon: IconName;
  inputShape?: string;
  records?: string;
  domain?: string;
};

export type BlockType = 'linear' | 'cnn';

export type LibraryBlock = {
  id: BlockType;
  title: string;
  description: string;
  icon: IconName;
  accent: 'primary' | 'tertiary';
  defaults: {
    fields: Array<{ label: string; value: string }>;
    activation: string;
    activationOptions: string[];
  };
};

export type CanvasNode = {
  id: string;
  type: BlockType;
  title: string;
  accent: 'primary' | 'tertiary';
  fields: Array<{ label: string; value: string }>;
  activation: string;
  activationOptions: string[];
};

export type TrainingRunMetric = {
  epoch: number;
  trainLoss: number;
  trainAccuracy: number;
  validationLoss: number;
  validationAccuracy: number;
};

export type TrainingRunResult = {
  datasetId: string;
  epochs: number;
  learningRate: number;
  optimizer: string;
  trainSize: number;
  validationSize: number;
  numClasses: number;
  device: string;
  architecture: string[];
  metrics: TrainingRunMetric[];
  bestValidationAccuracy: number;
};

export type TrainingJobStatus = {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  datasetId?: string | null;
  epochs?: number | null;
  learningRate?: number | null;
  optimizer?: string | null;
  trainSize?: number | null;
  validationSize?: number | null;
  numClasses?: number | null;
  device?: string | null;
  architecture: string[];
  metrics: TrainingRunMetric[];
  bestValidationAccuracy?: number | null;
  currentEpoch?: number | null;
  currentBatch?: number | null;
  totalBatches?: number | null;
  stage?: string | null;
  liveTrainLoss?: number | null;
  liveTrainAccuracy?: number | null;
  error?: string | null;
};

export type OptimizerParamsForCode = {
  momentum: string;
  weightDecay: string;
  rho: string;
};

export type StatItem = {
  label: string;
  value: string;
};

export type IconName =
  | 'stack'
  | 'chip'
  | 'grid'
  | 'file'
  | 'layers'
  | 'panel'
  | 'settings'
  | 'bell'
  | 'zoomIn'
  | 'zoomOut'
  | 'play'
  | 'reset'
  | 'rocket'
  | 'help'
  | 'check'
  | 'dots'
  | 'chevron'
  | 'architecture';
