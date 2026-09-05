import {describe, expect, it} from 'vitest';
import {isSuccessfulWorkerInstallState, isWorkerInstallFailure} from './pwa-update.service';

function followedByRedundant(states: ServiceWorkerState[]): boolean {
	let installedSuccessfully = false;
	for (const state of states) {
		if (isSuccessfulWorkerInstallState(state)) installedSuccessfully = true;
	}
	return isWorkerInstallFailure('redundant', installedSuccessfully);
}

describe('PWA update worker lifecycle', () => {
	it('reports a worker discarded before installation completes', () => {
		expect(followedByRedundant(['installing'])).toBe(true);
	});

	it('does not report an installed worker as failed when a newer worker replaces it', () => {
		expect(followedByRedundant(['installing', 'installed', 'activating', 'activated'])).toBe(false);
	});

	it('treats activating and activated states as proof that installation already succeeded', () => {
		expect(followedByRedundant(['activating'])).toBe(false);
		expect(followedByRedundant(['activated'])).toBe(false);
	});
});
