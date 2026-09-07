'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
  SKILLS_ROOT,
  normalize,
  skillNameForPath,
  skillRoot,
} = require('./policy');

const GIT_MAX_BUFFER = 32 * 1024 * 1024;

function git(root, args, options = {}) {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: options.encoding === undefined ? 'utf8' : options.encoding,
      input: options.input,
      maxBuffer: GIT_MAX_BUFFER,
      stdio: ['pipe', 'pipe', options.allowFailure ? 'ignore' : 'pipe'],
    });
  } catch (error) {
    if (options.allowFailure) return null;
    throw error;
  }
}

function readGitFile(root, ref, filePath) {
  return git(root, ['show', `${ref}:${filePath}`], { allowFailure: true });
}

function listGitEntries(root, ref, prefix = null) {
  const args = ['ls-tree', '-r', '-z', ref];
  if (prefix) args.push('--', prefix);
  const output = git(root, args, { allowFailure: true });
  if (!output) return [];
  return output
    .split('\0')
    .filter(Boolean)
    .map((record) => {
      const match = record.match(/^\d+\s+\w+\s+([0-9a-f]+)\t([\s\S]+)$/);
      if (!match) throw new Error(`invalid git tree record: ${record}`);
      return { path: normalize(match[2]), sha: match[1] };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

function readGitEntries(root, entries) {
  if (entries.length === 0) return new Map();
  const input = `${entries.map((entry) => entry.sha).join('\n')}\n`;
  const output = git(root, ['cat-file', '--batch'], { encoding: null, input });
  const files = new Map();
  let offset = 0;
  for (const entry of entries) {
    const headerEnd = output.indexOf(0x0a, offset);
    if (headerEnd === -1) throw new Error(`missing git batch header for ${entry.path}`);
    const header = output.subarray(offset, headerEnd).toString('utf8');
    const size = Number(header.split(' ').at(-1));
    if (!Number.isInteger(size) || size < 0) throw new Error(`invalid git batch size for ${entry.path}`);
    const contentStart = headerEnd + 1;
    const contentEnd = contentStart + size;
    files.set(entry.path, output.subarray(contentStart, contentEnd).toString('utf8'));
    offset = contentEnd + 1;
  }
  return files;
}

function listGitFiles(root, ref, prefix = null) {
  return listGitEntries(root, ref, prefix).map((entry) => entry.path);
}

function listWorkingFiles(root) {
  const output = git(root, ['ls-files', '--cached', '--others', '--exclude-standard'], { allowFailure: true });
  if (!output) return [];
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map(normalize)
    .filter((filePath) => fs.existsSync(path.join(root, filePath)))
    .sort();
}

function workingStatus(root, filePath, exists) {
  const output = git(root, [
    'status', '--porcelain=v1', '--untracked-files=all', '--', filePath,
  ], { allowFailure: true });
  const line = output && output.split(/\r?\n/).find(Boolean);
  if (!line) return exists ? 'I' : 'D';
  const code = line.slice(0, 2);
  if (code === '??' || code.includes('A')) return 'A';
  if (code.includes('D')) return 'D';
  if (code.includes('R')) return 'R';
  return 'M';
}

function changedRecords(root, base, head) {
  const output = git(root, [
    'diff', '--name-status', '--find-renames', `${base}...${head}`, '--', SKILLS_ROOT,
  ]);
  const records = [];
  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    const [rawStatus, first, second] = line.split('\t');
    const status = rawStatus[0];
    const filePath = normalize(status === 'R' ? second : first);
    const previousPath = normalize(status === 'R' ? first : filePath);
    records.push({
      basePath: status === 'A' ? null : previousPath,
      baseSource: status === 'A' ? null : readGitFile(root, base, previousPath),
      path: filePath,
      source: status === 'D' ? null : readGitFile(root, head, filePath),
      status,
    });
  }
  return records;
}

function skillSnapshotFromGit(root, name, base, head) {
  const prefix = skillRoot(name);
  const headEntries = listGitEntries(root, head, prefix);
  const baseEntries = listGitEntries(root, base, prefix);
  return {
    existedAtBase: baseEntries.length > 0,
    files: readGitEntries(root, headEntries),
    name,
    root: prefix,
  };
}

function skillNamesForChanges(changes) {
  const names = new Set();
  for (const change of changes) {
    for (const filePath of [change.path, change.basePath]) {
      const name = filePath && skillNameForPath(filePath);
      if (name) names.add(name);
    }
  }
  return [...names].sort();
}

function buildGitSnapshot(root, base, head) {
  const changes = changedRecords(root, base, head);
  const repositoryFiles = listGitFiles(root, head);
  const names = skillNamesForChanges(changes);
  return {
    changes,
    repositoryFiles: new Set(repositoryFiles),
    skills: new Map(names.map((name) => [name, skillSnapshotFromGit(root, name, base, head)])),
  };
}

function walkFiles(root, directory) {
  if (!fs.existsSync(directory)) return [];
  const pending = [directory];
  const files = [];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(absolute);
      else files.push(normalize(path.relative(root, absolute)));
    }
  }
  return files.sort();
}

function buildWorkingSnapshot(root, requestedPaths) {
  const paths = requestedPaths.map(normalize);
  const changes = paths.map((filePath) => {
    const absolute = path.join(root, filePath);
    const exists = fs.existsSync(absolute);
    const status = workingStatus(root, filePath, exists);
    return {
      basePath: status === 'A' ? null : filePath,
      baseSource: status === 'A' ? null : readGitFile(root, 'HEAD', filePath),
      path: filePath,
      source: exists ? fs.readFileSync(absolute, 'utf8') : null,
      status,
    };
  });
  const repositoryFiles = listWorkingFiles(root);
  const names = skillNamesForChanges(changes);
  const skills = new Map();
  for (const name of names) {
    const skillPath = skillRoot(name);
    const files = walkFiles(root, path.join(root, skillPath));
    skills.set(name, {
      existedAtBase: listGitEntries(root, 'HEAD', skillPath).length > 0,
      files: new Map(files.map((filePath) => [filePath, fs.readFileSync(path.join(root, filePath), 'utf8')])),
      name,
      root: skillPath,
    });
  }
  return {
    changes,
    repositoryFiles: new Set(repositoryFiles),
    skills,
  };
}

module.exports = {
  buildGitSnapshot,
  buildWorkingSnapshot,
  changedRecords,
  git,
  listGitEntries,
  listGitFiles,
  listWorkingFiles,
  readGitEntries,
  readGitFile,
  skillNamesForChanges,
  walkFiles,
  workingStatus,
};
