'use strict';

function stripComments(source) {
  let output = '';
  let state = 'code';
  let quote = '';
  let regexClass = false;

  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    const next = source[index + 1];

    if (state === 'line-comment') {
      if (current === '\n') {
        output += '\n';
        state = 'code';
      } else {
        output += ' ';
      }
      continue;
    }

    if (state === 'block-comment') {
      if (current === '*' && next === '/') {
        output += '  ';
        index += 1;
        state = 'code';
      } else {
        output += current === '\n' ? '\n' : ' ';
      }
      continue;
    }

    if (state === 'string') {
      output += current;
      if (current === '\\') {
        if (next !== undefined) {
          output += next;
          index += 1;
        }
      } else if (current === quote) {
        state = 'code';
      }
      continue;
    }

    if (state === 'regex') {
      output += current;
      if (current === '\\') {
        if (next !== undefined) {
          output += next;
          index += 1;
        }
      } else if (current === '[') {
        regexClass = true;
      } else if (current === ']') {
        regexClass = false;
      } else if (current === '/' && !regexClass) {
        state = 'code';
      }
      continue;
    }

    if (current === '/' && next === '/') {
      output += '  ';
      index += 1;
      state = 'line-comment';
    } else if (current === '/' && next === '*') {
      output += '  ';
      index += 1;
      state = 'block-comment';
    } else if (current === '/' && regexCanStart(output)) {
      output += current;
      regexClass = false;
      state = 'regex';
    } else if (current === '\'' || current === '"' || current === '`') {
      output += current;
      quote = current;
      state = 'string';
    } else {
      output += current;
    }
  }

  return output;
}

function regexCanStart(output) {
  const significant = output.trimEnd();
  if (!significant) return true;
  const previous = significant[significant.length - 1];
  if ((previous === '+' || previous === '-') && significant[significant.length - 2] === previous) return false;
  if ('([{:;,=!?&|+-*%^~<>'.includes(previous)) return true;
  return /(?:^|\s)(?:case|delete|in|instanceof|new|return|throw|typeof|void|yield)$/.test(significant);
}

function executableShape(source) {
  return stripComments(source)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

function executableLines(source) {
  const shape = executableShape(source);
  return shape ? shape.split('\n').length : 0;
}

function splitTopLevel(source) {
  const values = [];
  let start = 0;
  let depth = 0;
  let quote = '';

  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    if (quote) {
      if (current === '\\') {
        index += 1;
      } else if (current === quote) {
        quote = '';
      }
      continue;
    }
    if (current === '\'' || current === '"' || current === '`') {
      quote = current;
    } else if ('{[('.includes(current)) {
      depth += 1;
    } else if ('}])'.includes(current)) {
      depth -= 1;
    } else if (current === ',' && depth === 0) {
      values.push(source.slice(start, index));
      start = index + 1;
    }
  }
  values.push(source.slice(start));
  return values.map((value) => value.trim()).filter(Boolean);
}

function objectExportBody(source) {
  const clean = stripComments(source);
  const assignment = /module\.exports\s*=\s*\{/.exec(clean);
  if (!assignment) return null;
  const start = clean.indexOf('{', assignment.index);
  let depth = 0;
  let quote = '';
  for (let index = start; index < clean.length; index += 1) {
    const current = clean[index];
    if (quote) {
      if (current === '\\') index += 1;
      else if (current === quote) quote = '';
      continue;
    }
    if (current === '\'' || current === '"' || current === '`') quote = current;
    else if (current === '{') depth += 1;
    else if (current === '}' && --depth === 0) return clean.slice(start + 1, index);
  }
  return null;
}

function objectExportNames(source) {
  const body = objectExportBody(source);
  if (body === null) return [];
  return splitTopLevel(body)
    .map((entry) => entry.match(/^(?:\.\.\.)?([A-Za-z_$][\w$]*)\s*(?::|$)/))
    .filter(Boolean)
    .map((entry) => entry[1]);
}

function exportNames(source) {
  const clean = stripComments(source);
  const objectAssignment = /module\.exports\s*=\s*\{/.test(clean);
  const names = new Set(objectExportNames(clean));
  const patterns = [
    /(?:^|\n)\s*(?:module\.)?exports\.([A-Za-z_$][\w$]*)\s*=/g,
    /(?:^|\n)\s*export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g,
  ];

  for (const pattern of patterns) {
    for (const match of clean.matchAll(pattern)) names.add(match[1]);
  }

  for (const match of clean.matchAll(/(?:^|\n)\s*export\s*\{([^}]+)\}/g)) {
    for (const entry of splitTopLevel(match[1])) {
      const name = entry.replace(/\s+as\s+.+$/, '').trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
    }
  }

  if (!objectAssignment && /module\.exports\s*=/.test(clean)) names.add('default');
  if (/export\s+default\s+/.test(clean)) names.add('default');
  return [...names].sort();
}

function isGenerated(source) {
  return source.split(/\r?\n/).slice(0, 5).some((line) => line.includes('@generated'));
}

function hasUnboundedExport(source) {
  const clean = stripComments(source);
  const body = objectExportBody(clean);
  return /(?:^|\n)\s*export\s*\*/.test(clean)
    || (body !== null && splitTopLevel(body).some((entry) => entry.startsWith('...')));
}

function metrics(source) {
  const exports = exportNames(source);
  return {
    executableLines: executableLines(source),
    exportCount: exports.length,
    exports,
    generated: isGenerated(source),
    hasUnboundedExport: hasUnboundedExport(source),
    shape: executableShape(source),
  };
}

module.exports = {
  executableLines,
  executableShape,
  exportNames,
  hasUnboundedExport,
  isGenerated,
  metrics,
  objectExportBody,
  splitTopLevel,
  stripComments,
};
