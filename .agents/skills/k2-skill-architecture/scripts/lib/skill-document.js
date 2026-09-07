'use strict';

function frontmatter(source) {
  const match = String(source || '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return new Map();
  const values = new Map();
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*?)\s*$/);
    if (field) values.set(field[1], field[2].replace(/^['"]|['"]$/g, ''));
  }
  return values;
}

function section(source, heading) {
  const lines = String(source || '').split(/\r?\n/);
  const target = heading.trim().toLowerCase();
  const start = lines.findIndex((line) => line.trim().toLowerCase() === target);
  if (start === -1) return null;
  const level = (lines[start].match(/^#+/) || [''])[0].length;
  const body = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const next = lines[index].match(/^(#+)\s+/);
    if (next && next[1].length <= level) break;
    body.push(lines[index]);
  }
  return body.join('\n').trim();
}

function hasBullet(body) {
  return String(body || '').split(/\r?\n/).some((line) => /^\s*-\s+\S/.test(line));
}

function determinismBoundary(source) {
  const boundary = section(source, '## Determinism Boundary');
  if (boundary === null) {
    return {
      complete: false,
      exists: false,
      missing: ['script_owned', 'codex_owned', 'no_manual_fallback'],
    };
  }
  const required = [
    ['script_owned', '### Script-owned'],
    ['codex_owned', '### Codex-owned'],
    ['no_manual_fallback', '### No manual fallback'],
  ];
  const missing = required
    .filter(([, heading]) => !hasBullet(section(boundary, heading)))
    .map(([name]) => name);
  return { complete: missing.length === 0, exists: true, missing };
}

function skillName(source) {
  return frontmatter(source).get('name') || null;
}

module.exports = {
  determinismBoundary,
  frontmatter,
  hasBullet,
  section,
  skillName,
};
