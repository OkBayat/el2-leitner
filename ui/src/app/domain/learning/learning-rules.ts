import {
  DailyRecord,
  LearningSettings,
  LearningState,
  LearningWord,
  ReviewEvent,
  ReviewMode,
} from './models';

export const SCHEMA_VERSION = 2;
export const BOX_WAIT_DAYS = [0, 1, 2, 3, 7, 14] as const;
export const PAGE_SIZE = 40;
const LEGACY_UNCATEGORIZED = '\u0628\u062f\u0648\u0646 \u062f\u0633\u062a\u0647\u200c\u0628\u0646\u062f\u06cc';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function localDay(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(day: string, amount: number): string {
  const [year, month, date] = day.split('-').map(Number);
  return localDay(new Date(year, month - 1, date + amount, 12));
}

export function daysAgo(amount: number, now = new Date()): string {
  const date = new Date(now);
  date.setDate(date.getDate() - amount);
  return localDay(date);
}

export function normalizeAnswer(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(/[’‘]/gu, "'")
    .replace(/[–—]/gu, '-')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function isCorrectAnswer(value: unknown, word: Pick<LearningWord, 'accepted'>): boolean {
  const answer = normalizeAnswer(value);
  return Boolean(answer) && word.accepted.some((item) => normalizeAnswer(item) === answer);
}

export const DEFAULT_SETTINGS: LearningSettings = {
  dailyNew: 10,
  dailyGoal: 20,
  voiceRate: 0.85,
  theme: 'system',
};

function uniqueStrings(values: unknown[]): string[] {
  return [...new Set(values.map((item) => String(item ?? '').trim()).filter(Boolean))];
}

function normalizeCategory(value: unknown): string {
  const category = String(value ?? '').trim();
  return !category || category === LEGACY_UNCATEGORIZED ? 'Uncategorized' : category;
}

export interface WordSource extends Partial<LearningWord> {
  term?: string;
  accepted?: string[];
  lesson?: string;
}

export function createWord(source: WordSource, index = 0, now = new Date()): LearningWord {
  const acceptedSource = Array.isArray(source.accepted)
    ? source.accepted
    : String(source.term ?? '').split(/\s+\/\s+/u);
  const accepted = uniqueStrings(acceptedSource);
  const lessons = uniqueStrings(Array.isArray(source.lessons) ? source.lessons : source.lesson ? [source.lesson] : []);
  const tags = uniqueStrings(Array.isArray(source.tags) ? source.tags : []);
  return {
    id: source.id || globalThis.crypto?.randomUUID?.() || `word-${Date.now()}-${index}`,
    number: Number(source.number) || index + 1,
    term: accepted[0] || String(source.term ?? '').trim(),
    accepted,
    category: normalizeCategory(source.category),
    tags,
    lessons,
    notes: source.notes || '',
    createdAt: source.createdAt || now.toISOString(),
    box: clamp(Number(source.box) || 0, 0, 5),
    due: source.due || null,
    attempts: Number(source.attempts) || 0,
    correct: Number(source.correct) || 0,
    mistakes: Number(source.mistakes) || 0,
    currentStreak: Number(source.currentStreak) || 0,
    introducedOn: source.introducedOn || null,
    addedSource: source.addedSource || null,
    lastReviewed: source.lastReviewed || null,
    lastPromotedDay: source.lastPromotedDay || null,
    blockedUntil: source.blockedUntil || null,
    masteredAt: Number(source.box) === 5 && !source.due ? source.masteredAt || null : null,
  };
}

export function createFreshState(sources: WordSource[], now = new Date()): LearningState {
  const timestamp = now.toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
    settings: { ...DEFAULT_SETTINGS },
    words: sources.map((source, index) => createWord(source, index, now)),
    daily: {},
    history: [],
  };
}

export function hydrateState(input: LearningState): LearningState {
  if (!input || !Array.isArray(input.words)) throw new Error('Invalid learning state');
  const sourceVersion = Number(input.schemaVersion) || 1;
  const state: LearningState = {
    ...input,
    schemaVersion: SCHEMA_VERSION,
    settings: { ...DEFAULT_SETTINGS, ...(input.settings || {}) },
    words: input.words.map((word, index) => createWord(word, index)),
    daily: input.daily || {},
    history: Array.isArray(input.history) ? input.history : [],
  };
  if (sourceVersion < 2) migrateLegacyProgress(state);
  return state;
}

export function todayRecord(state: LearningState, day: string): DailyRecord {
  const existing = state.daily[day] || {} as Partial<DailyRecord>;
  const record: DailyRecord = {
    attempts: Number(existing.attempts) || 0,
    correct: Number(existing.correct) || 0,
    wrong: Number(existing.wrong) || 0,
    newAdded: Number(existing.newAdded) || 0,
    sessions: Number(existing.sessions) || 0,
    durationSeconds: Number(existing.durationSeconds) || 0,
  };
  if (!Object.prototype.hasOwnProperty.call(existing, 'newAdded')) {
    record.newAdded = state.words.filter((word) => word.introducedOn === day).length;
  }
  state.daily[day] = record;
  return record;
}

export function activateUnseenWords(
  input: LearningState,
  words: LearningWord[],
  source = 'manual',
  day = localDay(),
): { state: LearningState; activated: LearningWord[] } {
  const state = structuredClone(input);
  const ids = new Set(words.map((word) => word.id));
  const activated: LearningWord[] = [];
  for (const word of state.words) {
    if (!ids.has(word.id) || word.box !== 0 || word.introducedOn) continue;
    word.box = 1;
    word.introducedOn = day;
    word.due = day;
    word.blockedUntil = null;
    word.lastPromotedDay = null;
    word.addedSource = source;
    activated.push(word);
  }
  todayRecord(state, day).newAdded += activated.length;
  return { state, activated };
}

export function ensureDailyWords(input: LearningState, day = localDay()): { state: LearningState; activated: LearningWord[] } {
  const state = structuredClone(input);
  const daily = todayRecord(state, day);
  const alreadyAdded = state.words.filter((word) => word.introducedOn === day).length;
  daily.newAdded = Math.max(daily.newAdded, alreadyAdded);
  const remaining = Math.max(0, state.settings.dailyNew - daily.newAdded);
  if (!remaining) return { state, activated: [] };
  const newcomers = state.words
    .filter((word) => word.box === 0 && !word.introducedOn)
    .sort((a, b) => a.number - b.number)
    .slice(0, remaining);
  return activateUnseenWords(state, newcomers, 'daily', day);
}

export function isActiveLeitnerWord(word: LearningWord): boolean {
  return word.box > 0 && !word.masteredAt;
}

export function getDueWords(state: LearningState, day = localDay()): LearningWord[] {
  return state.words
    .filter((word) => word.box > 0 && !word.masteredAt && word.due && word.due <= day && (!word.blockedUntil || word.blockedUntil <= day))
    .sort((a, b) => (a.due || '').localeCompare(b.due || '') || b.mistakes - a.mistakes || a.number - b.number);
}

export function accuracy(correct: number, attempts: number): number | null {
  return attempts ? Math.round((correct / attempts) * 100) : null;
}

export function totalStats(state: LearningState): { attempts: number; correct: number; mistakes: number; mastered: number; learning: number } {
  return state.words.reduce((sum, word) => {
    sum.attempts += word.attempts;
    sum.correct += word.correct;
    sum.mistakes += word.mistakes;
    if (word.masteredAt) sum.mastered += 1;
    if (isActiveLeitnerWord(word)) sum.learning += 1;
    return sum;
  }, { attempts: 0, correct: 0, mistakes: 0, mastered: 0, learning: 0 });
}

export function calculateStreak(state: LearningState, now = new Date()): number {
  let streak = 0;
  const cursor = new Date(now);
  if (!(state.daily[localDay(cursor)]?.attempts > 0)) cursor.setDate(cursor.getDate() - 1);
  while (state.daily[localDay(cursor)]?.attempts > 0) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function hardWords(state: LearningState, limit = 20): LearningWord[] {
  return state.words
    .filter((word) => word.mistakes > 0)
    .sort((a, b) => b.mistakes - a.mistakes || a.correct - b.correct || a.number - b.number)
    .slice(0, limit);
}

export function boxOnePracticeWeight(word: LearningWord): number {
  return 1 + Math.min(Math.max(Number(word.mistakes) || 0, 0), 8) * 2;
}

export function buildWeightedBoxOneCycle(
  words: LearningWord[],
  excludeId: string | null = null,
  random: () => number = Math.random,
): string[] {
  const remaining = words.filter((word) => word.box === 1 && !word.masteredAt).map((word) => ({ ...word }));
  const result: string[] = [];
  while (remaining.length) {
    const candidates = !result.length && excludeId && remaining.length > 1
      ? remaining.filter((word) => word.id !== excludeId)
      : remaining;
    const totalWeight = candidates.reduce((sum, word) => sum + boxOnePracticeWeight(word), 0);
    let cursor = random() * totalWeight;
    let selected = candidates[candidates.length - 1];
    for (const word of candidates) {
      cursor -= boxOnePracticeWeight(word);
      if (cursor <= 0) { selected = word; break; }
    }
    result.push(selected.id);
    remaining.splice(remaining.findIndex((word) => word.id === selected.id), 1);
  }
  return result;
}

export interface ReviewTransition {
  state: LearningState;
  word: LearningWord;
  event: ReviewEvent;
  daily: DailyRecord;
}

export function applyReview(
  input: LearningState,
  wordId: string,
  answer: string,
  mode: ReviewMode,
  now = new Date(),
  forcedWrong = false,
): ReviewTransition {
  const state = structuredClone(input);
  const word = state.words.find((item) => item.id === wordId);
  if (!word) throw new Error(`Word ${wordId} does not exist.`);
  const correct = !forcedWrong && isCorrectAnswer(answer, word);
  const day = localDay(now);
  const reviewedAt = now.toISOString();
  const previousBox = word.box;
  const isFreePractice = mode === 'box1';
  const canGraduateNewBoxOne = previousBox === 1 && word.mistakes === 0 && !word.lastPromotedDay;
  let promoted = false;

  word.attempts += 1;
  word.lastReviewed = reviewedAt;
  if (correct) {
    word.correct += 1;
    word.currentStreak += 1;
    const eligible = (!isFreePractice || canGraduateNewBoxOne)
      && Boolean(word.due && word.due <= day)
      && (!word.blockedUntil || word.blockedUntil <= day)
      && (previousBox === 5 || word.lastPromotedDay !== day);
    if (eligible) {
      promoted = true;
      word.lastPromotedDay = day;
      word.blockedUntil = null;
      if (previousBox === 5) {
        word.due = null;
        word.masteredAt = reviewedAt;
      } else {
        word.box = Math.min(5, Math.max(1, word.box + 1));
        word.due = addDays(day, BOX_WAIT_DAYS[word.box] || 1);
        word.masteredAt = null;
      }
    }
  } else {
    word.mistakes += 1;
    word.currentStreak = 0;
    word.box = 1;
    word.due = addDays(day, 1);
    word.blockedUntil = addDays(day, 1);
    word.masteredAt = null;
  }

  const daily = todayRecord(state, day);
  daily.attempts += 1;
  if (correct) daily.correct += 1;
  else daily.wrong += 1;

  const event: ReviewEvent = {
    at: reviewedAt,
    day,
    wordId: word.id,
    term: word.term,
    answer: String(answer || ''),
    correct,
    mode,
    promoted,
    previousBox,
    newBox: word.box,
    mistakeNumber: correct ? null : word.mistakes,
  };
  state.history.push(event);
  if (state.history.length > 20000) state.history = state.history.slice(-20000);
  state.updatedAt = reviewedAt;
  return { state, word, event, daily };
}

export function migrateLegacyProgress(state: LearningState): void {
  const eventsByWord = new Map<string, ReviewEvent[]>();
  for (const event of state.history) {
    if (!event.wordId) continue;
    const list = eventsByWord.get(event.wordId) || [];
    list.push(event);
    eventsByWord.set(event.wordId, list);
  }
  for (const word of state.words) {
    const events = (eventsByWord.get(word.id) || []).sort((a, b) => String(a.at || a.day).localeCompare(String(b.at || b.day)));
    if (!events.length) continue;
    const first = events[0];
    const firstDay = first.day || localDay(new Date(first.at));
    word.box = 1;
    word.introducedOn = firstDay;
    word.due = firstDay;
    word.lastPromotedDay = null;
    word.blockedUntil = null;
    word.masteredAt = null;
    for (const event of events) {
      const day = event.day || localDay(new Date(event.at));
      if (!event.correct) {
        word.box = 1;
        word.due = addDays(day, 1);
        word.blockedUntil = addDays(day, 1);
        word.masteredAt = null;
        continue;
      }
      const eligible = Boolean(word.due && word.due <= day)
        && (!word.blockedUntil || word.blockedUntil <= day)
        && (word.box === 5 || word.lastPromotedDay !== day);
      if (!eligible) continue;
      word.lastPromotedDay = day;
      word.blockedUntil = null;
      if (word.box === 5) {
        word.due = null;
        word.masteredAt = event.at;
      } else {
        word.box = Math.min(5, word.box + 1);
        word.due = addDays(day, BOX_WAIT_DAYS[word.box] || 1);
      }
    }
  }
}

export function parseWordFile(text: string): WordSource[] {
  const lines = String(text).split(/\r?\n/u);
  let category = 'Uncategorized';
  const results: WordSource[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    const heading = line.match(/^#{1,6}\s+(.+?)\s*$/u);
    if (heading) { category = heading[1].replace(/\*+/gu, '').trim(); continue; }
    const numbered = line.match(/^\s*(\d+)[.)-]\s+(.+?)\s*$/u);
    const bullet = line.match(/^[-*+]\s+(.+?)\s*$/u);
    const plain = !numbered && !bullet && line && !/^\*|^>|^#/u.test(line) ? line : null;
    const value = numbered?.[2] || bullet?.[1] || plain;
    if (!value || value.length > 160) continue;
    const cleaned = value.replace(/\*+/gu, '').trim();
    if (!cleaned || /^(british spelling|\d+ study items)/iu.test(cleaned)) continue;
    const accepted = cleaned.split(/\s+\/\s+/u).map((part) => part.trim()).filter(Boolean);
    if (accepted.length) results.push({ number: Number(numbered?.[1]) || results.length + 1, term: accepted[0], accepted, category });
  }
  return results;
}

export function mergeImportedWords(stateInput: LearningState, text: string): { state: LearningState; found: number; added: number; skipped: number } {
  const parsed = parseWordFile(text);
  if (!parsed.length) throw new Error('No valid words were found in the file.');
  const state = structuredClone(stateInput);
  const existing = new Set(state.words.flatMap((word) => word.accepted.length ? word.accepted : [word.term]).map(normalizeAnswer));
  let added = 0;
  for (const item of parsed) {
    const spellings = (item.accepted?.length ? item.accepted : [item.term || '']).map(normalizeAnswer).filter(Boolean);
    if (spellings.some((spelling) => existing.has(spelling))) continue;
    state.words.push(createWord(item, state.words.length));
    spellings.forEach((spelling) => existing.add(spelling));
    added += 1;
  }
  return { state, found: parsed.length, added, skipped: parsed.length - added };
}
