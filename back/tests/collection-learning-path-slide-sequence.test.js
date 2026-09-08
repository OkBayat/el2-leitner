import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GetSlideSequenceExerciseContext } from "../src/application/collection-learning-path/queries/GetSlideSequenceExerciseContext.js";
import { VerifySlideSequenceCompletion } from "../src/application/collection-learning-path/queries/VerifySlideSequenceCompletion.js";
import {
  createSlideSequenceVocabularyPayload,
  verifySlideSequenceCompletion,
} from "../src/domain/collection-learning-path/SlideSequenceExercise.js";

const NOW = "2026-09-08T12:00:00.000Z";

function exercise(overrides = {}) {
  return {
    id: "sequence-1",
    type: "slides.sequence",
    schemaVersion: 1,
    completionPolicy: "slide-sequence",
    config: {
      retryIncorrect: true,
      slides: [
        { id: "intro", type: "teaching-card", data: {} },
        {
          id: "choice",
          type: "choice",
          data: {
            question: "Choose the answer.",
            options: [{ id: "wrong", label: "Wrong" }, { id: "correct", label: "Correct" }],
            correctOptionIds: ["correct"],
          },
        },
        { id: "speaking", type: "speaking-response", data: {} },
        { id: "summary", type: "summary", terminal: true, data: {} },
      ],
    },
    ...overrides,
  };
}

function outcome(results) {
  return { kind: "completed", evidence: { schemaVersion: 1, results } };
}

function vocabularyScopeData(generatedSlide) {
  return {
    intro: {
      eyebrow: "Complete lesson vocabulary",
      title: "{{total}} lesson targets",
      description: "Every source item will be tested.",
    },
    generatedSlide,
  };
}

function vocabularyScopeChrome(label = "Start lesson vocabulary") {
  return {
    header: { visible: false },
    footer: {
      primary: {
        id: "start-vocabulary-scope",
        label,
        behavior: "content",
        disabled: false,
      },
      secondary: false,
    },
  };
}

function verify(definition, result, vocabulary = []) {
  return verifySlideSequenceCompletion(definition, result, vocabulary, {
    userId: "user-1",
    exerciseId: definition.id,
    exerciseStartedAt: NOW,
    recordingArtifacts: new Map([["recording-1", {
      publicId: "recording-1",
      userId: "user-1",
      exerciseId: definition.id,
      exerciseStartedAt: NOW,
      slideId: "speaking",
      byteSize: 512,
    }]]),
  });
}

