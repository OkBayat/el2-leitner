export type PathActivity = 'vocabulary' | 'listening' | 'shadowing' | 'reading';
export type PathStepId = PathActivity | 'reserved-5' | 'reserved-6';
export type PathStatus = 'practiced' | 'in-progress' | 'available' | 'upcoming' | 'planned';

export interface VocabularyProgress {
  completed: number;
  total: number;
}

export interface ListeningProgress {
  completed: number;
  total: number;
}

export type ListeningSegmentState = 'pending' | 'complete' | 'legendary';

export interface ListeningRingSegment {
  index: number;
  state: ListeningSegmentState;
}

export interface TimelineDay {
  day: string;
  activities: PathActivity[];
  boxOnePracticed: boolean;
  vocabularyProgress?: VocabularyProgress;
  listeningProgress?: ListeningProgress;
}

export interface TimelinePage {
  today: string;
  days: TimelineDay[];
  nextBefore: string | null;
  limitedHistory: boolean;
}

export interface PathStep {
  id: PathStepId;
  label: string;
  route: string | null;
  status: PathStatus;
  current: boolean;
  progress: number | null;
  listeningProgress: ListeningProgress | null;
  legendary: boolean;
}

export interface PathDay {
  day: string;
  title: string;
  dateLabel: string;
  today: boolean;
  future: boolean;
  mirrored: boolean;
  palette: string;
  boxOnePracticed: boolean;
  steps: PathStep[];
}

export const DEFAULT_DAILY_LISTENING_GOAL = 3;
export const MAX_DAILY_LISTENING_GOAL = 12;

const STEPS: ReadonlyArray<Pick<PathStep, 'id' | 'label' | 'route'>> = [
  { id: 'vocabulary', label: 'Vocabulary review', route: '/review' },
  { id: 'listening', label: 'Listening', route: '/bbc-6-minute-english' },
  { id: 'shadowing', label: 'Shadowing', route: '/shadowing' },
  { id: 'reading', label: 'Reading', route: null },
  { id: 'reserved-5', label: 'Activity 5', route: null },
  { id: 'reserved-6', label: 'Activity 6', route: null },
];

function progressPercent(progress?: VocabularyProgress): number | null {
  const total = Number(progress?.total);
  if (!Number.isFinite(total) || total <= 0) return null;
  const completed = Math.min(total, Math.max(0, Number(progress?.completed) || 0));
  return Math.round((completed / total) * 100);
}

export function normalizeDailyListeningGoal(value: unknown): number | null {
  const goal = Number(value);
  if (!Number.isSafeInteger(goal) || goal < 1 || goal > MAX_DAILY_LISTENING_GOAL) return null;
  return goal;
}

function safeListeningProgress(progress?: ListeningProgress | null): ListeningProgress | null {
  const total = Number(progress?.total);
  const completed = Number(progress?.completed);
  if (!Number.isSafeInteger(total) || total < 1 || !Number.isSafeInteger(completed) || completed < 0) return null;
  return { completed, total };
}

export function listeningRingSegments(progress: ListeningProgress | null | undefined): ListeningRingSegment[] {
  const safe = safeListeningProgress(progress);
  if (!safe) return [];
  const count = Math.max(safe.total, safe.completed);
  return Array.from({ length: count }, (_, index) => ({
    index,
    state: index >= safe.total && index < safe.completed
      ? 'legendary'
      : index < Math.min(safe.completed, safe.total) ? 'complete' : 'pending',
  }));
}

export function nextPathDay(day: string, amount = 1): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + amount * 86_400_000).toISOString().slice(0, 10);
}

export function buildDailyPath(
  records: TimelineDay[],
  today: string,
  dailyListeningGoal?: number | null,
): PathDay[] {
  if (!today) return [];
  const configuredListeningGoal = normalizeDailyListeningGoal(dailyListeningGoal);
  const byDay = new Map(records.filter(record => record.day <= today).map(record => [record.day, record]));
  for (const offset of [1, 2]) {
    const day = nextPathDay(today, offset);
    byDay.set(day, { day, activities: [], boxOnePracticed: false });
  }
  const formatter = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)).map(record => {
    const isToday = record.day === today;
    const future = record.day > today;
    const ordinal = Math.floor(Date.parse(`${record.day}T12:00:00Z`) / 86_400_000);
    const serverListeningProgress = safeListeningProgress(record.listeningProgress);
    const todayListeningProgress: ListeningProgress = {
      completed: serverListeningProgress?.completed ?? (record.activities.includes('listening') ? 1 : 0),
      total: configuredListeningGoal ?? serverListeningProgress?.total ?? DEFAULT_DAILY_LISTENING_GOAL,
    };
    let currentAssigned = false;
    const steps: PathStep[] = STEPS.map(step => {
      const progress = isToday && step.id === 'vocabulary' ? progressPercent(record.vocabularyProgress) : null;
      const listeningProgress = isToday && step.id === 'listening' ? todayListeningProgress : null;
      const listeningComplete = Boolean(listeningProgress && listeningProgress.completed >= listeningProgress.total);
      const status: PathStatus = future ? 'upcoming' : !step.route ? 'planned'
        : listeningProgress ? listeningComplete ? 'practiced' : listeningProgress.completed > 0 ? 'in-progress' : 'available'
        : progress !== null ? progress >= 100 ? 'practiced' : progress > 0 ? 'in-progress' : 'available'
        : record.activities.includes(step.id as PathActivity) ? 'practiced' : 'available';
      const current = isToday && (status === 'available' || status === 'in-progress') && !currentAssigned;
      if (current) currentAssigned = true;
      return {
        ...step,
        status,
        current,
        progress,
        listeningProgress,
        legendary: Boolean(isToday && step.id === 'listening' && listeningComplete),
      };
    });
    const dateLabel = formatter.format(new Date(`${record.day}T12:00:00Z`));
    return {
      day: record.day, dateLabel, title: isToday ? "Today's plan" : record.day === nextPathDay(today) ? 'Tomorrow' : future ? 'Coming up' : dateLabel,
      today: isToday, future, mirrored: ordinal % 2 === 1,
      palette: isToday ? 'orange' : ['green', 'blue', 'purple'][ordinal % 3],
      boxOnePracticed: !future && record.boxOnePracticed, steps,
    };
  });
}
