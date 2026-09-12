import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { VocabularyIntakeFacade } from '../../../../application/collection-learning-path/vocabulary-intake.facade';
import type { ExerciseContextView } from '../../../../domain/collection-learning-path/learning-path';
import { ExerciseHostComponent } from './exercise-host.component';

function context(type = 'vocabulary.intake'): ExerciseContextView {
  return {
    path: { id: 'path-1', collectionId: 'collection-1', title: 'Course', mode: 'finite', contentVersion: '1' },
    lesson: { id: 'lesson-1', title: 'Lesson 1', position: 1 },
    exercise: {
      id: 'exercise-1', position: 1, type, schemaVersion: 1, required: true,
      completionPolicy: type === 'vocabulary.intake' ? 'vocabulary-intake' : 'explicit',
      config: type === 'vocabulary.intake' ? { scope: { kind: 'listening-episode', ref: 'episode-1' } } : {},
    },
    progress: null,
    state: 'in_progress',
    payload: type === 'vocabulary.intake' ? {
      scope: { kind: 'listening-episode', ref: 'episode-1' },
      items: [{ id: 'v-1', term: 'word', definitions: [], examples: [], progress: { state: 'new', box: 0 } }],
      summary: { total: 1, newCount: 1, learningCount: 0, masteredCount: 0, excludedCount: 0 },
    } : null,
  };
}

describe('ExerciseHostComponent', () => {
  it('creates the registered vocabulary intake renderer from the generic host', async () => {
    TestBed.configureTestingModule({
      imports: [ExerciseHostComponent],
      providers: [{ provide: VocabularyIntakeFacade, useValue: { activate: vi.fn() } }],
    });
    const fixture = TestBed.createComponent(ExerciseHostComponent);
    fixture.componentRef.setInput('context', context());
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="vocabulary-intake"]')).not.toBeNull();
  });

  it('renders the explicit unsupported state for unknown exercise types', async () => {
    TestBed.configureTestingModule({
      imports: [ExerciseHostComponent],
      providers: [{ provide: VocabularyIntakeFacade, useValue: { activate: vi.fn() } }],
    });
    const fixture = TestBed.createComponent(ExerciseHostComponent);
    fixture.componentRef.setInput('context', context('future.exercise'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('future.exercise');
  });

  it('reports a button interaction as engagement', async () => {
    TestBed.configureTestingModule({
      imports: [ExerciseHostComponent],
      providers: [{ provide: VocabularyIntakeFacade, useValue: { activate: vi.fn() } }],
    });
    const fixture = TestBed.createComponent(ExerciseHostComponent);
    fixture.componentRef.setInput('context', context());
    const engaged = vi.fn();
    fixture.componentInstance.engaged.subscribe(engaged);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.intake__primary')?.click();

    expect(engaged).toHaveBeenCalledTimes(1);
  });

  it.each([
    'slide-exercise-header__close',
    'slide-exercise__guide-action',
    'slide-exercise-action--guide-return',
  ])('does not report %s wrapper interactions as engagement', (excludedClass) => {
    const fixture = TestBed.createComponent(ExerciseHostComponent);
    const engaged = vi.fn();
    fixture.componentInstance.engaged.subscribe(engaged);
    const wrapper = document.createElement('voco-icon-button');
    wrapper.className = excludedClass;
    const button = document.createElement('button');
    wrapper.append(button);

    fixture.componentInstance.onClick({ target: button } as unknown as MouseEvent);

    expect(engaged).not.toHaveBeenCalled();
  });
});
