import {
	ChangeDetectionStrategy,
	Component,
	computed,
	ElementRef,
	HostListener,
	inject,
	OnInit,
	signal,
	ViewChild
} from '@angular/core';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatDialog} from '@angular/material/dialog';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatSelectModule} from '@angular/material/select';
import {MatSnackBar, MatSnackBarModule} from '@angular/material/snack-bar';
import {ReviewSessionService} from '../../application/review/review-session.service';
import {LearningStoreService} from '../../core/state/learning-store.service';
import {ThemeService} from '../../core/theme/theme.service';
import {getDueWords, localDay} from '../../domain/learning/learning-rules';
import {ReviewMode} from '../../domain/learning/models';
import {RemediationPhase} from '../../domain/remediation/remediation';
import {ConfirmDialogComponent} from '../../shared/confirm-dialog/confirm-dialog.component';
import {ShareStoryService} from '../../shared/share-story/share-story.service';
import {buildReviewAnswerFieldState, type ReviewAnswerFieldState} from './review-answer-field';
import {ReviewContextBadgeComponent} from './review-context-badge.component';
import {buildReviewSessionBarState} from './review-session-bar';

type ReviewFooterTone = 'neutral' | 'success' | 'error' | 'practice';
type ReviewFooterIcon = 'none' | 'check' | 'error' | 'practice';
type ReviewFooterAction = 'submit-answer' | 'acknowledge' | 'next';

interface ReviewFooterState {
	tone: ReviewFooterTone;
	icon: ReviewFooterIcon;
	title: string;
	detail: string;
	primaryLabel: string;
	primaryAction: ReviewFooterAction;
	secondaryLabel?: string;
}

const CHECK_ANSWER_LABEL = 'Check answer';
const CONTINUE_LABEL = 'Continue';

function practiceFooter(title: string, detail: string): ReviewFooterState {
	return {
		tone: 'practice',
		icon: 'practice',
		title,
		detail,
		primaryLabel: CHECK_ANSWER_LABEL,
		primaryAction: 'submit-answer',
	};
}

function continueFooter(
	tone: 'success' | 'error',
	icon: 'check' | 'error',
	title: string,
	detail: string,
	primaryAction: 'acknowledge' | 'next' = 'next',
): ReviewFooterState {
	return {
		tone,
		icon,
		title,
		detail,
		primaryLabel: CONTINUE_LABEL,
		primaryAction,
	};
}

