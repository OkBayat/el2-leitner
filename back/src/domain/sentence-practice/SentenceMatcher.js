function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function shouldMatchCaseSensitively(value) {
  return /[A-Z]/u.test(value);
}

function compileAcceptedForms(acceptedForms) {
  const unique = [...new Set((Array.isArray(acceptedForms) ? acceptedForms : [])
    .map((value) => String(value ?? "").trim())
    .filter(Boolean))]
    .sort((left, right) => right.length - left.length);

  return unique.map((form) => ({
    form,
    regex: new RegExp(
      `(?<![\\p{L}\\p{N}])${escapeRegExp(form)}(?![\\p{L}\\p{N}])`,
      shouldMatchCaseSensitively(form) ? "gu" : "giu"
    )
  }));
}

function maximalOccurrences(occurrences) {
  const unique = new Map();
  for (const occurrence of occurrences) {
    const key = `${occurrence.index}:${occurrence.length}`;
    if (!unique.has(key)) unique.set(key, occurrence);
  }
  const values = [...unique.values()];
  return values.filter((candidate) => !values.some((other) => {
    if (other === candidate || other.length <= candidate.length) return false;
    const candidateEnd = candidate.index + candidate.length;
    const otherEnd = other.index + other.length;
    return other.index <= candidate.index && otherEnd >= candidateEnd;
  }));
}

export function createSentenceMatcher(acceptedForms) {
  const compiled = compileAcceptedForms(acceptedForms);

  return (sentenceText) => {
    const text = String(sentenceText ?? "");
    if (!text || !compiled.length) return null;

    const occurrences = [];
    for (const candidate of compiled) {
      candidate.regex.lastIndex = 0;
      for (const match of text.matchAll(candidate.regex)) {
        occurrences.push({
          form: candidate.form,
          text: match[0],
          index: match.index,
          length: match[0].length
        });
      }
    }

    const maximal = maximalOccurrences(occurrences);
    if (maximal.length !== 1) return null;
    const occurrence = maximal[0];
    return {
      matchedForm: occurrence.form,
      matchedText: occurrence.text,
      before: text.slice(0, occurrence.index),
      after: text.slice(occurrence.index + occurrence.length)
    };
  };
}

export function findSentenceMatch(sentenceText, acceptedForms) {
  return createSentenceMatcher(acceptedForms)(sentenceText);
}
