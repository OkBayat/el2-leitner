'use strict';

const path = require('node:path');
const {
  isExecutableFile,
  isExecutableScript,
  isTestFile,
  localMarkdownLinks,
  privateExecutableDependencies,
  privateSkillDependencies,
} = require('./policy');
const { scriptBehaviorChanged } = require('./script-change');
const {
  isInvalidSharedPlacement,
  isSharedPath,
  sharedDomainRoot,
} = require('./shared-domain');
const { determinismBoundary, skillName } = require('./skill-document');

function issue(code, filePath, message) {
  return { code, message, path: filePath };
}

function validateSkillDocument(skill, repositoryFiles = new Set(skill.files.keys())) {
  const problems = [];
  if (skill.files.size === 0) return problems;
  const documentPath = `${skill.root}/SKILL.md`;
  const source = skill.files.get(documentPath);
  if (source === undefined) {
    problems.push(issue(
      'missing_skill_file',
      skill.root,
      'A skill directory must contain SKILL.md at its root.',
    ));
    return problems;
  }

  const declaredName = skillName(source);
  if (declaredName !== skill.name) {
    problems.push(issue(
      'skill_name_mismatch',
      documentPath,
      `SKILL.md name must be ${skill.name}; found ${declaredName || 'missing'}.`,
    ));
  }

  const boundary = determinismBoundary(source);
  if (!boundary.exists) {
    problems.push(issue(
      'missing_determinism_boundary',
      documentPath,
      'SKILL.md must define a Determinism Boundary.',
    ));
  } else if (!boundary.complete) {
    problems.push(issue(
      'incomplete_determinism_boundary',
      documentPath,
      `Determinism Boundary is missing: ${boundary.missing.join(', ')}.`,
    ));
  }

  for (const target of localMarkdownLinks(source)) {
    const resolved = path.posix.normalize(path.posix.join(skill.root, target));
    if (!repositoryFiles.has(resolved)) {
      problems.push(issue(
        'missing_local_reference',
        documentPath,
        `Local Markdown reference does not exist: ${target}.`,
      ));
    }
  }
  return problems;
}

function pathBelongsTo(root, filePath) {
  return Boolean(filePath) && (filePath === root || filePath.startsWith(`${root}/`));
}

function implementationSides(change, root) {
  const previousPath = change.basePath || (change.status === 'A' ? null : change.path);
  return {
    current: change.source !== null
      && pathBelongsTo(root, change.path)
      && isExecutableScript(change.path)
      && !isTestFile(change.path),
    previous: change.baseSource !== null
      && pathBelongsTo(root, previousPath)
      && isExecutableScript(previousPath)
      && !isTestFile(previousPath),
  };
}

function implementationBehaviorChanged(change, root) {
  if (!scriptBehaviorChanged(change)) return false;
  const sides = implementationSides(change, root);
  return sides.current || sides.previous;
}

function implementationRemoved(change, root) {
  if (!scriptBehaviorChanged(change)) return false;
  const sides = implementationSides(change, root);
  return sides.previous && !sides.current;
}

function changedTestEvidence(change, root, executablePredicate, allowRemoved) {
  if (!scriptBehaviorChanged(change)) return false;
  const previousPath = change.basePath || (change.status === 'A' ? null : change.path);
  const currentTest = change.source !== null
    && pathBelongsTo(root, change.path)
    && executablePredicate(change.path)
    && isTestFile(change.path);
  const previousTest = change.baseSource !== null
    && pathBelongsTo(root, previousPath)
    && executablePredicate(previousPath)
    && isTestFile(previousPath);
  return currentTest || (allowRemoved && previousTest && !currentTest);
}

function validateSkillTests(skill, changes) {
  const implementationChanges = changes.filter((change) => implementationBehaviorChanged(change, skill.root));
  if (implementationChanges.length === 0) return [];
  const allowRemoved = implementationChanges.every((change) => implementationRemoved(change, skill.root));
  const hasChangedTest = changes.some((change) => (
    changedTestEvidence(change, skill.root, isExecutableScript, allowRemoved)
  ));
  return hasChangedTest ? [] : [issue(
    'missing_skill_test',
    `${skill.root}/scripts`,
    'Executable behavior changes must include focused test changes in the same skill.',
  )];
}

