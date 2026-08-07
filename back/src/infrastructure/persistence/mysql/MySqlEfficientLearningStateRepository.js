import { randomUUID } from "node:crypto";

import { ConflictError } from "../../../domain/errors.js";
import {
  cleanVocabularyForms,
  normalizeVocabularyForm,
  privateCanonicalKey
} from "../../../domain/library/VocabularyNormalizer.js";
import {
  MySqlLearningStateRepository,
  isLearningResetCandidate,
  needsProgressRow,
  reviewEventKey
} from "./MySqlLearningStateRepository.js";

const ROOT_DATA_KEYS = new Set(["words", "history", "daily", "settings", "persistenceCursor"]);
const DEFAULT_SETTINGS = { dailyNew: 10, dailyGoal: 20, voiceRate: 0.85, theme: "system" };

function nonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : fallback;
}

function boxNumber(value) {
  return Math.min(5, nonNegativeInteger(value));
}

function asDay(value) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
  return null;
}

function asDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function asIso(value) {
  const date = asDate(value);
  return date ? date.toISOString() : null;
}

function rootMetadata(state) {
  return Object.fromEntries(Object.entries(state || {}).filter(([key]) => !ROOT_DATA_KEYS.has(key)));
}

export function reviewFingerprint(event) {
  return JSON.stringify([
    event?.at ?? null,
    event?.day ?? null,
    event?.term ?? null,
    event?.answer ?? null,
    Boolean(event?.correct),
    event?.mode ?? null,
    event?.previousBox ?? null,
    event?.newBox ?? null,
    event?.mistakeNumber ?? null
  ]);
}

function comparableDate(value, dayOnly = false) {
  return dayOnly ? asDay(value) : asIso(value);
}

function sameProgress(row, desired) {
  if (!row) return false;
  return String(row.status) === desired.status &&
    Number(row.box) === desired.box &&
    comparableDate(row.due_date, true) === desired.dueDate &&
    Number(row.attempts) === desired.attempts &&
    Number(row.correct_count) === desired.correctCount &&
    Number(row.mistake_count) === desired.mistakeCount &&
    Number(row.current_streak) === desired.currentStreak &&
    comparableDate(row.introduced_on, true) === desired.introducedOn &&
    (row.introduced_via || null) === desired.introducedVia &&
    comparableDate(row.last_reviewed_at) === desired.lastReviewedAt &&
    comparableDate(row.last_promoted_on, true) === desired.lastPromotedOn &&
    comparableDate(row.blocked_until, true) === desired.blockedUntil &&
    comparableDate(row.mastered_at) === desired.masteredAt &&
    (row.personal_note || null) === desired.personalNote &&
    (row.legacy_category || null) === desired.legacyCategory;
}

function sameDaily(row, record) {
  return row &&
    Number(row.attempts) === nonNegativeInteger(record?.attempts) &&
    Number(row.correct_count) === nonNegativeInteger(record?.correct) &&
    Number(row.wrong_count) === nonNegativeInteger(record?.wrong) &&
    Number(row.new_added) === nonNegativeInteger(record?.newAdded) &&
    Number(row.session_count) === nonNegativeInteger(record?.sessions) &&
    Number(row.duration_seconds) === nonNegativeInteger(record?.durationSeconds);
}

function boundedSettings(input = {}) {
  const dailyNew = Math.min(50, Math.max(1, nonNegativeInteger(input.dailyNew, DEFAULT_SETTINGS.dailyNew)));
  const dailyGoal = Math.min(200, Math.max(5, nonNegativeInteger(input.dailyGoal, DEFAULT_SETTINGS.dailyGoal)));
  const voiceRate = Number(input.voiceRate);
  return {
    dailyNew,
    dailyGoal,
    voiceRate: Number.isFinite(voiceRate) ? Math.min(1.2, Math.max(0.5, voiceRate)) : DEFAULT_SETTINGS.voiceRate,
    theme: ["system", "light", "dark"].includes(input.theme) ? input.theme : DEFAULT_SETTINGS.theme
  };
}

