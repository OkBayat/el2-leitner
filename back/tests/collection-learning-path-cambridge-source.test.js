import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { parseFileManagedLearningPathSource } from "../src/domain/collection-learning-path/FileManagedLearningPathSource.js";
import { projectLearningPathProgress } from "../src/domain/collection-learning-path/LearningPathProgression.js";
import { loadLearningPathSources } from "../src/infrastructure/content/loadLearningPathSources.js";

const SOURCES = new URL("../data/learning-paths/", import.meta.url);
const VOCABULARY_SOURCE = new URL("../data/collections/cambridge-vocabulary-for-ielts.md", import.meta.url);

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function answerFields(data, slideId) {
  const fields = data.fields ?? data.blanks;
  assert.ok(Array.isArray(fields) && fields.length > 0, `${slideId} requires answer fields`);
  assert.equal(new Set(fields.map((field) => field.id)).size, fields.length, `${slideId} field ids must be unique`);
  assert.ok(fields.every((field) => nonEmpty(field.id) && Array.isArray(field.answers) && field.answers.every(nonEmpty)),
    `${slideId} requires valid field answers`);
  return fields;
}

function assertReusableSlide(slide) {
  assert.ok(nonEmpty(slide.id));
  assert.ok(slide.data && typeof slide.data === "object" && !Array.isArray(slide.data), `${slide.id} requires data`);
  const data = slide.data;
  if (slide.type === "lesson-vocabulary-scope") {
    assert.ok(nonEmpty(data.intro?.eyebrow));
    assert.ok(nonEmpty(data.intro?.title));
    assert.ok(nonEmpty(data.intro?.description));
    assert.equal(slide.chrome?.footer?.primary?.id, "start-vocabulary-scope");
    assert.ok(nonEmpty(slide.chrome?.footer?.primary?.label));
    assert.equal(slide.chrome?.footer?.primary?.behavior, "content");
    const generated = data.generatedSlide;
    assert.ok(["dictation", "meaning-choice"].includes(generated?.type));
    assert.ok(nonEmpty(generated.instruction));
    if (generated.type === "dictation") {
      assert.ok(["word", "phrase", "sentence"].includes(generated.mode));
      assert.equal(typeof generated.speech?.autoplay, "boolean");
      assert.equal(typeof generated.speech?.replay, "boolean");
      assert.equal(typeof generated.caseSensitive, "boolean");
      assert.equal(typeof generated.punctuationSensitive, "boolean");
    } else {
      assert.equal(generated.mode, "meaning");
      assert.ok(Number.isSafeInteger(generated.optionCount) && generated.optionCount >= 2);
      assert.ok(nonEmpty(generated.explanationTemplate));
    }
  } else if (slide.type === "teaching-card") {
    assert.ok(nonEmpty(data.title));
    assert.ok(nonEmpty(data.markdown));
    assert.equal(Object.hasOwn(data, "blocks"), false);
  } else if (slide.type === "choice") {
    assert.ok(nonEmpty(data.question));
    assert.ok(Array.isArray(data.options) && data.options.length >= 2);
    const optionIds = new Set(data.options.map((option) => option.id));
    assert.ok(Array.isArray(data.correctOptionIds) && data.correctOptionIds.length > 0);
    assert.ok(data.correctOptionIds.every((id) => optionIds.has(id)));
  } else if (slide.type === "truth") {
    const valid = data.mode === "true-false-not-given"
      ? new Set(["true", "false", "not-given"])
      : new Set(["true", "false"]);
    assert.ok(nonEmpty(data.statement) && valid.has(data.correctOptionId));
  } else if (slide.type === "matching") {
    assert.ok(Array.isArray(data.pairs) && data.pairs.length >= 2);
    assert.ok(data.pairs.every((pair) => nonEmpty(pair.id) && nonEmpty(pair.left) && nonEmpty(pair.right)));
  } else if (slide.type === "classification") {
    assert.ok(Array.isArray(data.categories) && data.categories.length >= 2);
    const categoryIds = new Set(data.categories.map((category) => category.id));
    assert.ok(Array.isArray(data.items) && data.items.length > 0);
    assert.ok(data.items.every((item) => categoryIds.has(item.correctCategoryId)));
  } else if (slide.type === "cloze") {
    const fields = answerFields(data, slide.id);
    const placeholders = [...data.content.matchAll(/\{\{([^{}]+)\}\}/gu)].map((match) => match[1].trim());
    assert.deepEqual(new Set(placeholders), new Set(fields.map((field) => field.id)), `${slide.id} cloze fields must match placeholders`);
    assert.equal(placeholders.length, fields.length, `${slide.id} must render every field exactly once`);
  } else if (slide.type === "structured-completion") {
    answerFields(data, slide.id);
  } else if (slide.type === "short-answer") {
    assert.ok(nonEmpty(data.question) && Array.isArray(data.answers) && data.answers.every(nonEmpty));
  } else if (slide.type === "word-formation") {
    assert.ok(nonEmpty(data.baseWord));
    answerFields(data, slide.id);
  } else if (slide.type === "error-correction") {
    assert.ok(nonEmpty(data.original) && Array.isArray(data.answers) && data.answers.every(nonEmpty));
  } else if (slide.type === "rewrite") {
    assert.ok(nonEmpty(data.original));
    assert.ok(data.acceptedAnswers?.length || data.requiredFragments?.length || nonEmpty(data.modelAnswer));
  } else if (slide.type === "dictation") {
    assert.ok(nonEmpty(data.answer));
    assert.ok(nonEmpty(data.audio) || nonEmpty(data.speech?.text));
  } else if (slide.type === "speaking-response") {
    assert.ok(nonEmpty(data.prompt) && Array.isArray(data.targetVocabulary) && data.targetVocabulary.length > 0);
  } else if (slide.type === "writing-response") {
    assert.ok(nonEmpty(data.prompt) && Array.isArray(data.targetVocabulary) && data.targetVocabulary.length > 0);
  } else {
    assert.equal(slide.type, "summary", `unsupported slide type in ${slide.id}`);
  }
  const stimulus = data.stimulus;
  if (stimulus?.type === "text") {
    assert.ok(nonEmpty(stimulus.content));
    assert.ok((stimulus.sections ?? []).every((section) => nonEmpty(section.id) && nonEmpty(section.content)));
  }
  if (stimulus?.type === "audio") {
    assert.ok(stimulus.src.startsWith("/assets/learning-paths/cvfi/unit-01/"));
  }
  if (stimulus?.type === "dialogue") {
    assert.ok(Array.isArray(stimulus.turns) && stimulus.turns.length >= 2,
      `${slide.id} dialogue requires at least two turns`);
    assert.ok(stimulus.turns.every((turn) => nonEmpty(turn.speaker)
      && nonEmpty(turn.text)
      && Number.isSafeInteger(turn.voiceIndex)
      && turn.voiceIndex >= 0), `${slide.id} dialogue turns must be complete`);
    assert.ok(Number.isSafeInteger(stimulus.maxReplays) && stimulus.maxReplays > 0,
      `${slide.id} dialogue requires a replay limit`);
  }
}

