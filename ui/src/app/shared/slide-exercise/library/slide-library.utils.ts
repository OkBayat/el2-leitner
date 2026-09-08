import type {
	AnswerField,
	SlideOption,
	SlideStimulus,
} from './slide-library.models';

export function record(
	value: unknown,
	label = 'slide data',
): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`Invalid ${label}.`);
	return value as Record<string, unknown>;
}

export function text(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

export function requiredText(value: unknown, label: string): string {
	const result = text(value);
	if (!result) throw new Error(`${label} is required.`);
	return result;
}

export function strings(value: unknown): readonly string[] {
	return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

export function options(
	value: unknown,
	label = 'options',
): readonly SlideOption[] {
	if (!Array.isArray(value)) throw new Error(`${label} are required.`);
	const result = value.map((candidate) => {
		const source = record(candidate, label);
		return {
			id: requiredText(source['id'], `${label} id`),
			label: requiredText(source['label'], `${label} label`),
		};
	});
	if (new Set(result.map((option) => option.id)).size !== result.length)
		throw new Error(`${label} ids must be unique.`);
	return result;
}

export function answerFields(value: unknown): readonly AnswerField[] {
	if (!Array.isArray(value) || !value.length)
		throw new Error('Answer fields are required.');
	const fields = value.map((candidate) => {
		const source = record(candidate, 'answer field');
		const answers = strings(source['answers']);
		if (!answers.length)
			throw new Error('Answer field answers are required.');
		const wordLimit = Number(source['wordLimit']);
		return {
			id: requiredText(source['id'], 'Answer field id'),
			label: text(source['label']) || undefined,
			answers,
			wordLimit:
				Number.isInteger(wordLimit) && wordLimit > 0
					? wordLimit
					: undefined,
			caseSensitive: source['caseSensitive'] === true,
			punctuationSensitive: source['punctuationSensitive'] === true,
			exactSpelling: source['exactSpelling'] === true,
		};
	});
	if (new Set(fields.map((field) => field.id)).size !== fields.length)
		throw new Error('Answer field ids must be unique.');
	return fields;
}

export function parseStimulus(value: unknown): SlideStimulus | undefined {
	if (value === undefined || value === null) return undefined;
	const source = record(value, 'slide stimulus');
	const type = requiredText(source['type'], 'Stimulus type');
	if (type === 'text') {
		const sections = Array.isArray(source['sections'])
			? source['sections'].map((candidate) => {
					const section = record(candidate, 'text stimulus section');
					return {
						id: requiredText(section['id'], 'Section id'),
						title: text(section['title']) || undefined,
						content: requiredText(
							section['content'],
							'Section content',
						),
					};
				})
			: undefined;
		return {
			type,
			content: requiredText(source['content'], 'Text stimulus content'),
			sections,
		};
	}
	if (type === 'audio') {
		const maxReplays = Number(source['maxReplays']);
		return {
			type,
			src: requiredText(source['src'], 'Audio source'),
			transcript: text(source['transcript']) || undefined,
			maxReplays:
				Number.isInteger(maxReplays) && maxReplays > 0
					? maxReplays
					: undefined,
		};
	}
	if (type === 'dialogue') {
		if (!Array.isArray(source['turns']) || source['turns'].length < 2)
			throw new Error('Dialogue stimulus requires at least two turns.');
		const turns = source['turns'].map((candidate, index) => {
			const turn = record(candidate, 'dialogue turn');
			const voiceIndex = Number(turn['voiceIndex']);
			return {
				speaker: requiredText(turn['speaker'], 'Dialogue speaker'),
				text: requiredText(turn['text'], 'Dialogue text'),
				voiceIndex:
					Number.isSafeInteger(voiceIndex) && voiceIndex >= 0
						? voiceIndex
						: index,
			};
		});
		const maxReplays = Number(source['maxReplays']);
		return {
			type,
			turns,
			maxReplays:
				Number.isInteger(maxReplays) && maxReplays > 0
					? maxReplays
					: undefined,
		};
	}
	if (type === 'image')
		return {
			type,
			src: requiredText(source['src'], 'Image source'),
			alt: requiredText(source['alt'], 'Image alternative text'),
			caption: text(source['caption']) || undefined,
		};
	if (type === 'chart')
		return {
			type,
			imageSrc: text(source['imageSrc']) || undefined,
			alt: text(source['alt']) || undefined,
			caption: text(source['caption']) || undefined,
		};
	if (type === 'diagram')
		return {
			type,
			imageSrc: requiredText(source['imageSrc'], 'Diagram source'),
			alt: requiredText(source['alt'], 'Diagram alternative text'),
			caption: text(source['caption']) || undefined,
		};
	throw new Error(`Unsupported stimulus type: ${type}`);
}

export function normalizeAnswer(
	value: string,
	field: Pick<AnswerField, 'caseSensitive' | 'punctuationSensitive'> = {},
): string {
	let normalized = value.trim().replace(/\s+/g, ' ');
	if (!field.punctuationSensitive)
		normalized = normalized.replace(/[.,!?;:]+$/g, '').trim();
	if (!field.caseSensitive) normalized = normalized.toLocaleLowerCase('en');
	return normalized;
}

export function wordCount(value: string): number {
	const normalized = value.trim();
	return normalized ? normalized.split(/\s+/u).length : 0;
}

export function answerMatches(
	value: string,
	field: Pick<
		AnswerField,
		| 'answers'
		| 'wordLimit'
		| 'caseSensitive'
		| 'punctuationSensitive'
		| 'exactSpelling'
	>,
): boolean {
	if (
		!value.trim() ||
		(field.wordLimit && wordCount(value) > field.wordLimit)
	)
		return false;
	const normalization = field.exactSpelling
		? { caseSensitive: true, punctuationSensitive: true }
		: field;
	const actual = normalizeAnswer(value, normalization);
	return field.answers.some(
		(answer) => normalizeAnswer(answer, normalization) === actual,
	);
}

export function equalIds(
	actual: readonly string[],
	expected: readonly string[],
): boolean {
	return (
		actual.length === expected.length &&
		actual.every((id) => expected.includes(id))
	);
}