function progressFromWord(word, { personalMembership, catalogCategories }) {
  const category = String(word?.category || "").trim();
  const categorySet = new Set([...catalogCategories].map((item) => String(item || "").trim()));
  const legacyCategory = category && category !== "بدون دسته‌بندی" && !categorySet.has(category)
    ? category.slice(0, 255)
    : null;
  return {
    status: "active",
    box: boxNumber(word?.box),
    dueDate: asDay(word?.due),
    attempts: nonNegativeInteger(word?.attempts),
    correctCount: nonNegativeInteger(word?.correct),
    mistakeCount: nonNegativeInteger(word?.mistakes),
    currentStreak: nonNegativeInteger(word?.currentStreak),
    introducedOn: asDay(word?.introducedOn),
    introducedVia: word?.addedSource ? String(word.addedSource).slice(0, 64) : null,
    lastReviewedAt: asIso(word?.lastReviewed),
    lastPromotedOn: asDay(word?.lastPromotedDay),
    blockedUntil: asDay(word?.blockedUntil),
    masteredAt: asIso(word?.masteredAt),
    personalNote: word?.notes ? String(word.notes).slice(0, 10000) : null,
    legacyCategory,
    shouldStore: needsProgressRow(word, { personalMembership, catalogCategories })
  };
}

export class MySqlEfficientLearningStateRepository extends MySqlLearningStateRepository {
  constructor(pool) {
    super(pool);
    this.pool = pool;
  }

  async findByUserId(userId) {
    const result = await super.findByUserId(userId);
    if (!result.state) return result;
    const history = Array.isArray(result.state.history) ? result.state.history : [];
    result.state.normalizedPersistenceVersion = 2;
    result.state.persistenceCursor = {
      historyLength: history.length,
      lastReviewFingerprint: history.length ? reviewFingerprint(history.at(-1)) : null
    };
    return result;
  }

  async save(userId, state, expectedRevision, context = {}) {
    await this.#ensureLegacyMigration(userId);
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [revisionRows] = await connection.execute(
        "SELECT revision, learning_reset_at FROM user_state_revisions WHERE user_id = ? LIMIT 1 FOR UPDATE",
        [userId]
      );
      const revisionRow = revisionRows[0] ?? null;
      const currentRevision = revisionRow ? Number(revisionRow.revision) : 0;
      if (currentRevision !== expectedRevision) {
        throw new ConflictError(
          "STATE_CONFLICT",
          "Learning state was updated by another session. Reload and try again."
        );
      }

      const learningResetAt = await this.#detectLearningReset(
        connection,
        userId,
        state,
        revisionRow?.learning_reset_at ?? null
      );
      if (learningResetAt) {
        await connection.execute("DELETE FROM user_daily_stats WHERE user_id = ?", [userId]);
      }

