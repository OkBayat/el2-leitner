import { basename, dirname, resolve } from "node:path";
import { loadListeningEpisodeSources } from "../src/infrastructure/content/loadListeningEpisodeSources.js";

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
console.log(JSON.stringify({
  lessons: sources.length,
  tests: sources.reduce((sum, source) => sum + source.definition.tests.length, 0),
  questions: sources.reduce((sum, source) => sum + source.definition.questionCount, 0)
}));
