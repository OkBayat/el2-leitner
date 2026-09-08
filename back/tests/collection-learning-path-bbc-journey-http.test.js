import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { collectionLearningPathDto } from "../src/interfaces/http/collection-learning-path/learningPathDtos.js";

describe("BBC Learning Path journey HTTP projection", () => {
  it("exposes only generic enrollment capability and server-derived resume state", () => {
    const dto = collectionLearningPathDto({
      access: { canProgress: false, internalReason: "not-subscribed" },
      resumePoint: { lessonId: "episode-1", exerciseId: "exercise-1" },
      path: {
        id: "path-1",
        collectionId: "course-1",
        title: "Course",
        mode: "rolling",
        status: "published",
        contentVersion: 4,
        learnerStatus: "available",
        progress: null,
      },
      lessons: [],
    });

    assert.deepEqual(dto.access, { canProgress: false });
    assert.deepEqual(dto.resumePoint, { lessonId: "episode-1", exerciseId: "exercise-1" });
    assert.equal(dto.access.internalReason, undefined);
  });
});
