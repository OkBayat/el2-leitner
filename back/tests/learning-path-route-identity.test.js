import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GetLearningPath } from "../src/application/collection-learning-path/queries/GetLearningPath.js";
import { ResolveLegacyLearningPathRoute } from "../src/application/collection-learning-path/queries/ResolveLegacyLearningPathRoute.js";

const path = {
  id: "source-path",
  publicId: "1",
  collectionId: "collection-1",
  title: "Path",
  mode: "finite",
  status: "published",
  contentVersion: 1,
  retiredAt: null,
  lessons: [{
    id: "source-lesson",
    publicId: "5",
    title: "Lesson",
    position: 1,
    status: "published",
    retiredAt: null,
    exercises: [{
      id: "source-exercise",
      publicId: "10",
      position: 1,
      type: "fixture",
      schemaVersion: 1,
      required: true,
      completionPolicy: "explicit",
      config: {},
      status: "published",
      retiredAt: null,
    }],
  }],
};

const progressReader = {
  async findForPath() { return { path: null, lessons: [], exercises: [] }; },
};
const accessReader = {
  async getForCollection() { return { canRead: true, canProgress: true }; },
};

describe("Learning Path route identity", () => {
  it("loads canonical ids independently from source ids", async () => {
    const definitionReader = {
      async findByRoutePublicId(id) { return id === "1" ? structuredClone(path) : null; },
    };
    const view = await new GetLearningPath({ definitionReader, progressReader, accessReader })
      .execute("user-1", "1");

    assert.equal(view.path.id, "source-path");
    assert.equal(view.path.publicId, "1");
    assert.deepEqual(view.resumePoint, { lessonId: "5", exerciseId: "10" });
  });

  it("maps a complete legacy source hierarchy to one canonical route", async () => {
    const definitionReader = {
      async findByPublicId(id) { return id === "source-path" ? structuredClone(path) : null; },
    };
    const route = await new ResolveLegacyLearningPathRoute({ definitionReader, progressReader, accessReader })
      .execute("user-1", "source-path", "source-lesson", "source-exercise");

    assert.deepEqual(route, { pathId: "1", lessonId: "5", exerciseId: "10" });
  });

  it("does not resolve a legacy exercise outside the requested hierarchy", async () => {
    const definitionReader = {
      async findByPublicId() { return structuredClone(path); },
    };
    await assert.rejects(
      new ResolveLegacyLearningPathRoute({ definitionReader, progressReader, accessReader })
        .execute("user-1", "source-path", "source-lesson", "other-exercise"),
      (error) => error?.code === "LEARNING_PATH_ROUTE_NOT_FOUND",
    );
  });
});
