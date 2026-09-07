import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { selectValidationScope } from '../lib/validation-scope.mjs';

const SCRIPT = fileURLToPath(new URL('../validation-scope.mjs', import.meta.url));
const PYTHON_SKILL_TEST = [
  '.agents',
  'skills',
  'k2-worktree-first',
  'scripts',
  'test_create_worktree.py',
].join('/');

function testBehaviorChangesRequireFullSuite() {
  assert.deepEqual(selectValidationScope([
    'back/src/service.js',
    'back/tests/service.test.js',
  ]), {
    validation_scope: 'full',
    full_suite_required: true,
    reason: 'behavior_bearing_changes',
    files: {
      behavior: ['back/src/service.js'],
      documentation: [],
      fixture: [],
      test: ['back/tests/service.test.js'],
    },
  });
}

function testOperationalSkillContractsRequireFullSuite() {
  const result = selectValidationScope([
    '.agents/skills/k2-task-delivery/SKILL.md',
    '.agents/skills/k2-task-delivery/references/workflow.md',
    '.agents/skills/k2-task-delivery/scripts/tests/test-workflow.mjs',
  ]);

  assert.equal(result.validation_scope, 'full');
  assert.deepEqual(result.files.behavior, [
    '.agents/skills/k2-task-delivery/SKILL.md',
    '.agents/skills/k2-task-delivery/references/workflow.md',
  ]);
  assert.deepEqual(result.files.test, [
    '.agents/skills/k2-task-delivery/scripts/tests/test-workflow.mjs',
  ]);
}

function testFocusedOnlyChangesDoNotRequireFullSuite() {
  assert.deepEqual(selectValidationScope([
    'CHANGELOG.md',
    'docs/operator-guide.md',
    'back/tests/service.test.js',
    'back/tests/fixtures/service.json',
  ]), {
    validation_scope: 'focused',
    full_suite_required: false,
    reason: 'focused_only_changes',
    files: {
      behavior: [],
      documentation: ['CHANGELOG.md', 'docs/operator-guide.md'],
      fixture: ['back/tests/fixtures/service.json'],
      test: ['back/tests/service.test.js'],
    },
  });
}

function testVerifiedStructuralExtractionUsesFocusedValidation() {
  assert.deepEqual(selectValidationScope([
    '.agents/skills/k2-task-delivery/scripts/workflow.mjs',
    '.agents/skills/k2-task-delivery/scripts/lib/extracted-phase.mjs',
    '.agents/skills/k2-task-delivery/scripts/tests/test-workflow.mjs',
  ], { changeKind: 'structural_only' }), {
    validation_scope: 'focused',
    full_suite_required: false,
    reason: 'structural_only_changes',
    files: {
      behavior: [
        '.agents/skills/k2-task-delivery/scripts/lib/extracted-phase.mjs',
        '.agents/skills/k2-task-delivery/scripts/workflow.mjs',
      ],
      documentation: [],
      fixture: [],
      test: ['.agents/skills/k2-task-delivery/scripts/tests/test-workflow.mjs'],
    },
  });
}

function testStructuralOverrideRejectsContractChanges() {
  assert.throws(
    () => selectValidationScope([
      '.agents/skills/k2-task-delivery/SKILL.md',
    ], { changeKind: 'structural_only' }),
    /VALIDATION_SCOPE_STRUCTURAL_ONLY_NOT_ALLOWED/,
  );
}

function testNoContentChangesRequireNoTests() {
  assert.deepEqual(selectValidationScope([]), {
    validation_scope: 'none',
    full_suite_required: false,
    reason: 'no_content_changes',
    files: {
      behavior: [],
      documentation: [],
      fixture: [],
      test: [],
    },
  });
}

function testWorkflowAndDependencyChangesFailSafeToFullSuite() {
  const result = selectValidationScope([
    '.github/workflows/validate.yml',
    'package-lock.json',
    'unknown.surface',
  ]);

  assert.equal(result.validation_scope, 'full');
  assert.deepEqual(result.files.behavior, [
    '.github/workflows/validate.yml',
    'package-lock.json',
    'unknown.surface',
  ]);
}

function testBehaviorRootsCannotMasqueradeAsFocusedFiles() {
  const result = selectValidationScope([
    'docs/generate.mjs',
    'docs/README.mjs',
    'back/src/fixtures/runtime-config.json',
    'back/src/README.md',
    'ui/src/app/test-router.ts',
  ]);

  assert.equal(result.validation_scope, 'full');
  assert.deepEqual(result.files.behavior, [
    'back/src/README.md',
    'back/src/fixtures/runtime-config.json',
    'docs/README.mjs',
    'docs/generate.mjs',
    'ui/src/app/test-router.ts',
  ]);
}

