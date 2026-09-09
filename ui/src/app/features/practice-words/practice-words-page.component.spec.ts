import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { PracticeWordsSlideBuilderService } from '../../application/practice-words/practice-words-slide-builder.service';
import { CollectionLearningPathApiService } from '../../core/collection-learning-path/collection-learning-path-api.service';
import { PracticeWordsPageComponent } from './practice-words-page.component';

@Component({ template: '' })
class EmptyPage {}

describe('PracticeWordsPageComponent', () => {
  it('expands the selected practice mode before the final Finish slide', async () => {
    const slideBuilder = {
      build: vi.fn().mockResolvedValue([
        { id: 'generated-practice', type: 'message', data: { title: 'Generated practice' } },
      ]),
    };
    await TestBed.configureTestingModule({
      imports: [PracticeWordsPageComponent],
      providers: [
        provideRouter([{ path: 'dashboard', component: EmptyPage }]),
        { provide: CollectionLearningPathApiService, useValue: {} },
        { provide: PracticeWordsSlideBuilderService, useValue: slideBuilder },
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
    expect(slides[0]).toMatchObject({
      type: 'selection',
      data: { mode: 'single', expansionId: 'house-one-practice' },
      chrome: { header: { progress: null } },
    });
    expect(host.querySelector('[role="progressbar"]')).toBeNull();
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
      expect(slideBuilder.build).toHaveBeenCalledWith('practice-mode', 'vocabulary-dictation');
      expect(host.textContent).toContain('Generated practice');
      expect(host.querySelector('.slide-exercise-header__copy strong')?.textContent?.trim()).toBe('1 of 2');
    });
    const generatedContinue = [...host.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.trim() === 'Continue');
    generatedContinue?.click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('[data-testid="summary-slide-content"]')).not.toBeNull();
    });
    const summary = host.querySelector('[data-testid="summary-slide-content"]');
    expect(summary?.textContent).toContain('Practice complete');
    expect(summary?.textContent).toContain('Every House 1 word has been practiced');
    expect(summary?.textContent).toContain('Review your first-attempt results.');
    expect(summary?.textContent).toContain('Correct');
    expect(summary?.textContent).toContain('Mistakes');
    expect(summary?.textContent).toContain('Accuracy');
    const metrics = [...(summary?.querySelectorAll('.summary-slide__metric') ?? [])]
      .map((metric) => ({
        label: metric.querySelector('dt')?.textContent?.trim(),
        value: metric.querySelector('dd')?.textContent?.trim(),
      }));
    expect(metrics).toEqual([
      { label: 'Correct', value: '0' },
      { label: 'Mistakes', value: '0' },
      { label: 'Accuracy', value: '0%' },
    ]);
    expect(slides[1]).toEqual({
      id: 'finish',
      type: 'summary',
      terminal: true,
      data: {
        aggregationMode: 'first-attempts',
        eyebrow: 'Practice complete',
        title: 'Every House 1 word has been practiced',
        subtitle: 'Review your first-attempt results.',
      },
      chrome: {
        footer: {
          primary: { id: 'finish', label: 'Finish', behavior: 'emit' },
          secondary: false,
        },
      },
    });
    const finishButton = [...host.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.trim() === 'Finish');
    expect(finishButton).toBeDefined();
    finishButton?.click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/dashboard');
  });
});
