import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, expect, it, vi } from 'vitest';
import { SlideExerciseComponent } from '../../../../shared/slide-exercise';
import type { ExerciseContext } from '../exercise-runtime/exercise-contracts';
import { SlidesSequenceExerciseComponent } from './slides-sequence-exercise.component';

const context: ExerciseContext = {
  pathId: 'path-1',
  lessonId: 'lesson-1',
  exerciseId: 'exercise-1',
  type: 'slides.sequence',
  schemaVersion: 1,
  completionPolicy: 'explicit',
  config: {
    slides: [
      {
        id: 'intro',
        type: 'message',
        data: { title: 'Ready?', body: 'Work through the slides.' },
      },
      {
        id: 'summary',
        type: 'summary',
        terminal: true,
        data: { title: 'Done' },
      },
    ],
  },
  payload: null,
};

describe('SlidesSequenceExerciseComponent', () => {
  it('renders configured slides and completes only from the terminal slide', () => {
    TestBed.configureTestingModule({ imports: [SlidesSequenceExerciseComponent] });
    const fixture = TestBed.createComponent(SlidesSequenceExerciseComponent);
    const outcomes = vi.fn();
    fixture.componentInstance.outcome.subscribe(outcomes);

    fixture.componentInstance.load(context);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="slides-sequence-exercise"]')).not.toBeNull();
    expect(fixture.componentInstance.slides().map((slide) => slide.id)).toEqual(['intro', 'summary']);

    fixture.componentInstance.finish();
    expect(outcomes).not.toHaveBeenCalled();

    const slideExercise = fixture.debugElement.query(
      By.directive(SlideExerciseComponent),
    ).componentInstance as SlideExerciseComponent;
    slideExercise.next();
    expect(outcomes).not.toHaveBeenCalled();
    slideExercise.next();
    fixture.componentInstance.finish('summary');
    expect(outcomes).toHaveBeenCalledOnce();
    expect(outcomes).toHaveBeenCalledWith({ kind: 'completed' });
  });

  it('fails closed when the deck is invalid', () => {
    TestBed.configureTestingModule({ imports: [SlidesSequenceExerciseComponent] });
    const fixture = TestBed.createComponent(SlidesSequenceExerciseComponent);
    fixture.componentInstance.load({ ...context, config: { slides: [] } });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Exercise unavailable');
    expect(fixture.componentInstance.slides()).toEqual([]);
  });
});
