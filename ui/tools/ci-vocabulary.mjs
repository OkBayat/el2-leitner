import fs from 'node:fs';

const sourceUrl = new URL('../data/IELTS_Listening_Core_1500.md', import.meta.url);

export function loadCoreVocabulary() {
  const lines = fs.readFileSync(sourceUrl, 'utf8').split(/\r?\n/u);
  let category = 'بدون دسته‌بندی';
  const words = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    const heading = line.match(/^#{1,6}\s+(.+?)\s*$/u);
    if (heading) { category = heading[1].replace(/\*+/gu, '').trim(); continue; }
    const numbered = line.match(/^\s*(\d+)[.)-]\s+(.+?)\s*$/u);
    if (!numbered) continue;
    const cleaned = numbered[2].replace(/\*+/gu, '').trim();
    if (!cleaned || /^(british spelling|\d+ study items)/iu.test(cleaned)) continue;
    const accepted = cleaned.split(/\s+\/\s+/u).map((part) => part.trim()).filter(Boolean);
    if (!accepted.length) continue;
    words.push({ number: Number(numbered[1]), term: accepted[0], accepted, category });
  }
  return words;
}
