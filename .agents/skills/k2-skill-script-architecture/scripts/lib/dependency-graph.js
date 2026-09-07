'use strict';

const path = require('node:path');
const { SCRIPT_EXTENSIONS } = require('./policy');

function relativeSpecifiers(source) {
  const values = new Set();
  const patterns = [
    /\brequire\(\s*['"](\.[^'"]+)['"]\s*\)/g,
    /\bfrom\s+['"](\.[^'"]+)['"]/g,
    /\bimport\(\s*['"](\.[^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) values.add(match[1]);
  }
  return [...values];
}

function resolveSpecifier(fromFile, specifier, availableFiles) {
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), specifier));
  const candidates = [base];
  for (const extension of SCRIPT_EXTENSIONS) candidates.push(`${base}${extension}`);
  for (const extension of SCRIPT_EXTENSIONS) candidates.push(path.posix.join(base, `index${extension}`));
  return candidates.find((candidate) => availableFiles.has(candidate)) || null;
}

function buildGraph(files) {
  const available = new Set(files.keys());
  const graph = new Map();
  for (const [filePath, source] of files) {
    const dependencies = relativeSpecifiers(source)
      .map((specifier) => resolveSpecifier(filePath, specifier, available))
      .filter(Boolean);
    graph.set(filePath, dependencies);
  }
  return graph;
}

function findCycles(graph) {
  const cycles = [];
  const visited = new Set();
  const active = new Set();
  const stack = [];

  function visit(node) {
    if (active.has(node)) {
      const start = stack.indexOf(node);
      cycles.push([...stack.slice(start), node]);
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    active.add(node);
    stack.push(node);
    for (const dependency of graph.get(node) || []) visit(dependency);
    stack.pop();
    active.delete(node);
  }

  for (const node of graph.keys()) visit(node);
  const unique = new Map(cycles.map((cycle) => [cycle.join(' -> '), cycle]));
  return [...unique.values()];
}

module.exports = {
  buildGraph,
  findCycles,
  relativeSpecifiers,
  resolveSpecifier,
};
