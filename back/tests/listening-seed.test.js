import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { parseListeningLessonDefinition } from "../src/domain/listening-practice/ListeningLessonDefinition.js";
import { seedListeningLessons } from "../src/infrastructure/persistence/mysql/seedListeningLessons.js";

const lessonUrl = new URL("../data/listening/bbc/260903-extreme-weather.json", import.meta.url);

class FakeConnection {
  constructor() {
    this.lesson = null;
    this.statements = [];
    this.commits = 0;
    this.rollbacks = 0;
    this.releases = 0;
  }

  async beginTransaction() {}
  async commit() { this.commits += 1; }
  async rollback() { this.rollbacks += 1; }
  release() { this.releases += 1; }

  async execute(sql, values = []) {
    const compact = sql.replace(/\s+/gu, " ").trim();
    this.statements.push({ sql: compact, values });
    if (compact.startsWith("SELECT id, source_hash, content_version FROM listening_lessons")) {
      return [this.lesson ? [{ id: 1, source_hash: this.lesson.hash, content_version: this.lesson.version }] : []];
    }
    if (compact.startsWith("INSERT INTO listening_lessons")) {
      this.lesson = {
        audioFile: values[8],
        hash: values[13],
        version: Number(values[12]),
        content: JSON.parse(values[14])
      };
      return [{ insertId: 1 }];
    }
    if (compact.startsWith("UPDATE listening_lessons")) {
      this.lesson = {
        audioFile: values[7],
        hash: values[12],
        version: Number(values[11]),
        content: JSON.parse(values[13])
      };
      return [{ affectedRows: 1 }];
    }
    throw new Error(`Unexpected SQL in listening seed test: ${compact}`);
  }
}

class FakePool {
  constructor() { this.connection = new FakeConnection(); }
  async getConnection() { return this.connection; }
}

describe("BBC listening seed", () => {
  it("stores the episode filename and all tests as one versioned JSON aggregate idempotently", async () => {
    const definition = parseListeningLessonDefinition(
      JSON.parse(await readFile(lessonUrl, "utf8")),
      "260903-extreme-weather.json"
    );
    const pool = new FakePool();

    const first = await seedListeningLessons({ pool, definitions: [definition] });
    const second = await seedListeningLessons({ pool, definitions: [definition] });
    const revisedDefinition = structuredClone(definition);
    revisedDefinition.description = `${definition.description} Updated.`;
    const revised = await seedListeningLessons({ pool, definitions: [revisedDefinition] });

    assert.deepEqual(first, { changed: true, lessonCount: 1, testCount: 3, questionCount: 39 });
    assert.deepEqual(second, { changed: false, lessonCount: 1, testCount: 3, questionCount: 39 });
    assert.deepEqual(revised, { changed: true, lessonCount: 1, testCount: 3, questionCount: 39 });
    assert.equal(pool.connection.lesson.version, 2);
    assert.equal(pool.connection.lesson.audioFile, "bbc-6-minute-english-260903.mp3");
    assert.equal(pool.connection.commits, 3);
    assert.equal(pool.connection.rollbacks, 0);
    assert.equal(pool.connection.releases, 3);

    const content = pool.connection.lesson.content;
    assert.equal(content.schemaVersion, 2);
    assert.equal(content.tests.length, 3);
    assert.deepEqual(content.tests.map((test) => [test.id, test.questionCount]), [
      ["test-1", 13], ["test-2", 13], ["test-3", 13]
    ]);
    const firstQuestions = content.tests[0].groups.flatMap((group) => group.questions);
    assert.equal(firstQuestions.length, 13);
    assert.deepEqual(firstQuestions[0].acceptedAnswers[0], {
      text: "day",
      normalized: "day",
      primary: true
    });
    assert.equal(firstQuestions[5].correctOptionId, "bbc-260903-question-6-option-b");

    const allSql = pool.connection.statements.map((statement) => statement.sql);
    assert.equal(allSql.filter((sql) => sql.startsWith("INSERT INTO listening_lessons")).length, 1);
    assert.equal(allSql.filter((sql) => sql.startsWith("UPDATE listening_lessons")).length, 1);
    assert.equal(allSql.some((sql) => /listening_question_|listening_attempt_answers/u.test(sql)), false);
  });
});
