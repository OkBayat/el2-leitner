import {TestBed} from '@angular/core/testing';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
	DARK_SYSTEM_CHROME_COLOR,
	LIGHT_SYSTEM_CHROME_COLOR,
	SYSTEM_THEME_MEDIA,
	THEME_MODE_STORAGE_KEY,
	ThemeService,
} from './theme.service';

function addMeta(name: string, content: string, media?: string): HTMLMetaElement {
	const meta = document.createElement('meta');
	meta.name = name;
	meta.content = content;
	if (media) meta.media = media;
	document.head.appendChild(meta);
	return meta;
}

function addThemeColorMeta(theme: 'light' | 'dark', content: string): HTMLMetaElement {
	const meta = addMeta('theme-color', content, SYSTEM_THEME_MEDIA[theme]);
	meta.dataset['vocoraTheme'] = theme;
	return meta;
}

function themeColorMeta(theme: 'light' | 'dark'): HTMLMetaElement | null {
	return document.head.querySelector<HTMLMetaElement>(`meta[name="theme-color"][data-vocora-theme="${theme}"]`);
}

function normalizedBackground(color: string): string {
	const element = document.createElement('div');
	element.style.backgroundColor = color;
	return element.style.backgroundColor;
}

describe('ThemeService system chrome', () => {
	beforeEach(() => {
		localStorage.clear();
		document.head.querySelectorAll('meta[name="theme-color"], meta[name="color-scheme"]').forEach((meta) => meta.remove());
		addThemeColorMeta('light', LIGHT_SYSTEM_CHROME_COLOR);
		addThemeColorMeta('dark', DARK_SYSTEM_CHROME_COLOR);
		addMeta('color-scheme', 'light dark');
	});

	afterEach(() => {
		TestBed.resetTestingModule();
		vi.unstubAllGlobals();
		document.documentElement.removeAttribute('data-theme');
		document.documentElement.style.removeProperty('color-scheme');
		document.documentElement.style.removeProperty('background-color');
		document.documentElement.style.removeProperty('--vocora-system-chrome-color');
		document.body.style.removeProperty('color-scheme');
		document.body.style.removeProperty('background-color');
	});

	it('keeps Android status and navigation chrome aligned with an explicit light app theme', () => {
		const service = TestBed.inject(ThemeService);
		service.apply('light');

		expect(LIGHT_SYSTEM_CHROME_COLOR).toBe('#ffffff');
		const lightThemeColor = themeColorMeta('light');
		const darkThemeColor = themeColorMeta('dark');
		const colorScheme = document.head.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
		expect(lightThemeColor?.content).toBe(LIGHT_SYSTEM_CHROME_COLOR);
		expect(lightThemeColor?.media).toBe('all');
		expect(darkThemeColor?.content).toBe(DARK_SYSTEM_CHROME_COLOR);
		expect(darkThemeColor?.media).toBe('not all');
		expect(colorScheme?.content).toBe('light');
		expect(document.documentElement.dataset['theme']).toBe('light');
		expect(document.documentElement.style.colorScheme).toBe('light');
		expect(document.body.style.colorScheme).toBe('light');
		expect(document.documentElement.style.backgroundColor).toBe(normalizedBackground(LIGHT_SYSTEM_CHROME_COLOR));
		expect(document.body.style.backgroundColor).toBe(normalizedBackground(LIGHT_SYSTEM_CHROME_COLOR));
		expect(document.documentElement.style.getPropertyValue('--vocora-system-chrome-color')).toBe(LIGHT_SYSTEM_CHROME_COLOR);
		expect(localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBe('light');
	});

	it('switches both system bars and edge-to-edge surfaces to the dark app theme', () => {
		const service = TestBed.inject(ThemeService);
		service.apply('dark');

		expect(DARK_SYSTEM_CHROME_COLOR).toBe('#0f1611');
		expect(themeColorMeta('light')?.media).toBe('not all');
		expect(themeColorMeta('dark')?.media).toBe('all');
		expect(document.head.querySelector<HTMLMetaElement>('meta[name="color-scheme"]')?.content).toBe('dark');
		expect(document.documentElement.dataset['theme']).toBe('dark');
		expect(document.documentElement.style.colorScheme).toBe('dark');
		expect(document.body.style.colorScheme).toBe('dark');
		expect(document.documentElement.style.backgroundColor).toBe(normalizedBackground(DARK_SYSTEM_CHROME_COLOR));
		expect(document.body.style.backgroundColor).toBe(normalizedBackground(DARK_SYSTEM_CHROME_COLOR));
		expect(localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBe('dark');
	});

	it('follows device theme changes only while the app theme is set to system', () => {
		let changeListener: () => void = () => undefined;
		const query = {
			matches: true,
			addEventListener: vi.fn((_type: string, listener: () => void) => { changeListener = listener; }),
			removeEventListener: vi.fn(),
		};
		vi.stubGlobal('matchMedia', vi.fn(() => query));

		const service = TestBed.inject(ThemeService);
		service.apply('system');
		expect(localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBe('system');
		expect(themeColorMeta('light')?.media).toBe(SYSTEM_THEME_MEDIA.light);
		expect(themeColorMeta('dark')?.media).toBe(SYSTEM_THEME_MEDIA.dark);
		expect(document.documentElement.dataset['theme']).toBe('dark');

		query.matches = false;
		changeListener();
		expect(document.documentElement.dataset['theme']).toBe('light');

		query.matches = true;
		document.dispatchEvent(new Event('visibilitychange'));
		expect(document.documentElement.dataset['theme']).toBe('dark');

		service.apply('dark');
		query.matches = false;
		changeListener();
		expect(document.documentElement.dataset['theme']).toBe('dark');
	});
});
