import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { loadListeningEpisodeSources, listeningEpisodesDirectory } from "../src/infrastructure/content/loadListeningEpisodeSources.js";
import { validateListeningQuestionQuality } from "../src/infrastructure/content/validateListeningQuestionQuality.js";
import { gradeListeningAttempt } from "../src/domain/listening-practice/ListeningGrader.js";
import { projectPublicListeningTest } from "../src/application/listening-practice/StartListeningAttempt.js";
import { SubmitListeningAttempt } from "../src/application/listening-practice/SubmitListeningAttempt.js";

const sources = await loadListeningEpisodeSources();
const expectedCounts = { "260618": 3, "260903": 3 };
let gradingCases = 0;
for (const { definition: lesson } of sources) {
  test(`catalog ${lesson.episodeCode}: reviewed, diverse, forward-only questions preserve routes`, async () => {
    const root = join(listeningEpisodesDirectory(), lesson.assetDirectory);
    const raw = JSON.parse(await readFile(join(root, "listening.json"), "utf8"));
    const manifest = JSON.parse(await readFile(join(root, "episode.json"), "utf8"));
    const report = validateListeningQuestionQuality(raw, { manifest });
    assert.equal(report.tests, expectedCounts[lesson.episodeCode] ?? 5);
    assert.equal(report.questions, report.tests * 10);
    assert.deepEqual(lesson.tests.map(t => t.id), lesson.tests.length === 3
      ? ["test-1", "test-2", "test-3"]
      : Array.from({ length: 5 }, (_, i) => `bbc-${lesson.episodeCode}-t${i + 1}`));
    assert.deepEqual(lesson.tests.map(t => t.difficulty), lesson.tests.length === 3
      ? ["medium", "medium", "medium"] : ["easy", "medium", "medium", "hard", "hard"]);
    assert.equal(lesson.publicId, `bbc-6-minute-english-${lesson.episodeCode}`);
  });

  for (const selected of lesson.tests) {
    test(`catalog ${lesson.episodeCode}/${selected.id}: every answer and distractor uses the real scorer`, () => {
      const questions = selected.groups.flatMap(g => g.questions);
      const correct = questions.map(q => ({ questionId: q.id, value: q.responseType === "text" ? q.acceptedAnswers[0].text : q.correctOptionId }));
      assert.equal(gradeListeningAttempt(selected, correct).score.correct, 10);
      assert.equal(gradeListeningAttempt(selected, []).score.correct, 0);
      gradingCases += 2;
      for (const q of questions) {
        const score = value => {
          gradingCases += 1;
          const result = gradeListeningAttempt(selected, [{ questionId: q.id, value }]);
          return result.results.find(r => r.questionId === q.id).correct;
        };
        assert.equal(score(""), false, q.id);
        if (q.responseType === "text") {
          for (const answer of q.acceptedAnswers) {
            assert.equal(score(answer.text), true, `${q.id}: ${answer.text}`);
            assert.equal(score(`  ${answer.text.toUpperCase()}  `), true, `${q.id}: case/whitespace`);
          }
          assert.equal(score("unrelated incorrect response"), false, q.id);
          assert.equal(score(`${q.acceptedAnswers[0].text}zzz`), false, `${q.id}: spelling`);
          assert.equal(score(`${q.acceptedAnswers[0].text} extra extra extra extra extra`), false, `${q.id}: word limit`);
        } else {
          for (const option of q.options) assert.equal(score(option.id), option.id === q.correctOptionId, `${q.id}: option ${option.label}`);
          assert.throws(() => score("option-not-in-this-question"), error => error.code === "INVALID_LISTENING_SUBMISSION");
        }
      }
    });
  }
}

test("review evidence stays out of normalized persistence and the learner-facing projection", async () => {
  for (const { definition } of sources) {
    const raw = JSON.parse(await readFile(join(listeningEpisodesDirectory(), definition.assetDirectory, "listening.json"), "utf8"));
    assert.ok(raw.tests[0].sourceReview);
    assert.ok(raw.tests[0].groups[0].questions[0].evidence);
    assert.doesNotMatch(JSON.stringify(definition), /sourceReview|audioSha256|contentSha256|startSeconds|endSeconds|distractors/);
    for (const selected of definition.tests) {
      // Even a future caller that accidentally supplies raw annotations must not expose them.
      const annotated = structuredClone(selected);
      annotated.sourceReview = raw.tests[0].sourceReview;
      annotated.groups[0].questions[0].evidence = raw.tests[0].groups[0].questions[0].evidence;
      const publicJson = JSON.stringify(projectPublicListeningTest(annotated));
      assert.doesNotMatch(publicJson, /acceptedAnswers|correctOptionId|sourceReview|audioSha256|contentSha256|startSeconds|endSeconds|distractors/);
    }
  }
});

test("a completed pre-redesign result remains an immutable historical snapshot", async () => {
  const snapshot = Object.freeze({ attemptId: "completed-original", score: { total: 6, correct: 4, wrong: 2, percentage: 66.7 }, results: [{ questionId: "original-q1", correct: true }] });
  const service = new SubmitListeningAttempt({ listeningPracticeRepository: {
    async getAttemptForGrading() { return { completedResult: snapshot, lesson: sources[0].definition }; },
    async completeAttempt() { assert.fail("A completed historical result must not be rewritten."); }
  } });
  assert.equal(await service.execute("user-1", "completed-original", { answers: [] }), snapshot);
});

test("an active pre-redesign attempt asks for a restart rather than silently grading different questions", async () => {
  const lesson = { ...sources[0].definition, contentVersion: 2 };
  const service = new SubmitListeningAttempt({ listeningPracticeRepository: {
    async getAttemptForGrading() { return { attempt: { id: "original-active", testId: lesson.tests[0].id, lessonContentVersion: 1 }, lesson, test: lesson.tests[0] }; },
    async completeAttempt() { assert.fail("A stale attempt must not be graded against a new question set."); }
  } });
  await assert.rejects(service.execute("user-1", "original-active", { answers: [] }), error => error.code === "LISTENING_LESSON_UPDATED");
});

test("the reviewed catalog covers all thirteen episodes and sixty-one test routes", t => {
  assert.equal(sources.length, 13);
  assert.equal(sources.reduce((n, s) => n + s.definition.tests.length, 0), 61);
  assert.equal(sources.reduce((n, s) => n + s.definition.questionCount, 0), 610);
  t.diagnostic(`Executed ${gradingCases} real-scorer assertions across the redesigned catalog.`);
});