test("Cambridge Vocabulary for IELTS is a complete finite 20-unit file-managed course", async () => {
  const sources = await loadLearningPathSources(SOURCES, parseFileManagedLearningPathSource);
  const source = sources.find(({ fileName }) => fileName === "cambridge-vocabulary-for-ielts.json");
  assert.ok(source);
  assert.equal(source.definition.path.collectionId, "cambridge-vocabulary-for-ielts");
  assert.equal(source.definition.path.mode, "finite");
  assert.equal(source.definition.lessons.length, 20);
  assert.deepEqual(source.definition.lessons.map((lesson) => lesson.position), Array.from({ length: 20 }, (_, index) => index + 1));
  assert.equal(source.definition.lessons[0].title, "Unit 1 — Growing up");
  assert.equal(source.definition.lessons[19].title, "Unit 20 — The arts");
  assert.ok(source.definition.lessons.every((lesson) => lesson.source.kind === "collection-section"));
  assert.ok(source.definition.lessons.every((lesson) => lesson.source.collectionId === "cambridge-vocabulary-for-ielts"));
  const [unitOne, ...remainingUnits] = source.definition.lessons;
  assert.equal(unitOne.exercises.length, 14);
  assert.equal(source.definition.lessons.flatMap((lesson) => lesson.exercises).length, 90);
  assert.deepEqual(unitOne.exercises.map((exercise) => exercise.id), [
    "cvfi-u01-intake",
    "cvfi-u01-spelling",
    "cvfi-u01-quick-review",
    "cvfi-u01-word-building",
    "cvfi-u01-relation-accuracy",
    "cvfi-u01-relationship-collocations",
    "cvfi-u01-family-chunks",
    "cvfi-u01-reading-context",
    "cvfi-u01-aural-recognition",
    "cvfi-u01-guided-listening",
    "cvfi-u01-active-production",
    "cvfi-u01-listening-mechanics",
    "cvfi-u01-listening-simulation",
    "cvfi-u01-mastery-check",
  ]);
  assert.deepEqual(unitOne.exercises.map((exercise) => exercise.position),
    Array.from({ length: 14 }, (_, index) => (index + 1) * 10));
  assert.ok(unitOne.exercises.every((exercise) => exercise.required));
  assert.equal(unitOne.exercises[0].type, "vocabulary.intake");
  for (const exercise of unitOne.exercises.slice(1)) {
    assert.equal(exercise.type, "slides.sequence");
    assert.equal(exercise.completionPolicy, "slide-sequence");
    assert.equal(exercise.config.retryIncorrect, true);
    assert.ok(exercise.config.slides.length >= 2);
    assert.equal(exercise.config.slides.at(-1).type, "summary");
    assert.equal(exercise.config.slides.at(-1).terminal, true);
  }
  assert.deepEqual(unitOne.exercises[1].config.scope, { kind: "lesson-source" });
  assert.equal(unitOne.exercises[1].config.slides[0].data.generatedSlide.type, "dictation");
  assert.deepEqual(unitOne.exercises[2].config.slides.map((slide) => slide.type), [
    "teaching-card", "lesson-vocabulary-scope", "matching", "choice", "cloze", "short-answer", "classification", "rewrite", "summary",
  ]);
  assert.equal(unitOne.exercises[2].config.slides[1].data.autoStart, true);
  const teachingCards = unitOne.exercises.flatMap((exercise) =>
    exercise.config.slides?.filter((slide) => slide.type === "teaching-card") ?? []);
  assert.ok(teachingCards.every((slide) => nonEmpty(slide.data.instruction)
    && nonEmpty(slide.data.explanation)
    && slide.data.markdown.includes("### ")
    && slide.data.markdown.includes("**")));
  const collocationCloze = unitOne.exercises
    .flatMap((exercise) => exercise.config.slides ?? [])
    .find((slide) => slide.id === "cvfi-u01-collocations-context");
  assert.ok(collocationCloze);
  assert.ok(collocationCloze.data.blanks.every((blank) =>
    Array.isArray(blank.definitions) && blank.definitions.every(nonEmpty)));
  assert.ok(!unitOne.exercises
    .flatMap((exercise) => exercise.config.slides ?? [])
    .some((slide) => slide.id === "cvfi-u01-family-chunks-transfer"));
  assert.deepEqual(unitOne.exercises[2].config.scope, { kind: "lesson-source" });
  assert.deepEqual(unitOne.exercises[13].config.scope, { kind: "lesson-source" });
  assert.equal(unitOne.exercises[13].config.slides[1].data.generatedSlide.type, "meaning-choice");
  for (const lesson of remainingUnits) {
    assert.equal(lesson.exercises.length, 4);
    assert.deepEqual(lesson.exercises.map((exercise) => exercise.position), [10, 20, 30, 40]);
    assert.equal(lesson.exercises[1].type, "slide-base");
    assert.equal(lesson.exercises[1].required, false);
    assert.equal(lesson.exercises[1].completionPolicy, "vocabulary-spelling");
    assert.deepEqual(lesson.exercises[1].config.slides.map((slide) => slide.type), [
      "leitner-house-one-scope",
      "summary",
    ]);
    assert.equal(lesson.exercises[1].config.slides[0].data.generatedSlide.type, "dictation");
    assert.deepEqual(Object.keys(lesson.exercises[1].config.slides[0].data), ["generatedSlide"]);
    assert.equal(lesson.exercises[1].config.slides[1].data.aggregationMode, "first-attempts");
    assert.equal(lesson.exercises[1].config.slides[1].terminal, true);
    assert.equal(lesson.exercises[2].type, "vocabulary.quick-review");
    assert.equal(lesson.exercises[3].type, "vocabulary.mastery-check");
  }
});

