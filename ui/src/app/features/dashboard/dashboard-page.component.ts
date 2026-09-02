import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ReviewSessionService } from '../../application/review/review-session.service';
import { LearningStoreService } from '../../core/state/learning-store.service';
import { buildLeitnerDistribution } from '../../domain/learning/leitner-distribution';
import { accuracy, getDueWords, hardWords, localDay, totalStats } from '../../domain/learning/learning-rules';
import { LearningChartComponent, type LearningChartPoint } from '../../shared/charts/learning-chart.component';

@Component({
  selector: 'app-new-words-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `<h2 mat-dialog-title>Add new words</h2><mat-dialog-content><p>{{ data.available }} words have not entered the Leitner box yet.</p><mat-form-field appearance="outline"><mat-label>Number of words</mat-label><input matInput type="number" [formControl]="count" min="1" [max]="data.max"></mat-form-field></mat-dialog-content><mat-dialog-actions align="end"><button mat-button (click)="dialog.close()">Cancel</button><button mat-flat-button [disabled]="count.invalid" (click)="dialog.close(count.value)">Add and start session</button></mat-dialog-actions>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewWordsDialogComponent {
  readonly data = inject<{ available: number; max: number }>(MAT_DIALOG_DATA);
  readonly dialog = inject(MatDialogRef<NewWordsDialogComponent>);
  readonly count = new FormControl(10, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(this.data.max)] });
}

