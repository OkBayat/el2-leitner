import {
	ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostListener,
	Input, OnChanges, Output, SimpleChanges, ViewChild, inject, signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { MatButtonModule } from '@angular/material/button';
import { SentencePracticePrompt } from '../../domain/sentence-practice/sentence-practice';

@Component({
	selector: 'app-sentence-answer',
	imports: [ReactiveFormsModule, OverlayModule, MatButtonModule],
	templateUrl: './sentence-answer.component.html',
	styleUrl: './sentence-answer.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SentenceAnswerComponent implements OnChanges {
	@Input({ required: true }) control!: FormControl<string>;
	@Input({ required: true }) prompt!: SentencePracticePrompt;
	@Input() readOnly = false;
	@Input() incorrect = false;
	@Input() revealed = false;
	@Output() primary = new EventEmitter<void>();
	@ViewChild('answerInput') private answerInput?: ElementRef<HTMLTextAreaElement>;
	private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
	readonly detailsOpen = signal(false);
	readonly positions: ConnectedPosition[] = [
		{ originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top' },
		{ originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom' },
	];

	get missingWord(): string {
		const { text, before, after } = this.prompt.sentence;
		return text.slice(before.length, text.length - after.length) || this.prompt.card.term;
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['prompt']) this.detailsOpen.set(false);
	}

	focus(): void {
		this.answerInput?.nativeElement.focus();
	}

	normalizeInput(event: Event): void {
		if ((event as InputEvent).isComposing) return;
		const field = event.target as HTMLTextAreaElement;
		const value = field.value.replace(/[\r\n]+/gu, ' ');
		if (value !== field.value) {
			field.value = value;
			this.control.setValue(value);
		}
	}

	onKeydown(event: KeyboardEvent): void {
		if (event.isComposing || event.keyCode === 229) return;
		if (event.altKey && event.key === 'ArrowDown') {
			event.preventDefault();
			this.detailsOpen.set(true);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			if (!event.repeat) this.primary.emit();
		}
	}

	closeDetails(restoreFocus = false): void {
		this.detailsOpen.set(false);
		if (restoreFocus) this.focus();
	}

	onOutsideClick(event: MouseEvent): void {
		if (!this.host.nativeElement.contains(event.target as Node)) this.closeDetails();
	}

	@HostListener('document:keydown', ['$event'])
	onDocumentKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Escape' || !this.detailsOpen()) return;
		event.preventDefault();
		this.closeDetails(true);
	}
}
