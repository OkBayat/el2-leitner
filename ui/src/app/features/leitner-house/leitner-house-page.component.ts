import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { LearningApiService } from '../../core/learning/learning-api.service';
import { localDay, normalizeAnswer } from '../../domain/learning/learning-rules';
import { LearningWord } from '../../domain/learning/models';

const LEGACY_UNCATEGORIZED = '\u0628\u062f\u0648\u0646 \u062f\u0633\u062a\u0647\u200c\u0628\u0646\u062f\u06cc';

interface HouseModel {
  house: { number: number; reviewIntervalDays: number; stateCount: number };
  summary: { totalWords: number; dueWords: number; totalMistakes: number; totalAttempts: number };
  words: LearningWord[];
}

@Component({
  selector: 'app-leitner-house-page',
  imports: [ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatTableModule],
  template: `
    <section class="page">
      <header><button mat-stroked-button (click)="router.navigateByUrl('/dashboard')">← Back</button><div><p>Leitner box</p><h1>Box {{ house() }} words</h1></div></header>
      @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
      @if (model(); as model) {
        <mat-card appearance="outlined" class="info">
          <div><span class="chip">Box {{ model.house.number }}</span><h2>{{ model.summary.totalWords }} words in this box</h2><p>This box has a {{ model.house.reviewIntervalDays }}-day review interval and {{ model.house.stateCount }} timing states.</p></div>
          <div class="meta"><div><span>Word count</span><strong>{{ model.summary.totalWords }}</strong></div><div><span>Due reviews</span><strong>{{ model.summary.dueWords }}</strong></div><div><span>Total mistakes</span><strong>{{ model.summary.totalMistakes }}</strong></div><div><span>Total attempts</span><strong>{{ model.summary.totalAttempts }}</strong></div></div>
        </mat-card>
        <mat-card appearance="outlined" class="list">
          <div class="controls"><div><h2>Word list</h2><p>{{ filtered().length }} results</p></div><mat-form-field appearance="outline"><mat-label>Search words</mat-label><input matInput [formControl]="search"></mat-form-field><mat-form-field appearance="outline"><mat-label>Sort</mat-label><mat-select [formControl]="sort"><mat-option value="mistakes">Most mistakes</mat-option><mat-option value="due">Next due</mat-option><mat-option value="recent">Last reviewed</mat-option><mat-option value="alpha">Alphabetical</mat-option></mat-select></mat-form-field></div>
          <div class="table"><table mat-table [dataSource]="filtered()">
            <ng-container matColumnDef="term"><th mat-header-cell *matHeaderCellDef>Word</th><td mat-cell *matCellDef="let word"><strong>{{ word.term }}</strong><small>{{ word.accepted.join(' / ') }}</small></td></ng-container>
            <ng-container matColumnDef="source"><th mat-header-cell *matHeaderCellDef>Category / lesson</th><td mat-cell *matCellDef="let word">{{ category(word.category) }} · {{ word.lessons.join(', ') || '—' }}</td></ng-container>
            <ng-container matColumnDef="attempts"><th mat-header-cell *matHeaderCellDef>Attempts</th><td mat-cell *matCellDef="let word">{{ word.attempts }}</td></ng-container>
            <ng-container matColumnDef="mistakes"><th mat-header-cell *matHeaderCellDef>Mistakes</th><td mat-cell *matCellDef="let word">{{ word.mistakes }}</td></ng-container>
            <ng-container matColumnDef="due"><th mat-header-cell *matHeaderCellDef>Next review</th><td mat-cell *matCellDef="let word">{{ formatDue(word.due) }}</td></ng-container>
            <ng-container matColumnDef="last"><th mat-header-cell *matHeaderCellDef>Last review</th><td mat-cell *matCellDef="let word">{{ formatDate(word.lastReviewed) }}</td></ng-container>
            <tr mat-header-row *matHeaderRowDef="columns"></tr><tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table></div>
        </mat-card>
      }
    </section>
  `,
  styles: [`
    :host{display:block}.page{display:grid;gap:18px}header{display:flex;align-items:center;gap:14px}.info{padding:22px;display:grid;grid-template-columns:1fr 1.2fr;gap:18px}.chip{display:inline-flex;padding:6px 12px;border-radius:999px;background:var(--mat-sys-primary-container);color:var(--mat-sys-on-primary-container)}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px}.meta div{display:grid;padding:12px;border-radius:14px;background:var(--mat-sys-surface-container)}.meta strong{font-size:22px}.list{overflow:hidden}.controls{display:grid;grid-template-columns:1fr minmax(220px,360px) 190px;gap:10px;align-items:center;padding:18px}.table{overflow:auto}table{width:100%;min-width:760px}td strong,td small{display:block}.error{padding:14px;border-radius:14px;background:var(--mat-sys-error-container);color:var(--mat-sys-on-error-container)}@media(max-width:800px){.info,.controls{grid-template-columns:1fr}}
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeitnerHousePageComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(LearningApiService);
  readonly router = inject(Router);
  readonly house = signal(0);
  readonly model = signal<HouseModel | null>(null);
  readonly error = signal('');
  readonly search = new FormControl('', { nonNullable: true });
  readonly sort = new FormControl('mistakes', { nonNullable: true });
  private readonly searchValue = toSignal(this.search.valueChanges, { initialValue: this.search.value });
  private readonly sortValue = toSignal(this.sort.valueChanges, { initialValue: this.sort.value });
  readonly columns = ['term', 'source', 'attempts', 'mistakes', 'due', 'last'];
  readonly category = (value: string): string => !value || value === LEGACY_UNCATEGORIZED ? 'Uncategorized' : value;
  private readonly subscription = this.route.paramMap.subscribe((params) => {
    const house = Number(params.get('house'));
    if (Number.isInteger(house) && house >= 1 && house <= 5) { this.house.set(house); void this.load(house); }
    else this.error.set('Invalid box number. Only Boxes 1 through 5 are available.');
  });
  readonly filtered = computed(() => {
    const model = this.model();
    if (!model) return [];
    const query = normalizeAnswer(this.searchValue());
    const sort = this.sortValue();
    return model.words
      .filter((word) => !query || normalizeAnswer(`${word.term} ${word.accepted.join(' ')} ${this.category(word.category)} ${word.tags.join(' ')} ${word.lessons.join(' ')}`).includes(query))
      .sort((a, b) => sort === 'mistakes' ? b.mistakes - a.mistakes || a.number - b.number : sort === 'due' ? (a.due || '9999').localeCompare(b.due || '9999') : sort === 'recent' ? (b.lastReviewed || '').localeCompare(a.lastReviewed || '') : a.term.localeCompare(b.term, 'en'));
  });

  ngOnDestroy(): void { this.subscription.unsubscribe(); }
  async load(house: number): Promise<void> { this.error.set(''); try { this.model.set(await this.api.getHouse<HouseModel>(house)); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Could not load this box.'); } }
  formatDue(day: string | null): string { if (!day) return '—'; const today = localDay(); if (day < today) return 'Overdue'; if (day === today) return 'Today'; const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); if (day === localDay(tomorrow)) return 'Tomorrow'; return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(`${day}T12:00:00`)); }
  formatDate(value: string | null): string { if (!value) return 'Never reviewed'; const date = new Date(value); return Number.isNaN(date.valueOf()) ? '—' : new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date); }
}