function testOperationalRootsCannotMasqueradeAsTestLocations() {
  const result = selectValidationScope([
    '.agents/config/tests/runtime.json',
    '.agents/skills/k2-task-delivery/references/tests/rule.md',
    '.github/workflows/tests/validate.yml',
    '.agents/review/tests/policy.md',
  ]);

  assert.equal(result.validation_scope, 'full');
  assert.deepEqual(result.files.behavior, [
    '.agents/config/tests/runtime.json',
    '.agents/review/tests/policy.md',
    '.agents/skills/k2-task-delivery/references/tests/rule.md',
    '.github/workflows/tests/validate.yml',
  ]);
}

function testKnownSourceTestLocationRemainsFocused() {
  const result = selectValidationScope([
    'ui/src/app/worker/worker.spec.ts',
    'speech/test_server.py',
    PYTHON_SKILL_TEST,
  ]);

  assert.equal(result.validation_scope, 'focused');
  assert.deepEqual(result.files.test, [
    PYTHON_SKILL_TEST,
    'speech/test_server.py',
    'ui/src/app/worker/worker.spec.ts',
  ]);
}

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function write(repo, relativePath, content) {
  const target = join(repo, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function commitAll(repo, message) {
  git(repo, 'add', '.');
  git(repo, 'commit', '-m', message);
  return git(repo, 'rev-parse', 'HEAD');
}

function createRepository() {
  const repo = mkdtempSync(join(tmpdir(), 'vocora-validation-scope-'));
  git(repo, 'init', '--quiet');
  git(repo, 'config', 'user.email', 'tests@example.com');
  git(repo, 'config', 'user.name', 'Vocora Tests');
  write(repo, 'back/src/service.js', 'export const value = 1;\n');
  const base = commitAll(repo, 'base');
  return { base, repo };
}

function runCli(repo, base, head = 'HEAD', extraArgs = []) {
  const result = spawnSync(process.execPath, [SCRIPT, '--base', base, '--head', head, ...extraArgs], {
    cwd: repo,
    encoding: 'utf8',
  });
  return result;
}

function runWorktreeCli(repo, base, extraArgs = []) {
  return spawnSync(process.execPath, [SCRIPT, '--base', base, '--worktree', ...extraArgs], {
    cwd: repo,
    encoding: 'utf8',
  });
}

function testCliAcceptsBoundedStructuralOnlyDeclaration() {
  const { base, repo } = createRepository();
  write(repo, '.agents/skills/k2-task-delivery/scripts/module.mjs', 'export const value = 1;\n');
  commitAll(repo, 'structural extraction');

  const result = runCli(repo, base, 'HEAD', ['--change-kind', 'structural_only']);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.validation_scope, 'focused');
  assert.equal(payload.reason, 'structural_only_changes');
}

function testCliRejectsDuplicateArguments() {
  const { base, repo } = createRepository();
  const result = spawnSync(process.execPath, [
    SCRIPT,
    '--base', base,
    '--head', 'HEAD',
    '--base', 'HEAD',
  ], { cwd: repo, encoding: 'utf8' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /VALIDATION_SCOPE_DUPLICATE_ARGUMENT:base/);
}

function testCliTreatsRenameFromBehaviorToDocsAsFull() {
  const { base, repo } = createRepository();
  mkdirSync(join(repo, 'docs'), { recursive: true });
  git(repo, 'mv', 'back/src/service.js', 'docs/service.md');
  commitAll(repo, 'rename behavior to docs');

  const result = runCli(repo, base);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.validation_scope, 'full');
  assert.deepEqual(payload.changed_files, ['back/src/service.js', 'docs/service.md']);
  assert.deepEqual(payload.files.behavior, ['back/src/service.js']);
}

function testCliTreatsBehaviorDeletionAsFull() {
  const { base, repo } = createRepository();
  git(repo, 'rm', 'back/src/service.js');
  commitAll(repo, 'delete behavior');

  const result = runCli(repo, base);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).validation_scope, 'full');
}

function testCliUsesCommittedDiffAndCanonicalShas() {
  const { base, repo } = createRepository();
  write(repo, 'tests/service.test.ts', 'test("service", () => {});\n');
  const head = commitAll(repo, 'test only');

  const result = runCli(repo, base);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.input_state, 'commit');
  assert.equal(payload.base_sha, base);
  assert.equal(payload.head_sha, head);
  assert.equal(payload.worktree_fingerprint, null);
  assert.equal(payload.validation_scope, 'focused');
  assert.deepEqual(payload.changed_files, ['tests/service.test.ts']);
}

