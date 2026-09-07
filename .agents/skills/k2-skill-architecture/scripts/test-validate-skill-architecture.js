#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
  buildGitSnapshot,
  buildWorkingSnapshot,
  listGitEntries,
  readGitEntries,
} = require('./lib/repository');
const { validate } = require('./lib/validator');

const skillRoot = (name) => `.agents/skills/${name}`;

function skillDocument(name, options = {}) {
  const boundary = options.boundary === false ? '' : `
## Determinism Boundary

### Script-owned
- Validate deterministic structure rules and return machine-readable results.

### Codex-owned
- Evaluate domain ownership when the rule cannot be derived mechanically.

### No manual fallback
- Do not bypass a failed deterministic check by manually declaring success.
`;
  const link = options.link ? `\nRead [the rules](${options.link}) when deeper design guidance is needed.\n` : '';
  return `---\nname: ${name}\ndescription: Test skill.\n---\n\n# ${name}\n${link}${boundary}`;
}

function skillSnapshot(name, files, changes, existedAtBase = false, extraRepositoryFiles = []) {
  return {
    changes,
    repositoryFiles: new Set([...Object.keys(files), ...extraRepositoryFiles]),
    skills: new Map([[
      name,
      {
        existedAtBase,
        files: new Map(Object.entries(files)),
        name,
        root: skillRoot(name),
      },
    ]]),
  };
}

function temporaryGitRepository() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'k2-skill-architecture-'));
  const runGit = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  runGit('init', '-q');
  runGit('config', 'user.email', 'test@example.com');
  runGit('config', 'user.name', 'Architecture Test');
  return { root, runGit };
}

function problemCodes(result) {
  return result.problems.map((problem) => problem.code);
}

function testValidNewSkillPasses() {
  const name = 'k2-example';
  const root = skillRoot(name);
  const files = {
    [`${root}/SKILL.md`]: skillDocument(name, { link: 'references/rules.md' }),
    [`${root}/references/rules.md`]: '# Rules\n',
    [`${root}/scripts/command.js`]: "'use strict';\nmodule.exports = { run: () => true };\n",
    [`${root}/scripts/test-command.js`]: "'use strict';\n",
  };
  const changes = Object.entries(files).map(([filePath, source]) => ({
    baseSource: null, path: filePath, source, status: 'A',
  }));
  const result = validate(skillSnapshot(name, files, changes));
  assert.equal(result.ok, true);
  assert.equal(result.next_action, 'none');
  assert.deepEqual(result.checked_skills, [name]);
}

function testMissingSkillFileFails() {
  const name = 'k2-example';
  const root = skillRoot(name);
  const files = { [`${root}/references/rules.md`]: '# Rules\n' };
  const changes = [{
    baseSource: null,
    path: `${root}/references/rules.md`,
    source: '# Rules\n',
    status: 'A',
  }];
  const result = validate(skillSnapshot(name, files, changes));
  assert.ok(problemCodes(result).includes('missing_skill_file'));
}

function testSkillNameMustMatchDirectory() {
  const name = 'k2-example';
  const root = skillRoot(name);
  const source = skillDocument('k2-other');
  const files = { [`${root}/SKILL.md`]: source };
  const changes = [{ baseSource: null, path: `${root}/SKILL.md`, source, status: 'A' }];
  const result = validate(skillSnapshot(name, files, changes));
  assert.ok(problemCodes(result).includes('skill_name_mismatch'));
}

function testTouchedSkillNeedsDeterminismBoundary() {
  const name = 'k2-example';
  const root = skillRoot(name);
  const source = skillDocument(name, { boundary: false });
  const files = { [`${root}/SKILL.md`]: source };
  const changes = [{ baseSource: 'old', path: `${root}/SKILL.md`, source, status: 'M' }];
  const result = validate(skillSnapshot(name, files, changes, true));
  assert.ok(problemCodes(result).includes('missing_determinism_boundary'));
}

function testExistingSkillChangeRevalidatesBoundary() {
  const name = 'k2-example';
  const root = skillRoot(name);
  const document = skillDocument(name, { boundary: false });
  const script = "'use strict';\nmodule.exports = { changed: true };\n";
  const files = {
    [`${root}/SKILL.md`]: document,
    [`${root}/scripts/command.js`]: script,
  };
  const changes = [{
    baseSource: "'use strict';\nmodule.exports = { changed: false };\n",
    path: `${root}/scripts/command.js`,
    source: script,
    status: 'M',
  }];
  const result = validate(skillSnapshot(name, files, changes, true));
  assert.ok(problemCodes(result).includes('missing_determinism_boundary'));
}

