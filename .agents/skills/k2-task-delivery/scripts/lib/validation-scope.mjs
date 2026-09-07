import { basename } from 'node:path';

const DOCUMENTATION_NAMES = new Set([
  'CHANGELOG',
  'CONTRIBUTING',
  'LICENSE',
  'README',
  'SECURITY',
]);

const DOCUMENTATION_EXTENSIONS = new Set([
  '.adoc',
  '.md',
  '.mdx',
  '.rst',
]);

const TEST_FILE = /\.(?:spec|test)\.(?:cjs|cts|js|jsx|mjs|mts|ts|tsx)$/;
const PYTHON_TEST_FILE = /^(?:test_.+|.+_test)\.py$/;
const SKILL_TEST_FILE = /^\.agents\/skills\/(?:[^/]+|shared\/[^/]+)\/scripts\/(?:test-[^/]+\.(?:cjs|cts|js|mjs|mts|ts)|test_[^/]+\.py|[^/]+_test\.py)$/;
const SKILL_SCRIPT = /^\.agents\/skills\/(?:[^/]+|shared\/[^/]+)\/scripts\//;
const SKILL_TEST_TREE = /^\.agents\/skills\/(?:[^/]+|shared\/[^/]+)\/scripts\/tests\//;

function normalizePath(file) {
  if (typeof file !== 'string' || file.trim() === '') {
    throw new Error('VALIDATION_SCOPE_INVALID_CHANGED_FILE');
  }
  return file.replaceAll('\\', '/').replace(/^\.\//, '');
}

function pathSegments(file) {
  return file.split('/');
}

function isKnownTestTree(file) {
  return /^(?:__tests__|test|tests)\//.test(file)
    || /^(?:back|ui)\/(?:.+\/)?(?:__tests__|test|tests)\//.test(file)
    || SKILL_TEST_TREE.test(file);
}

function isFixture(file) {
  const segments = pathSegments(file);
  const fixtureIndex = segments.findIndex((segment) => [
    '__fixtures__',
    '__snapshots__',
    'fixtures',
    'snapshots',
  ].includes(segment));
  if (fixtureIndex === -1) return false;
  if (fixtureIndex === 0 && ['__fixtures__', '__snapshots__'].includes(segments[0])) return true;
  return isKnownTestTree(file);
}

function isKnownTest(file) {
  if (isKnownTestTree(file) || SKILL_TEST_FILE.test(file)) return true;
  if (file.startsWith('back/')
    || file.startsWith('speech/')
    || file.startsWith('ui/')
    || SKILL_SCRIPT.test(file)) {
    const name = basename(file);
    return TEST_FILE.test(name) || PYTHON_TEST_FILE.test(name);
  }
  return false;
}

function isOperationalContract(file) {
  return file === 'AGENTS.md'
    || file.startsWith('.agents/config/')
    || file.startsWith('.agents/review/')
    || file.startsWith('.agents/skills/')
    || file.startsWith('.github/workflows/');
}

function extensionOf(name) {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot).toLowerCase();
}

function isBehaviorRoot(file) {
  return ['.agents/', '.github/', 'back/', 'scripts/', 'speech/', 'ui/']
    .some((root) => file.startsWith(root));
}

function isDocumentation(file) {
  const name = basename(file);
  const stem = name.split('.')[0].toUpperCase();
  const extension = extensionOf(name);
  if (DOCUMENTATION_NAMES.has(stem)) {
    return extension === '' || DOCUMENTATION_EXTENSIONS.has(extension);
  }
  return file.startsWith('docs/') && DOCUMENTATION_EXTENSIONS.has(extension);
}

function classifyFile(file) {
  if (isFixture(file)) return 'fixture';
  if (isKnownTest(file)) return 'test';
  if (isOperationalContract(file)) return 'behavior';
  if (isBehaviorRoot(file)) return 'behavior';
  const name = basename(file);
  if (TEST_FILE.test(name) || PYTHON_TEST_FILE.test(name)) return 'test';
  if (isDocumentation(file)) return 'documentation';
  return 'behavior';
}

function structuralOnlyEligible(file) {
  return /^\.agents\/skills\/[^/]+\/scripts\/(?!tests\/).+\.(?:cjs|cts|js|mjs|mts|ts)$/.test(file)
    || /^\.agents\/skills\/shared\/[^/]+\/scripts\/(?!tests\/).+\.(?:cjs|cts|js|mjs|mts|ts)$/.test(file);
}

export function selectValidationScope(changedFiles, { changeKind = 'auto' } = {}) {
  if (!Array.isArray(changedFiles)) throw new Error('VALIDATION_SCOPE_CHANGED_FILES_NOT_ARRAY');
  if (!['auto', 'structural_only'].includes(changeKind)) {
    throw new Error('VALIDATION_SCOPE_CHANGE_KIND_INVALID');
  }
  const files = {
    behavior: [],
    documentation: [],
    fixture: [],
    test: [],
  };

  for (const file of [...new Set(changedFiles.map(normalizePath))].sort()) {
    files[classifyFile(file)].push(file);
  }

  if (files.behavior.length > 0) {
    if (changeKind === 'structural_only') {
      if (!files.behavior.every(structuralOnlyEligible)) {
        throw new Error('VALIDATION_SCOPE_STRUCTURAL_ONLY_NOT_ALLOWED');
      }
      return {
        validation_scope: 'focused',
        full_suite_required: false,
        reason: 'structural_only_changes',
        files,
      };
    }
    return {
      validation_scope: 'full',
      full_suite_required: true,
      reason: 'behavior_bearing_changes',
      files,
    };
  }
  if (changedFiles.length > 0) {
    return {
      validation_scope: 'focused',
      full_suite_required: false,
      reason: 'focused_only_changes',
      files,
    };
  }
  return {
    validation_scope: 'none',
    full_suite_required: false,
    reason: 'no_content_changes',
    files,
  };
}
