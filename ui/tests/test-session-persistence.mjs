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
window.fetch = async (input, options = {}) => {
  const path = new URL(typeof input === "string" ? input : input.url, window.location.href).pathname;
  requests.push({ path, options });
  const payload = path === "/api/learning/sessions"
    ? { session: { id: "session-123", status: "active" } }
    : { session: { id: "session-123", status: "completed" } };
  return { ok: true, status: 200, async json() { return payload; } };
};
window.eval(script);

assert.equal(window.VocoraSessionPersistenceTest.parseLocalizedInteger("۱۲۳ کارت"), 123);
window.document.querySelector("#boxOnePracticeBtn").click();
await new Promise((resolve) => setTimeout(resolve, 10));
assert.equal(window.VocoraSessionPersistenceTest.getActiveSession()?.id, "session-123");

await window.fetch("/api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: "{}" });
const stateRequest = requests.find((request) => request.path === "/api/state");
assert.equal(new window.Headers(stateRequest.options.headers).get("X-Vocora-Session-Id"), "session-123");

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