function testBoundaryNeedsAllOwners() {
  const name = 'k2-example';
  const root = skillRoot(name);
  const source = `---\nname: ${name}\ndescription: Test.\n---\n\n## Determinism Boundary\n\n### Script-owned\n- Validate.\n`;
  const files = { [`${root}/SKILL.md`]: source };
  const changes = [{ baseSource: null, path: `${root}/SKILL.md`, source, status: 'A' }];
  const result = validate(skillSnapshot(name, files, changes));
  assert.ok(problemCodes(result).includes('incomplete_determinism_boundary'));
}

function testPrivateSiblingDependencyFails() {
  const name = 'k2-example';
  const root = skillRoot(name);
  const source = `${skillDocument(name)}\nRead ../k2-other/references/private.md.\n`;
  const files = { [`${root}/SKILL.md`]: source };
  const changes = [{ baseSource: null, path: `${root}/SKILL.md`, source, status: 'A' }];
  const result = validate(skillSnapshot(name, files, changes));
  assert.ok(problemCodes(result).includes('private_skill_dependency'));
}

function testPrivateDependencyFixtureInTestIsIgnored() {
  const name = 'k2-example';
  const root = skillRoot(name);
  const document = skillDocument(name);
  const fixture = "const invalid = '../k2-other/references/private.md';\n";
  const files = {
    [`${root}/SKILL.md`]: document,
    [`${root}/scripts/test-fixture.js`]: fixture,
  };
  const changes = [
    { baseSource: null, path: `${root}/SKILL.md`, source: document, status: 'A' },
    { baseSource: null, path: `${root}/scripts/test-fixture.js`, source: fixture, status: 'A' },
  ];
  assert.equal(validate(skillSnapshot(name, files, changes)).ok, true);
}

function testPrivateImportInTestFails() {
  const name = 'k2-example';
  const root = skillRoot(name);
  const document = skillDocument(name);
  const testSource = "const privateRule = require('../../k2-other/scripts/private.js');\n";
  const files = {
    [`${root}/SKILL.md`]: document,
    [`${root}/scripts/test-private.js`]: testSource,
  };
  const changes = [
    { baseSource: null, path: `${root}/SKILL.md`, source: document, status: 'A' },
    { baseSource: null, path: `${root}/scripts/test-private.js`, source: testSource, status: 'A' },
  ];
  const result = validate(skillSnapshot(name, files, changes));
  assert.ok(problemCodes(result).includes('private_skill_dependency'));
}

function testSharedDependencyIsAllowed() {
  const name = 'k2-example';
  const root = skillRoot(name);
  const source = `${skillDocument(name)}\nRead ../shared/learning-content/references/kpi.md.\n`;
  const files = { [`${root}/SKILL.md`]: source };
  const changes = [{ baseSource: null, path: `${root}/SKILL.md`, source, status: 'A' }];
  assert.equal(validate(skillSnapshot(name, files, changes)).ok, true);
}

function testSharedMarkdownReferenceUsesRepositorySnapshot() {
  const name = 'k2-example';
  const root = skillRoot(name);
  const sharedPath = '.agents/skills/shared/learning-content/references/kpi.md';
  const source = skillDocument(name, { link: '../shared/learning-content/references/kpi.md' });
  const files = { [`${root}/SKILL.md`]: source };
  const changes = [{ baseSource: null, path: `${root}/SKILL.md`, source, status: 'A' }];
  const result = validate(skillSnapshot(name, files, changes, false, [sharedPath]));
  assert.equal(result.ok, true);
}

function testFlatSharedAdditionFails() {
  const change = {
    baseSource: null,
    path: '.agents/skills/shared/references/new-rule.md',
    source: '# Rule\n',
    status: 'A',
  };
  const result = validate({ changes: [change], skills: new Map() });
  assert.ok(problemCodes(result).includes('invalid_shared_placement'));
}

function testRenamedFlatSharedAssetFails() {
  const change = {
    baseSource: '# Rule\n',
    path: '.agents/skills/shared/references/renamed-rule.md',
    source: '# Rule\n',
    status: 'R',
  };
  const result = validate({ changes: [change], skills: new Map() });
  assert.ok(problemCodes(result).includes('invalid_shared_placement'));
}