describe("slide-sequence completion evidence", () => {
  it("rejects a bare completion and requires correct scored results plus submitted production", () => {
    const definition = exercise();

    assert.equal(verify(definition, { kind: "completed" }), false);
    assert.equal(verify(definition, outcome([
      { rootSlideId: "choice", slideType: "choice", eventType: "answered", data: { selectedOptionIds: ["wrong"] } },
      {
        rootSlideId: "speaking",
        slideType: "speaking-response",
        eventType: "submitted",
        data: { recordingArtifactId: "recording-1" },
      },
    ])), false);
    assert.deepEqual(verify(definition, outcome([
      { rootSlideId: "choice", slideType: "choice", eventType: "answered", data: { selectedOptionIds: ["wrong"] } },
      { rootSlideId: "choice", slideType: "choice", eventType: "answered", data: { selectedOptionIds: ["correct"] } },
      {
        rootSlideId: "speaking",
        slideType: "speaking-response",
        eventType: "submitted",
        data: { recordingArtifactId: "recording-1" },
      },
    ])), {
      evidenceType: "slide-sequence",
      evidenceRef: "exercise:sequence-1:slides:2",
    });
  });

  it("regrades learner answers instead of trusting client correctness claims", () => {
    const definition = exercise();

    assert.equal(verify(definition, outcome([
      {
        rootSlideId: "choice",
        slideType: "choice",
        eventType: "answered",
        data: { selectedOptionIds: ["wrong"], correct: true, correctOptionIds: ["wrong"] },
      },
      {
        rootSlideId: "speaking",
        slideType: "speaking-response",
        eventType: "submitted",
        data: { recordingArtifactId: "recording-1" },
      },
    ])), false);
  });

  it("grades every supported scored and production response from server-owned slide data", () => {
    const slides = [
      { id: "choice", type: "choice", data: { correctOptionIds: ["b"] } },
      { id: "truth", type: "truth", data: { correctOptionId: "true" } },
      { id: "matching", type: "matching", data: { pairs: [{ id: "p1" }, { id: "p2" }] } },
      {
        id: "classification",
        type: "classification",
        data: { items: [{ id: "i1", correctCategoryId: "c1" }, { id: "i2", correctCategoryId: "c2" }] },
      },
      { id: "cloze", type: "cloze", data: { blanks: [{ id: "blank", answers: ["bond"] }] } },
      {
        id: "structured",
        type: "structured-completion",
        data: { fields: [{ id: "field", answers: ["adulthood"], wordLimit: 1 }] },
      },
      {
        id: "formation",
        type: "word-formation",
        data: { fields: [{ id: "field", answers: ["interaction"], exactSpelling: true }] },
      },
      { id: "short", type: "short-answer", data: { answers: ["sibling"] } },
      { id: "dictation", type: "dictation", data: { answer: "maternal", caseSensitive: false } },
      { id: "correction", type: "error-correction", data: { answers: ["I resemble my father."] } },
      { id: "rewrite", type: "rewrite", data: { requiredFragments: ["have", "in common"] } },
      { id: "ordering", type: "ordering", data: { correctOrderIds: ["first", "second"] } },
      { id: "writing", type: "writing-response", data: {} },
      { id: "speaking", type: "speaking-response", data: {} },
      { id: "summary", type: "summary", terminal: true, data: {} },
    ];
    const definition = exercise({ config: { slides } });
    const results = [
      ["choice", "choice", "answered", { selectedOptionIds: ["b"] }],
      ["truth", "truth", "answered", { selectedOptionIds: ["true"] }],
      ["matching", "matching", "answered", { assignments: { p1: "p1", p2: "p2" } }],
      ["classification", "classification", "answered", { assignments: { i1: "c1", i2: "c2" } }],
      ["cloze", "cloze", "answered", { answers: { blank: "Bond." } }],
      ["structured", "structured-completion", "answered", { answers: { field: "adulthood" } }],
      ["formation", "word-formation", "answered", { answers: { field: "interaction" } }],
      ["short", "short-answer", "answered", { answer: "Sibling" }],
      ["dictation", "dictation", "answered", { answer: "Maternal" }],
      ["correction", "error-correction", "answered", { correction: "I resemble my father" }],
      ["rewrite", "rewrite", "answered", { response: "We have several traits in common." }],
      ["ordering", "ordering", "answered", { orderedItemIds: ["first", "second"] }],
      ["writing", "writing-response", "submitted", { response: "My family shaped my upbringing." }],
      ["speaking", "speaking-response", "submitted", { recordingArtifactId: "recording-1" }],
    ].map(([rootSlideId, slideType, eventType, data]) => ({ rootSlideId, slideType, eventType, data }));

    assert.deepEqual(verify(definition, outcome(results)), {
      evidenceType: "slide-sequence",
      evidenceRef: "exercise:sequence-1:slides:14",
    });
  });

  it("requires one correct generated result for every vocabulary item in the source scope", () => {
    const definition = exercise({
      config: {
        retryIncorrect: true,
        scope: { kind: "collection-section", ref: "unit-1" },
        slides: [
          {
            id: "scope",
            type: "lesson-vocabulary-scope",
            chrome: vocabularyScopeChrome(),
            data: vocabularyScopeData({
              type: "dictation",
              instruction: "Listen and type every target exactly.",
              mode: "word",
              speech: { autoplay: true, replay: true },
              caseSensitive: false,
              punctuationSensitive: false,
            }),
          },
          { id: "summary", type: "summary", terminal: true, data: {} },
        ],
      },
    });
    const vocabulary = [
      { vocabularyId: "word-1", term: "childhood", definitions: ["the period when a person is a child"] },
      { vocabularyId: "word-2", term: "adulthood", definitions: ["the period when a person is fully grown"] },
    ];

    assert.equal(verify(definition, outcome([
      {
        rootSlideId: "scope-word-1",
        slideType: "dictation",
        itemId: "word-1",
        eventType: "answered",
        data: { answer: "childhood" },
      },
    ]), vocabulary), false);
    assert.deepEqual(verify(definition, outcome([
      {
        rootSlideId: "scope-word-1",
        slideType: "dictation",
        itemId: "word-1",
        eventType: "answered",
        data: { answer: "childhood" },
      },
      {
        rootSlideId: "scope-word-2",
        slideType: "dictation",
        itemId: "word-2",
        eventType: "answered",
        data: { answer: "adulthood" },
      },
    ]), vocabulary), {
      evidenceType: "slide-sequence",
      evidenceRef: "exercise:sequence-1:slides:2",
    });
  });

  it("uses JSON-owned dictation normalization when grading generated vocabulary slides", () => {
    const definition = exercise({
      config: {
        scope: { kind: "collection-section", ref: "lesson-7" },
        slides: [
          {
            id: "scope",
            type: "lesson-vocabulary-scope",
            chrome: vocabularyScopeChrome("Start exact-form practice"),
            data: vocabularyScopeData({
              type: "dictation",
              instruction: "Type the target exactly.",
              mode: "phrase",
              speech: { autoplay: false, replay: true },
              caseSensitive: true,
              punctuationSensitive: true,
            }),
          },
          { id: "summary", type: "summary", terminal: true, data: {} },
        ],
      },
    });
    const vocabulary = [
      { vocabularyId: "word-1", term: "Travel light.", definitions: ["take little luggage"] },
    ];

    assert.equal(verify(definition, outcome([{
      rootSlideId: "scope-word-1",
      slideType: "dictation",
      itemId: "word-1",
      eventType: "answered",
      data: { answer: "travel light" },
    }]), vocabulary), false);
    assert.deepEqual(verify(definition, outcome([{
      rootSlideId: "scope-word-1",
      slideType: "dictation",
      itemId: "word-1",
      eventType: "answered",
      data: { answer: "Travel light." },
    }]), vocabulary), {
      evidenceType: "slide-sequence",
      evidenceRef: "exercise:sequence-1:slides:1",
    });
  });

  it("rejects vocabulary generators whose learner-facing configuration is missing", () => {
    const definition = exercise({
      config: {
        scope: { kind: "collection-section", ref: "lesson-7" },
        slides: [
          { id: "scope", type: "lesson-vocabulary-scope", data: { generatedSlide: { type: "dictation" } } },
          { id: "summary", type: "summary", terminal: true, data: {} },
        ],
      },
    });

    assert.throws(
      () => verify(definition, outcome([])),
      /intro eyebrow is required/,
    );
  });

  it("hydrates scoped vocabulary and verifies against a fresh server-side scope read", async () => {
    const vocabulary = [
      { vocabularyId: "word-1", term: "childhood", definitions: ["the period when a person is a child"] },
    ];
    const scopedExercise = exercise({
      config: {
        scope: { kind: "collection-section", ref: "unit-1" },
        slides: [
          {
            id: "scope",
            type: "lesson-vocabulary-scope",
            chrome: vocabularyScopeChrome("Start meaning review"),
            data: vocabularyScopeData({
              type: "meaning-choice",
              instruction: "Choose the target that matches the definition.",
              mode: "meaning",
              optionCount: 4,
              explanationTemplate: "{{term}}: {{definition}}",
            }),
          },
          { id: "summary", type: "summary", terminal: true, data: {} },
        ],
      },
    });
    const vocabularyReader = { findForScope: async () => ({ items: vocabulary }) };
    const context = new GetSlideSequenceExerciseContext({ vocabularyReader });
    const verifier = new VerifySlideSequenceCompletion({ vocabularyReader });

    assert.deepEqual(await context.execute({ userId: "user-1", exercise: scopedExercise }),
      createSlideSequenceVocabularyPayload(scopedExercise.config.scope, vocabulary));
    assert.deepEqual(await verifier.execute({
      userId: "user-1",
      exercise: scopedExercise,
      outcome: outcome([
        {
          rootSlideId: "scope-word-1",
          slideType: "choice",
          itemId: "word-1",
          eventType: "answered",
          data: { selectedOptionIds: ["word-1"] },
        },
      ]),
    }), {
      evidenceType: "slide-sequence",
      evidenceRef: "exercise:sequence-1:slides:1",
    });
  });
});
