import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../../environments/environment';

export const NATIVE_REQUEST_HEADER = 'X-Vocora-Native-Client';

export function resolveRuntimeUrl(path: string, native: boolean, apiBaseUrl: string): string {
  if (!native || !path.startsWith('/api/')) return path;
  if (!apiBaseUrl.startsWith('https://')) {
    throw new Error('Native production API base URL must use HTTPS.');
  }
  return new URL(path, `${apiBaseUrl.replace(/\/$/u, '')}/`).toString();
}

export function runtimeApiUrl(path: string): string {
  return resolveRuntimeUrl(path, environment.native && Capacitor.isNativePlatform(), environment.apiBaseUrl);
}

export function runtimeRequestHeaders(): Record<string, string> {
  return environment.native && Capacitor.isNativePlatform() ? { [NATIVE_REQUEST_HEADER]: 'capacitor' } : {};
}

@Injectable({ providedIn: 'root' })
export class RuntimePlatformService {
  readonly native = environment.native && Capacitor.isNativePlatform();
  readonly platform = this.native ? Capacitor.getPlatform() : 'web';

  apiUrl(path: string): string {
    return resolveRuntimeUrl(path, this.native, environment.apiBaseUrl);
  }

  requestHeaders(): Record<string, string> {
    return this.native ? { [NATIVE_REQUEST_HEADER]: 'capacitor' } : {};
  }
}
