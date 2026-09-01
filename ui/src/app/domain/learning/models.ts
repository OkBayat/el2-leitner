export type ThemeMode = 'system' | 'light' | 'dark';
export type ReviewMode = 'review' | 'box1' | 'new';

export interface User {
  id: string | number;
  email: string;
}

export interface LearningSettings {
  dailyNew: number;
  dailyGoal: number;
  voiceRate: number;
  theme: ThemeMode;
}

export interface LearningWord {
  id: string;
  number: number;
  term: string;
  accepted: string[];
  category: string;
  tags: string[];
  lessons: string[];
  notes: string;
  createdAt: string;
  box: number;
  due: string | null;
  attempts: number;
  correct: number;
  mistakes: number;
  currentStreak: number;
  introducedOn: string | null;
  addedSource: string | null;
  lastReviewed: string | null;
  lastPromotedDay: string | null;
  blockedUntil: string | null;
  masteredAt: string | null;
}

export interface DailyRecord {
  attempts: number;
  correct: number;
  wrong: number;
  newAdded: number;
  sessions: number;
  durationSeconds: number;
}

export interface ReviewEvent {
  at: string;
  day: string;
  wordId: string;
  term: string;
  answer: string;
  correct: boolean;
  mode: ReviewMode;
  promoted: boolean;
  previousBox: number | null;
  newBox: number | null;
  mistakeNumber: number | null;
}

export interface LearningState {
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  settings: LearningSettings;
  words: LearningWord[];
  daily: Record<string, DailyRecord>;
  history: ReviewEvent[];
}

export interface LearningStateResponse {
  state: LearningState | null;
  revision: number;
}

export interface ReviewCommand {
  revision: number;
  practiceSessionId: string | null;
  word: Pick<LearningWord,
    'id' | 'box' | 'due' | 'attempts' | 'correct' | 'mistakes' | 'currentStreak' |
    'introducedOn' | 'addedSource' | 'lastReviewed' | 'lastPromotedDay' | 'blockedUntil' | 'masteredAt'>;
  event: ReviewEvent;
  daily: DailyRecord;
}

export interface LibraryEntry {
  id: string;
  term?: string;
  accepted?: string[];
  category?: string;
  notes?: string;
  section?: string;
  lesson?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface LibraryCollection {
  id: string;
  slug: string;
  title: string;
  description?: string;
  kind: string;
  visibility: string;
  status: string;
  contentVersion: number;
  wordCount: number;
  leitnerWordCount?: number;
  subscribed: boolean;
  metadata?: Record<string, unknown>;
  updatedAt?: string;
  sections?: unknown[];
  entries?: LibraryEntry[];
}
