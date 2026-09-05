import assert from "node:assert/strict";
import test from "node:test";
import { listeningReviewDigest, validateListeningQuestionQuality } from "../src/infrastructure/content/validateListeningQuestionQuality.js";

const manifest = { sourceUrl: "https://www.bbc.co.uk/learningenglish/english/features/6-minute-english_2026/ep-260611" };
const hash = "a".repeat(64);
const types = ["note_completion", "multiple_choice_single", "sentence_completion", "short_answer"];
function fixture(difficulty = "medium") {
  let number = 0;
  const value = { schemaVersion: 2, tests: [{ id: "sample-test", difficulty,
    sourceReview: { policyVersion: 1, sourceUrl: manifest.sourceUrl, audioSha256: hash,
      durationSeconds: 360, checkedAt: "2026-09-05", method: "Official reference and word-timed audio cross-check" },
    groups: types.map((taskType, i) => ({ id: `sample-group-${i + 1}`, taskType,
      maxWords: taskType === "multiple_choice_single" ? null : 2,
      maxNumbers: taskType === "multiple_choice_single" ? null : 0,
      answerInstruction: taskType === "multiple_choice_single" ? "Choose ONE letter for each answer." : "Write NO MORE THAN TWO WORDS for each answer.",
      questions: Array.from({ length: [3, 3, 2, 2][i] }, () => {
        const n = ++number;
        const q = { id: `sample-question-${n}`, prompt: `A distinct source-supported prompt ${n}`,
          evidence: { startSeconds: n * 10, endSeconds: n * 10 + 4, summary: `Specific evidence supporting target ${n} in this passage.`,
            paraphrase: n % 2 === 1 || difficulty === "hard", skill: n === 5 || n === 6 ? "cause_effect" : "detail" } };
        if (taskType === "multiple_choice_single") Object.assign(q, {
          options: ["A", "B", "C"].map((label) => ({ label, text: `Distinct option ${label}` })), answer: "B"
        }, { evidence: { ...q.evidence, distractors: { A: "This reverses the stated cause and effect.", C: "This attributes the example to the wrong group." } } });
        else q.answers = ["sample answer"];
        return q;
      }) })) }] };
  seal(value); return value;
}
function seal(value) { for (const t of value.tests) t.sourceReview.contentSha256 = listeningReviewDigest(t); }
function check(value) { return validateListeningQuestionQuality(value, { manifest, audioSha256: hash }); }

test("accepts a reviewed ten-question IELTS-part set with all four supported types", () => {
  assert.deepEqual(check(fixture()), { tests: 1, questions: 10, requiredQuestions: 10 });
});
test("rejects six-question padding even when JSON would otherwise parse", () => {
  const d = fixture(); d.tests[0].groups.forEach(g => g.questions = g.questions.slice(0, 1)); seal(d);
  assert.throws(() => check(d), /exactly 10/);
});
test("requires task diversity in every test rather than across the episode", () => {
  const d = fixture(); d.tests[0].groups[3].taskType = "note_completion"; seal(d);
  assert.throws(() => check(d), /all four/);
});
test("rejects backward audio movement across a group boundary", () => {
  const d = fixture(); Object.assign(d.tests[0].groups[1].questions[0].evidence, { startSeconds: 25, endSeconds: 29 }); seal(d);
  assert.throws(() => check(d), /chronology/);
});
test("rejects repeated, missing, non-finite and out-of-range answer evidence", () => {
  for (const mutate of [
    q => delete q.evidence,
    q => q.evidence.startSeconds = Number.NaN,
    q => q.evidence.endSeconds = 500,
    q => q.evidence.endSeconds = q.evidence.startSeconds,
    q => q.evidence.summary = ""
  ]) { const d = fixture(); mutate(d.tests[0].groups[0].questions[0]); seal(d); assert.throws(() => check(d), /evidence/); }
});
test("rejects a different audio edit rather than trusting invented timing", () => {
  assert.throws(() => validateListeningQuestionQuality(fixture(), { manifest, audioSha256: "b".repeat(64) }), /audio.*hash/i);
});
test("rejects a missing review or a review of the wrong official source", () => {
  const d = fixture(); d.tests[0].sourceReview.sourceUrl = "https://example.org"; seal(d);
  assert.throws(() => check(d), /source/);
  delete d.tests[0].sourceReview;
  assert.throws(() => check(d), /source review/);
});
test("rejects stale review digests after questions or evidence change", () => {
  const d = fixture(); d.tests[0].groups[0].questions[0].prompt += " changed";
  assert.throws(() => check(d), /review digest/);
});
test("matches visible word and number instructions to machine limits", () => {
  const d = fixture(); d.tests[0].groups[0].answerInstruction = "Write ONE WORD ONLY for each answer."; seal(d);
  assert.throws(() => check(d), /answer instruction/);
});
test("requires three A/B/C options and an evidence-based rejection of each distractor", () => {
  const d = fixture(); const q = d.tests[0].groups[1].questions[0]; q.options.push({ label: "D", text: "Another option" }); seal(d);
  assert.throws(() => check(d), /three.*A.*B.*C/);
  q.options.pop(); delete q.evidence.distractors.A; seal(d);
  assert.throws(() => check(d), /distractor/);
});
test("does not accept a hard badge without the required listening operations", () => {
  const d = fixture("hard");
  for (const g of d.tests[0].groups) for (const q of g.questions) q.evidence.paraphrase = false;
  seal(d); assert.throws(() => check(d), /paraphrase/);
  for (const g of d.tests[0].groups) for (const q of g.questions) { q.evidence.paraphrase = true; q.evidence.skill = "detail"; }
  seal(d); assert.throws(() => check(d), /distinction/);
});
test("rejects duplicate prompts in one test and cosmetic duplicate test variants", () => {
  const d = fixture(); d.tests[0].groups[0].questions[1].prompt = d.tests[0].groups[0].questions[0].prompt; seal(d);
  assert.throws(() => check(d), /duplicate prompt/);
  const v = fixture(); v.tests.push(structuredClone(v.tests[0])); v.tests[1].id = "other-test"; seal(v);
  assert.throws(() => check(v), /duplicate prompt|duplicate test/);
});
test("does not require local ignored audio for offline catalog checks", () => {
  assert.equal(validateListeningQuestionQuality(fixture(), { manifest }).questions, 10);
});
