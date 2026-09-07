#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { buildGitSnapshot, buildWorkingSnapshot } = require('./lib/repository');
const { validate } = require('./lib/validator');

const VALIDATOR_PATH = '.agents/skills/k2-skill-architecture/scripts/validate-skill-architecture.js';

function parseArguments(argv) {
  const options = { files: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--base' || value === '--head' || value === '--root') {
      options[value.slice(2)] = argv[index + 1];
      index += 1;
    } else if (value === '--files') {
      index += 1;
      while (index < argv.length && !argv[index].startsWith('--')) {
        options.files.push(argv[index]);
        index += 1;
      }
      index -= 1;
    } else if (value === '--help') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  return options;
}

function usage() {
  return [
    'Usage:',
    '  validate-skill-architecture.js --base <sha> --head <sha> [--root <repo>]',
    '  validate-skill-architecture.js --files <path...> [--root <repo>]',
  ].join('\n');
}

function report(result) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function errorResult(error) {
  const message = error && error.message ? error.message : String(error || 'Unknown validator failure.');
  return {
    checked_skills: [],
    next_action: 'fix_skill_architecture',
    ok: false,
    problems: [{
      code: 'validator_execution_error',
      message,
      path: VALIDATOR_PATH,
    }],
    schema_version: 1,
  };
}

function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  const root = path.resolve(options.root || process.cwd());
  let snapshot;
  if (options.files.length) {
    snapshot = buildWorkingSnapshot(root, options.files);
  } else if (options.base && options.head) {
    snapshot = buildGitSnapshot(root, options.base, options.head);
  } else {
    throw new Error(`Choose --files or both --base and --head.\n${usage()}`);
  }
  const result = validate(snapshot);
  report(result);
  return result.ok ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    report(errorResult(error));
    process.exitCode = 2;
  }
}

module.exports = {
  errorResult,
  main,
  parseArguments,
  report,
  usage,
};
