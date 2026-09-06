import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { PathStepId } from '../../domain/home/daily-path';

@Component({
  selector: 'app-path-icon',
  template: `
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">
      @switch (kind) {
        @case ('vocabulary') {
          <rect x="7" y="7" width="28" height="31" rx="6" fill="currentColor" opacity=".45" transform="rotate(-12 21 22)"/>
          <rect x="12" y="10" width="29" height="32" rx="6" fill="currentColor"/>
          <path d="m19 32 7-15 7 15m-11-5h8" stroke="var(--node-face)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
        }
        @case ('listening') {
          <path d="M10 28v-6a14 14 0 0 1 28 0v6" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
          <rect x="7" y="23" width="10" height="17" rx="5" fill="currentColor"/>
          <rect x="31" y="23" width="10" height="17" rx="5" fill="currentColor"/>
          <path d="M13 25v12m22-12v12" stroke="var(--node-face)" stroke-width="2" opacity=".6"/>
        }
        @case ('shadowing') {
          <rect x="17" y="6" width="14" height="25" rx="7" fill="currentColor"/>
          <path d="M10 24a14 14 0 0 0 28 0M24 38v5m-7 0h14" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
          <path d="M22 11v10" stroke="var(--node-face)" stroke-width="2.5" stroke-linecap="round" opacity=".55"/>
        }
        @case ('reading') {
          <path d="M5 12c7-3 13-2 19 2v27c-6-4-12-5-19-2V12Z" fill="currentColor"/>
          <path d="M43 12c-7-3-13-2-19 2v27c6-4 12-5 19-2V12Z" fill="currentColor" opacity=".8"/>
          <path d="M24 14v26" stroke="var(--node-face)" stroke-width="3"/>
        }
      }
    </svg>
  `,
  styles: ':host{display:block;width:38px;height:38px}svg{display:block;width:100%;height:100%}',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PathIconComponent {
  @Input({ required: true }) kind!: PathStepId;
}

@Component({
  selector: 'app-book-wagon',
  template: `
    <img src="/assets/vocora-dumbbell.svg" alt="" aria-hidden="true" draggable="false" />
  `,
  styles: ':host,img{display:block;width:100%;height:100%}img{object-fit:contain;user-select:none}',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookWagonComponent {}
