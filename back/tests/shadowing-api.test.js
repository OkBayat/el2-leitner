import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createTestContext } from './helpers/fakes.js';

test('Shadowing endpoints require authentication', async () => {
  const { app } = createTestContext();
  await request(app).post('/api/shadowing/sessions').expect(401);
  await request(app).post('/api/shadowing/sessions/s/recordings/r/chunks?sequence=0').set('Content-Type', 'application/octet-stream').send(Buffer.alloc(16000)).expect(401);
});
test('Shadowing routes preserve audio bytes and authenticated ownership', async () => {
  const { app, container } = createTestContext();
  const learner = request.agent(app);
  const registration = await learner.post('/api/auth/register').send({ email: 'shadowing-api@example.com', password: 'password123' }).expect(201);
  let received;
  container.useCases.shadowingPractice = {
    start: async () => ({ sessionId: 's', cards: [] }),
    chunk: async (...args) => { received = args; return { transcript: 'hello' }; },
  };
  const deck = await learner.post('/api/shadowing/sessions').expect(201);
  assert.equal(deck.headers['cache-control'], 'no-store');
  const audio = Buffer.alloc(16000, 7);
  await learner.post('/api/shadowing/sessions/s/recordings/r/chunks?sequence=2').set('Content-Type', 'application/octet-stream').send(audio).expect(200);
  assert.equal(String(received[0]), String(registration.body.user.id));
  assert.deepEqual(received.slice(1, 4), ['s', 'r', 2]);
  assert.deepEqual(received[4], audio);
});
