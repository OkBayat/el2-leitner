import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { VocabularyFileParser } from "../../domain/library/VocabularyFileParser.js";
import { parseListeningLessonDefinition } from "../../domain/listening-practice/ListeningLessonDefinition.js";
import { collectionSourceHash } from "./loadCollectionSources.js";

export const EPISODE_LEVELS = Object.freeze(["elementary", "intermediate", "advanced"]);
export const TEST_DIFFICULTIES = Object.freeze(["very_easy", "easy", "medium", "hard", "very_hard"]);
export const EPISODE_DIRECTORY_PATTERN = /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const MANIFEST_FIELDS = new Set([
  "schemaVersion", "publicId", "provider", "slug", "title", "description", "episodeCode",
  "episodeDate", "sourceUrl", "status", "publishedAt", "level", "audioFile", "imageFile", "sources"
]);
const MAX_TEXT_BYTES = 2_000_000;

export function listeningEpisodesDirectory(env = process.env) {
  return env.LISTENING_EPISODES_DIRECTORY?.trim()
    ? resolve(env.LISTENING_EPISODES_DIRECTORY.trim())
    : fileURLToPath(new URL("../../../data/listening/episodes/", import.meta.url));
}

async function regularFile(directory, name, { optional = false, maxBytes = MAX_TEXT_BYTES } = {}) {
  const file = join(directory, name);
  let info;
  try { info = await lstat(file); } catch (error) {
    if (optional && error.code === "ENOENT") return null;
    throw new Error(`Required episode file is missing: ${file}`, { cause: error });
  }
  if (info.isSymbolicLink()) throw new Error(`Episode file must not be a symbolic link: ${file}`);
  if (!info.isFile() || info.size < 1 || info.size > maxBytes) {
    throw new Error(`Episode file must be a non-empty regular file of at most ${maxBytes} bytes: ${file}`);
  }
  return file;
}

async function textFile(directory, name) {
  return readFile(await regularFile(directory, name), "utf8");
}

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
}