function sharedRootsWithBehaviorChanges(changes) {
  const roots = new Set();
  for (const change of changes) {
    const previousPath = change.basePath || (change.status === 'A' ? null : change.path);
    for (const filePath of [change.path, previousPath]) {
      const domainRoot = filePath && sharedDomainRoot(filePath);
      if (domainRoot && implementationBehaviorChanged(change, domainRoot)) roots.add(domainRoot);
    }
  }
  return [...roots].sort();
}

function validateSharedTests(changes) {
  const problems = [];
  for (const domainRoot of sharedRootsWithBehaviorChanges(changes)) {
    const implementationChanges = changes.filter((change) => implementationBehaviorChanged(change, domainRoot));
    const allowRemoved = implementationChanges.every((change) => implementationRemoved(change, domainRoot));
    const hasChangedTest = changes.some((change) => (
      changedTestEvidence(change, domainRoot, isExecutableFile, allowRemoved)
    ));
    if (!hasChangedTest) {
      problems.push(issue(
        'missing_shared_test',
        `${domainRoot}/scripts`,
        'Executable behavior changes must include focused test changes in the same shared domain.',
      ));
    }
  }
  return problems;
}

function dependenciesForChange(change, owner) {
  if (isExecutableFile(change.path) || isTestFile(change.path)) {
    return privateExecutableDependencies(change.source, owner, change.path);
  }
  return privateSkillDependencies(change.source, owner);
}

function dependencyIssues(change, owner) {
  return dependenciesForChange(change, owner).map((dependency) => issue(
    'private_skill_dependency',
    change.path,
    `Do not depend on private assets of sibling skill ${dependency}; use a shared domain asset or a named skill handoff.`,
  ));
}

function validatePrivateDependencies(skill, changes) {
  const problems = [];
  for (const change of changes) {
    if (!pathBelongsTo(skill.root, change.path) || change.source === null) continue;
    problems.push(...dependencyIssues(change, skill.name));
  }
  return problems;
}

function validateSharedDependencies(changes) {
  const problems = [];
  for (const change of changes) {
    if (!isSharedPath(change.path) || change.source === null) continue;
    problems.push(...dependencyIssues(change, 'shared'));
  }
  return problems;
}

function repositoryFilesFor(snapshot) {
  if (snapshot.repositoryFiles) return snapshot.repositoryFiles;
  return new Set(snapshot.changes.filter((change) => change.source !== null).map((change) => change.path));
}

function validate(snapshot) {
  const problems = [];
  const repositoryFiles = repositoryFilesFor(snapshot);
  for (const change of snapshot.changes) {
    if (isInvalidSharedPlacement(change)) {
      problems.push(issue(
        'invalid_shared_placement',
        change.path,
        'New or renamed shared assets must live under an explicit shared/<domain>/<asset-type>/ boundary.',
      ));
    }
  }
  problems.push(...validateSharedDependencies(snapshot.changes));
  problems.push(...validateSharedTests(snapshot.changes));

  for (const skill of snapshot.skills.values()) {
    problems.push(...validateSkillDocument(skill, repositoryFiles));
    problems.push(...validateSkillTests(skill, snapshot.changes));
    problems.push(...validatePrivateDependencies(skill, snapshot.changes));
  }

  problems.sort((left, right) => (
    left.path.localeCompare(right.path)
    || left.code.localeCompare(right.code)
    || left.message.localeCompare(right.message)
  ));
  const checkedSkills = [...snapshot.skills.keys()].sort();
  return {
    checked_skills: checkedSkills,
    next_action: problems.length === 0 ? 'none' : 'fix_skill_architecture',
    ok: problems.length === 0,
    problems,
    schema_version: 1,
  };
}

module.exports = {
  dependenciesForChange,
  issue,
  repositoryFilesFor,
  validate,
  validatePrivateDependencies,
  validateSharedDependencies,
  validateSharedTests,
  validateSkillDocument,
  validateSkillTests,
};
