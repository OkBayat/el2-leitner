import { isDevMode } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { legacyLearningPathExerciseRouteGuard } from './core/collection-learning-path/legacy-learning-path-route.guard';

export const appRoutes: Routes = [
  { path: 'slide-showcase', canMatch: [() => isDevMode()], loadComponent: () => import('./features/slide-showcase/slide-showcase-page.component').then((m) => m.SlideShowcasePageComponent) },
  { path: 'login', loadComponent: () => import('./features/auth/login-page.component').then((m) => m.LoginPageComponent) },
  { path: 'register', loadComponent: () => import('./features/auth/register-page.component').then((m) => m.RegisterPageComponent) },
  { path: 'welcome', canActivate: [authGuard], loadComponent: () => import('./features/welcome/welcome-page.component').then((m) => m.WelcomePageComponent) },
  { path: 'offline', loadComponent: () => import('./features/offline/offline-page.component').then((m) => m.OfflinePageComponent) },
  { path: 'review', canActivate: [authGuard], loadComponent: () => import('./features/review/review-page.component').then((m) => m.ReviewPageComponent) },
  { path: 'sentence', canActivate: [authGuard], loadComponent: () => import('./features/sentence-practice/sentence-practice-page.component').then((m) => m.SentencePracticePageComponent) },
  { path: 'shadowing', canActivate: [authGuard], loadComponent: () => import('./features/shadowing-practice/shadowing-page.component').then((m) => m.ShadowingPageComponent) },
  { path: 'bbc-6-minute-english/:lessonSlug/tests/:testId/practice', canActivate: [authGuard], loadComponent: () => import('./features/bbc-listening/bbc-listening-practice-page.component').then((m) => m.BbcListeningPracticePageComponent) },
  { path: 'learning-paths/:pathId/lessons/:lessonId/exercises/:exerciseId', canActivate: [authGuard], loadComponent: () => import('./features/collection-learning-path/exercise-runner/exercise-runner-page.component').then((m) => m.ExerciseRunnerPageComponent) },
  { path: 'learning-path/:pathId/lessons/:lessonId/exercises/:exerciseId', canActivate: [authGuard, legacyLearningPathExerciseRouteGuard], loadComponent: () => import('./features/collection-learning-path/exercise-runner/exercise-runner-page.component').then((m) => m.ExerciseRunnerPageComponent) },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shared/app-shell/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      { path: 'dashboard', loadComponent: () => import('./features/home/home-page.component').then((m) => m.HomePageComponent) },
      { path: 'overview', loadComponent: () => import('./features/dashboard/dashboard-page.component').then((m) => m.DashboardPageComponent) },
      { path: 'words', loadComponent: () => import('./features/words/words-page.component').then((m) => m.WordsPageComponent) },
      { path: 'reports', loadComponent: () => import('./features/reports/reports-page.component').then((m) => m.ReportsPageComponent) },
      { path: 'settings', loadComponent: () => import('./features/settings/settings-page.component').then((m) => m.SettingsPageComponent) },
      { path: 'learning-paths/:pathId', loadComponent: () => import('./features/collection-learning-path/path-page/learning-path-page.component').then((m) => m.LearningPathPageComponent) },
      { path: 'library/:collectionId/learning-path', loadComponent: () => import('./features/collection-learning-path/path-page/learning-path-page.component').then((m) => m.LearningPathPageComponent) },
      { path: 'library/:id', loadComponent: () => import('./features/library/library-detail-page.component').then((m) => m.LibraryDetailPageComponent) },
      { path: 'library', loadComponent: () => import('./features/library/library-page.component').then((m) => m.LibraryPageComponent) },
      { path: 'bbc-6-minute-english/:lessonSlug/vocabulary', loadComponent: () => import('./features/bbc-listening/bbc-episode-vocabulary-page.component').then((m) => m.BbcEpisodeVocabularyPageComponent) },
      { path: 'bbc-6-minute-english', loadComponent: () => import('./features/bbc-listening/bbc-lessons-page.component').then((m) => m.BbcLessonsPageComponent) },
      { path: 'leitner-house/:house', loadComponent: () => import('./features/leitner-house/leitner-house-page.component').then((m) => m.LeitnerHousePageComponent) },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
