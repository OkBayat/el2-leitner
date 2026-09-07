#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { buildGitSnapshot, listGitEntries, readGitEntries } = require('./lib/repository');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'k2-skill-large-batch-'));
try {
  const runGit = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  runGit('init', '-q');
  runGit('config', 'user.email', 'test@example.com');
  runGit('config', 'user.name', 'Architecture Test');

  const skillRoot = '.agents/skills/k2-large-fixture';
  const fixturePath = `${skillRoot}/scripts/large-fixture.js`;
  fs.mkdirSync(path.dirname(path.join(root, fixturePath)), { recursive: true });
  fs.writeFileSync(path.join(root, fixturePath), 'x'.repeat(2 * 1024 * 1024));
  runGit('add', '.');
  runGit('commit', '-qm', 'large fixture');
  const head = runGit('rev-parse', 'HEAD').trim();

  const entries = listGitEntries(root, head, skillRoot);
  const files = readGitEntries(root, entries);
  assert.equal(files.get(fixturePath).length, 2 * 1024 * 1024);

  const sharedPath = '.agents/skills/shared/learning-content/references/rule.md';
  fs.mkdirSync(path.dirname(path.join(root, sharedPath)), { recursive: true });
  fs.writeFileSync(path.join(root, sharedPath), '# Rule\n');
  runGit('add', '.');
  runGit('commit', '-qm', 'shared change');
  const sharedHead = runGit('rev-parse', 'HEAD').trim();

  const sharedOnly = buildGitSnapshot(root, head, sharedHead);
  assert.deepEqual([...sharedOnly.skills.keys()], []);
  assert.equal(sharedOnly.changes.length, 1);
  assert.equal(sharedOnly.changes[0].path, sharedPath);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

process.stdout.write('PASS repository batch read and shared-only snapshot\n');