function testGenericSharedDomainsFail() {
  for (const domain of ['common', 'helpers', 'misc', 'utils']) {
    const change = {
      baseSource: null,
      path: `.agents/skills/shared/${domain}/references/rule.md`,
      source: '# Rule\n',
      status: 'A',
    };
    const result = validate({ changes: [change], skills: new Map() });
    assert.ok(problemCodes(result).includes('invalid_shared_placement'));
  }
}

function testSharedDomainPrivateDependencyFails() {
  const change = {
    baseSource: null,
    path: '.agents/skills/shared/learning-content/scripts/check.js',
    source: "const privateRule = require('../../../k2-other/scripts/private.js');\n",
    status: 'A',
  };
  const result = validate({ changes: [change], skills: new Map() });
  assert.ok(problemCodes(result).includes('private_skill_dependency'));
}

function testLegacySharedScriptMayImportSharedDomain() {
  const change = {
    baseSource: "module.exports = {};\n",
    path: '.agents/skills/shared/scripts/legacy.js',
    source: "module.exports = require('../vocabulary-audit/scripts/contract');\n",
    status: 'M',
  };
  const result = validate({ changes: [change], skills: new Map() });
  assert.equal(problemCodes(result).includes('private_skill_dependency'), false);
}

function testDynamicPrivatePathInExecutableFails() {
  const name = 'k2-example';
  const change = {
    baseSource: "'use strict';\n",
    path: `${skillRoot(name)}/scripts/command.js`,
    source: ['const target = path.', "join(__dirname, '../../k2-other/references/rules.md');\n"].join(''),
    status: 'M',
  };
  const files = { [`${skillRoot(name)}/SKILL.md`]: skillDocument(name) };
  assert.ok(problemCodes(validate(skillSnapshot(name, files, [change]))).includes('private_skill_dependency'));
}

function testExecutablePrivatePathFormsFail() {
  const name = 'k2-example';
  const files = { [`${skillRoot(name)}/SKILL.md`]: skillDocument(name) };
  const sources = [
    "fs.readFileSync('../../k2-other/references/rules.md');\n",
    "const rulePath = '../../k2-other/references/rules.md';\n",
    "const ruleUrl = new URL('../../k2-other/references/rules.md', import.meta.url);\n",
    "const rulePath = path.join(__dirname, '..', '..', 'k2-other', 'references', 'rules.md');\n",
    "const rulePath = `${path.join(__dirname, '../../k2-other/references/rules.md')}`;\n",
    "const rulePath = `../../k2-other/references/rules.md`;\n",
    "const rulePath = `${require(`../../k2-other/scripts/run.js`)}`;\n",
    "const rulePath = `${consume(\"}\") || path.join(__dirname, '../../k2-other/references/rules.md')}`;\n",
    "const rulePath = `${consume(/* } */ true) || path.join(__dirname, '../../k2-other/references/rules.md')}`;\n",
    "const rulePath = `${`nested ${path.join(__dirname, '../../k2-other/references/rules.md')}`}`;\n",
    "const rulePath = `${consume(/[}]/) || path.join(__dirname, '../../k2-other/references/rules.md')}`;\n",
    "const rulePath = `${counter++ / divisor || path.join(__dirname, '../../k2-other/references/rules.md')}`;\n",
    "const rulePath = `${void /[}]/ || path.join(__dirname, '../../k2-other/references/rules.md')}`;\n",
    "const rulePath = `${obj.return / divisor || path.join(__dirname, '../../k2-other/references/rules.md')}`;\n",
    "const rulePath = `${of / divisor || path.join(__dirname, '../../k2-other/references/rules.md')}`;\n",
    "const rulePath = `${await / divisor || path.join(__dirname, '../../k2-other/references/rules.md')}`;\n",
    "const rulePath = `${yield / divisor || path.join(__dirname, '../../k2-other/references/rules.md')}`;\n",
    "const rulePath = `${value! / divisor || path.join(__dirname, '../../k2-other/references/rules.md')}`;\n",
    "async function f() { const rulePath = `${await /[}]/ || path.join(__dirname, '../../k2-other/references/rules.md')}`; }\n",
    "function* f() { const rulePath = `${yield /[}]/ || path.join(__dirname, '../../k2-other/references/rules.md')}`; }\n",
    "for (const value of /[}]/) { path.join(__dirname, '../../k2-other/references/rules.md'); }\n",
    "const start = '/*';\nconst rulePath = path.join(__dirname, '../../k2-other/references/rules.md');\nconst end = '*/';\n",
    "const start = /[/*]/;\nconst rulePath = path.join(__dirname, '../../k2-other/references/rules.md');\nconst end = /[*/]/;\n",
    "async function f() { return await /[/*]/ || path.join(__dirname, '../../k2-other/references/rules.md'); }\n",
    "function* f() { return yield /[/*]/ || path.join(__dirname, '../../k2-other/references/rules.md'); }\n",
    "async function f() { return `${await /`/ || path.join(__dirname, '../../k2-other/references/rules.md')}`; }\n",
    "function* f() { return `${yield /`/ || path.join(__dirname, '../../k2-other/references/rules.md')}`; }\n",
    "const rulePath = `${true || // `\npath.join(__dirname, '../../k2-other/references/rules.md')}`;\n",
    "const rulePath = `${true || /* ` */ path.join(__dirname, '../../k2-other/references/rules.md')}`;\n",
    "const re = /`/; require(`../../k2-other/scripts/run.js`);\n",
    "const re = /`/; const rulePath = `../../k2-other/references/rules.md`;\n",
  ];
  for (const source of sources) {
    const change = {
      baseSource: "'use strict';\n",
      path: `${skillRoot(name)}/scripts/command.js`,
      source,
      status: 'M',
    };
    assert.ok(
      problemCodes(validate(skillSnapshot(name, files, [change]))).includes('private_skill_dependency'),
      source,
    );
  }
}

