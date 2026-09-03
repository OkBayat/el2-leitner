import { LearningState, LearningWord } from '../learning/models';
import { createWord, localDay, normalizeAnswer, todayRecord } from '../learning/learning-rules';
import { ListeningQuestionResult } from './listening-practice';

export const LISTENING_MISTAKE_CATEGORY = 'Listening mistakes';
export const LISTENING_MISTAKE_SOURCE = 'listening-mistake';

const HAS_LETTER = /\p{L}/u;
const HAS_NUMBER = /\p{N}/u;
const CHOICE_LABEL_PREFIX = /^[A-Z]\.\s*/u;

export interface ListeningMistakeCapture {
  state: LearningState;
  word: LearningWord;
  created: boolean;
  newlyIntroduced: boolean;
}

function normalizeVocabularyCandidate(value: unknown, responseType?: ListeningQuestionResult['responseType']): string | null {
  let answer = String(value ?? '')
    .normalize('NFKC')
    .replace(/\s+/gu, ' ')
    .trim();
  if (responseType === 'single_choice') answer = answer.replace(CHOICE_LABEL_PREFIX, '').trim();
  if (!answer || HAS_NUMBER.test(answer) || !HAS_LETTER.test(answer)) return null;
  return answer;
}

export function listeningVocabularyCandidate(
  result: Pick<ListeningQuestionResult, 'correct' | 'responseType' | 'correctAnswer'>,
): string | null {
  if (result.correct) return null;
  return normalizeVocabularyCandidate(result.correctAnswer, result.responseType);
}

export function captureListeningMistakeInHouseOne(
  input: LearningState,
  rawTerm: string,
  now = new Date(),
): ListeningMistakeCapture {
  const term = normalizeVocabularyCandidate(rawTerm);
  if (!term) throw new Error('Only non-numeric vocabulary answers can be added to House 1.');

  const normalized = normalizeAnswer(term);
  const state = structuredClone(input);
  const day = localDay(now);
  let word = state.words.find((item) =>
    normalizeAnswer(item.term) === normalized
    || item.accepted.some((accepted) => normalizeAnswer(accepted) === normalized)
  );
  const created = !word;
  const newlyIntroduced = !word || (word.box === 0 && !word.introducedOn);
  const daily = newlyIntroduced ? todayRecord(state, day) : null;

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

  if (daily) daily.newAdded += 1;
  state.updatedAt = now.toISOString();
  return { state, word, created, newlyIntroduced };
}