export function validateEpisodeManifest(manifest, fileName) {
  object(manifest, fileName);
  for (const key of Object.keys(manifest)) {
    if (!MANIFEST_FIELDS.has(key)) throw new Error(`Unknown episode manifest field: ${key} (${fileName}).`);
  }
  if (manifest.schemaVersion !== 1) throw new Error(`${fileName}: episode schemaVersion must be 1.`);
  if (!EPISODE_LEVELS.includes(manifest.level)) throw new Error(`${fileName}: level must be ${EPISODE_LEVELS.join(", ")}.`);
  if (manifest.audioFile !== "audio.mp3") throw new Error(`${fileName}: audioFile must be audio.mp3.`);
  if (!/^cover\.(?:jpg|jpeg|png|webp)$/u.test(manifest.imageFile)) throw new Error(`${fileName}: imageFile must be cover.jpg, cover.png or cover.webp.`);
  if (manifest.sources !== undefined) {
    object(manifest.sources, "sources");
    const allowed = new Set(["audioUrl", "imageUrl", "transcriptUrl", "vocabularyUrl", "attribution", "retrievedAt"]);
    for (const [key, value] of Object.entries(manifest.sources)) {
      if (!allowed.has(key) || typeof value !== "string" || !value.trim() || value.length > 2_000) {
        throw new Error(`${fileName}: invalid sources.${key}.`);
      }
      if (key.endsWith("Url") && !/^https:\/\//u.test(value)) throw new Error(`${fileName}: sources.${key} must be HTTPS.`);
    }
  }
}

async function validateMedia(directory, manifest, requireAudio) {
  const image = await readFile(await regularFile(directory, manifest.imageFile, { maxBytes: 10_000_000 }));
  const extension = manifest.imageFile.split(".").at(-1);
  const valid = extension === "png" ? image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : extension === "webp" ? image.toString("ascii", 0, 4) === "RIFF" && image.toString("ascii", 8, 12) === "WEBP"
      : image[0] === 255 && image[1] === 216 && image[2] === 255;
  if (!valid) throw new Error(`Invalid episode image content: ${join(directory, manifest.imageFile)}`);
  const audio = await regularFile(directory, "audio.mp3", { optional: !requireAudio, maxBytes: 100_000_000 });
  if (audio) {
    const bytes = await readFile(audio);
    if (bytes.toString("ascii", 0, 3) !== "ID3" && !(bytes[0] === 255 && (bytes[1] & 224) === 224)) {
      throw new Error(`Invalid MP3 content: ${audio}`);
    }
  }
}

export async function loadListeningEpisodeSources(root = listeningEpisodesDirectory(), { requireAudio = false, episodeFolder = null } = {}) {
  const directory = root instanceof URL ? fileURLToPath(root) : resolve(root);
  const entries = await readdir(directory, { withFileTypes: true });
  if (episodeFolder !== null && !EPISODE_DIRECTORY_PATTERN.test(episodeFolder)) throw new Error("Invalid selected episode folder.");
  const folders = entries.filter((entry) => (entry.isDirectory() || entry.isSymbolicLink()) && (episodeFolder === null || entry.name === episodeFolder)).sort((a, b) => a.name.localeCompare(b.name, "en"));
  if (!folders.length) throw new Error(`No episode directories found in ${directory}. Check the deployment volume.`);
  const ids = new Set(); const slugs = new Set(); const sources = [];
  const parser = new VocabularyFileParser();
  for (const folder of folders) {
    if (folder.isSymbolicLink()) throw new Error(`Episode directory must not be a symbolic link: ${folder.name}`);
    if (folder.name.length > 160 || !EPISODE_DIRECTORY_PATTERN.test(folder.name)) throw new Error(`Invalid episode directory name: ${folder.name}`);
    const episodeDirectory = join(directory, folder.name);
    const manifest = JSON.parse(await textFile(episodeDirectory, "episode.json"));
    validateEpisodeManifest(manifest, `${folder.name}/episode.json`);
    if (!folder.name.startsWith(`${manifest.episodeDate}-`)) throw new Error(`Episode directory date must match episodeDate: ${folder.name}`);
    const listening = JSON.parse(await textFile(episodeDirectory, "listening.json"));
    object(listening, "listening.json");
    if (Object.keys(listening).some((key) => !["schemaVersion", "tests"].includes(key))) throw new Error("Unknown listening.json field.");
    if (listening.schemaVersion !== 2 || !Array.isArray(listening.tests) || !listening.tests.length) throw new Error(`${folder.name}: at least one schemaVersion 2 test is required.`);
    for (const test of listening.tests) {
      if (test.format !== "ielts") throw new Error(`${folder.name}: test format must be ielts (IELTS-style practice, not an official exam).`);
      if (!TEST_DIFFICULTIES.includes(test.difficulty)) throw new Error(`${folder.name}: invalid test difficulty.`);
    }
    const definition = parseListeningLessonDefinition({ ...manifest, schemaVersion: 2, tests: listening.tests }, folder.name);
    if (ids.has(definition.publicId) || slugs.has(`${definition.provider}:${definition.slug}`)) throw new Error(`Duplicate episode identity or slug: ${folder.name}`);
    ids.add(definition.publicId); slugs.add(`${definition.provider}:${definition.slug}`);
    definition.level = manifest.level;
    definition.assetDirectory = folder.name;
    definition.imageFile = manifest.imageFile;
    definition.audioFile = manifest.audioFile;
    definition.vocabularyCollectionId = definition.publicId;
    definition.tests = definition.tests.map((test, index) => ({ ...test, format: "ielts", difficulty: listening.tests[index].difficulty }));
    // This file is intentionally never read into a definition, source hash, or database payload.
    await regularFile(episodeDirectory, "transcript.md");
    const parsed = parser.parse(await textFile(episodeDirectory, "vocabulary.md"), { requireStructured: true });
    if (!parsed.entries.length || parsed.entries.some((entry) => !entry.definitions.length || !entry.examples.length)) {
      throw new Error(`${folder.name}: every vocabulary item needs a definition and at least one example.`);
    }
    await validateMedia(episodeDirectory, manifest, requireAudio);
    const description = `Vocabulary from ${definition.title}. ${definition.description || ""}`.trim();
    const sourceHash = createHash("sha256").update(JSON.stringify({
      vocabulary: collectionSourceHash(parsed), description, status: definition.status, fileName: `${folder.name}/vocabulary.md`
    })).digest("hex");
    sources.push({
      definition,
      collection: {
        fileName: `listening/episodes/${folder.name}/vocabulary.md`,
        slug: `podcast-${definition.publicId}`,
        publicId: definition.publicId,
        kind: "collection",
        isDefault: false,
        status: definition.status,
        description,
        sourceItemCount: parsed.entries.length,
        duplicateAliasCount: 0,
        trackExamples: true,
        sourceHash,
        parsed
      }
    });
  }
  return sources;
}
