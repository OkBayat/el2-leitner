import { createHash } from "node:crypto";

import { loadCuratedSentenceCatalog } from "../../sentence-practice/CuratedSentenceCatalog.js";

const INSERT_BATCH_SIZE = 250;
const CURATED_SOURCE_ITEM_COUNT = 3_766;

function sentenceHash(sentenceText) {
  return createHash("sha256").update(sentenceText, "utf8").digest("hex");
}

async function activeSentenceRows(executor) {
  const [rows] = await executor.execute(
    `SELECT sentence_text, is_curated, status
     FROM sentences`
  );
  return new Map(rows.map((row) => [
    String(row.sentence_text),
    {
      isCurated: Boolean(Number(row.is_curated)),
      status: String(row.status)
    }
  ]));
}

function uniqueSentenceTexts(sentences) {
  if (!Array.isArray(sentences)) throw new Error("Sentence seed must be an array of sentence texts.");
  const seen = new Set();
  const unique = [];
  for (const value of sentences) {
    const sentenceText = String(value ?? "").trim();
    if (!sentenceText || seen.has(sentenceText)) continue;
    seen.add(sentenceText);
    unique.push(sentenceText);
  }
  if (!unique.length) throw new Error("Sentence seed is empty.");
  return unique;
}

function insertStatement(batch) {
  const values = batch.map(() => "(?, ?, 'active', TRUE)").join(",\n");
  return `INSERT INTO sentences (sentence_text, sentence_hash, status, is_curated)
          VALUES ${values}`;
}

function updateStatement(batch) {
  const placeholders = batch.map(() => "?").join(",");
  return `UPDATE sentences
          SET is_curated = TRUE, status = 'active'
          WHERE sentence_text IN (${placeholders})`;
}

export async function seedSentenceCatalog({ pool, sentences }) {
  const expected = uniqueSentenceTexts(sentences);
  const current = await activeSentenceRows(pool);
  const missing = expected.filter((sentenceText) => !current.has(sentenceText));
  const needsRefresh = expected.filter((sentenceText) => {
    const row = current.get(sentenceText);
    return row && (!row.isCurated || row.status !== "active");
  });

  if (!missing.length && !needsRefresh.length) {
    return { changed: false, sentenceCount: expected.length, insertedCount: 0 };
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (let offset = 0; offset < missing.length; offset += INSERT_BATCH_SIZE) {
      const batch = missing.slice(offset, offset + INSERT_BATCH_SIZE);
      const params = batch.flatMap((sentenceText) => [sentenceText, sentenceHash(sentenceText)]);
      await connection.execute(insertStatement(batch), params);
    }

    for (let offset = 0; offset < needsRefresh.length; offset += INSERT_BATCH_SIZE) {
      const batch = needsRefresh.slice(offset, offset + INSERT_BATCH_SIZE);
      await connection.execute(updateStatement(batch), batch);
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const verified = await activeSentenceRows(pool);
  const missingAfterWrite = expected.filter((sentenceText) => {
    const row = verified.get(sentenceText);
    return !row || !row.isCurated || row.status !== "active";
  });
  if (missingAfterWrite.length) {
    throw new Error(
      `Curated sentence catalog verification failed: ${missingAfterWrite.length} sentence(s) are still missing or inactive.`
    );
  }

  return { changed: true, sentenceCount: expected.length, insertedCount: missing.length };
}

// Compatibility entry point for database setup code created earlier in this PR.
// sourceText/source metadata are intentionally ignored: imported-book template generation is no longer a seed source.
export async function seedSentencePractice({ pool }) {
  const sentences = await loadCuratedSentenceCatalog();
  const result = await seedSentenceCatalog({ pool, sentences });
  return {
    ...result,
    sourceKey: "curated-sentence-catalog-v2",
    sourceItemCount: CURATED_SOURCE_ITEM_COUNT,
  };
}

export async function seedSentenceSources({ pool }) {
  const result = await seedSentencePractice({ pool });
  return {
    changed: result.changed,
    sourceItemCount: result.sourceItemCount,
    sentenceCount: result.sentenceCount,
    insertedCount: result.insertedCount,
    results: [result],
  };
}
