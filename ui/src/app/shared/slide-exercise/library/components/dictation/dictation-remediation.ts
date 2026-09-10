export enum DictationRemediationPhase {
	CORRECTION = 'correction',
	RECALL = 'recall',
	COPY = 'copy',
	COMPLETED = 'completed',
}

export interface DictationSpellingOperation {
	type: 'equal' | 'insert' | 'delete' | 'replace';
	answer?: string;
	target?: string;
}

export interface DictationSpellingToken {
	value: string;
	status: 'correct' | 'changed' | 'missing' | 'extra';
}

export interface DictationSpellingComparison {
	answer: string;
	target: string;
	distance: number;
	operations: DictationSpellingOperation[];
	answerTokens: DictationSpellingToken[];
	targetTokens: DictationSpellingToken[];
}

export interface DictationRemediationSnapshot {
	phase: DictationRemediationPhase;
	target: string;
	answerVisible: boolean;
	recallFailures: number;
	copyFailures: number;
	comparison: DictationSpellingComparison;
}

function normalizeAnswer(value: unknown): string {
	return String(value ?? '')
		.normalize('NFKC')
		.toLocaleLowerCase('en')
		.replace(/[’‘]/gu, "'")
		.replace(/[–—]/gu, '-')
		.replace(/\s+/gu, ' ')
		.trim();
}

function levenshteinDistance(left: string, right: string): number {
	const answer = [...normalizeAnswer(left)];
	const target = [...normalizeAnswer(right)];
	const matrix = Array.from({ length: answer.length + 1 }, () =>
		Array<number>(target.length + 1).fill(0),
	);
	for (let index = 0; index <= answer.length; index += 1) matrix[index][0] = index;
	for (let index = 0; index <= target.length; index += 1) matrix[0][index] = index;
	for (let answerIndex = 1; answerIndex <= answer.length; answerIndex += 1) {
		for (let targetIndex = 1; targetIndex <= target.length; targetIndex += 1) {
			matrix[answerIndex][targetIndex] = Math.min(
				matrix[answerIndex - 1][targetIndex] + 1,
				matrix[answerIndex][targetIndex - 1] + 1,
				matrix[answerIndex - 1][targetIndex - 1] +
					(answer[answerIndex - 1] === target[targetIndex - 1] ? 0 : 1),
			);
		}
	}
	return matrix[answer.length][target.length];
}

function selectClosestAccepted(answer: string, accepted: readonly string[]): string {
	if (!accepted.length) throw new Error('Accepted dictation answers are required.');
	return [...accepted].sort(
		(left, right) => levenshteinDistance(answer, left) - levenshteinDistance(answer, right),
	)[0];
}

