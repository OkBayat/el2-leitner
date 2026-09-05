import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink, cp, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadListeningEpisodeSources } from "../src/infrastructure/content/loadListeningEpisodeSources.js";

const raw = JSON.parse(await readFile(new URL("./fixtures/listening/260618-limiting-screen-time-for-children.json", import.meta.url), "utf8"));
const vocabulary = "# Screen time\n\n## Episode vocabulary\n\n- intentional\n  - definition: Done on purpose rather than by accident.\n  - example: Taking a walk after lunch was an intentional choice.\n";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aPFsAAAAASUVORK5CYII=", "base64");
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "vocora-episodes-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const name = "2026-06-18-screen-time";
  const directory = join(root, name);
  await mkdir(directory);
  const { tests, ...metadata } = structuredClone(raw);
  const manifest = { ...metadata, schemaVersion: 1, level: "intermediate", audioFile: "audio.mp3", imageFile: "cover.png" };
  const listening = { schemaVersion: 2, tests: tests.map((item) => ({ ...item, format: "ielts", difficulty: "medium" })) };
  const save = (file, data) => writeFile(join(directory, file), typeof data === "string" || Buffer.isBuffer(data) ? data : JSON.stringify(data));
  await save("episode.json", manifest);
  await save("listening.json", listening);
  await save("vocabulary.md", vocabulary);
  await save("transcript.md", "# Full transcript\n\nLocal, file-only study material.\n");
  await save("cover.png", png);
  return { root, name, directory, manifest, listening, save };
}

test("managed episodes project canonical tests, metadata and a PR63 collection without storing the transcript", async (t) => {
  const f = await fixture(t);
  const [source] = await loadListeningEpisodeSources(f.root);
  assert.equal(source.definition.publicId, raw.publicId);
  assert.equal(source.definition.level, "intermediate");
  assert.equal(source.definition.assetDirectory, f.name);
  assert.equal(source.definition.audioFile, "audio.mp3");
  assert.equal(source.definition.tests.length, 3);
  assert.equal(source.definition.tests[0].difficulty, "medium");
  assert.equal(source.collection.publicId, raw.publicId);
  assert.equal(source.collection.parsed.entries[0].examples.length, 1);
  assert.equal(JSON.stringify(source).includes("Local, file-only study material"), false);
  const before = JSON.stringify(source);
  await f.save("transcript.md", "# Revised full transcript\n\nThis edit must not trigger any database writes.\n");
  await f.save("episode.json", Object.fromEntries(Object.entries(f.manifest).reverse()));
  await f.save("listening.json", JSON.stringify(f.listening, null, 4));
  assert.equal(JSON.stringify((await loadListeningEpisodeSources(f.root))[0]), before);
});

test("audio is optional in a Git checkout but required when producing a complete bundle", async (t) => {
  const f = await fixture(t);
  await assert.doesNotReject(loadListeningEpisodeSources(f.root));
  await assert.rejects(loadListeningEpisodeSources(f.root, { requireAudio: true }), /audio\.mp3/u);
  await f.save("audio.mp3", Buffer.concat([Buffer.from("ID3"), Buffer.alloc(100)]));
  await assert.doesNotReject(loadListeningEpisodeSources(f.root, { requireAudio: true }));
});

for (const [label, mutate, expected] of [
  ["invalid episode level", (f) => { f.manifest.level = "elementry"; }, /level/u],
  ["path traversal", (f) => { f.manifest.imageFile = "../cover.png"; }, /imageFile/u],
  ["unknown manifest keys", (f) => { f.manifest.transcript = "must not go into SQL"; }, /Unknown/u],
  ["invalid difficulty", (f) => { f.listening.tests[0].difficulty = "impossible"; }, /difficulty/u],
  ["missing IELTS test", (f) => { f.listening.tests.forEach((test) => { test.format = "other"; }); }, /ielts/u],
  ["no tests", (f) => { f.listening.tests = []; }, /test/u],
]) {
  test(`rejects ${label} before synchronization`, async (t) => {
    const f = await fixture(t); mutate(f);
    await f.save("episode.json", f.manifest); await f.save("listening.json", f.listening);
    await assert.rejects(loadListeningEpisodeSources(f.root), expected);
  });
}

test("requires definitions AND original examples for every episode term", async (t) => {
  const f = await fixture(t);
  await f.save("vocabulary.md", vocabulary.replace(/  - example:.*\n/u, ""));
  await assert.rejects(loadListeningEpisodeSources(f.root), /example/u);
});

test("rejects invalid images and symlinked assets", async (t) => {
  const f = await fixture(t);
  await f.save("cover.png", "<html>not an image</html>");
  await assert.rejects(loadListeningEpisodeSources(f.root), /image/u);
  await rm(join(f.directory, "cover.png"));
  const outside = join(f.root, "outside.png"); await writeFile(outside, png);
  await symlink(outside, join(f.directory, "cover.png"));
  await assert.rejects(loadListeningEpisodeSources(f.root), /symbolic/u);
});

test("a missing or empty episode directory is an explicit deployment error", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "vocora-empty-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(loadListeningEpisodeSources(root), /No episode/u);
});


test("duplicate identities are rejected and one-folder bundle validation stays isolated", async (t) => {
  const f = await fixture(t);
  await cp(f.directory, join(f.root, "2026-06-18-another-title"), { recursive: true });
  await assert.rejects(loadListeningEpisodeSources(f.root), /Duplicate episode/u);
  const only = await loadListeningEpisodeSources(f.root, { episodeFolder: f.name });
  assert.equal(only.length, 1);
  await assert.rejects(loadListeningEpisodeSources(f.root, { episodeFolder: "../../etc" }), /Invalid selected/u);
});

test("vocabulary edits do not change the listening definition and folder renames update collection provenance", async (t) => {
  const f = await fixture(t);
  const [before] = await loadListeningEpisodeSources(f.root);
  await f.save("vocabulary.md", vocabulary.replace("Done on purpose rather than by accident.", "Done deliberately."));
  const [after] = await loadListeningEpisodeSources(f.root);
  assert.deepEqual(after.definition, before.definition);
  assert.notEqual(after.collection.sourceHash, before.collection.sourceHash);
  await rename(f.directory, join(f.root, "2026-06-18-renamed"));
  const [renamed] = await loadListeningEpisodeSources(f.root);
  assert.equal(renamed.definition.publicId, before.definition.publicId);
  assert.notEqual(renamed.collection.sourceHash, after.collection.sourceHash);
});
