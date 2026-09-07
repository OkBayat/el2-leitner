'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { isSkillScript } = require('./policy');

function git(root, args, options = {}) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', options.allowFailure ? 'ignore' : 'pipe'],
  });
}

function changedRecords(root, base, head) {
  const output = git(root, [
    'diff', '--name-status', '--find-renames', `${base}...${head}`, '--', '.agents/skills',
  ]);
  const records = [];
  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    const [rawStatus, first, second] = line.split('\t');
    const status = rawStatus[0];
    const filePath = status === 'R' ? second : first;
    if (!isSkillScript(filePath) || status === 'D') continue;
    let baseSource = null;
    if (status !== 'A') {
      const basePath = status === 'R' ? first : filePath;
      try {
        baseSource = git(root, ['show', `${base}:${basePath}`], { allowFailure: true });
      } catch {
        baseSource = null;
      }
    }
    records.push({
      baseSource,
      path: filePath,
      source: git(root, ['show', `${head}:${filePath}`]),
      status,
    });
  }
  return records;
}

function namedRecords(root, files) {
  return files.filter(isSkillScript).map((filePath) => ({
    baseSource: null,
    path: filePath,
    source: fs.readFileSync(path.join(root, filePath), 'utf8'),
    status: 'I',
  }));
}

function walkSkillScripts(root) {
  const start = path.join(root, '.agents', 'skills');
  const files = new Map();
  if (!fs.existsSync(start)) return files;
  const pending = [start];
  while (pending.length) {
    const directory = pending.pop();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        pending.push(absolute);
        continue;
      }
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      if (isSkillScript(relative)) files.set(relative, fs.readFileSync(absolute, 'utf8'));
    }
  }
  return files;
}

module.exports = {
  changedRecords,
  git,
  namedRecords,
  walkSkillScripts,
};
