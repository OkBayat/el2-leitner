import {
	AfterViewInit,
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	HostListener,
	OnDestroy,
	ViewChild,
	inject,
	signal,
} from '@angular/core';
import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { VocoButtonComponent, VocoButtonInteractionDirective } from '../../../../voco-button';
import {
	SpeechService,
	type SpeechPlaybackObserver,
} from '../../../../../core/speech/speech.service';
import { LearningStoreService } from '../../../../../core/state/learning-store.service';
import { ShortcutClickDirective } from '../../../../shortcut-click.directive';
import type {
	SlideContentComponent,
	SlideContentContext,
} from '../../../slide-content-contracts';
import type { AnswerField, ClozeSlideData } from '../../slide-library.models';
import { SlideStimulusComponent } from '../../slide-stimulus.component';
import {
	AnswerFieldsSlideBase,
	common,
	stringMode,
} from '../../slide-library.component-support';
import {
	answerMatches,
	answerFields,
	record,
	requiredText,
	strings,
} from '../../slide-library.utils';

interface SentencePlaybackToken {
	readonly text: string;
	readonly start: number;
	readonly end: number;
	readonly word: boolean;
}

interface ClozePlaybackSegment {
	readonly text?: string;
	readonly fieldId?: string;
	readonly tokens?: readonly SentencePlaybackToken[];
	readonly spokenStart?: number;
}

function sentencePlaybackTokens(
	text: string,
	offset: number,
): readonly SentencePlaybackToken[] {
	return [...text.matchAll(/\s+|[^\s]+/gu)].map((match) => {
		const start = offset + (match.index ?? 0);
		return {
			text: match[0],
			start,
			end: start + match[0].length,
			word: /\S/u.test(match[0]),
		};
	});
}

function clozeSegments(
	content: string,
): readonly { readonly text?: string; readonly fieldId?: string }[] {
	return content
		.split(/(\{\{[^{}]+\}\})/g)
		.filter(Boolean)
		.map((part) =>
			part.startsWith('{{') && part.endsWith('}}')
				? { fieldId: part.slice(2, -2).trim() }
				: { text: part },
		);
}

function completedClozeText(
	segments: ReturnType<typeof clozeSegments>,
	blanks: readonly AnswerField[],
): string {
	return segments
		.map((segment) =>
			segment.text !== undefined
				? segment.text
				: (blanks.find((blank) => blank.id === segment.fieldId)
						?.answers[0] ?? ''),
		)
		.join('');
}

function clozePlaybackSegments(
	content: string,
	blanks: readonly AnswerField[],
): readonly ClozePlaybackSegment[] {
	let offset = 0;
	return clozeSegments(content).map((segment) => {
		if (segment.text !== undefined) {
			const tokens = sentencePlaybackTokens(segment.text, offset);
			offset += segment.text.length;
			return { ...segment, tokens };
		}
		const spokenStart = offset;
		offset +=
			blanks.find((blank) => blank.id === segment.fieldId)?.answers[0]
				.length ?? 0;
		return { ...segment, spokenStart };
	});
}

function parseCloze(value: unknown): ClozeSlideData {
	const source = record(value);
	const blanks = answerFields(source['blanks']);
	const content = requiredText(source['content'], 'Cloze content');
	const segments = clozeSegments(content);
	const fieldIds = segments.flatMap((segment) =>
		segment.fieldId ? [segment.fieldId] : [],
	);
	if (
		fieldIds.length !== blanks.length ||
		new Set(fieldIds).size !== fieldIds.length ||
		fieldIds.some((id) => !blanks.some((blank) => blank.id === id))
	)
		throw new Error('Cloze placeholders must match answer fields.');
	const speechSource =
		source['speech'] === undefined
			? null
			: record(source['speech'], 'cloze speech playback');
	const speech = speechSource
		? {
				text: requiredText(
					speechSource['text'],
					'Cloze speech playback text',
				),
			}
		: undefined;
	if (speech && speech.text !== completedClozeText(segments, blanks)) {
		throw new Error(
			'Cloze speech playback text must match the completed sentence.',
		);
	}
	return {
		...common(source),
		content,
		inputMode: stringMode(
			source['inputMode'],
			['text', 'word-bank', 'select'] as const,
			'text',
		),
		showOptions: source['showOptions'] !== false,
		speech,
		blanks,
		wordBank: strings(source['wordBank']),
	};
}

