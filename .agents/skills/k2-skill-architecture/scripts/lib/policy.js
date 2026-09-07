'use strict';

const path = require('node:path');
const { maskComments } = require('./comment-mask');

const SKILLS_ROOT = '.agents/skills';
const SHARED_ROOT = `${SKILLS_ROOT}/shared`;
const SCRIPT_EXTENSIONS = new Set(['.js', '.cjs', '.mjs', '.ts', '.cts', '.mts']);

function normalize(filePath) {
  return filePath.split(path.sep).join('/').replace(/^\.\//, '');
}

function skillNameForPath(filePath) {
  const match = normalize(filePath).match(/^\.agents\/skills\/([^/]+)\//);
  if (!match || match[1] === 'shared') return null;
  return match[1];
}

function skillRoot(name) {
  return `${SKILLS_ROOT}/${name}`;
}

function isExecutableFile(filePath) {
  return SCRIPT_EXTENSIONS.has(path.posix.extname(normalize(filePath)));
}

function isExecutableScript(filePath) {
  const normalized = normalize(filePath);
  return normalized.includes('/scripts/') && isExecutableFile(normalized);
}

function isTestFile(filePath) {
  const normalized = normalize(filePath);
  const base = path.posix.basename(normalized);
  return normalized.includes('/tests/')
    || normalized.includes('/__tests__/')
    || /^(?:test-|spec-)/.test(base)
    || /(?:\.test|\.spec)\.(?:[cm]?[jt]s)$/.test(base);
}

function privateSkillDependencies(source, currentSkill) {
  const found = new Set();
  const patterns = [
    /\.\.\/([a-z0-9][a-z0-9-]*)\/(?:references|scripts|schemas|assets|contracts)\//gi,
    /\.agents\/skills\/([a-z0-9][a-z0-9-]*)\/(?:references|scripts|schemas|assets|contracts)\//gi,
  ];
  for (const pattern of patterns) {
    for (const match of String(source || '').matchAll(pattern)) {
      const target = match[1];
      if (target !== currentSkill && target !== 'shared') found.add(target);
    }
  }
  return [...found].sort();
}

function maskModuleTemplatesPass(source, contextualRegexKeywords) {
  const characters = [...String(source || '')];
  const masked = [...characters];
  const literals = [];
  const states = [];
  const regexOperandKeywords = new Set([
    'case', 'delete', 'in', 'instanceof', 'new', 'return', 'throw', 'typeof', 'void',
  ]);
  const regexOperandTokens = new Set('([{:;,=!?&|+*%^~<>-/'.split(''));
  let codeQuote = '';
  let codeRegex = false;
  let codeRegexCharacterClass = false;
  let codeLastToken = '';
  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index];
    const next = characters[index + 1];
    const state = states.at(-1);
    if (!state) {
      if (codeQuote) {
        if (character === '\\') index += 1;
        else if (character === codeQuote) {
          codeQuote = '';
          codeLastToken = 'value';
        }
      } else if (codeRegex) {
        if (character === '\\') index += 1;
        else if (character === '[') codeRegexCharacterClass = true;
        else if (character === ']') codeRegexCharacterClass = false;
        else if (character === '/' && !codeRegexCharacterClass) {
          codeRegex = false;
          codeLastToken = 'value';
        }
      } else if (character === '"' || character === "'") codeQuote = character;
      else if (character === '`') {
        states.push({ hasInterpolation: false, start: index, type: 'template' });
        masked[index] = ' ';
      } else if (/[A-Za-z_$]/.test(character)) {
        let end = index + 1;
        while (end < characters.length && /[\w$]/.test(characters[end])) end += 1;
        const identifier = characters.slice(index, end).join('');
        codeLastToken = codeLastToken !== '.'
          && (regexOperandKeywords.has(identifier) || contextualRegexKeywords.has(identifier))
          ? identifier : 'value';
        index = end - 1;
      } else if ((character === '+' || character === '-') && next === character) {
        codeLastToken = 'value';
        index += 1;
      } else if (character === '!' && ['value', ')', ']', '}'].includes(codeLastToken)) {
        codeLastToken = 'value';
      } else if (character === '/' && (
        !codeLastToken || regexOperandTokens.has(codeLastToken)
        || regexOperandKeywords.has(codeLastToken) || contextualRegexKeywords.has(codeLastToken)
      )) {
        codeRegex = true;
        codeRegexCharacterClass = false;
      } else if (!/\s/.test(character)) codeLastToken = character;
      continue;
    }
    if (character !== '\n' && character !== '\r') masked[index] = ' ';
    if (state.type === 'string') {
      if (character === '\\') {
        index += 1;
        if (index < masked.length) masked[index] = ' ';
      } else if (character === state.quote) {
        states.pop();
        if (states.at(-1)?.type === 'expression') states.at(-1).lastToken = 'value';
      }
      continue;
    }
    if (state.type === 'regex') {
      if (character === '\\') {
        index += 1;
        if (index < masked.length) masked[index] = ' ';
      } else if (character === '[') state.characterClass = true;
      else if (character === ']') state.characterClass = false;
      else if (character === '/' && !state.characterClass) {
        states.pop();
        if (states.at(-1)?.type === 'expression') states.at(-1).lastToken = 'value';
      }
      continue;
    }
    if (state.type === 'line_comment') {
      if (character === '\n' || character === '\r') states.pop();
      continue;
    }
    if (state.type === 'block_comment') {
      if (character === '*' && next === '/') {
        states.pop();
        index += 1;
        if (index < masked.length) masked[index] = ' ';
      }
      continue;
    }
    if (state.type === 'template') {
      if (character === '\\') {
        index += 1;
        if (index < masked.length) masked[index] = ' ';
      } else if (character === '$' && next === '{') {
        state.hasInterpolation = true;
        states.push({ type: 'expression', depth: 1, lastToken: '' });
        index += 1;
        masked[index] = ' ';
      } else if (character === '`') {
        const completed = states.pop();
        literals.push({
          end: index,
          hasInterpolation: completed.hasInterpolation,
          start: completed.start,
          value: characters.slice(completed.start + 1, index).join(''),
        });
        if (states.at(-1)?.type === 'expression') states.at(-1).lastToken = 'value';
      }
      continue;
    }
    if (character === '"' || character === "'") states.push({ type: 'string', quote: character });
    else if (/[A-Za-z_$]/.test(character)) {
      let end = index + 1;
      while (end < characters.length && /[\w$]/.test(characters[end])) end += 1;
      const identifier = characters.slice(index, end).join('');
      state.lastToken = state.lastToken !== '.'
        && (regexOperandKeywords.has(identifier) || contextualRegexKeywords.has(identifier))
        ? identifier : 'value';
      for (let cursor = index + 1; cursor < end; cursor += 1) masked[cursor] = ' ';
      index = end - 1;
    } else if ((character === '+' || character === '-') && next === character) {
      state.lastToken = 'value';
      index += 1;
      masked[index] = ' ';
    } else if (character === '!' && ['value', ')', ']', '}'].includes(state.lastToken)) {
      state.lastToken = 'value';
    } else if (character === '/' && next === '/') {
      states.push({ type: 'line_comment' });
      index += 1;
      masked[index] = ' ';
    } else if (character === '/' && next === '*') {
      states.push({ type: 'block_comment' });
      index += 1;
      masked[index] = ' ';
    } else if (character === '/' && (
      !state.lastToken || regexOperandTokens.has(state.lastToken) || regexOperandKeywords.has(state.lastToken)
      || contextualRegexKeywords.has(state.lastToken)
    )) states.push({ characterClass: false, type: 'regex' });
    else if (character === '`') states.push({ hasInterpolation: false, start: index, type: 'template' });
    else if (character === '{') state.depth += 1;
    else if (character === '}') {
      state.depth -= 1;
      if (state.depth === 0) states.pop();
    } else if (!/\s/.test(character)) state.lastToken = character;
  }
  return { literals, source: masked.join('') };
}