function testRuntimePrivatePathInTestFails() {
  const name = 'k2-example';
  const files = { [`${skillRoot(name)}/SKILL.md`]: skillDocument(name) };
  const change = {
    baseSource: "'use strict';\n",
    path: `${skillRoot(name)}/scripts/test-command.js`,
    source: "fs.readFileSync('../../k2-other/references/rules.md');\n",
    status: 'M',
  };
  assert.ok(problemCodes(validate(skillSnapshot(name, files, [change]))).includes('private_skill_dependency'));
}

function testCommentedPrivatePathsDoNotFail() {
  const name = 'k2-example';
  const files = { [`${skillRoot(name)}/SKILL.md`]: skillDocument(name) };
  const change = {
    baseSource: "'use strict';\n",
    path: `${skillRoot(name)}/scripts/command.js`,
    source: "// path.join(__dirname, '../../k2-other/references/rules.md')\n/* '../../k2-other/references/rules.md' */\n",
    status: 'M',
  };
  assert.equal(
    problemCodes(validate(skillSnapshot(name, files, [change]))).includes('private_skill_dependency'),
    false,
  );
}

function testTemplateRawModuleSpecifierDoesNotFail() {
  const name = 'k2-example';
  const files = { [`${skillRoot(name)}/SKILL.md`]: skillDocument(name) };
  const change = {
    baseSource: "'use strict';\n",
    path: `${skillRoot(name)}/scripts/command.js`,
    source: "const fixture = `example:\nrequire('../../k2-other/scripts/run.js')\n`;\n",
    status: 'M',
  };
  assert.equal(
    problemCodes(validate(skillSnapshot(name, files, [change]))).includes('private_skill_dependency'),
    false,
  );
}

function testNestedTemplateRawModuleSpecifierDoesNotFail() {
  const name = 'k2-example';
  const files = { [`${skillRoot(name)}/SKILL.md`]: skillDocument(name) };
  const change = {
    baseSource: "'use strict';\n",
    path: `${skillRoot(name)}/scripts/command.js`,
    source: "const fixture = `${`require(\"../../k2-other/scripts/run.js\")`}`;\n",
    status: 'M',
  };
  assert.equal(
    problemCodes(validate(skillSnapshot(name, files, [change]))).includes('private_skill_dependency'),
    false,
  );
}

function testTemplateRegexBacktickRawPathDoesNotFail() {
  const name = 'k2-example';
  const files = { [`${skillRoot(name)}/SKILL.md`]: skillDocument(name) };
  const change = {
    baseSource: "'use strict';\n",
    path: `${skillRoot(name)}/scripts/command.js`,
    source: "const fixture = `${consume(/`/)} path.join(__dirname, '../../k2-other/references/rules.md')`;\n",
    status: 'M',
  };
  assert.equal(
    problemCodes(validate(skillSnapshot(name, files, [change]))).includes('private_skill_dependency'),
    false,
  );
}

function testBacktickModuleSpecifiersFail() {
  const name = 'k2-example';
  const files = { [`${skillRoot(name)}/SKILL.md`]: skillDocument(name) };
  for (const source of [
    "require(`../../k2-other/scripts/run.js`);\n",
    "import(`../../k2-other/scripts/run.js`);\n",
  ]) {
    const change = {
      baseSource: "'use strict';\n",
      path: `${skillRoot(name)}/scripts/command.js`,
      source,
      status: 'M',
    };
    assert.ok(problemCodes(validate(skillSnapshot(name, files, [change]))).includes('private_skill_dependency'));
  }
}

