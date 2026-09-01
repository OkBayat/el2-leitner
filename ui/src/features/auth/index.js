import { HttpClient } from '../../shared/http/HttpClient.js';
import { GetCurrentUserQuery, LoginCommand, RegisterCommand } from './application/AuthCommands.js';
import { AuthHttpGateway } from './infrastructure/AuthHttpGateway.js';
import { AuthPage } from './presentation/AuthPage.js';

const MATERIAL_TAGS = ['md-outlined-text-field', 'md-filled-button'];

export function createAuthPage({
  windowObject = globalThis.window,
  documentObject = globalThis.document,
  fetcher = windowObject?.fetch?.bind(windowObject),
  navigate = typeof windowObject?.VazheyarNavigate === 'function'
    ? windowObject.VazheyarNavigate
    : (destination) => windowObject.location.replace(destination)
} = {}) {
  const httpClient = new HttpClient({ fetcher });
  const gateway = new AuthHttpGateway({ httpClient });
  return new AuthPage({
    document: documentObject,
    window: windowObject,
    loginCommand: new LoginCommand({ gateway }),
    registerCommand: new RegisterCommand({ gateway }),
    currentUserQuery: new GetCurrentUserQuery({ gateway }),
    navigate
  });
}

async function waitForMaterial(windowObject) {
  const registry = windowObject?.customElements;
  if (!registry?.whenDefined) return;
  await Promise.all(MATERIAL_TAGS.map((tag) => registry.whenDefined(tag)));
}

export async function bootAuth(options = {}) {
  const windowObject = options.windowObject ?? globalThis.window;
  await waitForMaterial(windowObject);
  const page = createAuthPage({ ...options, windowObject }).mount();
  await page.checkExistingSession();
  return page;
}

if (globalThis.window && globalThis.document) {
  bootAuth().catch((error) => {
    console.error('Could not start the authentication page:', error);
  });
}
