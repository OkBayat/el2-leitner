import { parseLeitnerHouse } from "../../domain/learning/LeitnerHouse.js";
import { splitSentenceAtAnswer } from "../../domain/sentence-practice/SentenceCorpus.js";

function sentenceProjection(row) {
  const split = splitSentenceAtAnswer(row.sentenceText, row.answerText);
  return {
    id: row.sentenceId,
    sourceItemNumber: row.sourceItemNumber,
    variantNumber: row.variantNumber,
    category: row.category,
    text: row.sentenceText,
    before: split.before,
    after: split.after,
  };
}

export class GetSentencePracticeCards {
  constructor({ sentencePracticeRepository }) {
    this.sentencePracticeRepository = sentencePracticeRepository;
  }

  async execute(userId, houseInput = 1) {
    const house = parseLeitnerHouse(houseInput);
    const rows = await this.sentencePracticeRepository.findForHouse(userId, house);
    const cards = new Map();

    for (const row of rows) {
      let card = cards.get(row.wordId);
      if (!card) {
        card = {
          id: row.wordId,
          term: row.term,
          accepted: [],
          acceptedSet: new Set(),
          box: row.box,
          mistakes: row.mistakes,
          sentences: [],
          sentenceIds: new Set(),
        };
        cards.set(row.wordId, card);
      }
      if (!card.acceptedSet.has(row.acceptedForm)) {
        card.acceptedSet.add(row.acceptedForm);
        card.accepted.push(row.acceptedForm);
      }
      if (!card.sentenceIds.has(row.sentenceId)) {
        card.sentenceIds.add(row.sentenceId);
        card.sentences.push(sentenceProjection(row));
      }
    }

    const projectedCards = [...cards.values()].map(({ acceptedSet: _acceptedSet, sentenceIds: _sentenceIds, ...card }) => card);
    return {
      practice: {
        mode: "sentence",
        house,
        retryGap: 3,
      },
      summary: {
        totalWords: projectedCards.length,
        totalSentences: projectedCards.reduce((total, card) => total + card.sentences.length, 0),
      },
      cards: projectedCards,
    };
  }
}
