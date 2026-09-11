import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppUpdateService, binaryRequirement, compareVersions, type NativeReleasePolicy } from './app-update.service';

vi.mock('@capgo/capacitor-updater', () => ({
  CapacitorUpdater: { triggerUpdateCheck: vi.fn().mockResolvedValue({ status: 'queued' }) },
}));

const policy: NativeReleasePolicy = {
  enabled: true,
  platform: 'android',
  latestVersion: '3.2.0',
  minimumSupportedVersion: '3.1.0',
  storeUrl: 'https://play.google.com/store/apps/details?id=ir.vocora',
};

describe('native binary update policy', () => {
  beforeEach(() => vi.clearAllMocks());

  it('compares semantic app versions without lexical ordering bugs', () => {
    expect(compareVersions('3.10.0', '3.2.0')).toBe(1);
    expect(compareVersions('3.2', '3.2.0')).toBe(0);
  });

  it('separates optional, required, and current binaries', () => {
    expect(binaryRequirement('3.1.0', policy)).toBe('optional');
    expect(binaryRequirement('3.0.9', policy)).toBe('required');
    expect(binaryRequirement('3.2.0', policy)).toBe('none');
    expect(binaryRequirement('3.0.0', { ...policy, enabled: false })).toBe('none');
  });

  it('does not contact the live-update provider when native auto-update is disabled', async () => {
    const fakeService = {
      runtime: { native: true },
      liveUpdatesEnabled: () => false,
      checkBinaryUpdate: vi.fn().mockResolvedValue(undefined),
    } as unknown as AppUpdateService;

    await AppUpdateService.prototype.checkForUpdates.call(fakeService);

    expect(CapacitorUpdater.triggerUpdateCheck).not.toHaveBeenCalled();
  });

  it('queues a live-update check only after native auto-update is enabled', async () => {
    const fakeService = {
      runtime: { native: true },
      liveUpdatesEnabled: () => true,
      checkBinaryUpdate: vi.fn().mockResolvedValue(undefined),
    } as unknown as AppUpdateService;

    await AppUpdateService.prototype.checkForUpdates.call(fakeService);

    expect(CapacitorUpdater.triggerUpdateCheck).toHaveBeenCalledOnce();
  });
});
