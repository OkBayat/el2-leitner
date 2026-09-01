import {
  LEITNER_HOUSE_INTERVAL_DAYS,
  belongsToActiveLeitnerHouse,
  parseLeitnerHouse
} from "../../domain/learning/LeitnerHouse.js";

function localDay(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function finiteNonNegativeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}

function projectWord(word) {
  const number = Number(word?.number);
  return {
    id: String(word?.id ?? ""),
    number: Number.isFinite(number) ? number : 0,
    term: String(word?.term ?? "").trim(),
    accepted: Array.isArray(word?.accepted) ? word.accepted.map(String) : [],
    category: String(word?.category ?? ""),
    tags: Array.isArray(word?.tags) ? word.tags.map(String) : [],
    lessons: Array.isArray(word?.lessons) ? word.lessons.map(String) : [],
    due: word?.due || null,
    attempts: finiteNonNegativeInteger(word?.attempts),
    correct: finiteNonNegativeInteger(word?.correct),
    mistakes: finiteNonNegativeInteger(word?.mistakes),
    lastReviewed: word?.lastReviewed || null
  };
}

export class GetLeitnerHouse {
  constructor({ learningStateRepository, today = () => localDay() }) {
    this.learningStateRepository = learningStateRepository;
    this.today = today;
  }

  async execute(userId, houseInput) {
    const house = parseLeitnerHouse(houseInput);
    const record = await this.learningStateRepository.findByUserId(userId);
    const source = Array.isArray(record?.state?.words) ? record.state.words : [];
    const words = source
      .filter((word) => belongsToActiveLeitnerHouse(word, house))
      .map(projectWord);
    const today = this.today();

    return {
      house: {
        number: house,
        reviewIntervalDays: LEITNER_HOUSE_INTERVAL_DAYS[house],
        stateCount: LEITNER_HOUSE_INTERVAL_DAYS[house]
      },
      summary: {
        totalWords: words.length,
        dueWords: words.filter((word) => word.due && word.due <= today).length,
        totalAttempts: words.reduce((sum, word) => sum + word.attempts, 0),
        totalMistakes: words.reduce((sum, word) => sum + word.mistakes, 0)
      },
      words
    };
  }
}
