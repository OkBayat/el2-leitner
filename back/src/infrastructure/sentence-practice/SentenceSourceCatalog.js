import { readFile } from "node:fs/promises";
import { gunzip } from "node:zlib";
import { promisify } from "node:util";

const gunzipAsync = promisify(gunzip);

export const SENTENCE_SOURCE_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: "ielts-listening-core-1500",
    label: "IELTS Listening Core 1500",
    version: "2026-09-03.2",
    expectedSourceItems: 1_500,
    url: new URL("../../../../ui/data/IELTS_Listening_Core_1500.md", import.meta.url),
    compressed: false,
  }),
  Object.freeze({
    key: "cambridge-vocabulary-for-ielts",
    label: "Cambridge Vocabulary for IELTS",
    version: "2026-09-03.2",
    expectedSourceItems: 1_177,
    url: new URL("../../../data/sentence-sources/cambridge-vocabulary-for-ielts.md.gz", import.meta.url),
    compressed: true,
  }),
  Object.freeze({
    key: "american-english-file-3-core-vocabulary",
    label: "American English File 3 Core Vocabulary",
    version: "2026-09-03.2",
    expectedSourceItems: 542,
    url: new URL("../../../data/sentence-sources/american-english-file-3-core-vocabulary.md.gz", import.meta.url),
    compressed: true,
  }),
  Object.freeze({
    key: "cambridge-vocabulary-for-ielts-advanced",
    label: "Cambridge Vocabulary for IELTS Advanced",
    version: "2026-09-03.2",
    expectedSourceItems: 547,
    url: new URL("../../../data/sentence-sources/cambridge-vocabulary-for-ielts-advanced.md.gz", import.meta.url),
    compressed: true,
  }),
]);

export async function loadSentenceSource(definition) {
  const bytes = await readFile(definition.url);
  const sourceText = definition.compressed
    ? (await gunzipAsync(bytes)).toString("utf8")
    : bytes.toString("utf8");
  return { ...definition, sourceText };
}

export async function loadSentenceSources() {
  return Promise.all(SENTENCE_SOURCE_DEFINITIONS.map(loadSentenceSource));
}
