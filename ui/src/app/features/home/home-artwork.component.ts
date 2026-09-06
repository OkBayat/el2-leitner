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
    <svg viewBox="0 0 180 166" fill="none" aria-hidden="true" focusable="false">
      <ellipse cx="92" cy="151" rx="65" ry="11" fill="#202a37" opacity=".09"/>
      <path d="m139 108 16-38h13" stroke="#52616a" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="29" y="47" width="35" height="70" rx="7" fill="#61b9a5" transform="rotate(-14 29 47)"/>
      <path d="m35 57 8-2 11 45-8 2-11-45Z" fill="#9cdfc6"/>
      <rect x="104" y="41" width="32" height="76" rx="7" fill="#ef7f67" transform="rotate(12 104 41)"/>
      <path d="m111 50 15 3-2 7-15-3 2-7Z" fill="#ffbf9c"/>
      <rect x="57" y="22" width="62" height="89" rx="12" fill="#efae26"/>
      <path d="M67 27h45v73H67c-5 0-8-3-8-7V35c0-5 3-8 8-8Z" fill="#fff0bc"/>
      <path d="M110 24v29l-7-5-7 5V24" fill="#ef7f67"/>
      <ellipse cx="77" cy="63" rx="7" ry="9" fill="white"/>
      <ellipse cx="100" cy="63" rx="7" ry="9" fill="white"/>
      <ellipse cx="79" cy="65" rx="3.8" ry="5.5" fill="#344554"/>
      <ellipse cx="102" cy="65" rx="3.8" ry="5.5" fill="#344554"/>
      <path d="M82 79q7 8 14-1" stroke="#a36838" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="70" cy="77" rx="5" ry="3" fill="#f4aa78" opacity=".7"/>
      <ellipse cx="106" cy="77" rx="5" ry="3" fill="#f4aa78" opacity=".7"/>
      <path d="M25 103h120l-10 29c-2 6-7 8-13 8H48c-7 0-12-4-14-10l-9-27Z" fill="#d88716"/>
      <path d="M25 96h120l-6 29H37L25 96Z" fill="#ffac22"/>
      <rect x="23" y="93" width="126" height="13" rx="6.5" fill="#ffc548"/>
      <path d="M51 116h60" stroke="#ffdb81" stroke-width="6" stroke-linecap="round"/>
      <circle cx="49" cy="140" r="14" fill="#465360"/>
      <circle cx="122" cy="140" r="14" fill="#465360"/>
      <circle cx="49" cy="140" r="6" fill="#d9e2df"/>
      <circle cx="122" cy="140" r="6" fill="#d9e2df"/>
      <path d="m38 19 3 7 8 3-8 3-3 8-3-8-7-3 7-3 3-7Z" fill="#ffcc4d"/>
    </svg>
  `,
  styles: ':host,svg{display:block;width:100%;height:100%}',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookWagonComponent {}