function maskModuleTemplates(source) {
  const original = String(source || '');
  const ordinary = maskModuleTemplatesPass(original, new Set());
  const contextual = maskModuleTemplatesPass(original, new Set(['await', 'of', 'yield']));
  const literals = new Map();
  for (const literal of [...ordinary.literals, ...contextual.literals]) {
    literals.set(`${literal.start}:${literal.end}`, literal);
  }
  return {
    literals: [...literals.values()],
    source: [...original].map((character, index) => (
      ordinary.source[index] !== character && contextual.source[index] !== character ? ' ' : character
    )).join(''),
  };
}

function moduleSpecifiers(source) {
  const found = new Set();
  const commentMasked = maskComments(source);
  const templates = maskModuleTemplates(commentMasked);
  for (const rawLine of templates.source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const patterns = [
      /^(?:const|let|var)\s+(?:\{[^}]+\}|[A-Za-z_$][\w$]*)\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/,
      /^require\(\s*['"]([^'"]+)['"]\s*\)/,
      /^import\s+(?:.+?\s+from\s+)?['"]([^'"]+)['"]/,
      /^export\s+.+?\s+from\s+['"]([^'"]+)['"]/,
      /(?:^|[=(,:]\s*)import\(\s*['"]([^'"]+)['"]\s*\)/,
    ];
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) found.add(match[1]);
    }
  }
  for (const literal of templates.literals) {
    if (literal.hasInterpolation) continue;
    if (/^(?:\.{1,2}\/|\.agents\/skills\/)/.test(literal.value)) found.add(literal.value);
    const before = commentMasked.slice(0, literal.start);
    const after = commentMasked.slice(literal.end + 1);
    if (/(?:require|import)\(\s*$/.test(before) && /^\s*\)/.test(after)) found.add(literal.value);
  }
  return [...found].sort();
}

