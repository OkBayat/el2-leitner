import { createHash, randomUUID } from "node:crypto";
import { ConflictError } from "../../../domain/errors.js";
import {
  cleanVocabularyForms,
  normalizeVocabularyForm,
  privateCanonicalKey
} from "../../../domain/library/VocabularyNormalizer.js";

const ROOT_DATA_KEYS = new Set(["words", "history", "daily", "settings"]);
const DEFAULT_SETTINGS = { dailyNew: 10, dailyGoal: 20, voiceRate: 0.85, theme: "system" };

function parseJson(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (Buffer.isBuffer(value)) value = value.toString("utf8");
  return typeof value === "string" ? JSON.parse(value) : value;
}

function asDay(value) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
  return null;
}

function asIso(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? null : date.toISOString();
  }
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString();
  return null;
}

function asDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function nonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : fallback;
}

function boxNumber(value) {
  return Math.min(5, nonNegativeInteger(value, 0));
}

function rootMetadata(state) {
  return Object.fromEntries(Object.entries(state || {}).filter(([key]) => !ROOT_DATA_KEYS.has(key)));
}

export function isLearningResetCandidate(state) {
  if (!state || !Array.isArray(state.history) || state.history.length !== 0) return false;
  const words = Array.isArray(state.words) ? state.words : [];
  return words.every((word) =>
    nonNegativeInteger(word?.attempts) === 0 &&
    nonNegativeInteger(word?.correct) === 0 &&
    nonNegativeInteger(word?.mistakes) === 0 &&
    nonNegativeInteger(word?.currentStreak) === 0 &&
    !word?.lastReviewed &&
    !word?.lastPromotedDay &&
    !word?.masteredAt
  );
}

export function needsProgressRow(word, { personalMembership = false, catalogCategories = [] } = {}) {
  if (personalMembership) return true;
  const category = String(word?.category || "").trim();
  const normalizedCatalogCategories = new Set(
    [...catalogCategories].map((value) => String(value || "").trim()).filter(Boolean)
  );
  const categoryOverride = Boolean(
    category && category !== "بدون دسته‌بندی" && !normalizedCatalogCategories.has(category)
  );
  return Boolean(
    boxNumber(word?.box) > 0 ||
    word?.due ||
    nonNegativeInteger(word?.attempts) > 0 ||
    nonNegativeInteger(word?.correct) > 0 ||
    nonNegativeInteger(word?.mistakes) > 0 ||
    nonNegativeInteger(word?.currentStreak) > 0 ||
    word?.introducedOn ||
    word?.addedSource ||
    word?.lastReviewed ||
    word?.lastPromotedDay ||
    word?.blockedUntil ||
    word?.masteredAt ||
    String(word?.notes || "").trim() ||
    categoryOverride
  );
}