function testCliRejectsDirtyWorktree() {
  const { base, repo } = createRepository();
  write(repo, 'README.md', 'dirty\n');

  const result = runCli(repo, base);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /VALIDATION_SCOPE_DIRTY_WORKTREE/);
}

function testWorktreeModeClassifiesWithoutCommitting() {
  const { base, repo } = createRepository();
  write(repo, 'README.md', 'working tree docs\n');

  const result = runWorktreeCli(repo, base);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.input_state, 'worktree');
  assert.equal(payload.head_sha, base);
  assert.match(payload.worktree_fingerprint, /^sha256:[a-f0-9]{64}$/);
  assert.equal(payload.validation_scope, 'focused');
  assert.deepEqual(payload.changed_files, ['README.md']);
}

function testWorktreeModeFailsSafeForUncommittedBehavior() {
  const { base, repo } = createRepository();
  write(repo, 'back/src/runtime.js', 'export const runtime = true;\n');

  const result = runWorktreeCli(repo, base);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).validation_scope, 'full');
}

function testWorktreeFingerprintChangesWithContent() {
  const { base, repo } = createRepository();
  write(repo, 'README.md', 'first\n');
  const first = JSON.parse(runWorktreeCli(repo, base).stdout);
  write(repo, 'README.md', 'second\n');
  const second = JSON.parse(runWorktreeCli(repo, base).stdout);

  assert.notEqual(first.worktree_fingerprint, second.worktree_fingerprint);
}

function testWorktreeModeSupportsDiffBeyondNodeDefaultBuffer() {
  const { base, repo } = createRepository();
  write(repo, 'back/src/service.js', `${'x'.repeat(2 * 1024 * 1024)}\n`);

  const result = runWorktreeCli(repo, base);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).validation_scope, 'full');
}

function testWorktreeModeRejectsOversizedUntrackedSnapshot() {
  const { base, repo } = createRepository();
  const artifact = join(repo, 'large-untracked.bin');
  writeFileSync(artifact, '');
  truncateSync(artifact, (64 * 1024 * 1024) + 1);

  const result = runWorktreeCli(repo, base);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /VALIDATION_SCOPE_WORKTREE_SNAPSHOT_TOO_LARGE/);
}

function testCliRejectsHeadWithWorktreeMode() {
  const { base, repo } = createRepository();
  const result = runWorktreeCli(repo, base, ['--head', 'HEAD']);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /VALIDATION_SCOPE_INPUT_MODE_CONFLICT/);
}

function testCliRejectsNonAncestorCheckpoint() {
  const { base, repo } = createRepository();
  git(repo, 'checkout', '--quiet', '-b', 'side');
  write(repo, 'side.txt', 'side\n');
  const side = commitAll(repo, 'side');
  git(repo, 'checkout', '--quiet', '--detach', base);
  write(repo, 'main.txt', 'main\n');
  commitAll(repo, 'main');

  const result = runCli(repo, side);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /VALIDATION_SCOPE_BASE_NOT_ANCESTOR/);
}

testBehaviorChangesRequireFullSuite();
testOperationalSkillContractsRequireFullSuite();
testFocusedOnlyChangesDoNotRequireFullSuite();
testVerifiedStructuralExtractionUsesFocusedValidation();
testStructuralOverrideRejectsContractChanges();
testNoContentChangesRequireNoTests();
testWorkflowAndDependencyChangesFailSafeToFullSuite();
testBehaviorRootsCannotMasqueradeAsFocusedFiles();
testOperationalRootsCannotMasqueradeAsTestLocations();
testKnownSourceTestLocationRemainsFocused();
testCliUsesCommittedDiffAndCanonicalShas();
testCliAcceptsBoundedStructuralOnlyDeclaration();
testCliRejectsDuplicateArguments();
testCliTreatsRenameFromBehaviorToDocsAsFull();
testCliTreatsBehaviorDeletionAsFull();
testCliRejectsDirtyWorktree();
testWorktreeModeClassifiesWithoutCommitting();
testWorktreeModeFailsSafeForUncommittedBehavior();
testWorktreeFingerprintChangesWithContent();
testWorktreeModeSupportsDiffBeyondNodeDefaultBuffer();
testWorktreeModeRejectsOversizedUntrackedSnapshot();
testCliRejectsHeadWithWorktreeMode();
testCliRejectsNonAncestorCheckpoint();

process.stdout.write('test-validation-scope: ok\n');
