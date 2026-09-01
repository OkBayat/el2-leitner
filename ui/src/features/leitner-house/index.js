import { HttpClient } from '../../shared/http/HttpClient.js';
import { GetLeitnerHouseQuery } from './application/GetLeitnerHouse.js';
import { LeitnerHouseHttpGateway } from './infrastructure/LeitnerHouseHttpGateway.js';
import { LeitnerHousePage } from './presentation/LeitnerHousePage.js';

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

export function bootLeitnerHouse(options = {}) {
  return createLeitnerHousePage(options).mount();
}

if (globalThis.window && globalThis.document) {
  bootLeitnerHouse().catch((error) => {
    console.error('Could not start the Leitner house page:', error);
  });
}