export function reviewEventKey(userId, event) {
  const stable = [
    String(userId),
    event?.at ?? null,
    event?.day ?? null,
    event?.term ?? null,
    event?.answer ?? null,
    Boolean(event?.correct),
    event?.mode ?? null,
    event?.previousBox ?? null,
    event?.newBox ?? null,
    event?.mistakeNumber ?? null
  ];
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

export class MySqlLearningStateRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findByUserId(userId) {
    await this.#migrateLegacyIfNeeded(userId);
    const [revisionRows] = await this.pool.execute(
      "SELECT revision, state_created_at, metadata_json, learning_reset_at, created_at, updated_at FROM user_state_revisions WHERE user_id = ? LIMIT 1",
      [userId]
    );
    const revisionRow = revisionRows[0];
    if (!revisionRow) return { state: null, revision: 0 };

    const [settingsRows, dailyRows, wordRows, eventRows, subscriptionRows] = await Promise.all([
      this.pool.execute(
        "SELECT daily_new, daily_goal, voice_rate, theme FROM user_settings WHERE user_id = ? LIMIT 1",
        [userId]
      ),
      this.pool.execute(
        `SELECT day, attempts, correct_count, wrong_count, new_added, session_count, duration_seconds
         FROM user_daily_stats WHERE user_id = ? ORDER BY day`,
        [userId]
      ),
      this.pool.execute(
        `SELECT ve.public_id, ve.primary_form,
                GROUP_CONCAT(DISTINCT vf.form ORDER BY vf.form SEPARATOR '\u001f') AS accepted_forms,
                MIN(CASE WHEN source.user_id IS NOT NULL AND source.is_default THEN 0 WHEN source.user_id IS NOT NULL THEN 1 ELSE 2 END) AS source_priority,
                MIN(source.subscribed_at) AS source_subscribed_at,
                MIN(source.position) AS source_position,
                COALESCE(MAX(uvp.legacy_category), MIN(s.title), 'بدون دسته‌بندی') AS category,
                MAX(uvp.personal_note) AS personal_note,
                MAX(uvp.box) AS box, MAX(uvp.due_date) AS due_date,
                MAX(uvp.attempts) AS attempts, MAX(uvp.correct_count) AS correct_count,
                MAX(uvp.mistake_count) AS mistake_count, MAX(uvp.current_streak) AS current_streak,
                MAX(uvp.introduced_on) AS introduced_on, MAX(uvp.introduced_via) AS introduced_via,
                MAX(uvp.last_reviewed_at) AS last_reviewed_at, MAX(uvp.last_promoted_on) AS last_promoted_on,
                MAX(uvp.blocked_until) AS blocked_until, MAX(uvp.mastered_at) AS mastered_at,
                COALESCE(MAX(uvp.created_at), MIN(ve.created_at)) AS progress_created_at
         FROM vocabulary_entries ve
         LEFT JOIN (
           SELECT uc.user_id, uc.subscribed_at, c.is_default,
                  ce.vocabulary_entry_id, ce.position, ce.section_id
           FROM user_collections uc
           JOIN collections c ON c.id = uc.collection_id
           JOIN collection_entries ce ON ce.collection_id = c.id AND ce.removed_at IS NULL
           WHERE uc.user_id = ? AND uc.status = 'active'
         ) source ON source.vocabulary_entry_id = ve.id
         LEFT JOIN vocabulary_forms vf ON vf.vocabulary_entry_id = ve.id
         LEFT JOIN collection_sections s ON s.id = source.section_id
         LEFT JOIN user_vocabulary_progress uvp
           ON uvp.user_id = ? AND uvp.vocabulary_entry_id = ve.id
         WHERE ve.status = 'active'
           AND (source.user_id IS NOT NULL OR uvp.user_id IS NOT NULL)
           AND COALESCE(uvp.status, 'active') <> 'excluded'
         GROUP BY ve.id
         ORDER BY source_priority, source_subscribed_at, source_position, ve.id`,
        [userId, userId]
      ),
      this.pool.execute(
        `SELECT * FROM (
           SELECT re.occurred_at, re.local_day, re.answer, re.correct, re.mode,
                  re.previous_box, re.new_box, re.promoted, re.mistake_number, re.term_snapshot,
                  ve.public_id AS vocabulary_public_id
           FROM review_events re
           LEFT JOIN vocabulary_entries ve ON ve.id = re.vocabulary_entry_id
           WHERE re.user_id = ?
             AND (? IS NULL OR re.occurred_at > ?)
           ORDER BY re.occurred_at DESC, re.id DESC
           LIMIT 20000
         ) recent
         ORDER BY occurred_at, local_day`,
        [userId, revisionRow.learning_reset_at, revisionRow.learning_reset_at]
      ),
      this.pool.execute(
        `SELECT c.public_id, c.content_version
         FROM user_collections uc
         JOIN collections c ON c.id = uc.collection_id
         WHERE uc.user_id = ? AND uc.status = 'active'`,
        [userId]
      )
    ]);

    const metadata = parseJson(revisionRow.metadata_json, {}) || {};
    const settingsRow = settingsRows[0][0];
    const libraryVersions = Object.fromEntries(
      subscriptionRows[0].map((row) => [row.public_id, Number(row.content_version)])
    );
    const state = {
      ...metadata,
      schemaVersion: Number(metadata.schemaVersion) || 2,
      createdAt: metadata.createdAt || asIso(revisionRow.state_created_at) || asIso(revisionRow.created_at),
      updatedAt: asIso(revisionRow.updated_at) || metadata.updatedAt || new Date().toISOString(),
      normalizedPersistenceVersion: 1,
      libraryVersions,
      settings: settingsRow
        ? {
            dailyNew: Number(settingsRow.daily_new),
            dailyGoal: Number(settingsRow.daily_goal),
            voiceRate: Number(settingsRow.voice_rate),
            theme: settingsRow.theme
          }
        : { ...DEFAULT_SETTINGS },
      words: wordRows[0].map((row, index) => ({
        id: row.public_id,
        number: index + 1,
        term: row.primary_form,
        accepted: [
          row.primary_form,
          ...String(row.accepted_forms || "")
            .split("\u001f")
            .filter(Boolean)
            .filter((form) => normalizeVocabularyForm(form) !== normalizeVocabularyForm(row.primary_form))
        ],
        category: row.category || "بدون دسته‌بندی",
        notes: row.personal_note || "",
        createdAt: asIso(row.progress_created_at) || new Date().toISOString(),
        box: boxNumber(row.box),
        due: asDay(row.due_date),
        attempts: nonNegativeInteger(row.attempts),
        correct: nonNegativeInteger(row.correct_count),
        mistakes: nonNegativeInteger(row.mistake_count),
        currentStreak: nonNegativeInteger(row.current_streak),
        introducedOn: asDay(row.introduced_on),
        addedSource: row.introduced_via || null,
        lastReviewed: asIso(row.last_reviewed_at),
        lastPromotedDay: asDay(row.last_promoted_on),
        blockedUntil: asDay(row.blocked_until),
        masteredAt: asIso(row.mastered_at)
      })),
      daily: Object.fromEntries(dailyRows[0].map((row) => [
        asDay(row.day),
        {
          attempts: Number(row.attempts),
          correct: Number(row.correct_count),
          wrong: Number(row.wrong_count),
          newAdded: Number(row.new_added),
          sessions: Number(row.session_count),
          durationSeconds: Number(row.duration_seconds)
        }
      ])),
      history: eventRows[0].map((row) => ({
        at: asIso(row.occurred_at),
        day: asDay(row.local_day),
        wordId: row.vocabulary_public_id || null,
        term: row.term_snapshot,
        answer: row.answer || "",
        correct: Boolean(row.correct),
        mode: row.mode || "legacy",
        promoted: Boolean(row.promoted),
        previousBox: row.previous_box === null ? null : Number(row.previous_box),
        newBox: row.new_box === null ? null : Number(row.new_box),
        mistakeNumber: row.mistake_number === null ? null : Number(row.mistake_number)
      }))
    };

    return { state, revision: Number(revisionRow.revision) };
  }

  async save(userId, state, expectedRevision, context = {}) {
    await this.#migrateLegacyIfNeeded(userId);
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [revisionRows] = await connection.execute(
        "SELECT revision, learning_reset_at FROM user_state_revisions WHERE user_id = ? LIMIT 1 FOR UPDATE",
        [userId]
      );
      const currentRevision = revisionRows[0] ? Number(revisionRows[0].revision) : 0;
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
        revisionRows[0]?.learning_reset_at ?? null
      );
      if (learningResetAt) {
        await connection.execute("DELETE FROM user_daily_stats WHERE user_id = ?", [userId]);
      }

      await this.#ensureDefaultSubscription(connection, userId);
      const wordMap = await this.#syncWords(connection, userId, Array.isArray(state.words) ? state.words : [], state.libraryVersions || {});
      await this.#syncSettings(connection, userId, state.settings || {});
      await this.#syncDaily(connection, userId, state.daily || {});
      await this.#appendReviewEvents(connection, userId, Array.isArray(state.history) ? state.history : [], wordMap, context.practiceSessionId);

      const nextRevision = expectedRevision + 1;
      const metadata = rootMetadata(state);
      if (revisionRows[0]) {
        await connection.execute(
          `UPDATE user_state_revisions
           SET revision = ?, metadata_json = ?,
               learning_reset_at = COALESCE(?, learning_reset_at),
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

  async migrateAllLegacyStates() {
    const [rows] = await this.pool.execute("SELECT user_id FROM learning_states ORDER BY user_id");
    let migrated = 0;
    for (const row of rows) {
      if (await this.#migrateLegacyIfNeeded(row.user_id)) migrated += 1;
    }
    return migrated;
  }

  async #migrateLegacyIfNeeded(userId) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [normalizedRows] = await connection.execute(
        "SELECT revision FROM user_state_revisions WHERE user_id = ? LIMIT 1 FOR UPDATE",
        [userId]
      );
      if (normalizedRows[0]) {
        await connection.commit();
        return false;
      }

      const [legacyRows] = await connection.execute(
        "SELECT state_json, revision, created_at, updated_at FROM learning_states WHERE user_id = ? LIMIT 1 FOR UPDATE",
        [userId]
      );
      const legacy = legacyRows[0];
      if (!legacy) {
        await connection.commit();
        return false;
      }

      const state = parseJson(legacy.state_json, {}) || {};
      await this.#ensureDefaultSubscription(connection, userId);
      const [activeCollections] = await connection.execute(
        `SELECT c.public_id, c.content_version
         FROM user_collections uc JOIN collections c ON c.id = uc.collection_id
         WHERE uc.user_id = ? AND uc.status = 'active' AND c.is_default = TRUE`,
        [userId]
      );
      const migrationVersions = Object.fromEntries(activeCollections.map((row) => [row.public_id, Number(row.content_version)]));
      const wordMap = await this.#syncWords(connection, userId, Array.isArray(state.words) ? state.words : [], migrationVersions);
      await this.#syncSettings(connection, userId, state.settings || {});
      await this.#syncDaily(connection, userId, state.daily || {});
      await this.#appendReviewEvents(connection, userId, Array.isArray(state.history) ? state.history : [], wordMap);
      await connection.execute(
        `INSERT INTO user_state_revisions
           (user_id, revision, state_created_at, metadata_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          Number(legacy.revision),
          asDate(state.createdAt) || legacy.created_at,
          JSON.stringify(rootMetadata(state)),
          legacy.created_at,
          legacy.updated_at
        ]
      );
      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
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

  async #syncSettings(connection, userId, settings) {
    const dailyNew = Math.min(50, Math.max(1, nonNegativeInteger(settings.dailyNew, DEFAULT_SETTINGS.dailyNew)));
    const dailyGoal = Math.min(200, Math.max(5, nonNegativeInteger(settings.dailyGoal, DEFAULT_SETTINGS.dailyGoal)));
    const voiceRate = Number(settings.voiceRate);
    const safeVoiceRate = Number.isFinite(voiceRate) ? Math.min(1.2, Math.max(0.5, voiceRate)) : DEFAULT_SETTINGS.voiceRate;
    const theme = ["system", "light", "dark"].includes(settings.theme) ? settings.theme : DEFAULT_SETTINGS.theme;
    await connection.execute(
      `INSERT INTO user_settings (user_id, daily_new, daily_goal, voice_rate, theme)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE daily_new = VALUES(daily_new), daily_goal = VALUES(daily_goal),
                               voice_rate = VALUES(voice_rate), theme = VALUES(theme)`,
      [userId, dailyNew, dailyGoal, safeVoiceRate, theme]
    );
  }

  async #syncDaily(connection, userId, daily) {
    for (const [day, record] of Object.entries(daily || {})) {
      if (!/^\d{4}-\d{2}-\d{2}$/u.test(day)) continue;
      await connection.execute(
        `INSERT INTO user_daily_stats
           (user_id, day, attempts, correct_count, wrong_count, new_added, session_count, duration_seconds)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE attempts = VALUES(attempts), correct_count = VALUES(correct_count),
                                 wrong_count = VALUES(wrong_count), new_added = VALUES(new_added),
                                 session_count = VALUES(session_count), duration_seconds = VALUES(duration_seconds)`,
        [
          userId,
          day,
          nonNegativeInteger(record?.attempts),
          nonNegativeInteger(record?.correct),
          nonNegativeInteger(record?.wrong),
          nonNegativeInteger(record?.newAdded),
          nonNegativeInteger(record?.sessions),
          nonNegativeInteger(record?.durationSeconds)
        ]
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

  async #syncWords(connection, userId, words, libraryVersions) {
    const [subscriptionRows] = await connection.execute(
      `SELECT uc.collection_id, uc.last_seen_version, c.public_id, c.content_version
       FROM user_collections uc
       JOIN collections c ON c.id = uc.collection_id
       WHERE uc.user_id = ? AND uc.status = 'active'`,
      [userId]
    );
    const subscriptions = new Map(subscriptionRows.map((row) => [String(row.collection_id), row]));
    const [membershipRows] = await connection.execute(
      `SELECT ce.collection_id, ce.vocabulary_entry_id, ce.introduced_version, ce.removed_version, ce.removed_at,
              ve.public_id AS vocabulary_public_id, c.kind AS collection_kind, s.title AS section_title
       FROM user_collections uc
       JOIN collections c ON c.id = uc.collection_id
       JOIN collection_entries ce ON ce.collection_id = uc.collection_id
       JOIN vocabulary_entries ve ON ve.id = ce.vocabulary_entry_id
       LEFT JOIN collection_sections s ON s.id = ce.section_id
       WHERE uc.user_id = ? AND uc.status = 'active'`,
      [userId]
    );
    const activeVocabularyIds = new Set(
      membershipRows.filter((row) => !row.removed_at).map((row) => String(row.vocabulary_entry_id))
    );
    const personalVocabularyIds = new Set();
    const catalogCategoriesByVocabularyId = new Map();
    for (const membership of membershipRows) {
      if (membership.removed_at) continue;
      const vocabularyId = String(membership.vocabulary_entry_id);
      if (membership.collection_kind === "personal") {
        personalVocabularyIds.add(vocabularyId);
        continue;
      }
      if (!membership.section_title) continue;
      if (!catalogCategoriesByVocabularyId.has(vocabularyId)) {
        catalogCategoriesByVocabularyId.set(vocabularyId, new Set());
      }
      catalogCategoriesByVocabularyId.get(vocabularyId).add(membership.section_title);
    }
    const seenVocabularyIds = new Set();
    const publicIdToInternalId = new Map();
    const personalCollection = { value: null };

    for (const word of words) {
      const forms = cleanVocabularyForms(word?.term, word?.accepted);
      let vocabulary = null;
      if (word?.id) {
        const [idRows] = await connection.execute(
          "SELECT id, public_id, primary_form, owner_user_id FROM vocabulary_entries WHERE public_id = ? AND status = 'active' LIMIT 1",
          [String(word.id)]
        );
        vocabulary = idRows[0] ?? null;
      }
      if (!vocabulary) vocabulary = await this.#findVocabularyByForms(connection, userId, forms.map(({ normalized }) => normalized));
      if (!vocabulary) vocabulary = await this.#createPrivateVocabulary(connection, userId, forms);

      const vocabularyId = String(vocabulary.id);
      seenVocabularyIds.add(vocabularyId);
      publicIdToInternalId.set(String(word?.id || vocabulary.public_id), vocabulary.id);
      publicIdToInternalId.set(vocabulary.public_id, vocabulary.id);

      if (!activeVocabularyIds.has(vocabularyId)) {
        const wasVisibleFromChangedCollection = membershipRows.some((membership) => {
          if (String(membership.vocabulary_entry_id) !== vocabularyId) return false;
          const subscription = subscriptions.get(String(membership.collection_id));
          if (!subscription) return false;
          const seenVersion = Number(libraryVersions?.[subscription.public_id] ?? subscription.last_seen_version ?? 0);
          return membership.removed_version && Number(membership.removed_version) > seenVersion;
        });
        if (!wasVisibleFromChangedCollection) {
          const collectionId = await this.#ensurePersonalCollection(connection, userId, personalCollection);
          await this.#ensurePersonalMembership(connection, collectionId, vocabulary.id, word?.category);
          activeVocabularyIds.add(vocabularyId);
          personalVocabularyIds.add(vocabularyId);
        }
      }

      const storeProgress = needsProgressRow(word, {
        personalMembership: personalVocabularyIds.has(vocabularyId),
        catalogCategories: catalogCategoriesByVocabularyId.get(vocabularyId) || []
      });
      if (!storeProgress) {
        await connection.execute(
          "DELETE FROM user_vocabulary_progress WHERE user_id = ? AND vocabulary_entry_id = ?",
          [userId, vocabulary.id]
        );
        continue;
      }

      const catalogCategories = catalogCategoriesByVocabularyId.get(vocabularyId) || new Set();
      const category = String(word?.category || "").trim();
      const legacyCategory = category && category !== "بدون دسته‌بندی" && !catalogCategories.has(category)
        ? category.slice(0, 255)
        : null;
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
          userId,
          vocabulary.id,
          boxNumber(word?.box),
          asDay(word?.due),
          nonNegativeInteger(word?.attempts),
          nonNegativeInteger(word?.correct),
          nonNegativeInteger(word?.mistakes),
          nonNegativeInteger(word?.currentStreak),
          asDay(word?.introducedOn),
          word?.addedSource ? String(word.addedSource).slice(0, 64) : null,
          asDate(word?.lastReviewed),
          asDay(word?.lastPromotedDay),
          asDay(word?.blockedUntil),
          asDate(word?.masteredAt),
          word?.notes ? String(word.notes).slice(0, 10000) : null,
          legacyCategory
        ]
      );
    }

    for (const membership of membershipRows) {
      if (membership.removed_at || seenVocabularyIds.has(String(membership.vocabulary_entry_id))) continue;
      const subscription = subscriptions.get(String(membership.collection_id));
      if (!subscription) continue;
      const seenVersion = Number(libraryVersions?.[subscription.public_id] ?? subscription.last_seen_version ?? 0);
      if (Number(membership.introduced_version) > seenVersion) continue;
      await connection.execute(
        `INSERT INTO user_vocabulary_progress (user_id, vocabulary_entry_id, status)
         VALUES (?, ?, 'excluded')
         ON DUPLICATE KEY UPDATE status = 'excluded'`,
        [userId, membership.vocabulary_entry_id]
      );
    }

    for (const subscription of subscriptionRows) {
      const seenVersion = Number(libraryVersions?.[subscription.public_id] ?? subscription.last_seen_version ?? 0);
      const boundedVersion = Math.min(Number(subscription.content_version), Math.max(0, seenVersion));
      await connection.execute(
        `UPDATE user_collections SET last_seen_version = GREATEST(last_seen_version, ?)
         WHERE user_id = ? AND collection_id = ?`,
        [boundedVersion, userId, subscription.collection_id]
      );
    }

    return publicIdToInternalId;
  }

  async #findVocabularyByForms(connection, userId, normalizedForms) {
    const placeholders = normalizedForms.map(() => "?").join(",");
    const [rows] = await connection.execute(
      `SELECT ve.id, ve.public_id, ve.primary_form, ve.owner_user_id
       FROM vocabulary_forms vf
       JOIN vocabulary_entries ve ON ve.id = vf.vocabulary_entry_id
       WHERE vf.normalized_form IN (${placeholders})
         AND ve.status = 'active' AND (ve.owner_user_id IS NULL OR ve.owner_user_id = ?)
       ORDER BY ve.owner_user_id IS NULL DESC, vf.is_primary DESC, ve.id
       LIMIT 1`,
      [...normalizedForms, userId]
    );
    return rows[0] ?? null;
  }

  async #createPrivateVocabulary(connection, userId, forms) {
    const primary = forms[0];
    const canonicalKey = privateCanonicalKey(userId, "en", primary.normalized);
    let id;
    let publicId = randomUUID();
    try {
      const [result] = await connection.execute(
        `INSERT INTO vocabulary_entries
           (public_id, language_code, primary_form, normalized_form, canonical_key, owner_user_id)
         VALUES (?, 'en', ?, ?, ?, ?)`,
        [publicId, primary.form, primary.normalized, canonicalKey, userId]
      );
      id = result.insertId;
    } catch (error) {
      if (error?.code !== "ER_DUP_ENTRY") throw error;
      const [rows] = await connection.execute(
        "SELECT id, public_id FROM vocabulary_entries WHERE canonical_key = ? LIMIT 1",
        [canonicalKey]
      );
      id = rows[0].id;
      publicId = rows[0].public_id;
    }
    for (const [index, form] of forms.entries()) {
      await connection.execute(
        `INSERT INTO vocabulary_forms (vocabulary_entry_id, form, normalized_form, is_primary)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE form = VALUES(form), is_primary = GREATEST(is_primary, VALUES(is_primary))`,
        [id, form.form, form.normalized, index === 0 ? 1 : 0]
      );
    }
    return { id, public_id: publicId, primary_form: primary.form, owner_user_id: userId };
  }

  async #ensurePersonalCollection(connection, userId, holder) {
    if (holder.value) return holder.value;
    const publicId = `personal-${String(userId)}`;
    const slug = `personal-${String(userId)}`;
    const [rows] = await connection.execute("SELECT id FROM collections WHERE public_id = ? LIMIT 1", [publicId]);
    let collectionId = rows[0]?.id;
    if (!collectionId) {
      const [result] = await connection.execute(
        `INSERT INTO collections
           (public_id, slug, title, description, kind, visibility, status, owner_user_id, published_at)
         VALUES (?, ?, 'واژه‌های من', 'واژه‌هایی که خودت به Vocora اضافه کرده‌ای.', 'personal', 'private', 'published', ?, CURRENT_TIMESTAMP(3))`,
        [publicId, slug, userId]
      );
      collectionId = result.insertId;
    }
    await connection.execute(
      `INSERT INTO user_collections (user_id, collection_id, status, subscribed_at, last_seen_version)
       VALUES (?, ?, 'active', CURRENT_TIMESTAMP(3), 1)
       ON DUPLICATE KEY UPDATE status = 'active', removed_at = NULL`,
      [userId, collectionId]
    );
    holder.value = collectionId;
    return collectionId;
  }

  async #ensurePersonalMembership(connection, collectionId, vocabularyId, category) {
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
    await connection.execute(
      `INSERT INTO collection_entries
         (public_id, collection_id, section_id, vocabulary_entry_id, position, introduced_version)
       VALUES (?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE section_id = COALESCE(VALUES(section_id), section_id)`,
      [randomUUID(), collectionId, sectionId, vocabularyId, Number(positionRows[0].next_position)]
    );
  }

  async #appendReviewEvents(connection, userId, history, wordMap, practiceSessionPublicId = null) {
    let practiceSessionId = null;
    if (practiceSessionPublicId) {
      const [sessionRows] = await connection.execute(
        `SELECT id FROM practice_sessions
         WHERE public_id = ? AND user_id = ? LIMIT 1`,
        [String(practiceSessionPublicId), userId]
      );
      practiceSessionId = sessionRows[0]?.id ?? null;
    }
    for (const event of history) {
      const occurredAt = asDate(event?.at) || (asDay(event?.day) ? new Date(`${asDay(event.day)}T12:00:00.000Z`) : new Date());
      const localDay = asDay(event?.day) || occurredAt.toISOString().slice(0, 10);
      let vocabularyId = event?.wordId ? wordMap.get(String(event.wordId)) : null;
      if (!vocabularyId && event?.wordId) {
        const [rows] = await connection.execute(
          "SELECT id FROM vocabulary_entries WHERE public_id = ? LIMIT 1",
          [String(event.wordId)]
        );
        vocabularyId = rows[0]?.id ?? null;
      }
      let collectionId = null;
      if (vocabularyId) {
        const [rows] = await connection.execute(
          `SELECT ce.collection_id
           FROM user_collections uc
           JOIN collection_entries ce ON ce.collection_id = uc.collection_id
             AND ce.vocabulary_entry_id = ? AND ce.removed_at IS NULL
           WHERE uc.user_id = ? AND uc.status = 'active'
           ORDER BY ce.collection_id LIMIT 1`,
          [vocabularyId, userId]
        );
        collectionId = rows[0]?.collection_id ?? null;
      }
      await connection.execute(
        `INSERT IGNORE INTO review_events
           (event_key, user_id, vocabulary_entry_id, collection_id, practice_session_id, occurred_at, local_day, answer, correct,
            mode, previous_box, new_box, promoted, mistake_number, term_snapshot, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reviewEventKey(userId, event),
          userId,
          vocabularyId,
          collectionId,
          practiceSessionId,
          occurredAt,
          localDay,
          event?.answer === undefined ? null : String(event.answer),
          event?.correct ? 1 : 0,
          event?.mode ? String(event.mode).slice(0, 64) : null,
          event?.previousBox === null || event?.previousBox === undefined ? null : boxNumber(event.previousBox),
          event?.newBox === null || event?.newBox === undefined ? null : boxNumber(event.newBox),
          event?.promoted ? 1 : 0,
          event?.mistakeNumber === null || event?.mistakeNumber === undefined ? null : nonNegativeInteger(event.mistakeNumber),
          String(event?.term || "").slice(0, 512),
          JSON.stringify({ source: "legacy-state-adapter" })
        ]
      );
    }
  }
}