@Component({
	selector: 'app-cloze-slide',
	standalone: true,
	imports: [
		VocoButtonComponent, VocoButtonInteractionDirective,
		OverlayModule,
		ShortcutClickDirective,
		SlideStimulusComponent,
	],
	templateUrl: './cloze-slide.component.html',
	styleUrl: '../../slide-library.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClozeSlideComponent
	extends AnswerFieldsSlideBase<ClozeSlideData>
	implements SlideContentComponent, AfterViewInit, OnDestroy
{
	private readonly speech = inject(SpeechService);
	private readonly store = inject(LearningStoreService);
	@ViewChild('clozeInput') private clozeInput?: ElementRef<HTMLTextAreaElement>;
	private detailsOrigin?: HTMLTextAreaElement;
	readonly segments = signal<readonly ClozePlaybackSegment[]>([]);
	readonly activeBlankId = signal('');
	readonly answerOptions = signal<readonly string[]>([]);
	readonly answerOptionsVisible = signal(false);
	readonly wordDetailsOpen = signal(false);
	readonly playbackActive = signal(false);
	readonly playbackCharIndex = signal<number | null>(null);
	readonly wordDetailsPositions: ConnectedPosition[] = [
		{
			originX: 'center',
			originY: 'bottom',
			overlayX: 'center',
			overlayY: 'top',
		},
		{
			originX: 'center',
			originY: 'top',
			overlayX: 'center',
			overlayY: 'bottom',
		},
	];
	fields(): readonly AnswerField[] {
		return this.data().blanks;
	}
	ngAfterViewInit(): void {
		this.clozeInput?.nativeElement.focus();
	}
	load(context: SlideContentContext): void {
		this.speech.cancel();
		this.resetPlaybackState();
		const data = parseCloze(context.data);
		this.begin(context.slideId, data);
		this.answers.set({});
		this.segments.set(clozePlaybackSegments(data.content, data.blanks));
		const sourceOptions = data.wordBank?.length
			? data.wordBank
			: data.blanks.flatMap((blank) => blank.answers.slice(0, 1));
		const options = [...new Set(sourceOptions)];
		this.answerOptions.set(
			options.length > 1 ? [...options.slice(1), options[0]] : options,
		);
		this.answerOptionsVisible.set(false);
		this.wordDetailsOpen.set(false);
		this.activeBlankId.set(
			data.inputMode === 'select' ? '' : (data.blanks[0]?.id ?? ''),
		);
		if (data.speech) this.playSentence();
	}
	playSentence(): boolean {
		const playback = this.data().speech;
		if (!playback) return false;
		this.resetPlaybackState();
		const observer: SpeechPlaybackObserver = {
			onStart: () => {
				if (this.data().speech !== playback) return;
				this.playbackActive.set(true);
				this.playbackCharIndex.set(null);
			},
			onWordBoundary: (charIndex) => {
				if (this.data().speech !== playback) return;
				this.playbackActive.set(true);
				this.playbackCharIndex.set(charIndex);
			},
			onEnd: () => {
				if (this.data().speech !== playback) return;
				this.playbackActive.set(false);
				this.playbackCharIndex.set(playback.text.length);
			},
			onError: () => {
				if (this.data().speech !== playback) return;
				this.resetPlaybackState();
			},
		};
		const rate = this.store.state()?.settings.voiceRate ?? 0.85;
		const started = this.speech.speak(playback.text, rate, observer);
		if (!started) this.resetPlaybackState();
		return started;
	}
	isPlaybackTokenSpoken(token: SentencePlaybackToken): boolean {
		const charIndex = this.playbackCharIndex();
		return token.word && charIndex !== null && charIndex >= token.start;
	}
	isPlaybackGapSpoken(segment: ClozePlaybackSegment): boolean {
		const charIndex = this.playbackCharIndex();
		return (
			segment.spokenStart !== undefined &&
			charIndex !== null &&
			charIndex >= segment.spokenStart
		);
	}
	blank(id: string | undefined): AnswerField | undefined {
		return this.data().blanks.find((field) => field.id === id);
	}
	blankState(id: string): string {
		const field = this.blank(id);
		return field ? this.fieldState(field) : 'neutral';
	}
	blankSize(field: AnswerField): number {
		const currentLength = this.answers()[field.id]?.length ?? 0;
		const answerLength = Math.max(0, ...field.answers.map((answer) => answer.length));
		return Math.min(24, Math.max(4, currentLength, answerLength) + 1);
	}
	override setAnswer(id: string, value: string): void {
		this.activeBlankId.set(id);
		super.setAnswer(id, value.replace(/[\r\n]+/g, ' '));
	}
	focusBlank(id: string): void {
		if (this.interactionState() !== 'idle') return;
		this.activeBlankId.set(id);
	}
	openWordDetails(id: string, event: Event): void {
		if (this.interactionState() === 'idle') return;
		this.activeBlankId.set(id);
		this.detailsOrigin = event.currentTarget as HTMLTextAreaElement;
		this.wordDetailsOpen.set(true);
	}
	closeWordDetails(restoreFocus = false): void {
		this.wordDetailsOpen.set(false);
		if (restoreFocus) this.detailsOrigin?.focus();
	}
	toggleAnswerOptions(): void {
		if (this.interactionState() !== 'idle') return;
		this.answerOptionsVisible.update((visible) => !visible);
	}
	onWordDetailsOutsideClick(): void {
		this.closeWordDetails();
	}
	resolvedSentenceSegments(
		activeFieldId: string,
	): readonly { readonly text: string; readonly highlighted: boolean }[] {
		return this.segments().map((segment) => {
			if (segment.text !== undefined)
				return { text: segment.text, highlighted: false };
			const field = this.blank(segment.fieldId);
			const learnerAnswer = field
				? this.answers()[field.id]?.trim()
				: undefined;
			const resolvedAnswer =
				field &&
				this.interactionState() === 'answered-incorrect' &&
				learnerAnswer &&
				!answerMatches(learnerAnswer, field)
					? field.answers[0]
					: learnerAnswer;
			return {
				text: field ? resolvedAnswer || field.answers[0] || '…' : '…',
				highlighted: segment.fieldId === activeFieldId,
			};
		});
	}
	selectChoice(word: string): void {
		const field =
			this.blank(this.activeBlankId()) ?? this.data().blanks[0];
		if (
			!field ||
			this.interactionState() !== 'idle' ||
			!this.data().wordBank?.includes(word)
		)
			return;
		this.setAnswer(field.id, word);
	}
	choiceState(
		word: string,
	): 'neutral' | 'selected' | 'correct' | 'incorrect' {
		const field = this.blank(this.activeBlankId());
		if (!field) return 'neutral';
		const selected = this.answers()[field.id] === word;
		if (this.interactionState() === 'idle')
			return selected ? 'selected' : 'neutral';
		if (answerMatches(word, field)) return 'correct';
		return selected ? 'incorrect' : 'neutral';
	}
	choiceAriaLabel(word: string, index: number): string {
		const prefix = `${index + 1}. ${word}`;
		const state = this.choiceState(word);
		if (state === 'correct') return `${prefix}, correct answer`;
		if (state === 'incorrect') return `${prefix}, your answer, incorrect`;
		return prefix;
	}
	useWord(word: string): void {
		const blanks = this.data().blanks;
		const activeId = this.activeBlankId();
		const activeIsEmpty = activeId && !this.answers()[activeId]?.trim();
		const id = activeIsEmpty
			? activeId
			: blanks.find((field) => !this.answers()[field.id]?.trim())?.id;
		if (!id) return;
		this.setAnswer(id, word);
		this.activeBlankId.set(
			blanks.find((field) => !this.answers()[field.id]?.trim())?.id ?? id,
		);
	}
	handleAction(actionId: string): void {
		if (
			actionId === 'check' &&
			this.fields().every((field) => this.answers()[field.id]?.trim())
		)
			this.checkFields();
	}
	@HostListener('document:keydown', ['$event'])
	onDocumentKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Escape' || !this.wordDetailsOpen()) return;
		event.preventDefault();
		this.closeWordDetails(true);
	}
	ngOnDestroy(): void {
		this.speech.cancel();
		this.resetPlaybackState();
		this.wordDetailsOpen.set(false);
		this.destroy();
	}
	private resetPlaybackState(): void {
		this.playbackActive.set(false);
		this.playbackCharIndex.set(null);
	}
}
