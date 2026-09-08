import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { UploadSlideSequenceRecording } from "../src/application/collection-learning-path/commands/UploadSlideSequenceRecording.js";

const NOW = "2026-09-08T12:00:00.000Z";

function fixturePath() {
  return {
    id: "path-1",
    collectionId: "collection-1",
    title: "Fixture path",
    mode: "finite",
    status: "published",
    contentVersion: 1,
    retiredAt: null,
    lessons: [{
      id: "lesson-1",
      title: "Lesson 1",
      position: 1,
      status: "published",
      retiredAt: null,
      exercises: [{
        id: "exercise-1",
        position: 1,
        type: "slides.sequence",
        schemaVersion: 1,
        required: true,
        completionPolicy: "slide-sequence",
        status: "published",
        retiredAt: null,
        config: {
          slides: [
            { id: "speaking-1", type: "speaking-response", data: {} },
            { id: "summary", type: "summary", terminal: true, data: {} },
          ],
        },
      }],
    }],
  };
}

function webmBytes(size = 512) {
  const bytes = Buffer.alloc(size);
  bytes.set([0x1a, 0x45, 0xdf, 0xa3]);
  return bytes;
}

function command(overrides = {}) {
  const saved = [];
  const dependencies = {
    definitionReader: { findByPublicId: async () => fixturePath() },
    progressReader: {
      findForPath: async () => ({
        path: { status: "in_progress", revision: 1 },
        lessons: [{ lessonId: "lesson-1", status: "in_progress" }],
        exercises: [{ exerciseId: "exercise-1", status: "in_progress", startedAt: NOW }],
      }),
    },
    accessReader: { getForCollection: async () => ({ canRead: true, canProgress: true }) },
    recordingArtifactRepository: {
      save: async (artifact) => saved.push(artifact),
      findByPublicIds: async () => [],
    },
    idFactory: () => "recording-1",
    hashFactory: () => "a".repeat(64),
    clock: () => new Date(NOW),
    ...overrides,
  };
  return { upload: new UploadSlideSequenceRecording(dependencies), saved };
}

describe("slide-sequence speaking recording upload", () => {
  it("validates actual audio bytes and binds the server-issued artifact to user, exercise, and slide", async () => {
    const { upload, saved } = command();

    assert.deepEqual(await upload.execute(
      "user-1",
      "path-1",
      "lesson-1",
      "exercise-1",
      "speaking-1",
      { mimeType: "audio/webm;codecs=opus", bytes: webmBytes() },
    ), { artifactId: "recording-1" });
    assert.equal(saved.length, 1);
    assert.equal(saved[0].userId, "user-1");
    assert.equal(saved[0].exerciseId, "exercise-1");
    assert.equal(saved[0].exerciseStartedAt, NOW);
    assert.equal(saved[0].slideId, "speaking-1");
    assert.equal(saved[0].mimeType, "audio/webm");
    assert.equal(saved[0].byteSize, 512);
    assert.match(saved[0].sha256, /^[a-f0-9]{64}$/u);
  });

  it("rejects fabricated or misbound recording uploads", async () => {
    const { upload, saved } = command();

    await assert.rejects(
      upload.execute("user-1", "path-1", "lesson-1", "exercise-1", "speaking-1", {
        mimeType: "audio/webm",
        bytes: Buffer.from("not an audio recording"),
      }),
      (error) => error?.code === "INVALID_SLIDE_SEQUENCE_RECORDING",
    );
    await assert.rejects(
      upload.execute("user-1", "path-1", "lesson-1", "exercise-1", "summary", {
        mimeType: "audio/webm",
        bytes: webmBytes(),
      }),
      (error) => error?.code === "INVALID_SLIDE_SEQUENCE_RECORDING_SLIDE",
    );
    assert.equal(saved.length, 0);
  });
});
