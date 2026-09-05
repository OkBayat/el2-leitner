import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { validateListeningQuestionQuality } from "../src/infrastructure/content/validateListeningQuestionQuality.js";
import { basename, dirname, join, resolve } from "node:path";
import { loadListeningEpisodeSources, listeningEpisodesDirectory } from "../src/infrastructure/content/loadListeningEpisodeSources.js";

const args = process.argv.slice(2);
let episode = null;
let requireAudio = false;
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--require-audio") requireAudio = true;
  else if (args[index] === "--episode" && !episode && args[index + 1] && !args[index + 1].startsWith("--")) {
    episode = resolve(args[++index]);
  } else throw new Error("Usage: validate-listening-lessons.js [--require-audio] [--episode /path/to/YYYY-MM-DD-slug]");
}
const sources = await loadListeningEpisodeSources(episode ? dirname(episode) : undefined, {
  requireAudio, episodeFolder: episode ? basename(episode) : null
});
const root = episode ? dirname(episode) : listeningEpisodesDirectory();
for (const source of sources) {
  const directory = join(root, source.definition.assetDirectory);
  const manifest = JSON.parse(await readFile(join(directory, "episode.json"), "utf8"));
  const listening = JSON.parse(await readFile(join(directory, "listening.json"), "utf8"));
  let audioSha256 = null;
  try {
    audioSha256 = createHash("sha256").update(await readFile(join(directory, "audio.mp3"))).digest("hex");
  } catch (error) { if (error.code !== "ENOENT" || requireAudio) throw error; }
  validateListeningQuestionQuality(listening, { manifest, audioSha256, sourceName: directory });
}
console.log(JSON.stringify({
  lessons: sources.length,
  tests: sources.reduce((sum, source) => sum + source.definition.tests.length, 0),
  questions: sources.reduce((sum, source) => sum + source.definition.questionCount, 0)
}));
