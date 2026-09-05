export interface ShadowingWord { text: string; after: string; matched: boolean; }
export interface ShadowingAssessment {
  leading: string; words: ShadowingWord[]; transcript: string;
  matchedCount: number; totalCount: number; score: number; passed: boolean;
}
export interface ShadowingSentence extends ShadowingAssessment { id: string; text: string; category?: string; }
export interface ShadowingCard { id: string; term: string; sentences: ShadowingSentence[]; }
export interface ShadowingPrompt { card: ShadowingCard; sentence: ShadowingSentence; }
export interface ShadowingDeck { sessionId: string | null; cards: ShadowingCard[]; maxSeconds: number; threshold: number; }
export interface ShadowingCounts { completedCount: number; correctCount: number; wrongCount: number; }
export interface ShadowingResult extends ShadowingAssessment {
  counts: ShadowingCounts;
  daily: { day: string; attempts: number; correct: number; wrong: number; newAdded: number; sessions: number; durationSeconds: number; };
}

export class ShadowingQueue {
  private remaining: ShadowingCard[] = [];
  private previousWord = '';
  private previousSentences = new Map<string, string>();
  constructor(private readonly cards: ShadowingCard[], private readonly random = Math.random) {}

  next(): ShadowingPrompt | null {
    if (!this.remaining.length) {
      this.remaining = this.cards.filter(card => card.sentences.length > 0).slice();
      for (let i = this.remaining.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [this.remaining[i], this.remaining[j]] = [this.remaining[j], this.remaining[i]];
      }
      if (this.remaining.length > 1 && this.remaining[0].id === this.previousWord) this.remaining.push(this.remaining.shift()!);
    }
    const card = this.remaining.shift();
    if (!card) return null;
    const alternatives = card.sentences.filter(sentence => sentence.id !== this.previousSentences.get(card.id));
    const choices = alternatives.length ? alternatives : card.sentences;
    const sentence = choices[Math.floor(this.random() * choices.length)];
    this.previousWord = card.id;
    this.previousSentences.set(card.id, sentence.id);
    return { card, sentence };
  }
}
