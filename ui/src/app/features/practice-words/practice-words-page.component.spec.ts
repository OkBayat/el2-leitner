import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { CollectionLearningPathApiService } from '../../core/collection-learning-path/collection-learning-path-api.service';
import { PracticeWordsPageComponent } from './practice-words-page.component';

@Component({ template: '' })
class EmptyPage {}

describe('PracticeWordsPageComponent', () => {
  it('runs a two-slide mode picker and finishes back on the dashboard', async () => {
    await TestBed.configureTestingModule({
      imports: [PracticeWordsPageComponent],
      providers: [
        provideRouter([{ path: 'dashboard', component: EmptyPage }]),
        { provide: CollectionLearningPathApiService, useValue: {} },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(PracticeWordsPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;

    expect(fixture.componentInstance.exerciseContext.config['slides']).toHaveLength(2);
    expect(host.querySelector('[data-testid="slides-sequence-exercise"]')).not.toBeNull();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelectorAll('[data-testid="practice-mode-option"]')).toHaveLength(3);
    });
    const modes = host.querySelectorAll<HTMLButtonElement>('[data-testid="practice-mode-option"]');

    modes[0].click();
    fixture.detectChanges();
    const continueButton = [...host.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.trim() === 'Continue');
    continueButton?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(host.querySelector('[data-testid="summary-slide-content"]')?.textContent?.trim()).toBe('');
    const finishButton = [...host.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.trim() === 'Finish');
    expect(finishButton).toBeDefined();
    finishButton?.click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/dashboard');
  });
});