function testEmbeddedPrivatePathFixtureInTestPasses() {
  const name = 'k2-example';
  const files = { [`${skillRoot(name)}/SKILL.md`]: skillDocument(name) };
  const change = {
    baseSource: "'use strict';\n",
    path: `${skillRoot(name)}/scripts/test-command.js`,
    source: 'const fixture = "const value = \'../k2-other/references/rules.md\';";\n',
    status: 'M',
  };
  assert.equal(problemCodes(validate(skillSnapshot(name, files, [change]))).includes('private_skill_dependency'), false);
}

function testDomainSharedAdditionPasses() {
  const change = {
    baseSource: null,
    path: '.agents/skills/shared/learning-content/references/new-rule.md',
    source: '# Rule\n',
    status: 'A',
  };
  assert.equal(validate({ changes: [change], skills: new Map() }).ok, true);
}

function testLegacySharedModificationPasses() {
  const change = {
    baseSource: '# Old\n',
    path: '.agents/skills/shared/references/existing-rule.md',
    source: '# Updated\n',
    status: 'M',
  };
  assert.equal(validate({ changes: [change], skills: new Map() }).ok, true);
}

function testNewScriptNeedsTest() {
  const name = 'k2-example';
  const root = skillRoot(name);
  const files = {
    [`${root}/SKILL.md`]: skillDocument(name),
    [`${root}/scripts/command.js`]: "'use strict';\n",
  };
  const changes = Object.entries(files).map(([filePath, source]) => ({
    baseSource: null, path: filePath, source, status: 'A',
  }));
  const result = validate(skillSnapshot(name, files, changes));
  assert.ok(problemCodes(result).includes('missing_skill_test'));
}

function testMissingLocalMarkdownReferenceFails() {
  const name = 'k2-example';
  const root = skillRoot(name);
  const source = skillDocument(name, { link: 'references/missing.md' });
  const files = { [`${root}/SKILL.md`]: source };
  const changes = [{ baseSource: null, path: `${root}/SKILL.md`, source, status: 'A' }];
  const result = validate(skillSnapshot(name, files, changes));
  assert.ok(problemCodes(result).includes('missing_local_reference'));
}

function testDeletedReferenceRevalidatesSkillDocument() {
  const name = 'k2-example';
  const root = skillRoot(name);
  const document = skillDocument(name, { link: 'references/rules.md' });
  const files = { [`${root}/SKILL.md`]: document };
  const changes = [{
    baseSource: '# Rules\n',
    path: `${root}/references/rules.md`,
    source: null,
    status: 'D',
  }];
  const result = validate(skillSnapshot(name, files, changes, true));
  assert.ok(problemCodes(result).includes('missing_local_reference'));
}

function testProblemsAreStable() {
  const changes = [
    {
      baseSource: null,
      path: '.agents/skills/shared/scripts/new.js',
      source: '',
      status: 'A',
    },
    {
      baseSource: null,
      path: '.agents/skills/shared/references/new.md',
      source: '',
      status: 'A',
    },
  ];
  const result = validate({ changes, skills: new Map() });
  assert.deepEqual(
    result.problems.map((problem) => problem.path),
    [...result.problems.map((problem) => problem.path)].sort(),
  );
}

