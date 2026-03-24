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