@Component({
	selector: 'app-review-page',
	imports: [ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatProgressBarModule, MatSelectModule, MatSnackBarModule, ReviewContextBadgeComponent],
	templateUrl: 'review-page.component.html',
	styleUrls: ['review-page.component.scss', 'review-answer-feedback.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewPageComponent implements OnInit {
	@ViewChild('answerInput') private answerInput?: ElementRef<HTMLInputElement>;
	readonly session = inject(ReviewSessionService);
	readonly store = inject(LearningStoreService);
	readonly router = inject(Router);
	readonly share = inject(ShareStoryService);
	private readonly route = inject(ActivatedRoute);
	private readonly snack = inject(MatSnackBar);
	private readonly dialog = inject(MatDialog);
	private readonly theme = inject(ThemeService);
	readonly Phase = RemediationPhase;
	readonly answer = new FormControl('', {nonNullable: true});
	readonly limit = new FormControl(0, {nonNullable: true});
	readonly saving = signal(false);
	readonly state = this.store.state;
	readonly dueCount = computed(() => this.state() ? getDueWords(this.state()!).length : 0);
	readonly newCount = computed(() => this.state() ? getDueWords(this.state()!).filter((word) => word.introducedOn === localDay() && word.box === 1).length : 0);
	readonly estimatedMinutes = computed(() => Math.max(1, Math.ceil(this.dueCount() * .35)));
	readonly sessionBarState = computed(() => buildReviewSessionBarState({
		answered: this.session.answered(),
		initialCount: this.session.initialCount(),
		freePractice: this.session.freePractice(),
		recheck: this.session.currentTask() === 'recheck',
	}));
	readonly answerFieldState = computed<ReviewAnswerFieldState | null>(() => buildReviewAnswerFieldState({
		active: this.session.active(),
		currentTask: this.session.currentTask(),
		feedbackCorrect: this.session.feedback()?.correct ?? null,
		remediationPhase: this.session.remediation()?.phase ?? null,
	}));
	readonly footerState = computed<ReviewFooterState | null>(() => {
		if (!this.session.active()) return null;

		const remediation = this.session.remediation();
		const feedback = this.session.feedback();
		if (remediation) {
			if (remediation.phase === RemediationPhase.CORRECTION) {
				return continueFooter(
					'error',
					'error',
					'Correct solution:',
					feedback?.spelling || remediation.target,
					'acknowledge',
				);
			}
			if (remediation.phase === RemediationPhase.COMPLETED) {
				return continueFooter('success', 'check', 'Correct!', 'You remembered the spelling.');
			}
			if (remediation.phase === RemediationPhase.COPY) {
				return practiceFooter('Practice the correction', 'Copy the correct spelling exactly once, then check.');
			}
			return practiceFooter('From memory', 'Type the spelling from memory, then check.');
		}

		if (feedback) {
			return feedback.correct
				? continueFooter('success', 'check', feedback.title, feedback.detail)
				: continueFooter('error', 'error', 'Correct solution:', feedback.spelling);
		}

		if (this.session.currentTask() === 'review') {
			return {
				tone: 'neutral',
				icon: 'none',
				title: '',
				detail: '',
				primaryLabel: CHECK_ANSWER_LABEL,
				primaryAction: 'submit-answer',
				secondaryLabel: "I don't know",
			};
		}
		return null;
	});

	async ngOnInit(): Promise<void> {
		const state = await this.store.initialize();
		this.theme.apply(state.settings.theme);
		const mode = this.route.snapshot.queryParamMap.get('mode') as ReviewMode | null;
		if (mode === 'new' || mode === 'box1') await this.start(mode);
	}

	async start(mode: ReviewMode): Promise<void> {
		const ok = await this.session.start(mode, this.limit.value);
		if (!ok) {
			this.snack.open(mode === 'box1' ? 'There are no cards in House 1 yet.' : 'There are no due reviews.', 'OK', {duration: 3000});
			return;
		}
		this.prepareAnswerInput();
		setTimeout(() => this.session.pronounce(), 200);
	}

	async submitAnswer(): Promise<void> {
		const field = this.answerFieldState();
		if (!field || field.readOnly || this.saving() || !this.answer.value.trim()) return;
		if (field.action === 'review') {
			await this.submitReviewAnswer();
			return;
		}
		this.submitRemediationAnswer();
	}

	async dontKnow(): Promise<void> {
		if (this.saving()) return;
		this.saving.set(true);
		try {
			await this.session.submit('', true);
		} catch (error) {
			this.snack.open(error instanceof Error ? error.message : 'Could not save your answer.', 'Close');
		} finally {
			this.saving.set(false);
		}
	}

	acknowledge(): void {
		this.session.acknowledgeCorrection();
		this.prepareAnswerInput();
	}

	isFooterPrimaryDisabled(footer: ReviewFooterState): boolean {
		if (footer.primaryAction === 'submit-answer') {
			return this.saving() || Boolean(this.answerFieldState()?.readOnly) || !this.answer.value.trim();
		}
		return false;
	}

	async handleFooterPrimary(action: ReviewFooterAction): Promise<void> {
		if (action === 'submit-answer') {
			await this.submitAnswer();
			return;
		}
		if (action === 'acknowledge') {
			this.acknowledge();
			return;
		}
		await this.next();
	}

	tokenValue(value: string): string {
		return value === ' ' ? '\u00a0' : value;
	}

	async next(): Promise<void> {
		await this.session.next();
		this.prepareAnswerInput(false);
		if (!this.session.active()) return;
		if (this.answerFieldState() && !this.answerFieldState()!.readOnly) this.focusAnswerInput();
		setTimeout(() => this.session.pronounce(), 180);
	}

	async exit(): Promise<void> {
		const ok = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
			data: {
				title: 'Exit session',
				message: 'Saved answers will be kept. Stop this session?',
				confirmLabel: 'Exit'
			}
		}).afterClosed());
		if (ok) {
			await this.session.abandon();
			await this.router.navigateByUrl('/dashboard');
		}
	}

	displayCategory(category: string): string {
		return category || 'Uncategorized';
	}

	private async submitReviewAnswer(): Promise<void> {
		const submittedAnswer = this.answer.value;
		this.saving.set(true);
		try {
			await this.session.submit(submittedAnswer);
		} catch (error) {
			this.snack.open(error instanceof Error ? error.message : 'Could not save your answer.', 'Close');
		} finally {
			this.saving.set(false);
		}
	}

	private submitRemediationAnswer(): void {
		const submittedAnswer = this.answer.value;
		this.session.submitRemediation(submittedAnswer);
		if (this.session.remediation()?.phase === RemediationPhase.COMPLETED) return;
		this.prepareAnswerInput();
	}

	private prepareAnswerInput(focus = true): void {
		this.answer.setValue('', {emitEvent: false});
		if (focus) this.focusAnswerInput();
	}

	private focusAnswerInput(): void {
		setTimeout(() => this.answerInput?.nativeElement.focus());
	}

	@HostListener('document:keydown', ['$event'])
	async onKeyboard(event: KeyboardEvent): Promise<void> {
		if (!this.session.active()) return;
		const target = event.target as HTMLElement | null;
		const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
		if (event.key === ' ' && !typing && !this.session.feedback()) {
			event.preventDefault();
			this.session.pronounce();
		}
		if (event.key !== 'Enter' || typing) return;

		if (this.session.remediation()?.phase === RemediationPhase.CORRECTION) {
			event.preventDefault();
			this.acknowledge();
			return;
		}

		if (this.session.canAdvance()) {
			event.preventDefault();
			await this.next();
		}
	}
}
