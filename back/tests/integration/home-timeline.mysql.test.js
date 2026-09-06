import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import request from 'supertest';
import { loadConfig } from '../../src/config/loadConfig.js';
import { createPool } from '../../src/infrastructure/persistence/mysql/createPool.js';
import { MySqlPracticeSessionRepository } from '../../src/infrastructure/persistence/mysql/MySqlPracticeSessionRepository.js';
import { MySqlLearningTimelineRepository } from '../../src/infrastructure/persistence/mysql/MySqlLearningTimelineRepository.js';
import { GetLearningTimeline } from '../../src/application/learning/GetLearningTimeline.js';
import { createContainer } from '../../src/container.js';
import { createApp } from '../../src/createApp.js';

// Mutating fixtures are restricted to an explicitly enabled, disposable CI database.
test('persisted Home timeline against MySQL 8.4 and the authenticated HTTP boundary', {
  skip: process.env.HOME_TIMELINE_MYSQL_INTEGRATION !== '1',
}, async t => {
  assert.match(process.env.DB_NAME || '', /_ci$/u, 'Never run timeline fixtures against a production database.');
  const config = loadConfig(process.env);
  const pool = createPool(config.database);
  const users = [];
  t.after(async () => {
    try { for (const id of users) await pool.execute('DELETE FROM users WHERE id = ?', [id]); }
    finally { await pool.end(); }
  });
  for (let index = 0; index < 2; index++) {
    const [row] = await pool.execute('INSERT INTO users (email, password_hash) VALUES (?, ?)', [`timeline-${randomUUID()}@example.test`, 'integration-only']);
    users.push(String(row.insertId));
  }
  const [learner, other] = users;
  await pool.execute('INSERT INTO user_state_revisions (user_id, revision) VALUES (?, 7)', [learner]);
  const sessions = new MySqlPracticeSessionRepository(pool);
  const timeline = new GetLearningTimeline({
    timelineRepository: new MySqlLearningTimelineRepository(pool),
    now: () => new Date('2026-09-06T11:00:00Z'),
  });
  const container = createContainer({ pool, config });
  container.useCases.getLearningTimeline = timeline;
  const app = createApp({ container, staticDirectory: false, nodeEnv: 'test', logger: { error() {} } });
  const cookie = id => `${container.authCookie.name}=${container.tokenService.issue(id)}`;
  const get = (id, query = '') => request(app).get(`/api/learning/timeline?timeZone=Asia%2FTehran${query}`).set('Cookie', cookie(id));
  const day = (result, key) => result.days.find(item => item.day === key);

  await t.test('requires authentication and rejects invalid calendar inputs', async () => {
    await request(app).get('/api/learning/timeline').expect(401);
    await get(learner, '&before=2026-02-30').expect(400);
    await get(learner, '&limit=10000').expect(400);
    await request(app).get('/api/learning/timeline?timeZone=not-a-zone').set('Cookie', cookie(learner)).expect(400);
    const empty = await get(learner).expect(200);
    assert.equal(empty.headers['cache-control'], 'no-store');
    assert.deepEqual(empty.body.days, [{ day: '2026-09-06', activities: [], boxOnePracticed: false }]);
  });

  await t.test('records actual attempts on each local day without changing Leitner revisions', async () => {
    const shadowing = await sessions.start(learner, { mode: 'shadowing-house-1', plannedCount: null });
    await sessions.recordAttempt(learner, shadowing.id, { day: '2026-09-04', correct: false, shadowing: true });
    await sessions.recordAttempt(learner, shadowing.id, { day: '2026-09-05', correct: true, shadowing: true });
    const sentence = await sessions.start(learner, { mode: 'sentence-house-1', plannedCount: null });
    await sessions.recordAttempt(learner, sentence.id, { day: '2026-09-06', correct: false });
    await sessions.start(other, { mode: 'shadowing-house-1', plannedCount: null });
    const [evidence] = await pool.execute(`SELECT DATE_FORMAT(d.local_day, '%Y-%m-%d') AS day, d.attempt_count
      FROM practice_session_days d JOIN practice_sessions s ON s.id = d.practice_session_id
      WHERE s.public_id = ? ORDER BY d.local_day`, [shadowing.id]);
    assert.deepEqual(evidence.map(row => [row.day, Number(row.attempt_count)]), [['2026-09-04', 1], ['2026-09-05', 1]]);
    const [revision] = await pool.execute('SELECT revision FROM user_state_revisions WHERE user_id = ?', [learner]);
    assert.equal(Number(revision[0].revision), 7);
    const [progress] = await pool.execute('SELECT COUNT(*) AS total FROM user_vocabulary_progress WHERE user_id = ?', [learner]);
    assert.equal(Number(progress[0].total), 0);
    const result = await get(learner).expect(200);
    assert.deepEqual(day(result.body, '2026-09-04').activities, ['shadowing']);
    assert.deepEqual(day(result.body, '2026-09-05').activities, ['shadowing']);
    assert.deepEqual(day(result.body, '2026-09-06'), { day: '2026-09-06', activities: [], boxOnePracticed: true });
    const isolated = await get(other).expect(200);
    assert.deepEqual(isolated.body.days, [{ day: '2026-09-06', activities: [], boxOnePracticed: false }]);
  });

  await t.test('reads all historical reviews and completed listening in the learner timezone', async () => {
    for (const date of ['2025-01-01', '2026-09-05']) {
      await pool.execute(`INSERT INTO review_events
        (event_key, user_id, occurred_at, local_day, correct, mode, term_snapshot)
        VALUES (?, ?, ?, ?, FALSE, 'review', 'fixture word')`, [randomUUID().replaceAll('-', '').padEnd(64, '0'), learner, `${date} 12:00:00`, date]);
    }
    const [lessons] = await pool.execute('SELECT id, content_version FROM listening_lessons ORDER BY id LIMIT 1');
    assert.ok(lessons.length, 'Database setup must install the canonical listening catalog.');
    await pool.execute(`INSERT INTO listening_attempts
      (public_id, user_id, lesson_id, test_id, lesson_content_version, status, started_at, submitted_at, total_count)
      VALUES (?, ?, ?, 'timeline-fixture', ?, 'completed', '2026-09-05 20:50:00', '2026-09-05 21:00:00', 10)`,
    [randomUUID(), learner, lessons[0].id, lessons[0].content_version]);
    await pool.execute(`INSERT INTO listening_attempts
      (public_id, user_id, lesson_id, test_id, lesson_content_version, status, started_at, total_count)
      VALUES (?, ?, ?, 'timeline-fixture', ?, 'active', '2026-09-06 01:00:00', 10)`,
    [randomUUID(), other, lessons[0].id, lessons[0].content_version]);
    const latest = await get(learner, '&limit=2').expect(200);
    assert.deepEqual(day(latest.body, '2026-09-05').activities, ['vocabulary', 'shadowing']);
    assert.deepEqual(day(latest.body, '2026-09-06').activities, ['listening']);
    assert.equal(latest.body.nextBefore, '2026-09-05');
    const prior = await get(learner, `&limit=2&before=${latest.body.nextBefore}`).expect(200);
    assert.deepEqual(prior.body.days.map(row => row.day), ['2026-09-03', '2026-09-04']);
    assert.deepEqual(day(prior.body, '2026-09-04').activities, ['shadowing']);
    const earliest = await get(learner, '&limit=2&before=2025-01-03').expect(200);
    assert.deepEqual(earliest.body.days.map(row => row.day), ['2025-01-01', '2025-01-02']);
    assert.deepEqual(earliest.body.days[0].activities, ['vocabulary']);
    assert.equal(earliest.body.nextBefore, null);
    const reload = await get(learner, '&limit=2').expect(200);
    assert.deepEqual(reload.body, latest.body);
    const isolated = await get(other).expect(200);
    assert.deepEqual(isolated.body.days[0].activities, []);
  });

  await t.test('retains reliable legacy evidence but never guesses multi-day completions', async () => {
    await pool.execute(`INSERT INTO practice_sessions
      (public_id, user_id, mode, started_at, completed_at, updated_at, status, completed_count)
      VALUES (?, ?, 'shadowing-house-1', '2026-09-02 01:00:00', '2026-09-02 03:00:00', '2026-09-02 03:00:00', 'completed', 2)`, [randomUUID(), learner]);
    await pool.execute(`INSERT INTO practice_sessions
      (public_id, user_id, mode, started_at, completed_at, updated_at, status, completed_count)
      VALUES (?, ?, 'sentence-house-1', '2026-09-01 12:00:00', '2026-09-03 12:00:00', '2026-09-03 12:00:00', 'completed', 8)`, [randomUUID(), learner]);
    const result = await get(learner).expect(200);
    assert.deepEqual(day(result.body, '2026-09-02').activities, ['shadowing']);
    assert.equal(day(result.body, '2026-09-01').boxOnePracticed, false);
    assert.equal(day(result.body, '2026-09-03').boxOnePracticed, false);
    assert.equal(result.body.limitedHistory, true);
  });
});
