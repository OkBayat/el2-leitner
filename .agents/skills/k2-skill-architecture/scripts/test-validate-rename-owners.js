#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { buildGitSnapshot } = require('./lib/repository');
const { validate } = require('./lib/validator');

function skillDocument(name, link = '') {
  const reference = link ? `\nRead [rules](${link}).\n` : '';
  return `---
name: ${name}
description: Test skill.
---
${reference}
## Determinism Boundary

### Script-owned
- Validate.

### Codex-owned
- Evaluate domain semantics.

### No manual fallback
- Do not bypass validation.
`;
}

function temporaryRepository() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'k2-skill-rename-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  git('init', '-q');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Rename Test');
  return { git, root };
}

function testCrossSkillRenameRevalidatesBothOwners() {
  const { git, root } = temporaryRepository();
  const sourceName = 'k2-source';
  const targetName = 'k2-target';
  const skillsRoot = path.join(root, '.agents', 'skills');
  const sourceRoot = path.join(skillsRoot, sourceName);
  const targetRoot = path.join(skillsRoot, targetName);
  const sourceReference = path.posix.join('.agents', 'skills', sourceName, 'references', 'rules.md');
  const targetReference = path.posix.join('.agents', 'skills', targetName, 'references', 'rules.md');
  const sourceDocument = path.posix.join('.agents', 'skills', sourceName, 'SKILL.md');
  fs.mkdirSync(path.join(sourceRoot, 'references'), { recursive: true });
  fs.mkdirSync(path.join(targetRoot, 'references'), { recursive: true });
  fs.writeFileSync(path.join(sourceRoot, 'SKILL.md'), skillDocument(sourceName, 'references/rules.md'));
  fs.writeFileSync(path.join(sourceRoot, 'references/rules.md'), '# Rules\n');
  fs.writeFileSync(path.join(targetRoot, 'SKILL.md'), skillDocument(targetName));
  git('add', '.');
  git('commit', '-qm', 'base');
  const base = git('rev-parse', 'HEAD');

  git('mv', sourceReference, targetReference);
  git('commit', '-qm', 'move reference');
  const head = git('rev-parse', 'HEAD');

  const snapshot = buildGitSnapshot(root, base, head);
  assert.deepEqual([...snapshot.skills.keys()].sort(), [sourceName, targetName]);
  const rename = snapshot.changes.find((change) => change.status === 'R');
  assert.equal(rename.basePath, sourceReference);
  assert.equal(rename.path, targetReference);

  const result = validate(snapshot);
  assert.ok(result.problems.some((problem) => (
    problem.code === 'missing_local_reference'
    && problem.path === sourceDocument
  )));
  fs.rmSync(root, { recursive: true, force: true });
}

const tests = [testCrossSkillRenameRevalidatesBothOwners];
for (const test of tests) test();
process.stdout.write(`PASS ${tests.length} rename-owner architecture tests\n`);
