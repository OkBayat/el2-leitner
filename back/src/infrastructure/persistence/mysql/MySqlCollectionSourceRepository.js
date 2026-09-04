import { createHash, randomUUID } from "node:crypto";

import {
  cleanVocabularyForms,
  publicCanonicalKey
} from "../../../domain/library/VocabularyNormalizer.js";

function sentenceHash(sentenceText) {
  return createHash("sha256").update(sentenceText, "utf8").digest("hex");
}

export class MySqlCollectionSourceRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async sync(source) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const collection = await this.#ensureCollection(connection, source);
      if (collection.source_hash === source.sourceHash) {
        await connection.commit();
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

        for (const example of item.examples) {
          await this.#ensureSentenceExample(connection, vocabulary.id, example);
          examples += 1;
        }
      }

      const [activeRows] = await connection.execute(
        "SELECT id, vocabulary_entry_id FROM collection_entries WHERE collection_id = ? AND removed_at IS NULL",
        [collection.id]
      );
      let removed = 0;
      for (const row of activeRows) {
        if (seenVocabularyIds.has(String(row.vocabulary_entry_id))) continue;
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
         SET title = ?, kind = 'book', visibility = 'public', status = 'published',
             source_hash = ?, content_version = ?, archived_at = NULL,
             published_at = COALESCE(published_at, CURRENT_TIMESTAMP(3)),
             metadata_json = JSON_SET(
               COALESCE(metadata_json, JSON_OBJECT()),
               '$.sourceFile', ?,
               '$.sourceFormatVersion', CAST(1 AS UNSIGNED),
               '$.sourceItemCount', CAST(? AS UNSIGNED),
               '$.definitionCount', CAST(? AS UNSIGNED),
               '$.exampleReferenceCount', CAST(? AS UNSIGNED)
             )
         WHERE id = ?`,
        [
          source.parsed.title,
          source.sourceHash,
          nextVersion,
          source.fileName,
          source.parsed.entries.length,
          definitions,
          examples,
          collection.id
        ]
      );
      await this.#bumpSubscriberRevisions(connection, collection.id);
      await connection.commit();

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
      return rows[0];
    }

    const [result] = await connection.execute(
      `INSERT INTO collections
         (public_id, slug, title, description, kind, visibility, status, owner_user_id,
          content_version, source_hash, is_default, published_at, metadata_json)
       VALUES (?, ?, ?, NULL, 'book', 'public', 'published', NULL,
               0, NULL, FALSE, CURRENT_TIMESTAMP(3),
               JSON_OBJECT('sourceFile', ?, 'sourceFormatVersion', 1))`,
      [randomUUID(), source.slug, source.parsed.title, source.fileName]
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
    return vocabulary;
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
             removed_at = NULL, removed_version = NULL,
             introduced_version = CASE WHEN removed_at IS NULL THEN introduced_version ELSE ? END
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

  async #ensureSentenceExample(connection, vocabularyEntryId, rawSentence) {
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
    await connection.execute(
      `INSERT IGNORE INTO sentence_vocabulary_entries (sentence_id, vocabulary_entry_id)
       VALUES (?, ?)`,
      [rows[0].id, vocabularyEntryId]
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
