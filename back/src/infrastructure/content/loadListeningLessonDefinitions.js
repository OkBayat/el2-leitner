import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { parseListeningLessonDefinition } from "../../domain/listening-practice/ListeningLessonDefinition.js";

export async function loadListeningLessonDefinitions(directoryUrl) {
  const files = (await readdir(fileURLToPath(directoryUrl)))
    .filter((name) => name.endsWith(".json"))
    .sort((left, right) => left.localeCompare(right, "en"));

  const definitions = [];
  for (const file of files) {
    const raw = JSON.parse(await readFile(new URL(file, directoryUrl), "utf8"));
    definitions.push(parseListeningLessonDefinition(raw, file));
  }
  return definitions;
}
