import { HttpClient } from '../../shared/http/HttpClient.js';
import { GetLeitnerHouseQuery } from './application/GetLeitnerHouse.js';
import { LeitnerHouseHttpGateway } from './infrastructure/LeitnerHouseHttpGateway.js';
import { LeitnerHousePage } from './presentation/LeitnerHousePage.js';

const MATERIAL_TAGS = ['md-outlined-button', 'md-outlined-text-field', 'md-outlined-select', 'md-select-option'];

export function createLeitnerHousePage({
  windowObject = globalThis.window,
  documentObject = globalThis.document,
  fetcher = windowObject?.fetch?.bind(windowObject),
  navigate = (destination) => windowObject.location.assign(destination)
} = {}) {
  const httpClient = new HttpClient({ fetcher });
  const gateway = new LeitnerHouseHttpGateway({ httpClient });
  const getHouseQuery = new GetLeitnerHouseQuery({ gateway });
  return new LeitnerHousePage({
    document: documentObject,
    window: windowObject,
    getHouseQuery,
    navigate
  });
}

async function waitForMaterial(windowObject) {
  const registry = windowObject?.customElements;
  if (!registry?.whenDefined) return;
  await Promise.all(MATERIAL_TAGS.map((tag) => registry.whenDefined(tag)));
}

export async function bootLeitnerHouse(options = {}) {
  const windowObject = options.windowObject ?? globalThis.window;
  await waitForMaterial(windowObject);
  return createLeitnerHousePage({ ...options, windowObject }).mount();
}

if (globalThis.window && globalThis.document) {
  bootLeitnerHouse().catch((error) => {
    console.error('Could not start the Leitner house page:', error);
  });
}
