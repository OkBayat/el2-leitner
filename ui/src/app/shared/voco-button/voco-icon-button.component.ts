import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  booleanAttribute,
  inject,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { VocoIconButtonSize, VocoIconButtonTone, VocoNativeButtonType } from './voco-button.types';

@Component({
  selector: 'voco-icon-button',
  imports: [MatButtonModule],
  template: `
    <button
      #control
      mat-icon-button
      class="voco-icon-button voco-icon-button--{{ iconTone() }} voco-icon-button--{{ iconSize() }}"
      [class.voco-icon-button--selected]="selected()"
      [type]="type()"
      [disabled]="disabled()"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-describedby]="ariaDescribedBy()"
      [attr.aria-busy]="ariaBusy()"
      [attr.aria-controls]="ariaControls()"
      [attr.aria-expanded]="ariaExpanded()"
      [attr.aria-pressed]="ariaPressed()"
      [attr.title]="title()"
      (click)="onControlClick($event)"
    ><ng-content /></button>
  `,
  styleUrl: './voco-icon-button.component.scss',
  host: {
    '[attr.aria-disabled]': 'disabled() ? "true" : null',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocoIconButtonComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly type = input<VocoNativeButtonType>('button');
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly ariaLabel = input<string | null>(null, { alias: 'aria-label' });
  readonly ariaDescribedBy = input<string | null>(null, { alias: 'aria-describedby' });
  readonly ariaBusy = input<string | null>(null, { alias: 'aria-busy' });
  readonly ariaControls = input<string | null>(null, { alias: 'aria-controls' });
  readonly ariaExpanded = input<string | null>(null, { alias: 'aria-expanded' });
  readonly ariaPressed = input<string | null>(null, { alias: 'aria-pressed' });
  readonly title = input<string | null>(null);
  readonly iconTone = input<VocoIconButtonTone>('plain');
  readonly iconSize = input<VocoIconButtonSize>('default');
  readonly selected = input(false, { transform: booleanAttribute });
  readonly activated = output<MouseEvent>();

  protected onControlClick(event: MouseEvent): void {
    if (this.disabled()) return;
    this.activated.emit(event);
  }

  focus(options?: FocusOptions): void {
    this.host.nativeElement.querySelector('button')?.focus(options);
  }
}