@Component({
  selector: 'app-dashboard-page',
  imports: [MatButtonModule, MatCardModule, RouterLink, LearningChartComponent],
  template: `
    @if(state(); as s){
      <section class="page">
        <header>
          <p>Today's plan</p>
          <h1>{{ dueCount() ? dueCount() + ' reviews are waiting for you' : "Today's plan is complete!" }}</h1>
          <p>Complete due reviews and new words in one short session.</p>
          <div class="actions">
            <button mat-flat-button (click)="goReview()" [disabled]="!dueCount()">Start today's review</button>
            <button mat-stroked-button (click)="startBoxOne()">Free practice: House 1</button>
            <button mat-stroked-button (click)="addNewWords()">Add new words</button>
          </div>
        </header>

        <div class="stats">
          @for(card of statCards(); track card.label){
            <mat-card appearance="outlined"><mat-card-subtitle>{{ card.label }}</mat-card-subtitle><mat-card-title>{{ card.value }}</mat-card-title><span>{{ card.unit }}</span></mat-card>
          }
        </div>

        <div class="grid">
          <mat-card appearance="outlined" class="activity-card">
            <mat-card-header>
              <mat-card-title>14-day activity</mat-card-title>
              <mat-card-subtitle>Correct primary answers per day</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content class="chart-content">
              <app-learning-chart
                type="bar"
                [points]="activity()"
                ariaLabel="Correct primary answers over the last 14 days"
              />
            </mat-card-content>
          </mat-card>

          <mat-card appearance="outlined" class="leitner-status-card" data-testid="house-status">
            <mat-card-header class="leitner-head">
              <div>
                <mat-card-title>House status</mat-card-title>
                <mat-card-subtitle>Words across the real Leitner waiting states</mat-card-subtitle>
              </div>
              <span class="leitner-total">Total: {{ houseDistribution().total }} words</span>
            </mat-card-header>
            <mat-card-content class="leitner-list">
              @for(house of houseDistribution().houses; track house.box){
                <a
                  class="leitner-row"
                  [class]="'leitner-row leitner-house--' + house.box"
                  [routerLink]="['/leitner-house', house.box]"
                  [attr.aria-label]="'View all words in House ' + house.box"
                  [attr.data-house]="house.box"
                  [attr.data-state-count]="house.segments.length"
                >
                  <div class="leitner-house-label">
                    <span class="leitner-house-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24"><path d="M4.75 10.25 12 4.5l7.25 5.75v8.5a1.75 1.75 0 0 1-1.75 1.75h-11a1.75 1.75 0 0 1-1.75-1.75v-8.5Z"/><path d="M9.25 20.5v-6.25h5.5v6.25"/></svg>
                    </span>
                    <strong>House {{ house.box }}</strong>
                  </div>

                  <div class="leitner-segments" [style.width.%]="houseWidths[house.box - 1]" [style.--segment-count]="house.segments.length">
                    @for(count of house.segments; track $index){
                      <span
                        class="leitner-segment"
                        [class.is-occupied]="count > 0"
                        [class.is-empty]="count === 0"
                        [attr.data-tooltip]="segmentTooltip(house.box, $index + 1, house.segments.length, count)"
                        [attr.title]="segmentTooltip(house.box, $index + 1, house.segments.length, count)"
                      ><b>{{ count }}</b></span>
                    }
                  </div>

                  <div class="leitner-row-total"><strong>{{ house.total }}</strong><span>words</span></div>
                </a>
              }
            </mat-card-content>
          </mat-card>
        </div>

        <mat-card appearance="outlined">
          <mat-card-header><mat-card-title>Needs more attention</mat-card-title><span class="spacer"></span><button mat-button (click)="router.navigateByUrl('/words')">View all</button></mat-card-header>
          <mat-card-content>@if(hardest().length){@for(word of hardest(); track word.id){<div class="hard-word"><strong>{{ word.term }}</strong><span>{{ word.mistakes }} mistakes · {{ word.attempts }} attempts</span></div>}}@else{<p>No mistakes recorded yet.</p>}</mat-card-content>
        </mat-card>
      </section>
    }
  `,
  styles: [`
    :host{display:block}.page{display:grid;gap:20px}.page>header{padding:32px;border-radius:28px;background:var(--mat-sys-primary-container);color:var(--mat-sys-on-primary-container)}header h1{font-size:clamp(26px,4vw,42px);margin:6px 0}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.stats mat-card{padding:18px}.stats mat-card-title{font-size:30px}.grid{display:grid;grid-template-columns:minmax(280px,1fr) minmax(500px,820px);gap:18px;align-items:stretch}.grid mat-card{padding:18px}.activity-card{min-width:0;background:linear-gradient(155deg,color-mix(in srgb,var(--mat-sys-primary) 5%,var(--mat-sys-surface)) 0%,var(--mat-sys-surface) 42%)}.chart-content{padding-top:8px}.hard-word{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--mat-sys-outline-variant)}.spacer{flex:1}

    .leitner-status-card{position:relative;isolation:isolate;min-width:0;overflow:visible;background:radial-gradient(circle at 0 0,color-mix(in srgb,var(--mat-sys-primary) 10%,transparent) 0 42px,transparent 43px),radial-gradient(circle at 0 0,color-mix(in srgb,var(--mat-sys-primary) 5%,transparent) 0 76px,transparent 77px),var(--mat-sys-surface)}
    .leitner-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:12px}.leitner-head>div{display:grid;gap:3px}.leitner-total{display:inline-flex;min-height:31px;align-items:center;border:1px solid var(--mat-sys-outline-variant);border-radius:999px;background:var(--mat-sys-surface-container-low);color:var(--mat-sys-on-surface-variant);padding:5px 11px;font-size:11px;white-space:nowrap}.leitner-list{display:grid;gap:8px;overflow:visible}
    .leitner-row{--house-tone:var(--mat-sys-primary);display:grid;min-width:0;grid-template-columns:94px minmax(0,1fr) 64px;align-items:center;gap:12px;min-height:38px;border-radius:12px;color:inherit;padding:2px 5px;text-decoration:none;transition:background .16s ease,box-shadow .16s ease}.leitner-row:hover{background:var(--mat-sys-surface-container-low)}.leitner-row:focus-visible{outline:3px solid color-mix(in srgb,var(--house-tone) 24%,transparent);outline-offset:2px}.leitner-house--2{--house-tone:var(--mat-sys-tertiary)}.leitner-house--3{--house-tone:var(--mat-sys-secondary)}.leitner-house--4{--house-tone:var(--mat-sys-primary)}.leitner-house--5{--house-tone:var(--mat-sys-tertiary)}
    .leitner-house-label{display:flex;min-width:0;align-items:center;gap:8px;white-space:nowrap}.leitner-house-label strong{font-size:12px;font-weight:700}.leitner-house-icon{display:grid;width:32px;height:32px;flex:0 0 32px;place-items:center;border-radius:50%;background:color-mix(in srgb,var(--house-tone) 13%,var(--mat-sys-surface));color:var(--house-tone)}.leitner-house-icon svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    .leitner-segments{display:grid;max-width:630px;min-width:0;justify-self:center;grid-template-columns:repeat(var(--segment-count),minmax(0,1fr));gap:7px}.leitner-segment{position:relative;display:grid;min-width:0;height:30px;place-items:center;border-bottom:2px solid color-mix(in srgb,var(--house-tone) 60%,transparent);background:color-mix(in srgb,var(--house-tone) 13%,var(--mat-sys-surface));color:var(--mat-sys-on-surface);transition:background .16s ease,color .16s ease}.leitner-segment.is-empty{color:var(--mat-sys-on-surface-variant)}.leitner-segment.is-occupied{background:color-mix(in srgb,var(--house-tone) 19%,var(--mat-sys-surface))}.leitner-segment b{overflow:hidden;max-width:100%;padding:0 3px;font-size:10px;font-weight:650;line-height:1;text-overflow:ellipsis}.leitner-segment::after{content:attr(data-tooltip);position:absolute;z-index:20;left:50%;bottom:calc(100% + 8px);width:max-content;max-width:230px;border-radius:9px;background:var(--mat-sys-inverse-surface);color:var(--mat-sys-inverse-on-surface);padding:6px 9px;box-shadow:var(--mat-sys-level2);font-size:10px;line-height:1.5;opacity:0;pointer-events:none;transform:translateX(-50%) translateY(3px);transition:opacity .14s ease,transform .14s ease;white-space:nowrap}.leitner-segment:hover::after{opacity:1;transform:translateX(-50%) translateY(0)}
    .leitner-row-total{position:relative;display:flex;align-items:baseline;justify-content:flex-end;gap:4px;color:var(--mat-sys-on-surface-variant);white-space:nowrap}.leitner-row-total::before{content:"";position:absolute;top:50%;right:calc(100% + 7px);width:18px;border-top:1px dashed var(--mat-sys-outline-variant);transform:translateY(-50%)}.leitner-row-total strong{color:var(--mat-sys-on-surface);font-size:13px;font-weight:750}.leitner-row-total span{font-size:9px}

    @media(max-width:1180px){.grid{grid-template-columns:1fr}.leitner-status-card{order:-1;width:min(100%,820px);justify-self:center}.activity-card{min-width:0}}
    @media(max-width:700px){.stats{grid-template-columns:1fr 1fr}.leitner-head{align-items:flex-start;flex-direction:column}.leitner-row{grid-template-columns:78px minmax(0,1fr) 52px;gap:7px}.leitner-house-icon{display:none}.leitner-segments{gap:4px}.leitner-house--5 .leitner-segments{grid-template-columns:repeat(var(--segment-count),minmax(18px,1fr));overflow-x:auto;scrollbar-width:thin}.leitner-segment{height:28px}.leitner-row-total::before{display:none}}
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPageComponent implements OnInit {
  readonly store = inject(LearningStoreService);
  readonly review = inject(ReviewSessionService);
  readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  readonly state = this.store.state;
  readonly houseWidths = [40, 54, 70, 85, 100] as const;
  readonly dueCount = computed(() => this.state() ? getDueWords(this.state()!).length : 0);
  readonly stats = computed(() => this.state() ? totalStats(this.state()!) : { attempts: 0, correct: 0, mistakes: 0, mastered: 0, learning: 0 });
  readonly statCards = computed(() => {
    const s = this.state(); const stats = this.stats(); const today = s?.daily[localDay()];
    return [
      { label: 'Due reviews', value: this.dueCount(), unit: 'words' },
      { label: 'Overall accuracy', value: accuracy(stats.correct, stats.attempts) ?? '—', unit: '%' },
      { label: 'Mastered', value: stats.mastered, unit: 'House 5' },
      { label: 'New today', value: today?.newAdded || 0, unit: `of ${s?.settings.dailyNew || 10}` },
    ];
  });
  readonly hardest = computed(() => this.state() ? hardWords(this.state()!, 3) : []);
  readonly houseDistribution = computed(() => buildLeitnerDistribution(this.state()?.words || [], localDay()));
  readonly activity = computed<LearningChartPoint[]>(() => {
    const state = this.state(); if (!state) return [];
    const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
    const days = Array.from({ length: 14 }, (_, i) => { const date = new Date(); date.setDate(date.getDate() - (13 - i)); return date; });
    return days.map((date) => {
      const day = localDay(date);
      return { key: day, value: state.daily[day]?.correct || 0, label: formatter.format(date) };
    });
  });

  async ngOnInit(): Promise<void> { await this.store.initialize(); }
  goReview(): void { void this.router.navigateByUrl('/review'); }
  async startBoxOne(): Promise<void> { await this.router.navigate(['/review'], { queryParams: { mode: 'box1' } }); }
  segmentTooltip(box: number, stage: number, stateCount: number, count: number): string { return `House ${box} · State ${stage} of ${stateCount} · ${count} ${count === 1 ? 'word' : 'words'}`; }

  async addNewWords(): Promise<void> {
    const state = this.store.snapshot();
    const available = state.words.filter((word) => word.box === 0 && !word.introducedOn).sort((a, b) => a.number - b.number);
    if (!available.length) return;
    const count = await firstValueFrom(this.dialog.open(NewWordsDialogComponent, { data: { available: available.length, max: Math.min(50, available.length) } }).afterClosed());
    if (!count) return;
    const result = await this.store.activateWords(available.slice(0, Number(count)), 'home-selection');
    this.review.prepareNewWords(result.activated.map((word) => word.id));
    await this.router.navigate(['/review'], { queryParams: { mode: 'new' } });
  }
}
