#!/usr/bin/env node

import {
  assertAncestor,
  commitChangedFiles,
  resolveCommit,
  workingTreeSnapshot,
  worktreeIsClean,
} from './lib/git-validation-input.mjs';
import { selectValidationScope } from './lib/validation-scope.mjs';

const USAGE = 'VALIDATION_SCOPE_USAGE: --base <commit> (--head <commit> | --worktree) [--change-kind structural_only]';

function fail(code) {
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
}

function parseArgs(args) {
  const values = {};
  for (let index = 0; index < args.length;) {
    const flag = args[index];
    if (flag === '--worktree') {
      if (Object.hasOwn(values, 'worktree')) {
        throw new Error('VALIDATION_SCOPE_DUPLICATE_ARGUMENT:worktree');
      }
      values.worktree = true;
      index += 1;
      continue;
    }
    const value = args[index + 1];
    if (!['--base', '--change-kind', '--head'].includes(flag) || !value) {
      throw new Error(USAGE);
    }
    const key = flag.slice(2);
    if (Object.hasOwn(values, key)) {
      throw new Error(`VALIDATION_SCOPE_DUPLICATE_ARGUMENT:${key}`);
    }
    values[key] = value;
    index += 2;
  }
  if (!values.base || (!values.head && !values.worktree)) {
    throw new Error(USAGE);
  }
  if (values.head && values.worktree) {
    throw new Error('VALIDATION_SCOPE_INPUT_MODE_CONFLICT');
  }
  return values;
}

try {
  const args = parseArgs(process.argv.slice(2));
  const baseSha = resolveCommit(args.base, 'VALIDATION_SCOPE_BASE_INVALID');
  let changed;
  let headSha;
  let inputState;
  let worktreeFingerprint = null;
  if (args.worktree) {
    const snapshot = workingTreeSnapshot(baseSha);
    changed = snapshot.changedFiles;
    headSha = snapshot.headSha;
    inputState = 'worktree';
    worktreeFingerprint = snapshot.fingerprint;
  } else {
    if (!worktreeIsClean()) throw new Error('VALIDATION_SCOPE_DIRTY_WORKTREE');
    headSha = resolveCommit(args.head, 'VALIDATION_SCOPE_HEAD_INVALID');
    assertAncestor(baseSha, headSha);
    changed = commitChangedFiles(baseSha, headSha);
    inputState = 'commit';
  }
  const result = selectValidationScope(changed, { changeKind: args['change-kind'] || 'auto' });
  process.stdout.write(`${JSON.stringify({
    schema_version: 1,
    input_state: inputState,
    base_sha: baseSha,
    head_sha: headSha,
    worktree_fingerprint: worktreeFingerprint,
    changed_files: changed.sort(),
    ...result,
  }, null, 2)}\n`);
} catch (error) {
  fail(error instanceof Error ? error.message : 'VALIDATION_SCOPE_FAILED');
}
