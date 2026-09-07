'use strict';

const path = require('node:path');
const { maskPythonComments } = require('./python-source');

function stripComments(source) {
  let output = '';
  let state = 'code';
  let quote = '';

  for (let index = 0; index < String(source || '').length; index += 1) {
    const current = source[index];
    const next = source[index + 1];

    if (state === 'line-comment') {
      if (current === '\n') {
        output += '\n';
        state = 'code';
      } else {
        output += ' ';
      }
      continue;
    }

    if (state === 'block-comment') {
      if (current === '*' && next === '/') {
        output += '  ';
        index += 1;
        state = 'code';
      } else {
        output += current === '\n' ? '\n' : ' ';
      }
      continue;
    }

    if (state === 'string') {
      output += current;
      if (current === '\\') {
        if (next !== undefined) {
          output += next;
          index += 1;
        }
      } else if (current === quote) {
        state = 'code';
      }
      continue;
    }

    if (current === '/' && next === '/') {
      output += '  ';
      index += 1;
      state = 'line-comment';
    } else if (current === '/' && next === '*') {
      output += '  ';
      index += 1;
      state = 'block-comment';
    } else if (current === '\'' || current === '"' || current === '`') {
      output += current;
      quote = current;
      state = 'string';
    } else {
      output += current;
    }
  }

  return output;
}

function executableShape(source, filePath) {
  const withoutComments = path.posix.extname(filePath || '') === '.py'
    ? maskPythonComments(source)
    : stripComments(source);
  return withoutComments
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

function scriptBehaviorChanged(change) {
  if (['A', 'D', 'R'].includes(change.status)) return true;
  if (change.status !== 'M') return false;
  const filePath = change.path || change.basePath;
  return executableShape(change.baseSource, filePath) !== executableShape(change.source, filePath);
}

module.exports = { scriptBehaviorChanged };
