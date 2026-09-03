import { createHash } from "node:crypto";

import {
  EXPECTED_SENTENCE_SOURCE_ITEMS,
  SENTENCE_CORPUS_SOURCE,
  SENTENCE_CORPUS_VERSION,
  SENTENCES_PER_SOURCE_ITEM,
  buildSentenceCorpus
} from "../../../domain/sentence-practice/SentenceCorpus.js";

const INSERT_BATCH_SIZE = 250;

function corpusHash(sourceText, sourceVersion) {
  return createHash("sha256")
    .update(sourceVersion, "utf8")
    .update("\0", "utf8")
    .update(sourceText, "utf8")
    .digest("hex");
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

async function currentCorpusState(pool, sourceKey, sourceHash) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS total,
            COUNT(DISTINCT source_item_number) AS source_items,
            COUNT(DISTINCT source_hash) AS source_hashes,
            MAX(source_hash) AS source_hash,
            SUM(status = 'active') AS active_total
     FROM sentences
     WHERE source_key = ?`,
    [sourceKey]
  );
  const row = rows[0] ?? {};
  return {
    total: asNumber(row.total),
    sourceItems: asNumber(row.source_items),
    sourceHashes: asNumber(row.source_hashes),
    sourceHash: row.source_hash ?? null,
    activeTotal: asNumber(row.active_total),
    matches(sourceItemCount, sentenceCount) {
      return this.total === sentenceCount
        && this.activeTotal === sentenceCount
        && this.sourceItems === sourceItemCount
        && this.sourceHashes === 1
        && this.sourceHash === sourceHash;
    }
  };
}

function insertStatement(batch) {
  const columns = [
    "language_code",
    "source_key",
    "source_item_number",
    "variant_number",
    "category",
    "sentence_text",
    "source_hash",
    "status"
  ];
  const values = batch.map(() => `(${columns.map(() => "?").join(", ")})`).join(",\n");
  return `INSERT INTO sentences (${columns.join(", ")})
          VALUES ${values}
          ON DUPLICATE KEY UPDATE
            language_code = VALUES(language_code),
            category = VALUES(category),
            sentence_text = VALUES(sentence_text),
            source_hash = VALUES(source_hash),
            status = 'active',
            updated_at = CURRENT_TIMESTAMP(3)`;
}

function insertParameters(batch, sourceKey, sourceHash) {
  return batch.flatMap((record) => [
    "en",
    sourceKey,
    record.sourceItemNumber,
    record.variantNumber,
    record.category,
    record.sentenceText,
    sourceHash,
    "active"
  ]);
}

export async function seedSentencePractice({
  pool,
  sourceText,
  sourceKey = SENTENCE_CORPUS_SOURCE,
  sourceVersion = SENTENCE_CORPUS_VERSION,
  expectedSourceItems = EXPECTED_SENTENCE_SOURCE_ITEMS,
}) {
  const corpus = buildSentenceCorpus(sourceText);
  if (corpus.sourceItemCount !== expectedSourceItems) {
    throw new Error(
      `Sentence corpus ${sourceKey} must cover exactly ${expectedSourceItems} source items; found ${corpus.sourceItemCount}.`
    );
  }
  const expectedSentenceCount = corpus.sourceItemCount * SENTENCES_PER_SOURCE_ITEM;
  if (corpus.sentenceCount !== expectedSentenceCount) {
    throw new Error(
      `Sentence corpus generation failed for ${sourceKey}: expected ${expectedSentenceCount}, generated ${corpus.sentenceCount}.`
    );
  }

  const sourceHash = corpusHash(sourceText, sourceVersion);
  const current = await currentCorpusState(pool, sourceKey, sourceHash);
  if (current.matches(corpus.sourceItemCount, corpus.sentenceCount)) {
    return {
      changed: false,
      sourceKey,
      sourceHash,
      sourceItemCount: corpus.sourceItemCount,
      sentenceCount: corpus.sentenceCount
    };
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (let offset = 0; offset < corpus.records.length; offset += INSERT_BATCH_SIZE) {
      const batch = corpus.records.slice(offset, offset + INSERT_BATCH_SIZE);
      await connection.execute(
        insertStatement(batch),
        insertParameters(batch, sourceKey, sourceHash)
      );
    }
    await connection.execute(
      `DELETE FROM sentences
       WHERE source_key = ? AND source_hash <> ?`,
      [sourceKey, sourceHash]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const verified = await currentCorpusState(pool, sourceKey, sourceHash);
  if (!verified.matches(corpus.sourceItemCount, corpus.sentenceCount)) {
    throw new Error(
      `Sentence corpus verification failed for ${sourceKey}: expected ${corpus.sourceItemCount} source items and ${corpus.sentenceCount} sentences; found ${verified.sourceItems} and ${verified.total}.`
    );
  }

  return {
    changed: true,
    sourceKey,
    sourceHash,
    sourceItemCount: corpus.sourceItemCount,
    sentenceCount: corpus.sentenceCount
  };
}

export async function seedSentenceSources({ pool, sources }) {
  const results = [];
  for (const source of sources) {
    results.push(await seedSentencePractice({
      pool,
      sourceText: source.sourceText,
      sourceKey: source.key,
      sourceVersion: source.version,
      expectedSourceItems: source.expectedSourceItems,
    }));
  }
  return {
    changed: results.some((result) => result.changed),
    sourceItemCount: results.reduce((total, result) => total + result.sourceItemCount, 0),
    sentenceCount: results.reduce((total, result) => total + result.sentenceCount, 0),
    results,
  };
}
