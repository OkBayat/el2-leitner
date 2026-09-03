import {
  EXPECTED_SENTENCE_SOURCE_ITEMS,
  SENTENCE_CORPUS_SOURCE,
  SENTENCE_CORPUS_VERSION,
  SENTENCES_PER_SOURCE_ITEM,
  buildSentenceCorpus
} from "../../../domain/sentence-practice/SentenceCorpus.js";

const INSERT_BATCH_SIZE = 250;

async function activeSentenceTexts(executor) {
  const [rows] = await executor.execute(
    `SELECT sentence_text
     FROM sentences
     WHERE status = 'active'`
  );
  return new Set(rows.map((row) => String(row.sentence_text)));
}

function uniqueSentenceRecords(records) {
  const seen = new Set();
  const unique = [];
  for (const record of records) {
    if (seen.has(record.sentenceText)) continue;
    seen.add(record.sentenceText);
    unique.push(record);
  }
  return unique;
}

function insertStatement(batch) {
  const values = batch.map(() => "(?, 'active')").join(",\n");
  return `INSERT INTO sentences (sentence_text, status)
          VALUES ${values}`;
}

export async function seedSentencePractice({
  pool,
  sourceText,
  sourceKey = SENTENCE_CORPUS_SOURCE,
  sourceVersion = SENTENCE_CORPUS_VERSION,
  expectedSourceItems = EXPECTED_SENTENCE_SOURCE_ITEMS,
}) {
  void sourceVersion;
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

  const uniqueRecords = uniqueSentenceRecords(corpus.records);
  const current = await activeSentenceTexts(pool);
  const missing = uniqueRecords.filter((record) => !current.has(record.sentenceText));
  if (!missing.length) {
    return {
      changed: false,
      sourceKey,
      sourceItemCount: corpus.sourceItemCount,
      sentenceCount: corpus.sentenceCount,
      uniqueSentenceCount: uniqueRecords.length,
      insertedCount: 0
    };
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (let offset = 0; offset < missing.length; offset += INSERT_BATCH_SIZE) {
      const batch = missing.slice(offset, offset + INSERT_BATCH_SIZE);
      await connection.execute(
        insertStatement(batch),
        batch.map((record) => record.sentenceText)
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const verified = await activeSentenceTexts(pool);
  const missingAfterWrite = uniqueRecords.filter((record) => !verified.has(record.sentenceText));
  if (missingAfterWrite.length) {
    throw new Error(
      `Sentence corpus verification failed for ${sourceKey}: ${missingAfterWrite.length} expected sentence(s) are still missing.`
    );
  }

  return {
    changed: true,
    sourceKey,
    sourceItemCount: corpus.sourceItemCount,
    sentenceCount: corpus.sentenceCount,
    uniqueSentenceCount: uniqueRecords.length,
    insertedCount: missing.length
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
    insertedCount: results.reduce((total, result) => total + result.insertedCount, 0),
    results,
  };
}
