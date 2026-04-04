export type TutorialStepKey =
  | 'story-intro'
  | 'build-model'
  | 'stack-block'
  | 'edit-dimensions'
  | 'set-activation'
  | 'train-model'
  | 'play-mission'
  | 'complete';

export const tutorialSequence: TutorialStepKey[] = [
  'story-intro',
  'build-model',
  'stack-block',
  'edit-dimensions',
  'set-activation',
  'train-model',
  'play-mission',
  'complete',
];
