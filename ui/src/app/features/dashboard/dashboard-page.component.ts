import {ChangeDetectionStrategy, Component, OnInit, computed, inject} from '@angular/core';
import {FormControl, ReactiveFormsModule, Validators} from '@angular/forms';
import {Router, RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {MatButtonModule} from '@angular/material/button';
import {MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA} from '@angular/material/dialog';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {ReviewSessionService} from '../../application/review/review-session.service';
import {LearningStoreService} from '../../core/state/learning-store.service';
import {buildLeitnerDistribution} from '../../domain/learning/leitner-distribution';
import {accuracy, getDueWords, hardWords, localDay, totalStats} from '../../domain/learning/learning-rules';
import {LearningChartComponent, type LearningChartPoint} from '../../shared/charts/learning-chart.component';

@Component({
	selector: 'app-new-words-dialog',
	imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
	template: `
		<h2 mat-dialog-title>Add new words</h2>
		<mat-dialog-content>
			<p>{{ data.available }} words have not entered the Leitner box yet.</p>
			<mat-form-field appearance="outline">
				<mat-label>Number of words</mat-label>
				<input matInput type="number" [formControl]="count" min="1" [max]="data.max">
			</mat-form-field>
		</mat-dialog-content>
		<mat-dialog-actions align="end">
			<button mat-button (click)="dialog.close()">Cancel</button>
			<button mat-flat-button [disabled]="count.invalid" (click)="dialog.close(count.value)">Add and start session</button>
		</mat-dialog-actions>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewWordsDialogComponent {
	readonly data = inject<{available: number; max: number}>(MAT_DIALOG_DATA);
	readonly dialog = inject(MatDialogRef<NewWordsDialogComponent>);
	readonly count = new FormControl(10, {
		nonNullable: true,
		validators: [Validators.required, Validators.min(1), Validators.max(this.data.max)],
	});
}

@Component({
	selector: 'app-dashboard-page',
	imports: [MatButtonModule, MatProgressBarModule, RouterLink, LearningChartComponent],
	templateUrl: 'dashboard-page.component.html',
	styleUrl: 'dashboard-page.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPageComponent implements OnInit {
	readonly store = inject(LearningStoreService);
	readonly review = inject(ReviewSessionService);
	readonly router = inject(Router);
	private readonly dialog = inject(MatDialog);
	readonly state = this.store.state;

	// Keep the current increasing widths so the five Leitner houses retain their pyramid silhouette.
	readonly houseWidths = [40, 54, 70, 85, 100] as const;
	readonly dueCount = computed(() => this.state() ? getDueWords(this.state()!).length : 0);
	readonly stats = computed(() => this.state() ? totalStats(this.state()!) : {attempts: 0, correct: 0, mistakes: 0, mastered: 0, learning: 0});
	readonly dailyNewGoal = computed(() => this.state()?.settings.dailyNew || 10);
	readonly todayNewCount = computed(() => this.state()?.daily[localDay()]?.newAdded || 0);
	readonly todayProgress = computed(() => {
		const goal = this.dailyNewGoal();
		return goal ? Math.min(100, Math.round((this.todayNewCount() / goal) * 100)) : 100;
	});
	readonly todayLabel = new Intl.DateTimeFormat('en-US', {
		weekday: 'long',
		month: 'short',
		day: 'numeric',
	}).format(new Date());
	readonly houseDistribution = computed(() => buildLeitnerDistribution(this.state()?.words || [], localDay()));
	readonly statCards = computed(() => {
		const stats = this.stats();
		const overallAccuracy = accuracy(stats.correct, stats.attempts);
		return [
			{label: 'Due reviews', value: this.dueCount(), note: 'words'},
			{label: 'Overall accuracy', value: overallAccuracy === null ? '—' : `${overallAccuracy}%`, note: 'all primary answers'},
			{label: 'Mastered', value: stats.mastered, note: 'House 5'},
			{label: 'Words in Leitner', value: this.houseDistribution().total.toLocaleString('en-US'), note: 'total active words'},
		];
	});
	readonly hardest = computed(() => this.state() ? hardWords(this.state()!, 3) : []);
	readonly activity = computed<LearningChartPoint[]>(() => {
		const state = this.state();
		if (!state) return [];
		const formatter = new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric'});
		const days = Array.from({length: 14}, (_, index) => {
			const date = new Date();
			date.setDate(date.getDate() - (13 - index));
			return date;
		});
		return days.map((date) => {
			const day = localDay(date);
			return {key: day, value: state.daily[day]?.correct || 0, label: formatter.format(date)};
		});
	});

	async ngOnInit(): Promise<void> {
		await this.store.initialize();
	}

	goReview(): void {
		void this.router.navigateByUrl('/review');
	}

	async startBoxOne(): Promise<void> {
		await this.router.navigate(['/review'], {queryParams: {mode: 'box1'}});
	}

	segmentTooltip(box: number, stage: number, stateCount: number, count: number): string {
		return `House ${box} · State ${stage} of ${stateCount} · ${count} ${count === 1 ? 'word' : 'words'}`;
	}

	async addNewWords(): Promise<void> {
		const state = this.store.snapshot();
		const available = state.words
			.filter((word) => word.box === 0 && !word.introducedOn)
			.sort((a, b) => a.number - b.number);
		if (!available.length) return;
		const count = await firstValueFrom(this.dialog.open(NewWordsDialogComponent, {
			data: {available: available.length, max: Math.min(50, available.length)},
		}).afterClosed());
		if (!count) return;
		const result = await this.store.activateWords(available.slice(0, Number(count)), 'home-selection');
		this.review.prepareNewWords(result.activated.map((word) => word.id));
		await this.router.navigate(['/review'], {queryParams: {mode: 'new'}});
	}
}
