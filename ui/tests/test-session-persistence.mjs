import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const script = fs.readFileSync(new URL("../session-persistence.js", import.meta.url), "utf8");
const dom = new JSDOM(`<!doctype html><body>
<button id="beginSessionBtn"></button><button id="boxOnePracticeBtn"></button><button id="practiceExtraBtn"></button>
<form id="newWordsForm"></form><button id="exitSessionBtn"></button>
<div id="reviewSession"></div><div id="sessionComplete" class="hidden"></div>
<strong id="completeCorrect">۲</strong><strong id="completeWrong">۱</strong>
<button data-go="dashboard"></button>
</body>`, { runScripts: "outside-only", url: "http://localhost/index.html" });
const { window } = dom;
window.Headers = globalThis.Headers;
const requests = [];

const persistedEvent = {
  at: "2026-08-07T10:00:00.000Z",
  day: "2026-08-07",
  term: "Monday",
  answer: "monday",
  correct: true,
  mode: "review",
  previousBox: 1,
  newBox: 2,
  mistakeNumber: null
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
        history: [persistedEvent],
        persistenceCursor: {
          historyLength: 1,
          lastReviewFingerprint: JSON.stringify([
            persistedEvent.at,
            persistedEvent.day,
            persistedEvent.term,
            persistedEvent.answer,
            true,
            persistedEvent.mode,
            1,
            2,
            null
          ])
        }
      }
    });
  }
  if (path === "/api/state") return responseFor({ revision: 5 });
  const payload = path === "/api/learning/sessions"
    ? { session: { id: "session-123", status: "active" } }
    : { session: { id: "session-123", status: "completed" } };
  return responseFor(payload);
};
window.eval(script);

assert.equal(window.VocoraSessionPersistenceTest.parseLocalizedInteger("۱۲۳ کارت"), 123);

await window.fetch("/api/state");
assert.equal(window.VocoraSessionPersistenceTest.getPersistedCursor()?.historyLength, 1);

window.document.querySelector("#boxOnePracticeBtn").click();
await new Promise((resolve) => setTimeout(resolve, 10));
assert.equal(window.VocoraSessionPersistenceTest.getActiveSession()?.id, "session-123");

const secondEvent = { ...persistedEvent, at: "2026-08-07T10:01:00.000Z", term: "Tuesday", answer: "tuesday" };
await window.fetch("/api/state", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ revision: 4, state: { history: [persistedEvent, secondEvent] } })
});
const firstStateWrite = requests.filter((request) => request.path === "/api/state" && request.options.method === "PUT")[0];
assert.equal(new window.Headers(firstStateWrite.options.headers).get("X-Vocora-Session-Id"), "session-123");
const firstWriteBody = JSON.parse(firstStateWrite.options.body);
assert.equal(firstWriteBody.state.persistenceCursor.historyLength, 1);
assert.equal(firstWriteBody.state.normalizedPersistenceVersion, 2);
assert.equal(window.VocoraSessionPersistenceTest.getPersistedCursor()?.historyLength, 2);

const thirdEvent = { ...persistedEvent, at: "2026-08-07T10:02:00.000Z", term: "Wednesday", answer: "wednesday" };
await window.fetch("/api/state", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ revision: 5, state: { history: [persistedEvent, secondEvent, thirdEvent] } })
});
const stateWrites = requests.filter((request) => request.path === "/api/state" && request.options.method === "PUT");
const secondWriteBody = JSON.parse(stateWrites[1].options.body);
assert.equal(secondWriteBody.state.persistenceCursor.historyLength, 2,
  "the next save must tell the server exactly how much review history is already persisted");
assert.equal(window.VocoraSessionPersistenceTest.getPersistedCursor()?.historyLength, 3);

window.document.querySelector("#sessionComplete").classList.remove("hidden");
await new Promise((resolve) => setTimeout(resolve, 10));
const completion = requests.find((request) => request.path.endsWith("/complete"));
assert.ok(completion, "session completion must be persisted explicitly");
const completionBody = JSON.parse(completion.options.body);
assert.deepEqual({
  completedCount: completionBody.completedCount,
  correctCount: completionBody.correctCount,
  wrongCount: completionBody.wrongCount
}, { completedCount: 3, correctCount: 2, wrongCount: 1 });
assert.ok(Number.isInteger(completionBody.durationSeconds) && completionBody.durationSeconds >= 0);
assert.equal(window.VocoraSessionPersistenceTest.getActiveSession(), null);

console.log("Practice session persistence tests passed.");
