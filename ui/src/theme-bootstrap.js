(() => {
	const storageKey = 'vocora-theme-mode-v1';
	// Synchronized from Layer A by tools/sync-first-paint-theme-colors.mjs.
	const pageColors = {light: '#ffffff', dark: '#0f1611'};
	let mode = 'light';

	try {
		const savedMode = globalThis.localStorage?.getItem(storageKey);
		if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') mode = savedMode;
	} catch {
		// Keep the product default when browser storage is unavailable.
	}

	const prefersDark = globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
	const resolved = mode === 'dark' || (mode === 'system' && prefersDark) ? 'dark' : 'light';
	const chromeColor = pageColors[resolved];
	const root = document.documentElement;

	root.dataset.theme = resolved;
	root.style.colorScheme = resolved;
	root.style.backgroundColor = chromeColor;
	root.style.setProperty('--vocora-system-chrome-color', chromeColor);

	const themeColors = document.querySelectorAll('meta[name="theme-color"][data-vocora-theme]');
	for (const meta of themeColors) {
		const theme = meta.dataset.vocoraTheme;
		meta.media = mode === 'system'
			? `(prefers-color-scheme: ${theme})`
			: theme === resolved ? 'all' : 'not all';
	}
	const colorScheme = document.querySelector('meta[name="color-scheme"]');
	if (colorScheme) colorScheme.content = resolved;
})();
