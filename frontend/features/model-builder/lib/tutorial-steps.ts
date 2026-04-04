export type TutorialStepKey =
  | 'story-intro'
  | 'build-model'
  | 'stack-block'
  | 'match-input-dimension'
  | 'edit-dimensions'
  | 'set-activation'
  | 'choose-optimizer'
  | 'set-learning-rate'
  | 'set-batch-size'
  | 'set-epochs'
  | 'train-model'
  | 'training-metrics-loss'
  | 'training-metrics-accuracy'
  | 'play-mission'
  | 'complete';

export const tutorialSequence: TutorialStepKey[] = [
  'story-intro',
  'build-model',
  'stack-block',
  'match-input-dimension',
  'edit-dimensions',
  'set-activation',
  'choose-optimizer',
  'set-learning-rate',
  'set-batch-size',
  'set-epochs',
  'train-model',
  'training-metrics-loss',
  'training-metrics-accuracy',
  'play-mission',
  'complete',
];
