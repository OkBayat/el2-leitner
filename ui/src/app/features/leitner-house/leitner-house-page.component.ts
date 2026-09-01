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
      <header><button mat-stroked-button (click)="router.navigateByUrl('/dashboard')">← بازگشت</button><div><p>جعبه لایتنر</p><h1>واژه‌های خانهٔ {{ house() }}</h1></div></header>
      @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
      @if (model(); as model) {
        <mat-card appearance="outlined" class="info">
          <div><span class="chip">خانهٔ {{ model.house.number }}</span><h2>{{ model.summary.totalWords }} واژه در این خانه</h2><p>فاصلهٔ مرور این خانه {{ model.house.reviewIntervalDays }} روز است و {{ model.house.stateCount }} وضعیت زمانی دارد.</p></div>
          <div class="meta"><div><span>تعداد واژه</span><strong>{{ model.summary.totalWords }}</strong></div><div><span>موعد مرور</span><strong>{{ model.summary.dueWords }}</strong></div><div><span>مجموع خطا</span><strong>{{ model.summary.totalMistakes }}</strong></div><div><span>مجموع تلاش</span><strong>{{ model.summary.totalAttempts }}</strong></div></div>
        </mat-card>
        <mat-card appearance="outlined" class="list">
          <div class="controls"><div><h2>فهرست واژه‌ها</h2><p>{{ filtered().length }} نتیجه</p></div><mat-form-field appearance="outline"><mat-label>جستجوی واژه‌ها</mat-label><input matInput [formControl]="search"></mat-form-field><mat-form-field appearance="outline"><mat-label>مرتب‌سازی</mat-label><mat-select [formControl]="sort"><mat-option value="mistakes">بیشترین اشتباه</mat-option><mat-option value="due">نزدیک‌ترین مرور</mat-option><mat-option value="recent">آخرین مرور</mat-option><mat-option value="alpha">حروف الفبا</mat-option></mat-select></mat-form-field></div>
          <div class="table"><table mat-table [dataSource]="filtered()">
            <ng-container matColumnDef="term"><th mat-header-cell *matHeaderCellDef>واژه</th><td mat-cell *matCellDef="let word"><strong dir="ltr">{{ word.term }}</strong><small dir="ltr">{{ word.accepted.join(' / ') }}</small></td></ng-container>
            <ng-container matColumnDef="source"><th mat-header-cell *matHeaderCellDef>دسته / درس</th><td mat-cell *matCellDef="let word">{{ word.category }} · {{ word.lessons.join('، ') || '—' }}</td></ng-container>
            <ng-container matColumnDef="attempts"><th mat-header-cell *matHeaderCellDef>تلاش</th><td mat-cell *matCellDef="let word">{{ word.attempts }}</td></ng-container>
            <ng-container matColumnDef="mistakes"><th mat-header-cell *matHeaderCellDef>اشتباه</th><td mat-cell *matCellDef="let word">{{ word.mistakes }}</td></ng-container>
            <ng-container matColumnDef="due"><th mat-header-cell *matHeaderCellDef>مرور بعدی</th><td mat-cell *matCellDef="let word">{{ formatDue(word.due) }}</td></ng-container>
            <ng-container matColumnDef="last"><th mat-header-cell *matHeaderCellDef>آخرین مرور</th><td mat-cell *matCellDef="let word">{{ formatDate(word.lastReviewed) }}</td></ng-container>
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
  private readonly subscription = this.route.paramMap.subscribe((params) => {
    const house = Number(params.get('house'));
    if (Number.isInteger(house) && house >= 1 && house <= 5) { this.house.set(house); void this.load(house); }
    else this.error.set('شمارهٔ خانه معتبر نیست. فقط خانه‌های ۱ تا ۵ قابل نمایش هستند.');
  });
  readonly filtered = computed(() => {
    const model = this.model();
    if (!model) return [];
    const query = normalizeAnswer(this.searchValue());
    const sort = this.sortValue();
    return model.words
      .filter((word) => !query || normalizeAnswer(`${word.term} ${word.accepted.join(' ')} ${word.category} ${word.tags.join(' ')} ${word.lessons.join(' ')}`).includes(query))
      .sort((a, b) => sort === 'mistakes' ? b.mistakes - a.mistakes || a.number - b.number : sort === 'due' ? (a.due || '9999').localeCompare(b.due || '9999') : sort === 'recent' ? (b.lastReviewed || '').localeCompare(a.lastReviewed || '') : a.term.localeCompare(b.term, 'en'));
  });

  ngOnDestroy(): void { this.subscription.unsubscribe(); }
  async load(house: number): Promise<void> { this.error.set(''); try { this.model.set(await this.api.getHouse<HouseModel>(house)); } catch (error) { this.error.set(error instanceof Error ? error.message : 'دریافت اطلاعات خانه انجام نشد.'); } }
  formatDue(day: string | null): string { if (!day) return '—'; const today = localDay(); if (day < today) return 'عقب‌افتاده'; if (day === today) return 'امروز'; const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); if (day === localDay(tomorrow)) return 'فردا'; return new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(`${day}T12:00:00`)); }
  formatDate(value: string | null): string { if (!value) return 'هنوز مرور نشده'; const date = new Date(value); return Number.isNaN(date.valueOf()) ? '—' : new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'short', day: 'numeric' }).format(date); }
}
