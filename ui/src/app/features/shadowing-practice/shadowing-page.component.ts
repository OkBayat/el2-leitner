import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { Router } from '@angular/router';
import { VocoButtonComponent } from '../../shared/voco-button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { firstValueFrom } from 'rxjs';
import { ShadowingSessionService } from '../../application/shadowing-practice/shadowing-session.service';
import { PcmRecorderService } from '../../core/shadowing-practice/pcm-recorder.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-shadowing-page',
  standalone: true,
  imports: [VocoButtonComponent, MatCardModule, MatProgressBarModule],
  providers: [ShadowingSessionService, PcmRecorderService],
  templateUrl: './shadowing-page.component.html',
  styleUrls: ['../review/review-page.component.scss', '../sentence-practice/sentence-practice-page.component.scss', './shadowing-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShadowingPageComponent implements OnInit, OnDestroy {
  readonly session = inject(ShadowingSessionService);
  readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  @Input() embedded = false;
  @Output() readonly completed = new EventEmitter<string>();
  @Output() readonly cancelled = new EventEmitter<void>();

  ngOnInit(): void { void this.session.load(); }
  ngOnDestroy(): void { this.session.dispose(); }

  async finish(): Promise<void> {
    if (this.session.counts().completedCount <= 0) return;
    const sessionId = await this.session.complete();
    if (sessionId && this.embedded) this.completed.emit(sessionId);
  }

  async exit(): Promise<void> {
    this.session.pause();
    const confirmed = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Exit shadowing', message: 'Your completed attempts are saved. No Leitner boxes or review dates will change.', confirmLabel: 'Exit' },
    }).afterClosed());
    if (!confirmed) return;
    await this.session.complete();
    if (this.embedded) {
      this.cancelled.emit();
      return;
    }
    await this.router.navigateByUrl('/dashboard');
  }

  back(): void {
    if (this.embedded) {
      this.cancelled.emit();
      return;
    }
    void this.router.navigateByUrl('/dashboard');
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (document.hidden && this.session.busy()) this.session.pause();
  }
  @HostListener('window:pagehide')
  onPageHide(): void { this.session.dispose(); }
}
