import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const script = fs.readFileSync(new URL("../session-persistence.js", import.meta.url), "utf8");
const dom = new JSDOM(`<!doctype html><body>
<button id="beginSessionBtn"></button><button id="boxOnePracticeBtn"></button><button id="practiceExtraBtn"></button>
<form id="newWordsForm"></form><button id="exitSessionBtn"></button><button id="nextCardBtn"></button>
<div id="reviewSession"></div><div id="answerFeedback"></div><div id="sessionComplete" class="hidden"></div>
<strong id="completeCorrect">۱</strong><strong id="completeWrong">۰</strong><button data-go="dashboard"></button>
</body>`, { runScripts: "outside-only", url: "http://localhost/index.html" });
const { window } = dom;
window.Headers = globalThis.Headers;
window.MutationObserver = class { observe() {} };
const requests = [];

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
  requests.push({ path, options });
  if (path === "/api/state" && String(options.method || "GET").toUpperCase() === "GET") {
    return responseFor({
      revision: 4,
      state: {
        history: [firstEvent],
        persistenceCursor: {
          historyLength: 1,
          lastReviewFingerprint: JSON.stringify([
            firstEvent.at, firstEvent.day, firstEvent.term, firstEvent.answer, true,
            firstEvent.mode, 1, 2, null
          ])
        }
      }
    });
  }
  if (path === "/api/learning/sessions") return responseFor({ session: { id: "session-123" } }, 201);
  if (path === "/api/learning/reviews") return responseFor({ revision: 5 });
  if (path.endsWith("/complete") || path.endsWith("/abandon")) return responseFor({ session: { id: "session-123" } });
  if (path === "/api/state") return responseFor({ revision: 5 });
  return responseFor({}, 404);
};

window.eval(script);
await window.fetch("/api/state");
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

let releaseSave;
window.VazheyarTest = {
  waitForSaves: () => new Promise((resolve) => { releaseSave = resolve; })
};
let advanced = 0;
window.document.querySelector("#nextCardBtn").addEventListener("click", () => { advanced += 1; });
window.document.querySelector("#nextCardBtn").click();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(advanced, 0, "the next card must wait for the current review write");
releaseSave();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(advanced, 1, "the next card may advance after the review write is durable");

console.log("Compact review persistence adapter tests passed.");
