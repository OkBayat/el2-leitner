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
      title: 'My Vocora learning journey',
      subtitle: 'Real progress, one step at a time',
      primaryValue: String(stats.mastered),
      primaryLabel: 'mastered words',
      secondaryValue: `${accuracy(stats.correct, stats.attempts) ?? 0}%`,
      secondaryLabel: 'overall accuracy',
      caption: `I've mastered ${stats.mastered} words in Vocora and kept a ${streak}-day streak.`,
    };
  }
  const todayAccuracy = accuracy(today.correct, today.attempts) ?? 0;
  return {
    kind,
    title: today.attempts ? 'My Vocora practice today' : 'My Vocora journey starts today',
    subtitle: today.attempts ? 'One more session to get better' : 'Starting today',
    primaryValue: String(today.attempts),
    primaryLabel: 'answers today',
    secondaryValue: `${todayAccuracy}%`,
    secondaryLabel: 'accuracy today',
    caption: today.attempts
      ? `I logged ${today.attempts} answers in Vocora today with ${todayAccuracy}% accuracy.`
      : 'I started my vocabulary learning journey in Vocora today.',
  };
}
