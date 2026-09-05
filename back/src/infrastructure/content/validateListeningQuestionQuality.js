import { createHash } from "node:crypto";

export const REQUIRED_LISTENING_QUESTIONS = 10;
const TASK_TYPES = ["note_completion", "multiple_choice_single", "sentence_completion", "short_answer"];
const SKILLS = new Set(["detail", "paraphrase", "contrast", "cause_effect", "attitude"]);
const DISTINCTIONS = new Set(["contrast", "cause_effect", "attitude"]);
const HASH = /^[a-f0-9]{64}$/u;
const WORDS = ["ZERO", "ONE", "TWO", "THREE"];
const normalized = value => String(value).normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const text = (value, min = 1) => typeof value === "string" && value.trim().length >= min;

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}

/** Bind the review to the complete raw test, including timing and the selected audio edit. */
export function listeningReviewDigest(test) {
  const copy = structuredClone(test);
  if (copy.sourceReview) delete copy.sourceReview.contentSha256;
  return createHash("sha256").update(JSON.stringify(canonical(copy))).digest("hex");
}

/** Canonical wording deliberately distinguishes the product policy from an official IELTS paper. */
export function listeningAnswerInstruction(group) {
  if (group.taskType === "multiple_choice_single") return "Choose ONE letter for each answer.";
  const { maxWords: words, maxNumbers: numbers } = group;
  if (!Number.isInteger(words) || !Number.isInteger(numbers) || words < 0 || words > 3 || numbers < 0 || numbers > 1 || words + numbers === 0) return null;
  if (words === 0) return "Write ONE NUMBER ONLY for each answer.";
  if (numbers === 1) return `Write NO MORE THAN ${WORDS[words]} ${words === 1 ? "WORD" : "WORDS"} AND/OR A NUMBER for each answer.`;
  return words === 1 ? "Write ONE WORD ONLY for each answer." : `Write NO MORE THAN ${WORDS[words]} WORDS for each answer.`;
}

/**
 * Validate repeatable authoring checks after the domain parser has validated the public schema.
 * Evidence annotations and their digest are an audit trail, not a proof of semantic correctness.
 * Do not call this on persisted historical attempts: old completed snapshots must remain readable.
 */
export function validateListeningQuestionQuality(listening, { manifest, audioSha256 = null, sourceName = "listening.json" } = {}) {
  const fail = (id, message) => { throw new Error(`${sourceName}: ${id}: ${message}`); };
  if (!Array.isArray(listening?.tests) || !listening.tests.length) fail("catalog", "Tests are required.");
  const prompts = new Set();
  let questionCount = 0;
  for (const test of listening.tests) {
    const groups = test.groups ?? [];
    const questions = groups.flatMap(group => group.questions ?? []);
    if (questions.length !== REQUIRED_LISTENING_QUESTIONS) fail(test.id, "Each test needs exactly 10 scored questions, matching one IELTS Listening part.");
    if (TASK_TYPES.some(type => !groups.some(group => group.taskType === type))) fail(test.id, "Each test must use all four supported task types.");
    const review = test.sourceReview;
    if (!review || review.policyVersion !== 1 || !HASH.test(review.audioSha256 ?? "") || !text(review.method, 20) ||
        !/^\d{4}-\d{2}-\d{2}$/u.test(review.checkedAt ?? "") || !Number.isFinite(review.durationSeconds) || review.durationSeconds <= 0) {
      fail(test.id, "A complete source review with audio identity and duration is required.");
    }
    if (!manifest?.sourceUrl || review.sourceUrl !== manifest.sourceUrl) fail(test.id, "Review source must match the official episode source.");
    if (audioSha256 !== null && review.audioSha256 !== audioSha256) fail(test.id, "Actual audio hash does not match the reviewed recording.");
    let previousStart = -1; let previousEnd = -1; let paraphrases = 0; let distinctions = 0;
    const evidenceTargets = new Set();
    for (const group of groups) {
      if (!TASK_TYPES.includes(group.taskType)) fail(group.id, "Unsupported task type.");
      if (!Array.isArray(group.questions) || group.questions.length < 2) fail(group.id, "A coherent task group needs at least two questions.");
      const instruction = listeningAnswerInstruction(group);
      if (!instruction || group.answerInstruction !== instruction) fail(group.id, "Visible answer instruction must match the word/number limits.");
      for (const q of group.questions) {
        const prompt = normalized(q.prompt);
        if (prompts.has(prompt)) fail(q.id, "A duplicate prompt is not a distinct listening question or test variant.");
        prompts.add(prompt);
        const e = q.evidence;
        if (!e || !Number.isFinite(e.startSeconds) || !Number.isFinite(e.endSeconds) ||
            e.startSeconds < 0 || e.endSeconds <= e.startSeconds || e.endSeconds > review.durationSeconds ||
            !text(e.summary, 20) || typeof e.paraphrase !== "boolean" || !SKILLS.has(e.skill)) {
          fail(q.id, "Valid, supported and bounded source evidence is required for every question.");
        }
        if (e.startSeconds < previousStart || e.endSeconds < previousEnd) fail(q.id, "Audio chronology must move forward across the entire test, including group boundaries.");
        previousStart = e.startSeconds; previousEnd = e.endSeconds;
        const target = normalized(e.summary);
        if (evidenceTargets.has(target)) fail(q.id, "Repeated evidence target in one test.");
        evidenceTargets.add(target);
        paraphrases += Number(e.paraphrase);
        distinctions += Number(DISTINCTIONS.has(e.skill));
        if (group.taskType === "multiple_choice_single") {
          if (JSON.stringify(q.options?.map(option => option.label)) !== '["A","B","C"]' || !["A", "B", "C"].includes(q.answer)) {
            fail(q.id, "Single-choice items require exactly three options labelled A, B and C.");
          }
          if (new Set(q.options.map(option => normalized(option.text))).size !== 3) fail(q.id, "Options must be distinct.");
          const wrongLabels = q.options.filter(option => option.label !== q.answer).map(option => option.label);
          if (!e.distractors || Object.keys(e.distractors).sort().join() !== wrongLabels.sort().join() || wrongLabels.some(label => !text(e.distractors[label], 15))) {
            fail(q.id, "Explain why each distractor is rejected by the recording.");
          }
        }
      }
    }
    if (["hard", "very_hard"].includes(test.difficulty)) {
      if (paraphrases < Math.ceil(questions.length / 2)) fail(test.id, "Hard practice requires substantive paraphrase in at least half its questions.");
      if (distinctions < 2) fail(test.id, "Hard practice requires at least two evidenced distinctions of contrast, cause/effect or attitude.");
    }
    if (test.difficulty === "medium" && paraphrases < Math.ceil(questions.length / 3)) fail(test.id, "Medium practice requires meaningful paraphrase, not only transcription.");
    if (!HASH.test(review.contentSha256 ?? "") || review.contentSha256 !== listeningReviewDigest(test)) fail(test.id, "Missing or stale review digest; review the changed content and its evidence again.");
    questionCount += questions.length;
  }
  return { tests: listening.tests.length, questions: questionCount, requiredQuestions: REQUIRED_LISTENING_QUESTIONS };
}
