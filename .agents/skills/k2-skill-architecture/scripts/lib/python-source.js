'use strict';

function scanPython(source, maskComments) {
  const input = String(source || '');
  let output = '';
  const stringRanges = [];
  let string = null;

  for (let index = 0; index < input.length; index += 1) {
    const current = input[index];
    if (string) {
      output += current;
      if (current === '\\' && !string.triple && index + 1 < input.length) {
        output += input[index + 1];
        index += 1;
      } else if (string.triple && input.slice(index, index + 3) === string.quote.repeat(3)) {
        output += input.slice(index + 1, index + 3);
        index += 2;
        stringRanges.push({ end: index, start: string.start });
        string = null;
      } else if (!string.triple && current === string.quote) {
        stringRanges.push({ end: index, start: string.start });
        string = null;
      }
      continue;
    }

    if (current === '#' && maskComments) {
      output += ' ';
      while (index + 1 < input.length && input[index + 1] !== '\n' && input[index + 1] !== '\r') {
        output += ' ';
        index += 1;
      }
      continue;
    }

    if (current === '\'' || current === '"') {
      const triple = input.slice(index, index + 3) === current.repeat(3);
      string = { quote: current, start: index, triple };
      output += current;
      if (triple) {
        output += current.repeat(2);
        index += 2;
      }
      continue;
    }

    output += current;
  }

  if (string) stringRanges.push({ end: input.length - 1, start: string.start });
  return { source: output, stringRanges };
}

function maskPythonComments(source) {
  return scanPython(source, true).source;
}

function pythonStringRanges(source) {
  return scanPython(source, false).stringRanges;
}

module.exports = { maskPythonComments, pythonStringRanges };
