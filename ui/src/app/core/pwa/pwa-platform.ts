export type PwaInstallMode =
	| 'installed'
	| 'prompt'
	| 'ios-safari'
	| 'ios-browser'
	| 'browser-menu'
	| 'insecure'
	| 'unsupported';

export interface PwaNavigatorSnapshot {
	userAgent?: string;
	platform?: string;
	maxTouchPoints?: number;
	standalone?: boolean;
	serviceWorker?: unknown;
}

export interface PwaLocationSnapshot {
	protocol?: string;
	hostname?: string;
}

export interface PwaInstallContext {
	installed: boolean;
	promptAvailable: boolean;
	navigator: PwaNavigatorSnapshot;
	location: PwaLocationSnapshot;
	secureContext: boolean;
}

function userAgent(navigator: PwaNavigatorSnapshot): string {
	return String(navigator.userAgent || '').toLowerCase();
}

export function isIosDevice(navigator: PwaNavigatorSnapshot): boolean {
	const agent = userAgent(navigator);
	return /iphone|ipad|ipod/u.test(agent)
		|| (navigator.platform === 'MacIntel' && Number(navigator.maxTouchPoints || 0) > 1);
}

export function isSafariBrowser(navigator: PwaNavigatorSnapshot): boolean {
	const agent = userAgent(navigator);
	if (!/safari/u.test(agent)) return false;
	return !/crios|fxios|edgios|opios|android|chrome|chromium/u.test(agent);
}

export function hasServiceWorkerSupport(navigator: PwaNavigatorSnapshot): boolean {
	return Boolean(navigator.serviceWorker);
}

export function isStandaloneApp(
	navigator: PwaNavigatorSnapshot,
	displayModeStandalone: boolean,
): boolean {
	return displayModeStandalone || navigator.standalone === true;
}

export function isSecurePwaContext(
	location: PwaLocationSnapshot,
	secureContext: boolean,
): boolean {
	if (secureContext || location.protocol === 'https:') return true;
	return ['localhost', '127.0.0.1', '::1'].includes(String(location.hostname || '').toLowerCase());
}

export function resolvePwaInstallMode(context: PwaInstallContext): PwaInstallMode {
	if (context.installed) return 'installed';
	if (!isSecurePwaContext(context.location, context.secureContext)) return 'insecure';
	if (context.promptAvailable) return 'prompt';
	if (isIosDevice(context.navigator)) {
		return isSafariBrowser(context.navigator) ? 'ios-safari' : 'ios-browser';
	}
	if (!hasServiceWorkerSupport(context.navigator)) return 'unsupported';
	return 'browser-menu';
}
