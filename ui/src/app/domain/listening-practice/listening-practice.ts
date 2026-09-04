export type ListeningTaskType =
  | 'note_completion'
  | 'multiple_choice_single'
  | 'sentence_completion'
  | 'short_answer';

export interface ListeningLessonBase {
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

export interface ListeningAudioProgressSegment {
  id: string;
  label: string;
  questionCount: number;
  startQuestion: number;
  endQuestion: number;
  startProgress: number;
  endProgress: number;
}

export interface ListeningAudioProgress {
  progress: number;
  segments: ListeningAudioProgressSegment[];
  activeSegmentId: string | null;
  currentRangeLabel: string;
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

/**
 * Maps chronological IELTS question groups onto the episode timeline.
 *
 * The BBC content currently has no per-question timestamps, so this projection is
 * intentionally approximate: each question receives an equal share of the audio
 * duration and the authored group order provides the learner-facing ranges.
 */
export function buildListeningAudioProgress(
  test: ListeningTest,
  currentTime: number,
  duration: number,
): ListeningAudioProgress {
  const orderedGroups = [...test.groups]
    .sort((left, right) => left.position - right.position)
    .filter((group) => group.questions.length > 0);
  const totalQuestions = orderedGroups.reduce((total, group) => total + group.questions.length, 0);
  let traversedQuestions = 0;

  const segments = orderedGroups.map<ListeningAudioProgressSegment>((group) => {
    const orderedQuestions = [...group.questions].sort((left, right) => left.number - right.number);
    const startQuestion = orderedQuestions[0].number;
    const endQuestion = orderedQuestions[orderedQuestions.length - 1].number;
    const startProgress = totalQuestions > 0 ? traversedQuestions / totalQuestions : 0;
    traversedQuestions += orderedQuestions.length;
    const endProgress = totalQuestions > 0 ? traversedQuestions / totalQuestions : 0;

    return {
      id: group.id,
      label: shortQuestionRange(startQuestion, endQuestion),
      questionCount: orderedQuestions.length,
      startQuestion,
      endQuestion,
      startProgress,
      endProgress,
    };
  });

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const safeCurrentTime = Number.isFinite(currentTime) && currentTime > 0 ? currentTime : 0;
  const progress = safeDuration > 0 ? clampUnitInterval(safeCurrentTime / safeDuration) : 0;
  const activeSegment = segments.find((segment, index) =>
    progress < segment.endProgress || index === segments.length - 1
  ) ?? null;

  return {
    progress,
    segments,
    activeSegmentId: activeSegment?.id ?? null,
    currentRangeLabel: activeSegment
      ? longQuestionRange(activeSegment.startQuestion, activeSegment.endQuestion)
      : 'Questions —',
  };
}

function clampUnitInterval(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function shortQuestionRange(startQuestion: number, endQuestion: number): string {
  return startQuestion === endQuestion ? `Q${startQuestion}` : `Q${startQuestion}–${endQuestion}`;
}

function longQuestionRange(startQuestion: number, endQuestion: number): string {
  return startQuestion === endQuestion
    ? `Question ${startQuestion}`
    : `Questions ${startQuestion}–${endQuestion}`;
}
