import { readFile, readdir } from "node:fs/promises";

import { validateFileManagedLearningPathSourceCatalog } from "../../domain/collection-learning-path/FileManagedLearningPathSource.js";

const SOURCE_FILE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/u;

export async function loadLearningPathSources(directoryUrl, parseSource) {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const jsonFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "en"));

  for (const fileName of jsonFiles) {
    if (!SOURCE_FILE_PATTERN.test(fileName)) {
      throw new Error(`Invalid Learning Path source filename: ${fileName}. Use lowercase hyphenated JSON filenames.`);
    }
  }

  const sources = [];
  for (const fileName of jsonFiles) {
    const url = new URL(fileName, directoryUrl);
    const rawText = await readFile(url, "utf8");
    let raw;
    try {
      raw = JSON.parse(rawText);
    } catch (error) {
      throw new Error(`Invalid JSON in Learning Path source ${fileName}.`, { cause: error });
    }
    sources.push({ fileName, definition: parseSource(raw) });
  }

  validateFileManagedLearningPathSourceCatalog(sources.map((source) => source.definition));
  return sources;
}
