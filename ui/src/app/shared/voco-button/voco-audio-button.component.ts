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
import { VocoAudioButtonSize, VocoNativeButtonType } from './voco-button.types';

@Component({
  selector: 'voco-audio-button',
  imports: [MatButtonModule],
  template: `
    <button
      #control
      mat-flat-button
      class="voco-audio-button voco-audio-button--{{ audioSize() }}"
      [type]="type()"
      [disabled]="disabled()"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-describedby]="ariaDescribedBy()"
      [attr.aria-busy]="ariaBusy()"
      [attr.aria-pressed]="ariaPressed()"
      [attr.title]="title()"
      (click)="onControlClick($event)"
    ><ng-content /></button>
  `,
  styleUrl: './voco-audio-button.component.scss',
  host: {
    '[attr.aria-disabled]': 'disabled() ? "true" : null',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocoAudioButtonComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly type = input<VocoNativeButtonType>('button');
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly ariaLabel = input<string | null>(null, { alias: 'aria-label' });
  readonly ariaDescribedBy = input<string | null>(null, { alias: 'aria-describedby' });
  readonly ariaBusy = input<string | null>(null, { alias: 'aria-busy' });
  readonly ariaPressed = input<string | null>(null, { alias: 'aria-pressed' });
  readonly title = input<string | null>(null);
  readonly audioSize = input<VocoAudioButtonSize>('default');
  readonly activated = output<MouseEvent>();

  protected onControlClick(event: MouseEvent): void {
    if (this.disabled()) return;
    this.activated.emit(event);
  }

  focus(options?: FocusOptions): void {
    this.host.nativeElement.querySelector('button')?.focus(options);
  }
}
