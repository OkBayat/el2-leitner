import {TestBed} from '@angular/core/testing';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
	DARK_SYSTEM_CHROME_COLOR,
	LIGHT_SYSTEM_CHROME_COLOR,
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

describe('ThemeService system chrome', () => {
	beforeEach(() => {
		document.head.querySelectorAll('meta[name="theme-color"], meta[name="color-scheme"]').forEach((meta) => meta.remove());
		addMeta('theme-color', LIGHT_SYSTEM_CHROME_COLOR, '(prefers-color-scheme: light)');
		addMeta('color-scheme', 'light');
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

		const themeColor = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
		const colorScheme = document.head.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
		expect(themeColor?.content).toBe(LIGHT_SYSTEM_CHROME_COLOR);
		expect(themeColor?.hasAttribute('media')).toBe(false);
		expect(colorScheme?.content).toBe('light');
		expect(document.documentElement.dataset['theme']).toBe('light');
		expect(document.documentElement.style.colorScheme).toBe('light');
		expect(document.body.style.colorScheme).toBe('light');
		expect(document.documentElement.style.backgroundColor).toBe(LIGHT_SYSTEM_CHROME_COLOR);
		expect(document.body.style.backgroundColor).toBe(LIGHT_SYSTEM_CHROME_COLOR);
		expect(document.documentElement.style.getPropertyValue('--vocora-system-chrome-color')).toBe(LIGHT_SYSTEM_CHROME_COLOR);
	});

	it('switches both system bars and edge-to-edge surfaces to the dark app theme', () => {
		const service = TestBed.inject(ThemeService);
		service.apply('dark');

		expect(document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content).toBe(DARK_SYSTEM_CHROME_COLOR);
		expect(document.head.querySelector<HTMLMetaElement>('meta[name="color-scheme"]')?.content).toBe('dark');
		expect(document.documentElement.dataset['theme']).toBe('dark');
		expect(document.documentElement.style.colorScheme).toBe('dark');
		expect(document.body.style.colorScheme).toBe('dark');
		expect(document.documentElement.style.backgroundColor).toBe(DARK_SYSTEM_CHROME_COLOR);
		expect(document.body.style.backgroundColor).toBe(DARK_SYSTEM_CHROME_COLOR);
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
		expect(document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content).toBe(DARK_SYSTEM_CHROME_COLOR);

		query.matches = false;
		changeListener();
		expect(document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content).toBe(LIGHT_SYSTEM_CHROME_COLOR);

		service.apply('dark');
		query.matches = false;
		changeListener();
		expect(document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content).toBe(DARK_SYSTEM_CHROME_COLOR);
	});
});
