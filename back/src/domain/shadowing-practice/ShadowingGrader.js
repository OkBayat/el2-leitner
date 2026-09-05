const CONTRACTIONS = {
  "i'm": 'i am', "you're": 'you are', "we're": 'we are', "they're": 'they are',
  "i've": 'i have', "you've": 'you have', "we've": 'we have', "they've": 'they have',
  "i'll": 'i will', "you'll": 'you will', "we'll": 'we will', "they'll": 'they will',
  "he'll": 'he will', "she'll": 'she will', "it'll": 'it will', "let's": 'let us',
  "can't": 'can not', cannot: 'can not', "won't": 'will not', "shan't": 'shall not',
};
const VARIANTS = { colour: 'color', colours: 'colors', favourite: 'favorite', centre: 'center', theatre: 'theater', organise: 'organize', travelling: 'traveling' };
const NUMERALS = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty'.split(' ');
const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

function normalize(word) {
  const value = word.toLowerCase().replaceAll('’', "'");
  if (Object.hasOwn(CONTRACTIONS, value)) return CONTRACTIONS[value].split(' ');
  if (/n't$/u.test(value)) return [value.slice(0, -3), 'not'];
  if (/^\d+$/u.test(value) && Number(value) <= 20) return [NUMERALS[Number(value)]];
  return [VARIANTS[value] ?? value];
}

/** Ordered word coverage, not phonetic pronunciation assessment. */
export function gradeShadowing(reference, transcript) {
  if (typeof reference !== 'string' || typeof transcript !== 'string'
      || reference.length > 2000 || transcript.length > 8000) throw new Error('Speech text is too long or invalid.');
  const surface = [...reference.matchAll(WORD_PATTERN)];
  const heard = [...transcript.matchAll(WORD_PATTERN)].flatMap(match => normalize(match[0]));
  if (surface.length > 80 || heard.length > 400) throw new Error('Speech text is too long.');
  const expected = surface.flatMap((match, wordIndex) => normalize(match[0]).map(text => ({ text, wordIndex })));
  // LCS consumes each occurrence once and realigns after omitted/extra words.
  const table = Array.from({ length: expected.length + 1 }, () => new Uint16Array(heard.length + 1));
  for (let i = expected.length - 1; i >= 0; i--) {
    for (let j = heard.length - 1; j >= 0; j--) {
      table[i][j] = expected[i].text === heard[j]
        ? 1 + table[i + 1][j + 1] : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const matches = new Set();
  let i = 0;
  let j = 0;
  while (i < expected.length && j < heard.length) {
    if (expected[i].text === heard[j]) { matches.add(i); i++; j++; }
    else if (table[i + 1][j] >= table[i][j + 1]) i++;
    else j++;
  }
  const words = surface.map((match, wordIndex) => ({
    text: match[0],
    after: reference.slice(match.index + match[0].length, surface[wordIndex + 1]?.index ?? reference.length),
    matched: expected.every((token, tokenIndex) => token.wordIndex !== wordIndex || matches.has(tokenIndex)),
  }));
  const matchedCount = words.filter(word => word.matched).length;
  const totalCount = words.length;
  return {
    leading: reference.slice(0, surface[0]?.index ?? reference.length), words, transcript,
    matchedCount, totalCount, score: totalCount ? Math.floor(matchedCount * 1000 / totalCount) / 10 : 0,
    passed: totalCount > 0 && matchedCount * 100 >= totalCount * 90,
  };
}
