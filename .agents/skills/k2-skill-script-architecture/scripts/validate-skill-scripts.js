#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { changedRecords, namedRecords, walkSkillScripts } = require('./lib/repository');
const { validate } = require('./lib/validator');

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
    '  validate-skill-scripts.js --base <sha> --head <sha> [--root <repo>]',
    '  validate-skill-scripts.js --files <path...> [--root <repo>]',
  ].join('\n');
}

function report(outcome) {
  for (const result of outcome.results) {
    const before = result.previous
      ? ` (before: ${result.previous.executableLines} lines, ${result.previous.exportCount} exports)`
      : '';
    process.stdout.write(`ARCH ${result.path}: ${result.current.executableLines} lines, `
      + `${result.current.exportCount} exports${before}\n`);
  }
  for (const problem of outcome.problems) {
    process.stderr.write(`ERROR ${problem.code} ${problem.filePath}: ${problem.message}\n`);
  }
  process.stdout.write(outcome.ok ? 'PASS skill-script architecture\n' : 'FAIL skill-script architecture\n');
}

function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  const root = path.resolve(options.root || process.cwd());
  let records;
  if (options.files.length) {
    records = namedRecords(root, options.files);
  } else if (options.base && options.head) {
    records = changedRecords(root, options.base, options.head);
  } else {
    throw new Error(`Choose --files or both --base and --head.\n${usage()}`);
  }
  const outcome = validate(records, walkSkillScripts(root));
  report(outcome);
  return outcome.ok ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
}

module.exports = { main, parseArguments, report, usage };
