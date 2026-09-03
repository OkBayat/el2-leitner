import {
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	HostListener,
	OnInit,
	ViewChild,
	computed,
	inject,
	signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SentencePracticeSessionService } from '../../application/sentence-practice/sentence-practice-session.service';
import { ReviewAnswerSoundService } from '../../core/sound/review-answer-sound.service';
import { LearningStoreService } from '../../core/state/learning-store.service';
import { ThemeService } from '../../core/theme/theme.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';

type FooterTone = 'neutral' | 'success' | 'error';

interface FooterState {
	tone: FooterTone;
	title: string;
	detail: string;
	label: string;
}

@Component({
	selector: 'app-sentence-practice-page',
	imports: [ReactiveFormsModule, MatButtonModule, MatCardModule, MatProgressBarModule],
	templateUrl: 'sentence-practice-page.component.html',
	styleUrls: ['../review/review-page.component.scss', 'sentence-practice-page.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SentencePracticePageComponent implements OnInit {
	@ViewChild('answerInput') private answerInput?: ElementRef<HTMLInputElement>;
	readonly session = inject(SentencePracticeSessionService);
	readonly router = inject(Router);
	readonly answer = new FormControl('', { nonNullable: true });
	readonly loading = signal(true);
	readonly empty = signal(false);
	private readonly route = inject(ActivatedRoute);
	private readonly dialog = inject(MatDialog);
	private readonly snack = inject(MatSnackBar);
	private readonly answerSound = inject(ReviewAnswerSoundService);
	private readonly store = inject(LearningStoreService);
	private readonly theme = inject(ThemeService);

	readonly footer = computed<FooterState | null>(() => {
		if (!this.session.active()) return null;
		const feedback = this.session.feedback();
		if (!feedback) {
			return {
				tone: 'neutral',
				title: '',
				detail: '',
				label: 'Check answer',
			};
		}
		return feedback.correct
			? { tone: 'success', title: 'Correct!', detail: 'The sentence is complete.', label: 'Continue' }
			: {
				tone: 'error',
				title: 'Correct solution:',
				detail: feedback.correctAnswer,
				label: 'Continue',
			};
	});
	readonly counterLabel = computed(() => {
		const prompt = this.session.currentPrompt();
		if (prompt?.retryNumber) return `Retry ${prompt.retryNumber}`;
		return `${Math.min(this.session.primaryAnswered() + 1, this.session.initialCount())} / ${this.session.initialCount()}`;
	});
	readonly inputWidth = computed(() => {
		const card = this.session.currentPrompt()?.card;
		const length = card
			? Math.max(card.term.length, ...card.accepted.map((value) => value.length))
			: 8;
		return `${Math.max(7, Math.min(28, length + 2))}ch`;
	});

	async ngOnInit(): Promise<void> {
		try {
			const state = await this.store.initialize();
			this.theme.apply(state.settings.theme);
			const requestedHouse = Number(this.route.snapshot.queryParamMap.get('house') || 1);
			const house = Number.isInteger(requestedHouse) && requestedHouse >= 1 && requestedHouse <= 5
				? requestedHouse
				: 1;
			const started = await this.session.start(house);
			this.empty.set(!started);
			if (started) {
				this.prepareInput();
				setTimeout(() => this.session.playSentence(), 200);
			}
		} catch (error) {
			this.empty.set(true);
			this.snack.open(error instanceof Error ? error.message : 'Could not start sentence practice.', 'Close');
		} finally {
			this.loading.set(false);
		}
	}

	submit(): void {
		if (this.session.feedback() || !this.answer.value.trim()) return;
		this.session.submit(this.answer.value);
		this.answerSound.play(this.session.feedback()?.correct ? 'correct' : 'incorrect');
	}

	async next(): Promise<void> {
		if (!this.session.canAdvance()) return;
		this.answerSound.stop();
		await this.session.next();
		if (!this.session.active()) return;
		this.prepareInput();
		setTimeout(() => this.session.playSentence(), 180);
	}

	async restart(): Promise<void> {
		this.answerSound.stop();
		const started = await this.session.restart();
		this.empty.set(!started);
		if (started) {
			this.prepareInput();
			setTimeout(() => this.session.playSentence(), 180);
		}
	}

	async exit(): Promise<void> {
		const confirmed = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
			data: {
				title: 'Exit sentence practice',
				message: 'This practice does not change any Leitner house. Stop the current session?',
				confirmLabel: 'Exit',
			},
		}).afterClosed());
		if (!confirmed) return;
		this.answerSound.stop();
		await this.session.abandon();
		await this.router.navigateByUrl('/dashboard');
	}

	handlePrimary(): void {
		if (this.session.feedback()) void this.next();
		else this.submit();
	}

	private prepareInput(): void {
		this.answer.setValue('', { emitEvent: false });
		setTimeout(() => this.answerInput?.nativeElement.focus());
	}

	@HostListener('document:keydown', ['$event'])
	onKeyboard(event: KeyboardEvent): void {
		if (!this.session.active()) return;
		const target = event.target as HTMLElement | null;
		const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
		if (event.key === ' ' && !typing && !this.session.feedback()) {
			event.preventDefault();
			this.session.playSentence();
		}
	}
}
