'use strict';

const { buildGraph, findCycles } = require('./dependency-graph');
const {
  LEGACY_MINIMUM_REDUCTION_LINES,
  LEGACY_MINIMUM_REDUCTION_RATIO,
  isTestFile,
  limitsFor,
  skillScriptsRoot,
  staticallyImports,
} = require('./policy');
const { metrics } = require('./source-metrics');

function issue(code, filePath, message) {
  return { code, filePath, message };
}

function legacyReductionRequired(lines) {
  return Math.max(LEGACY_MINIMUM_REDUCTION_LINES, Math.ceil(lines * LEGACY_MINIMUM_REDUCTION_RATIO));
}

function validateRecord(record, records) {
  const problems = [];
  const current = metrics(record.source);
  const limits = limitsFor(record.path);
  const result = { current, path: record.path, previous: null, status: record.status };
  if (current.generated) return { problems, result };
  if (current.hasUnboundedExport) {
    problems.push(issue('UNBOUNDED_EXPORT_SURFACE', record.path,
      'Export-star and object-spread exports are not allowed in skill scripts.'));
  }

  if (!record.baseSource || record.status === 'A' || record.status === 'I') {
    if (current.executableLines > limits.lineLimit) {
      problems.push(issue('FILE_TOO_LARGE', record.path,
        `${current.executableLines} executable lines exceed the ${limits.lineLimit}-line limit.`));
    }
    if (!isTestFile(record.path) && current.exportCount > limits.exportLimit) {
      problems.push(issue('EXPORT_SURFACE_TOO_LARGE', record.path,
        `${current.exportCount} exports exceed the ${limits.exportLimit}-export limit.`));
    }
    return { problems, result };
  }

  const previous = metrics(record.baseSource);
  result.previous = previous;
  if (previous.generated || previous.shape === current.shape) return { problems, result };

  const lineLegacy = previous.executableLines > limits.lineLimit;
  const exportLegacy = !isTestFile(record.path) && previous.exportCount > limits.exportLimit;
  if (!lineLegacy && current.executableLines > limits.lineLimit) {
    problems.push(issue('FILE_GREW_PAST_LIMIT', record.path,
      `${previous.executableLines} executable lines grew to ${current.executableLines}; limit is ${limits.lineLimit}.`));
  }
  if (!exportLegacy && !isTestFile(record.path) && current.exportCount > limits.exportLimit) {
    problems.push(issue('EXPORTS_GREW_PAST_LIMIT', record.path,
      `${previous.exportCount} exports grew to ${current.exportCount}; limit is ${limits.exportLimit}.`));
  }

  if (lineLegacy || exportLegacy) {
    const recordRoot = skillScriptsRoot(record.path);
    const addedSibling = records.some((candidate) => {
      if (candidate.status !== 'A' || isTestFile(candidate.path) || candidate.path === record.path) return false;
      const candidateRoot = skillScriptsRoot(candidate.path);
      if (candidateRoot === recordRoot) return true;
      return recordRoot === '.agents/skills/shared/scripts'
        && /^\.agents\/skills\/shared\/[^/]+\/scripts$/.test(candidateRoot || '')
        && staticallyImports(record.source, record.path, candidate.path);
    });
    if (!addedSibling) {
      problems.push(issue('LEGACY_SPLIT_REQUIRED', record.path,
        'Behavior changed in a legacy-oversized module without adding a sibling implementation module.'));
    }
  }

  if (lineLegacy) {
    const required = legacyReductionRequired(previous.executableLines);
    const reduction = previous.executableLines - current.executableLines;
    if (reduction < required) {
      problems.push(issue('LEGACY_LINE_REDUCTION_REQUIRED', record.path,
        `Reduce by at least ${required} executable lines; observed reduction is ${reduction}.`));
    }
  }

  if (exportLegacy && current.exportCount >= previous.exportCount) {
    problems.push(issue('LEGACY_EXPORT_REDUCTION_REQUIRED', record.path,
      `Reduce the legacy export surface below ${previous.exportCount}; current count is ${current.exportCount}.`));
  }

  return { problems, result };
}

function validate(records, allFiles = new Map()) {
  const problems = [];
  const results = [];
  for (const record of records) {
    const checked = validateRecord(record, records);
    problems.push(...checked.problems);
    results.push(checked.result);
  }

  const changedPaths = new Set(records.map((record) => record.path));
  for (const cycle of findCycles(buildGraph(allFiles))) {
    if (!cycle.some((filePath) => changedPaths.has(filePath))) continue;
    problems.push(issue('DEPENDENCY_CYCLE', cycle[0], cycle.join(' -> ')));
  }
  return { ok: problems.length === 0, problems, results };
}

module.exports = {
  legacyReductionRequired,
  validate,
  validateRecord,
};
