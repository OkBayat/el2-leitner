export type VocoNativeButtonType = 'button' | 'submit' | 'reset';
export type VocoIconButtonTone = 'plain' | 'primary' | 'secondary' | 'error';
export type VocoIconButtonSize = 'default' | 'large' | 'hero';
export type VocoAudioButtonSize = 'default' | 'large';

export type VocoButtonIntent =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'error'
  | 'navigation';

export type VocoLinkIntent = 'primary' | 'secondary' | 'navigation';
export type VocoRouterLink = string | readonly unknown[];
