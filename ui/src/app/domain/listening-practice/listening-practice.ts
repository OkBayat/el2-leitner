export type ListeningEpisodeLevel = 'elementary' | 'intermediate' | 'advanced';
export type ListeningTestDifficulty = 'very_easy' | 'easy' | 'medium' | 'hard' | 'very_hard';

export const LISTENING_LEVEL_LABELS: Record<ListeningEpisodeLevel, string> = {
  elementary: 'Elementary', intermediate: 'Intermediate', advanced: 'Advanced',
};
export const LISTENING_DIFFICULTY_LABELS: Record<ListeningTestDifficulty, string> = {
  very_easy: 'Very easy', easy: 'Easy', medium: 'Medium', hard: 'Hard', very_hard: 'Very hard',
};

export function listeningLevelLabel(level?: ListeningEpisodeLevel): string {
  return LISTENING_LEVEL_LABELS[level ?? 'intermediate'];
}
export function listeningDifficultyLabel(difficulty?: ListeningTestDifficulty): string {
  return LISTENING_DIFFICULTY_LABELS[difficulty ?? 'medium'];
}

export type ListeningTaskType =
  | 'note_completion'
  | 'multiple_choice_single'
  | 'sentence_completion'
  | 'short_answer';

export interface ListeningLessonBase {
  level?: ListeningEpisodeLevel;
  imageUrl?: string | null;
  vocabularyCollectionId?: string | null;
  id: string;
  slug: string;
  title: string;
  description: string | null;
  episodeCode: string | null;
  episodeDate: string | null;
  sourceUrl: string;
  questionCount: number;
  testCount: number;
}

export interface ListeningTestSummary {
  format?: 'ielts';
  difficulty?: ListeningTestDifficulty;
  id: string;
  title: string;
  position: number;
  questionCount: number;
  completed: boolean;
  completedAt: string | null;
}

export interface ListeningLessonSummary extends ListeningLessonBase {
  tests: ListeningTestSummary[];
}

export interface ListeningLesson extends ListeningLessonBase {
  audioUrl: string;
}

interface ListeningQuestionBase {
  id: string;
  number: number;
  position: number;
  prompt: string;
}

export interface ListeningTextQuestion extends ListeningQuestionBase {
  responseType: 'text';
}

export interface ListeningChoiceOption {
  id: string;
  label: string;
  text: string;
}

export interface ListeningChoiceQuestion extends ListeningQuestionBase {
  responseType: 'single_choice';
  options: ListeningChoiceOption[];
}

export type ListeningQuestion = ListeningTextQuestion | ListeningChoiceQuestion;

export interface ListeningQuestionGroup {
  id: string;
  position: number;
  heading: string;
  taskType: ListeningTaskType;
  instruction: string;
  answerInstruction: string;
  maxWords: number | null;
  maxNumbers: number | null;
  questions: ListeningQuestion[];
}

export interface ListeningTest {
  format?: 'ielts';
  difficulty?: ListeningTestDifficulty;
  id: string;
  title: string;
  position: number;
  questionCount: number;
  groups: ListeningQuestionGroup[];
}

export interface ListeningAttempt {
  id: string;
  testId: string;
  status: 'active' | 'completed';
  startedAt: string;
  submittedAt?: string | null;
  totalQuestions: number;
}

export interface ListeningLessonListResponse {
  provider: 'bbc_6_minute_english';
  lessons: ListeningLessonSummary[];
}

export interface ListeningAttemptStartResponse {
  attempt: ListeningAttempt;
  lesson: ListeningLesson;
  test: ListeningTest;
}

export interface ListeningSubmittedAnswer {
  questionId: string;
  value: string;
}

export interface ListeningQuestionResult {
  questionId: string;
  number: number;
  responseType: 'text' | 'single_choice';
  correct: boolean;
  submittedAnswer: string;
  correctAnswer: string;
}

export interface ListeningScore {
  correct: number;
  wrong: number;
  total: number;
  percentage: number;
}

export interface ListeningAttemptResult {
  attempt: ListeningAttempt;
  score: ListeningScore;
  results: ListeningQuestionResult[];
}

export interface ListeningPromptParts {
  before: string;
  after: string;
}

export function allListeningQuestions(test: ListeningTest): ListeningQuestion[] {
  return test.groups
    .flatMap((group) => group.questions)
    .sort((left, right) => left.number - right.number);
}

export function splitListeningBlankPrompt(prompt: string): ListeningPromptParts {
  const parts = prompt.split('{{blank}}');
  if (parts.length !== 2) throw new Error('A text listening question must contain exactly one blank.');
  return { before: parts[0], after: parts[1] };
}

export function isListeningChoiceQuestion(question: ListeningQuestion): question is ListeningChoiceQuestion {
  return question.responseType === 'single_choice';
}

export function countAnsweredListeningQuestions(
  test: ListeningTest,
  values: Record<string, string>,
): number {
  return allListeningQuestions(test).filter((question) => String(values[question.id] ?? '').trim()).length;
}

export function buildListeningSubmission(
  test: ListeningTest,
  values: Record<string, string>,
): ListeningSubmittedAnswer[] {
  return allListeningQuestions(test).map((question) => ({
    questionId: question.id,
    value: String(values[question.id] ?? ''),
  }));
}

export interface ListeningVocabularyEntry {
  id: string;
  vocabularyId: string;
  term: string;
  definitions: string[];
  examples: string[];
  progress: { state: 'new' | 'learning' | 'mastered' | 'excluded'; box: number };
}

export interface ListeningVocabularyResponse {
  episode: { id: string; slug: string; title: string; level: ListeningEpisodeLevel };
  collectionId: string;
  subscribed: boolean;
  entries: ListeningVocabularyEntry[];
}
