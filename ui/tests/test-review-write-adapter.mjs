import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const script = fs.readFileSync(new URL("../session-persistence.js", import.meta.url), "utf8");
const dom = new JSDOM(`<!doctype html><body>
<button id="beginSessionBtn"></button><button id="boxOnePracticeBtn"></button><button id="practiceExtraBtn"></button>
<form id="newWordsForm"></form><button id="exitSessionBtn"></button><button id="nextCardBtn"></button>
<div id="reviewSession"></div><div id="answerFeedback"></div><div id="sessionComplete" class="hidden"></div>
<div id="practiceRemediation"><input id="remediationInput"></div>
<strong id="completeCorrect">۱</strong><strong id="completeWrong">۰</strong><button data-go="dashboard"></button>
</body>`, { runScripts: "outside-only", url: "http://localhost/index.html" });
const { window } = dom;
window.Headers = globalThis.Headers;
window.MutationObserver = class { observe() {} };
const requests = [];
let reviewStatus = 200;
let reviewRevisionOverride = null;
let reviewNetworkFailures = 0;
let fullStateStatus = 200;

const firstEvent = {
  at: "2026-08-15T08:00:00.000Z",
  day: "2026-08-15",
  wordId: "vocab-monday",
  term: "Monday",
  answer: "monday",
  correct: true,
  mode: "review",
  promoted: true,
  previousBox: 1,
  newBox: 2,
  mistakeNumber: null
};
const secondEvent = {
  ...firstEvent,
  at: "2026-08-15T08:01:00.000Z",
  wordId: "vocab-tuesday",
  term: "Tuesday",
  answer: "tuesday"
};
const thirdEvent = {
  ...firstEvent,
  at: "2026-08-15T08:02:00.000Z",
  wordId: "vocab-wednesday",
  term: "Wednesday",
  answer: "wednesday"
};
const fourthEvent = {
  ...firstEvent,
  at: "2026-08-15T08:03:00.000Z",
  wordId: "vocab-thursday",
  term: "Thursday",
  answer: "thursday"
};
let stateReadHistory = [firstEvent];
let stateReadRevision = 4;

function responseFor(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return structuredClone(payload); },
    clone() { return responseFor(payload, status); }
  };
}

window.fetch = async (input, options = {}) => {
  const path = new URL(typeof input === "string" ? input : input.url, window.location.href).pathname;
  const method = String(options.method || "GET").toUpperCase();
  requests.push({ path, options });
  if (path === "/api/state" && method === "GET") {
    return responseFor({
      revision: stateReadRevision,
      state: {
        history: structuredClone(stateReadHistory),
        // Deliberately stale metadata: the adapter must derive the authoritative
        // cursor from the history returned by the server.
        persistenceCursor: { historyLength: 0, lastReviewFingerprint: null }
      }
    });
  }
  if (path === "/api/learning/sessions") return responseFor({ session: { id: "session-123" } }, 201);
  if (path === "/api/learning/reviews") {
    if (reviewNetworkFailures > 0) {
      reviewNetworkFailures -= 1;
      throw new TypeError("Failed to fetch");
    }
    const command = JSON.parse(options.body);
    const revision = reviewRevisionOverride ?? Number(command.revision) + 1;
    return reviewStatus === 200
      ? responseFor({ revision })
      : responseFor({ error: { code: "STATE_CONFLICT", message: "conflict" } }, reviewStatus);
  }
  if (path.endsWith("/complete") || path.endsWith("/abandon")) return responseFor({ session: { id: "session-123" } });
  if (path === "/api/state" && method === "PUT") {
    const payload = JSON.parse(options.body);
    return fullStateStatus === 200
      ? responseFor({ revision: Number(payload.revision) + 1 })
      : responseFor({ error: { code: "STATE_CONFLICT", message: "conflict" } }, fullStateStatus);
  }
  return responseFor({}, 404);
};

window.eval(script);
await window.fetch("/api/state");
assert.equal(window.VocoraSessionPersistenceTest.getPersistedCursor().historyLength, 1,
  "state reads must derive the cursor from real history instead of trusting stale metadata");
await window.VocoraSessionPersistenceTest.startSession("review");

const state = {
  history: [firstEvent, secondEvent],
  words: [{
    id: "vocab-tuesday",
    box: 2,
    due: "2026-08-17",
    attempts: 1,
    correct: 1,
    mistakes: 0,
    currentStreak: 1,
    introducedOn: "2026-08-15",
    addedSource: "daily",
    lastReviewed: secondEvent.at,
    lastPromotedDay: "2026-08-15",
    blockedUntil: null,
    masteredAt: null
  }],
  daily: {
    "2026-08-15": { attempts: 2, correct: 2, wrong: 0, newAdded: 10, sessions: 0, durationSeconds: 0 }
  }
};
const response = await window.fetch("/api/state", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ revision: 4, state })
});
assert.equal(response.status, 200);

const compact = requests.find((request) => request.path === "/api/learning/reviews");
assert.ok(compact, "a one-review state change must use the compact review command");
assert.equal(requests.some((request) => request.path === "/api/state" && request.options.method === "PUT"), false,
  "the review hot path must not send the full learning state");
const body = JSON.parse(compact.options.body);
assert.equal(body.word.id, "vocab-tuesday");
assert.equal(body.event.wordId, "vocab-tuesday");
assert.equal(body.practiceSessionId, "session-123");
assert.equal(body.revision, 4);
assert.equal(Object.hasOwn(body, "words"), false);
assert.equal(window.VocoraSessionPersistenceTest.getPersistedCursor().historyLength, 2);
assert.equal(window.VocoraSessionPersistenceTest.getPendingReviewRevision(), null,
  "a valid server revision acknowledgement must close the review barrier");

