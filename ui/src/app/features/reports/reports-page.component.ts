import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { VocoButtonComponent } from '../../shared/voco-button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { LearningStoreService } from '../../core/state/learning-store.service';
import { accuracy, calculateStreak, daysAgo, hardWords, isActiveLeitnerWord, totalStats } from '../../domain/learning/learning-rules';
import { LearningChartComponent, type LearningChartPoint } from '../../shared/charts/learning-chart.component';

@Component({
  selector: 'app-reports-page',
  imports: [VocoButtonComponent, MatCardModule, MatProgressBarModule, MatTableModule, LearningChartComponent],
  template: `
    @if(state(); as s){
      <section class="page">
        <header>
          <div><h1>Progress Report</h1><p>A clear view of your learning trend and weak spots</p></div>
          <voco-primary-button (click)="exportAnalysis()"
						>Export for ChatGPT analysis</voco-primary-button>
        </header>

        <div class="stats">
          @for(card of cards(); track card.label){
            <mat-card appearance="outlined"><mat-card-subtitle>{{ card.label }}</mat-card-subtitle><mat-card-title>{{ card.value }}</mat-card-title></mat-card>
          }
        </div>

        <mat-card appearance="outlined" class="accuracy-card">
          <mat-card-header>
            <mat-card-title>30-day accuracy</mat-card-title>
            <mat-card-subtitle>Daily accuracy from primary answers; gaps mean no answers were recorded that day</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content class="chart-content">
            <app-learning-chart
              type="line"
              [points]="trend()"
              [min]="0"
              [max]="100"
              suffix="%"
              ariaLabel="Daily answer accuracy over the last 30 days"
            />
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined">
          <mat-card-header><mat-card-title>Progress metrics</mat-card-title></mat-card-header>
          <mat-card-content>
            @for(metric of metrics(); track metric.label){
              <div class="metric">
                <div><span>{{ metric.label }}</span><strong>{{ metric.value }}%</strong></div>
                <mat-progress-bar mode="determinate" [value]="metric.value"/>
                <small>{{ metric.detail }}</small>
              </div>
            }
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined">
          <mat-card-header><mat-card-title>Hardest words</mat-card-title></mat-card-header>
          <mat-card-content>
            <table mat-table [dataSource]="hardest()">
              <ng-container matColumnDef="term"><th mat-header-cell *matHeaderCellDef>Word</th><td mat-cell *matCellDef="let w"><strong>{{ w.term }}</strong></td></ng-container>
              <ng-container matColumnDef="mistakes"><th mat-header-cell *matHeaderCellDef>Mistakes</th><td mat-cell *matCellDef="let w">{{ w.mistakes }}</td></ng-container>
              <ng-container matColumnDef="attempts"><th mat-header-cell *matHeaderCellDef>Attempts</th><td mat-cell *matCellDef="let w">{{ w.attempts }}</td></ng-container>
              <ng-container matColumnDef="accuracy"><th mat-header-cell *matHeaderCellDef>Accuracy</th><td mat-cell *matCellDef="let w">{{ wordAccuracy(w) }}%</td></ng-container>
              <tr mat-header-row *matHeaderRowDef="columns"></tr><tr mat-row *matRowDef="let row; columns: columns"></tr>
            </table>
          </mat-card-content>
        </mat-card>
      </section>
    }
  `,
  styles: [`
    :host{display:block}.page{display:grid;gap:18px}header{display:flex;justify-content:space-between;align-items:center}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.stats mat-card{padding:18px}.stats mat-card-title{font-size:28px}.accuracy-card{overflow:hidden;background:linear-gradient(155deg,color-mix(in srgb,var(--mat-sys-primary) 5%,var(--mat-sys-surface)) 0%,var(--mat-sys-surface) 44%)}.chart-content{padding-top:8px}.metric{display:grid;gap:7px;margin:14px 0}.metric>div{display:flex;justify-content:space-between}table{width:100%}@media(max-width:800px){.stats{grid-template-columns:1fr 1fr}header{align-items:stretch;flex-direction:column;gap:12px}}
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsPageComponent implements OnInit {
  readonly store = inject(LearningStoreService);
  readonly state = this.store.state;
  readonly columns = ['term', 'mistakes', 'attempts', 'accuracy'];
  readonly stats = computed(() => this.state() ? totalStats(this.state()!) : { attempts: 0, correct: 0, mistakes: 0, mastered: 0, learning: 0 });
  readonly activeDays = computed(() => this.state() ? Object.values(this.state()!.daily).filter((day) => day.attempts > 0).length : 0);
  readonly cards = computed(() => [
    { label: 'Total answers', value: this.stats().attempts },
    { label: 'Correct answers', value: this.stats().correct },
    { label: 'Mistakes', value: this.stats().mistakes },
    { label: 'Active days', value: this.activeDays() },
  ]);
  readonly hardest = computed(() => this.state() ? hardWords(this.state()!, 30) : []);
  readonly trend = computed<LearningChartPoint[]>(() => {
    const state = this.state(); if (!state) return [];
    const formatter = new Intl.DateTimeFormat('en-US', { month: 'numeric', day: 'numeric' });
    return Array.from({ length: 30 }, (_, i) => daysAgo(29 - i)).map((day) => {
      const record = state.daily[day];
      return {
        key: day,
        value: record?.attempts ? Math.round(record.correct / record.attempts * 100) : null,
        label: formatter.format(new Date(`${day}T12:00:00`)),
      };
    });
  });
  readonly metrics = computed(() => {
    const state = this.state(); if (!state) return [];
    const stats = this.stats(), total = state.words.length || 1, introduced = state.words.filter((word) => word.introducedOn).length, streak = calculateStreak(state);
    return [
      { label: 'List coverage', value: Math.round(introduced / total * 100), detail: `${introduced} of ${state.words.length}` },
      { label: 'Full mastery', value: Math.round(stats.mastered / total * 100), detail: `${stats.mastered} words` },
      { label: 'Overall accuracy', value: accuracy(stats.correct, stats.attempts) || 0, detail: `${stats.correct} correct answers` },
      { label: 'Practice consistency', value: Math.min(100, Math.round(streak / 30 * 100)), detail: `${streak}-day streak across ${this.activeDays()} active days` },
    ];
  });
  async ngOnInit(): Promise<void> { await this.store.initialize(); }
  wordAccuracy(word: { correct: number; attempts: number }): number { return accuracy(word.correct, word.attempts) || 0; }
  exportAnalysis(): void {
    const state = this.store.snapshot(), stats = totalStats(state);
    const report = {
      reportType: 'Vocora Learning Analysis', schemaVersion: state.schemaVersion, exportedAt: new Date().toISOString(),
      instructionsForAI: 'Analyse progress, recurring spelling mistakes, hard words, consistency and accuracy. Reply in English with a short diagnosis and a practical 7-day drill.',
      schedulingRules: { dayBoundary: 'local midnight', box1: 'daily and unlimited free practice without promotion', box2To3Days: 2, box3To4Days: 3, box4To5Days: 7, box5ReviewDays: 14, box5Success: 'mastered and removed from scheduled review', wrongAnswer: 'return to box 1 and block promotion until next calendar day' },
      profile: { totalWords: state.words.length, introducedWords: state.words.filter((word) => word.introducedOn).length, masteredWords: stats.mastered, totalAttempts: stats.attempts, correctAnswers: stats.correct, mistakes: stats.mistakes, overallAccuracyPercent: accuracy(stats.correct, stats.attempts), activeDays: this.activeDays(), currentStreakDays: calculateStreak(state), dailyNewTarget: state.settings.dailyNew, dailyAnswerGoal: state.settings.dailyGoal },
      boxDistribution: Object.fromEntries([0,1,2,3,4,5].map((box) => [box === 0 ? 'new' : `box_${box}`, state.words.filter((word) => word.box === box && (box === 0 || isActiveLeitnerWord(word))).length])),
      last90Days: Object.fromEntries(Object.entries(state.daily).filter(([day]) => day >= daysAgo(89)).sort(([a],[b]) => a.localeCompare(b))),
      hardestWords: hardWords(state, 100), recentMistakeEvents: state.history.filter((event) => !event.correct).slice(-250),
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `vocora-analysis-${new Date().toISOString().slice(0,10)}.json`; link.click(); URL.revokeObjectURL(url);
  }
}
