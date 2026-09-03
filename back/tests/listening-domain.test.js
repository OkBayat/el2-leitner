import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { normalizeListeningAnswer } from "../src/domain/listening-practice/ListeningAnswerNormalizer.js";
import { gradeListeningAttempt } from "../src/domain/listening-practice/ListeningGrader.js";
import { parseListeningLessonDefinition } from "../src/domain/listening-practice/ListeningLessonDefinition.js";

const lessonUrl = new URL("../data/listening/bbc/260903-extreme-weather.json", import.meta.url);

async function lesson() {
  return parseListeningLessonDefinition(JSON.parse(await readFile(lessonUrl, "utf8")), "260903-extreme-weather.json");
}

describe("BBC listening lesson definition", () => {
  it("validates the first BBC lesson as four ordered IELTS groups and thirteen ordered questions", async () => {
    const parsed = await lesson();
    assert.equal(parsed.provider, "bbc_6_minute_english");
    assert.equal(parsed.groups.length, 4);
    assert.equal(parsed.questionCount, 13);
    assert.deepEqual(parsed.groups.map((group) => group.taskType), [
      "note_completion",
      "multiple_choice_single",
      "sentence_completion",
      "short_answer"
    ]);
    assert.deepEqual(parsed.groups.flatMap((group) => group.questions).map((question) => question.number),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  });

  it("rejects duplicate question numbers", async () => {
    const raw = JSON.parse(await readFile(lessonUrl, "utf8"));
    raw.groups[0].questions[1].number = 1;
    assert.throws(
      () => parseListeningLessonDefinition(raw, "duplicate.json"),
      (error) => error.code === "INVALID_LISTENING_LESSON" && /question numbers/u.test(error.message)
    );
  });

  it("rejects out-of-order groups and questions instead of rendering the wrong IELTS sequence", async () => {
    const reversedGroups = JSON.parse(await readFile(lessonUrl, "utf8"));
    reversedGroups.groups.reverse();
    assert.throws(
      () => parseListeningLessonDefinition(reversedGroups, "reversed-groups.json"),
      (error) => error.code === "INVALID_LISTENING_LESSON" && /group positions/u.test(error.message)
    );

    const reversedQuestions = JSON.parse(await readFile(lessonUrl, "utf8"));
    reversedQuestions.groups[0].questions.reverse();
    assert.throws(
      () => parseListeningLessonDefinition(reversedQuestions, "reversed-questions.json"),
      (error) => error.code === "INVALID_LISTENING_LESSON" && /question positions/u.test(error.message)
    );
  });

  it("keeps completion and multiple-choice response types aligned with their IELTS group", async () => {
    const raw = JSON.parse(await readFile(lessonUrl, "utf8"));
    raw.groups[0].questions[0] = structuredClone(raw.groups[1].questions[0]);
    raw.groups[0].questions[0].number = 1;
    raw.groups[0].questions[0].position = 1;
    raw.groups[0].questions[0].id = "bbc-260903-question-replacement";
    for (const [index, option] of raw.groups[0].questions[0].options.entries()) {
      option.id = `bbc-260903-question-replacement-option-${index + 1}`;
    }
    assert.throws(
      () => parseListeningLessonDefinition(raw, "wrong-response-type.json"),
      (error) => error.code === "INVALID_LISTENING_LESSON" && /responseType text/u.test(error.message)
    );
  });
});

describe("Listening answer normalization", () => {
  it("normalizes casing, whitespace, apostrophes and dash variants without forgiving spelling", () => {
    assert.equal(normalizeListeningAnswer("  LONG   TERM  "), "long term");
    assert.equal(normalizeListeningAnswer("mother’s day"), "mother's day");
    assert.equal(normalizeListeningAnswer("long–term"), "long-term");
    assert.notEqual(normalizeListeningAnswer("enviroment"), normalizeListeningAnswer("environment"));
  });
});

describe("Listening grading", () => {
  it("grades text and choice questions on the server and returns a 10/13 score", async () => {
    const parsed = await lesson();
    const values = [
      [1, "day"],
      [2, "long term"],
      [3, "typhoons"],
      [4, "tropical"],
      [5, "slowly"],
      [6, "bbc-260903-question-6-option-b"],
      [7, "bbc-260903-question-7-option-a"],
      [8, "bbc-260903-question-8-option-a"],
      [9, "heavy rain"],
      [10, "coast"],
      [11, "10 metres"],
      [12, "2C"],
      [13, "Atlantic"]
    ];
    const result = gradeListeningAttempt(parsed, values.map(([number, value]) => ({
      questionId: `bbc-260903-question-${number}`,
      value
    })));

    assert.deepEqual(result.score, { correct: 10, wrong: 3, total: 13, percentage: 76.9 });
    assert.equal(result.results[9].correct, false);
    assert.equal(result.results[9].correctAnswer, "inland");
    assert.equal(result.results[5].submittedAnswer, "B. They remain in the same area for longer.");
  });

  it("keeps IELTS spelling strict and treats omitted answers as incorrect", async () => {
    const result = gradeListeningAttempt(await lesson(), [
      { questionId: "bbc-260903-question-1", value: "days" }
    ]);
    assert.equal(result.results[0].correct, false);
    assert.equal(result.results[1].submittedAnswer, "No answer");
    assert.equal(result.score.correct, 0);
  });

  it("accepts only explicitly authored British, American and numeric variants", async () => {
    const result = gradeListeningAttempt(await lesson(), [
      { questionId: "bbc-260903-question-2", value: "long–term" },
      { questionId: "bbc-260903-question-11", value: "ten meters" },
      { questionId: "bbc-260903-question-12", value: "1°C" },
      { questionId: "bbc-260903-question-13", value: "Arctic" }
    ]);
    assert.equal(result.score.correct, 4);
    assert.equal(result.results[0].correct, false);
    assert.equal(result.results[1].correct, true);
    assert.equal(result.results[10].correct, true);
    assert.equal(result.results[11].correct, true);
    assert.equal(result.results[12].correct, true);
  });

  it("rejects duplicate questions and foreign option ids", async () => {
    const parsed = await lesson();
    assert.throws(
      () => gradeListeningAttempt(parsed, [
        { questionId: "bbc-260903-question-1", value: "day" },
        { questionId: "bbc-260903-question-1", value: "day" }
      ]),
      (error) => error.code === "INVALID_LISTENING_SUBMISSION"
    );
    assert.throws(
      () => gradeListeningAttempt(parsed, [
        { questionId: "bbc-260903-question-6", value: "bbc-260903-question-7-option-a" }
      ]),
      (error) => error.code === "INVALID_LISTENING_SUBMISSION"
    );
  });
});