test("Cambridge Unit 1 expansion does not revoke previously completed learner progress", async () => {
  const sources = await loadLearningPathSources(SOURCES, parseFileManagedLearningPathSource);
  const definition = sources.find(({ fileName }) => fileName === "cambridge-vocabulary-for-ielts.json")?.definition;
  assert.ok(definition);
  const path = {
    ...definition.path,
    contentVersion: 2,
    lessons: definition.lessons.map((lesson) => ({
      ...lesson,
      status: "published",
      retiredAt: null,
      exercises: lesson.exercises.map((exercise) => ({ ...exercise, status: "published", retiredAt: null })),
    })),
  };
  const progress = {
    path: { status: "completed" },
    lessons: definition.lessons.map((lesson) => ({ lessonId: lesson.id, status: "completed" })),
    exercises: definition.lessons.flatMap((lesson) => lesson.exercises
      .filter((exercise) => exercise.id.endsWith("-intake")
        || exercise.id.endsWith("-quick-review")
        || exercise.id.endsWith("-mastery-check"))
      .map((exercise) => ({ exerciseId: exercise.id, status: "completed" }))),
  };

  const projected = projectLearningPathProgress(path, progress);

  assert.equal(projected.path.learnerStatus, "completed");
  assert.ok(projected.lessons.every((lesson) => lesson.state === "completed"));
  assert.ok(projected.lessons.every((lesson) => lesson.exercises[1].state === "available"));
  assert.equal(projected.lessons[0].exercises
    .find((exercise) => exercise.id === "cvfi-u01-word-building")?.state, "locked");
});

