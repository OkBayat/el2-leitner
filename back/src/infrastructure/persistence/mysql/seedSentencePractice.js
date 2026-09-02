import { createHash } from "node:crypto";

import {
  EXPECTED_SENTENCE_SOURCE_ITEMS,
  SENTENCE_CORPUS_SOURCE,
  SENTENCE_CORPUS_VERSION,
  SENTENCES_PER_SOURCE_ITEM,
  buildSentenceCorpus,
} from "../../../domain/sentence-practice/SentenceCorpus.js";
import { IELTS_COLLECTION_ID } from "./seedBuiltInLibrary.js";

const INSERT_BATCH_SIZE = 250;

function corpusHash(sourceText) {
  return createHash("sha256")
    .update(SENTENCE_CORPUS_VERSION, "utf8")
    .update("\0", "utf8")
    .update(sourceText, "utf8")
    .digest("hex");
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

async function currentCorpusState(pool, sourceHash) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS total,
            COUNT(DISTINCT source_item_number) AS source_items,
            COUNT(DISTINCT source_hash) AS source_hashes,
            MAX(source_hash) AS source_hash,
            SUM(status = 'active') AS active_total
     FROM vocabulary_sentences
     WHERE source_key = ?`,
    [SENTENCE_CORPUS_SOURCE]
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
    },
  };
}

async function vocabularyIdsByNormalizedForm(pool) {
  const [rows] = await pool.execute(
    `SELECT ve.id AS vocabulary_entry_id, vf.normalized_form
     FROM collections c
     JOIN collection_entries ce
       ON ce.collection_id = c.id
      AND ce.removed_at IS NULL
     JOIN vocabulary_entries ve
       ON ve.id = ce.vocabulary_entry_id
      AND ve.status = 'active'
     JOIN vocabulary_forms vf
       ON vf.vocabulary_entry_id = ve.id
     WHERE c.public_id = ?`,
    [IELTS_COLLECTION_ID]
  );
  const result = new Map();
  for (const row of rows) {
    if (!result.has(row.normalized_form)) {
      result.set(row.normalized_form, String(row.vocabulary_entry_id));
    }
  }
  return result;
}

function resolveVocabularyEntries(records, vocabularyIds) {
  const unresolved = [];
  const resolved = records.map((record) => {
    const vocabularyEntryId = record.normalizedForms
      .map((form) => vocabularyIds.get(form))
      .find(Boolean);
    if (!vocabularyEntryId) unresolved.push(`${record.sourceItemNumber}: ${record.answerText}`);
    return { ...record, vocabularyEntryId };
  });
  if (unresolved.length) {
    const preview = unresolved.slice(0, 10).join(", ");
    throw new Error(
      `Sentence corpus could not resolve ${unresolved.length} source item(s) to vocabulary entries: ${preview}`
    );
  }
  return resolved;
}

function insertStatement(batch) {
  const columns = [
    "vocabulary_entry_id",
    "source_key",
    "source_item_number",
    "variant_number",
    "category",
    "sentence_text",
    "answer_text",
    "source_hash",
    "status",
  ];
  const values = batch.map(() => `(${columns.map(() => "?").join(", ")})`).join(",\n");
  return `INSERT INTO vocabulary_sentences (${columns.join(", ")})
          VALUES ${values}
          ON DUPLICATE KEY UPDATE
            vocabulary_entry_id = VALUES(vocabulary_entry_id),
            category = VALUES(category),
            sentence_text = VALUES(sentence_text),
            answer_text = VALUES(answer_text),
            source_hash = VALUES(source_hash),
            status = 'active',
            updated_at = CURRENT_TIMESTAMP(3)`;
}

function insertParameters(batch, sourceHash) {
  return batch.flatMap((record) => [
    record.vocabularyEntryId,
    SENTENCE_CORPUS_SOURCE,
    record.sourceItemNumber,
    record.variantNumber,
    record.category,
    record.sentenceText,
    record.answerText,
    sourceHash,
    "active",
  ]);
}

export async function seedSentencePractice({ pool, sourceText }) {
  const corpus = buildSentenceCorpus(sourceText);
  if (corpus.sourceItemCount !== EXPECTED_SENTENCE_SOURCE_ITEMS) {
    throw new Error(
      `Sentence corpus must cover exactly ${EXPECTED_SENTENCE_SOURCE_ITEMS} source items; found ${corpus.sourceItemCount}.`
    );
  }
  const expectedSentenceCount = corpus.sourceItemCount * SENTENCES_PER_SOURCE_ITEM;
  if (corpus.sentenceCount !== expectedSentenceCount) {
    throw new Error(
      `Sentence corpus generation failed: expected ${expectedSentenceCount}, generated ${corpus.sentenceCount}.`
    );
  }

  const sourceHash = corpusHash(sourceText);
  const current = await currentCorpusState(pool, sourceHash);
  if (current.matches(corpus.sourceItemCount, corpus.sentenceCount)) {
    return {
      changed: false,
      sourceHash,
      sourceItemCount: corpus.sourceItemCount,
      sentenceCount: corpus.sentenceCount,
    };
  }

  const vocabularyIds = await vocabularyIdsByNormalizedForm(pool);
  const resolved = resolveVocabularyEntries(corpus.records, vocabularyIds);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (let offset = 0; offset < resolved.length; offset += INSERT_BATCH_SIZE) {
      const batch = resolved.slice(offset, offset + INSERT_BATCH_SIZE);
      await connection.execute(insertStatement(batch), insertParameters(batch, sourceHash));
    }
    await connection.execute(
      `DELETE FROM vocabulary_sentences
       WHERE source_key = ? AND source_hash <> ?`,
      [SENTENCE_CORPUS_SOURCE, sourceHash]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const verified = await currentCorpusState(pool, sourceHash);
  if (!verified.matches(corpus.sourceItemCount, corpus.sentenceCount)) {
    throw new Error(
      `Sentence corpus verification failed: expected ${corpus.sourceItemCount} source items and ${corpus.sentenceCount} sentences; found ${verified.sourceItems} and ${verified.total}.`
    );
  }

  return {
    changed: true,
    sourceHash,
    sourceItemCount: corpus.sourceItemCount,
    sentenceCount: corpus.sentenceCount,
  };
}
