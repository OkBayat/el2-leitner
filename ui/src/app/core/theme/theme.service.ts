import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject } from '@angular/core';
import { ThemeMode } from '../../domain/learning/models';

export const LIGHT_SYSTEM_CHROME_COLOR = '#f8f9ff';
export const DARK_SYSTEM_CHROME_COLOR = '#111318';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly systemThemeQuery = globalThis.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
  private activeMode: ThemeMode = 'system';

  constructor() {
    const query = this.systemThemeQuery;
    if (!query?.addEventListener) return;

    const onSystemThemeChanged = () => {
      if (this.activeMode !== 'system') return;
      this.applyResolved(query.matches ? 'dark' : 'light');
    };

    query.addEventListener('change', onSystemThemeChanged);
    this.destroyRef.onDestroy(() => query.removeEventListener('change', onSystemThemeChanged));
  }

  apply(mode: ThemeMode): void {
    this.activeMode = mode;
    const prefersDark = this.systemThemeQuery?.matches ?? false;
    this.applyResolved(mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode);
  }

  private applyResolved(resolved: 'light' | 'dark'): void {
    const root = this.document.documentElement;
    const chromeColor = resolved === 'dark' ? DARK_SYSTEM_CHROME_COLOR : LIGHT_SYSTEM_CHROME_COLOR;

    root.style.colorScheme = resolved;
    root.dataset['theme'] = resolved;
    root.style.setProperty('--vocora-system-chrome-color', chromeColor);

    this.updateMeta('color-scheme', resolved);
    this.updateMeta('theme-color', chromeColor);
  }

  private updateMeta(name: string, content: string): void {
    let meta = this.document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
    if (!meta) {
      meta = this.document.createElement('meta');
      meta.name = name;
      this.document.head.appendChild(meta);
    }
    meta.content = content;
    meta.removeAttribute('media');
  }
}
