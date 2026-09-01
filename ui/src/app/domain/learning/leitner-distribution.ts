import { BOX_WAIT_DAYS, clamp } from './learning-rules';
import { LearningWord } from './models';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface LeitnerHouseDistribution {
  box: number;
  total: number;
  segments: number[];
}

export interface LeitnerDistribution {
  total: number;
  houses: LeitnerHouseDistribution[];
}

function parseDay(day: string | null | undefined): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(String(day || ''));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, date);
  const parsed = new Date(timestamp);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== date) return null;
  return Math.floor(timestamp / DAY_MS);
}

export function stateCountForHouse(box: number): number {
  const house = clamp(Math.trunc(Number(box) || 1), 1, 5);
  return Math.max(1, Math.trunc(Number(BOX_WAIT_DAYS[house]) || house));
}

export function segmentIndexForWord(word: Pick<LearningWord, 'due' | 'masteredAt'>, box: number, today: string): number {
  const house = clamp(Math.trunc(Number(box) || 1), 1, 5);
  const segmentCount = stateCountForHouse(house);
  if (house === 5 && word.masteredAt) return segmentCount - 1;

  const todaySerial = parseDay(today);
  const dueSerial = parseDay(word.due);
  if (todaySerial === null || dueSerial === null) return 0;

  const startedSerial = dueSerial - segmentCount;
  const elapsedDays = clamp(todaySerial - startedSerial, 0, segmentCount);
  if (elapsedDays >= segmentCount) return segmentCount - 1;
  return clamp(Math.floor(elapsedDays), 0, segmentCount - 1);
}

export function buildLeitnerDistribution(words: LearningWord[], today: string): LeitnerDistribution {
  const houses = [1, 2, 3, 4, 5].map((box) => {
    const segments = Array.from({ length: stateCountForHouse(box) }, () => 0);
    for (const word of words) {
      if (word.box !== box || word.masteredAt) continue;
      segments[segmentIndexForWord(word, box, today)] += 1;
    }
    return {
      box,
      total: segments.reduce((sum, count) => sum + count, 0),
      segments,
    };
  });

  return {
    total: houses.reduce((sum, house) => sum + house.total, 0),
    houses,
  };
}
