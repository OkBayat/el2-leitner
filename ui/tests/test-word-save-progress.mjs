import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const script = fs.readFileSync(new URL("../word-collections.js", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../library-integration.css", import.meta.url), "utf8");
const dom = new JSDOM(`<!doctype html><body>
<section id="view-words"><table><thead><tr><th>word</th><th>category</th><th>box</th></tr></thead>
<tbody id="wordsTableBody">
<tr><td>first word</td><td>Test</td><td>new</td><td><button class="add-to-box-one" data-id="first-word">+</button></td></tr>
<tr><td>second word</td><td>Test</td><td>new</td><td><button class="add-to-box-one" data-id="second-word">+</button></td></tr>
<tr><td>third word</td><td>Test</td><td>new</td><td><button class="add-to-box-one" data-id="third-word">+</button></td></tr>
</tbody></table></section>
<input id="wordSearch"><select id="boxFilter"></select><select id="sortWords"></select>
<button id="prevPage"></button><button id="nextPage"></button>
<div id="toast" class="toast" role="status" aria-live="polite"></div>
</body>`, { runScripts: "outside-only", url: "https://vocora.test/#words" });
const { window } = dom;

function word(id, number, term) {
  return {
    id, number, term, accepted: [term], category: "Test", notes: "",
    box: 0, due: null, attempts: 0, correct: 0, mistakes: 0, currentStreak: 0,
    introducedOn: null, addedSource: null, lastReviewed: null, lastPromotedDay: null,
    blockedUntil: null, masteredAt: null
  };
}

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return structuredClone(payload); },
    clone() { return response(payload, status); }
  };
}

const state = {
  settings: { dailyNew: 0, dailyGoal: 20, voiceRate: 0.85, theme: "light" },
  words: [
    word("first-word", 1, "first word"),
    word("second-word", 2, "second word"),
    word("third-word", 3, "third word")
  ],
  history: [],
  daily: {
    "2026-08-21": { attempts: 0, correct: 0, wrong: 0, newAdded: 0, sessions: 0, durationSeconds: 0 }
  }
};

let revision = 21;
let activationStatus = 200;
window.fetch = async (input, options = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url, window.location.href);
  const method = String(options.method || "GET").toUpperCase();
  if (url.pathname === "/api/library/vocabulary-sources") return response({ sources: [] });
  if (url.pathname === "/api/state" && method === "GET") return response({ state: structuredClone(state), revision });
  if (url.pathname === "/api/state" && method === "PUT") {
    revision += 1;
    return response({ revision }, 200);
  }
  if (url.pathname === "/api/learning/vocabulary-activations" && method === "POST") {
    if (activationStatus >= 200 && activationStatus < 300) revision += 1;
    return response({ revision }, activationStatus);
  }
  return response({}, 404);
};

window.eval(script);
await new Promise((resolve) => setTimeout(resolve, 10));
await window.fetch("/api/state");

assert.match(styles, /\.word-save-progress\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?bottom:\s*25px;[\s\S]*?left:\s*25px;/);
assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.word-save-progress\s*\{[\s\S]*?bottom:\s*82px;/);

const trackerEvents = [];
const tracker = window.VocoraWordCollectionsTest.createPendingSaveTracker((snapshot) => trackerEvents.push(snapshot));
tracker.begin("a");
tracker.begin("b");
tracker.failed("a");
tracker.saved("b");
tracker.saved("a");
assert.deepEqual(trackerEvents, [
  { pending: 1, failed: 0 },
  { pending: 2, failed: 0 },
  { pending: 2, failed: 1 },
  { pending: 1, failed: 1 },
  { pending: 0, failed: 0 }
], "The domain tracker must only remove a pending save after success");

const tableBody = window.document.querySelector("#wordsTableBody");
const toast = window.document.querySelector("#toast");
tableBody.addEventListener("click", (event) => {
  if (!event.target.closest?.(".add-to-box-one")) return;
  toast.textContent = "«word» به خانهٔ ۱ اضافه شد و آمادهٔ آزمون است.";
  toast.classList.add("show");
});

function activateLocally(id) {
  const target = state.words.find((item) => item.id === id);
  target.box = 1;
  target.due = "2026-08-21";
  target.introducedOn = "2026-08-21";
  target.addedSource = "word-bank";
  state.daily["2026-08-21"].newAdded += 1;
}

async function persistSnapshot(snapshot) {
  return window.fetch("/api/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ revision, state: snapshot })
  });
}

window.document.querySelector('.add-to-box-one[data-id="first-word"]').click();
activateLocally("first-word");
const firstSnapshot = structuredClone(state);
window.document.querySelector('.add-to-box-one[data-id="second-word"]').click();
activateLocally("second-word");
const secondSnapshot = structuredClone(state);
await Promise.resolve();

const indicator = window.document.querySelector("#wordSaveProgress");
assert.ok(indicator, "A dedicated save progress status must be created for word-bank activations");
assert.equal(indicator.getAttribute("role"), "status");
assert.equal(indicator.getAttribute("aria-live"), "polite");
assert.equal(indicator.getAttribute("aria-atomic"), "true");
assert.equal(indicator.classList.contains("show"), true);
assert.match(indicator.textContent, /۲/);
assert.match(indicator.textContent, /در حال ثبت/);
assert.equal(toast.classList.contains("show"), false, "The old immediate success toast must be replaced by save progress");
assert.deepEqual(window.VocoraWordCollectionsTest.getWordSaveProgress(), { pending: 2, failed: 0 });

const firstSave = await persistSnapshot(firstSnapshot);
assert.equal(firstSave.status, 200);
assert.deepEqual(window.VocoraWordCollectionsTest.getWordSaveProgress(), { pending: 1, failed: 0 });
assert.match(indicator.textContent, /۱/, "Each server acknowledgement must decrement exactly one rapid click");
assert.equal(indicator.classList.contains("show"), true);

const secondSave = await persistSnapshot(secondSnapshot);
assert.equal(secondSave.status, 200);
assert.deepEqual(window.VocoraWordCollectionsTest.getWordSaveProgress(), { pending: 0, failed: 0 });
assert.equal(indicator.classList.contains("show"), false, "The progress notice must close only after all saves succeed");

activationStatus = 503;
window.document.querySelector('.add-to-box-one[data-id="third-word"]').click();
await Promise.resolve();
activateLocally("third-word");
const failedSave = await persistSnapshot(structuredClone(state));
assert.equal(failedSave.status, 503);
assert.deepEqual(window.VocoraWordCollectionsTest.getWordSaveProgress(), { pending: 1, failed: 1 });
assert.equal(indicator.classList.contains("show"), true, "An unsaved word must remain visible after a failed request");
assert.equal(indicator.classList.contains("error"), true);
assert.match(indicator.textContent, /۱/);
assert.match(indicator.textContent, /ثبت نشده/);

activationStatus = 200;
const third = state.words.find((item) => item.id === "third-word");
third.box = 2;
third.due = "2026-08-23";
third.lastPromotedDay = "2026-08-21";
const recoveredSave = await persistSnapshot(structuredClone(state));
assert.equal(recoveredSave.status, 200);
assert.deepEqual(
  window.VocoraWordCollectionsTest.getWordSaveProgress(),
  { pending: 0, failed: 0 },
  "A later successful full-state save must clear an activation even if the word has already advanced"
);
assert.equal(indicator.classList.contains("show"), false);

console.log("Word-bank save progress lifecycle passed.");