export function buildDictationSpellingComparison(
	rawAnswer: string,
	rawTarget: string,
): DictationSpellingComparison {
	const answer = normalizeAnswer(rawAnswer);
	const target = normalizeAnswer(rawTarget);
	const answerCharacters = [...answer];
	const targetCharacters = [...target];
	const matrix = Array.from({ length: answerCharacters.length + 1 }, () =>
		Array<number>(targetCharacters.length + 1).fill(0),
	);
	for (let index = 0; index <= answerCharacters.length; index += 1) {
		matrix[index][0] = index;
	}
	for (let index = 0; index <= targetCharacters.length; index += 1) {
		matrix[0][index] = index;
	}
	for (let answerIndex = 1; answerIndex <= answerCharacters.length; answerIndex += 1) {
		for (let targetIndex = 1; targetIndex <= targetCharacters.length; targetIndex += 1) {
			matrix[answerIndex][targetIndex] = Math.min(
				matrix[answerIndex - 1][targetIndex] + 1,
				matrix[answerIndex][targetIndex - 1] + 1,
				matrix[answerIndex - 1][targetIndex - 1] +
					(answerCharacters[answerIndex - 1] === targetCharacters[targetIndex - 1]
						? 0
						: 1),
			);
		}
	}

	const operations: DictationSpellingOperation[] = [];
	let answerIndex = answerCharacters.length;
	let targetIndex = targetCharacters.length;
	while (answerIndex > 0 || targetIndex > 0) {
		if (
			answerIndex > 0 &&
			targetIndex > 0 &&
			answerCharacters[answerIndex - 1] === targetCharacters[targetIndex - 1]
		) {
			operations.push({
				type: 'equal',
				answer: answerCharacters[answerIndex - 1],
				target: targetCharacters[targetIndex - 1],
			});
			answerIndex -= 1;
			targetIndex -= 1;
			continue;
		}
		const replace =
			answerIndex > 0 && targetIndex > 0
				? matrix[answerIndex - 1][targetIndex - 1]
				: Number.POSITIVE_INFINITY;
		const remove =
			answerIndex > 0 ? matrix[answerIndex - 1][targetIndex] : Number.POSITIVE_INFINITY;
		const insert =
			targetIndex > 0 ? matrix[answerIndex][targetIndex - 1] : Number.POSITIVE_INFINITY;
		const best = Math.min(replace, remove, insert);
		if (replace === best) {
			operations.push({
				type: 'replace',
				answer: answerCharacters[answerIndex - 1],
				target: targetCharacters[targetIndex - 1],
			});
			answerIndex -= 1;
			targetIndex -= 1;
		} else if (remove === best) {
			operations.push({
				type: 'delete',
				answer: answerCharacters[answerIndex - 1],
			});
			answerIndex -= 1;
		} else {
			operations.push({
				type: 'insert',
				target: targetCharacters[targetIndex - 1],
			});
			targetIndex -= 1;
		}
	}
	operations.reverse();

	const answerTokens: DictationSpellingToken[] = [];
	const targetTokens: DictationSpellingToken[] = [];
	for (const operation of operations) {
		if (operation.type === 'equal') {
			answerTokens.push({
				value: operation.answer ?? '',
				status: 'correct',
			});
			targetTokens.push({
				value: operation.target ?? '',
				status: 'correct',
			});
		} else if (operation.type === 'replace') {
			answerTokens.push({
				value: operation.answer ?? '',
				status: 'changed',
			});
			targetTokens.push({
				value: operation.target ?? '',
				status: 'changed',
			});
		} else if (operation.type === 'delete') {
			answerTokens.push({
				value: operation.answer ?? '',
				status: 'extra',
			});
		} else {
			targetTokens.push({
				value: operation.target ?? '',
				status: 'missing',
			});
		}
	}

	return {
		answer,
		target,
		distance: matrix[answerCharacters.length][targetCharacters.length],
		operations,
		answerTokens,
		targetTokens,
	};
}

export class DictationRemediationAttempt {
	phase = DictationRemediationPhase.CORRECTION;
	target: string;
	recallFailures = 0;
	copyFailures = 0;
	private lastAnswer: string;

	private constructor(
		private readonly accepted: readonly string[],
		private readonly initialAnswer: string,
		private readonly matches: (answer: string) => boolean,
	) {
		this.lastAnswer = initialAnswer;
		this.target = selectClosestAccepted(initialAnswer, accepted);
	}

	static start({
		accepted,
		initialAnswer,
		matches,
	}: {
		accepted: readonly string[];
		initialAnswer: string;
		matches: (answer: string) => boolean;
	}): DictationRemediationAttempt {
		return new DictationRemediationAttempt(accepted, initialAnswer, matches);
	}

	snapshot(): DictationRemediationSnapshot {
		const answer =
			this.phase === DictationRemediationPhase.CORRECTION
				? this.initialAnswer
				: this.lastAnswer;
		return {
			phase: this.phase,
			target: this.target,
			answerVisible:
				this.phase === DictationRemediationPhase.CORRECTION ||
				this.phase === DictationRemediationPhase.COPY,
			recallFailures: this.recallFailures,
			copyFailures: this.copyFailures,
			comparison: buildDictationSpellingComparison(answer, this.target),
		};
	}

	acknowledgeCorrection(): void {
		if (this.phase !== DictationRemediationPhase.CORRECTION) {
			throw new Error('Invalid dictation remediation transition.');
		}
		this.phase = DictationRemediationPhase.RECALL;
		this.lastAnswer = '';
	}

	submitRecall(answer: string): boolean {
		if (this.phase !== DictationRemediationPhase.RECALL) {
			throw new Error('Invalid dictation remediation transition.');
		}
		this.lastAnswer = String(answer ?? '');
		if (this.matches(this.lastAnswer)) {
			this.phase = DictationRemediationPhase.COMPLETED;
			return true;
		}
		this.recallFailures += 1;
		this.target = selectClosestAccepted(this.lastAnswer, this.accepted);
		this.phase = DictationRemediationPhase.COPY;
		return false;
	}

	submitCopy(answer: string): boolean {
		if (this.phase !== DictationRemediationPhase.COPY) {
			throw new Error('Invalid dictation remediation transition.');
		}
		this.lastAnswer = String(answer ?? '');
		if (!this.matches(this.lastAnswer)) {
			this.copyFailures += 1;
			return false;
		}
		this.phase = DictationRemediationPhase.RECALL;
		this.lastAnswer = '';
		return true;
	}
}
