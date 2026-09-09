import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { CollectionLearningPathApiService } from '../../core/collection-learning-path/collection-learning-path-api.service';
import { PracticeWordsPageComponent } from './practice-words-page.component';

@Component({ template: '' })
class EmptyPage {}

describe('PracticeWordsPageComponent', () => {
  it('configures the generic selection slide followed only by Finish', async () => {
    await TestBed.configureTestingModule({
      imports: [PracticeWordsPageComponent],
      providers: [
        provideRouter([{ path: 'dashboard', component: EmptyPage }]),
        { provide: CollectionLearningPathApiService, useValue: {} },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(PracticeWordsPageComponent);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelectorAll('[data-testid="selection-option"]')).toHaveLength(3);
    });

    const slides = fixture.componentInstance.exerciseContext.config['slides'] as Array<Record<string, unknown>>;
    expect(slides).toHaveLength(2);
    expect(slides[0]).toMatchObject({ type: 'selection', data: { mode: 'single' } });
    const modes = host.querySelectorAll<HTMLButtonElement>('[data-testid="selection-option"]');
    expect([...modes].map((option) => option.getAttribute('aria-label'))).toEqual([
      '1. Vocabulary Dictation. Hear a word or collocation and type it.',
      '2. Sentence Completion. Hear the missing word or collocation and complete the sentence.',
      '3. Sentence Shadowing. Hear a complete sentence and repeat it.',
    ]);

    modes[0].click();
    fixture.detectChanges();
    const continueButton = [...host.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.trim() === 'Continue');
    continueButton?.click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('[data-testid="summary-slide-content"]')).not.toBeNull();
    });
    expect(host.querySelector('[data-testid="summary-slide-content"]')?.textContent?.trim()).toBe('');
    const finishButton = [...host.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.trim() === 'Finish');
    expect(finishButton).toBeDefined();
    finishButton?.click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/dashboard');
  });
});
