#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const cli = path.join(__dirname, 'validate-skill-architecture.js');

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: 'utf8',
  });
}

function assertCanonicalFailure(result) {
  assert.equal(result.status, 2);
  assert.equal(result.stderr, '');
  const output = JSON.parse(result.stdout);
  assert.equal(output.schema_version, 1);
  assert.equal(output.ok, false);
  assert.equal(output.next_action, 'fix_skill_architecture');
  assert.deepEqual(output.checked_skills, []);
  assert.equal(output.problems.length, 1);
  assert.equal(output.problems[0].code, 'validator_execution_error');
  assert.equal(
    output.problems[0].path,
    '.agents/skills/k2-skill-architecture/scripts/validate-skill-architecture.js',
  );
  return output;
}

function testInvalidArgumentReturnsJson() {
  const output = assertCanonicalFailure(run(['--unknown']));
  assert.match(output.problems[0].message, /Unknown argument/);
}

function testRepositoryFailureReturnsJson() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'k2-skill-cli-error-'));
  try {
    const output = assertCanonicalFailure(run([
      '--base', 'HEAD',
      '--head', 'HEAD',
      '--root', root,
    ]));
    assert.ok(output.problems[0].message.length > 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const tests = [
  testInvalidArgumentReturnsJson,
  testRepositoryFailureReturnsJson,
];

for (const test of tests) test();
process.stdout.write(`PASS ${tests.length} validator CLI error tests\n`);
