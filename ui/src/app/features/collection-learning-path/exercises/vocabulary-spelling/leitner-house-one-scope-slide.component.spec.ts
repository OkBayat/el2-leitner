import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SlideBaseExerciseSessionService } from '../slide-base/slide-base-exercise-session.service';
import { LeitnerHouseOneScopeSlideComponent } from './leitner-house-one-scope-slide.component';

describe('LeitnerHouseOneScopeSlideComponent', () => {
  const startVocabularySpelling = vi.fn();

  beforeEach(() => {
    startVocabularySpelling.mockReset();
    startVocabularySpelling.mockResolvedValue([
      { id: 'word-1', term: 'alpha', accepted: ['alpha'] },
      { id: 'word-2', term: 'beta', accepted: ['beta'] },
    ]);
    TestBed.configureTestingModule({
      imports: [LeitnerHouseOneScopeSlideComponent],
      providers: [{ provide: SlideBaseExerciseSessionService, useValue: { startVocabularySpelling } }],
    });
  });

  it('keeps the action disabled until selection, then inserts dictation slides and advances', async () => {
    const fixture = TestBed.createComponent(LeitnerHouseOneScopeSlideComponent);
    const component = fixture.componentInstance;
    const insertSlides = vi.fn();
    const next = vi.fn();
    const states: unknown[] = [];
    component.stateChange.subscribe((state) => states.push(state));
    component.load({
      slideId: 'scope',
      type: 'leitner-house-one-scope',
      data: { generatedSlide: { type: 'dictation' } },
      environment: {
        pathId: 'path-1', lessonId: 'lesson-1', exerciseId: 'exercise-1', type: 'slide-base',
        schemaVersion: 1, completionPolicy: 'vocabulary-spelling', config: {}, payload: null,
      },
      deck: { insertSlides, next, results: () => [] },
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('This course only');
    expect(fixture.nativeElement.textContent).toContain('All House 1 words');
    expect(fixture.nativeElement.querySelectorAll('mat-radio-button')).toHaveLength(2);
    component.select('course');
    component.handleAction('start-spelling');

    await vi.waitFor(() => expect(next).toHaveBeenCalledTimes(1));
    expect(startVocabularySpelling).toHaveBeenCalledWith(expect.objectContaining({ exerciseId: 'exercise-1' }), 'course');
    expect(insertSlides).toHaveBeenCalledWith(expect.objectContaining({
      anchorId: 'scope',
      gap: 0,
      slides: [
        expect.objectContaining({ type: 'dictation', itemId: 'word-1' }),
        expect.objectContaining({ type: 'dictation', itemId: 'word-2' }),
      ],
    }));
    expect(states).toEqual(expect.arrayContaining([
      expect.objectContaining({ chrome: { footer: expect.objectContaining({ primary: expect.objectContaining({ disabled: true }) }) } }),
      expect.objectContaining({ chrome: { footer: expect.objectContaining({ primary: expect.objectContaining({ disabled: false }) }) } }),
    ]));
  });
});