// When a capped history drops its oldest item, the saved fingerprint shifts left.
// Cursor recovery must mirror the backend and still identify exactly one new review.
const shiftedHistory = { history: [secondEvent, thirdEvent] };
assert.equal(window.VocoraSessionPersistenceTest.reviewDeltaCount(shiftedHistory), 1);

let releaseSave;
window.VazheyarTest = {
  waitForSaves: () => new Promise((resolve) => { releaseSave = resolve; })
};
let advanced = 0;
window.document.querySelector("#nextCardBtn").addEventListener("click", () => { advanced += 1; });
window.document.querySelector("#nextCardBtn").click();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(advanced, 0, "the next card must wait for the application's current save queue");
releaseSave();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(advanced, 1, "the next card may advance after the acknowledged write and save queue are both complete");

const remediationInput = window.document.querySelector("#remediationInput");
const remediationEnter = new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
remediationInput.dispatchEvent(remediationEnter);
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(remediationEnter.defaultPrevented, false,
  "the persistence barrier must not steal Enter from the remediation form");
assert.equal(advanced, 1, "remediation Enter must not advance the primary review queue");

// More than one unpersisted review intentionally uses the full-state fallback.
// A failure there must still block advancing; app-v2's save queue catches errors.
fullStateStatus = 409;
window.VazheyarTest = { waitForSaves: async () => {} };
const fallbackState = {
  ...state,
  history: [firstEvent, secondEvent, thirdEvent, fourthEvent],
  words: [{
    ...state.words[0],
    id: "vocab-thursday",
    lastReviewed: fourthEvent.at
  }],
  daily: {
    "2026-08-15": { attempts: 4, correct: 4, wrong: 0, newAdded: 10, sessions: 0, durationSeconds: 0 }
  }
};
const compactCountBeforeFallback = requests.filter((request) => request.path === "/api/learning/reviews").length;
const fallbackResponse = await window.fetch("/api/state", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ revision: 5, state: fallbackState })
});
assert.equal(fallbackResponse.status, 409);
assert.equal(requests.filter((request) => request.path === "/api/learning/reviews").length, compactCountBeforeFallback,
  "multiple review deltas must use the intentional full-state fallback");
assert.equal(window.VocoraSessionPersistenceTest.getReviewWriteFailed(), true);
assert.equal(window.VocoraSessionPersistenceTest.getPendingReviewRevision(), 6);
window.document.querySelector("#nextCardBtn").click();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(advanced, 1, "a failed full-state review write must block moving to the next card");

// A direct compact conflict must also keep the barrier closed.
fullStateStatus = 200;
reviewStatus = 409;
reviewRevisionOverride = null;
stateReadHistory = [firstEvent, secondEvent];
stateReadRevision = 5;
await window.fetch("/api/state");
const failedCompactState = {
  ...state,
  history: [firstEvent, secondEvent, thirdEvent],
  words: [{
    ...state.words[0],
    id: "vocab-wednesday",
    lastReviewed: thirdEvent.at
  }],
  daily: {
    "2026-08-15": { attempts: 3, correct: 3, wrong: 0, newAdded: 10, sessions: 0, durationSeconds: 0 }
  }
};
const compactCountBeforeConflict = requests.filter((request) => request.path === "/api/learning/reviews").length;
const failedResponse = await window.fetch("/api/state", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ revision: 5, state: failedCompactState })
});
assert.equal(failedResponse.status, 409);
assert.equal(requests.filter((request) => request.path === "/api/learning/reviews").length, compactCountBeforeConflict + 1,
  "one review delta must still use the compact endpoint after a fresh state read");
assert.equal(window.VocoraSessionPersistenceTest.getReviewWriteFailed(), true);
assert.equal(window.VocoraSessionPersistenceTest.getPendingReviewRevision(), 6);

// Even a 200 response is not accepted if it acknowledges the wrong revision.
reviewStatus = 200;
reviewRevisionOverride = 5;
await window.fetch("/api/state");
const staleAckResponse = await window.fetch("/api/state", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ revision: 5, state: failedCompactState })
});
assert.equal(staleAckResponse.status, 200);
assert.equal(window.VocoraSessionPersistenceTest.getReviewWriteFailed(), true,
  "a stale server revision acknowledgement must keep the barrier closed");
assert.equal(window.VocoraSessionPersistenceTest.getPendingReviewRevision(), 6);

// Repeated transient connection closures must not lose the review. The backend
// already treats an identical retried review event as idempotent, so transport
// retries can safely recover after the connection comes back.
reviewRevisionOverride = null;
reviewNetworkFailures = 2;
await window.fetch("/api/state");
const compactCountBeforeNetworkFailure = requests.filter((request) => request.path === "/api/learning/reviews").length;
const recoveredResponse = await window.fetch("/api/state", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ revision: 5, state: failedCompactState })
});
assert.equal(recoveredResponse.status, 200);
const recoveredRequests = requests
  .filter((request) => request.path === "/api/learning/reviews")
  .slice(compactCountBeforeNetworkFailure);
assert.equal(recoveredRequests.length, 3,
  "two consecutive Failed to fetch errors must be retried until the idempotent review succeeds");
assert.equal(new Set(recoveredRequests.map((request) => request.options.body)).size, 1,
  "every retry must resend the exact same idempotent review command");
assert.equal(window.VocoraSessionPersistenceTest.getReviewWriteFailed(), false);
assert.equal(window.VocoraSessionPersistenceTest.getPendingReviewRevision(), null);

console.log("Compact review persistence adapter tests passed.");