function privateSkillImports(source, currentSkill, filePath) {
  const found = new Set();
  const fromDirectory = path.posix.dirname(normalize(filePath));
  for (const specifier of moduleSpecifiers(source)) {
    let resolved = null;
    if (specifier.startsWith('.agents/skills/')) {
      resolved = normalize(specifier);
    } else if (specifier.startsWith('.')) {
      resolved = path.posix.normalize(path.posix.join(fromDirectory, specifier));
    }
    if (!resolved) continue;
    const target = skillNameForPath(resolved);
    if (target && target !== currentSkill) found.add(target);
  }
  return [...found].sort();
}

function privateExecutableDependencies(source, currentSkill, filePath) {
  const executableSource = maskComments(source);
  const specifiers = new Set(moduleSpecifiers(executableSource));
  const stringTokens = [];
  for (let index = 0; index < executableSource.length; index += 1) {
    const quote = executableSource[index];
    if (!['"', "'", '`'].includes(quote)) continue;
    const start = index;
    let value = '';
    for (index += 1; index < executableSource.length; index += 1) {
      const character = executableSource[index];
      if (character === '\\' && index + 1 < executableSource.length) {
        value += executableSource[index + 1];
        index += 1;
      } else if (character === quote) {
        stringTokens.push({ start, end: index, quote, value });
        break;
      } else value += character;
    }
  }
  const scanTemplateInterpolation = (token, position, contextualRegexKeywords) => {
    if (!token || token.quote !== '`') return false;
    const regexOperandKeywords = new Set([
      'case', 'delete', 'in', 'instanceof', 'new', 'return', 'throw', 'typeof', 'void',
    ]);
    const regexOperandTokens = new Set('([{:;,=!?&|+*%^~<>-/'.split(''));
    const states = [{ type: 'template' }];
    for (let index = token.start + 1; index < position; index += 1) {
      const state = states.at(-1);
      const character = executableSource[index];
      const next = executableSource[index + 1];
      if (state.type === 'string') {
        if (character === '\\') index += 1;
        else if (character === state.quote) states.pop();
        continue;
      }
      if (state.type === 'regex') {
        if (character === '\\') index += 1;
        else if (character === '[') state.character_class = true;
        else if (character === ']') state.character_class = false;
        else if (character === '/' && !state.character_class) states.pop();
        continue;
      }
      if (state.type === 'line_comment') {
        if (character === '\n') states.pop();
        continue;
      }
      if (state.type === 'block_comment') {
        if (character === '*' && next === '/') { states.pop(); index += 1; }
        continue;
      }
      if (state.type === 'template') {
        if (character === '\\') index += 1;
        else if (character === '$' && next === '{') {
          states.push({ type: 'expression', depth: 1, last_token: '' });
          index += 1;
        } else if (character === '`') states.pop();
        continue;
      }
      if (character === '"' || character === "'") states.push({ type: 'string', quote: character });
      else if (character === '/' && next === '/') { states.push({ type: 'line_comment' }); index += 1; }
      else if (character === '/' && next === '*') { states.push({ type: 'block_comment' }); index += 1; }
      else if (/[A-Za-z_$]/.test(character)) {
        let end = index + 1;
        while (end < position && /[\w$]/.test(executableSource[end])) end += 1;
        const identifier = executableSource.slice(index, end);
        state.last_token = state.last_token !== '.'
          && (regexOperandKeywords.has(identifier) || contextualRegexKeywords.has(identifier))
          ? identifier : 'value';
        index = end - 1;
      } else if ((character === '+' || character === '-') && next === character) {
        state.last_token = 'value'; index += 1;
      } else if (character === '!' && ['value', ')', ']', '}'].includes(state.last_token)) {
        state.last_token = 'value';
      } else if (character === '/' && (
        !state.last_token || regexOperandTokens.has(state.last_token)
        || regexOperandKeywords.has(state.last_token) || contextualRegexKeywords.has(state.last_token)
      )) states.push({ type: 'regex', character_class: false });
      else if (character === '`') states.push({ type: 'template' });
      else if (character === '{') state.depth += 1;
      else if (character === '}') {
        state.depth -= 1;
        if (state.depth === 0) states.pop();
      } else if (!/\s/.test(character)) state.last_token = character;
    }
    return states.at(-1)?.type === 'expression';
  };
  const isTemplateInterpolation = (token, position) => (
    scanTemplateInterpolation(token, position, new Set())
    || scanTemplateInterpolation(token, position, new Set(['await', 'of', 'yield']))
  );
  const templateLiterals = maskModuleTemplates(executableSource).literals;
  for (const match of executableSource.matchAll(/['"](\.{1,2}\/[^'"]+|\.agents\/skills\/[^'"]+)['"]/g)) {
    const templates = templateLiterals.filter((candidate) => candidate.start < match.index && match.index < candidate.end);
    if (templates.length > 0) {
      if (templates.some((template) => isTemplateInterpolation({ quote: '`', start: template.start }, match.index))) {
        specifiers.add(match[1]);
      }
      continue;
    }
    const token = stringTokens.find((candidate) => candidate.start <= match.index && match.index <= candidate.end);
    if (!token || token.start === match.index) specifiers.add(match[1]);
  }
  const found = new Set();
  const fromDirectory = path.posix.dirname(normalize(filePath));
  for (const specifier of specifiers) {
    const resolved = specifier.startsWith('.agents/skills/')
      ? normalize(specifier)
      : path.posix.normalize(path.posix.join(fromDirectory, specifier));
    const target = skillNameForPath(resolved);
    if (target && target !== currentSkill) found.add(target);
  }
  const dynamicPathPattern = /path\.(?:join|resolve)\(\s*__dirname\s*,((?:\s*['"][^'"]*['"]\s*,?)+)\)/g;
  for (const match of executableSource.matchAll(dynamicPathPattern)) {
    const templates = templateLiterals.filter((candidate) => candidate.start < match.index && match.index < candidate.end);
    if (templates.length > 0 && !templates.some((template) => (
      isTemplateInterpolation({ quote: '`', start: template.start }, match.index)
    ))) continue;
    const token = stringTokens.find((candidate) => candidate.start < match.index && match.index < candidate.end);
    if (templates.length === 0 && token) continue;
    const segments = [...match[1].matchAll(/['"]([^'"]*)['"]/g)].map((segment) => segment[1]);
    const target = skillNameForPath(path.posix.normalize(path.posix.join(fromDirectory, ...segments)));
    if (target && target !== currentSkill) found.add(target);
  }
  return [...found].sort();
}

function localMarkdownLinks(source) {
  const links = [];
  for (const match of String(source || '').matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].trim().split('#')[0];
    if (!target || target.startsWith('#') || target.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    links.push(target);
  }
  return [...new Set(links)].sort();
}

module.exports = {
  SKILLS_ROOT,
  SHARED_ROOT,
  isExecutableFile,
  isExecutableScript,
  isTestFile,
  localMarkdownLinks,
  normalize,
  privateExecutableDependencies,
  privateSkillDependencies,
  privateSkillImports,
  skillNameForPath,
  skillRoot,
};
