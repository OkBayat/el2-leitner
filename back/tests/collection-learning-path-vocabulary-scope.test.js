import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveVocabularyIntakeScope } from "../src/domain/collection-learning-path/VocabularyIntake.js";
import { resolveScopedVocabularyPracticeScope } from "../src/domain/collection-learning-path/ScopedVocabularyPractice.js";
import {
  createVocabularyMasteryCheckSessionMetadata,
  parseVocabularyMasteryCheckSessionSnapshot,
  resolveVocabularyMasteryCheckScope,
} from "../src/domain/collection-learning-path/VocabularyMasteryCheck.js";

const SECTION_SCOPE = { kind: "collection-section", ref: "section-unit-01" };

function exercise(type, completionPolicy) {
  return {
    id: `${type}-exercise`,
    type,
    schemaVersion: 1,
    completionPolicy,
    config: { scope: SECTION_SCOPE },
  };
}

test("all vocabulary exercise contracts accept collection-section scopes in addition to listening episodes", () => {
  assert.deepEqual(
    resolveVocabularyIntakeScope(exercise("vocabulary.intake", "vocabulary-intake")),
    SECTION_SCOPE,
  );
  assert.deepEqual(
    resolveScopedVocabularyPracticeScope(exercise("vocabulary.quick-review", "vocabulary-quick-review")),
    SECTION_SCOPE,
  );
  assert.deepEqual(
    resolveVocabularyMasteryCheckScope(exercise("vocabulary.mastery-check", "vocabulary-mastery-check")),
    SECTION_SCOPE,
  );
});

test("mastery-check evidence snapshots retain collection-section scope identity", () => {
  const definition = exercise("vocabulary.mastery-check", "vocabulary-mastery-check");
  const metadata = createVocabularyMasteryCheckSessionMetadata(definition, SECTION_SCOPE, ["vocab-1"]);
  const snapshot = parseVocabularyMasteryCheckSessionSnapshot(metadata);

  assert.deepEqual(snapshot, {
    exerciseId: definition.id,
    scope: SECTION_SCOPE,
    vocabularyIds: ["vocab-1"],
  });
});

test("unsupported vocabulary scope kinds remain rejected at the domain boundary", () => {
  const unsupported = exercise("vocabulary.intake", "vocabulary-intake");
  unsupported.config.scope = { kind: "arbitrary-database-query", ref: "unsafe" };

  assert.throws(() => resolveVocabularyIntakeScope(unsupported), /scope\.kind/u);
});
