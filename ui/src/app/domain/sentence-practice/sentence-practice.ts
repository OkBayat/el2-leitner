export interface SentencePracticeSentence {
	id: string;
	sourceItemNumber: number | null;
	variantNumber: number | null;
	category: string;
	text: string;
	before: string;
	after: string;
}

export interface SentencePracticeCard {
	id: string;
	term: string;
	accepted: string[];
	box: number;
	mistakes: number;
	sentences: SentencePracticeSentence[];
}

export interface SentencePracticeDeck {
	practice: {
		mode: 'sentence';
		house: number;
		retryGap: number;
	};
	summary: {
		totalWords: number;
		totalSentences: number;
	};
	cards: SentencePracticeCard[];
}

export interface SentencePracticePrompt {
	card: SentencePracticeCard;
	sentence: SentencePracticeSentence;
	retryNumber: number;
	primary: boolean;
}

interface QueueItem {
	card: SentencePracticeCard;
	sentenceIndex: number;
	retryNumber: number;
	primary: boolean;
}

export function normalizeSentenceAnswer(value: string): string {
	return String(value ?? '')
		.normalize('NFKC')
		.toLocaleLowerCase('en')
		.replace(/[’‘]/gu, "'")
		.replace(/[–—]/gu, '-')
		.replace(/\s+/gu, ' ')
		.trim();
}

export function isAcceptedSentenceAnswer(answer: string, accepted: string[]): boolean {
	const normalized = normalizeSentenceAnswer(answer);
	return Boolean(normalized) && accepted.some((candidate) => normalizeSentenceAnswer(candidate) === normalized);
}

function shuffled<T>(items: T[], random: () => number): T[] {
	const result = [...items];
	for (let index = result.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(random() * (index + 1));
		[result[index], result[swapIndex]] = [result[swapIndex], result[index]];
	}
	return result;
}

export class SentencePracticeQueue {
	private readonly retryGap: number;
	private readonly random: () => number;
	private readonly cards: SentencePracticeCard[];
	private readonly loopPrimary: boolean;
	private items: QueueItem[] = [];
	private lastPrimaryCardId: string | null = null;
	private cleared = false;

	constructor(
		cards: SentencePracticeCard[],
		retryGap = 3,
		random: () => number = Math.random,
		loopPrimary = false,
	) {
		this.retryGap = Math.max(0, Math.trunc(retryGap));
		this.random = random;
		this.loopPrimary = loopPrimary;
		this.cards = cards.filter((card) => card.sentences.length > 0);
		this.refillPrimaryCycle();
	}

	get remaining(): number {
		return this.items.length;
	}

	next(): SentencePracticePrompt | null {
		if (this.cleared) return null;
		if (!this.items.length && this.loopPrimary) this.refillPrimaryCycle(this.lastPrimaryCardId);
		const item = this.items.shift();
		if (!item) return null;
		if (item.primary) this.lastPrimaryCardId = item.card.id;
		return {
			card: item.card,
			sentence: item.card.sentences[item.sentenceIndex],
			retryNumber: item.retryNumber,
			primary: item.primary,
		};
	}

	scheduleRetry(prompt: SentencePracticePrompt): void {
		const sentenceCount = prompt.card.sentences.length;
		if (!sentenceCount || this.cleared) return;
		const currentIndex = Math.max(0, prompt.card.sentences.findIndex((sentence) => sentence.id === prompt.sentence.id));
		const sentenceIndex = sentenceCount === 1 ? 0 : (currentIndex + 1) % sentenceCount;
		if (this.loopPrimary && this.items.length < this.retryGap) {
			this.fillInterveningCards(prompt.card.id);
		}
		const insertionIndex = Math.min(this.retryGap, this.items.length);
		this.items.splice(insertionIndex, 0, {
			card: prompt.card,
			sentenceIndex,
			retryNumber: prompt.retryNumber + 1,
			primary: false,
		});
	}

	clear(): void {
		this.cleared = true;
		this.items = [];
	}

	private primaryItem(card: SentencePracticeCard): QueueItem {
		return {
			card,
			sentenceIndex: Math.floor(this.random() * card.sentences.length),
			retryNumber: 0,
			primary: true,
		};
	}

	private refillPrimaryCycle(avoidFirstId: string | null = null): void {
		if (!this.cards.length || this.cleared) return;
		const cycle = shuffled(this.cards, this.random);
		if (avoidFirstId && cycle.length > 1 && cycle[0].id === avoidFirstId) {
			cycle.push(cycle.shift()!);
		}
		this.items.push(...cycle.map((card) => this.primaryItem(card)));
	}

	private fillInterveningCards(excludedCardId: string): void {
		const candidates = this.cards.filter((card) => card.id !== excludedCardId);
		if (!candidates.length) return;
		while (this.items.length < this.retryGap) {
			for (const card of shuffled(candidates, this.random)) {
				this.items.push(this.primaryItem(card));
				if (this.items.length >= this.retryGap) return;
			}
		}
	}
}
