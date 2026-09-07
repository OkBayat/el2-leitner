import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync,
  lstatSync,
  openSync,
  readlinkSync,
  readSync,
} from 'node:fs';

const MAX_GIT_OUTPUT_BYTES = 64 * 1024 * 1024;
const MAX_UNTRACKED_SNAPSHOT_BYTES = 64 * 1024 * 1024;
const UNTRACKED_HASH_CHUNK_BYTES = 64 * 1024;

function gitBuffer(args, failureCode) {
  try {
    return execFileSync('git', args, {
      maxBuffer: MAX_GIT_OUTPUT_BYTES,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    throw new Error(failureCode);
  }
}

function gitText(args, failureCode) {
  return gitBuffer(args, failureCode).toString('utf8').trim();
}

function nulList(buffer) {
  return buffer.toString('utf8').split('\0').filter(Boolean);
}

export function resolveCommit(ref, failureCode) {
  return gitText(['rev-parse', '--verify', `${ref}^{commit}`], failureCode);
}

export function assertAncestor(baseSha, headSha) {
  gitBuffer(
    ['merge-base', '--is-ancestor', baseSha, headSha],
    'VALIDATION_SCOPE_BASE_NOT_ANCESTOR',
  );
}

export function worktreeIsClean() {
  return gitText(
    ['status', '--porcelain=v1', '--untracked-files=all'],
    'VALIDATION_SCOPE_STATUS_FAILED',
  ) === '';
}

export function commitChangedFiles(baseSha, headSha) {
  return nulList(gitBuffer([
    'diff',
    '--name-only',
    '--no-renames',
    '--diff-filter=ACDMRTUXB',
    '-z',
    baseSha,
    headSha,
    '--',
  ], 'VALIDATION_SCOPE_DIFF_FAILED'));
}

function snapshotTooLarge() {
  return new Error('VALIDATION_SCOPE_WORKTREE_SNAPSHOT_TOO_LARGE');
}

function hashUntrackedFile(hash, file, consumedBytes) {
  let stats;
  try {
    stats = lstatSync(file);
    hash.update(file);
    hash.update('\0');
    hash.update(String(stats.mode));
    hash.update('\0');
  } catch {
    throw new Error('VALIDATION_SCOPE_WORKTREE_CHANGED_DURING_SCAN');
  }
  hash.update(String(stats.size));
  hash.update('\0');
  if (stats.isSymbolicLink()) {
    let target;
    try {
      target = Buffer.from(readlinkSync(file));
    } catch {
      throw new Error('VALIDATION_SCOPE_WORKTREE_CHANGED_DURING_SCAN');
    }
    if (consumedBytes + target.length > MAX_UNTRACKED_SNAPSHOT_BYTES) throw snapshotTooLarge();
    hash.update(target);
    hash.update('\0');
    return consumedBytes + target.length;
  }
  if (!stats.isFile()) {
    hash.update('\0');
    return consumedBytes;
  }
  if (consumedBytes + stats.size > MAX_UNTRACKED_SNAPSHOT_BYTES) throw snapshotTooLarge();
  let descriptor;
  let total = consumedBytes;
  try {
    descriptor = openSync(file, 'r');
    const chunk = Buffer.allocUnsafe(UNTRACKED_HASH_CHUNK_BYTES);
    for (;;) {
      const bytesRead = readSync(descriptor, chunk, 0, chunk.length, null);
      if (bytesRead === 0) break;
      total += bytesRead;
      if (total > MAX_UNTRACKED_SNAPSHOT_BYTES) throw snapshotTooLarge();
      hash.update(chunk.subarray(0, bytesRead));
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'VALIDATION_SCOPE_WORKTREE_SNAPSHOT_TOO_LARGE') throw error;
    throw new Error('VALIDATION_SCOPE_WORKTREE_CHANGED_DURING_SCAN');
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  hash.update('\0');
  return total;
}

function scanWorktree(baseSha, headSha) {
  const trackedFiles = nulList(gitBuffer([
    'diff',
    '--name-only',
    '--no-renames',
    '--diff-filter=ACDMRTUXB',
    '-z',
    baseSha,
    '--',
  ], 'VALIDATION_SCOPE_WORKTREE_DIFF_FAILED'));
  const untrackedFiles = nulList(gitBuffer(
    ['ls-files', '--others', '--exclude-standard', '-z'],
    'VALIDATION_SCOPE_UNTRACKED_SCAN_FAILED',
  )).sort();
  const patch = gitBuffer(
    ['diff', '--binary', '--no-ext-diff', '--no-renames', baseSha, '--'],
    'VALIDATION_SCOPE_WORKTREE_DIFF_FAILED',
  );
  const hash = createHash('sha256');
  hash.update(baseSha);
  hash.update('\0');
  hash.update(headSha);
  hash.update('\0');
  hash.update(patch);
  let untrackedBytes = 0;
  for (const file of untrackedFiles) {
    untrackedBytes = hashUntrackedFile(hash, file, untrackedBytes);
  }
  return {
    changedFiles: [...new Set([...trackedFiles, ...untrackedFiles])].sort(),
    fingerprint: `sha256:${hash.digest('hex')}`,
  };
}

export function workingTreeSnapshot(baseSha) {
  const headSha = resolveCommit('HEAD', 'VALIDATION_SCOPE_HEAD_INVALID');
  assertAncestor(baseSha, headSha);
  const first = scanWorktree(baseSha, headSha);
  const second = scanWorktree(baseSha, headSha);
  if (first.fingerprint !== second.fingerprint
    || JSON.stringify(first.changedFiles) !== JSON.stringify(second.changedFiles)
    || resolveCommit('HEAD', 'VALIDATION_SCOPE_HEAD_INVALID') !== headSha) {
    throw new Error('VALIDATION_SCOPE_WORKTREE_CHANGED_DURING_SCAN');
  }
  return { headSha, ...first };
}
