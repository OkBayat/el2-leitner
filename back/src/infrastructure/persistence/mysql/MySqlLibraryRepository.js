import { randomUUID } from "node:crypto";
import { ConflictError, NotFoundError } from "../../../domain/errors.js";
import {
  cleanVocabularyForms,
  normalizeVocabularyForm,
  publicCanonicalKey
} from "../../../domain/library/VocabularyNormalizer.js";

function parseJson(value) {
  if (value === null || value === undefined) return {};
  if (Buffer.isBuffer(value)) value = value.toString("utf8");
  return typeof value === "string" ? JSON.parse(value) : value;
}

function splitForms(value) {
  return value ? String(value).split("\u001f").filter(Boolean) : [];
}

function bool(value) {
  return Boolean(Number(value));
}

function mapCollection(row) {
  if (!row) return null;
  return {
    id: row.public_id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    kind: row.kind,
    visibility: row.visibility,
    status: row.status,
    contentVersion: Number(row.content_version),
    metadata: parseJson(row.metadata_json),
    isDefault: bool(row.is_default),
    wordCount: Number(row.word_count ?? 0),
    leitnerWordCount: Number(row.leitner_word_count ?? 0),
    subscribed: row.subscription_status === "active",
    lastSeenVersion: Number(row.last_seen_version ?? 0),
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapEntry(row) {
  return {
    id: row.public_id,
    vocabularyId: row.vocabulary_public_id,
    term: row.display_form || row.primary_form,
    primaryForm: row.primary_form,
    acceptedForms: splitForms(row.accepted_forms),
    sectionId: row.section_public_id,
    sectionPath: row.section_path || null,
    note: row.note,
    position: Number(row.position),
    introducedVersion: Number(row.introduced_version)
  };
}

export class MySqlLibraryRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async #withTransaction(operation) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await operation(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async listForUser(userId, { includeManaged = false } = {}) {
    const managedClause = includeManaged ? "OR c.kind <> 'personal'" : "";
    const [rows] = await this.pool.execute(
      `SELECT c.*, COUNT(ce.id) AS word_count,
              COUNT(DISTINCT CASE
                WHEN uvp.status = 'active'
                  AND (COALESCE(uvp.box, 0) > 0 OR uvp.introduced_on IS NOT NULL OR uvp.mastered_at IS NOT NULL)
                THEN ce.id
              END) AS leitner_word_count,
              uc.status AS subscription_status, uc.last_seen_version
       FROM collections c
       LEFT JOIN collection_entries ce
         ON ce.collection_id = c.id AND ce.removed_at IS NULL
       LEFT JOIN user_collections uc
         ON uc.collection_id = c.id AND uc.user_id = ?
       LEFT JOIN user_vocabulary_progress uvp
         ON uvp.user_id = ? AND uvp.vocabulary_entry_id = ce.vocabulary_entry_id
       WHERE (${includeManaged ? "1 = 1" : "c.archived_at IS NULL"})
         AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(c.metadata_json, '$.sourceFile')), '')
           NOT LIKE 'listening/episodes/%'
         AND ((c.visibility = 'public' AND c.status = 'published') OR c.owner_user_id = ? ${managedClause})
       GROUP BY c.id, uc.status, uc.last_seen_version
       ORDER BY c.is_default DESC, c.published_at DESC, c.created_at DESC`,
      [userId, userId, userId]
    );
    return rows.map(mapCollection);
  }

  async getForUser(collectionId, userId, { includeManaged = false } = {}) {
    const managedClause = includeManaged ? "OR c.kind <> 'personal'" : "";
    const [collectionRows] = await this.pool.execute(
      `SELECT c.*,
              (SELECT COUNT(*) FROM collection_entries ce WHERE ce.collection_id = c.id AND ce.removed_at IS NULL) AS word_count,
              (SELECT COUNT(*)
               FROM collection_entries progress_ce
               JOIN user_vocabulary_progress uvp
                 ON uvp.user_id = ? AND uvp.vocabulary_entry_id = progress_ce.vocabulary_entry_id
               WHERE progress_ce.collection_id = c.id
                 AND progress_ce.removed_at IS NULL
                 AND uvp.status = 'active'
                 AND (COALESCE(uvp.box, 0) > 0 OR uvp.introduced_on IS NOT NULL OR uvp.mastered_at IS NOT NULL)) AS leitner_word_count,
              uc.status AS subscription_status, uc.last_seen_version
       FROM collections c
       LEFT JOIN user_collections uc ON uc.collection_id = c.id AND uc.user_id = ?
       WHERE (c.public_id = ? OR c.slug = ?)
         AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(c.metadata_json, '$.sourceFile')), '')
           NOT LIKE 'listening/episodes/%'
         AND ((c.visibility IN ('public', 'unlisted') AND c.status = 'published') OR c.owner_user_id = ? ${managedClause})
       LIMIT 1`,
      [userId, userId, collectionId, collectionId, userId]
    );
    const collection = mapCollection(collectionRows[0]);
    if (!collection) throw new NotFoundError("COLLECTION_NOT_FOUND", "Collection was not found.");

    const internalId = collectionRows[0].id;
    const [sectionRows] = await this.pool.execute(
      `SELECT id, public_id, parent_section_id, title, position
       FROM collection_sections
       WHERE collection_id = ?
       ORDER BY position, id`,
      [internalId]
    );
    const sectionById = new Map(sectionRows.map((row) => [String(row.id), row]));
    const pathCache = new Map();
    const sectionPath = (row) => {
      if (!row) return null;
      const key = String(row.id);
      if (pathCache.has(key)) return pathCache.get(key);
      const parent = row.parent_section_id ? sectionById.get(String(row.parent_section_id)) : null;
      const path = parent ? `${sectionPath(parent)} / ${row.title}` : row.title;
      pathCache.set(key, path);
      return path;
    };
    const [entryRows] = await this.pool.execute(
      `SELECT ce.public_id, ce.position, ce.display_form, ce.note, ce.introduced_version,
              ve.public_id AS vocabulary_public_id, ve.primary_form,
              s.id AS section_internal_id, s.public_id AS section_public_id,
              GROUP_CONCAT(vf.form ORDER BY vf.is_primary DESC, vf.id SEPARATOR '\u001f') AS accepted_forms
       FROM collection_entries ce
       JOIN vocabulary_entries ve ON ve.id = ce.vocabulary_entry_id
       LEFT JOIN vocabulary_forms vf ON vf.vocabulary_entry_id = ve.id
       LEFT JOIN collection_sections s ON s.id = ce.section_id
       WHERE ce.collection_id = ? AND ce.removed_at IS NULL
       GROUP BY ce.id, ve.id, s.id
       ORDER BY ce.position, ce.id`,
      [internalId]
    );

    collection.sections = sectionRows.map((row) => ({
      id: row.public_id,
      title: row.title,
      parentId: row.parent_section_id ? sectionById.get(String(row.parent_section_id))?.public_id ?? null : null,
      path: sectionPath(row),
      position: Number(row.position)
    }));
    collection.entries = entryRows.map((row) => mapEntry({
      ...row,
      section_path: row.section_internal_id ? sectionPath(sectionById.get(String(row.section_internal_id))) : null
    }));
    return collection;
  }

  async getVocabularySources(userId) {
    const [rows] = await this.pool.execute(
      `SELECT ve.public_id AS vocabulary_public_id, ve.primary_form,
              GROUP_CONCAT(DISTINCT CONCAT(c.public_id, '\u001e', c.title) ORDER BY CONCAT(c.public_id, '\u001e', c.title) SEPARATOR '\u001f') AS source_pairs
       FROM user_collections uc
       JOIN collections c ON c.id = uc.collection_id
       JOIN collection_entries ce ON ce.collection_id = c.id AND ce.removed_at IS NULL
       JOIN vocabulary_entries ve ON ve.id = ce.vocabulary_entry_id
       LEFT JOIN user_vocabulary_progress uvp
         ON uvp.user_id = uc.user_id AND uvp.vocabulary_entry_id = ve.id
       WHERE uc.user_id = ? AND uc.status = 'active' AND COALESCE(uvp.status, 'active') <> 'excluded'
       GROUP BY ve.id
       ORDER BY ve.primary_form`,
      [userId]
    );
    return rows.map((row) => ({
      vocabularyId: row.vocabulary_public_id,
      term: row.primary_form,
      collections: String(row.source_pairs || "").split("\u001f").filter(Boolean).map((pair) => {
        const [id, title] = pair.split("\u001e");
        return { id, title };
      })
    }));
  }

  async subscribe(userId, collectionId) {
    return this.#withTransaction(async (connection) => {
      await this.#ensureDefaultSubscription(connection, userId);
      const collection = await this.#findAccessibleCollection(connection, collectionId, userId, true);
      await connection.execute(
        `INSERT INTO user_collections (user_id, collection_id, status, subscribed_at, removed_at, last_seen_version)
         VALUES (?, ?, 'active', CURRENT_TIMESTAMP(3), NULL, 0)
         ON DUPLICATE KEY UPDATE status = 'active', removed_at = NULL, subscribed_at = CURRENT_TIMESTAMP(3)`,
        [userId, collection.id]
      );
      await this.#bumpUserRevision(connection, userId);
      return { id: collection.public_id, title: collection.title, contentVersion: Number(collection.content_version), subscribed: true };
    });
  }

  async unsubscribe(userId, collectionId) {
    return this.#withTransaction(async (connection) => {
      const collection = await this.#findAccessibleCollection(connection, collectionId, userId, true);
      await connection.execute(
        `UPDATE user_collections
         SET status = 'removed', removed_at = CURRENT_TIMESTAMP(3)
         WHERE user_id = ? AND collection_id = ?`,
        [userId, collection.id]
      );
      await this.#bumpUserRevision(connection, userId);
    });
  }

  async create(userId, draft) {
    const publicId = randomUUID();
    try {
      const [result] = await this.pool.execute(
        `INSERT INTO collections
           (public_id, slug, title, description, kind, visibility, status, owner_user_id, metadata_json, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'published' THEN CURRENT_TIMESTAMP(3) ELSE NULL END)`,
        [
          publicId,
          draft.slug,
          draft.title,
          draft.description,
          draft.kind,
          draft.visibility,
          draft.status,
          userId,
          JSON.stringify(draft.metadata),
          draft.status
        ]
      );
      const [rows] = await this.pool.execute("SELECT * FROM collections WHERE id = ?", [result.insertId]);
      return mapCollection(rows[0]);
    } catch (error) {
      if (error?.code === "ER_DUP_ENTRY") {
        throw new ConflictError("COLLECTION_SLUG_EXISTS", "A collection with this slug already exists.");
      }
      throw error;
    }
  }

  async update(collectionId, draft) {
    return this.#withTransaction(async (connection) => {
      const collection = await this.#findCollection(connection, collectionId, true);
      try {
        await connection.execute(
          `UPDATE collections
           SET slug = ?, title = ?, description = ?, kind = ?, visibility = ?, status = ?,
               metadata_json = CASE WHEN ? = 1 THEN ? ELSE metadata_json END,
               published_at = CASE
                 WHEN ? = 'published' AND published_at IS NULL THEN CURRENT_TIMESTAMP(3)
                 WHEN ? <> 'published' THEN NULL ELSE published_at END,
               archived_at = CASE WHEN ? = 'archived' THEN CURRENT_TIMESTAMP(3) ELSE NULL END
           WHERE id = ?`,
          [
            draft.slug,
            draft.title,
            draft.description,
            draft.kind,
            draft.visibility,
            draft.status,
            draft.metadataProvided ? 1 : 0,
            draft.metadataProvided ? JSON.stringify(draft.metadata) : null,
            draft.status,
            draft.status,
            draft.status,
            collection.id
          ]
        );
      } catch (error) {
        if (error?.code === "ER_DUP_ENTRY") {
          throw new ConflictError("COLLECTION_SLUG_EXISTS", "A collection with this slug already exists.");
        }
        throw error;
      }
      const [rows] = await connection.execute("SELECT * FROM collections WHERE id = ?", [collection.id]);
      return mapCollection(rows[0]);
    });
  }

  async importEntries(collectionId, parsed, mode = "append") {
    return this.#withTransaction(async (connection) => {
      const collection = await this.#findCollection(connection, collectionId, true);
      const nextVersion = Number(collection.content_version) + 1;
      const sectionIds = await this.#ensureSections(connection, collection.id, parsed.sections);
      const [positionRows] = await connection.execute(
        "SELECT COALESCE(MAX(position), 0) AS max_position FROM collection_entries WHERE collection_id = ? AND removed_at IS NULL",
        [collection.id]
      );
      let nextAppendPosition = Number(positionRows[0]?.max_position || 0) + 1;
      const seenVocabularyIds = new Set();
      let added = 0;
      let updated = 0;

      for (const item of parsed.entries) {
        const vocabulary = await this.#resolvePublicVocabulary(connection, item.primaryForm, item.acceptedForms);
        seenVocabularyIds.add(String(vocabulary.id));
        const [existingRows] = await connection.execute(
          `SELECT id, section_id, position, display_form, note
           FROM collection_entries
           WHERE collection_id = ? AND vocabulary_entry_id = ? AND removed_at IS NULL
           LIMIT 1`,
          [collection.id, vocabulary.id]
        );
        const sectionId = item.sectionPath ? sectionIds.get(item.sectionPath) ?? null : null;
        const displayForm = item.primaryForm === vocabulary.primary_form ? null : item.primaryForm;
        const requestedPosition = Number(item.sourceNumber || item.position);
        const hasRequestedPosition = Number.isSafeInteger(requestedPosition) && requestedPosition > 0;
        if (existingRows[0]) {
          const position = mode === "replace" && hasRequestedPosition
            ? requestedPosition
            : Number(existingRows[0].position);
          await connection.execute(
            `UPDATE collection_entries
             SET section_id = ?, position = ?, display_form = ?, note = COALESCE(?, note)
             WHERE id = ?`,
            [sectionId, position, displayForm, item.note ?? null, existingRows[0].id]
          );
          updated += 1;
        } else {
          const position = mode === "replace" && hasRequestedPosition
            ? requestedPosition
            : nextAppendPosition++;
          await connection.execute(
            `INSERT INTO collection_entries
               (public_id, collection_id, section_id, vocabulary_entry_id, position, display_form, note, introduced_version)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [randomUUID(), collection.id, sectionId, vocabulary.id, position, displayForm, item.note ?? null, nextVersion]
          );
          added += 1;
        }
      }

      let removed = 0;
      if (mode === "replace") {
        const [activeRows] = await connection.execute(
          "SELECT id, vocabulary_entry_id FROM collection_entries WHERE collection_id = ? AND removed_at IS NULL",
          [collection.id]
        );
        const toRemove = activeRows.filter((row) => !seenVocabularyIds.has(String(row.vocabulary_entry_id)));
        for (const row of toRemove) {
          await connection.execute(
            `UPDATE collection_entries
             SET removed_at = CURRENT_TIMESTAMP(3), removed_version = ?
             WHERE id = ? AND removed_at IS NULL`,
            [nextVersion, row.id]
          );
        }
        removed = toRemove.length;
      }

      await connection.execute(
        "UPDATE collections SET content_version = ? WHERE id = ?",
        [nextVersion, collection.id]
      );
      await this.#bumpSubscriberRevisions(connection, collection.id);
      return { version: nextVersion, found: parsed.entries.length, added, updated, removed };
    });
  }

  async addEntry(collectionId, input) {
    const parsed = {
      sections: input.sectionPath ? this.#sectionsFromPath(input.sectionPath) : [],
      entries: [{ ...input, sourceNumber: 0, position: 0 }]
    };
    await this.importEntries(collectionId, parsed, "append");
    return this.#findEntryByTerm(collectionId, input.primaryForm);
  }

  async updateEntry(collectionId, entryId, input) {
    await this.#withTransaction(async (connection) => {
      const collection = await this.#findCollection(connection, collectionId, true);
      const [entryRows] = await connection.execute(
        `SELECT ce.*, ve.primary_form, ve.normalized_form
         FROM collection_entries ce
         JOIN vocabulary_entries ve ON ve.id = ce.vocabulary_entry_id
         WHERE ce.public_id = ? AND ce.collection_id = ? AND ce.removed_at IS NULL
         LIMIT 1 FOR UPDATE`,
        [entryId, collection.id]
      );
      const entry = entryRows[0];
      if (!entry) throw new NotFoundError("COLLECTION_ENTRY_NOT_FOUND", "Collection entry was not found.");

      const forms = cleanVocabularyForms(input.primaryForm, input.acceptedForms);
      const normalizedForms = forms.map(({ normalized }) => normalized);
      const target = await this.#findPublicVocabularyByForms(connection, normalizedForms);
      let vocabularyId = entry.vocabulary_entry_id;
      let primaryForm = input.primaryForm;
      let sharedVocabularyChanged = false;

      if (target && String(target.id) !== String(entry.vocabulary_entry_id)) {
        const [duplicateRows] = await connection.execute(
          `SELECT id FROM collection_entries
           WHERE collection_id = ? AND vocabulary_entry_id = ? AND removed_at IS NULL AND id <> ? LIMIT 1`,
          [collection.id, target.id, entry.id]
        );
        if (duplicateRows[0]) {
          throw new ConflictError("DUPLICATE_COLLECTION_ENTRY", "This vocabulary item already exists in the collection.");
        }
        vocabularyId = target.id;
        primaryForm = target.primary_form;
        await this.#ensureVocabularyForms(connection, target.id, forms);
      } else {
        const primaryNormalized = forms[0].normalized;
        await connection.execute(
          `UPDATE vocabulary_entries
           SET primary_form = ?, normalized_form = ?, canonical_key = ?
           WHERE id = ?`,
          [forms[0].form, primaryNormalized, publicCanonicalKey("en", primaryNormalized), entry.vocabulary_entry_id]
        );
        await connection.execute("DELETE FROM vocabulary_forms WHERE vocabulary_entry_id = ?", [entry.vocabulary_entry_id]);
        await this.#ensureVocabularyForms(connection, entry.vocabulary_entry_id, forms);
        primaryForm = forms[0].form;
        sharedVocabularyChanged = true;
      }

      const sections = input.sectionPath ? this.#sectionsFromPath(input.sectionPath) : [];
      const sectionIds = await this.#ensureSections(connection, collection.id, sections);
      const sectionId = input.sectionPath ? sectionIds.get(input.sectionPath) ?? null : null;
      const nextVersion = Number(collection.content_version) + 1;
      await connection.execute(
        `UPDATE collection_entries
         SET vocabulary_entry_id = ?, section_id = ?, display_form = ?, note = ?
         WHERE id = ?`,
        [vocabularyId, sectionId, input.primaryForm === primaryForm ? null : input.primaryForm, input.note, entry.id]
      );
      if (sharedVocabularyChanged) {
        await connection.execute(
          `UPDATE collections c
           JOIN collection_entries ce ON ce.collection_id = c.id
             AND ce.vocabulary_entry_id = ? AND ce.removed_at IS NULL
           SET c.content_version = c.content_version + 1`,
          [entry.vocabulary_entry_id]
        );
        await this.#bumpVocabularySubscriberRevisions(connection, entry.vocabulary_entry_id);
      } else {
        await connection.execute("UPDATE collections SET content_version = ? WHERE id = ?", [nextVersion, collection.id]);
        await this.#bumpSubscriberRevisions(connection, collection.id);
      }
    });
    return this.getEntry(collectionId, entryId);
  }

  async removeEntry(collectionId, entryId) {
    return this.#withTransaction(async (connection) => {
      const collection = await this.#findCollection(connection, collectionId, true);
      const nextVersion = Number(collection.content_version) + 1;
      const [result] = await connection.execute(
        `UPDATE collection_entries
         SET removed_at = CURRENT_TIMESTAMP(3), removed_version = ?
         WHERE public_id = ? AND collection_id = ? AND removed_at IS NULL`,
        [nextVersion, entryId, collection.id]
      );
      if (result.affectedRows !== 1) {
        throw new NotFoundError("COLLECTION_ENTRY_NOT_FOUND", "Collection entry was not found.");
      }
      await connection.execute("UPDATE collections SET content_version = ? WHERE id = ?", [nextVersion, collection.id]);
      await this.#bumpSubscriberRevisions(connection, collection.id);
    });
  }

  async getEntry(collectionId, entryId) {
    const [rows] = await this.pool.execute(
      `SELECT ce.public_id, ce.position, ce.display_form, ce.note, ce.introduced_version,
              ve.public_id AS vocabulary_public_id, ve.primary_form,
              s.id AS section_internal_id, s.public_id AS section_public_id,
              GROUP_CONCAT(vf.form ORDER BY vf.is_primary DESC, vf.id SEPARATOR '\u001f') AS accepted_forms
       FROM collection_entries ce
       JOIN collections c ON c.id = ce.collection_id
       JOIN vocabulary_entries ve ON ve.id = ce.vocabulary_entry_id
       LEFT JOIN vocabulary_forms vf ON vf.vocabulary_entry_id = ve.id
       LEFT JOIN collection_sections s ON s.id = ce.section_id
       WHERE (c.public_id = ? OR c.slug = ?) AND ce.public_id = ? AND ce.removed_at IS NULL
       GROUP BY ce.id, ve.id, s.id
       LIMIT 1`,
      [collectionId, collectionId, entryId]
    );
    if (!rows[0]) throw new NotFoundError("COLLECTION_ENTRY_NOT_FOUND", "Collection entry was not found.");
    const sectionPath = rows[0].section_internal_id
      ? await this.#sectionPathById(rows[0].section_internal_id)
      : null;
    return mapEntry({ ...rows[0], section_path: sectionPath });
  }

  async #findEntryByTerm(collectionId, term) {
    const normalized = normalizeVocabularyForm(term);
    const [rows] = await this.pool.execute(
      `SELECT ce.public_id
       FROM collections c
       JOIN collection_entries ce ON ce.collection_id = c.id AND ce.removed_at IS NULL
       JOIN vocabulary_entries ve ON ve.id = ce.vocabulary_entry_id
       JOIN vocabulary_forms vf ON vf.vocabulary_entry_id = ve.id
       WHERE (c.public_id = ? OR c.slug = ?) AND vf.normalized_form = ?
       LIMIT 1`,
      [collectionId, collectionId, normalized]
    );
    if (!rows[0]) throw new NotFoundError("COLLECTION_ENTRY_NOT_FOUND", "Collection entry was not found after import.");
    return this.getEntry(collectionId, rows[0].public_id);
  }

  async #findAccessibleCollection(connection, collectionId, userId, lock = false) {
    const suffix = lock ? " FOR UPDATE" : "";
    const [rows] = await connection.execute(
      `SELECT * FROM collections
       WHERE (public_id = ? OR slug = ?)
         AND archived_at IS NULL
         AND ((visibility IN ('public', 'unlisted') AND status = 'published') OR owner_user_id = ?)
       LIMIT 1${suffix}`,
      [collectionId, collectionId, userId]
    );
    if (!rows[0]) throw new NotFoundError("COLLECTION_NOT_FOUND", "Collection was not found.");
    return rows[0];
  }

  async #findCollection(connection, collectionId, lock = false) {
    const suffix = lock ? " FOR UPDATE" : "";
    const [rows] = await connection.execute(
      `SELECT * FROM collections WHERE (public_id = ? OR slug = ?) AND kind <> 'personal' LIMIT 1${suffix}`,
      [collectionId, collectionId]
    );
    if (!rows[0]) throw new NotFoundError("COLLECTION_NOT_FOUND", "Collection was not found.");
    return rows[0];
  }

  async #sectionPathById(sectionId) {
    const titles = [];
    let currentId = sectionId;
    const visited = new Set();
    while (currentId && !visited.has(String(currentId))) {
      visited.add(String(currentId));
      const [rows] = await this.pool.execute(
        "SELECT id, parent_section_id, title FROM collection_sections WHERE id = ? LIMIT 1",
        [currentId]
      );
      if (!rows[0]) break;
      titles.unshift(rows[0].title);
      currentId = rows[0].parent_section_id;
    }
    return titles.join(" / ") || null;
  }

  #sectionsFromPath(path) {
    const titles = String(path).split("/").map((part) => part.trim()).filter(Boolean);
    return titles.map((title, index) => ({
      path: titles.slice(0, index + 1).join(" / "),
      title,
      parentPath: index ? titles.slice(0, index).join(" / ") : null,
      position: index + 1
    }));
  }

  async #ensureSections(connection, collectionId, sections) {
    const ids = new Map();
    for (const section of sections) {
      const parentId = section.parentPath ? ids.get(section.parentPath) ?? null : null;
      const [rows] = await connection.execute(
        `SELECT id FROM collection_sections
         WHERE collection_id = ? AND title = ? AND (parent_section_id <=> ?) LIMIT 1`,
        [collectionId, section.title, parentId]
      );
      let id = rows[0]?.id;
      if (!id) {
        const [result] = await connection.execute(
          `INSERT INTO collection_sections (public_id, collection_id, parent_section_id, title, position)
           VALUES (?, ?, ?, ?, ?)`,
          [randomUUID(), collectionId, parentId, section.title, section.position]
        );
        id = result.insertId;
      } else {
        await connection.execute("UPDATE collection_sections SET position = ? WHERE id = ?", [section.position, id]);
      }
      ids.set(section.path, id);
    }
    return ids;
  }

  async #findPublicVocabularyByForms(connection, normalizedForms) {
    if (!normalizedForms.length) return null;
    const placeholders = normalizedForms.map(() => "?").join(",");
    const [rows] = await connection.execute(
      `SELECT ve.id, ve.public_id, ve.primary_form, ve.normalized_form
       FROM vocabulary_forms vf
       JOIN vocabulary_entries ve ON ve.id = vf.vocabulary_entry_id
       WHERE ve.owner_user_id IS NULL AND ve.status = 'active'
         AND vf.normalized_form IN (${placeholders})
       ORDER BY vf.is_primary DESC, ve.id
       LIMIT 1`,
      normalizedForms
    );
    return rows[0] ?? null;
  }

  async #resolvePublicVocabulary(connection, primaryForm, acceptedForms) {
    const forms = cleanVocabularyForms(primaryForm, acceptedForms);
    const existing = await this.#findPublicVocabularyByForms(connection, forms.map(({ normalized }) => normalized));
    if (existing) {
      await this.#ensureVocabularyForms(connection, existing.id, forms);
      return existing;
    }

    const publicId = randomUUID();
    const primaryNormalized = forms[0].normalized;
    let vocabularyId;
    try {
      const [result] = await connection.execute(
        `INSERT INTO vocabulary_entries
           (public_id, language_code, primary_form, normalized_form, canonical_key, owner_user_id)
         VALUES (?, 'en', ?, ?, ?, NULL)`,
        [publicId, forms[0].form, primaryNormalized, publicCanonicalKey("en", primaryNormalized)]
      );
      vocabularyId = result.insertId;
    } catch (error) {
      if (error?.code !== "ER_DUP_ENTRY") throw error;
      const [rows] = await connection.execute(
        "SELECT id, public_id, primary_form, normalized_form FROM vocabulary_entries WHERE canonical_key = ? LIMIT 1",
        [publicCanonicalKey("en", primaryNormalized)]
      );
      vocabularyId = rows[0].id;
    }
    await this.#ensureVocabularyForms(connection, vocabularyId, forms);
    const [rows] = await connection.execute(
      "SELECT id, public_id, primary_form, normalized_form FROM vocabulary_entries WHERE id = ?",
      [vocabularyId]
    );
    return rows[0];
  }

  async #ensureVocabularyForms(connection, vocabularyId, forms) {
    for (const [index, item] of forms.entries()) {
      await connection.execute(
        `INSERT INTO vocabulary_forms (vocabulary_entry_id, form, normalized_form, is_primary)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE form = VALUES(form), is_primary = GREATEST(is_primary, VALUES(is_primary))`,
        [vocabularyId, item.form, item.normalized, index === 0 ? 1 : 0]
      );
    }
  }
  async #ensureDefaultSubscription(connection, userId) {
    const [rows] = await connection.execute(
      "SELECT id FROM collections WHERE is_default = TRUE AND archived_at IS NULL ORDER BY id LIMIT 1"
    );
    if (!rows[0]) return;
    await connection.execute(
      `INSERT INTO user_collections (user_id, collection_id, status, subscribed_at, last_seen_version)
       VALUES (?, ?, 'active', CURRENT_TIMESTAMP(3), 0)
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)`,
      [userId, rows[0].id]
    );
  }

  async #bumpUserRevision(connection, userId) {
    const [updated] = await connection.execute(
      `UPDATE user_state_revisions
       SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP(3)
       WHERE user_id = ?`,
      [userId]
    );
    if (updated.affectedRows === 1) return;

    await connection.execute(
      `INSERT INTO user_state_revisions (user_id, revision, metadata_json)
       SELECT ?, 1, JSON_OBJECT()
       WHERE NOT EXISTS (SELECT 1 FROM learning_states WHERE user_id = ?)`,
      [userId, userId]
    );
  }

  async #bumpVocabularySubscriberRevisions(connection, vocabularyId) {
    await connection.execute(
      `UPDATE user_state_revisions usr
       JOIN user_collections uc ON uc.user_id = usr.user_id AND uc.status = 'active'
       JOIN collection_entries ce ON ce.collection_id = uc.collection_id
         AND ce.vocabulary_entry_id = ? AND ce.removed_at IS NULL
       SET usr.revision = usr.revision + 1, usr.updated_at = CURRENT_TIMESTAMP(3)`,
      [vocabularyId]
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
