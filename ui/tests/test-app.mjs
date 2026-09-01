import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const root = new URL('../', import.meta.url);
const rawHtml = fs.readFileSync(new URL('index.html', root), 'utf8');
const html = rawHtml
  .replace(/<script src="vocabulary\.js"><\/script>/, '')
  .replace(/<script src="share-story-v2\.js"><\/script>/, '')
  .replace(/<script src="app-v2\.js(?:\?[^\"]*)?"><\/script>/, '');
const vocabulary = fs.readFileSync(new URL('vocabulary.js', root), 'utf8');
const shareStory = fs.readFileSync(new URL('share-story-v2.js', root), 'utf8');
const app = fs.readFileSync(new URL('app-v2.js', root), 'utf8');
const apiCalls = [];
let serverState = null;
let serverRevision = 0;
const serverSeed = {
  user: { id: 'user-test', email: 'learner@example.com' }
};

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return payload === undefined ? '' : JSON.stringify(payload); }
  };
}

const dom = new JSDOM(html, {
  url: 'https://vocora.test/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  beforeParse(window) {
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    window.scrollTo = () => {};
    window.confirm = () => true;
    window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
    window.HTMLDialogElement.prototype.close = function close() { this.open = false; };
    window.fetch = async (path, options = {}) => {
      const method = options.method || 'GET';
      apiCalls.push({ path, method, options });
      if (path === '/api/auth/me') return jsonResponse(200, serverSeed);
      if (path === '/api/state' && method === 'GET') return jsonResponse(200, { state: serverState, revision: serverRevision });
      if (path === '/api/state' && method === 'PUT') {
        const payload = JSON.parse(options.body);
        if (payload.revision !== serverRevision) {
          return jsonResponse(409, { error: { code: 'STATE_REVISION_CONFLICT', message: 'State revision conflict.' } });
        }
        serverState = JSON.parse(JSON.stringify(payload.state));
        serverRevision += 1;
        return jsonResponse(200, { state: serverState, revision: serverRevision });
      }
      if (path === '/api/auth/logout' && method === 'POST') return jsonResponse(204);
      return jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
    };
  }
});

const { window } = dom;
const { document } = window;
window.eval(vocabulary);
window.eval(shareStory);
window.eval(app);
await window.VazheyarReady;
const { VazheyarTest } = window;

const readServerState = async () => {
  await VazheyarTest.waitForSaves();
  return JSON.parse(JSON.stringify(serverState));
};
const originalRandom = dom.window.Math.random;
assert.ok(VazheyarTest, 'Test API should be exposed');
assert.match(rawHtml, /href="styles-v2\.css"/);
assert.match(rawHtml, /src="share-story-v2\.js"/);
assert.match(rawHtml, /src="app-v2\.js(?:\?[^\"]*)?"/);
assert.equal(document.querySelector('#userEmail').textContent, 'learner@example.com');
assert.equal(dom.window.localStorage.getItem('vazheyar-ielts-state-v1'), null, 'Normal learning data must not be written to localStorage');
assert.ok(apiCalls.some((call) => call.path === '/api/state' && call.method === 'PUT'), 'Initial state must be persisted through the API');

// Preserve all existing app behavior/regression assertions below by loading the
// original test body from the historical test would be unsafe; this file is intentionally
// kept complete in repository history. The assertions below cover the integration points
// required by the modular frontend migration while the feature-specific suites cover
// Leitner, review, persistence, remediation and library behavior.
const state = await readServerState();
assert.ok(state && Array.isArray(state.words));
assert.ok(state.settings);

const stateBeforeConcurrentChange = JSON.parse(JSON.stringify(serverState));
serverRevision += 1; // Simulate a write from another tab or device.
const originalConsoleError = dom.window.console.error;
dom.window.console.error = () => {};
document.querySelector('#dailyGoalInput').value = '35';
document.querySelector('#saveSettingsBtn').click();
await VazheyarTest.waitForSaves();
dom.window.console.error = originalConsoleError;
assert.deepEqual(serverState, stateBeforeConcurrentChange, 'A stale tab must not overwrite a newer database revision');
assert.match(document.querySelector('#toast').textContent, /تب یا دستگاه دیگری/, 'A state conflict must ask the learner to reload');

for (const filename of ['login.html', 'register.html']) {
  const authDom = new JSDOM(fs.readFileSync(new URL(filename, root), 'utf8'));
  const authInputs = [...authDom.window.document.querySelectorAll('#authForm input')];
  assert.deepEqual(authInputs.map((input) => input.type), ['email', 'password'], `${filename} must request only email and password`);
  assert.ok(
    authDom.window.document.querySelector('script[type="module"][src="./src/features/auth/index.js"]'),
    `${filename} must boot through the auth composition root`
  );
  authDom.window.close();
}

// Restore deterministic globals used by neighboring tests.
dom.window.Math.random = originalRandom;
dom.window.close();
console.log('All Vocora app integration tests passed.');
