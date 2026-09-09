import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { App } from './app';
import { appRoutes } from './app.routes';

describe('App', () => {
  it('creates the Angular router root without legacy DOM bootstrap', async () => {
    await TestBed.configureTestingModule({ imports: [App], providers: [provideRouter([])] }).compileComponents();
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
  });

  it('keeps canonical and legacy learning path exercises outside the shared app shell', () => {
    const appShellRoute = appRoutes.find((route) => route.path === '');
    const childPaths = appShellRoute?.children?.map((route) => route.path) ?? [];
    const rootPaths = appRoutes.map((route) => route.path);

    expect(rootPaths).toContain('learning-paths/:pathId/lessons/:lessonId/exercises/:exerciseId');
    expect(rootPaths).toContain('learning-path/:pathId/lessons/:lessonId/exercises/:exerciseId');
    expect(childPaths).not.toContain('learning-paths/:pathId/lessons/:lessonId/exercises/:exerciseId');
    expect(childPaths).not.toContain('learning-path/:pathId/lessons/:lessonId/exercises/:exerciseId');
  });
});
