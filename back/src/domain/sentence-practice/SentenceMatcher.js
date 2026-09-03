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

export function createSentenceMatcher(acceptedForms) {
  const compiled = compileAcceptedForms(acceptedForms);

  return (sentenceText) => {
    const text = String(sentenceText ?? "");
    if (!text || !compiled.length) return null;

    const occurrences = new Map();
    for (const candidate of compiled) {
      candidate.regex.lastIndex = 0;
      for (const match of text.matchAll(candidate.regex)) {
        const key = `${match.index}:${match[0].length}`;
        if (!occurrences.has(key)) {
          occurrences.set(key, {
            form: candidate.form,
            text: match[0],
            index: match.index,
            length: match[0].length
          });
        }
        if (occurrences.size > 1) return null;
      }
    }

    if (occurrences.size !== 1) return null;
    const occurrence = occurrences.values().next().value;
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
