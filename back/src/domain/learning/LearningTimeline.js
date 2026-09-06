import { ValidationError } from '../errors.js';

const ACTIVITIES = ['vocabulary', 'listening', 'shadowing'];
const DAY_MS = 86_400_000;

export function shiftDay(day, amount) {
  return new Date(Date.parse(`${day}T12:00:00Z`) + amount * DAY_MS).toISOString().slice(0, 10);
}

function validDay(day) {
  return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(day)
    && day >= '1970-01-01' && Number.isFinite(Date.parse(`${day}T12:00:00Z`))
    && shiftDay(day, 0) === day;
}

function dayFormatter(timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return value => {
    if (value === null || value === undefined) return null;
    const date = new Date(Number(value));
    if (!Number.isFinite(date.valueOf())) return null;
    const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
}

export function timelineQuery(input = {}, now = new Date()) {
  const timeZone = input.timeZone ?? 'UTC';
  let dayAt;
  try {
    if (typeof timeZone !== 'string' || timeZone.length > 100 || !timeZone) throw new Error();
    dayAt = dayFormatter(timeZone);
  } catch {
    throw new ValidationError('INVALID_TIMELINE_TIMEZONE', 'Use a valid IANA timezone.');
  }
  const today = dayAt(now.valueOf());
  const limit = input.limit === undefined ? 7 : Number(input.limit);
  if (!['string', 'number', 'undefined'].includes(typeof input.limit)
      || !Number.isInteger(limit) || limit < 1 || limit > 14) {
    throw new ValidationError('INVALID_TIMELINE_LIMIT', 'Request between 1 and 14 days.');
  }
  const before = input.before;
  if (before !== undefined && (!validDay(before) || before > shiftDay(today, 1))) {
    throw new ValidationError('INVALID_TIMELINE_CURSOR', 'Use an exclusive calendar-day cursor no later than tomorrow.');
  }
  const to = before === undefined ? today : shiftDay(before, -1);
  const from = shiftDay(to, 1 - limit);
  return { today, from, to, timeZone, dayAt };
}

export function buildLearningTimeline(range, data) {
  const { today, from, to, dayAt } = range;
  const first = data.first ?? {};
  const firstDay = [today, first.reviewDay, first.practiceDay,
    dayAt(first.listeningAt), dayAt(first.legacyAt)]
    .filter(day => validDay(day) && day <= today).sort()[0];
  const start = from < firstDay ? firstDay : from;
  const practiced = new Map();
  let limitedHistory = false;
  function record(day, activity) {
    if (!validDay(day) || day < start || day > to || day > today) return;
    if (!ACTIVITIES.includes(activity) && activity !== 'box1') return;
    if (!practiced.has(day)) practiced.set(day, new Set());
    practiced.get(day).add(activity);
  }
  for (const entry of [...data.reviews, ...data.practice]) record(entry.day, entry.activity);
  for (const entry of data.listening) record(dayAt(entry.at), 'listening');
  for (const entry of data.legacy) {
    const firstDate = dayAt(entry.startedAt);
    const lastDate = dayAt(entry.lastAt);
    // Old sessions contain totals, not per-answer dates. Never assign a multi-day total to a guessed day.
    if (firstDate && firstDate === lastDate) record(firstDate, entry.activity);
    else if (firstDate && lastDate) limitedHistory = true;
  }
  const days = [];
  for (let day = start; day <= to; day = shiftDay(day, 1)) {
    const evidence = practiced.get(day) ?? new Set();
    days.push({ day, activities: ACTIVITIES.filter(activity => evidence.has(activity)), boxOnePracticed: evidence.has('box1') });
  }
  return { today, days, nextBefore: days.length && start > firstDay ? start : null, limitedHistory };
}
