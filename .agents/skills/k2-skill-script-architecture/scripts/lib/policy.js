'use strict';

const path = require('node:path');

const IMPLEMENTATION_LINE_LIMIT = 500;
const TEST_LINE_LIMIT = 700;
const FACADE_EXPORT_LIMIT = 8;
const MODULE_EXPORT_LIMIT = 12;
const LEGACY_MINIMUM_REDUCTION_LINES = 50;
const LEGACY_MINIMUM_REDUCTION_RATIO = 0.1;
const SCRIPT_EXTENSIONS = new Set(['.js', '.cjs', '.mjs', '.ts', '.cts', '.mts']);

function isSkillScript(filePath) {
  const normalized = filePath.split(path.sep).join('/');
  return /^\.agents\/skills\/(?:[^/]+\/scripts|shared\/[^/]+\/scripts)\/.+\.(?:[cm]?[jt]s)$/.test(normalized);
}

function isTestFile(filePath) {
  const name = path.basename(filePath);
  return /^(?:test-|spec-)/.test(name)
    || /(?:\.test|\.spec)\.(?:[cm]?[jt]s)$/.test(name)
    || filePath.split(path.sep).includes('__tests__');
}

function isFacade(filePath) {
  const name = path.basename(filePath).replace(/\.(?:[cm]?[jt]s)$/, '');
  return ['index', 'cli', 'command', 'main', 'runner'].includes(name)
    || /^k2-/.test(name)
    || /^validate-/.test(name);
}

function skillScriptsRoot(filePath) {
  const normalized = filePath.split(path.sep).join('/');
  const sharedDomain = normalized.match(/^(\.agents\/skills\/shared\/[^/]+\/scripts)(?:\/|$)/);
  if (sharedDomain) return sharedDomain[1];
  const legacyShared = normalized.match(/^(\.agents\/skills\/shared\/scripts)(?:\/|$)/);
  if (legacyShared) return legacyShared[1];
  const match = normalized.match(/^(\.agents\/skills\/[^/]+\/scripts)(?:\/|$)/);
  return match ? match[1] : null;
}

function staticallyImports(source, fromPath, targetPath) {
  const specifiers = [];
  const pattern = /(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)|(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  for (const match of String(source || '').matchAll(pattern)) specifiers.push(match[1] || match[2]);
  const fromDirectory = path.posix.dirname(fromPath.split(path.sep).join('/'));
  const normalizedTarget = targetPath.split(path.sep).join('/').replace(/\.(?:[cm]?[jt]s)$/, '');
  return specifiers.some((specifier) => {
    if (!specifier.startsWith('.')) return false;
    const resolved = path.posix.normalize(path.posix.join(fromDirectory, specifier))
      .replace(/\.(?:[cm]?[jt]s)$/, '');
    return resolved === normalizedTarget;
  });
}

function limitsFor(filePath) {
  return {
    lineLimit: isTestFile(filePath) ? TEST_LINE_LIMIT : IMPLEMENTATION_LINE_LIMIT,
    exportLimit: isFacade(filePath) ? FACADE_EXPORT_LIMIT : MODULE_EXPORT_LIMIT,
  };
}

module.exports = {
  LEGACY_MINIMUM_REDUCTION_LINES,
  LEGACY_MINIMUM_REDUCTION_RATIO,
  SCRIPT_EXTENSIONS,
  isSkillScript,
  isTestFile,
  limitsFor,
  skillScriptsRoot,
  staticallyImports,
};
