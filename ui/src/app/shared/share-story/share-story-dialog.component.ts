import { DOCUMENT } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { VocoButtonComponent } from '../voco-button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LearningStoreService } from '../../core/state/learning-store.service';
import { ShareMomentKind, buildShareMoment } from './share-story.model';

@Component({
  selector: 'app-share-story-dialog',
  imports: [MatDialogModule, VocoButtonComponent, MatButtonToggleModule],
  template: `
    <h2 mat-dialog-title>Story Studio</h2>
    <mat-dialog-content class="story-dialog">
      <mat-button-toggle-group [value]="kind()" (change)="selectKind($event.value)">
        <mat-button-toggle value="daily">Today</mat-button-toggle>
        <mat-button-toggle value="journey">Journey</mat-button-toggle>
      </mat-button-toggle-group>
      <div class="preview"><canvas #canvas width="1080" height="1920" aria-label="Vocora story preview"></canvas></div>
      <p class="privacy">The story only shows aggregate stats; your email, typed answers, and missed-word names are never shared.</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <voco-secondary-button (activated)="copyCaption()"
				>Copy caption</voco-secondary-button>
      <voco-secondary-button (activated)="download()"
				>Download PNG</voco-secondary-button>
      <voco-primary-button (activated)="share()">Share</voco-primary-button>
      <voco-navigation-button (activated)="dialog.close()"
				>Close</voco-navigation-button>
    </mat-dialog-actions>
  `,
  styles: [`
    .story-dialog{display:grid;gap:14px;min-width:min(82vw,620px)}.preview{display:grid;place-items:center;background:var(--mat-sys-surface-container);border-radius:24px;padding:14px}.preview canvas{display:block;width:min(100%,290px);height:auto;border-radius:18px;box-shadow:var(--mat-sys-level2)}.privacy{font-size:12px;color:var(--mat-sys-on-surface-variant)}
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShareStoryDialogComponent implements AfterViewInit {
  @ViewChild('canvas', { static: true }) private readonly canvasRef!: ElementRef<HTMLCanvasElement>;
  readonly dialog = inject(MatDialogRef<ShareStoryDialogComponent>);
  private readonly store = inject(LearningStoreService);
  private readonly snack = inject(MatSnackBar);
  private readonly document = inject(DOCUMENT);
  readonly kind = signal<ShareMomentKind>('daily');

  ngAfterViewInit(): void { this.render(); }
  selectKind(kind: ShareMomentKind): void { this.kind.set(kind); this.render(); }

  private moment() { return buildShareMoment(this.store.snapshot(), this.kind()); }
  private render(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const moment = this.moment();
		const styles = this.document.defaultView?.getComputedStyle(canvas);
		const themeColor = (name: string): string => {
			const value = styles?.getPropertyValue(name).trim();
			if (!value) throw new Error(`Missing share-story theme token: ${name}`);
			return value;
		};
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const gradient = ctx.createLinearGradient(0, 0, 1080, 1920);
		gradient.addColorStop(0, themeColor('--vocora-share-story-gradient-start'));
		gradient.addColorStop(1, themeColor('--vocora-share-story-gradient-end'));
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1080, 1920);
		ctx.fillStyle = themeColor('--vocora-share-story-ink'); ctx.textAlign = 'center'; ctx.direction = 'ltr';
    ctx.font = '700 72px sans-serif'; ctx.fillText('VOCORA', 540, 210);
    ctx.font = '700 64px sans-serif'; this.wrap(ctx, moment.title, 540, 520, 850, 90);
    ctx.font = '400 38px sans-serif'; ctx.fillText(moment.subtitle, 540, 720);
		ctx.fillStyle = themeColor('--vocora-share-story-panel'); this.roundedRect(ctx, 125, 900, 830, 510, 44); ctx.fill();
		ctx.fillStyle = themeColor('--vocora-share-story-ink'); ctx.font = '800 120px sans-serif'; ctx.fillText(moment.primaryValue, 540, 1080);
    ctx.font = '500 34px sans-serif'; ctx.fillText(moment.primaryLabel, 540, 1140);
    ctx.font = '800 88px sans-serif'; ctx.fillText(moment.secondaryValue, 540, 1290);
    ctx.font = '500 32px sans-serif'; ctx.fillText(moment.secondaryLabel, 540, 1345);
    ctx.font = '500 30px sans-serif'; ctx.fillText('vocora.app · Real practice, measurable progress', 540, 1740);
  }

  private wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
    const words = text.split(' '); let line = ''; let row = 0;
    for (const word of words) { const next = `${line}${word} `; if (ctx.measureText(next).width > maxWidth && line) { ctx.fillText(line.trim(), x, y + row * lineHeight); row += 1; line = `${word} `; } else line = next; }
    if (line) ctx.fillText(line.trim(), x, y + row * lineHeight);
  }
  private roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  private toBlob(): Promise<Blob> { return new Promise((resolve, reject) => this.canvasRef.nativeElement.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create the image.')), 'image/png')); }
  async copyCaption(): Promise<void> { await navigator.clipboard.writeText(this.moment().caption); this.snack.open('Suggested caption copied.', 'OK', { duration: 2200 }); }
  async download(): Promise<void> { const blob = await this.toBlob(); const url = URL.createObjectURL(blob); const link = this.document.createElement('a'); link.href = url; link.download = `vocora-${this.kind()}-${new Date().toISOString().slice(0,10)}.png`; link.click(); URL.revokeObjectURL(url); }
  async share(): Promise<void> { const blob = await this.toBlob(); const file = new File([blob], `vocora-${this.kind()}.png`, { type: 'image/png' }); const payload = { files: [file], text: this.moment().caption, title: 'Vocora' }; if (navigator.share && (!navigator.canShare || navigator.canShare(payload))) { await navigator.share(payload); return; } await this.download(); this.snack.open('Share API is unavailable; the image was downloaded.', 'OK', { duration: 2600 }); }
}
