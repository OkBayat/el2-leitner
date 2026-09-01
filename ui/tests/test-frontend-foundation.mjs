import assert from 'node:assert/strict';

import { ApiError, HttpClient } from '../src/shared/http/HttpClient.js';
import { resolveSafeReturnTo } from '../src/shared/navigation/SafeReturnTo.js';
import { GetCurrentUserQuery, LoginCommand, RegisterCommand } from '../src/features/auth/application/AuthCommands.js';
import { AuthHttpGateway } from '../src/features/auth/infrastructure/AuthHttpGateway.js';
import { GetLeitnerHouseQuery, filterAndSortWords } from '../src/features/leitner-house/application/GetLeitnerHouse.js';
import { parseLeitnerHouse } from '../src/features/leitner-house/domain/LeitnerHouse.js';
import { LeitnerHouseHttpGateway } from '../src/features/leitner-house/infrastructure/LeitnerHouseHttpGateway.js';
import { formatRelativeDue } from '../src/features/leitner-house/presentation/LeitnerHousePage.js';

function response(status, payload = null) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return payload === null ? '' : JSON.stringify(payload); }
  };
}

{
  const calls = [];
  const client = new HttpClient({
    fetcher: async (path, options) => {
      calls.push({ path, options });
      return response(200, { ok: true });
    }
  });

  assert.deepEqual(await client.get('/api/example'), { ok: true });
  await client.post('/api/example', { answer: 42 });
  assert.equal(calls[0].options.credentials, 'include');
  assert.equal(calls[0].options.headers.Accept, 'application/json');
  assert.equal(calls[1].options.headers['Content-Type'], 'application/json');
  assert.equal(calls[1].options.body, JSON.stringify({ answer: 42 }));
}

{
  const client = new HttpClient({
    fetcher: async () => response(409, { error: { code: 'CONFLICT', message: 'Conflict' } })
  });
  await assert.rejects(
    client.get('/api/example'),
    (error) => error instanceof ApiError && error.status === 409 && error.code === 'CONFLICT'
  );
}

assert.equal(resolveSafeReturnTo({ search: '?returnTo=%2Fapp%23reports', origin: 'https://vocora.test' }), '/app#reports');
assert.equal(resolveSafeReturnTo({ search: '?returnTo=https%3A%2F%2Fevil.test', origin: 'https://vocora.test' }), 'index.html');
assert.equal(resolveSafeReturnTo({ search: '?returnTo=%2F%5Cevil.test%2Fsteal', origin: 'https://vocora.test' }), 'index.html');
assert.equal(resolveSafeReturnTo({ search: '', origin: 'https://vocora.test' }), 'index.html');

{
  const calls = [];
  const gateway = {
    async login(credentials) { calls.push(['login', credentials]); return { user: { id: 1 } }; },
    async register(credentials) { calls.push(['register', credentials]); return { user: { id: 2 } }; },
    async currentUser() { calls.push(['current']); return { user: { id: 3 } }; }
  };
  const login = new LoginCommand({ gateway });
  const register = new RegisterCommand({ gateway });
  const current = new GetCurrentUserQuery({ gateway });

  assert.deepEqual(await login.execute({ email: ' USER@example.COM ', password: 'correct-password' }), { user: { id: 1 } });
  assert.deepEqual(await register.execute({ email: ' NEW@example.COM ', password: 'long-enough' }), { user: { id: 2 } });
  assert.deepEqual(await current.execute(), { user: { id: 3 } });
  assert.deepEqual(calls, [
    ['login', { email: 'user@example.com', password: 'correct-password' }],
    ['register', { email: 'new@example.com', password: 'long-enough' }],
    ['current']
  ]);

  assert.throws(
    () => register.execute({ email: 'new@example.com', password: 'short' }),
    (error) => error.code === 'INVALID_PASSWORD_LENGTH'
  );
}

{
  const calls = [];
  const httpClient = {
    get(path) { calls.push(['get', path]); return Promise.resolve({ user: { id: 1 } }); },
    post(path, body) { calls.push(['post', path, body]); return Promise.resolve({ user: { id: 1 } }); }
  };
  const gateway = new AuthHttpGateway({ httpClient });
  await gateway.currentUser();
  await gateway.login({ email: 'a@example.com', password: 'password' });
  await gateway.register({ email: 'b@example.com', password: 'password' });
  assert.deepEqual(calls, [
    ['get', '/api/auth/me'],
    ['post', '/api/auth/login', { email: 'a@example.com', password: 'password' }],
    ['post', '/api/auth/register', { email: 'b@example.com', password: 'password' }]
  ]);
}

assert.equal(parseLeitnerHouse('1'), 1);
assert.equal(parseLeitnerHouse(5), 5);
assert.equal(parseLeitnerHouse('0'), null);
assert.equal(parseLeitnerHouse('x'), null);
assert.equal(formatRelativeDue('2026-09-01', '2026-09-01'), 'امروز');
assert.equal(formatRelativeDue('2026-09-02', '2026-09-01'), 'فردا');
assert.equal(formatRelativeDue('2026-08-31', '2026-09-01'), 'عقب‌افتاده');

const sourceWords = [
  { id: 'a', term: 'facilities', category: 'General', lessons: ['Unit 3'], mistakes: 14, due: '2026-09-01' },
  { id: 'b', term: 'Spacious', category: 'Home', mistakes: 2, due: '2026-09-05' },
  { id: 'c', term: 'etiquette', category: 'Social', mistakes: 9, due: null }
];
assert.deepEqual(filterAndSortWords(sourceWords, { search: 'home', sort: 'mistakes' }).map((word) => word.id), ['b']);
assert.deepEqual(filterAndSortWords(sourceWords, { sort: 'mistakes' }).map((word) => word.id), ['a', 'c', 'b']);
assert.deepEqual(filterAndSortWords(sourceWords, { sort: 'due' }).map((word) => word.id), ['a', 'b', 'c']);

{
  const calls = [];
  const gateway = {
    async getHouse(house) {
      calls.push(house);
      return { house: { number: house }, summary: { totalWords: 0 }, words: [] };
    }
  };
  const query = new GetLeitnerHouseQuery({ gateway });
  assert.deepEqual(await query.execute('2'), { house: { number: 2 }, summary: { totalWords: 0 }, words: [] });
  assert.deepEqual(calls, [2]);
  assert.throws(() => query.execute('9'), (error) => error.code === 'INVALID_LEITNER_HOUSE');
}

{
  const calls = [];
  const gateway = new LeitnerHouseHttpGateway({
    httpClient: {
      get(path) {
        calls.push(path);
        return Promise.resolve({ house: { number: 4 }, words: [] });
      }
    }
  });
  assert.deepEqual(await gateway.getHouse(4), { house: { number: 4 }, words: [] });
  assert.deepEqual(calls, ['/api/learning/boxes/4']);
}

console.log('Frontend foundation behavior tests passed.');