test("Cambridge Unit 1 slide decks and synthetic dialogue stimuli are production-ready", async () => {
  const sources = await loadLearningPathSources(SOURCES, parseFileManagedLearningPathSource);
  const definition = sources.find(({ fileName }) => fileName === "cambridge-vocabulary-for-ielts.json")?.definition;
  assert.ok(definition);
  const unitOne = definition.lessons[0];
  const sequences = unitOne.exercises.filter((exercise) => exercise.type === "slides.sequence");
  assert.equal(sequences.flatMap((exercise) => exercise.config.slides).length, 90);
  const slideIds = sequences.flatMap((exercise) => exercise.config.slides.map((slide) => slide.id));
  assert.equal(new Set(slideIds).size, slideIds.length);
  for (const exercise of sequences) {
    assert.ok(nonEmpty(exercise.config.title));
    exercise.config.slides.forEach(assertReusableSlide);
    assert.equal(exercise.config.slides.filter((slide) => slide.terminal === true).length, 1);
    assert.equal(exercise.config.slides.at(-1).terminal, true);
  }

  const dialogues = sequences
    .flatMap((exercise) => exercise.config.slides)
    .map((slide) => slide.data.stimulus)
    .filter((stimulus) => stimulus?.type === "dialogue");
  assert.ok(sequences.flatMap((exercise) => exercise.config.slides).every((slide) =>
    !nonEmpty(slide.data.audio) && slide.data.stimulus?.type !== "audio"));
  assert.equal(dialogues.length, 5);
  assert.ok(dialogues.some((dialogue) => dialogue.turns.length === 4));
  assert.ok(dialogues.some((dialogue) => dialogue.turns.length >= 10 && dialogue.maxReplays === 1));

  const collection = await readFile(VOCABULARY_SOURCE, "utf8");
  const unitOneSection = collection.match(/## Unit 1 — Growing up(?<content>[\s\S]*?)\n## Unit 2 —/u)?.groups?.content ?? "";
  const unitOneTerms = [...unitOneSection.matchAll(/^-(?:\s+)(?<term>.+)$/gmu)].map((match) => match.groups.term.trim());
  assert.equal(unitOneTerms.length, 51);
  assert.equal(new Set(unitOneTerms).size, 51);
  assert.ok([unitOne.exercises[1], unitOne.exercises[2], unitOne.exercises[13]].every((exercise) =>
    exercise.config.scope.kind === "lesson-source"
    && exercise.config.slides.some((slide) => slide.type === "lesson-vocabulary-scope")));
});
