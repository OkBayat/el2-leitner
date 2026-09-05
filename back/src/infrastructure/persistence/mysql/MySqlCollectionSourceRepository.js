import { createHash, randomUUID } from "node:crypto";

import {
  cleanVocabularyForms,
  publicCanonicalKey
} from "../../../domain/library/VocabularyNormalizer.js";

const COLLECTION_SOURCE_FORMAT_VERSION = 2;

function sentenceHash(sentenceText) {
  return createHash("sha256").update(sentenceText, "utf8").digest("hex");
}

function idPlaceholders(ids) {
  return [...ids].map(() => "?").join(",");
}

export class MySqlCollectionSourceRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async sync(source, { connection: suppliedConnection = null } = {}) {
    const connection = suppliedConnection || await this.pool.getConnection();
    const desiredStatus = source.status || "published";
    try {
      if (!suppliedConnection) await connection.beginTransaction();
      const collection = await this.#ensureCollection(connection, source);
      if (
        collection.source_hash === source.sourceHash
        && collection.status === desiredStatus
        && (desiredStatus === "archived" ? collection.archived_at !== null : collection.archived_at === null)
      ) {
        if (!suppliedConnection) await connection.commit();
        return {
          changed: false,
          slug: source.slug,
          title: source.parsed.title,
          version: Number(collection.content_version),
          words: source.parsed.entries.length,
          definitions: source.parsed.entries.reduce((sum, entry) => sum + entry.definitions.length, 0),
          examples: source.parsed.entries.reduce((sum, entry) => sum + entry.examples.length, 0)
        };
      }

      const nextVersion = Number(collection.content_version) + 1;
      const sectionIds = await this.#syncSections(connection, collection.id, source.parsed.sections);
      const seenVocabularyIds = new Set();
      const usedSectionIds = new Set();
      const staleFormIds = new Set();
      const staleSentenceIds = new Set();
      let definitions = 0;
      let examples = 0;

      for (const item of source.parsed.entries) {
        const vocabulary = await this.#resolveVocabulary(
          connection,
          item.primaryForm,
          item.acceptedForms
        );
        seenVocabularyIds.add(String(vocabulary.id));
        const sectionId = sectionIds.get(item.sectionPath);
        if (!sectionId) {
          throw new Error(`Collection source references unknown lesson: ${item.sectionPath}`);
        }
        usedSectionIds.add(String(sectionId));

        const collectionEntryId = await this.#upsertCollectionEntry(connection, {
          collectionId: collection.id,
          vocabulary,
          item,
          sectionId,
          nextVersion
        });

        await this.#syncEntryForms(
          connection,
          collectionEntryId,
          vocabulary.forms,
          staleFormIds
        );

        await connection.execute(
          "DELETE FROM collection_entry_definitions WHERE collection_entry_id = ?",
          [collectionEntryId]
        );
        for (const [index, definition] of item.definitions.entries()) {
          await connection.execute(
            `INSERT INTO collection_entry_definitions
               (public_id, collection_entry_id, language_code, definition_text, position)
             VALUES (?, ?, 'en', ?, ?)`,
            [randomUUID(), collectionEntryId, definition, index + 1]
          );
          definitions += 1;
        }

        await this.#syncEntryExamples(
          connection,
          collectionEntryId,
          vocabulary.id,
          item.examples,
          staleSentenceIds,
          Boolean(source.trackExamples)
        );
        examples += item.examples.length;
      }

      const [activeRows] = await connection.execute(
        "SELECT id, vocabulary_entry_id FROM collection_entries WHERE collection_id = ? AND removed_at IS NULL",
        [collection.id]
      );
      let removed = 0;
      for (const row of activeRows) {
        if (seenVocabularyIds.has(String(row.vocabulary_entry_id))) continue;
        await this.#clearEntrySourceReferences(
          connection,
          row.id,
          staleFormIds,
          staleSentenceIds
        );
        await connection.execute(
          "DELETE FROM collection_entry_definitions WHERE collection_entry_id = ?",
          [row.id]
        );
        await connection.execute(
          `UPDATE collection_entries
           SET removed_at = CURRENT_TIMESTAMP(3), removed_version = ?
           WHERE id = ? AND removed_at IS NULL`,
          [nextVersion, row.id]
        );
        removed += 1;
      }

      await this.#removeUnusedSections(connection, collection.id, usedSectionIds);
      await connection.execute(
        `UPDATE collections
         SET title = ?, description = ?, kind = ?, visibility = 'public', status = 'published',
             source_hash = ?, content_version = ?, is_default = ?, archived_at = NULL,
             published_at = COALESCE(published_at, CURRENT_TIMESTAMP(3)),
             metadata_json = JSON_SET(
               COALESCE(metadata_json, JSON_OBJECT()),
               '$.sourceFile', ?,
               '$.sourceFormatVersion', CAST(? AS UNSIGNED),
               '$.sourceItemCount', CAST(? AS UNSIGNED),
               '$.uniqueVocabularyCount', CAST(? AS UNSIGNED),
               '$.duplicateAliasCount', CAST(? AS UNSIGNED),
               '$.definitionCount', CAST(? AS UNSIGNED),
               '$.exampleReferenceCount', CAST(? AS UNSIGNED)
             )
         WHERE id = ?`,
        [
          source.parsed.title,
          source.description,
          source.kind,
          source.sourceHash,
          nextVersion,
          source.isDefault ? 1 : 0,
          source.fileName,
          COLLECTION_SOURCE_FORMAT_VERSION,
          source.sourceItemCount,
          source.parsed.entries.length,
          source.duplicateAliasCount,
          definitions,
          examples,
          collection.id
        ]
      );

      if (desiredStatus !== "published") {
        await connection.execute(
          "UPDATE collections SET status = ?, archived_at = CASE WHEN ? = 'archived' THEN CURRENT_TIMESTAMP(3) ELSE NULL END WHERE id = ?",
          [desiredStatus, desiredStatus, collection.id]
        );
      }
      await this.#cleanupStaleForms(connection, staleFormIds);
      await this.#cleanupStaleSentences(connection, staleSentenceIds);
      await this.#bumpSubscriberRevisions(connection, collection.id);
      if (!suppliedConnection) await connection.commit();

      return {
        changed: true,
        slug: source.slug,
        title: source.parsed.title,
        version: nextVersion,
        words: source.parsed.entries.length,
        definitions,
        examples,
        removed
      };
    } catch (error) {
      if (!suppliedConnection) await connection.rollback();
      throw error;
    } finally {
      if (!suppliedConnection) connection.release();
    }
  }

  async archiveMissing(activeSlugs) {
    const active = new Set(activeSlugs.map((slug) => String(slug)));
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute(
        `SELECT id, slug, content_version
         FROM collections
         WHERE archived_at IS NULL
           AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.sourceFile')) IS NOT NULL
           AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.sourceFile')) NOT LIKE '%/%'
         FOR UPDATE`
      );

      const staleFormIds = new Set();
      const staleSentenceIds = new Set();
      const archivedSlugs = [];

      for (const collection of rows) {
        if (active.has(String(collection.slug))) continue;
        const nextVersion = Number(collection.content_version) + 1;
        const [entries] = await connection.execute(
          `SELECT id
           FROM collection_entries
           WHERE collection_id = ? AND removed_at IS NULL
           FOR UPDATE`,
          [collection.id]
        );

        for (const entry of entries) {
          await this.#clearEntrySourceReferences(
            connection,
            entry.id,
            staleFormIds,
            staleSentenceIds
          );
          await connection.execute(
            "DELETE FROM collection_entry_definitions WHERE collection_entry_id = ?",
            [entry.id]
          );
        }

        await connection.execute(
          `UPDATE collection_entries
           SET removed_at = CURRENT_TIMESTAMP(3), removed_version = ?
           WHERE collection_id = ? AND removed_at IS NULL`,
          [nextVersion, collection.id]
        );
        await connection.execute(
          "DELETE FROM collection_sections WHERE collection_id = ?",
          [collection.id]
        );
        await connection.execute(
          `UPDATE collections
           SET status = 'archived',
               archived_at = CURRENT_TIMESTAMP(3),
               is_default = FALSE,
               source_hash = NULL,
               content_version = ?
           WHERE id = ?`,
          [nextVersion, collection.id]
        );
        await this.#bumpSubscriberRevisions(connection, collection.id);
        archivedSlugs.push(String(collection.slug));
      }

      await this.#cleanupStaleForms(connection, staleFormIds);
      await this.#cleanupStaleSentences(connection, staleSentenceIds);
      await connection.commit();

      return {
        archivedCount: archivedSlugs.length,
        archivedSlugs
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async finalize() {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      const [orphanSentenceRows] = await connection.execute(
        `SELECT DISTINCT sve.sentence_id
         FROM sentence_vocabulary_entries sve
         WHERE NOT EXISTS (
           SELECT 1
           FROM collection_entry_examples cee
           JOIN collection_entries ce
             ON ce.id = cee.collection_entry_id
            AND ce.removed_at IS NULL
           WHERE cee.sentence_id = sve.sentence_id
             AND ce.vocabulary_entry_id = sve.vocabulary_entry_id
         )`
      );
      const staleSentenceIds = new Set(
        orphanSentenceRows.map((row) => String(row.sentence_id))
      );

      if (staleSentenceIds.size) {
        const ids = [...staleSentenceIds];
        await connection.execute(
          `DELETE sve
           FROM sentence_vocabulary_entries sve
           WHERE sve.sentence_id IN (${idPlaceholders(ids)})
             AND NOT EXISTS (
               SELECT 1
               FROM collection_entry_examples cee
               JOIN collection_entries ce
                 ON ce.id = cee.collection_entry_id
                AND ce.removed_at IS NULL
               WHERE cee.sentence_id = sve.sentence_id
                 AND ce.vocabulary_entry_id = sve.vocabulary_entry_id
             )`,
          ids
        );
      }

      await this.#cleanupStaleSentences(connection, staleSentenceIds);
      const [formCleanupResult] = await connection.execute(
        `DELETE vf
         FROM vocabulary_forms vf
         WHERE vf.is_primary = FALSE
           AND NOT EXISTS (
             SELECT 1
             FROM collection_entry_forms cef
             JOIN collection_entries ce
               ON ce.id = cef.collection_entry_id
              AND ce.removed_at IS NULL
             WHERE cef.vocabulary_form_id = vf.id
           )
           AND NOT EXISTS (
             SELECT 1
             FROM collection_entries ce
             JOIN collections c ON c.id = ce.collection_id
             WHERE ce.vocabulary_entry_id = vf.vocabulary_entry_id
               AND ce.removed_at IS NULL
               AND JSON_UNQUOTE(JSON_EXTRACT(c.metadata_json, '$.sourceFile')) IS NULL
           )`
      );

      await connection.commit();
      return {
        orphanSentenceLinksRemoved: staleSentenceIds.size,
        orphanFormsRemoved: Number(formCleanupResult?.affectedRows ?? 0)
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async #ensureCollection(connection, source) {
    const [rows] = await connection.execute(
      "SELECT * FROM collections WHERE slug = ? LIMIT 1 FOR UPDATE",
      [source.slug]
    );
    if (rows[0]) {
      if (rows[0].kind === "personal") {
        throw new Error(`Collection source slug "${source.slug}" conflicts with a personal collection.`);
      }
      if (source.trackExamples && rows[0].public_id !== source.publicId) {
        throw new Error(`Episode collection identity conflicts with existing collection: ${source.slug}`);
      }
      return rows[0];
    }

    const [result] = await connection.execute(
      `INSERT INTO collections
         (public_id, slug, title, description, kind, visibility, status, owner_user_id,
          content_version, source_hash, is_default, published_at, metadata_json)
       VALUES (?, ?, ?, ?, ?, 'public', 'published', NULL,
               0, NULL, ?, CURRENT_TIMESTAMP(3),
               JSON_OBJECT('sourceFile', ?, 'sourceFormatVersion', ?))`,
      [
        source.publicId,
        source.slug,
        source.parsed.title,
        source.description,
        source.kind,
        source.isDefault ? 1 : 0,
        source.fileName,
        COLLECTION_SOURCE_FORMAT_VERSION
      ]
    );
    const [createdRows] = await connection.execute(
      "SELECT * FROM collections WHERE id = ? LIMIT 1 FOR UPDATE",
      [result.insertId]
    );
    return createdRows[0];
  }

  async #syncSections(connection, collectionId, sections) {
    const ids = new Map();
    for (const section of sections) {
      const [rows] = await connection.execute(
        `SELECT id FROM collection_sections
         WHERE collection_id = ? AND title = ? AND parent_section_id IS NULL
         LIMIT 1`,
        [collectionId, section.title]
      );
      let id = rows[0]?.id;
      if (!id) {
        const [result] = await connection.execute(
          `INSERT INTO collection_sections
             (public_id, collection_id, parent_section_id, title, position)
           VALUES (?, ?, NULL, ?, ?)`,
          [randomUUID(), collectionId, section.title, section.position]
        );
        id = result.insertId;
      } else {
        await connection.execute(
          "UPDATE collection_sections SET position = ? WHERE id = ?",
          [section.position, id]
        );
      }
      ids.set(section.path, id);
    }
    return ids;
  }

  async #resolveVocabulary(connection, primaryForm, acceptedForms) {
    const forms = cleanVocabularyForms(primaryForm, acceptedForms);
    const normalizedForms = forms.map(({ normalized }) => normalized);
    const placeholders = normalizedForms.map(() => "?").join(",");
    const [existingRows] = await connection.execute(
      `SELECT ve.id, ve.public_id, ve.primary_form, ve.normalized_form
       FROM vocabulary_forms vf
       JOIN vocabulary_entries ve ON ve.id = vf.vocabulary_entry_id
       WHERE ve.owner_user_id IS NULL AND ve.status = 'active'
         AND vf.normalized_form IN (${placeholders})
       ORDER BY vf.is_primary DESC, ve.id
       LIMIT 1`,
      normalizedForms
    );

    let vocabulary = existingRows[0];
    if (!vocabulary) {
      const primary = forms[0];
      try {
        const [result] = await connection.execute(
          `INSERT INTO vocabulary_entries
             (public_id, language_code, primary_form, normalized_form, canonical_key, owner_user_id, status)
           VALUES (?, 'en', ?, ?, ?, NULL, 'active')`,
          [randomUUID(), primary.form, primary.normalized, publicCanonicalKey("en", primary.normalized)]
        );
        const [rows] = await connection.execute(
          "SELECT id, public_id, primary_form, normalized_form FROM vocabulary_entries WHERE id = ?",
          [result.insertId]
        );
        vocabulary = rows[0];
      } catch (error) {
        if (error?.code !== "ER_DUP_ENTRY") throw error;
        const [rows] = await connection.execute(
          "SELECT id, public_id, primary_form, normalized_form FROM vocabulary_entries WHERE canonical_key = ? LIMIT 1",
          [publicCanonicalKey("en", primary.normalized)]
        );
        vocabulary = rows[0];
      }
    }

    for (const [index, form] of forms.entries()) {
      await connection.execute(
        `INSERT INTO vocabulary_forms (vocabulary_entry_id, form, normalized_form, is_primary)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE form = VALUES(form), is_primary = GREATEST(is_primary, VALUES(is_primary))`,
        [vocabulary.id, form.form, form.normalized, index === 0 && form.normalized === vocabulary.normalized_form ? 1 : 0]
      );
    }

    const [formRows] = await connection.execute(
      `SELECT id, form, normalized_form, is_primary
       FROM vocabulary_forms
       WHERE vocabulary_entry_id = ?
         AND normalized_form IN (${placeholders})`,
      [vocabulary.id, ...normalizedForms]
    );
    const formByNormalized = new Map(
      formRows.map((row) => [String(row.normalized_form), row])
    );

    return {
      ...vocabulary,
      forms: forms.map((form) => {
        const persisted = formByNormalized.get(form.normalized);
        if (!persisted) {
          throw new Error(`Vocabulary form "${form.form}" was not persisted.`);
        }
        return persisted;
      })
    };
  }

  async #upsertCollectionEntry(connection, { collectionId, vocabulary, item, sectionId, nextVersion }) {
    const [rows] = await connection.execute(
      `SELECT id, removed_at
       FROM collection_entries
       WHERE collection_id = ? AND vocabulary_entry_id = ?
       ORDER BY (removed_at IS NULL) DESC, id DESC
       LIMIT 1 FOR UPDATE`,
      [collectionId, vocabulary.id]
    );
    const displayForm = item.primaryForm === vocabulary.primary_form ? null : item.primaryForm;
    if (rows[0]) {
      await connection.execute(
        `UPDATE collection_entries
         SET section_id = ?, position = ?, display_form = ?, note = NULL,
             introduced_version = CASE WHEN removed_at IS NULL THEN introduced_version ELSE ? END,
             removed_at = NULL, removed_version = NULL
         WHERE id = ?`,
        [sectionId, item.position, displayForm, nextVersion, rows[0].id]
      );
      return rows[0].id;
    }

    const [result] = await connection.execute(
      `INSERT INTO collection_entries
         (public_id, collection_id, section_id, vocabulary_entry_id, position,
          display_form, note, introduced_version)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
      [randomUUID(), collectionId, sectionId, vocabulary.id, item.position, displayForm, nextVersion]
    );
    return result.insertId;
  }

  async #syncEntryForms(connection, collectionEntryId, forms, staleFormIds) {
    const [previousRows] = await connection.execute(
      "SELECT vocabulary_form_id FROM collection_entry_forms WHERE collection_entry_id = ?",
      [collectionEntryId]
    );
    previousRows.forEach((row) => staleFormIds.add(String(row.vocabulary_form_id)));

    await connection.execute(
      "DELETE FROM collection_entry_forms WHERE collection_entry_id = ?",
      [collectionEntryId]
    );
    for (const form of forms) {
      await connection.execute(
        `INSERT IGNORE INTO collection_entry_forms (collection_entry_id, vocabulary_form_id)
         VALUES (?, ?)`,
        [collectionEntryId, form.id]
      );
    }
  }

  async #syncEntryExamples(
    connection,
    collectionEntryId,
    vocabularyEntryId,
    examples,
    staleSentenceIds,
    trackOrder = false
  ) {
    const [previousRows] = await connection.execute(
      "SELECT sentence_id FROM collection_entry_examples WHERE collection_entry_id = ?",
      [collectionEntryId]
    );
    previousRows.forEach((row) => staleSentenceIds.add(String(row.sentence_id)));

    await connection.execute(
      "DELETE FROM collection_entry_examples WHERE collection_entry_id = ?",
      [collectionEntryId]
    );

    for (const [index, example] of examples.entries()) {
      const sentence = await this.#ensureSentenceExample(connection, example);
      await connection.execute(
        trackOrder
          ? "INSERT INTO collection_entry_examples (collection_entry_id, sentence_id, position) VALUES (?, ?, ?)"
          : "INSERT IGNORE INTO collection_entry_examples (collection_entry_id, sentence_id) VALUES (?, ?)",
        trackOrder ? [collectionEntryId, sentence.id, index + 1] : [collectionEntryId, sentence.id]
      );
      await connection.execute(
        `INSERT IGNORE INTO sentence_vocabulary_entries (sentence_id, vocabulary_entry_id)
         VALUES (?, ?)`,
        [sentence.id, vocabularyEntryId]
      );
    }
  }

  async #ensureSentenceExample(connection, rawSentence) {
    const sentenceText = String(rawSentence).trim();
    const hash = sentenceHash(sentenceText);
    await connection.execute(
      `INSERT INTO sentences (sentence_text, sentence_hash, status)
       VALUES (?, ?, 'active')
       ON DUPLICATE KEY UPDATE status = 'active'`,
      [sentenceText, hash]
    );
    const [rows] = await connection.execute(
      "SELECT id, sentence_text FROM sentences WHERE sentence_hash = ? LIMIT 1",
      [hash]
    );
    if (!rows[0] || String(rows[0].sentence_text).trim() !== sentenceText) {
      throw new Error("Sentence hash collision detected while syncing collection examples.");
    }
    return rows[0];
  }

  async #clearEntrySourceReferences(
    connection,
    collectionEntryId,
    staleFormIds,
    staleSentenceIds
  ) {
    const [formRows] = await connection.execute(
      "SELECT vocabulary_form_id FROM collection_entry_forms WHERE collection_entry_id = ?",
      [collectionEntryId]
    );
    formRows.forEach((row) => staleFormIds.add(String(row.vocabulary_form_id)));

    const [sentenceRows] = await connection.execute(
      "SELECT sentence_id FROM collection_entry_examples WHERE collection_entry_id = ?",
      [collectionEntryId]
    );
    sentenceRows.forEach((row) => staleSentenceIds.add(String(row.sentence_id)));

    await connection.execute(
      "DELETE FROM collection_entry_forms WHERE collection_entry_id = ?",
      [collectionEntryId]
    );
    await connection.execute(
      "DELETE FROM collection_entry_examples WHERE collection_entry_id = ?",
      [collectionEntryId]
    );
  }

  async #cleanupStaleForms(connection, staleFormIds) {
    if (!staleFormIds.size) return;
    const ids = [...staleFormIds];
    await connection.execute(
      `DELETE vf
       FROM vocabulary_forms vf
       WHERE vf.id IN (${idPlaceholders(ids)})
         AND vf.is_primary = FALSE
         AND NOT EXISTS (
           SELECT 1
           FROM collection_entry_forms cef
           JOIN collection_entries ce
             ON ce.id = cef.collection_entry_id
            AND ce.removed_at IS NULL
           WHERE cef.vocabulary_form_id = vf.id
         )
         AND NOT EXISTS (
           SELECT 1
           FROM collection_entries ce
           JOIN collections c ON c.id = ce.collection_id
           WHERE ce.vocabulary_entry_id = vf.vocabulary_entry_id
             AND ce.removed_at IS NULL
             AND JSON_UNQUOTE(JSON_EXTRACT(c.metadata_json, '$.sourceFile')) IS NULL
         )`,
      ids
    );
  }

  async #cleanupStaleSentences(connection, staleSentenceIds) {
    if (!staleSentenceIds.size) return;
    const ids = [...staleSentenceIds];

    await connection.execute(
      `DELETE sve
       FROM sentence_vocabulary_entries sve
       WHERE sve.sentence_id IN (${idPlaceholders(ids)})
         AND NOT EXISTS (
           SELECT 1
           FROM collection_entry_examples cee
           JOIN collection_entries ce
             ON ce.id = cee.collection_entry_id
            AND ce.removed_at IS NULL
           WHERE cee.sentence_id = sve.sentence_id
             AND ce.vocabulary_entry_id = sve.vocabulary_entry_id
         )`,
      ids
    );

    await connection.execute(
      `UPDATE sentences s
       SET s.status = 'inactive'
       WHERE s.id IN (${idPlaceholders(ids)})
         AND s.is_curated = FALSE
         AND NOT EXISTS (
           SELECT 1
           FROM collection_entry_examples cee
           JOIN collection_entries ce
             ON ce.id = cee.collection_entry_id
            AND ce.removed_at IS NULL
           WHERE cee.sentence_id = s.id
         )`,
      ids
    );
  }

  async #removeUnusedSections(connection, collectionId, usedSectionIds) {
    if (!usedSectionIds.size) return;
    const ids = [...usedSectionIds];
    const placeholders = ids.map(() => "?").join(",");
    await connection.execute(
      `DELETE FROM collection_sections
       WHERE collection_id = ? AND id NOT IN (${placeholders})`,
      [collectionId, ...ids]
    );
  }

  async #bumpSubscriberRevisions(connection, collectionId) {
    await connection.execute(
      `UPDATE user_state_revisions usr
       JOIN user_collections uc ON uc.user_id = usr.user_id
       SET usr.revision = usr.revision + 1, usr.updated_at = CURRENT_TIMESTAMP(3)
       WHERE uc.collection_id = ? AND uc.status = 'active'`,
      [collectionId]
    );
  }
}

export { sentenceHash };
