import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import {
  buildLessonVocabularySlides,
  LessonVocabularyScopeSlideComponent,
} from './lesson-vocabulary-scope-slide.component';

const items = [
  { id: 'one', term: 'childhood', definitions: ['the period when a person is a child'] },
  { id: 'two', term: 'adulthood', definitions: ['the period when a person is fully grown'] },
  { id: 'three', term: 'bond', definitions: ['a strong emotional connection'] },
  { id: 'four', term: 'sibling', definitions: ['a brother or sister'] },
];

describe('lesson vocabulary scope slide generation', () => {
  it('generates one exact dictation slide per scoped item', () => {
    const slides = buildLessonVocabularySlides('scope', 'dictation', items);

    expect(slides).toHaveLength(4);
    expect(slides[0]).toMatchObject({
      id: 'scope-one',
      rootSlideId: 'scope-one',
      itemId: 'one',
      type: 'dictation',
      data: { answer: 'childhood', speech: { text: 'childhood' } },
    });
  });

  it('generates deterministic four-option meaning retrieval for every item', () => {
    const slides = buildLessonVocabularySlides('scope', 'meaning-choice', items);

    expect(slides).toHaveLength(4);
    expect(slides[0]).toMatchObject({
      itemId: 'one',
      type: 'choice',
      data: {
        question: 'the period when a person is a child',
        correctOptionIds: ['one'],
      },
    });
    expect(new Set((slides[0].data as { options: Array<{ id: string }> }).options.map((option) => option.id)).size).toBe(4);
  });

  it('inserts the complete hydrated scope and advances into the generated deck', () => {
    TestBed.configureTestingModule({ imports: [LessonVocabularyScopeSlideComponent] });
    const fixture = TestBed.createComponent(LessonVocabularyScopeSlideComponent);
    const deck = { insertSlides: vi.fn(), next: vi.fn(), results: vi.fn(() => []) };
    fixture.componentInstance.load({
      slideId: 'scope',
      type: 'lesson-vocabulary-scope',
      data: { generatedSlide: { type: 'dictation' } },
      environment: {
        pathId: 'path-1',
        lessonId: 'lesson-1',
        exerciseId: 'exercise-1',
        type: 'slides.sequence',
        schemaVersion: 1,
        config: {},
        payload: {
          scope: { kind: 'collection-section', ref: 'unit-1' },
          items,
          summary: { total: items.length },
        },
      },
      deck,
    });

    fixture.componentInstance.handleAction('start-vocabulary-scope');

    expect(deck.insertSlides).toHaveBeenCalledWith({
      anchorId: 'scope',
      gap: 0,
      slides: expect.arrayContaining([expect.objectContaining({ itemId: 'one' })]),
    });
    expect(deck.next).toHaveBeenCalledOnce();
  });
});
