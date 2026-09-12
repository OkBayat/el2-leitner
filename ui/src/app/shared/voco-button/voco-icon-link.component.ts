import { NgTemplateOutlet } from '@angular/common';
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
import { RouterLink } from '@angular/router';
import { VocoIconButtonSize, VocoIconButtonTone, VocoRouterLink } from './voco-button.types';

@Component({
  selector: 'voco-icon-link',
  imports: [NgTemplateOutlet, MatButtonModule, RouterLink],
  template: `
    <ng-template #content><ng-content /></ng-template>
    @if (routerLink() !== null) {
      <a
        #control
        mat-icon-button
        class="voco-icon-button voco-icon-button--{{ iconTone() }} voco-icon-button--{{ iconSize() }}"
        [class.voco-icon-button--selected]="selected()"
        [disabled]="disabled()"
        [routerLink]="disabled() ? null : routerLink()"
        [target]="target()"
        [attr.rel]="rel()"
        [attr.aria-label]="ariaLabel()"
        [attr.aria-describedby]="ariaDescribedBy()"
        [attr.aria-current]="ariaCurrent()"
        [attr.aria-disabled]="disabled() ? 'true' : null"
        [attr.tabindex]="disabled() ? -1 : null"
        [attr.title]="title()"
        (click)="onControlClick($event)"
        (keydown.enter)="onDisabledKeydown($event)"
        (keydown.space)="onDisabledKeydown($event)"
      ><ng-container [ngTemplateOutlet]="content" /></a>
    } @else {
      <a
        #control
        mat-icon-button
        class="voco-icon-button voco-icon-button--{{ iconTone() }} voco-icon-button--{{ iconSize() }}"
        [class.voco-icon-button--selected]="selected()"
        [disabled]="disabled()"
        [attr.href]="disabled() ? null : href()"
        [target]="target()"
        [attr.rel]="rel()"
        [attr.aria-label]="ariaLabel()"
        [attr.aria-describedby]="ariaDescribedBy()"
        [attr.aria-current]="ariaCurrent()"
        [attr.aria-disabled]="disabled() ? 'true' : null"
        [attr.tabindex]="disabled() ? -1 : null"
        [attr.title]="title()"
        (click)="onControlClick($event)"
        (keydown.enter)="onDisabledKeydown($event)"
        (keydown.space)="onDisabledKeydown($event)"
      ><ng-container [ngTemplateOutlet]="content" /></a>
    }
  `,
  styleUrl: './voco-icon-button.component.scss',
  host: {
    '[attr.aria-disabled]': 'disabled() ? "true" : null',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocoIconLinkComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly disabled = input(false, { transform: booleanAttribute });
  readonly href = input<string | null>(null);
  readonly routerLink = input<VocoRouterLink | null>(null);
  readonly target = input<string | undefined>(undefined);
  readonly rel = input<string | null>(null);
  readonly ariaLabel = input<string | null>(null, { alias: 'aria-label' });
  readonly ariaDescribedBy = input<string | null>(null, { alias: 'aria-describedby' });
  readonly ariaCurrent = input<string | null>(null, { alias: 'aria-current' });
  readonly title = input<string | null>(null);
  readonly iconTone = input<VocoIconButtonTone>('plain');
  readonly iconSize = input<VocoIconButtonSize>('default');
  readonly selected = input(false, { transform: booleanAttribute });
  readonly activated = output<MouseEvent>();

  protected onControlClick(event: MouseEvent): void {
    if (this.disabled()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    this.activated.emit(event);
  }

  protected onDisabledKeydown(event: Event): void {
    if (!this.disabled()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  focus(options?: FocusOptions): void {
    this.host.nativeElement.querySelector('a')?.focus(options);
  }
}
