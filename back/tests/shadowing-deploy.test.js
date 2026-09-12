import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

test('deployment builds and starts the speech companion before replacing the app', async t => {
  const root = await mkdtemp(join(tmpdir(), 'vocora-shadowing-deploy-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const log = join(root, 'calls.log');
  await writeFile(join(root, 'docker'), `#!/usr/bin/env bash
echo "$*" >> "$DEPLOY_TEST_LOG"
if [[ "$*" == compose\\ --profile\\ ai\\ exec\\ -T\\ ollama\\ sha256sum* ]]; then echo "0edcdef34593eac1aa2be9c7d06c432dcf81945adca5eca2f27662c18f168ba0  manifest"; exit 0; fi
if [[ "\${FAIL_SPEECH:-}" == 1 && "$*" == "compose up -d --wait speech" ]]; then exit 9; fi
`, { mode: 0o755 });
  const script = new URL('../../scripts/deploy.sh', import.meta.url);
  const env = { ...process.env, PATH: `${root}:${process.env.PATH}`, DEPLOY_TEST_LOG: log };
  assert.equal(spawnSync('bash', [script.pathname], { env }).status, 0);
  const calls = (await readFile(log, 'utf8')).trim().split('\n');
  assert.ok(calls.includes('compose build app'));
  assert.ok(calls.includes('compose build speech'));
  const speech = calls.indexOf('compose up -d --wait speech');
  assert.ok(speech > calls.indexOf('compose run --rm --no-deps db-setup'));
  assert.ok(speech < calls.indexOf('compose up -d --no-deps --wait app'));
  await writeFile(log, '');
  assert.equal(spawnSync('bash', [script.pathname], { env: { ...env, FAIL_SPEECH: '1' } }).status, 9);
  assert.ok(!(await readFile(log, 'utf8')).includes('compose up -d --no-deps --wait app'));
});
