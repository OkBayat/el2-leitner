#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { buildGraph, findCycles } = require('./lib/dependency-graph');
const { changedRecords } = require('./lib/repository');
const { exportNames, metrics, stripComments } = require('./lib/source-metrics');
const { legacyReductionRequired, validate } = require('./lib/validator');

const skill = ['.agents/skills', 'example', 'scripts'].join('/');
const lines = (count, prefix = 'const value') => Array.from(
  { length: count },
  (_, index) => `${prefix}${index} = ${index};`,
).join('\n');
const exported = (count) => {
  const names = Array.from({ length: count }, (_, index) => `value${index}`);
  return `${names.map((name, index) => `const ${name} = ${index};`).join('\n')}\nmodule.exports = { ${names.join(', ')} };`;
};

function outcome(records, files = new Map(records.map((record) => [record.path, record.source]))) {
  return validate(records, files);
}

function codes(result) {
  return result.problems.map((problem) => problem.code);
}

function testMetrics() {
  const source = `// ignored\nconst url = "https://example.com";\n/* ignored */\nmodule.exports = { url };`;
  assert.equal(stripComments(source).includes('ignored'), false);
  assert.equal(metrics(source).executableLines, 2);
  assert.deepEqual(exportNames(source), ['url']);
  assert.deepEqual(
    exportNames('const alpha = 1; const beta = 2; module.exports = { alpha, nested: { ok: true }, beta };'),
    ['alpha', 'beta', 'nested'],
  );
  const markdownSource = [
    'const marker = value.replace(/[`*_]/g, "");',
    'return [',
    '  `# Proposal ${issue.number}`,',
    '  "",',
    '  "This does not update `.agents/memory/**`, or change behavior.",',
    '  "## Next",',
    '];',
  ].join('\n');
  assert.match(stripComments(markdownSource), /## Next/);
  assert.match(stripComments(markdownSource), /\/\[`\*_\]\/g/);
  for (const postfix of ['++', '--']) {
    const divisionSource = [
      'let total = 2;',
      `const ratio = total${postfix} / count;`,
      '// comment only',
      'module.exports = { ratio };',
    ].join('\n');
    assert.equal(stripComments(divisionSource).includes('comment only'), false);
    assert.equal(metrics(divisionSource).executableLines, 3);
  }
}

function testNewOversizedFileFails() {
  const result = outcome([{ path: `${skill}/feature.js`, source: lines(501), status: 'A', baseSource: null }]);
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes('FILE_TOO_LARGE'));
}

function testLargeTestUsesTestLimit() {
  const result = outcome([{ path: `${skill}/test-feature.js`, source: lines(650), status: 'A', baseSource: null }]);
  assert.equal(result.ok, true);
}

function testFacadeExportLimit() {
  const result = outcome([{ path: `${skill}/command.js`, source: exported(9), status: 'A', baseSource: null }]);
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes('EXPORT_SURFACE_TOO_LARGE'));
}

function testUnboundedExportFails() {
  const result = outcome([{
    path: `${skill}/feature.js`, source: 'module.exports = { ...require("./internal") };', status: 'A', baseSource: null,
  }]);
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes('UNBOUNDED_EXPORT_SURFACE'));
}

function testDocumentationOnlyLegacyEditPasses() {
  const body = lines(550);
  const result = outcome([{
    path: `${skill}/legacy.js`,
    baseSource: `// old note\n${body}`,
    source: `// clearer note\n${body}`,
    status: 'M',
  }]);
  assert.equal(result.ok, true);
}

function testLegacyBehaviorNeedsSplit() {
  const previous = lines(550);
  const result = outcome([{
    path: `${skill}/legacy.js`, baseSource: previous, source: `${previous}\nconst added = true;`, status: 'M',
  }]);
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes('LEGACY_SPLIT_REQUIRED'));
  assert.ok(codes(result).includes('LEGACY_LINE_REDUCTION_REQUIRED'));
}

function testLegacySplitPasses() {
  const previous = lines(550);
  const records = [
    { path: `${skill}/legacy.js`, baseSource: previous, source: lines(495), status: 'M' },
    { path: `${skill}/lib/extracted.js`, baseSource: null, source: lines(55), status: 'A' },
  ];
  assert.equal(legacyReductionRequired(550), 55);
  assert.equal(outcome(records).ok, true);
}

