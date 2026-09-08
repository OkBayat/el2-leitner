#!/usr/bin/env node

import { readFileSync } from 'node:fs';

import { workflowNextAction } from './lib/workflow-next-action.mjs';

const USAGE = 'TASK_DELIVERY_WORKFLOW_USAGE: --input <state.json>';

function parseArgs(args) {
  if (args.length !== 2 || args[0] !== '--input' || !args[1]) {
    throw new Error(USAGE);
  }
  return args[1];
}

try {
  const input = parseArgs(process.argv.slice(2));
  let source;
  try {
    source = readFileSync(input, 'utf8');
  } catch {
    throw new Error('TASK_DELIVERY_STATE_READ_FAILED');
  }
  let state;
  try {
    state = JSON.parse(source);
  } catch {
    throw new Error('TASK_DELIVERY_STATE_JSON_INVALID');
  }
  process.stdout.write(`${JSON.stringify(workflowNextAction(state), null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'TASK_DELIVERY_WORKFLOW_FAILED'}\n`);
  process.exitCode = 1;
}
