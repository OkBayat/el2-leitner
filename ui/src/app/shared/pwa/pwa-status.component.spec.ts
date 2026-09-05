import {describe, expect, it} from 'vitest';
import {shouldShowPwaInstallSuggestion} from './pwa-status.component';

describe('PWA install suggestion', () => {
	it('shows on the dashboard when the app is installable but not installed', () => {
		for (const mode of ['prompt', 'ios-safari', 'ios-browser', 'browser-menu'] as const) {
			expect(shouldShowPwaInstallSuggestion('/dashboard', mode, false, false, true)).toBe(true);
		}
	});

	it('does not show after the app is installed or when installation is unavailable', () => {
		expect(shouldShowPwaInstallSuggestion('/dashboard', 'installed', false, false, true)).toBe(false);
		expect(shouldShowPwaInstallSuggestion('/dashboard', 'insecure', false, false, true)).toBe(false);
		expect(shouldShowPwaInstallSuggestion('/dashboard', 'unsupported', false, false, true)).toBe(false);
	});

	it('stays limited to the first page and yields to higher-priority status messages', () => {
		expect(shouldShowPwaInstallSuggestion('/words', 'prompt', false, false, true)).toBe(false);
		expect(shouldShowPwaInstallSuggestion('/dashboard', 'prompt', true, false, true)).toBe(false);
		expect(shouldShowPwaInstallSuggestion('/dashboard', 'prompt', false, true, true)).toBe(false);
		expect(shouldShowPwaInstallSuggestion('/dashboard', 'prompt', false, false, false)).toBe(false);
	});
});