function testLegacySharedSplitIntoDomainPasses() {
  const records = [
    {
      path: '.agents/skills/shared/scripts/legacy.js',
      baseSource: lines(550),
      source: `${lines(494)}\nrequire('../vocabulary-audit/scripts/extracted');`,
      status: 'M',
    },
    {
      path: '.agents/skills/shared/vocabulary-audit/scripts/extracted.js',
      baseSource: null,
      source: lines(55),
      status: 'A',
    },
  ];
  assert.equal(outcome(records).ok, true);
}

function testUnrelatedSharedDomainDoesNotSatisfyLegacySplit() {
  const records = [
    {
      path: '.agents/skills/shared/scripts/legacy.js',
      baseSource: lines(550),
      source: `${lines(494)}\nrequire('../vocabulary-audit/scripts/extracted');`,
      status: 'M',
    },
    {
      path: '.agents/skills/shared/listening-content/scripts/extracted.js',
      baseSource: null,
      source: lines(55),
      status: 'A',
    },
  ];
  assert.ok(codes(outcome(records)).includes('LEGACY_SPLIT_REQUIRED'));
}

function testSharedDomainScriptLimitsApply() {
  const result = outcome([{
    path: '.agents/skills/shared/vocabulary-audit/scripts/oversized.js',
    baseSource: null,
    source: lines(501),
    status: 'A',
  }]);
  assert.ok(codes(result).includes('FILE_TOO_LARGE'));
}

function testLegacyExportsMustShrink() {
  const records = [
    { path: `${skill}/legacy.js`, baseSource: exported(13), source: exported(13), status: 'M' },
    { path: `${skill}/lib/extracted.js`, baseSource: null, source: 'module.exports = { extracted: true };', status: 'A' },
  ];
  records[0].source += '\nconst behaviorChange = true;';
  const result = outcome(records);
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes('LEGACY_EXPORT_REDUCTION_REQUIRED'));
}

function testGeneratedFileIsExempt() {
  const result = outcome([{
    path: `${skill}/generated.js`, baseSource: null, source: `// @generated\n${lines(900)}`, status: 'A',
  }]);
  assert.equal(result.ok, true);
}

function testCycleFails() {
  const records = [
    { path: `${skill}/a.js`, baseSource: null, source: "require('./b');", status: 'A' },
    { path: `${skill}/b.js`, baseSource: null, source: "require('./a');", status: 'A' },
  ];
  const result = outcome(records);
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes('DEPENDENCY_CYCLE'));
  assert.equal(findCycles(buildGraph(new Map(records.map((record) => [record.path, record.source])))).length, 1);
}

function testGitChangedRecords() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'k2-skill-architecture-'));
  const scriptDirectory = path.join(root, skill);
  fs.mkdirSync(scriptDirectory, { recursive: true });
  const runGit = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  runGit('init', '-q');
  runGit('config', 'user.email', 'test@example.com');
  runGit('config', 'user.name', 'Architecture Test');
  fs.writeFileSync(path.join(scriptDirectory, 'feature.js'), 'module.exports = { value: 1 };\n');
  runGit('add', '.');
  runGit('commit', '-qm', 'base');
  const base = runGit('rev-parse', 'HEAD');
  fs.writeFileSync(path.join(scriptDirectory, 'feature.js'), 'module.exports = { value: 2 };\n');
  runGit('add', '.');
  runGit('commit', '-qm', 'head');
  const head = runGit('rev-parse', 'HEAD');
  const records = changedRecords(root, base, head);
  assert.equal(records.length, 1);
  assert.equal(records[0].status, 'M');
  assert.match(records[0].baseSource, /value: 1/);
  assert.match(records[0].source, /value: 2/);
  fs.rmSync(root, { recursive: true, force: true });
}

const tests = [
  testMetrics,
  testNewOversizedFileFails,
  testLargeTestUsesTestLimit,
  testFacadeExportLimit,
  testUnboundedExportFails,
  testDocumentationOnlyLegacyEditPasses,
  testLegacyBehaviorNeedsSplit,
  testLegacySplitPasses,
  testLegacySharedSplitIntoDomainPasses,
  testUnrelatedSharedDomainDoesNotSatisfyLegacySplit,
  testSharedDomainScriptLimitsApply,
  testLegacyExportsMustShrink,
  testGeneratedFileIsExempt,
  testCycleFails,
  testGitChangedRecords,
];

for (const test of tests) test();
process.stdout.write(`PASS ${tests.length} skill-script architecture tests\n`);
