import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GetSlideSequenceExerciseContext } from "../src/application/collection-learning-path/queries/GetSlideSequenceExerciseContext.js";
import { VerifySlideSequenceCompletion } from "../src/application/collection-learning-path/queries/VerifySlideSequenceCompletion.js";
import {
  createSlideSequenceVocabularyPayload,
  verifySlideSequenceCompletion,
} from "../src/domain/collection-learning-path/SlideSequenceExercise.js";

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
        { id: "choice", type: "choice", data: {} },
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

describe("slide-sequence completion evidence", () => {
  it("rejects a bare completion and requires correct scored results plus submitted production", () => {
    const definition = exercise();

    assert.equal(verifySlideSequenceCompletion(definition, { kind: "completed" }), false);
    assert.equal(verifySlideSequenceCompletion(definition, outcome([
      { rootSlideId: "choice", slideType: "choice", status: "incorrect" },
      { rootSlideId: "speaking", slideType: "speaking-response", status: "submitted" },
    ])), false);
    assert.deepEqual(verifySlideSequenceCompletion(definition, outcome([
      { rootSlideId: "choice", slideType: "choice", status: "incorrect" },
      { rootSlideId: "choice", slideType: "choice", status: "correct" },
      { rootSlideId: "speaking", slideType: "speaking-response", status: "submitted" },
    ])), {
      evidenceType: "slide-sequence",
      evidenceRef: "exercise:sequence-1:slides:2",
    });
  });

  it("requires one correct generated result for every vocabulary item in the source scope", () => {
    const definition = exercise({
      config: {
        retryIncorrect: true,
        scope: { kind: "collection-section", ref: "unit-1" },
        slides: [
          { id: "scope", type: "lesson-vocabulary-scope", data: { generatedSlide: { type: "dictation" } } },
          { id: "summary", type: "summary", terminal: true, data: {} },
        ],
      },
    });
    const vocabulary = [
      { vocabularyId: "word-1", term: "childhood", definitions: ["the period when a person is a child"] },
      { vocabularyId: "word-2", term: "adulthood", definitions: ["the period when a person is fully grown"] },
    ];

    assert.equal(verifySlideSequenceCompletion(definition, outcome([
      { rootSlideId: "scope-word-1", slideType: "dictation", itemId: "word-1", status: "correct" },
    ]), vocabulary), false);
    assert.deepEqual(verifySlideSequenceCompletion(definition, outcome([
      { rootSlideId: "scope-word-1", slideType: "dictation", itemId: "word-1", status: "correct" },
      { rootSlideId: "scope-word-2", slideType: "dictation", itemId: "word-2", status: "correct" },
    ]), vocabulary), {
      evidenceType: "slide-sequence",
      evidenceRef: "exercise:sequence-1:slides:2",
    });
  });

  it("hydrates scoped vocabulary and verifies against a fresh server-side scope read", async () => {
    const vocabulary = [
      { vocabularyId: "word-1", term: "childhood", definitions: ["the period when a person is a child"] },
    ];
    const scopedExercise = exercise({
      config: {
        scope: { kind: "collection-section", ref: "unit-1" },
        slides: [
          { id: "scope", type: "lesson-vocabulary-scope", data: { generatedSlide: { type: "meaning-choice" } } },
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
        { rootSlideId: "scope-word-1", slideType: "choice", itemId: "word-1", status: "correct" },
      ]),
    }), {
      evidenceType: "slide-sequence",
      evidenceRef: "exercise:sequence-1:slides:1",
    });
  });
});
