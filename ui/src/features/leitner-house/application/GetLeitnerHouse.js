import { requireLeitnerHouse } from '../domain/LeitnerHouse.js';

export function normalizeSearch(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordSearchText(word) {
  return normalizeSearch([
    word?.term,
    ...(Array.isArray(word?.accepted) ? word.accepted : []),
    word?.category,
    ...(Array.isArray(word?.tags) ? word.tags : []),
    ...(Array.isArray(word?.lessons) ? word.lessons : [])
  ].filter(Boolean).join(' '));
}

function numericValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function compareByNumberThenTerm(a, b) {
  const numberDiff = numericValue(a?.number) - numericValue(b?.number);
  if (numberDiff) return numberDiff;
  return String(a?.term || '').localeCompare(String(b?.term || ''), 'en', { sensitivity: 'base' });
}

export function filterAndSortWords(words, { search = '', sort = 'mistakes' } = {}) {
  const query = normalizeSearch(search);
  const result = (Array.isArray(words) ? words : [])
    .filter((word) => !query || wordSearchText(word).includes(query));

  result.sort((a, b) => {
    if (sort === 'alpha') {
      return String(a?.term || '').localeCompare(String(b?.term || ''), 'en', { sensitivity: 'base' })
        || compareByNumberThenTerm(a, b);
    }
    if (sort === 'due') {
      return String(a?.due || '9999-12-31').localeCompare(String(b?.due || '9999-12-31'))
        || compareByNumberThenTerm(a, b);
    }
    if (sort === 'recent') {
      if (!a?.lastReviewed && !b?.lastReviewed) return compareByNumberThenTerm(a, b);
      if (!a?.lastReviewed) return 1;
      if (!b?.lastReviewed) return -1;
      return String(b.lastReviewed).localeCompare(String(a.lastReviewed))
        || compareByNumberThenTerm(a, b);
    }
    return numericValue(b?.mistakes) - numericValue(a?.mistakes)
      || compareByNumberThenTerm(a, b);
  });

  return result;
}

export class GetLeitnerHouseQuery {
  constructor({ gateway }) {
    this.gateway = gateway;
  }

  execute(houseInput) {
    return this.gateway.getHouse(requireLeitnerHouse(houseInput));
  }
}
