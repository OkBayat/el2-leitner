import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AuthService } from '../../core/auth/auth.service';
import { LearningStoreService } from '../../core/state/learning-store.service';
import { ThemeService } from '../../core/theme/theme.service';
import { calculateStreak, totalStats } from '../../domain/learning/learning-rules';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatButtonModule, MatListModule, MatProgressBarModule, MatSidenavModule, MatToolbarModule],
  template: `
    <mat-sidenav-container class="shell">
      <mat-sidenav mode="side" opened class="sidebar">
        <a class="brand" routerLink="/dashboard" aria-label="Vocora"><img src="/assets/vocora-logo.png" alt="Vocora" width="185" height="46"></a>
        <mat-nav-list>
          @for (item of navItems; track item.path) {
            <a mat-list-item [routerLink]="item.path" routerLinkActive="active-link"><span class="nav-symbol">{{ item.symbol }}</span>{{ item.label }}</a>
          }
        </mat-nav-list>
        <div class="sidebar-progress">
          <div><span>تسلط کل</span><strong>{{ masteryPercent() }}٪</strong></div>
          <mat-progress-bar mode="determinate" [value]="masteryPercent()" />
          <small>{{ masteredCount() }} از {{ totalWords() }} واژه</small>
        </div>
      </mat-sidenav>
      <mat-sidenav-content>
        <mat-toolbar class="topbar">
          <div class="topbar-title"><strong>Vocora</strong><small>{{ streak() }} روز پیوسته</small></div>
          <span class="spacer"></span>
          <span class="user-email" dir="ltr">{{ auth.user()?.email }}</span>
          <button matIconButton type="button" aria-label="تغییر پوسته" (click)="cycleTheme()">◐</button>
          <button matIconButton type="button" aria-label="خروج" (click)="logout()">↪</button>
        </mat-toolbar>
        <main class="content"><router-outlet /></main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    :host{display:block;min-height:100dvh}.shell{min-height:100dvh}.sidebar{width:250px;padding:20px 14px;background:var(--mat-sys-surface-container-low)}
    .brand{display:flex;padding:8px 12px 24px}.brand img{max-width:100%;height:auto}.active-link{background:var(--mat-sys-secondary-container);color:var(--mat-sys-on-secondary-container)}
    .nav-symbol{display:inline-block;width:28px}.sidebar-progress{position:absolute;inset-inline:18px;bottom:24px;display:grid;gap:8px}.sidebar-progress>div{display:flex;justify-content:space-between}.sidebar-progress small{color:var(--mat-sys-on-surface-variant)}
    .topbar{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--mat-sys-surface) 92%,transparent);backdrop-filter:blur(16px);border-bottom:1px solid var(--mat-sys-outline-variant)}
    .topbar-title{display:grid;line-height:1.2}.topbar-title small,.user-email{font-size:12px;color:var(--mat-sys-on-surface-variant)}.spacer{flex:1}.content{padding:24px;max-width:1440px;margin:auto}
    @media(max-width:820px){.sidebar{width:210px}.content{padding:16px}.user-email{display:none}} @media(max-width:640px){.sidebar{display:none}}
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly store = inject(LearningStoreService);
  private readonly theme = inject(ThemeService);
  readonly navItems = [
    { path: '/dashboard', label: 'خانه', symbol: '⌂' }, { path: '/review', label: 'مرور امروز', symbol: '◎' },
    { path: '/words', label: 'واژه‌ها', symbol: '≡' }, { path: '/library', label: 'کتابخانه', symbol: '▦' },
    { path: '/reports', label: 'گزارش رشد', symbol: '↗' }, { path: '/settings', label: 'تنظیمات', symbol: '⚙' },
  ];
  readonly totalWords = computed(() => this.store.state()?.words.length || 0);
  readonly masteredCount = computed(() => this.store.state() ? totalStats(this.store.state()!).mastered : 0);
  readonly masteryPercent = computed(() => this.totalWords() ? Math.round((this.masteredCount() / this.totalWords()) * 100) : 0);
  readonly streak = computed(() => this.store.state() ? calculateStreak(this.store.state()!) : 0);

  async ngOnInit(): Promise<void> { const state = await this.store.initialize(); this.theme.apply(state.settings.theme); }
  async logout(): Promise<void> { await this.auth.logout(); }
  async cycleTheme(): Promise<void> {
    const order = { system: 'light', light: 'dark', dark: 'system' } as const;
    const state = await this.store.update((draft) => { draft.settings.theme = order[draft.settings.theme]; });
    this.theme.apply(state.settings.theme);
  }
}
