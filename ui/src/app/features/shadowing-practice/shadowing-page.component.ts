import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { firstValueFrom } from 'rxjs';
import { ShadowingSessionService } from '../../application/shadowing-practice/shadowing-session.service';
import { PcmRecorderService } from '../../core/shadowing-practice/pcm-recorder.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-shadowing-page',
  imports: [MatButtonModule, MatCardModule, MatProgressBarModule],
  providers: [ShadowingSessionService, PcmRecorderService],
  templateUrl: './shadowing-page.component.html',
  styleUrls: ['../review/review-page.component.scss', '../sentence-practice/sentence-practice-page.component.scss', './shadowing-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShadowingPageComponent implements OnInit, OnDestroy {
  readonly session = inject(ShadowingSessionService);
  readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  ngOnInit(): void { void this.session.load(); }
  ngOnDestroy(): void { this.session.dispose(); }

  async exit(): Promise<void> {
    this.session.pause();
    const confirmed = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Exit shadowing', message: 'Your completed attempts are saved. No Leitner boxes or review dates will change.', confirmLabel: 'Exit' },
    }).afterClosed());
    if (!confirmed) return;
    await this.session.complete();
    await this.router.navigateByUrl('/dashboard');
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (document.hidden && this.session.busy()) this.session.pause();
  }
  @HostListener('window:pagehide')
  onPageHide(): void { this.session.dispose(); }
}
