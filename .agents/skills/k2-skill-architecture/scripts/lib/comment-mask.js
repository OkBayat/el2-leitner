'use strict';

const REGEX_OPERAND_KEYWORDS = new Set([
  'case', 'delete', 'in', 'instanceof', 'new', 'return', 'throw', 'typeof', 'void',
]);
const REGEX_OPERAND_TOKENS = new Set('([{:;,=!?&|+*%^~<>-/'.split(''));

function maskCommentsPass(source, contextualRegexKeywords) {
  const characters = [...String(source || '')];
  let mode = 'code';
  let quote = '';
  let regexCharacterClass = false;
  let lastToken = '';
  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index];
    const next = characters[index + 1];
    if (mode === 'string') {
      if (character === '\\') index += 1;
      else if (character === quote) {
        mode = 'code';
        lastToken = 'value';
      }
      continue;
    }
    if (mode === 'regex') {
      if (character === '\\') index += 1;
      else if (character === '[') regexCharacterClass = true;
      else if (character === ']') regexCharacterClass = false;
      else if (character === '/' && !regexCharacterClass) {
        mode = 'code';
        lastToken = 'value';
      }
      continue;
    }
    if (mode === 'line_comment') {
      if (character === '\n' || character === '\r') mode = 'code';
      else characters[index] = ' ';
      continue;
    }
    if (mode === 'block_comment') {
      if (character === '*' && next === '/') {
        characters[index] = ' ';
        characters[index + 1] = ' ';
        index += 1;
        mode = 'code';
      } else if (character !== '\n' && character !== '\r') characters[index] = ' ';
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      mode = 'string';
      quote = character;
    } else if (character === '/' && next === '/') {
      characters[index] = ' ';
      characters[index + 1] = ' ';
      index += 1;
      mode = 'line_comment';
    } else if (character === '/' && next === '*') {
      characters[index] = ' ';
      characters[index + 1] = ' ';
      index += 1;
      mode = 'block_comment';
    } else if (/[A-Za-z_$]/.test(character)) {
      let end = index + 1;
      while (end < characters.length && /[\w$]/.test(characters[end])) end += 1;
      const identifier = characters.slice(index, end).join('');
      lastToken = lastToken !== '.'
        && (REGEX_OPERAND_KEYWORDS.has(identifier) || contextualRegexKeywords.has(identifier))
        ? identifier
        : 'value';
      index = end - 1;
    } else if ((character === '+' || character === '-') && next === character) {
      lastToken = 'value';
      index += 1;
    } else if (character === '!' && ['value', ')', ']', '}'].includes(lastToken)) {
      lastToken = 'value';
    } else if (character === '/' && (
      !lastToken || REGEX_OPERAND_TOKENS.has(lastToken)
      || REGEX_OPERAND_KEYWORDS.has(lastToken) || contextualRegexKeywords.has(lastToken)
    )) {
      mode = 'regex';
      regexCharacterClass = false;
    } else if (!/\s/.test(character)) lastToken = character;
  }
  return characters.join('');
}

function maskComments(source) {
  const original = String(source || '');
  const ordinary = maskCommentsPass(original, new Set());
  const contextual = maskCommentsPass(original, new Set(['await', 'of', 'yield']));
  return [...original].map((character, index) => (
    ordinary[index] === character || contextual[index] === character ? character : ordinary[index]
  )).join('');
}

module.exports = { maskComments };
