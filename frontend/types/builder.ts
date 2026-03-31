export type DatasetItem = {
  id: string;
  label: string;
  icon: IconName;
  inputShape?: string;
  records?: string;
  domain?: string;
  classCount?: number;
  descriptionKo?: string;
  shapeDescriptionKo?: string;
  classesDescriptionKo?: string;
  sampleClasses?: Array<{
    label: string;
    imageSrc?: string;
  }>;
  classLabels?: string[];
};

export type BlockType = 'linear' | 'cnn' | 'pooling' | 'dropout';

export type BlockAccent = 'blue' | 'amber' | 'violet' | 'rose' | 'emerald';

export type LibraryBlock = {
  id: BlockType;
  title: string;
  description: string;
  icon: IconName;
  accent: BlockAccent;
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
  accent: BlockAccent;
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
  batchSize: number;
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
  status: 'queued' | 'running' | 'paused' | 'stopped' | 'completed' | 'failed';
  datasetId?: string | null;
  epochs?: number | null;
  learningRate?: number | null;
  batchSize?: number | null;
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
  liveValidationLoss?: number | null;
  liveValidationAccuracy?: number | null;
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
  | 'pool'
  | 'settings'
  | 'bell'
  | 'zoomIn'
  | 'zoomOut'
  | 'play'
  | 'pause'
  | 'stop'
  | 'reset'
  | 'rocket'
  | 'help'
  | 'check'
  | 'dots'
  | 'chevron'
  | 'architecture'
  | 'dropout'
  | 'copy'
  | 'flask'
  | 'trophy';

export type CompetitionParticipant = {
  id: number;
  displayName: string;
  role: 'host' | 'member';
  joinedAt: string;
};

export type CompetitionRoomSession = {
  roomCode: string;
  title: string;
  datasetId: string;
  hostName: string;
  hostParticipantId: number;
  participantId: number;
  participantName: string;
  participantRole: 'host' | 'member';
  startsAt?: string | null;
  endsAt?: string | null;
  createdAt: string;
  isActive: boolean;
  participants: CompetitionParticipant[];
  generatedPassword?: string | null;
};

export type CompetitionLeaderboardEntry = {
  participantId: number;
  participantName: string;
  role: 'host' | 'member';
  rank: number;
  publicScore: number;
  privateScore: number | null;
  trainAccuracy: number;
  validationAccuracy: number;
  optimizer: string;
  batchSize: number;
  isBaseline: boolean;
  submittedAt: string;
};

export type CompetitionLeaderboard = {
  roomCode: string;
  title: string;
  hostName: string;
  datasetId: string;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive: boolean;
  entries: CompetitionLeaderboardEntry[];
};

export type CompetitionSubmissionResult = {
  submissionId: number;
  roomCode: string;
  participantId: number;
  participantName: string;
  isBaseline: boolean;
  trainAccuracy: number;
  validationAccuracy: number;
  publicScore: number;
  privateScore: number | null;
  submittedAt: string;
};
