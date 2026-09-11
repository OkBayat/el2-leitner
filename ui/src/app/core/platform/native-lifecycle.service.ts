import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { App as CapacitorApp, type URLOpenListenerEvent } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import type { PluginListenerHandle } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import { RuntimePlatformService } from './runtime-platform.service';

const VOCORA_WEB_ORIGIN = 'https://vocora.ir';
const NATIVE_LOCAL_ORIGINS = new Set(['https://localhost', 'capacitor://localhost']);

export function internalRouteFromNativeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol === 'vocora:' && url.hostname === 'app') return `${url.pathname}${url.search}${url.hash}` || '/';
    if (url.origin === VOCORA_WEB_ORIGIN) return `${url.pathname}${url.search}${url.hash}` || '/';
  } catch { /* Ignore malformed external URLs. */ }
  return null;
}

export function shouldOpenExternally(href: string): boolean {
  try {
    const url = new URL(href, globalThis.location?.href || 'https://localhost/');
    const internal = url.origin === VOCORA_WEB_ORIGIN || NATIVE_LOCAL_ORIGINS.has(url.origin);
    return (url.protocol === 'http:' || url.protocol === 'https:') && !internal;
  } catch {
    return false;
  }
}

export async function handleNativeAnchorClick(
  event: Event,
  navigateByUrl: (route: string) => Promise<unknown>,
  openExternal: (url: string) => Promise<unknown>,
): Promise<boolean> {
  const target = event.target;
  if (!(target instanceof Element)) return false;
  const anchor = target.closest<HTMLAnchorElement>('a[href]');
  if (!anchor) return false;

  const internalRoute = internalRouteFromNativeUrl(anchor.href);
  if (internalRoute) {
    event.preventDefault();
    await navigateByUrl(internalRoute);
    return true;
  }
  if (!shouldOpenExternally(anchor.href)) return false;

  event.preventDefault();
  await openExternal(anchor.href);
  return true;
}

@Injectable({ providedIn: 'root' })
export class NativeLifecycleService {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly runtime = inject(RuntimePlatformService);
  private readonly listeners: PluginListenerHandle[] = [];
  private started = false;

  readonly keyboardOpen = signal(false);
  readonly keyboardHeight = signal(0);
  readonly active = signal(true);

  start(): void {
    if (this.started || !this.runtime.native) return;
    this.started = true;
    this.document.documentElement.classList.add('capacitor-native');
    fromEvent(this.document, 'click', { capture: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => void this.handleDocumentClick(event));
    this.destroyRef.onDestroy(() => void this.stop());
    void this.registerListeners();
  }

  private async registerListeners(): Promise<void> {
    this.listeners.push(
      await Keyboard.addListener('keyboardWillShow', ({ keyboardHeight }) => {
        this.keyboardOpen.set(true);
        this.keyboardHeight.set(keyboardHeight);
        this.document.documentElement.classList.add('native-keyboard-open');
        this.document.documentElement.style.setProperty('--native-keyboard-height', `${keyboardHeight}px`);
      }),
      await Keyboard.addListener('keyboardWillHide', () => this.clearKeyboardState()),
      await CapacitorApp.addListener('appStateChange', ({ isActive }) => this.active.set(isActive)),
      await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) globalThis.history.back();
        else void CapacitorApp.minimizeApp();
      }),
      await CapacitorApp.addListener('appUrlOpen', (event) => void this.openNativeUrl(event)),
    );

    const launch = await CapacitorApp.getLaunchUrl();
    if (launch) await this.openNativeUrl(launch);
  }

  private async openNativeUrl(event: URLOpenListenerEvent): Promise<void> {
    const route = internalRouteFromNativeUrl(event.url);
    if (route) await this.router.navigateByUrl(route);
  }

  private async handleDocumentClick(event: Event): Promise<void> {
    await handleNativeAnchorClick(
      event,
      (route) => this.router.navigateByUrl(route),
      (url) => Browser.open({ url }),
    );
  }

  private clearKeyboardState(): void {
    this.keyboardOpen.set(false);
    this.keyboardHeight.set(0);
    this.document.documentElement.classList.remove('native-keyboard-open');
    this.document.documentElement.style.removeProperty('--native-keyboard-height');
  }

  private async stop(): Promise<void> {
    this.clearKeyboardState();
    await Promise.all(this.listeners.splice(0).map((listener) => listener.remove()));
  }
}
