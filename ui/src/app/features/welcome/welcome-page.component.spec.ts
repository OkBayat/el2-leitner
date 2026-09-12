import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { appRoutes } from '../../app.routes';
import { authGuard } from '../../core/auth/auth.guard';
import { WelcomePageComponent } from './welcome-page.component';

describe('WelcomePageComponent', () => {
  async function render() {
    const router = { navigateByUrl: vi.fn().mockResolvedValue(true) };
    await TestBed.configureTestingModule({
      imports: [WelcomePageComponent],
      providers: [{ provide: Router, useValue: router }],
    }).compileComponents();
    const fixture = TestBed.createComponent(WelcomePageComponent);
    fixture.detectChanges();
    return { fixture, router };
  }

  it('introduces Vocora as a five-step, non-learning-path tour', async () => {
    const { fixture } = await render();
    const host: HTMLElement = fixture.nativeElement;
    const heading = host.querySelector<HTMLHeadingElement>('h1');

    expect(host.querySelector('[data-testid="welcome-slide"]')?.textContent).toContain('Welcome to Vocora');
    expect(host.querySelectorAll('[data-testid="welcome-step"]')).toHaveLength(5);
    expect(host.querySelector('[data-testid="welcome-step"] .mat-mdc-icon-button')).not.toBeNull();
    expect(host.querySelector('[aria-current="step"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="welcome-back"]')).toBeNull();
    expect(document.activeElement).toBe(heading);

    const illustrationSources: string[] = [];
    for (let index = 0; index < fixture.componentInstance.slides.length; index += 1) {
      fixture.detectChanges();
      const illustration = host.querySelector<HTMLImageElement>(
        '[data-testid="welcome-illustration"]',
      );
      illustrationSources.push(illustration?.getAttribute('src') ?? '');
      expect(illustration?.getAttribute('alt')).not.toBe('');
      fixture.componentInstance.next();
    }

    expect(illustrationSources).toEqual([
      '/assets/welcome/welcome-illustration-1.jpg',
      '/assets/welcome/welcome-illustration-2.jpg',
      '/assets/welcome/welcome-illustration-3.jpg',
      '/assets/welcome/welcome-illustration-4.jpg',
      '/assets/welcome/welcome-illustration-5.jpg',
    ]);
    expect(host.querySelector('app-welcome-illustration')).toBeNull();
  });

  it('supports forward, backward, and keyboard navigation', async () => {
    const { fixture } = await render();

    fixture.componentInstance.next();
    fixture.componentInstance.next();
    expect(fixture.componentInstance.currentIndex()).toBe(2);

    fixture.componentInstance.handleKeydown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(fixture.componentInstance.currentIndex()).toBe(1);

    fixture.componentInstance.previous();
    expect(fixture.componentInstance.currentIndex()).toBe(0);
  });

  it('ends with the default 1,500-word IELTS Leitner setup and goes home', async () => {
    const { fixture, router } = await render();

    for (let index = 1; index < fixture.componentInstance.slides.length; index += 1) {
      fixture.componentInstance.next();
    }
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('[data-testid="welcome-slide"]')?.textContent)
      .toContain('1,500 IELTS words');
    expect(host.querySelector('[data-testid="welcome-finish"]')).not.toBeNull();

    await fixture.componentInstance.finish();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it('allows the tour to be skipped directly to home', async () => {
    const { fixture, router } = await render();

    await fixture.componentInstance.finish();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it('keeps the welcome route authenticated and outside the application shell', () => {
    const welcomeRoute = appRoutes.find((route) => route.path === 'welcome');

    expect(welcomeRoute?.canActivate).toEqual([authGuard]);
    expect(appRoutes.find((route) => route.path === '')?.children?.some((route) => route.path === 'welcome'))
      .toBe(false);
  });
});
