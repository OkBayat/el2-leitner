import { LearningState } from '../../domain/learning/models';
import { accuracy, calculateStreak, localDay, totalStats } from '../../domain/learning/learning-rules';

export type ShareMomentKind = 'daily' | 'journey';

export interface ShareMoment {
  kind: ShareMomentKind;
  title: string;
  subtitle: string;
  primaryValue: string;
  primaryLabel: string;
  secondaryValue: string;
  secondaryLabel: string;
  caption: string;
}

export function buildShareMoment(state: LearningState, kind: ShareMomentKind): ShareMoment {
  const stats = totalStats(state);
  const streak = calculateStreak(state);
  const today = state.daily[localDay()] || { attempts: 0, correct: 0, wrong: 0, newAdded: 0, sessions: 0, durationSeconds: 0 };
  if (kind === 'journey') {
    return {
      kind,
      title: 'مسیر یادگیری من در Vocora',
      subtitle: 'پیشرفت واقعی، قدم‌به‌قدم',
      primaryValue: String(stats.mastered),
      primaryLabel: 'واژهٔ مسلط‌شده',
      secondaryValue: `${accuracy(stats.correct, stats.attempts) ?? 0}٪`,
      secondaryLabel: 'دقت کلی',
      caption: `در Vocora تا امروز ${stats.mastered} واژه را به تسلط رسانده‌ام و ${streak} روز پیوستگی دارم.`,
    };
  }
  const todayAccuracy = accuracy(today.correct, today.attempts) ?? 0;
  return {
    kind,
    title: today.attempts ? 'تمرین امروز من در Vocora' : 'شروع مسیر من در Vocora',
    subtitle: today.attempts ? 'یک جلسهٔ دیگر برای بهتر شدن' : 'از امروز شروع می‌کنم',
    primaryValue: String(today.attempts),
    primaryLabel: 'پاسخ امروز',
    secondaryValue: `${todayAccuracy}٪`,
    secondaryLabel: 'دقت امروز',
    caption: today.attempts
      ? `امروز ${today.attempts} پاسخ در Vocora ثبت کردم؛ دقت امروز من ${todayAccuracy}٪ بود.`
      : 'امروز مسیر یادگیری واژگانم را در Vocora شروع کردم.',
  };
}
