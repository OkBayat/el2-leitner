import {
  Directive,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  booleanAttribute,
  inject,
} from '@angular/core';
import type { Params } from '@angular/router';
import { VocoLinkIntent, VocoRouterLink } from './voco-button.types';

export const VOCO_LINK_HOST = {
  '[attr.aria-disabled]': 'disabled ? "true" : null',
};

@Directive()
export abstract class VocoLinkFoundation {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected abstract readonly intent: VocoLinkIntent;
  @Input({ transform: booleanAttribute }) disabled = false;
  @Input() href: string | null = null;
  @Input() routerLink: VocoRouterLink | null = null;
  @Input() queryParams: Params | null = null;
  @Input() target: string | undefined;
  @Input() rel: string | null = null;
  @Input({ alias: 'aria-label' }) ariaLabel: string | null = null;
  @Input({ alias: 'aria-describedby' }) ariaDescribedBy: string | null = null;
  @Input({ alias: 'aria-current' }) ariaCurrent: string | null = null;
  @Input() title: string | null = null;
  @Output() readonly activated = new EventEmitter<MouseEvent>();

  protected onControlClick(event: MouseEvent): void {
    if (this.disabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    this.activated.emit(event);
  }

  protected onDisabledKeydown(event: Event): void {
    if (!this.disabled) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  focus(options?: FocusOptions): void {
    this.host.nativeElement.querySelector('a')?.focus(options);
  }
}
