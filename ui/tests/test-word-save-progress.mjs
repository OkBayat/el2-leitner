import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const script = fs.readFileSync(new URL("../word-collections.js", import.meta.url), "utf8");
const dom = new JSDOM(`<!doctype html><body>
<section id="view-words"><table><thead><tr><th>word</th><th>category</th><th>box</th></tr></thead>
<tbody id="wordsTableBody">
<tr><td>first word</td><td>Test</td><td>new</td><td><button class="add-to-box-one" data-id="first-word">+</button></td></tr>
<tr><td>second word</td><td>Test</td><td>new</td><td><button class="add-to-box-one" data-id="second-word">+</button></td></tr>
</tbody></table></section>
<input id="wordSearch"><select id="boxFilter"></select><select id="sortWords"></select>
<button id="prevPage"></button><button id="nextPage"></button>
<div id="toast" class="toast" role="status" aria-live="polite"></div>
</body>`, { runScripts: "outside-only", url: "https://vocora.test/#words" });
const { window } = dom;

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
    {
      id: "first-word", number: 1, term: "first word", accepted: ["first word"], category: "Test", notes: "",
      box: 0, due: null, attempts: 0, correct: 0, mistakes: 0, currentStreak: 0,
      introducedOn: null, addedSource: null, lastReviewed: null, lastPromotedDay: null,
      blockedUntil: null, masteredAt: null
    },
    {
      id: "second-word", number: 2, term: "second word", accepted: ["second word"], category: "Test", notes: "",
      box: 0, due: null, attempts: 0, correct: 0, mistakes: 0, currentStreak: 0,
      introducedOn: null, addedSource: null, lastReviewed: null, lastPromotedDay: null,
      blockedUntil: null, masteredAt: null
    }
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
  if (url.pathname === "/api/learning/vocabulary-activations" && method === "POST") {
    if (activationStatus >= 200 && activationStatus < 300) revision += 1;
    return response({ revision }, activationStatus);
  }
  return response({}, 404);
};

window.eval(script);
await new Promise((resolve) => setTimeout(resolve, 10));
await window.fetch("/api/state");

const tableBody = window.document.querySelector("#wordsTableBody");
const toast = window.document.querySelector("#toast");
tableBody.addEventListener("click", (event) => {
  if (!event.target.closest?.(".add-to-box-one")) return;
  toast.textContent = "«word» به خانهٔ ۱ اضافه شد و آمادهٔ آزمون است.";
  toast.classList.add("show");
});

function activateLocally(id) {
  const word = state.words.find((item) => item.id === id);
  word.box = 1;
  word.due = "2026-08-21";
  word.introducedOn = "2026-08-21";
  word.addedSource = "word-bank";
  state.daily["2026-08-21"].newAdded += 1;
}

async function persistSnapshot() {
  return window.fetch("/api/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ revision, state: structuredClone(state) })
  });
}

const firstButton = window.document.querySelector('.add-to-box-one[data-id="first-word"]');
firstButton.click();
await Promise.resolve();

const indicator = window.document.querySelector("#wordSaveProgress");
assert.ok(indicator, "A dedicated save progress status must be created for word-bank activations");
assert.equal(indicator.getAttribute("role"), "status");
assert.equal(indicator.getAttribute("aria-live"), "polite");
assert.equal(indicator.getAttribute("aria-atomic"), "true");
assert.equal(indicator.classList.contains("show"), true);
assert.match(indicator.textContent, /۱/);
assert.match(indicator.textContent, /در حال ثبت/);
assert.equal(toast.classList.contains("show"), false, "The old immediate success toast must be replaced by save progress");
assert.deepEqual(window.VocoraWordCollectionsTest.getWordSaveProgress(), { pending: 1, failed: 0 });

activateLocally("first-word");
const successfulSave = await persistSnapshot();
assert.equal(successfulSave.status, 200);
assert.deepEqual(window.VocoraWordCollectionsTest.getWordSaveProgress(), { pending: 0, failed: 0 });
assert.equal(indicator.classList.contains("show"), false, "The progress notice must close only after server success");

activationStatus = 503;
window.document.querySelector('.add-to-box-one[data-id="second-word"]').click();
await Promise.resolve();
activateLocally("second-word");
const failedSave = await persistSnapshot();
assert.equal(failedSave.status, 503);
assert.deepEqual(window.VocoraWordCollectionsTest.getWordSaveProgress(), { pending: 1, failed: 1 });
assert.equal(indicator.classList.contains("show"), true, "An unsaved word must remain visible after a failed request");
assert.equal(indicator.classList.contains("error"), true);
assert.match(indicator.textContent, /۱/);
assert.match(indicator.textContent, /ثبت نشده/);

console.log("Word-bank save progress lifecycle passed.");
