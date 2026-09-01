import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { ThemeMode } from '../../domain/learning/models';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  apply(mode: ThemeMode): void {
    const prefersDark = globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    const resolved = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;
    this.document.documentElement.style.colorScheme = resolved;
    this.document.documentElement.dataset['theme'] = resolved;
  }
}
