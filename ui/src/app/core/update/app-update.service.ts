import { Injectable, inject, signal } from '@angular/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import type { PluginListenerHandle } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { WEB_APP_VERSION } from '../../../generated/app-version';
import { ApiClientService } from '../http/api-client.service';
import { RuntimePlatformService } from '../platform/runtime-platform.service';

export interface NativeReleasePolicy {
  enabled: boolean;
  platform: 'android' | 'ios';
  latestVersion: string;
  minimumSupportedVersion: string;
  storeUrl: string;
}

export type BinaryUpdateRequirement = 'none' | 'optional' | 'required';

export function compareVersions(left: string, right: string): number {
  const normalize = (value: string) => {
    const parts = value.split('.', 3).map((part) => Number.parseInt(part, 10) || 0);
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
  };
  const a = normalize(left);
  const b = normalize(right);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  }
  return 0;
}

export function binaryRequirement(current: string, policy: NativeReleasePolicy): BinaryUpdateRequirement {
  if (!policy.enabled || compareVersions(current, policy.latestVersion) >= 0) return 'none';
  return compareVersions(current, policy.minimumSupportedVersion) < 0 ? 'required' : 'optional';
}

@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly api = inject(ApiClientService);
  private readonly runtime = inject(RuntimePlatformService);
  private liveBundleId: string | null = null;
  private storeUrl = '';
  private listeners: PluginListenerHandle[] = [];
  private started = false;

  readonly native = this.runtime.native;
  readonly platform = this.runtime.platform;
  readonly webVersion = WEB_APP_VERSION;
  readonly nativeVersion = signal<string | null>(null);
  readonly nativeBuild = signal<string | null>(null);
  readonly liveUpdatesEnabled = signal(false);
  readonly liveUpdateReady = signal(false);
  readonly binaryUpdate = signal<BinaryUpdateRequirement>('none');
  readonly activating = signal(false);
  readonly errorMessage = signal('');

  start(): void {
    if (this.started || !this.runtime.native) return;
    this.started = true;
    void this.initializeNativeUpdates();
  }

  async restartForLiveUpdate(): Promise<void> {
    if (!this.liveBundleId || this.activating()) return;
    this.activating.set(true);
    try {
      await CapacitorUpdater.set({ id: this.liveBundleId });
    } catch {
      this.activating.set(false);
      this.errorMessage.set('The downloaded update could not be activated. Vocora will keep the current version.');
    }
  }

  async postponeLiveUpdate(): Promise<void> {
    if (!this.liveBundleId) return;
    try {
      await CapacitorUpdater.next({ id: this.liveBundleId });
      this.liveUpdateReady.set(false);
    } catch {
      this.errorMessage.set('The update will not be changed until Vocora can validate it again.');
    }
  }

  async openStore(): Promise<void> {
    if (!this.storeUrl) return;
    await Browser.open({ url: this.storeUrl });
  }

  dismissOptionalBinaryUpdate(): void {
    if (this.binaryUpdate() === 'optional') this.binaryUpdate.set('none');
  }

  clearError(): void {
    this.errorMessage.set('');
  }

  async checkForUpdates(): Promise<void> {
    if (!this.runtime.native) return;
    const checks: Promise<unknown>[] = [this.checkBinaryUpdate()];
    if (this.liveUpdatesEnabled()) checks.push(CapacitorUpdater.triggerUpdateCheck());
    await Promise.allSettled(checks);
  }

  private async initializeNativeUpdates(): Promise<void> {
    try {
      const info = await CapacitorApp.getInfo();
      this.nativeVersion.set(info.version);
      this.nativeBuild.set(info.build);
      this.listeners.push(await CapacitorApp.addListener('resume', () => void this.checkForUpdates()));

      const { enabled } = await CapacitorUpdater.isAutoUpdateEnabled();
      this.liveUpdatesEnabled.set(enabled);
      if (enabled) {
        this.listeners.push(
          await CapacitorUpdater.addListener('updateAvailable', ({ bundle }) => {
            this.liveBundleId = bundle.id;
            this.liveUpdateReady.set(true);
          }),
          await CapacitorUpdater.addListener('breakingAvailable', () => {
            this.errorMessage.set('This update needs a newer Vocora app from the app store.');
          }),
        );
        await CapacitorUpdater.notifyAppReady();
      }
      await this.checkForUpdates();
    } catch {
      this.errorMessage.set('Update checks are temporarily unavailable. Vocora will continue with its validated local version.');
    }
  }

  private async checkBinaryUpdate(): Promise<void> {
    const platform = this.platform;
    const current = this.nativeVersion();
    if ((platform !== 'android' && platform !== 'ios') || !current) return;
    const policy = await this.api.get<NativeReleasePolicy>(`/api/mobile/releases/${platform}`);
    this.storeUrl = policy.storeUrl;
    this.binaryUpdate.set(binaryRequirement(current, policy));
  }
}
