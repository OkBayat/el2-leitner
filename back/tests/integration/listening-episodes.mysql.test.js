import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { loadConfig } from "../../src/config/loadConfig.js";
import { createPool } from "../../src/infrastructure/persistence/mysql/createPool.js";
import { loadListeningEpisodeSources } from "../../src/infrastructure/content/loadListeningEpisodeSources.js";
import { MySqlListeningEpisodeSourceRepository } from "../../src/infrastructure/persistence/mysql/MySqlListeningEpisodeSourceRepository.js";
import { MySqlListeningPracticeRepository } from "../../src/infrastructure/persistence/mysql/MySqlListeningPracticeRepository.js";
import { MySqlListeningVocabularyRepository } from "../../src/infrastructure/persistence/mysql/MySqlListeningVocabularyRepository.js";
import { MySqlCollectionSourceRepository } from "../../src/infrastructure/persistence/mysql/MySqlCollectionSourceRepository.js";
import { SubmitListeningAttempt } from "../../src/application/listening-practice/SubmitListeningAttempt.js";

// Only the dedicated ephemeral CI database may run this mutating integration suite.
test("file-managed episode integration against MySQL 8.4", { skip: process.env.LISTENING_MYSQL_INTEGRATION !== "1" }, async (t) => {
  assert.match(process.env.DB_NAME || "", /_ci$/u, "Use a dedicated *_ci database, never production.");
  const pool = createPool(loadConfig(process.env).database);
  let userId;
  t.after(async () => {
    try { if (userId) await pool.execute("DELETE FROM users WHERE id = ?", [userId]); }
    finally { await pool.end(); }
  });
  const sources = await loadListeningEpisodeSources();
  const sync = new MySqlListeningEpisodeSourceRepository(pool);
  const listening = new MySqlListeningPracticeRepository(pool);
  const vocabulary = new MySqlListeningVocabularyRepository(pool);
  const submit = new SubmitListeningAttempt({ listeningPracticeRepository: listening });
  const [user] = await pool.execute("INSERT INTO users (email, password_hash) VALUES (?, ?)", [`episode-${randomUUID()}@example.test`, "integration-only"]);
  userId = String(user.insertId);
  const episode = sources[0].definition;
  const versions = async () => {
    const [rows] = await pool.execute(`SELECT l.public_id, l.content_version, l.source_hash, l.content_json,
      c.content_version AS vocabulary_version, c.source_hash AS vocabulary_hash
      FROM listening_lessons l JOIN collections c ON c.public_id = l.vocabulary_collection_id
      ORDER BY l.public_id`);
    return rows;
  };

  await t.test("initial sync creates linked vocabulary, scoped definitions and global sentence references", async () => {
    await sync.sync(sources);
    const view = await vocabulary.findForEpisode(userId, episode.provider, episode.slug);
    assert.equal(view.entries.length, 6);
    assert.equal(view.subscribed, false);
    assert.ok(view.entries.every((entry) => entry.definitions.length > 0 && entry.examples.length > 0));
    assert.ok(view.entries.every((entry) => entry.progress.state === "new"));
    const [rows] = await pool.execute("SELECT content_json FROM listening_lessons WHERE public_id = ?", [episode.publicId]);
    assert.equal(JSON.stringify(rows[0].content_json).includes("TRANSCRIPT_SOURCE_ONLY"), false);
  });

  await t.test("an unchanged deployment executes zero INSERT/UPDATE/DELETE statements", async () => {
    const statements = [];
    const trackedPool = { getConnection: async () => {
      const connection = await pool.getConnection();
      return {
        execute: (sql, args) => { statements.push(sql); return connection.execute(sql, args); },
        beginTransaction: () => connection.beginTransaction(), commit: () => connection.commit(),
        rollback: () => connection.rollback(), release: () => connection.release()
      };
    } };
    const before = await versions();
    const result = await new MySqlListeningEpisodeSourceRepository(trackedPool).sync(sources);
    assert.equal(result.changed, false); assert.equal(result.changedCollections, 0);
    assert.equal(statements.filter((sql) => /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/iu.test(sql)).length, 0);
    assert.deepEqual(await versions(), before);
  });

  await t.test("changed JSON updates only its lesson and preserves completed result snapshots and user progress", async () => {
    const lesson = await listening.findPublishedLessonBySlug(episode.provider, episode.slug, { includeAnswers: true });
    const attempt = await listening.startAttempt(userId, lesson, lesson.tests[0]);
    const pending = await listening.startAttempt(userId, lesson, lesson.tests[1]);
    const result = await submit.execute(userId, attempt.id, { answers: [] });
    const [collectionRows] = await pool.execute("SELECT id FROM collections WHERE public_id = ?", [episode.publicId]);
    await pool.execute("INSERT INTO user_collections (user_id, collection_id) VALUES (?, ?)", [userId, collectionRows[0].id]);
    const [entries] = await pool.execute("SELECT vocabulary_entry_id FROM collection_entries WHERE collection_id = ? AND removed_at IS NULL ORDER BY position", [collectionRows[0].id]);
    await pool.execute("INSERT INTO user_vocabulary_progress (user_id, vocabulary_entry_id, box, attempts, introduced_on) VALUES (?, ?, 3, 7, '2026-01-01')", [userId, entries[0].vocabulary_entry_id]);
    await pool.execute("INSERT INTO user_vocabulary_progress (user_id, vocabulary_entry_id, mastered_at, introduced_on) VALUES (?, ?, '2026-01-02', '2026-01-01')", [userId, entries[1].vocabulary_entry_id]);
    const [progressBefore] = await pool.execute("SELECT * FROM user_vocabulary_progress WHERE user_id = ? ORDER BY vocabulary_entry_id", [userId]);
    const before = await versions();
    const updated = structuredClone(sources); updated[0].definition.tests[0].difficulty = "hard";
    await sync.sync(updated);
    const after = await versions();
    const firstBefore = before.find((row) => row.public_id === episode.publicId);
    const firstAfter = after.find((row) => row.public_id === episode.publicId);
    assert.equal(Number(firstAfter.content_version), Number(firstBefore.content_version) + 1);
    assert.equal(firstAfter.vocabulary_version, firstBefore.vocabulary_version);
    assert.deepEqual(after.filter((row) => row.public_id !== episode.publicId), before.filter((row) => row.public_id !== episode.publicId));
    assert.deepEqual(await submit.execute(userId, attempt.id, { answers: [] }), result);
    await assert.rejects(submit.execute(userId, pending.id, { answers: [] }), { code: "LISTENING_LESSON_UPDATED" });
    const [progressAfter] = await pool.execute("SELECT * FROM user_vocabulary_progress WHERE user_id = ? ORDER BY vocabulary_entry_id", [userId]);
    assert.deepEqual(progressAfter, progressBefore);
    const view = await vocabulary.findForEpisode(userId, episode.provider, episode.slug);
    assert.equal(view.entries[0].progress.box, 3); assert.equal(view.entries[1].progress.state, "mastered");
    await sync.sync(sources);
  });

  await t.test("vocabulary-only edits reuse global word/sentence identities without changing the listening version", async () => {
    const before = await versions();
    const [[countBefore]] = await pool.execute("SELECT COUNT(*) AS total FROM vocabulary_entries");
    const changed = structuredClone(sources);
    changed[0].collection.parsed.entries[0].definitions = ["A revised context-specific definition for integration testing."];
    changed[0].collection.sourceHash = "1".repeat(64);
    await sync.sync(changed);
    const after = await versions();
    const a = before.find((row) => row.public_id === episode.publicId), b = after.find((row) => row.public_id === episode.publicId);
    assert.equal(a.content_version, b.content_version);
    assert.equal(Number(b.vocabulary_version), Number(a.vocabulary_version) + 1);
    const [[countAfter]] = await pool.execute("SELECT COUNT(*) AS total FROM vocabulary_entries");
    assert.equal(countAfter.total, countBefore.total);
    const view = await vocabulary.findForEpisode(userId, episode.provider, episode.slug);
    assert.deepEqual(view.entries[0].definitions, changed[0].collection.parsed.entries[0].definitions);
    assert.equal(view.entries[0].examples.length, 1);
    await sync.sync(sources);
  });

  await t.test("a failed lesson import rolls back preceding collection changes", async () => {
    const before = await versions();
    const changed = structuredClone(sources);
    changed[0].collection.parsed.title = "Must be rolled back"; changed[0].collection.sourceHash = "2".repeat(64);
    const failing = new MySqlListeningEpisodeSourceRepository(pool, { seed: async () => { throw new Error("forced lesson failure"); } });
    await assert.rejects(failing.sync(changed), /forced lesson failure/u);
    assert.deepEqual(await versions(), before);
    const [[row]] = await pool.execute("SELECT title FROM collections WHERE public_id = ?", [episode.publicId]);
    assert.notEqual(row.title, "Must be rolled back");
    await assert.doesNotReject(sync.sync(sources));
  });

  await t.test("new episodes insert once, survive absent folders, and archive only by explicit status", async () => {
    const added = structuredClone(sources[0]);
    added.definition.publicId = "integration-episode";
    added.definition.slug = "integration-episode";
    added.definition.vocabularyCollectionId = "integration-episode";
    added.collection.publicId = "integration-episode";
    added.collection.slug = "podcast-integration-episode";
    added.collection.sourceHash = "3".repeat(64);
    added.collection.parsed.title = "Integration episode vocabulary";
    await sync.sync([...sources, added]);
    const once = await versions(); await sync.sync([...sources, added]);
    assert.deepEqual(await versions(), once);
    await sync.sync(sources);
    assert.ok((await versions()).some((row) => row.public_id === "integration-episode"));
    added.definition.status = "archived"; added.collection.status = "archived"; added.collection.sourceHash = "4".repeat(64);
    await sync.sync([...sources, added]);
    await assert.rejects(vocabulary.findForEpisode(userId, episode.provider, "integration-episode"), { code: "LISTENING_VOCABULARY_NOT_FOUND" });
    await assert.rejects(listening.findPublishedLessonBySlug(episode.provider, "integration-episode"), { code: "LISTENING_LESSON_NOT_FOUND" });
  });

  await t.test("the PR63 flat-file collection importer never archives episode collections", async () => {
    const [flatSources] = await pool.execute("SELECT slug FROM collections WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.sourceFile')) NOT LIKE '%/%'");
    const result = await new MySqlCollectionSourceRepository(pool).archiveMissing(flatSources.map((row) => row.slug));
    assert.equal(result.archivedCount, 0);
    await assert.doesNotReject(vocabulary.findForEpisode(userId, episode.provider, episode.slug));
    const unchanged = await sync.sync(sources);
    assert.equal(unchanged.changedCollections, 0);
  });

  await t.test("concurrent unchanged deployments serialize safely", async () => {
    const results = await Promise.all([sync.sync(sources), sync.sync(sources)]);
    assert.ok(results.every((result) => !result.changed && result.changedCollections === 0));
  });
});
