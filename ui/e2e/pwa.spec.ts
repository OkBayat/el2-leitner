import {expect, test} from '@playwright/test';

test('production exposes an installable PWA and reloads the cached shell offline', async ({page, request, context}) => {
	const manifestResponse = await request.get('/manifest.webmanifest');
	expect(manifestResponse.ok()).toBe(true);
	expect(manifestResponse.headers()['content-type']).toContain('application/manifest+json');
	const manifest = await manifestResponse.json();
	expect(manifest.name).toContain('Vocora');
	expect(manifest.display).toBe('standalone');
	expect(manifest.icons).toEqual(expect.arrayContaining([
		expect.objectContaining({sizes: '192x192', purpose: 'any'}),
		expect.objectContaining({sizes: '512x512', purpose: 'any'}),
		expect.objectContaining({sizes: '192x192', purpose: 'maskable'}),
		expect.objectContaining({sizes: '512x512', purpose: 'maskable'}),
	]));

	const workerResponse = await request.get('/service-worker.js');
	expect(workerResponse.ok()).toBe(true);
	expect(workerResponse.headers()['cache-control']).toContain('no-store');
	expect(workerResponse.headers()['service-worker-allowed']).toBe('/');
	expect(await workerResponse.text()).toContain("/^\\/api(?:\\/|$)/u");

	await page.goto('/offline');
	await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
	await expect(page.getByRole('heading', {name: "You're offline"})).toBeVisible();

	await expect.poll(async () => page.evaluate(async () => {
		const registration = await navigator.serviceWorker.getRegistration('/');
		return Boolean(registration?.active || registration?.waiting || registration?.installing);
	}), {timeout: 15_000, message: 'the production service worker should register'}).toBe(true);

	await page.reload({waitUntil: 'domcontentloaded'});
	await expect.poll(async () => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), {
		timeout: 15_000,
		message: 'the service worker should control the second app load',
	}).toBe(true);

	await context.setOffline(true);
	await page.reload({waitUntil: 'domcontentloaded'});
	await expect(page.getByRole('heading', {name: "You're offline"})).toBeVisible();
	await expect(page.getByTestId('offline-page')).toBeVisible();
});
