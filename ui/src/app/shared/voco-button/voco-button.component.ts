import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  booleanAttribute,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';

export type VocoButtonVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'error'
  | 'navigation';
export type VocoIconButtonTone = 'plain' | 'primary' | 'secondary' | 'error';
export type VocoIconButtonSize = 'default' | 'large' | 'hero';
export type VocoAudioButtonSize = 'default' | 'large';
export type VocoNativeButtonType = 'button' | 'submit' | 'reset';

type VocoButtonKind = 'button' | 'link' | 'icon' | 'icon-link' | 'audio';

interface VocoButtonIdentity {
  readonly kind: VocoButtonKind;
  readonly variant: VocoButtonVariant;
}

const IDENTITIES: Readonly<Record<string, VocoButtonIdentity>> = {
  'voco-primary-button': { kind: 'button', variant: 'primary' },
  'voco-secondary-button': { kind: 'button', variant: 'secondary' },
  'voco-success-button': { kind: 'button', variant: 'success' },
  'voco-warning-button': { kind: 'button', variant: 'warning' },
  'voco-error-button': { kind: 'button', variant: 'error' },
  'voco-navigation-button': { kind: 'button', variant: 'navigation' },
  'voco-primary-link': { kind: 'link', variant: 'primary' },
  'voco-secondary-link': { kind: 'link', variant: 'secondary' },
  'voco-navigation-link': { kind: 'link', variant: 'navigation' },
  'voco-icon-button': { kind: 'icon', variant: 'navigation' },
  'voco-icon-link': { kind: 'icon-link', variant: 'navigation' },
  'voco-audio-button': { kind: 'audio', variant: 'primary' },
};

@Component({
  selector: 'voco-primary-button, voco-secondary-button, voco-success-button, voco-warning-button, voco-error-button, voco-navigation-button, voco-primary-link, voco-secondary-link, voco-navigation-link, voco-icon-button, voco-icon-link, voco-audio-button',
  standalone: true,
  imports: [MatButtonModule, NgTemplateOutlet, RouterLink],
  templateUrl: './voco-button.component.html',
  styleUrl: './voco-button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.aria-disabled]': 'disabled() ? "true" : null',
  },
})
export class VocoButtonComponent {
  private readonly identity = IDENTITIES[inject(ElementRef<HTMLElement>).nativeElement.localName];
  private readonly control = viewChild('control', {
    read: ElementRef<HTMLButtonElement | HTMLAnchorElement>,
  });

  readonly type = input<VocoNativeButtonType>('button');
  readonly intent = input<VocoButtonVariant | null>(null);
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly ariaLabel = input<string | null>(null, { alias: 'aria-label' });
  readonly ariaDescribedBy = input<string | null>(null, { alias: 'aria-describedby' });
  readonly ariaBusy = input<string | null>(null, { alias: 'aria-busy' });
  readonly ariaControls = input<string | null>(null, { alias: 'aria-controls' });
  readonly ariaCurrent = input<string | null>(null, { alias: 'aria-current' });
  readonly ariaExpanded = input<string | null>(null, { alias: 'aria-expanded' });
  readonly ariaPressed = input<string | null>(null, { alias: 'aria-pressed' });
  readonly title = input<string | null>(null);
  readonly routerLink = input<string | readonly unknown[] | null>(null);
  readonly href = input<string | null>(null);
  readonly target = input<string | undefined>(undefined);
  readonly rel = input<string | null>(null);
  readonly iconTone = input<VocoIconButtonTone>('plain');
  readonly iconSize = input<VocoIconButtonSize>('default');
  readonly selected = input(false, { transform: booleanAttribute });
  readonly audioSize = input<VocoAudioButtonSize>('default');

  protected readonly kind = this.identity.kind;
  protected readonly variant = computed(() => this.intent() ?? this.identity.variant);

  focus(options?: FocusOptions): void {
    this.control()?.nativeElement.focus(options);
  }
}
