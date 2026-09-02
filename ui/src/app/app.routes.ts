import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const appRoutes: Routes = [
  { path: 'login', loadComponent: () => import('./features/auth/login-page.component').then((m) => m.LoginPageComponent) },
  { path: 'register', loadComponent: () => import('./features/auth/register-page.component').then((m) => m.RegisterPageComponent) },
  { path: 'review', canActivate: [authGuard], loadComponent: () => import('./features/review/review-page.component').then((m) => m.ReviewPageComponent) },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shared/app-shell/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard-page.component').then((m) => m.DashboardPageComponent) },
      { path: 'words', loadComponent: () => import('./features/words/words-page.component').then((m) => m.WordsPageComponent) },
      { path: 'reports', loadComponent: () => import('./features/reports/reports-page.component').then((m) => m.ReportsPageComponent) },
      { path: 'settings', loadComponent: () => import('./features/settings/settings-page.component').then((m) => m.SettingsPageComponent) },
      { path: 'library', loadComponent: () => import('./features/library/library-page.component').then((m) => m.LibraryPageComponent) },
      { path: 'leitner-house/:house', loadComponent: () => import('./features/leitner-house/leitner-house-page.component').then((m) => m.LeitnerHousePageComponent) },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
