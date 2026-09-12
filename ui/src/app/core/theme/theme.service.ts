import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent, merge } from 'rxjs';
import { ThemeMode } from '../../domain/learning/models';

export const THEME_MODE_STORAGE_KEY = 'vocora-theme-mode-v1';
export const SYSTEM_THEME_MEDIA = {
  light: '(prefers-color-scheme: light)',
  dark: '(prefers-color-scheme: dark)',
} as const;

function storedThemeMode(): ThemeMode {
  try {
    const mode = globalThis.localStorage?.getItem(THEME_MODE_STORAGE_KEY);
    if (mode === 'light' || mode === 'dark' || mode === 'system') return mode;
  } catch { /* Browser storage can be unavailable. */ }
  return 'light';
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly systemThemeQuery = globalThis.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
  private activeMode: ThemeMode = storedThemeMode();
  private readonly resolvedThemeState = signal<'light' | 'dark'>(
    this.document.documentElement.dataset['theme'] === 'dark' ? 'dark' : 'light',
  );
  readonly resolvedTheme = this.resolvedThemeState.asReadonly();

  constructor() {
    const query = this.systemThemeQuery;
    if (!query) return;

    merge(
      fromEvent<MediaQueryListEvent>(query, 'change'),
      fromEvent(this.document, 'visibilitychange'),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.activeMode !== 'system') return;
        this.applyResolved(query.matches ? 'dark' : 'light');
      });
  }

  apply(mode: ThemeMode): void {
    this.activeMode = mode;
    try { globalThis.localStorage?.setItem(THEME_MODE_STORAGE_KEY, mode); } catch { /* Browser storage can be unavailable. */ }
    const prefersDark = this.systemThemeQuery?.matches ?? false;
    this.applyResolved(mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode);
  }

  private applyResolved(resolved: 'light' | 'dark'): void {
    const root = this.document.documentElement;
    const body = this.document.body;

    root.style.colorScheme = resolved;
    root.dataset['theme'] = resolved;
    const chromeColor = this.document.defaultView
      ?.getComputedStyle(root)
      .getPropertyValue('--vocora-surface-page')
      .trim() || root.style.getPropertyValue('--vocora-system-chrome-color').trim();
    if (chromeColor) root.style.setProperty('--vocora-system-chrome-color', chromeColor);
    root.style.removeProperty('background-color');

    if (body) {
      body.style.colorScheme = resolved;
      body.style.removeProperty('background-color');
    }

    this.updateThemeColorMetadata(resolved, chromeColor);
    this.updateMeta('color-scheme', resolved);
    this.resolvedThemeState.set(resolved);
  }

  private updateThemeColorMetadata(resolved: 'light' | 'dark', chromeColor: string): void {
    for (const theme of ['light', 'dark'] as const) {
      const meta = this.getThemeColorMeta(theme);
      if (theme === resolved && chromeColor) meta.content = chromeColor;
      meta.media = this.activeMode === 'system'
        ? SYSTEM_THEME_MEDIA[theme]
        : theme === resolved ? 'all' : 'not all';
    }
  }

  private getThemeColorMeta(theme: 'light' | 'dark'): HTMLMetaElement {
    let meta = this.document.head.querySelector<HTMLMetaElement>(
      `meta[name="theme-color"][data-vocora-theme="${theme}"]`,
    );
    if (!meta) {
      meta = this.document.createElement('meta');
      meta.name = 'theme-color';
      meta.dataset['vocoraTheme'] = theme;
      this.document.head.appendChild(meta);
    }
    return meta;
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
