#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { validate } = require('./lib/validator');

const sharedRoot = '.agents/skills/shared/learning-content';
const scriptPath = `${sharedRoot}/scripts/check.js`;
const testPath = `${sharedRoot}/tests/test-check.js`;

function resultFor(changes, repositoryFiles = changes.filter((change) => change.source !== null).map((change) => change.path)) {
  return validate({
    changes,
    repositoryFiles: new Set(repositoryFiles),
    skills: new Map(),
  });
}

function problemCodes(result) {
  return result.problems.map((problem) => problem.code);
}

function implementation(options = {}) {
  const status = options.status || 'A';
  return {
    basePath: status === 'A' ? null : scriptPath,
    baseSource: status === 'A' ? null : (options.baseSource || "'use strict';\nmodule.exports = { check: () => false };\n"),
    path: scriptPath,
    source: options.source || "'use strict';\nmodule.exports = { check: () => true };\n",
    status,
  };
}

function changedTest(status = 'A') {
  return {
    basePath: status === 'A' ? null : testPath,
    baseSource: status === 'A' ? null : "'use strict';\nassert.equal(check(), false);\n",
    path: testPath,
    source: "'use strict';\nassert.equal(check(), true);\n",
    status,
  };
}

function deletedFile(filePath, baseSource) {
  return {
    basePath: filePath,
    baseSource,
    path: filePath,
    source: null,
    status: 'D',
  };
}

function testNewSharedScriptNeedsTest() {
  const result = resultFor([implementation()]);
  assert.ok(problemCodes(result).includes('missing_shared_test'));
}

function testSharedDomainTestChangeSatisfiesRule() {
  const result = resultFor([implementation(), changedTest()]);
  assert.equal(result.ok, true);
}

function testUnchangedExistingTestDoesNotSatisfyRule() {
  const result = resultFor(
    [implementation()],
    [scriptPath, testPath],
  );
  assert.ok(problemCodes(result).includes('missing_shared_test'));
}

function testOtherDomainTestDoesNotSatisfyRule() {
  const script = implementation();
  const otherTest = {
    ...changedTest(),
    path: '.agents/skills/shared/github-review/tests/test-review.js',
  };
  const result = resultFor([script, otherTest]);
  assert.ok(problemCodes(result).includes('missing_shared_test'));
}

function testModifiedSharedBehaviorNeedsTestChange() {
  const result = resultFor([implementation({ status: 'M' })]);
  assert.ok(problemCodes(result).includes('missing_shared_test'));
}

function testModifiedSharedBehaviorWithTestChangePasses() {
  const result = resultFor([
    implementation({ status: 'M' }),
    changedTest('M'),
  ]);
  assert.equal(result.ok, true);
}

function testCommentOnlySharedScriptModificationPasses() {
  const result = resultFor([implementation({
    status: 'M',
    baseSource: "'use strict';\nconst value = 1; // old note\n",
    source: "'use strict';\n// new note\nconst value = 1;\n",
  })]);
  assert.equal(problemCodes(result).includes('missing_shared_test'), false);
}

function testRemovedSharedBehaviorWithRemovedTestPasses() {
  const result = resultFor([
    deletedFile(scriptPath, "'use strict';\nmodule.exports = { check: () => true };\n"),
    deletedFile(testPath, "'use strict';\nassert.equal(check(), true);\n"),
  ]);
  assert.equal(result.ok, true);
}

function testRemovedTestDoesNotCoverModifiedSharedBehavior() {
  const result = resultFor([
    implementation({ status: 'M' }),
    deletedFile(testPath, "'use strict';\nassert.equal(check(), false);\n"),
  ], [scriptPath]);
  assert.ok(problemCodes(result).includes('missing_shared_test'));
}

const tests = [
  testNewSharedScriptNeedsTest,
  testSharedDomainTestChangeSatisfiesRule,
  testUnchangedExistingTestDoesNotSatisfyRule,
  testOtherDomainTestDoesNotSatisfyRule,
  testModifiedSharedBehaviorNeedsTestChange,
  testModifiedSharedBehaviorWithTestChangePasses,
  testCommentOnlySharedScriptModificationPasses,
  testRemovedSharedBehaviorWithRemovedTestPasses,
  testRemovedTestDoesNotCoverModifiedSharedBehavior,
];

for (const test of tests) test();
process.stdout.write(`PASS ${tests.length} shared-domain test architecture tests\n`);
