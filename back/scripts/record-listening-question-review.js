import { createHash, randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { loadListeningEpisodeSources } from "../src/infrastructure/content/loadListeningEpisodeSources.js";
import { listeningReviewDigest, validateListeningQuestionQuality } from "../src/infrastructure/content/validateListeningQuestionQuality.js";

const usage = "Usage: record-listening-question-review.js --episode <directory> --confirm-reviewed [--require-audio]";
try {
  const args = process.argv.slice(2);
  let directory = null; let confirmed = false; let requireAudio = false;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--episode" && !directory && args[index + 1] && !args[index + 1].startsWith("--")) directory = resolve(args[++index]);
    else if (args[index] === "--confirm-reviewed" && !confirmed) confirmed = true;
    else if (args[index] === "--require-audio" && !requireAudio) requireAudio = true;
    else throw new Error(usage);
  }
  if (!directory || !confirmed) throw new Error(usage);
  // Validate the real schema/media before touching the file. The confirmation is a human/agent
  // declaration of source review, never an automated certification of pedagogical correctness.
  await loadListeningEpisodeSources(dirname(directory), { episodeFolder: basename(directory), requireAudio });
  const path = join(directory, "listening.json");
  const original = await readFile(path, "utf8");
  const listening = JSON.parse(original);
  const manifest = JSON.parse(await readFile(join(directory, "episode.json"), "utf8"));
  let audioSha256 = null;
  try { audioSha256 = createHash("sha256").update(await readFile(join(directory, "audio.mp3"))).digest("hex"); }
  catch (error) { if (error.code !== "ENOENT" || requireAudio) throw error; }
  for (const selected of listening.tests) {
    if (!selected.sourceReview) throw new Error(`${selected.id}: Author the source review and evidence before recording confirmation.`);
    selected.sourceReview.contentSha256 = listeningReviewDigest(selected);
  }
  const report = validateListeningQuestionQuality(listening, { manifest, audioSha256, sourceName: directory });
  const output = `${JSON.stringify(listening, null, 2)}\n`;
  if (original !== output) {
    const temporary = join(directory, `.listening-review-${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, output, { flag: "wx", mode: 0o644 });
      if (await readFile(path, "utf8") !== original) throw new Error("Listening content changed during review; no file was replaced.");
      await rename(temporary, path);
    } finally { await rm(temporary, { force: true }); }
  }
  console.log(JSON.stringify({ ...report, audioChecked: audioSha256 !== null, review: "recorded" }));
} catch (error) {
  console.error(error.message); process.exitCode = 1;
}
