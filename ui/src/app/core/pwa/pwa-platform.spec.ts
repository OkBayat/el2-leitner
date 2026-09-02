import {describe, expect, it} from 'vitest';
import {
	hasServiceWorkerSupport,
	isIosDevice,
	isSafariBrowser,
	isSecurePwaContext,
	isStandaloneApp,
	resolvePwaInstallMode,
	type PwaNavigatorSnapshot,
} from './pwa-platform';

const serviceWorker = {};

function context(navigator: PwaNavigatorSnapshot, overrides: Partial<Parameters<typeof resolvePwaInstallMode>[0]> = {}) {
	return {
		installed: false,
		promptAvailable: false,
		navigator,
		location: {protocol: 'https:', hostname: 'vocora.ir'},
		secureContext: true,
		...overrides,
	};
}

describe('PWA platform detection', () => {
	it('recognizes iPhone and iPadOS Safari', () => {
		const iphone = {
			userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
			platform: 'iPhone',
			serviceWorker,
		};
		const ipad = {
			userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
			platform: 'MacIntel',
			maxTouchPoints: 5,
			serviceWorker,
		};

		expect(isIosDevice(iphone)).toBe(true);
		expect(isIosDevice(ipad)).toBe(true);
		expect(isSafariBrowser(iphone)).toBe(true);
		expect(resolvePwaInstallMode(context(iphone))).toBe('ios-safari');
	});

	it('directs non-Safari iOS browsers back to Safari for installation', () => {
		const chromeIos = {
			userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/140.0 Mobile/15E148 Safari/604.1',
			platform: 'iPhone',
			serviceWorker,
		};

		expect(isSafariBrowser(chromeIos)).toBe(false);
		expect(resolvePwaInstallMode(context(chromeIos))).toBe('ios-browser');
	});

	it('prefers the native browser install prompt when it is available', () => {
		const android = {
			userAgent: 'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36',
			platform: 'Linux armv8l',
			serviceWorker,
		};

		expect(resolvePwaInstallMode(context(android, {promptAvailable: true}))).toBe('prompt');
	});

	it('treats standalone display mode and iOS standalone mode as installed', () => {
		expect(isStandaloneApp({standalone: true}, false)).toBe(true);
		expect(isStandaloneApp({}, true)).toBe(true);
		expect(resolvePwaInstallMode(context({serviceWorker}, {installed: true}))).toBe('installed');
	});

	it('requires a secure origin outside localhost', () => {
		expect(isSecurePwaContext({protocol: 'http:', hostname: 'vocora.ir'}, false)).toBe(false);
		expect(isSecurePwaContext({protocol: 'http:', hostname: 'localhost'}, false)).toBe(true);
		expect(resolvePwaInstallMode(context({serviceWorker}, {
			location: {protocol: 'http:', hostname: 'vocora.ir'},
			secureContext: false,
		}))).toBe('insecure');
	});

	it('falls back to browser-menu guidance or unsupported messaging', () => {
		expect(hasServiceWorkerSupport({serviceWorker})).toBe(true);
		expect(resolvePwaInstallMode(context({serviceWorker}))).toBe('browser-menu');
		expect(resolvePwaInstallMode(context({}))).toBe('unsupported');
	});
});
