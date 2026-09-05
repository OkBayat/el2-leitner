import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { createApiRouter } from "../src/interfaces/http/apiRouter.js";
import { createErrorHandler } from "../src/interfaces/http/errorHandler.js";
import { resolveListeningAsset } from "../src/interfaces/http/resolveListeningAsset.js";
import { GetListeningEpisodeAudio } from "../src/application/listening-practice/GetListeningEpisodeAudio.js";
import { GetListeningEpisodeImage } from "../src/application/listening-practice/GetListeningEpisodeImage.js";
import { GetListeningEpisodeVocabulary } from "../src/application/listening-practice/GetListeningEpisodeVocabulary.js";
import { NotFoundError } from "../src/domain/errors.js";

const folder = "2026-06-18-screen-time";
const base = "/api/listening/bbc/lessons/screen-time";
async function context(t) {
  const root = await mkdtemp(join(tmpdir(), "vocora-media-"));
  t.after(() => rm(root, { force: true, recursive: true }));
  const episodes = join(root, "episodes"), legacy = join(root, "legacy");
  await mkdir(join(episodes, folder), { recursive: true }); await mkdir(legacy);
  const audio = Buffer.from("ID3-test-audio-for-range-request-0123456789");
  await writeFile(join(episodes, folder, "audio.mp3"), audio);
  await writeFile(join(episodes, folder, "cover.jpg"), Buffer.from([255, 216, 255, 224, 0, 0]));
  await writeFile(join(episodes, folder, "listening.json"), '{"answers":["secret"]}');
  const repository = {
    async findPublishedAudioBySlug(_provider, slug) {
      if (slug !== "screen-time") throw new NotFoundError();
      return { audioFile: "audio.mp3", assetDirectory: folder, legacyAudioFile: "bbc-6-minute-english-260618.mp3" };
    },
    async findPublishedImageBySlug(_provider, slug) {
      if (slug !== "screen-time") throw new NotFoundError();
      return { imageFile: "cover.jpg", assetDirectory: folder };
    }
  };
  const calls = [];
  const app = express(); app.use(cookieParser()); app.use(express.json());
  app.use("/api", createApiRouter({
    useCases: {
      getCurrentUser: { execute: async () => ({ id: "42" }) },
      getListeningEpisodeAudio: new GetListeningEpisodeAudio({ listeningPracticeRepository: repository }),
      getListeningEpisodeImage: new GetListeningEpisodeImage({ listeningPracticeRepository: repository }),
      getListeningEpisodeVocabulary: new GetListeningEpisodeVocabulary({ listeningVocabularyRepository: {
        async findForEpisode(...args) { calls.push(args); return { episode: { slug: "screen-time" }, collectionId: "collection", entries: [] }; }
      } })
    },
    tokenService: { verify: () => ({ userId: "42" }) },
    authCookie: { name: "session", options: {} }, authRateLimit: { windowMs: 60_000, max: 1000 },
    listeningAudioDirectory: legacy, listeningEpisodesDirectory: episodes
  }));
  app.use(createErrorHandler({ nodeEnv: "test", logger: { error() {} } }));
  const get = (path) => request(app).get(path).set("Cookie", "session=test");
  return { app, get, root, episodes, legacy, audio, repository, calls };
}

test("episode image and vocabulary require authentication and expose no source files", async (t) => {
  const c = await context(t);
  for (const suffix of ["image", "audio", "vocabulary"]) await request(c.app).get(`${base}/${suffix}`).expect(401);
  const image = await c.get(`${base}/image`).expect(200).expect("Content-Type", /image\/jpeg/u);
  assert.equal(image.headers["cache-control"], "no-store");
  for (const filename of ["listening.json", "episode.json", "transcript.md", "vocabulary.md"]) {
    await c.get(`${base}/${filename}`).expect(404);
    await c.get(`/data/listening/episodes/${folder}/${filename}`).expect(404);
  }
  await c.get("/api/listening/bbc/lessons/unpublished/image").expect(404);
});

test("audio supports byte ranges from the episode folder and falls back to the previous filename", async (t) => {
  const c = await context(t);
  const part = await c.get(`${base}/audio`).set("Range", "bytes=0-9").expect(206);
  assert.equal(part.headers["content-range"], `bytes 0-9/${c.audio.length}`);
  assert.equal(part.headers["content-length"], "10");
  await rm(join(c.episodes, folder, "audio.mp3"));
  await c.get(`${base}/audio`).expect(404);
  await writeFile(join(c.legacy, "bbc-6-minute-english-260618.mp3"), c.audio);
  await c.get(`${base}/audio`).set("Range", "bytes=0-2").expect(206);
});

test("media lookup refuses traversal, answer-key filenames and symlinks", async (t) => {
  const c = await context(t);
  for (const path of [["..", "listening.json"], [folder, "../listening.json"], ["/etc/passwd"]]) {
    await assert.rejects(resolveListeningAsset(c.episodes, path, "AUDIO"), { code: "LISTENING_AUDIO_NOT_FOUND" });
  }
  await rm(join(c.episodes, folder, "cover.jpg"));
  await symlink(join(c.episodes, folder, "listening.json"), join(c.episodes, folder, "cover.jpg"));
  await c.get(`${base}/image`).expect(404);
  c.repository.findPublishedImageBySlug = async () => ({ imageFile: "listening.json", assetDirectory: folder });
  await c.get(`${base}/image`).expect(404);
  c.repository.findPublishedAudioBySlug = async () => ({ audioFile: "../../private.mp3", assetDirectory: folder });
  await c.get(`${base}/audio`).expect(404);
});

test("vocabulary reads are scoped to the authenticated user and chosen BBC episode", async (t) => {
  const c = await context(t);
  const response = await c.get(`${base}/vocabulary`).expect(200);
  assert.deepEqual(c.calls, [["42", "bbc_6_minute_english", "screen-time"]]);
  assert.equal(response.body.collectionId, "collection");
  assert.equal(response.headers["cache-control"], "no-store");
  await c.get("/api/listening/bbc/lessons/bad%20slug/vocabulary").expect(400);
});
