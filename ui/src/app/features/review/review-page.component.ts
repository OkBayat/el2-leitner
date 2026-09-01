import { ChangeDetectionStrategy, Component, ElementRef, HostListener, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ReviewSessionService } from '../../application/review/review-session.service';
import { LearningStoreService } from '../../core/state/learning-store.service';
import { ThemeService } from '../../core/theme/theme.service';
import { getDueWords, localDay } from '../../domain/learning/learning-rules';
import { ReviewMode } from '../../domain/learning/models';
import { RemediationPhase } from '../../domain/remediation/remediation';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { ShareStoryService } from '../../shared/share-story/share-story.service';

@Component({
  selector: 'app-review-page',
  imports: [ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatProgressBarModule, MatSelectModule, MatSnackBarModule],
  template: `
    <section class="review-page" data-testid="review-layout">
      @if (!session.active() && !session.completed()) {
        <div class="review-center">
          <button class="review-close" mat-icon-button type="button" aria-label="Back to dashboard" (click)="router.navigateByUrl('/dashboard')">×</button>
          <mat-card class="setup" appearance="outlined">
            <mat-card-header><mat-card-title>Today's Review</mat-card-title></mat-card-header>
            <mat-card-content>
              <div class="breakdown">
                <div><strong>{{ dueCount() }}</strong><span>Ready cards</span></div>
                <div><strong>{{ newCount() }}</strong><span>New words</span></div>
                <div><strong>{{ estimatedMinutes() }}</strong><span>Estimated minutes</span></div>
              </div>
              <mat-form-field appearance="outline">
                <mat-label>Maximum cards</mat-label>
                <mat-select [formControl]="limit">
                  <mat-option [value]="0">All</mat-option><mat-option [value]="10">10 cards</mat-option>
                  <mat-option [value]="20">20 cards</mat-option><mat-option [value]="30">30 cards</mat-option>
                </mat-select>
              </mat-form-field>
            </mat-card-content>
            <mat-card-actions><button mat-flat-button (click)="start('review')">Start session</button><button mat-stroked-button (click)="start('box1')">Free practice: House 1</button></mat-card-actions>
          </mat-card>
        </div>
      }

      @if (session.active() && session.currentWord(); as word) {
        <div class="review-session" data-testid="review-session">
          <div class="session-bar" data-testid="review-session-bar">
            <button class="session-close" mat-icon-button type="button" aria-label="Exit review" (click)="exit()">×</button>
            <div class="session-progress">
              <span class="visually-hidden">{{ session.currentTask() === 'recheck' ? 'Spelling recheck' : session.answered() + 1 + ' of ' + session.initialCount() }}</span>
              <mat-progress-bar mode="determinate" [value]="session.progress()" />
            </div>
            <span class="session-count">{{ session.currentTask() === 'recheck' ? 'Recheck' : session.answered() + 1 + ' / ' + session.initialCount() }}</span>
          </div>

          <main class="session-stage">
            <article class="flash">
              <div class="flash-heading">
                <span>{{ displayCategory(word.category) }} · House {{ word.box }}</span>
                <h1>{{ session.currentTask() === 'recheck' ? 'Spelling recheck' : 'Listen to the word and type its spelling' }}</h1>
              </div>

              <div class="listen"><button mat-fab extended (click)="session.pronounce()">▶ Play pronunciation</button><button mat-button (click)="session.pronounce(.7)">Slower</button></div>
              @if (session.currentTask() === 'review' && !session.feedback()) {
                <form (submit)="$event.preventDefault(); submit()" class="answer-form">
                  <mat-form-field appearance="outline"><mat-label>Your answer</mat-label><input #answerInput matInput [formControl]="answer" lang="en" autocomplete="off"></mat-form-field>
                  <div class="answer-actions"><button mat-flat-button type="submit" [disabled]="saving()">Check answer</button><button mat-button type="button" (click)="dontKnow()">I don't know</button></div>
                </form>
              }
              @if (session.feedback(); as feedback) { <div class="feedback" [class.wrong]="!feedback.correct"><h2>{{ feedback.title }}</h2><p>{{ feedback.detail }}</p><strong>{{ feedback.spelling }}</strong></div> }
              @if (session.remediation(); as remediation) {
                <section class="remediation">
                  <h3>{{ remediation.phase === Phase.CORRECTION ? 'Spelling correction' : remediation.phase === Phase.COPY ? 'Type it carefully once' : 'Type it again from memory' }}</h3>
                  @if (remediation.answerVisible) {
                    <div class="spelling-comparison" role="group" aria-label="Spelling comparison">
                      <div class="spelling-row user-spelling-row">
                        <span class="spelling-label">Your answer</span>
                        <div class="spelling-text" data-testid="user-spelling">
                          @if (remediation.comparison.answerTokens.length) {
                            @for (token of remediation.comparison.answerTokens; track $index) {
                              <span
                                class="spelling-token"
                                [class.spelling-correct]="token.status === 'correct'"
                                [class.spelling-changed]="token.status === 'changed'"
                                [class.spelling-extra]="token.status === 'extra'"
                              >{{ tokenValue(token.value) }}</span>
                            }
                          } @else { <span class="spelling-empty">No answer</span> }
                        </div>
                      </div>
                      <div class="spelling-row correct-spelling-row">
                        <span class="spelling-label">Correct spelling</span>
                        <div class="spelling-text" data-testid="correct-spelling">
                          @for (token of remediation.comparison.targetTokens; track $index) {
                            <span
                              class="spelling-token"
                              [class.spelling-correct]="token.status === 'correct'"
                              [class.spelling-changed]="token.status === 'changed'"
                              [class.spelling-missing]="token.status === 'missing'"
                            >{{ tokenValue(token.value) }}</span>
                          }
                        </div>
                      </div>
                    </div>
                  }
                  @if (remediation.phase === Phase.CORRECTION) { <button mat-flat-button (click)="acknowledge()">Got it; I'll type it from memory</button> }
                  @else if (remediation.phase !== Phase.COMPLETED) {
                    <mat-form-field appearance="outline"><mat-label>{{ remediation.phase === Phase.COPY ? 'Exact copy' : 'Recall from memory' }}</mat-label><input #remediationInput matInput [formControl]="remediationAnswer" (keydown.enter)="submitRemediation(); $event.preventDefault()"></mat-form-field>
                    <button mat-flat-button (click)="submitRemediation()">Check</button>
                  } @else { <p>This correction is complete. A spelling recheck will appear later in this session.</p> }
                </section>
              }
              @if (session.canAdvance()) { <div class="flash-actions"><button mat-flat-button (click)="next()">Next card</button></div> }
            </article>
          </main>
        </div>
      }

      @if (session.completed()) {
        <div class="review-center">
          <mat-card class="complete" appearance="outlined">
            <mat-card-title>Session complete ★</mat-card-title>
            <mat-card-content><div class="breakdown"><div><strong>{{ session.correct() }}</strong><span>Correct</span></div><div><strong>{{ session.wrong() }}</strong><span>Wrong</span></div><div><strong>{{ session.accuracy() ?? 0 }}%</strong><span>Accuracy</span></div></div></mat-card-content>
            <mat-card-actions><button mat-flat-button (click)="share.open()">Create result story</button><button mat-stroked-button (click)="router.navigateByUrl('/dashboard')">Back home</button><button mat-button (click)="start('box1')">Continue free practice</button></mat-card-actions>
          </mat-card>
        </div>
      }
    </section>
  `,
  styles: [`
    :host{display:block;min-height:100dvh;background:var(--mat-sys-background)}
    .review-page{min-height:100dvh;background:var(--mat-sys-background);color:var(--mat-sys-on-surface)}
    .review-center{position:relative;min-height:100dvh;display:grid;place-items:center;padding:64px 24px}
    .review-close{position:absolute;top:24px;left:max(24px,calc((100vw - 980px)/2));font-size:28px;font-weight:300;color:var(--mat-sys-on-surface-variant)}
    .setup,.complete{width:min(680px,100%);padding:24px;border-radius:28px;background:var(--mat-sys-surface)}
    .breakdown{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:20px 0}.breakdown div{display:grid;padding:16px;background:var(--mat-sys-surface-container);border-radius:16px}.breakdown strong{font-size:26px}
    .review-session{min-height:100dvh;display:grid;grid-template-rows:auto 1fr}
    .session-bar{width:min(980px,calc(100% - 48px));margin:0 auto;padding:28px 0 12px;display:grid;grid-template-columns:40px minmax(0,1fr) auto;gap:16px;align-items:center}
    .session-close{font-size:28px;font-weight:300;color:var(--mat-sys-on-surface-variant)}
    .session-progress{min-width:0}.session-progress mat-progress-bar{--mdc-linear-progress-active-indicator-height:8px;--mdc-linear-progress-track-height:8px;border-radius:999px;overflow:hidden}
    .session-count{min-width:58px;text-align:right;font-size:12px;font-weight:700;color:var(--mat-sys-on-surface-variant)}
    .visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
    .session-stage{display:grid;place-items:center;padding:32px 24px 96px}
    .flash{width:min(680px,100%)}.flash-heading{margin-bottom:24px}.flash-heading span{display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:var(--mat-sys-on-surface-variant)}.flash-heading h1{margin:0;font-size:clamp(26px,3vw,36px);line-height:1.2}
    .listen{display:flex;align-items:center;justify-content:flex-start;gap:10px;margin:24px 0}.answer-form{display:grid;gap:12px}.answer-form mat-form-field{width:100%}.answer-actions{display:flex;gap:10px;justify-content:flex-end}.flash-actions{display:flex;justify-content:flex-end;margin-top:18px}
    .feedback,.remediation{margin-top:16px;padding:18px;border-radius:18px;background:var(--mat-sys-primary-container);color:var(--mat-sys-on-primary-container)}.feedback.wrong{background:var(--mat-sys-error-container);color:var(--mat-sys-on-error-container)}.remediation{background:var(--mat-sys-tertiary-container);color:var(--mat-sys-on-tertiary-container)}.remediation mat-form-field{width:100%}
    .spelling-comparison{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:16px 0 10px}.spelling-row{min-width:0;border:1px solid var(--mat-sys-outline-variant);border-radius:16px;padding:14px 16px;text-align:left}.user-spelling-row{border-color:color-mix(in srgb,var(--mat-sys-error) 35%,var(--mat-sys-outline-variant));background:var(--mat-sys-error-container);color:var(--mat-sys-on-error-container)}.correct-spelling-row{border-color:color-mix(in srgb,var(--mat-sys-primary) 35%,var(--mat-sys-outline-variant));background:var(--mat-sys-primary-container);color:var(--mat-sys-on-primary-container)}.spelling-label{display:block;margin-bottom:6px;font-size:11px;font-weight:700;letter-spacing:.02em;color:var(--mat-sys-on-surface-variant)}.spelling-text{min-height:36px;overflow-wrap:anywhere;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:clamp(20px,4vw,28px);font-weight:750;line-height:1.35;unicode-bidi:isolate}.spelling-token{display:inline-block;min-width:.5ch;border-radius:5px;padding:0 1px}.spelling-correct{color:inherit}.user-spelling-row .spelling-changed,.user-spelling-row .spelling-extra{background:color-mix(in srgb,var(--mat-sys-error) 18%,transparent);color:var(--mat-sys-error);text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:4px}.correct-spelling-row .spelling-changed,.correct-spelling-row .spelling-missing{background:color-mix(in srgb,var(--mat-sys-primary) 22%,transparent);color:var(--mat-sys-primary);text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:4px}.spelling-empty{font-family:inherit;font-size:12px;font-weight:500;color:var(--mat-sys-on-error-container)}
    @media(max-width:600px){
      .review-center{place-items:start stretch;padding:72px 16px 24px}.review-close{top:16px;left:8px}.setup,.complete{width:100%;padding:18px;border-radius:22px}.breakdown{grid-template-columns:1fr}
      .session-bar{width:auto;margin:0;padding:16px 16px 8px;grid-template-columns:36px minmax(0,1fr) auto;gap:10px}.session-close{margin-left:-8px}.session-count{min-width:48px;font-size:11px}
      .session-stage{place-items:start stretch;padding:20px 16px 112px}.flash{width:100%}.flash-heading{margin-bottom:18px}.flash-heading h1{font-size:24px}.listen{margin:18px 0;flex-wrap:wrap}.answer-actions{display:grid;grid-template-columns:1fr}.answer-actions button,.flash-actions button{width:100%}.flash-actions{position:fixed;left:16px;right:16px;bottom:20px;margin:0;padding-top:12px;background:linear-gradient(to bottom,transparent,var(--mat-sys-background) 24%)}.spelling-comparison{grid-template-columns:1fr}
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewPageComponent implements OnInit {
  @ViewChild('answerInput') private answerInput?: ElementRef<HTMLInputElement>;
  @ViewChild('remediationInput') private remediationInput?: ElementRef<HTMLInputElement>;
  readonly session = inject(ReviewSessionService);
  readonly store = inject(LearningStoreService);
  readonly router = inject(Router);
  readonly share = inject(ShareStoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly snack = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly theme = inject(ThemeService);
  readonly Phase = RemediationPhase;
  readonly answer = new FormControl('', { nonNullable: true });
  readonly remediationAnswer = new FormControl('', { nonNullable: true });
  readonly limit = new FormControl(0, { nonNullable: true });
  readonly saving = signal(false);
  readonly state = this.store.state;
  readonly dueCount = computed(() => this.state() ? getDueWords(this.state()!).length : 0);
  readonly newCount = computed(() => this.state() ? getDueWords(this.state()!).filter((word) => word.introducedOn === localDay() && word.box === 1).length : 0);
  readonly estimatedMinutes = computed(() => Math.max(1, Math.ceil(this.dueCount() * .35)));

  async ngOnInit(): Promise<void> {
    const state = await this.store.initialize();
    this.theme.apply(state.settings.theme);
    const mode = this.route.snapshot.queryParamMap.get('mode') as ReviewMode | null;
    if (mode === 'new' || mode === 'box1') await this.start(mode);
  }
  async start(mode: ReviewMode): Promise<void> {
    const ok = await this.session.start(mode, this.limit.value);
    if (!ok) { this.snack.open(mode === 'box1' ? 'There are no cards in House 1 yet.' : 'There are no due reviews.', 'OK', { duration: 3000 }); return; }
    this.focusAnswerInput();
    setTimeout(() => this.session.pronounce(), 200);
  }
  async submit(): Promise<void> { if (!this.answer.value.trim()) return; this.saving.set(true); try { await this.session.submit(this.answer.value); this.answer.setValue(''); } catch (error) { this.snack.open(error instanceof Error ? error.message : 'Could not save your answer.', 'Close'); } finally { this.saving.set(false); } }
  async dontKnow(): Promise<void> { this.saving.set(true); try { await this.session.submit('', true); } finally { this.saving.set(false); } }
  acknowledge(): void { this.session.acknowledgeCorrection(); this.remediationAnswer.setValue(''); this.focusRemediationInput(); }
  submitRemediation(): void { if (!this.remediationAnswer.value.trim()) return; this.session.submitRemediation(this.remediationAnswer.value); this.remediationAnswer.setValue(''); if (this.session.remediation()?.phase !== RemediationPhase.COMPLETED) this.focusRemediationInput(); }
  tokenValue(value: string): string { return value === ' ' ? '\u00a0' : value; }
  async next(): Promise<void> {
    await this.session.next();
    this.answer.setValue(''); this.remediationAnswer.setValue('');
    if (!this.session.active()) return;
    if (this.session.currentTask() === 'review') this.focusAnswerInput(); else this.focusRemediationInput();
    setTimeout(() => this.session.pronounce(), 180);
  }
  async exit(): Promise<void> { const ok = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, { data: { title: 'Exit session', message: 'Saved answers will be kept. Stop this session?', confirmLabel: 'Exit' } }).afterClosed()); if (ok) { await this.session.abandon(); await this.router.navigateByUrl('/dashboard'); } }
  displayCategory(category: string): string { return category || 'Uncategorized'; }

  private focusAnswerInput(): void { setTimeout(() => this.answerInput?.nativeElement.focus()); }
  private focusRemediationInput(): void { setTimeout(() => this.remediationInput?.nativeElement.focus()); }

  @HostListener('document:keydown', ['$event'])
  async onKeyboard(event: KeyboardEvent): Promise<void> {
    if (!this.session.active()) return;
    const target = event.target as HTMLElement | null;
    const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
    if (event.key === ' ' && !typing && !this.session.feedback()) { event.preventDefault(); this.session.pronounce(); }
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
