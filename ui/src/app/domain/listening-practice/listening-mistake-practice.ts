import { LearningState, LearningWord } from '../learning/models';
import { createWord, localDay, normalizeAnswer, todayRecord } from '../learning/learning-rules';
import { ListeningQuestionResult } from './listening-practice';

export const LISTENING_MISTAKE_CATEGORY = 'Listening mistakes';
export const LISTENING_MISTAKE_SOURCE = 'listening-mistake';

const SINGLE_LEXICAL_WORD = /^\p{L}+(?:['’-]\p{L}+)*$/u;

export interface ListeningMistakeCapture {
  state: LearningState;
  word: LearningWord;
  created: boolean;
  newlyIntroduced: boolean;
}

export function listeningVocabularyCandidate(
  result: Pick<ListeningQuestionResult, 'correct' | 'responseType' | 'correctAnswer'>,
): string | null {
  if (result.correct || result.responseType !== 'text') return null;
  const answer = String(result.correctAnswer || '').normalize('NFKC').trim();
  return SINGLE_LEXICAL_WORD.test(answer) ? answer : null;
}

export function captureListeningMistakeInHouseOne(
  input: LearningState,
  rawTerm: string,
  now = new Date(),
): ListeningMistakeCapture {
  const term = String(rawTerm || '').normalize('NFKC').trim();
  if (!SINGLE_LEXICAL_WORD.test(term)) throw new Error('Only one vocabulary word can be added to House 1.');

  const normalized = normalizeAnswer(term);
  const state = structuredClone(input);
  const day = localDay(now);
  let word = state.words.find((item) =>
    normalizeAnswer(item.term) === normalized
    || item.accepted.some((accepted) => normalizeAnswer(accepted) === normalized)
  );
  const created = !word;
  const newlyIntroduced = !word || (word.box === 0 && !word.introducedOn);

  if (!word) {
    const nextNumber = Math.max(0, ...state.words.map((item) => Number(item.number) || 0)) + 1;
    word = createWord({
      term,
      accepted: [term],
      category: LISTENING_MISTAKE_CATEGORY,
      number: nextNumber,
      box: 1,
      due: day,
      introducedOn: day,
      addedSource: LISTENING_MISTAKE_SOURCE,
    }, state.words.length, now);
    state.words.push(word);
  } else {
    word.box = 1;
    word.due = day;
    word.currentStreak = 0;
    word.blockedUntil = null;
    word.lastPromotedDay = null;
    word.masteredAt = null;
    word.introducedOn ||= day;
    word.addedSource = LISTENING_MISTAKE_SOURCE;
  }

  if (newlyIntroduced) todayRecord(state, day).newAdded += 1;
  state.updatedAt = now.toISOString();
  return { state, word, created, newlyIntroduced };
}
