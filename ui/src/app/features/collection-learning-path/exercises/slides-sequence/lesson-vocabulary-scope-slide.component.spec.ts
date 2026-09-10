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

const dictationConfig = {
  type: 'dictation' as const,
  instruction: 'Listen and type every target exactly.',
  mode: 'phrase' as const,
  speech: { autoplay: false, replay: true },
  caseSensitive: true,
  punctuationSensitive: true,
};

const meaningConfig = {
  type: 'meaning-choice' as const,
  instruction: 'Choose the target that matches the definition.',
  mode: 'meaning' as const,
  optionCount: 4,
  explanationTemplate: '{{term}} means {{definition}}',
};

describe('lesson vocabulary scope slide generation', () => {
  it('generates one exact dictation slide per scoped item', () => {
    const slides = buildLessonVocabularySlides('scope', dictationConfig, items);

    expect(slides).toHaveLength(4);
    expect(slides[0]).toMatchObject({
      id: 'scope-one',
      rootSlideId: 'scope-one',
      itemId: 'one',
      type: 'dictation',
      data: {
        mode: 'phrase',
        instruction: 'Listen and type every target exactly.',
        answer: 'childhood',
        definition: 'the period when a person is a child',
        speech: { text: 'childhood', autoplay: false, replay: true },
        caseSensitive: true,
        punctuationSensitive: true,
      },
    });
  });

  it('generates deterministic four-option meaning retrieval for every item', () => {
    const slides = buildLessonVocabularySlides('scope', meaningConfig, items);

    expect(slides).toHaveLength(4);
    expect(slides[0]).toMatchObject({
      itemId: 'one',
      type: 'choice',
      data: {
        mode: 'meaning',
        instruction: 'Choose the target that matches the definition.',
        question: 'the period when a person is a child',
        correctOptionIds: ['one'],
        explanation: 'childhood means the period when a person is a child',
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
      data: {
        intro: {
          eyebrow: 'Complete Lesson 7 vocabulary',
          title: '{{total}} travel targets',
          description: 'Every Lesson 7 expression will be tested.',
        },
        generatedSlide: dictationConfig,
      },
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
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Complete Lesson 7 vocabulary');
    expect(fixture.nativeElement.textContent).toContain('4 travel targets');
    expect(fixture.nativeElement.textContent).toContain('Every Lesson 7 expression will be tested.');
    expect(fixture.nativeElement.textContent).not.toContain('Unit 1');

    fixture.componentInstance.handleAction('start-vocabulary-scope');

    expect(deck.insertSlides).toHaveBeenCalledWith({
      anchorId: 'scope',
      gap: 0,
      slides: expect.arrayContaining([expect.objectContaining({ itemId: 'one' })]),
    });
    expect(deck.next).toHaveBeenCalledOnce();
  });

  it('automatically enters a configured vocabulary scope without an extra launch step', async () => {
    TestBed.configureTestingModule({ imports: [LessonVocabularyScopeSlideComponent] });
    const fixture = TestBed.createComponent(LessonVocabularyScopeSlideComponent);
    const deck = { insertSlides: vi.fn(), next: vi.fn(), results: vi.fn(() => []) };
    fixture.componentInstance.load({
      slideId: 'scope',
      type: 'lesson-vocabulary-scope',
      data: {
        autoStart: true,
        intro: {
          eyebrow: 'Meaning review',
          title: '{{total}} targets',
          description: 'Review every meaning.',
        },
        generatedSlide: meaningConfig,
      },
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

    await Promise.resolve();

    expect(deck.insertSlides).toHaveBeenCalledOnce();
    expect(deck.next).toHaveBeenCalledOnce();
  });
});
