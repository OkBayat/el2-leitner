import assert from "node:assert/strict";
import { test } from "node:test";

import { GetExerciseContext } from "../src/application/collection-learning-path/queries/GetExerciseContext.js";

const NOW = "2026-09-07T14:30:00.000Z";

const path = {
  id: "path-1",
  collectionId: "collection-1",
  title: "Course",
  mode: "finite",
  status: "published",
  contentVersion: 1,
  publishedAt: NOW,
  retiredAt: null,
  lessons: [{
    id: "lesson-1",
    title: "Lesson 1",
    position: 1,
    sourceKind: "fixture",
    sourceRef: "lesson-1",
    status: "published",
    introducedVersion: 1,
    retiredVersion: null,
    publishedAt: NOW,
    retiredAt: null,
    exercises: [{
      id: "exercise-1",
      position: 1,
      type: "fixture.exercise",
      schemaVersion: 1,
      required: true,
      completionPolicy: "explicit",
      config: {},
      status: "published",
      introducedVersion: 1,
      retiredVersion: null,
      publishedAt: NOW,
      retiredAt: null,
    }],
  }],
};

const progress = {
  path: {
    status: "in_progress",
    startedAt: NOW,
    completedAt: null,
    lastActivityAt: NOW,
    lastSeenContentVersion: 1,
    revision: 7,
  },
  lessons: [{
    lessonId: "lesson-1",
    status: "in_progress",
    startedAt: NOW,
    completedAt: null,
    lastActivityAt: NOW,
  }],
  exercises: [{
    exerciseId: "exercise-1",
    status: "in_progress",
    startedAt: NOW,
    completedAt: null,
    lastActivityAt: NOW,
  }],
};

test("exercise context exposes the authoritative Learning Path progress revision", async () => {
  const query = new GetExerciseContext({
    definitionReader: {
      async findByPublicId(id) { return id === path.id ? structuredClone(path) : null; },
    },
    progressReader: {
      async findForPath() { return structuredClone(progress); },
    },
    accessReader: {
      async getForCollection() { return { canRead: true, canProgress: true }; },
    },
    exerciseRuntime: {
      async hydrate() { return { fixture: true }; },
    },
  });

  const context = await query.execute("user-1", "path-1", "lesson-1", "exercise-1");

  assert.equal(context.path.progressRevision, 7);
  assert.equal(context.path.progress.revision, 7);
  assert.equal(context.state, "in_progress");
});
