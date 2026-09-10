import { parseLeitnerHouse } from "../../domain/learning/LeitnerHouse.js";
import { createSentenceMatcher } from "../../domain/sentence-practice/SentenceMatcher.js";

const MAX_SENTENCES_PER_CARD = 12;

function shuffled(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function emptyResult(house) {
  return {
    practice: { mode: "sentence", house, retryGap: 3 },
    summary: { totalWords: 0, totalSentences: 0 },
    cards: []
  };
}

function groupWords(rows) {
  const cards = new Map();
  for (const row of rows) {
    let card = cards.get(row.wordId);
    if (!card) {
      card = {
        id: row.wordId,
        term: row.term,
        accepted: [],
        acceptedSet: new Set(),
        definitions: row.definitions ?? [],
        box: row.box,
        mistakes: row.mistakes
      };
      cards.set(row.wordId, card);
    }
    if (!card.acceptedSet.has(row.acceptedForm)) {
      card.acceptedSet.add(row.acceptedForm);
      card.accepted.push(row.acceptedForm);
    }
  }
  return [...cards.values()];
}

function projectSentence(sentence, match) {
  return {
    id: sentence.id,
    sourceItemNumber: sentence.sourceItemNumber,
    variantNumber: sentence.variantNumber,
    category: sentence.category,
    text: sentence.text,
    before: match.before,
    after: match.after
  };
}

export class GetSentencePracticeCards {
  constructor({ sentencePracticeRepository, random = Math.random }) {
    this.sentencePracticeRepository = sentencePracticeRepository;
    this.random = random;
  }

  async execute(userId, houseInput = 1) {
    const house = parseLeitnerHouse(houseInput);
    const wordRows = await this.sentencePracticeRepository.findWordsForHouse(userId, house);
    if (!wordRows.length) return emptyResult(house);

    const sentenceRows = await this.sentencePracticeRepository.findActiveSentences("en");
    const cards = [];

    for (const grouped of groupWords(wordRows)) {
      const accepted = grouped.accepted.length ? grouped.accepted : [grouped.term];
      const matchSentence = createSentenceMatcher(accepted);
      const matches = [];

      for (const sentence of sentenceRows) {
        const match = matchSentence(sentence.text);
        if (match) matches.push(projectSentence(sentence, match));
      }

      const { acceptedSet: _acceptedSet, ...card } = grouped;
      cards.push({
        ...card,
        sentences: shuffled(matches, this.random).slice(0, MAX_SENTENCES_PER_CARD)
      });
    }

    return {
      practice: { mode: "sentence", house, retryGap: 3 },
      summary: {
        totalWords: cards.length,
        totalSentences: cards.reduce((total, card) => total + card.sentences.length, 0)
      },
      cards
    };
  }
}

export { MAX_SENTENCES_PER_CARD };
