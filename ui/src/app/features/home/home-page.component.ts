import { A11yModule } from '@angular/cdk/a11y';
import { CdkOverlayOrigin, Overlay, OverlayModule, type ConnectedPosition, type ConnectedOverlayPositionChange } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, ElementRef, HostListener, Injector, type OnDestroy, type OnInit, ViewChild, afterNextRender, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HomeTimelineService } from '../../application/home/home-timeline.service';
import { type PathDay, type PathStep, buildDailyPath } from '../../domain/home/daily-path';
import { localDay } from '../../domain/learning/learning-rules';
import { BookWagonComponent, PathIconComponent } from './home-artwork.component';

interface PathSelection { day: PathDay; step: PathStep | null; origin: CdkOverlayOrigin; }

@Component({
  selector: 'app-home-page',
  imports: [RouterLink, OverlayModule, A11yModule, PathIconComponent, BookWagonComponent],
  providers: [HomeTimelineService],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePageComponent implements OnInit, OnDestroy {
  readonly timeline = inject(HomeTimelineService);
  private readonly injector = inject(Injector);
  readonly scrollStrategy = inject(Overlay).scrollStrategies.close();
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly days = computed(() => buildDailyPath(this.timeline.days(), this.timeline.today()));
  readonly selection = signal<PathSelection | null>(null);
  readonly todayVisible = signal(true);
  readonly popoverAbove = signal(false);
  readonly arrowX = signal<number | null>(null);
  readonly positions: ConnectedPosition[] = [
    { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 16 },
    { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -16 },
  ];
  @ViewChild('popup') private popup?: ElementRef<HTMLElement>;
  private historyObserver?: IntersectionObserver;
  private todayObserver?: IntersectionObserver;
  private rolloverTimer?: ReturnType<typeof setTimeout>;
  private destroyed = false;
  private observersReady = false;

  async ngOnInit(): Promise<void> { await this.refresh(true); }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.historyObserver?.disconnect(); this.todayObserver?.disconnect();
    clearTimeout(this.rolloverTimer);
  }

  async refresh(jump = false): Promise<void> {
    const previousDay = this.timeline.today();
    const loaded = await this.timeline.refresh();
    if (this.destroyed) return;
    if (loaded) {
      afterNextRender({ write: () => {
        if (jump || previousDay !== this.timeline.today()) this.goToToday(false);
        this.observeHistory();
        this.observeToday();
      } }, { injector: this.injector });
    }
    this.scheduleRollover();
  }

  async loadOlder(): Promise<void> {
    const anchor = this.host.nativeElement.querySelector<HTMLElement>('.path-day');
    const anchorTop = anchor ? anchor.getBoundingClientRect().top + window.scrollY : 0;
    if (!await this.timeline.loadOlder() || this.destroyed || !anchor) return;
    afterNextRender({
      earlyRead: () => anchor.getBoundingClientRect().top + window.scrollY - anchorTop,
      write: delta => window.scrollBy({ top: delta, behavior: 'instant' }),
    }, { injector: this.injector });
  }

  goToToday(smooth = true): void {
    const section = this.host.nativeElement.querySelector<HTMLElement>(`[data-day="${this.timeline.today()}"]`);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    section?.scrollIntoView({ block: 'start', behavior: smooth && !reduced ? 'smooth' : 'instant' });
  }

  open(day: PathDay, step: PathStep | null, origin: CdkOverlayOrigin): void {
    if (day.future || step?.id.startsWith('reserved')) return;
    const previous = this.selection();
    if (previous?.origin === origin) { this.close(); return; }
    this.arrowX.set(null); this.popoverAbove.set(false);
    this.selection.set({ day, step, origin });
  }

  close(): void { this.selection.set(null); }
  onOverlayKey(event: KeyboardEvent): void { if (event.key === 'Escape') { event.preventDefault(); this.close(); } }

  positionPopover(event: ConnectedOverlayPositionChange): void {
    this.popoverAbove.set(event.connectionPair.overlayY === 'bottom');
    afterNextRender({ read: () => {
      const selected = this.selection();
      const panel = this.popup?.nativeElement;
      if (!selected || !panel) return;
      const origin = selected.origin.elementRef.nativeElement.getBoundingClientRect();
      const rect = panel.getBoundingClientRect();
      this.arrowX.set(Math.max(24, Math.min(rect.width - 24, origin.left + origin.width / 2 - rect.left)));
    } }, { injector: this.injector });
  }

  statusLabel(step: PathStep): string {
    return { practiced: 'Practised', available: 'Not practised', upcoming: 'Upcoming', planned: 'Coming soon' }[step.status];
  }

  @HostListener('window:focus')
  @HostListener('window:online')
  onReturn(): void { if (!document.hidden && !this.destroyed) void this.refresh(); }

  @HostListener('document:visibilitychange')
  onVisibility(): void { if (!document.hidden) this.onReturn(); }

  private observeHistory(): void {
    if (this.observersReady || typeof IntersectionObserver === 'undefined') return;
    const sentinel = this.host.nativeElement.querySelector('.history-sentinel');
    if (!sentinel) return;
    this.observersReady = true;
    this.historyObserver = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting) && this.timeline.nextBefore() && !this.timeline.historyError()) void this.loadOlder();
    }, { rootMargin: '180px 0px 0px' });
    this.historyObserver.observe(sentinel);
  }

  private observeToday(): void {
    this.todayObserver?.disconnect();
    if (typeof IntersectionObserver === 'undefined') return;
    const section = this.host.nativeElement.querySelector(`[data-day="${this.timeline.today()}"]`);
    if (!section) return;
    this.todayObserver = new IntersectionObserver(entries => this.todayVisible.set(entries.some(entry => entry.isIntersecting)));
    this.todayObserver.observe(section);
  }

  private scheduleRollover(): void {
    clearTimeout(this.rolloverTimer);
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const delay = this.timeline.today() && this.timeline.today() !== localDay(now)
      ? 30_000 : midnight.valueOf() - now.valueOf() + 250;
    this.rolloverTimer = setTimeout(() => { if (!this.destroyed) void this.refresh(true); }, delay);
  }
}
