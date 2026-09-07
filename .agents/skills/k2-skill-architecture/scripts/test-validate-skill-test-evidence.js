#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { validate } = require('./lib/validator');

const name = 'k2-example';
const root = `.agents/skills/${name}`;
const skillPath = `${root}/SKILL.md`;
const scriptPath = `${root}/scripts/command.js`;
const testPath = `${root}/scripts/test-command.js`;

const skillDocument = `---
name: ${name}
description: Test skill.
---

## Determinism Boundary

### Script-owned
- Validate.

### Codex-owned
- Evaluate domain semantics.

### No manual fallback
- Do not bypass validation.
`;

function resultFor(changes, options = {}) {
  const files = new Map([
    [skillPath, skillDocument],
    [scriptPath, "'use strict';\nmodule.exports = { run: () => true };\n"],
  ]);
  if (options.includeExistingTest !== false) {
    files.set(testPath, "'use strict';\nassert.equal(run(), true);\n");
  }
  for (const [filePath, source] of Object.entries(options.extraFiles || {})) {
    if (source === null) files.delete(filePath);
    else files.set(filePath, source);
  }
  return validate({
    changes,
    repositoryFiles: new Set(files.keys()),
    skills: new Map([[
      name,
      {
        existedAtBase: true,
        files,
        name,
        root,
      },
    ]]),
  });
}

function deletedSkillResult(changes) {
  return validate({
    changes,
    repositoryFiles: new Set(),
    skills: new Map([[
      name,
      {
        existedAtBase: true,
        files: new Map(),
        name,
        root,
      },
    ]]),
  });
}

function problemCodes(result) {
  return result.problems.map((problem) => problem.code);
}

function modifiedImplementation(options = {}) {
  return {
    basePath: scriptPath,
    baseSource: options.baseSource || "'use strict';\nmodule.exports = { run: () => false };\n",
    path: scriptPath,
    source: options.source || "'use strict';\nmodule.exports = { run: () => true };\n",
    status: 'M',
  };
}

function modifiedTest() {
  return {
    basePath: testPath,
    baseSource: "'use strict';\nassert.equal(run(), false);\n",
    path: testPath,
    source: "'use strict';\nassert.equal(run(), true);\n",
    status: 'M',
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

function testModifiedBehaviorWithoutAnyTestNeedsChangedTest() {
  const result = resultFor(
    [modifiedImplementation()],
    { includeExistingTest: false },
  );
  assert.ok(problemCodes(result).includes('missing_skill_test'));
}

function testUnchangedExistingTestDoesNotSatisfyRule() {
  const result = resultFor([modifiedImplementation()]);
  assert.ok(problemCodes(result).includes('missing_skill_test'));
}

function testModifiedBehaviorWithChangedTestPasses() {
  const result = resultFor([modifiedImplementation(), modifiedTest()]);
  assert.equal(result.ok, true);
}

function testCommentOnlyModificationDoesNotRequireTestChange() {
  const result = resultFor([modifiedImplementation({
    baseSource: "'use strict';\nconst value = 1; // old\n",
    source: "'use strict';\n// new\nconst value = 1;\n",
  })]);
  assert.equal(problemCodes(result).includes('missing_skill_test'), false);
}

function testRenamedScriptNeedsChangedTest() {
  const renamedPath = `${root}/scripts/renamed-command.js`;
  const change = {
    basePath: scriptPath,
    baseSource: "'use strict';\nmodule.exports = { run: () => true };\n",
    path: renamedPath,
    source: "'use strict';\nmodule.exports = { run: () => true };\n",
    status: 'R',
  };
  const result = resultFor([change], {
    extraFiles: {
      [scriptPath]: null,
      [renamedPath]: change.source,
    },
  });
  assert.ok(problemCodes(result).includes('missing_skill_test'));
}

function testCompleteSkillDeletionWithTestDeletionPasses() {
  const result = deletedSkillResult([
    deletedFile(skillPath, skillDocument),
    deletedFile(scriptPath, "'use strict';\nmodule.exports = { run: () => true };\n"),
    deletedFile(testPath, "'use strict';\nassert.equal(run(), true);\n"),
  ]);
  assert.equal(result.ok, true);
}

function testDeletedTestDoesNotCoverModifiedBehavior() {
  const result = resultFor(
    [
      modifiedImplementation(),
      deletedFile(testPath, "'use strict';\nassert.equal(run(), false);\n"),
    ],
    { includeExistingTest: false },
  );
  assert.ok(problemCodes(result).includes('missing_skill_test'));
}

function testModifiedPythonBehaviorRequiresChangedPythonTest() {
  const pythonScript = `${root}/scripts/create_worktree.py`;
  const pythonTest = `${root}/scripts/test_create_worktree.py`;
  const implementation = {
    basePath: pythonScript,
    baseSource: 'VALUE = False\n',
    path: pythonScript,
    source: 'VALUE = True\n',
    status: 'M',
  };
  const withoutChangedTest = resultFor([implementation], {
    extraFiles: {
      [pythonScript]: implementation.source,
      [pythonTest]: 'def test_create():\n    assert True\n',
    },
  });
  assert.ok(problemCodes(withoutChangedTest).includes('missing_skill_test'));

  const changedTest = {
    basePath: pythonTest,
    baseSource: 'def test_create():\n    assert False\n',
    path: pythonTest,
    source: 'def test_create():\n    assert True\n',
    status: 'M',
  };
  const withChangedTest = resultFor([implementation, changedTest], {
    extraFiles: {
      [pythonScript]: implementation.source,
      [pythonTest]: changedTest.source,
    },
  });
  assert.equal(withChangedTest.ok, true);
}

function testPythonCommentOnlyModificationDoesNotRequireTestChange() {
  const pythonScript = `${root}/scripts/create_worktree.py`;
  const change = {
    basePath: pythonScript,
    baseSource: 'VALUE = "# retained"  # old comment\n',
    path: pythonScript,
    source: '# new comment\nVALUE = "# retained"\n',
    status: 'M',
  };
  const result = resultFor([change], {
    extraFiles: { [pythonScript]: change.source },
  });
  assert.equal(problemCodes(result).includes('missing_skill_test'), false);
}

const tests = [
  testModifiedBehaviorWithoutAnyTestNeedsChangedTest,
  testUnchangedExistingTestDoesNotSatisfyRule,
  testModifiedBehaviorWithChangedTestPasses,
  testCommentOnlyModificationDoesNotRequireTestChange,
  testRenamedScriptNeedsChangedTest,
  testCompleteSkillDeletionWithTestDeletionPasses,
  testDeletedTestDoesNotCoverModifiedBehavior,
  testModifiedPythonBehaviorRequiresChangedPythonTest,
  testPythonCommentOnlyModificationDoesNotRequireTestChange,
];

for (const test of tests) test();
process.stdout.write(`PASS ${tests.length} skill test-evidence architecture tests\n`);
