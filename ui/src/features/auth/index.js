import { HttpClient } from '../../shared/http/HttpClient.js';
import { GetCurrentUserQuery, LoginCommand, RegisterCommand } from './application/AuthCommands.js';
import { AuthHttpGateway } from './infrastructure/AuthHttpGateway.js';
import { AuthPage } from './presentation/AuthPage.js';

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

export async function bootAuth(options = {}) {
  const page = createAuthPage(options).mount();
  await page.checkExistingSession();
  return page;
}

if (globalThis.window && globalThis.document) {
  bootAuth().catch((error) => {
    console.error('Could not start the authentication page:', error);
  });
}