      await this.#ensureDefaultSubscription(connection, userId);
      const stateContext = await this.#loadStateContext(connection, userId);
      const wordMap = await this.#syncWordsEfficient(
        connection,
        userId,
        Array.isArray(state.words) ? state.words : [],
        state.libraryVersions || {},
        stateContext
      );
      await this.#syncSettingsEfficient(connection, userId, state.settings || {});
      await this.#syncDailyEfficient(connection, userId, state.daily || {});
      await this.#appendReviewEventsEfficient(
        connection,
        userId,
        Array.isArray(state.history) ? state.history : [],
        state.persistenceCursor || null,
        wordMap,
        stateContext,
        context.practiceSessionId || null
      );

      const history = Array.isArray(state.history) ? state.history : [];
      const metadata = {
        ...rootMetadata(state),
        normalizedPersistenceVersion: 2,
        persistenceCursor: {
          historyLength: history.length,
          lastReviewFingerprint: history.length ? reviewFingerprint(history.at(-1)) : null
        }
      };
      const nextRevision = expectedRevision + 1;
      if (revisionRow) {
        await connection.execute(
          `UPDATE user_state_revisions
           SET revision = ?, metadata_json = ?, learning_reset_at = COALESCE(?, learning_reset_at),
               updated_at = CURRENT_TIMESTAMP(3)
           WHERE user_id = ?`,
          [nextRevision, JSON.stringify(metadata), learningResetAt, userId]
        );
      } else {
        await connection.execute(
          `INSERT INTO user_state_revisions
             (user_id, revision, state_created_at, metadata_json, learning_reset_at)
           VALUES (?, ?, COALESCE(?, CURRENT_TIMESTAMP(3)), ?, ?)`,
          [userId, nextRevision, asDate(state.createdAt), JSON.stringify(metadata), learningResetAt]
        );
      }
      await connection.commit();
      return nextRevision;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async #ensureLegacyMigration(userId) {
    const [rows] = await this.pool.execute(
      "SELECT revision FROM user_state_revisions WHERE user_id = ? LIMIT 1",
      [userId]
    );
    if (!rows[0]) await super.findByUserId(userId);
  }

  async #detectLearningReset(connection, userId, state, currentResetAt) {
    if (!isLearningResetCandidate(state)) return null;
    const [rows] = await connection.execute(
      `SELECT id FROM review_events
       WHERE user_id = ? AND (? IS NULL OR occurred_at > ?)
       ORDER BY occurred_at DESC, id DESC LIMIT 1`,
      [userId, currentResetAt, currentResetAt]
    );
    return rows[0] ? new Date() : null;
  }

  async #ensureDefaultSubscription(connection, userId) {
    const [rows] = await connection.execute(
      `SELECT uc.collection_id
       FROM user_collections uc
       JOIN collections c ON c.id = uc.collection_id
       WHERE uc.user_id = ? AND uc.status = 'active' AND c.is_default = TRUE AND c.archived_at IS NULL
       LIMIT 1`,
      [userId]
    );
    if (rows[0]) return;
    const [defaultRows] = await connection.execute(
      "SELECT id FROM collections WHERE is_default = TRUE AND archived_at IS NULL ORDER BY id LIMIT 1"
    );
    if (!defaultRows[0]) return;
    await connection.execute(
      `INSERT INTO user_collections (user_id, collection_id, status, subscribed_at, removed_at, last_seen_version)
       VALUES (?, ?, 'active', CURRENT_TIMESTAMP(3), NULL, 0)
       ON DUPLICATE KEY UPDATE status = 'active', removed_at = NULL`,
      [userId, defaultRows[0].id]
    );
  }

  async #loadStateContext(connection, userId) {
    const [subscriptionRows, membershipFormRows, progressRows] = await Promise.all([
      connection.execute(
        `SELECT uc.collection_id, uc.last_seen_version, c.public_id, c.content_version, c.kind
         FROM user_collections uc
         JOIN collections c ON c.id = uc.collection_id
         WHERE uc.user_id = ? AND uc.status = 'active'`,
        [userId]
      ),
      connection.execute(
        `SELECT ce.id AS membership_id, ce.collection_id, ce.vocabulary_entry_id,
                ce.introduced_version, ce.removed_version, ce.removed_at,
                ve.public_id AS vocabulary_public_id, ve.primary_form, ve.owner_user_id,
                c.kind AS collection_kind, s.title AS section_title, vf.normalized_form
         FROM user_collections uc
         JOIN collections c ON c.id = uc.collection_id
         JOIN collection_entries ce ON ce.collection_id = uc.collection_id
         JOIN vocabulary_entries ve ON ve.id = ce.vocabulary_entry_id AND ve.status = 'active'
         LEFT JOIN collection_sections s ON s.id = ce.section_id
         LEFT JOIN vocabulary_forms vf ON vf.vocabulary_entry_id = ve.id
         WHERE uc.user_id = ? AND uc.status = 'active'`,
        [userId]
      ),
      connection.execute(
        `SELECT user_id, vocabulary_entry_id, status, box, due_date, attempts, correct_count,
                mistake_count, current_streak, introduced_on, introduced_via, last_reviewed_at,
                last_promoted_on, blocked_until, mastered_at, personal_note, legacy_category
         FROM user_vocabulary_progress WHERE user_id = ?`,
        [userId]
      )
    ]);

    const subscriptions = new Map(subscriptionRows[0].map((row) => [String(row.collection_id), row]));
    const membershipsById = new Map();
    const vocabularyByPublicId = new Map();
    const vocabularyByNormalizedForm = new Map();
    const activeMembershipsByVocabularyId = new Map();
    const catalogCategoriesByVocabularyId = new Map();
    const personalVocabularyIds = new Set();

    for (const row of membershipFormRows[0]) {
      const membershipKey = String(row.membership_id);
      let membership = membershipsById.get(membershipKey);
      if (!membership) {
        membership = {
          id: row.membership_id,
          collection_id: row.collection_id,
          vocabulary_entry_id: row.vocabulary_entry_id,
          introduced_version: row.introduced_version,
          removed_version: row.removed_version,
          removed_at: row.removed_at,
          collection_kind: row.collection_kind,
          section_title: row.section_title
        };
        membershipsById.set(membershipKey, membership);
      }

      const vocabularyKey = String(row.vocabulary_entry_id);
      let vocabulary = vocabularyByPublicId.get(String(row.vocabulary_public_id));
      if (!vocabulary) {
        vocabulary = {
          id: row.vocabulary_entry_id,
          public_id: row.vocabulary_public_id,
          primary_form: row.primary_form,
          owner_user_id: row.owner_user_id,
          normalizedForms: new Set()
        };
        vocabularyByPublicId.set(String(row.vocabulary_public_id), vocabulary);
      }
      if (row.normalized_form) {
        vocabulary.normalizedForms.add(row.normalized_form);
        const current = vocabularyByNormalizedForm.get(row.normalized_form);
        if (!current || (current.owner_user_id !== null && vocabulary.owner_user_id === null)) {
          vocabularyByNormalizedForm.set(row.normalized_form, vocabulary);
        }
      }

      if (row.removed_at) continue;
      if (!activeMembershipsByVocabularyId.has(vocabularyKey)) {
        activeMembershipsByVocabularyId.set(vocabularyKey, []);
      }
      const activeList = activeMembershipsByVocabularyId.get(vocabularyKey);
      if (!activeList.some((item) => String(item.id) === membershipKey)) activeList.push(membership);
      if (row.collection_kind === "personal") {
        personalVocabularyIds.add(vocabularyKey);
      } else if (row.section_title) {
        if (!catalogCategoriesByVocabularyId.has(vocabularyKey)) {
          catalogCategoriesByVocabularyId.set(vocabularyKey, new Set());
        }
        catalogCategoriesByVocabularyId.get(vocabularyKey).add(row.section_title);
      }
    }

    return {
      subscriptions,
      memberships: [...membershipsById.values()],
      vocabularyByPublicId,
      vocabularyByNormalizedForm,
      activeMembershipsByVocabularyId,
      catalogCategoriesByVocabularyId,
      personalVocabularyIds,
      progressByVocabularyId: new Map(progressRows[0].map((row) => [String(row.vocabulary_entry_id), row])),
      personalCollectionId: null
    };
  }

  async #syncWordsEfficient(connection, userId, words, libraryVersions, context) {
    const seenVocabularyIds = new Set();
    const wordMap = new Map();

    for (const word of words) {
      const forms = cleanVocabularyForms(word?.term, word?.accepted);
      const vocabulary = await this.#resolveVocabulary(connection, userId, word, forms, context);
      const vocabularyKey = String(vocabulary.id);
      seenVocabularyIds.add(vocabularyKey);
      if (word?.id) wordMap.set(String(word.id), vocabulary.id);
      wordMap.set(String(vocabulary.public_id), vocabulary.id);

      if (!context.activeMembershipsByVocabularyId.has(vocabularyKey)) {
        const wasVisibleFromChangedCollection = context.memberships.some((membership) => {
          if (String(membership.vocabulary_entry_id) !== vocabularyKey) return false;
          const subscription = context.subscriptions.get(String(membership.collection_id));
          if (!subscription) return false;
          const seenVersion = Number(libraryVersions?.[subscription.public_id] ?? subscription.last_seen_version ?? 0);
          return membership.removed_version && Number(membership.removed_version) > seenVersion;
        });
        if (!wasVisibleFromChangedCollection) {
          const collectionId = await this.#ensurePersonalCollection(connection, userId, context);
          const membership = await this.#ensurePersonalMembership(
            connection,
            collectionId,
            vocabulary.id,
            word?.category
          );
          context.activeMembershipsByVocabularyId.set(vocabularyKey, [membership]);
          context.personalVocabularyIds.add(vocabularyKey);
        }
      }

      const catalogCategories = context.catalogCategoriesByVocabularyId.get(vocabularyKey) || new Set();
      const desired = progressFromWord(word, {
        personalMembership: context.personalVocabularyIds.has(vocabularyKey),
        catalogCategories
      });
      const existing = context.progressByVocabularyId.get(vocabularyKey);
      if (!desired.shouldStore) {
        if (existing) {
          await connection.execute(
            "DELETE FROM user_vocabulary_progress WHERE user_id = ? AND vocabulary_entry_id = ?",
            [userId, vocabulary.id]
          );
          context.progressByVocabularyId.delete(vocabularyKey);
        }
        continue;
      }
      if (sameProgress(existing, desired)) continue;

      await connection.execute(
        `INSERT INTO user_vocabulary_progress
           (user_id, vocabulary_entry_id, status, box, due_date, attempts, correct_count, mistake_count,
            current_streak, introduced_on, introduced_via, last_reviewed_at, last_promoted_on,
            blocked_until, mastered_at, personal_note, legacy_category)
         VALUES (?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = 'active', box = VALUES(box), due_date = VALUES(due_date),
           attempts = VALUES(attempts), correct_count = VALUES(correct_count), mistake_count = VALUES(mistake_count),
           current_streak = VALUES(current_streak), introduced_on = VALUES(introduced_on), introduced_via = VALUES(introduced_via),
           last_reviewed_at = VALUES(last_reviewed_at), last_promoted_on = VALUES(last_promoted_on),
           blocked_until = VALUES(blocked_until), mastered_at = VALUES(mastered_at),
           personal_note = VALUES(personal_note), legacy_category = VALUES(legacy_category)`,
        [
          userId, vocabulary.id, desired.box, desired.dueDate, desired.attempts,
          desired.correctCount, desired.mistakeCount, desired.currentStreak, desired.introducedOn,
          desired.introducedVia, asDate(desired.lastReviewedAt), desired.lastPromotedOn, desired.blockedUntil,
          asDate(desired.masteredAt), desired.personalNote, desired.legacyCategory
        ]
      );
      context.progressByVocabularyId.set(vocabularyKey, {
        status: "active", box: desired.box, due_date: desired.dueDate, attempts: desired.attempts,
        correct_count: desired.correctCount, mistake_count: desired.mistakeCount,
        current_streak: desired.currentStreak, introduced_on: desired.introducedOn,
        introduced_via: desired.introducedVia, last_reviewed_at: desired.lastReviewedAt,
        last_promoted_on: desired.lastPromotedOn, blocked_until: desired.blockedUntil,
        mastered_at: desired.masteredAt, personal_note: desired.personalNote,
        legacy_category: desired.legacyCategory
      });
    }

    for (const membership of context.memberships) {
      if (membership.removed_at || seenVocabularyIds.has(String(membership.vocabulary_entry_id))) continue;
      const subscription = context.subscriptions.get(String(membership.collection_id));
      if (!subscription) continue;
      const seenVersion = Number(libraryVersions?.[subscription.public_id] ?? subscription.last_seen_version ?? 0);
      if (Number(membership.introduced_version) > seenVersion) continue;
      const key = String(membership.vocabulary_entry_id);
      const existing = context.progressByVocabularyId.get(key);
      if (existing?.status === "excluded") continue;
      await connection.execute(
        `INSERT INTO user_vocabulary_progress (user_id, vocabulary_entry_id, status)
         VALUES (?, ?, 'excluded')
         ON DUPLICATE KEY UPDATE status = 'excluded'`,
        [userId, membership.vocabulary_entry_id]
      );
      context.progressByVocabularyId.set(key, { ...(existing || {}), status: "excluded" });
    }

    for (const subscription of context.subscriptions.values()) {
      const seenVersion = Number(libraryVersions?.[subscription.public_id] ?? subscription.last_seen_version ?? 0);
      const boundedVersion = Math.min(Number(subscription.content_version), Math.max(0, seenVersion));
      if (boundedVersion <= Number(subscription.last_seen_version || 0)) continue;
      await connection.execute(
        `UPDATE user_collections SET last_seen_version = ? WHERE user_id = ? AND collection_id = ?`,
        [boundedVersion, userId, subscription.collection_id]
      );
    }
    return wordMap;
  }

  async #resolveVocabulary(connection, userId, word, forms, context) {
    const byId = word?.id ? context.vocabularyByPublicId.get(String(word.id)) : null;
    const byForm = forms.map((item) => context.vocabularyByNormalizedForm.get(item.normalized)).find(Boolean) || null;

    if (byId?.owner_user_id !== null && byId?.owner_user_id !== undefined) {
      const overlaps = forms.some((item) => byId.normalizedForms.has(item.normalized));
      if (!overlaps && byForm && String(byForm.id) !== String(byId.id)) return byForm;
      if (!overlaps && !byForm) {
        await this.#updatePrivateVocabulary(connection, userId, byId, forms, context);
      }
      return byId;
    }
    if (byId) {
      const overlaps = forms.some((item) => byId.normalizedForms.has(item.normalized));
      if (overlaps) return byId;
      if (byForm) return byForm;
      return this.#createPrivateVocabulary(connection, userId, forms, context);
    }
    if (byForm) return byForm;

    const found = await this.#findVocabularyByForms(connection, userId, forms.map((item) => item.normalized));
    if (found) {
      this.#indexVocabulary(context, found, found.normalizedForms || new Set(forms.map((item) => item.normalized)));
      return found;
    }
    return this.#createPrivateVocabulary(connection, userId, forms, context);
  }

  async #findVocabularyByForms(connection, userId, normalizedForms) {
    const placeholders = normalizedForms.map(() => "?").join(",");
    const [rows] = await connection.execute(
      `SELECT ve.id, ve.public_id, ve.primary_form, ve.owner_user_id,
              GROUP_CONCAT(vf.normalized_form SEPARATOR '\u001f') AS normalized_forms
       FROM vocabulary_forms vf
       JOIN vocabulary_entries ve ON ve.id = vf.vocabulary_entry_id
       WHERE vf.normalized_form IN (${placeholders})
         AND ve.status = 'active' AND (ve.owner_user_id IS NULL OR ve.owner_user_id = ?)
       GROUP BY ve.id
       ORDER BY ve.owner_user_id IS NULL DESC, ve.id LIMIT 1`,
      [...normalizedForms, userId]
    );
    if (!rows[0]) return null;
    return {
      ...rows[0],
      normalizedForms: new Set(String(rows[0].normalized_forms || "").split("\u001f").filter(Boolean))
    };
  }

  async #createPrivateVocabulary(connection, userId, forms, context) {
    const primary = forms[0];
    const canonicalKey = privateCanonicalKey(userId, "en", primary.normalized);
    let vocabulary;
    try {
      const publicId = randomUUID();
      const [result] = await connection.execute(
        `INSERT INTO vocabulary_entries
           (public_id, language_code, primary_form, normalized_form, canonical_key, owner_user_id)
         VALUES (?, 'en', ?, ?, ?, ?)`,
        [publicId, primary.form, primary.normalized, canonicalKey, userId]
      );
      vocabulary = {
        id: result.insertId,
        public_id: publicId,
        primary_form: primary.form,
        owner_user_id: userId,
        normalizedForms: new Set()
      };
    } catch (error) {
      if (error?.code !== "ER_DUP_ENTRY") throw error;
      const [rows] = await connection.execute(
        "SELECT id, public_id, primary_form, owner_user_id FROM vocabulary_entries WHERE canonical_key = ? LIMIT 1",
        [canonicalKey]
      );
      vocabulary = { ...rows[0], normalizedForms: new Set() };
    }
    await this.#replacePrivateForms(connection, vocabulary.id, forms);
    vocabulary.normalizedForms = new Set(forms.map((item) => item.normalized));
    this.#indexVocabulary(context, vocabulary, vocabulary.normalizedForms);
    return vocabulary;
  }

  async #updatePrivateVocabulary(connection, userId, vocabulary, forms, context) {
    const primary = forms[0];
    await connection.execute(
      `UPDATE vocabulary_entries
       SET primary_form = ?, normalized_form = ?, canonical_key = ?
       WHERE id = ? AND owner_user_id = ?`,
      [primary.form, primary.normalized, privateCanonicalKey(userId, "en", primary.normalized), vocabulary.id, userId]
    );
    await this.#replacePrivateForms(connection, vocabulary.id, forms);
    for (const normalized of vocabulary.normalizedForms) {
      if (context.vocabularyByNormalizedForm.get(normalized) === vocabulary) {
        context.vocabularyByNormalizedForm.delete(normalized);
      }
    }
    vocabulary.primary_form = primary.form;
    vocabulary.normalizedForms = new Set(forms.map((item) => item.normalized));
    this.#indexVocabulary(context, vocabulary, vocabulary.normalizedForms);
  }

  async #replacePrivateForms(connection, vocabularyId, forms) {
    await connection.execute("DELETE FROM vocabulary_forms WHERE vocabulary_entry_id = ?", [vocabularyId]);
    for (const [index, item] of forms.entries()) {
      await connection.execute(
        `INSERT INTO vocabulary_forms (vocabulary_entry_id, form, normalized_form, is_primary)
         VALUES (?, ?, ?, ?)`,
        [vocabularyId, item.form, item.normalized, index === 0 ? 1 : 0]
      );
    }
  }

  #indexVocabulary(context, vocabulary, normalizedForms) {
    context.vocabularyByPublicId.set(String(vocabulary.public_id), vocabulary);
    for (const normalized of normalizedForms) {
      const current = context.vocabularyByNormalizedForm.get(normalized);
      if (!current || (current.owner_user_id !== null && vocabulary.owner_user_id === null)) {
        context.vocabularyByNormalizedForm.set(normalized, vocabulary);
      }
    }
  }

  async #ensurePersonalCollection(connection, userId, context) {
    if (context.personalCollectionId) return context.personalCollectionId;
    const publicId = `personal-${String(userId)}`;
    const [rows] = await connection.execute("SELECT id FROM collections WHERE public_id = ? LIMIT 1", [publicId]);
    let collectionId = rows[0]?.id;
    if (!collectionId) {
      const [result] = await connection.execute(
        `INSERT INTO collections
           (public_id, slug, title, description, kind, visibility, status, owner_user_id, published_at)
         VALUES (?, ?, 'واژه‌های من', 'واژه‌هایی که خودت به Vocora اضافه کرده‌ای.',
                 'personal', 'private', 'published', ?, CURRENT_TIMESTAMP(3))`,
        [publicId, publicId, userId]
      );
      collectionId = result.insertId;
    }
    await connection.execute(
      `INSERT INTO user_collections (user_id, collection_id, status, subscribed_at, removed_at, last_seen_version)
       VALUES (?, ?, 'active', CURRENT_TIMESTAMP(3), NULL, 1)
       ON DUPLICATE KEY UPDATE status = 'active', removed_at = NULL`,
      [userId, collectionId]
    );
    context.personalCollectionId = collectionId;
    if (!context.subscriptions.has(String(collectionId))) {
      context.subscriptions.set(String(collectionId), {
        collection_id: collectionId,
        last_seen_version: 1,
        public_id: publicId,
        content_version: 1,
        kind: "personal"
      });
    }
    return collectionId;
  }

  async #ensurePersonalMembership(connection, collectionId, vocabularyId, category) {
    const [existingRows] = await connection.execute(
      `SELECT id FROM collection_entries
       WHERE collection_id = ? AND vocabulary_entry_id = ? AND removed_at IS NULL LIMIT 1`,
      [collectionId, vocabularyId]
    );
    if (existingRows[0]) return { id: existingRows[0].id, collection_id: collectionId, vocabulary_entry_id: vocabularyId };

    let sectionId = null;
    const title = String(category || "").trim();
    if (title && title !== "بدون دسته‌بندی") {
      const [sectionRows] = await connection.execute(
        `SELECT id FROM collection_sections
         WHERE collection_id = ? AND title = ? AND parent_section_id IS NULL LIMIT 1`,
        [collectionId, title]
      );
      sectionId = sectionRows[0]?.id;
      if (!sectionId) {
        const [result] = await connection.execute(
          `INSERT INTO collection_sections (public_id, collection_id, title, position)
           VALUES (?, ?, ?, 0)`,
          [randomUUID(), collectionId, title]
        );
        sectionId = result.insertId;
      }
    }
    const [positionRows] = await connection.execute(
      "SELECT COALESCE(MAX(position), 0) + 1 AS next_position FROM collection_entries WHERE collection_id = ?",
      [collectionId]
    );
    const [result] = await connection.execute(
      `INSERT INTO collection_entries
         (public_id, collection_id, section_id, vocabulary_entry_id, position, introduced_version)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [randomUUID(), collectionId, sectionId, vocabularyId, Number(positionRows[0].next_position)]
    );
    return { id: result.insertId, collection_id: collectionId, vocabulary_entry_id: vocabularyId };
  }

  async #syncSettingsEfficient(connection, userId, input) {
    const desired = boundedSettings(input);
    const [rows] = await connection.execute(
      "SELECT daily_new, daily_goal, voice_rate, theme FROM user_settings WHERE user_id = ? LIMIT 1",
      [userId]
    );
    const current = rows[0];
    if (current && Number(current.daily_new) === desired.dailyNew &&
        Number(current.daily_goal) === desired.dailyGoal && Number(current.voice_rate) === desired.voiceRate &&
        current.theme === desired.theme) return;
    await connection.execute(
      `INSERT INTO user_settings (user_id, daily_new, daily_goal, voice_rate, theme)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE daily_new = VALUES(daily_new), daily_goal = VALUES(daily_goal),
                               voice_rate = VALUES(voice_rate), theme = VALUES(theme)`,
      [userId, desired.dailyNew, desired.dailyGoal, desired.voiceRate, desired.theme]
    );
  }

  async #syncDailyEfficient(connection, userId, daily) {
    const [rows] = await connection.execute(
      `SELECT day, attempts, correct_count, wrong_count, new_added, session_count, duration_seconds
       FROM user_daily_stats WHERE user_id = ?`,
      [userId]
    );
    const existing = new Map(rows.map((row) => [asDay(row.day), row]));
    for (const [day, record] of Object.entries(daily || {})) {
      if (!/^\d{4}-\d{2}-\d{2}$/u.test(day) || sameDaily(existing.get(day), record)) continue;
      await connection.execute(
        `INSERT INTO user_daily_stats
           (user_id, day, attempts, correct_count, wrong_count, new_added, session_count, duration_seconds)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE attempts = VALUES(attempts), correct_count = VALUES(correct_count),
                                 wrong_count = VALUES(wrong_count), new_added = VALUES(new_added),
                                 session_count = VALUES(session_count), duration_seconds = VALUES(duration_seconds)`,
        [
          userId, day, nonNegativeInteger(record?.attempts), nonNegativeInteger(record?.correct),
          nonNegativeInteger(record?.wrong), nonNegativeInteger(record?.newAdded),
          nonNegativeInteger(record?.sessions), nonNegativeInteger(record?.durationSeconds)
        ]
      );
    }
  }

  #eventsAfterCursor(history, cursor) {
    if (!cursor || !history.length) return cursor ? [] : history;
    const length = nonNegativeInteger(cursor.historyLength, -1);
    const fingerprint = cursor.lastReviewFingerprint || null;
    if (length >= 0 && length <= history.length) {
      if (length === 0 && !fingerprint) return history;
      if (length > 0 && reviewFingerprint(history[length - 1]) === fingerprint) return history.slice(length);
    }
    if (fingerprint) {
      for (let index = history.length - 1; index >= 0; index -= 1) {
        if (reviewFingerprint(history[index]) === fingerprint) return history.slice(index + 1);
      }
    }
    return history;
  }

  async #appendReviewEventsEfficient(connection, userId, history, cursor, wordMap, stateContext, sessionPublicId) {
    const events = this.#eventsAfterCursor(history, cursor);
    if (!events.length) return;
    let practiceSessionId = null;
    if (sessionPublicId) {
      const [sessionRows] = await connection.execute(
        "SELECT id FROM practice_sessions WHERE public_id = ? AND user_id = ? LIMIT 1",
        [String(sessionPublicId), userId]
      );
      practiceSessionId = sessionRows[0]?.id ?? null;
    }

    for (const event of events) {
      let vocabularyId = event?.wordId ? wordMap.get(String(event.wordId)) : null;
      if (!vocabularyId && event?.wordId) {
        const vocabulary = stateContext.vocabularyByPublicId.get(String(event.wordId));
        vocabularyId = vocabulary?.id ?? null;
      }
      if (!vocabularyId && event?.term) {
        const vocabulary = stateContext.vocabularyByNormalizedForm.get(normalizeVocabularyForm(event.term));
        vocabularyId = vocabulary?.id ?? null;
      }
      let collectionId = null;
      if (vocabularyId) {
        collectionId = stateContext.activeMembershipsByVocabularyId.get(String(vocabularyId))?.[0]?.collection_id ?? null;
      }
      const occurredAt = asDate(event?.at) || (asDay(event?.day) ? new Date(`${asDay(event.day)}T12:00:00.000Z`) : new Date());
      const localDay = asDay(event?.day) || occurredAt.toISOString().slice(0, 10);
      await connection.execute(
        `INSERT IGNORE INTO review_events
           (event_key, user_id, vocabulary_entry_id, collection_id, practice_session_id,
            occurred_at, local_day, answer, correct, mode, previous_box, new_box,
            promoted, mistake_number, term_snapshot, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reviewEventKey(userId, event), userId, vocabularyId, collectionId, practiceSessionId,
          occurredAt, localDay, event?.answer === undefined ? null : String(event.answer),
          event?.correct ? 1 : 0, event?.mode ? String(event.mode).slice(0, 64) : null,
          event?.previousBox === null || event?.previousBox === undefined ? null : boxNumber(event.previousBox),
          event?.newBox === null || event?.newBox === undefined ? null : boxNumber(event.newBox),
          event?.promoted ? 1 : 0,
          event?.mistakeNumber === null || event?.mistakeNumber === undefined ? null : nonNegativeInteger(event.mistakeNumber),
          String(event?.term || "").slice(0, 512),
          JSON.stringify({ source: "normalized-state-adapter-v2" })
        ]
      );
    }
  }
}
