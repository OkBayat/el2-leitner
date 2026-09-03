import { loadCuratedSentenceCatalog } from "../../sentence-practice/CuratedSentenceCatalog.js";

const INSERT_BATCH_SIZE = 250;
const CURATED_SOURCE_ITEM_COUNT = 3_766;

async function activeSentenceTexts(executor) {
  const [rows] = await executor.execute(
    `SELECT sentence_text
     FROM sentences
     WHERE status = 'active'`
  );
  return new Set(rows.map((row) => String(row.sentence_text)));
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
  const values = batch.map(() => "(?, 'active')").join(",\n");
  return `INSERT INTO sentences (sentence_text, status)
          VALUES ${values}`;
}

export async function seedSentenceCatalog({ pool, sentences }) {
  const expected = uniqueSentenceTexts(sentences);
  const current = await activeSentenceTexts(pool);
  const missing = expected.filter((sentenceText) => !current.has(sentenceText));

  if (!missing.length) {
    return { changed: false, sentenceCount: expected.length, insertedCount: 0 };
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (let offset = 0; offset < missing.length; offset += INSERT_BATCH_SIZE) {
      const batch = missing.slice(offset, offset + INSERT_BATCH_SIZE);
      await connection.execute(insertStatement(batch), batch);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const verified = await activeSentenceTexts(pool);
  const missingAfterWrite = expected.filter((sentenceText) => !verified.has(sentenceText));
  if (missingAfterWrite.length) {
    throw new Error(
      `Curated sentence catalog verification failed: ${missingAfterWrite.length} sentence(s) are still missing.`
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
