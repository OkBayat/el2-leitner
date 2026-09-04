import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

export const EXAMPLE_COLLECTION_FILE = "example-collection.md";
const COLLECTION_FILE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u;

function directoryPath(directory) {
  return directory instanceof URL ? fileURLToPath(directory) : String(directory);
}

export function collectionSlugFromFileName(fileName) {
  const name = basename(String(fileName));
  if (!COLLECTION_FILE_PATTERN.test(name)) {
    throw new Error(
      `Invalid collection file name "${name}". Use lowercase letters, numbers, and hyphens only.`
    );
  }
  return name.slice(0, -3);
}

export function collectionSourceHash(parsed) {
  const canonical = {
    formatVersion: 1,
    title: parsed.title,
    sections: parsed.sections.map(({ path, title, parentPath, position }) => ({
      path,
      title,
      parentPath,
      position
    })),
    entries: parsed.entries.map((entry) => ({
      position: entry.position,
      primaryForm: entry.primaryForm,
      acceptedForms: entry.acceptedForms,
      sectionPath: entry.sectionPath,
      definitions: entry.definitions,
      examples: entry.examples
    }))
  };
  return createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
}

export async function loadCollectionSources(directory, parser) {
  const root = directoryPath(directory);
  const dirEntries = await readdir(root, { withFileTypes: true });
  const files = dirEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== EXAMPLE_COLLECTION_FILE)
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "en"));

  const sources = [];
  for (const fileName of files) {
    const slug = collectionSlugFromFileName(fileName);
    const text = await readFile(join(root, fileName), "utf8");
    const parsed = parser.parse(text);
    sources.push({
      fileName,
      slug,
      sourceHash: collectionSourceHash(parsed),
      parsed
    });
  }
  return sources;
}
