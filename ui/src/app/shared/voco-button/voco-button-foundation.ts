import {
  Directive,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  booleanAttribute,
  inject,
} from '@angular/core';
import { VocoButtonIntent, VocoNativeButtonType } from './voco-button.types';

export const VOCO_CONTROL_HOST = {
  '[attr.aria-disabled]': 'disabled ? "true" : null',
};

@Directive()
export abstract class VocoButtonFoundation {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected abstract readonly intent: VocoButtonIntent;
  @Input() type: VocoNativeButtonType = 'button';
  @Input({ transform: booleanAttribute }) disabled = false;
  @Input({ alias: 'aria-label' }) ariaLabel: string | null = null;
  @Input({ alias: 'aria-describedby' }) ariaDescribedBy: string | null = null;
  @Input({ alias: 'aria-busy' }) ariaBusy: string | null = null;
  @Input({ alias: 'aria-controls' }) ariaControls: string | null = null;
  @Input({ alias: 'aria-expanded' }) ariaExpanded: string | null = null;
  @Input({ alias: 'aria-pressed' }) ariaPressed: string | null = null;
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

  focus(options?: FocusOptions): void {
    this.host.nativeElement.querySelector('button')?.focus(options);
  }
}
