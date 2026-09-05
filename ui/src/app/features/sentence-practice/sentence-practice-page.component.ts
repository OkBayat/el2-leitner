import {
	ChangeDetectionStrategy,
	Component,
	HostListener,
	OnInit,
	ViewChild,
	computed,
	inject,
	signal,
} from '@angular/core';
import { FormControl } from '@angular/forms';
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
import { SentenceAnswerComponent } from './sentence-answer.component';

type FooterTone = 'neutral' | 'success' | 'error';

interface FooterState {
	tone: FooterTone;
	title: string;
	detail: string;
	label: string;
}

@Component({
	selector: 'app-sentence-practice-page',
	imports: [SentenceAnswerComponent, MatButtonModule, MatCardModule, MatProgressBarModule],
	templateUrl: 'sentence-practice-page.component.html',
	styleUrls: ['../review/review-page.component.scss', 'sentence-practice-page.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SentencePracticePageComponent implements OnInit {
	@ViewChild(SentenceAnswerComponent) private answerInput?: SentenceAnswerComponent;
	readonly session = inject(SentencePracticeSessionService);
	readonly router = inject(Router);
	readonly answer = new FormControl('', { nonNullable: true });
	readonly loading = signal(true);
	readonly empty = signal(false);
	readonly saving = signal(false);
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
		if (this.session.freePractice()) return `${this.session.answered()} practiced`;
		return `${Math.min(this.session.primaryAnswered() + 1, this.session.initialCount())} / ${this.session.initialCount()}`;
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
				setTimeout(() => this.session.pronounce(), 200);
			}
		} catch (error) {
			this.empty.set(true);
			this.snack.open(error instanceof Error ? error.message : 'Could not start sentence practice.', 'Close');
		} finally {
			this.loading.set(false);
		}
	}

	async submit(): Promise<void> {
		if (this.saving() || this.session.feedback() || !this.answer.value.trim()) return;
		this.saving.set(true);
		try {
			await this.session.submit(this.answer.value);
			const feedback = this.session.feedback();
			if (feedback) this.answerSound.play(feedback.correct ? 'correct' : 'incorrect');
		} catch (error) {
			this.snack.open(error instanceof Error ? error.message : 'Could not save this practice answer.', 'Close');
		} finally {
			this.saving.set(false);
		}
	}

	async next(): Promise<void> {
		if (!this.session.canAdvance() || this.saving()) return;
		this.answerSound.stop();
		await this.session.next();
		if (!this.session.active()) return;
		this.prepareInput();
		setTimeout(() => this.session.pronounce(), 180);
	}

	async restart(): Promise<void> {
		this.answerSound.stop();
		const started = await this.session.restart();
		this.empty.set(!started);
		if (started) {
			this.prepareInput();
			setTimeout(() => this.session.pronounce(), 180);
		}
	}

	async exit(): Promise<void> {
		const confirmed = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
			data: {
				title: 'Exit sentence practice',
				message: 'Practice counts are saved, but this mode does not change any Leitner house. Stop the current session?',
				confirmLabel: 'Exit',
			},
		}).afterClosed());
		if (!confirmed) return;
		this.answerSound.stop();
		await this.session.abandon();
		await this.router.navigateByUrl('/dashboard');
	}

	async handlePrimary(): Promise<void> {
		if (this.session.feedback()) await this.next();
		else await this.submit();
	}

	private prepareInput(): void {
		this.answer.setValue('', { emitEvent: false });
		setTimeout(() => this.answerInput?.focus());
	}

	@HostListener('document:keydown', ['$event'])
	onKeyboard(event: KeyboardEvent): void {
		if (!this.session.active()) return;
		const target = event.target as HTMLElement | null;
		const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA'
			|| Boolean(target?.closest('button, [role="dialog"]'));
		if (event.key === ' ' && !typing && !this.session.feedback()) {
			event.preventDefault();
			this.session.pronounce();
		}
	}
}
