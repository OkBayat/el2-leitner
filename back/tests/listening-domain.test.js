import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { normalizeListeningAnswer } from "../src/domain/listening-practice/ListeningAnswerNormalizer.js";
import { gradeListeningAttempt } from "../src/domain/listening-practice/ListeningGrader.js";
import { parseListeningLessonDefinition } from "../src/domain/listening-practice/ListeningLessonDefinition.js";

const lessonUrl = new URL("../data/listening/bbc/260903-extreme-weather.json", import.meta.url);
const screenTimeLessonUrl = new URL(
  "../data/listening/bbc/260618-limiting-screen-time-for-children.json",
  import.meta.url
);

async function lesson() {
  return parseListeningLessonDefinition(JSON.parse(await readFile(lessonUrl, "utf8")), "260903-extreme-weather.json");
}

async function screenTimeLesson() {
  return parseListeningLessonDefinition(
    JSON.parse(await readFile(screenTimeLessonUrl, "utf8")),
    "260618-limiting-screen-time-for-children.json"
  );
}

async function firstTest() {
  return (await lesson()).tests[0];
}

describe("BBC listening lesson definition", () => {
  it("validates three ordered IELTS tests with thirteen questions each", async () => {
    const parsed = await lesson();
    assert.equal(parsed.schemaVersion, 2);
    assert.equal(parsed.provider, "bbc_6_minute_english");
    assert.equal(parsed.testCount, 3);
    assert.equal(parsed.questionCount, 39);
    assert.deepEqual(parsed.tests.map((test) => [test.id, test.title, test.position, test.questionCount]), [
      ["test-1", "Test 1", 1, 13],
      ["test-2", "Test 2", 2, 13],
      ["test-3", "Test 3", 3, 13]
    ]);
    for (const test of parsed.tests) {
      assert.deepEqual(
        test.groups.flatMap((group) => group.questions).map((question) => question.number),
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
      );
    }
  });

  it("validates the screen-time episode as three distinct 13-question IELTS tests in audio order", async () => {
    const parsed = await screenTimeLesson();
    assert.equal(parsed.publicId, "bbc-6-minute-english-260618");
    assert.equal(parsed.slug, "limiting-screen-time-for-children");
    assert.equal(parsed.episodeDate, "2026-06-18");
    assert.equal(parsed.testCount, 3);
    assert.equal(parsed.questionCount, 39);
    assert.deepEqual(parsed.tests.map((test) => [test.id, test.questionCount]), [
      ["test-1", 13],
      ["test-2", 13],
      ["test-3", 13]
    ]);
    for (const test of parsed.tests) {
      assert.deepEqual(
        test.groups.flatMap((group) => group.questions).map((question) => question.number),
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
      );
    }

    const test1 = parsed.tests[0].groups.flatMap((group) => group.questions);
    assert.match(test1[0].prompt, /Screen time includes/iu);
    assert.equal(test1[0].acceptedAnswers[0].text, "laptops");
    assert.match(test1[1].prompt, /Australia/iu);
    assert.match(test1[2].prompt, /University of/iu);
    assert.match(test1[3].prompt, /intentional/iu);
    assert.match(test1[4].prompt, /needs to be higher/iu);
    assert.match(test1[9].prompt, /parents are very/iu);
    assert.match(test1[11].prompt, /moving somewhere/iu);
    assert.match(test1[12].prompt, /children aged three to four/iu);
  });

  it("keeps Test 1 in BBC audio order", async () => {
    const test = await firstTest();
    assert.deepEqual(test.groups.map((group) => group.taskType), [
      "note_completion",
      "multiple_choice_single",
      "sentence_completion",
      "short_answer"
    ]);
    const questions = test.groups.flatMap((group) => group.questions);
    assert.match(questions[7].prompt, /landslides and mudslides occur/iu);
    assert.match(questions[8].prompt, /swept/iu);
    assert.match(questions[9].prompt, /sea.*rising/iu);
    assert.match(questions[10].prompt, /storm surges/iu);
    assert.match(questions[11].prompt, /temperature increased/iu);
    assert.match(questions[12].prompt, /three times faster/iu);
  });

  it("rejects duplicate test ids and out-of-order tests", async () => {
    const duplicate = JSON.parse(await readFile(lessonUrl, "utf8"));
    duplicate.tests[1].id = duplicate.tests[0].id;
    assert.throws(
      () => parseListeningLessonDefinition(duplicate, "duplicate-test.json"),
      (error) => error.code === "INVALID_LISTENING_LESSON" && /Test id/u.test(error.message)
    );

    const reversed = JSON.parse(await readFile(lessonUrl, "utf8"));
    reversed.tests.reverse();
    assert.throws(
      () => parseListeningLessonDefinition(reversed, "reversed-tests.json"),
      (error) => error.code === "INVALID_LISTENING_LESSON" && /test positions/u.test(error.message)
    );
  });

  it("rejects duplicate question numbers within a test", async () => {
    const raw = JSON.parse(await readFile(lessonUrl, "utf8"));
    raw.tests[0].groups[0].questions[1].number = 1;
    assert.throws(
      () => parseListeningLessonDefinition(raw, "duplicate.json"),
      (error) => error.code === "INVALID_LISTENING_LESSON" && /question numbers/u.test(error.message)
    );
  });

  it("rejects out-of-order groups and questions instead of rendering the wrong IELTS sequence", async () => {
    const reversedGroups = JSON.parse(await readFile(lessonUrl, "utf8"));
    reversedGroups.tests[0].groups.reverse();
    assert.throws(
      () => parseListeningLessonDefinition(reversedGroups, "reversed-groups.json"),
      (error) => error.code === "INVALID_LISTENING_LESSON" && /group positions/u.test(error.message)
    );

    const reversedQuestions = JSON.parse(await readFile(lessonUrl, "utf8"));
    reversedQuestions.tests[0].groups[0].questions.reverse();
    assert.throws(
      () => parseListeningLessonDefinition(reversedQuestions, "reversed-questions.json"),
      (error) => error.code === "INVALID_LISTENING_LESSON" && /question positions/u.test(error.message)
    );
  });

  it("rejects impossible episode dates before MySQL seeding", async () => {
    const raw = JSON.parse(await readFile(lessonUrl, "utf8"));
    raw.episodeDate = "2026-02-30";
    assert.throws(
      () => parseListeningLessonDefinition(raw, "invalid-date.json"),
      (error) => error.code === "INVALID_LISTENING_LESSON" && /valid ISO date/u.test(error.message)
    );
  });

  it("rejects accepted answers that violate their IELTS word or number limit", async () => {
    const tooManyWords = JSON.parse(await readFile(lessonUrl, "utf8"));
    tooManyWords.tests[0].groups[0].questions[0].answers = ["one extra answer"];
    assert.throws(
      () => parseListeningLessonDefinition(tooManyWords, "too-many-words.json"),
      (error) => error.code === "INVALID_LISTENING_LESSON" && /maxWords/u.test(error.message)
    );

    const tooManyNumbers = JSON.parse(await readFile(lessonUrl, "utf8"));
    tooManyNumbers.tests[0].groups[0].questions[0].answers = ["day 1 2"];
    assert.throws(
      () => parseListeningLessonDefinition(tooManyNumbers, "too-many-numbers.json"),
      (error) => error.code === "INVALID_LISTENING_LESSON" && /maxNumbers/u.test(error.message)
    );
  });

  it("keeps completion and multiple-choice response types aligned with their IELTS group", async () => {
    const raw = JSON.parse(await readFile(lessonUrl, "utf8"));
    raw.tests[0].groups[0].questions[0] = structuredClone(raw.tests[0].groups[1].questions[0]);
    raw.tests[0].groups[0].questions[0].number = 1;
    raw.tests[0].groups[0].questions[0].position = 1;
    raw.tests[0].groups[0].questions[0].id = "bbc-260903-question-replacement";
    for (const [index, option] of raw.tests[0].groups[0].questions[0].options.entries()) {
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
  it("grades Test 1 on the server and returns a 10/13 score", async () => {
    const test = await firstTest();
    const values = [
      [1, "day"],
      [2, "long term"],
      [3, "typhoons"],
      [4, "tropical"],
      [5, "slowly"],
      [6, "bbc-260903-question-6-option-b"],
      [7, "bbc-260903-question-7-option-a"],
      [8, "bbc-260903-question-8-option-a"],
      [9, "inland"],
      [10, "coast"],
      [11, "10 metres"],
      [12, "2C"],
      [13, "Atlantic"]
    ];
    const result = gradeListeningAttempt(test, values.map(([number, value]) => ({
      questionId: `bbc-260903-question-${number}`,
      value
    })));

    assert.deepEqual(result.score, { correct: 10, wrong: 3, total: 13, percentage: 76.9 });
    assert.equal(result.results[9].correct, false);
    assert.equal(result.results[9].correctAnswer, "sea levels");
    assert.equal(result.results[5].submittedAnswer, "B. They remain in the same area for longer.");
  });

  it("grades all thirteen answers in the new screen-time Test 1", async () => {
    const test = (await screenTimeLesson()).tests[0];
    const values = [
      [1, "laptops"],
      [2, "social media"],
      [3, "Cambridge"],
      [4, "intentional"],
      [5, "bbc-260618-t1-question-5-option-b"],
      [6, "bbc-260618-t1-question-6-option-a"],
      [7, "bbc-260618-t1-question-7-option-b"],
      [8, "reason"],
      [9, "expectations"],
      [10, "eager"],
      [11, "little shifts"],
      [12, "the device"],
      [13, "one in five"]
    ];
    const result = gradeListeningAttempt(test, values.map(([number, value]) => ({
      questionId: `bbc-260618-t1-question-${number}`,
      value
    })));
    assert.deepEqual(result.score, { correct: 13, wrong: 0, total: 13, percentage: 100 });
  });

  it("keeps IELTS spelling strict while treating omitted answers as incorrect", async () => {
    const result = gradeListeningAttempt(await firstTest(), [
      { questionId: "bbc-260903-question-1", value: "days" },
      { questionId: "bbc-260903-question-2", value: "long-term" }
    ]);
    assert.equal(result.results[0].correct, false);
    assert.equal(result.results[1].correct, false);
    assert.equal(result.results[2].submittedAnswer, "No answer");
    assert.equal(result.score.correct, 0);
  });

  it("accepts explicitly authored variants and presentation-equivalent input", async () => {
    const result = gradeListeningAttempt(await firstTest(), [
      { questionId: "bbc-260903-question-2", value: "  LONG   TERM  " },
      { questionId: "bbc-260903-question-11", value: "ten meters" },
      { questionId: "bbc-260903-question-12", value: "one degree" },
      { questionId: "bbc-260903-question-13", value: "Arctic" }
    ]);
    assert.equal(result.score.correct, 4);
    assert.equal(result.results[1].correct, true);
    assert.equal(result.results[10].correct, true);
    assert.equal(result.results[11].correct, true);
    assert.equal(result.results[12].correct, true);
  });

  it("rejects duplicate questions and foreign option ids", async () => {
    const test = await firstTest();
    assert.throws(
      () => gradeListeningAttempt(test, [
        { questionId: "bbc-260903-question-1", value: "day" },
        { questionId: "bbc-260903-question-1", value: "day" }
      ]),
      (error) => error.code === "INVALID_LISTENING_SUBMISSION"
    );
    assert.throws(
      () => gradeListeningAttempt(test, [
        { questionId: "bbc-260903-question-6", value: "bbc-260903-question-7-option-a" }
      ]),
      (error) => error.code === "INVALID_LISTENING_SUBMISSION"
    );
  });
});
