import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { listeningReviewDigest } from "../src/infrastructure/content/validateListeningQuestionQuality.js";
const command = new URL("../scripts/record-listening-question-review.js", import.meta.url).pathname;
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "vocora-review-")); t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, "2026-06-18-limiting-screen-time-for-children");
  await cp(new URL("../data/listening/episodes/2026-06-18-limiting-screen-time-for-children/", import.meta.url), directory, { recursive: true });
  // A developer's ignored local audio is unrelated to this offline authoring-command test.
  await rm(join(directory, "audio.mp3"), { force: true });
  return { directory, file: join(directory, "listening.json") };
}
const run = (directory, flags = []) => spawnSync(process.execPath, [command, "--episode", directory, ...flags], { encoding: "utf8" });
test("recording a review requires explicit semantic-review confirmation", async t => {
  const f = await fixture(t); const before = await readFile(f.file, "utf8");
  const result = run(f.directory); assert.notEqual(result.status, 0); assert.match(result.stderr, /confirm-reviewed/);
  assert.equal(await readFile(f.file, "utf8"), before);
});
test("the review command deterministically binds already reviewed content and reports offline audio status", async t => {
  const f = await fixture(t); const data = JSON.parse(await readFile(f.file, "utf8"));
  delete data.tests[0].sourceReview.contentSha256; await writeFile(f.file, JSON.stringify(data));
  const result = run(f.directory, ["--confirm-reviewed"]); assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).audioChecked, false);
  const reviewed = JSON.parse(await readFile(f.file, "utf8"));
  for (const selected of reviewed.tests) assert.equal(selected.sourceReview.contentSha256, listeningReviewDigest(selected));
  const first = await readFile(f.file, "utf8"); assert.equal(run(f.directory, ["--confirm-reviewed"]).status, 0);
  assert.equal(await readFile(f.file, "utf8"), first);
});
test("confirmation cannot bypass a chronology failure or replace the rejected input", async t => {
  const f = await fixture(t); const data = JSON.parse(await readFile(f.file, "utf8"));
  Object.assign(data.tests[0].groups[1].questions[0].evidence, { startSeconds: 0, endSeconds: 1 });
  const before = JSON.stringify(data); await writeFile(f.file, before);
  const result = run(f.directory, ["--confirm-reviewed"]); assert.notEqual(result.status, 0); assert.match(result.stderr, /chronology/);
  assert.equal(await readFile(f.file, "utf8"), before);
});
test("required media cannot be waived by a review confirmation", async t => {
  const f = await fixture(t); const before = await readFile(f.file, "utf8");
  const result = run(f.directory, ["--confirm-reviewed", "--require-audio"]);
  assert.notEqual(result.status, 0); assert.match(result.stderr, /audio\.mp3/); assert.equal(await readFile(f.file, "utf8"), before);
});