function testGitSnapshotFindsNewSkill() {
  const { root, runGit } = temporaryGitRepository();
  fs.writeFileSync(path.join(root, 'README.md'), 'base\n');
  runGit('add', '.');
  runGit('commit', '-qm', 'base');
  const base = runGit('rev-parse', 'HEAD');

  const name = 'k2-example';
  const directory = path.join(root, skillRoot(name));
  fs.mkdirSync(path.join(directory, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(directory, 'SKILL.md'), skillDocument(name));
  fs.writeFileSync(path.join(directory, 'scripts', 'command.js'), "'use strict';\n");
  fs.writeFileSync(path.join(directory, 'scripts', 'test-command.js'), "'use strict';\n");
  runGit('add', '.');
  runGit('commit', '-qm', 'head');
  const head = runGit('rev-parse', 'HEAD');

  const snapshot = buildGitSnapshot(root, base, head);
  assert.equal(snapshot.skills.get(name).existedAtBase, false);
  assert.equal(validate(snapshot).ok, true);
  fs.rmSync(root, { recursive: true, force: true });
}

function testGitBatchReadsSkillFiles() {
  const { root, runGit } = temporaryGitRepository();
  const name = 'k2-example';
  const directory = path.join(root, skillRoot(name));
  fs.mkdirSync(path.join(directory, 'references'), { recursive: true });
  fs.writeFileSync(path.join(directory, 'SKILL.md'), skillDocument(name));
  fs.writeFileSync(path.join(directory, 'references', 'rules.md'), '# Café rule\n');
  runGit('add', '.');
  runGit('commit', '-qm', 'skill');
  const head = runGit('rev-parse', 'HEAD');

  const entries = listGitEntries(root, head, skillRoot(name));
  const files = readGitEntries(root, entries);
  assert.equal(entries.length, 2);
  assert.equal(files.get(`${skillRoot(name)}/references/rules.md`), '# Café rule\n');
  fs.rmSync(root, { recursive: true, force: true });
}

function testWorkingSnapshotDetectsUntrackedFlatSharedAddition() {
  const { root, runGit } = temporaryGitRepository();
  fs.writeFileSync(path.join(root, 'README.md'), 'base\n');
  runGit('add', '.');
  runGit('commit', '-qm', 'base');

  const filePath = '.agents/skills/shared/references/new-rule.md';
  fs.mkdirSync(path.dirname(path.join(root, filePath)), { recursive: true });
  fs.writeFileSync(path.join(root, filePath), '# Rule\n');
  const snapshot = buildWorkingSnapshot(root, [filePath]);
  assert.equal(snapshot.changes[0].status, 'A');
  assert.ok(problemCodes(validate(snapshot)).includes('invalid_shared_placement'));
  fs.rmSync(root, { recursive: true, force: true });
}

function testWorkingSnapshotDetectsUntestedNewScript() {
  const { root, runGit } = temporaryGitRepository();
  const name = 'k2-example';
  const directory = path.join(root, skillRoot(name));
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'SKILL.md'), skillDocument(name));
  runGit('add', '.');
  runGit('commit', '-qm', 'base');

  const filePath = `${skillRoot(name)}/scripts/command.js`;
  fs.mkdirSync(path.dirname(path.join(root, filePath)), { recursive: true });
  fs.writeFileSync(path.join(root, filePath), "'use strict';\n");
  const snapshot = buildWorkingSnapshot(root, [filePath]);
  assert.equal(snapshot.changes[0].status, 'A');
  assert.ok(problemCodes(validate(snapshot)).includes('missing_skill_test'));
  fs.rmSync(root, { recursive: true, force: true });
}

const tests = [
  testValidNewSkillPasses,
  testMissingSkillFileFails,
  testSkillNameMustMatchDirectory,
  testTouchedSkillNeedsDeterminismBoundary,
  testExistingSkillChangeRevalidatesBoundary,
  testBoundaryNeedsAllOwners,
  testPrivateSiblingDependencyFails,
  testPrivateDependencyFixtureInTestIsIgnored,
  testPrivateImportInTestFails,
  testSharedDependencyIsAllowed,
  testSharedMarkdownReferenceUsesRepositorySnapshot,
  testFlatSharedAdditionFails,
  testRenamedFlatSharedAssetFails,
  testGenericSharedDomainsFail,
  testSharedDomainPrivateDependencyFails,
  testLegacySharedScriptMayImportSharedDomain,
  testDynamicPrivatePathInExecutableFails,
  testExecutablePrivatePathFormsFail,
  testRuntimePrivatePathInTestFails,
  testCommentedPrivatePathsDoNotFail,
  testTemplateRawModuleSpecifierDoesNotFail,
  testNestedTemplateRawModuleSpecifierDoesNotFail,
  testTemplateRegexBacktickRawPathDoesNotFail,
  testBacktickModuleSpecifiersFail,
  testEmbeddedPrivatePathFixtureInTestPasses,
  testDomainSharedAdditionPasses,
  testLegacySharedModificationPasses,
  testNewScriptNeedsTest,
  testMissingLocalMarkdownReferenceFails,
  testDeletedReferenceRevalidatesSkillDocument,
  testProblemsAreStable,
  testGitSnapshotFindsNewSkill,
  testGitBatchReadsSkillFiles,
  testWorkingSnapshotDetectsUntrackedFlatSharedAddition,
  testWorkingSnapshotDetectsUntestedNewScript,
];

for (const test of tests) test();
process.stdout.write(`PASS ${tests.length} skill architecture tests\n`);
