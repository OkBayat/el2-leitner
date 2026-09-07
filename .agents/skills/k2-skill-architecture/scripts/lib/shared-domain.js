'use strict';

const { SHARED_ROOT, normalize } = require('./policy');

const PROHIBITED_SHARED_DOMAINS = new Set(['common', 'helpers', 'misc', 'utils']);
const RESERVED_SHARED_SEGMENTS = new Set([
  'assets',
  'contracts',
  'lib',
  'references',
  'schemas',
  'scripts',
  'test-support',
  'tests',
]);

function sharedDomainRoot(filePath) {
  const match = normalize(filePath).match(/^\.agents\/skills\/shared\/([^/]+)\//);
  return match ? `${SHARED_ROOT}/${match[1]}` : null;
}

function isInvalidSharedPlacement(change) {
  if (!['A', 'R'].includes(change.status)) return false;
  const normalized = normalize(change.path);
  if (!normalized.startsWith(`${SHARED_ROOT}/`)) return false;
  const parts = normalized.slice(SHARED_ROOT.length + 1).split('/');
  return parts.length < 3
    || RESERVED_SHARED_SEGMENTS.has(parts[0])
    || PROHIBITED_SHARED_DOMAINS.has(parts[0]);
}

function isSharedPath(filePath) {
  return normalize(filePath).startsWith(`${SHARED_ROOT}/`);
}

module.exports = {
  isInvalidSharedPlacement,
  isSharedPath,
  sharedDomainRoot,
};
