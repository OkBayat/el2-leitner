import {describe, expect, it} from 'vitest';
import {shouldShowPwaInstallSuggestion, synchronizeRequiredUpdateOverlay} from './pwa-status.component';

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

	it('keeps the install suggestion eligible while dashboard content remains interactive beneath the passive card', () => {
		expect(shouldShowPwaInstallSuggestion('/dashboard', 'prompt', false, false, true)).toBe(true);
		// Pointer-event ownership is intentionally limited to the card actions in the component stylesheet;
		// the suggestion itself remains visible instead of being disabled to make dashboard clicks work.
	});

	it('blocks and restores the global CDK overlay container across a required-update transition', () => {
		const overlayContainer = document.createElement('div');

		synchronizeRequiredUpdateOverlay(overlayContainer, true);

		expect(overlayContainer.classList.contains('vocora-required-update-blocked')).toBe(true);
		expect(overlayContainer.hasAttribute('inert')).toBe(true);
		expect(overlayContainer.getAttribute('aria-hidden')).toBe('true');

		synchronizeRequiredUpdateOverlay(overlayContainer, false);

		expect(overlayContainer.classList.contains('vocora-required-update-blocked')).toBe(false);
		expect(overlayContainer.hasAttribute('inert')).toBe(false);
		expect(overlayContainer.hasAttribute('aria-hidden')).toBe(false);
	});
});
