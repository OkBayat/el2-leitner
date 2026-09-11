import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';
import { loadConfig } from '../src/config/loadConfig.js';
import { createTestContext } from './helpers/fakes.js';

describe('Capacitor HTTP boundary', () => {
  it('allows credentialed requests only from configured native origins', async () => {
    const { app } = createTestContext({
      CORS_ALLOWED_ORIGINS: 'https://localhost,capacitor://localhost'
    });

    const allowed = await request(app)
      .options('/api/auth/login')
      .set('Origin', 'capacitor://localhost')
      .set('Access-Control-Request-Method', 'POST');
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers['access-control-allow-origin'], 'capacitor://localhost');
    assert.equal(allowed.headers['access-control-allow-credentials'], 'true');

    const rejected = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://attacker.example')
      .send({ email: 'learner@example.com', password: 'password123' });
    assert.equal(rejected.status, 403);
    assert.equal(rejected.body.error.code, 'ORIGIN_NOT_ALLOWED');
    assert.throws(() => loadConfig({ CORS_ALLOWED_ORIGINS: 'https://*.vocora.ir' }), { code: 'INVALID_CONFIGURATION' });
  });

  it('validates mobile release policy and serves it without authentication', async () => {
    const environment = {
      NODE_ENV: 'test',
      MOBILE_ANDROID_LATEST_VERSION: '3.2.0',
      MOBILE_ANDROID_MINIMUM_SUPPORTED_VERSION: '3.1.0',
      MOBILE_ANDROID_STORE_URL: 'https://play.google.com/store/apps/details?id=ir.vocora'
    };
    const config = loadConfig(environment);
    const { app } = createTestContext(environment);
    const response = await request(app).get('/api/mobile/releases/android');

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, config.mobileReleases.android);
    assert.throws(() => loadConfig({
      NODE_ENV: 'test',
      MOBILE_IOS_LATEST_VERSION: '3.2.0',
      MOBILE_IOS_MINIMUM_SUPPORTED_VERSION: '3.1.0',
      MOBILE_IOS_STORE_URL: 'http://apps.apple.com/app/id123'
    }), { code: 'INVALID_CONFIGURATION' });
    assert.throws(() => loadConfig({
      NODE_ENV: 'test',
      MOBILE_IOS_LATEST_VERSION: '3.1.0',
      MOBILE_IOS_MINIMUM_SUPPORTED_VERSION: '3.2.0',
      MOBILE_IOS_STORE_URL: 'https://apps.apple.com/app/id123'
    }), { code: 'INVALID_CONFIGURATION' });
  });
});
