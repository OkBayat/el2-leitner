import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const root = new URL("../", import.meta.url);
const rawHtml = fs.readFileSync(new URL("index.html", root), "utf8");
const html = rawHtml.replace(/<script\s+src="[^"]+"><\/script>/g, "");
const app = fs.readFileSync(new URL("app-v2.js", root), "utf8");
const sessionPersistence = fs.readFileSync(new URL("session-persistence.js", root), "utf8");
const wordCollections = fs.readFileSync(new URL("word-collections.js", root), "utf8");

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function mockResponse(status, payload = null) {
  const raw = payload === null ? "" : JSON.stringify(payload);
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return raw; },
    async json() { return clone(payload); },
    clone() { return mockResponse(status, payload); }
  };
}

function makeWord(index) {
  return {
    id: `real-save-${index}`,
    number: index,
    term: `real save word ${index}`,
    accepted: [`real save word ${index}`],
    category: "Real app save progress",
    notes: "",
    createdAt: "2026-08-21T08:00:00.000Z",
    box: 0,
    due: null,
    attempts: 0,
    correct: 0,
    mistakes: 0,
    currentStreak: 0,
    introducedOn: null,
    addedSource: null,
    lastReviewed: null,
    lastPromotedDay: null,
    blockedUntil: null,
    masteredAt: null
  };
}

let serverRevision = 40;
const serverState = {
  schemaVersion: 2,
  createdAt: "2026-08-21T08:00:00.000Z",
  updatedAt: "2026-08-21T08:00:00.000Z",
  settings: { dailyNew: 0, dailyGoal: 20, voiceRate: 0.85, theme: "light" },
  words: Array.from({ length: 12 }, (_, index) => makeWord(index + 1)),
  daily: {},
  history: []
};

const activationRequests = [];
const fullStateWrites = [];

const dom = new JSDOM(html, {
  url: "https://vocora.test/#words",
  runScripts: "outside-only",
  pretendToBeVisual: true,
  beforeParse(window) {
    window.Headers = globalThis.Headers;
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    window.scrollTo = () => {};
    window.confirm = () => true;
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    window.speechSynthesis = { cancel() {}, speak() {}, getVoices() { return []; } };
    window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
    window.HTMLDialogElement.prototype.close = function close() { this.open = false; };

    window.fetch = async (input, options = {}) => {
      const url = new URL(typeof input === "string" ? input : input.url, window.location.href);
      const method = String(options.method || (typeof input !== "string" ? input.method : "GET") || "GET").toUpperCase();

      if (url.pathname === "/api/auth/me" && method === "GET") {
        return mockResponse(200, { user: { id: 1, email: "save-progress@example.com" } });
      }
      if (url.pathname === "/api/state" && method === "GET") {
        return mockResponse(200, { state: clone(serverState), revision: serverRevision });
      }
      if (url.pathname === "/api/library/vocabulary-sources" && method === "GET") {
        return mockResponse(200, { sources: [] });
      }
      if (url.pathname === "/api/learning/vocabulary-activations" && method === "POST") {
        const body = JSON.parse(options.body);
        return new Promise((resolve) => {
          activationRequests.push({
            body,
            succeed() {
              assert.equal(body.revision, serverRevision, "Each queued activation must use the latest acknowledged revision");
              serverRevision += 1;
              resolve(mockResponse(200, { revision: serverRevision }));
            },
            fail(status = 503) {
              resolve(mockResponse(status, { error: { code: "TEMPORARY_FAILURE", message: "Temporary failure" } }));
            }
          });
        });
      }
      if (url.pathname === "/api/state" && method === "PUT") {
        fullStateWrites.push(JSON.parse(options.body));
        return mockResponse(500, { error: { code: "UNEXPECTED_FULL_STATE_WRITE", message: "Unexpected full-state write" } });
      }
      return mockResponse(404, { error: { code: "NOT_FOUND", message: "Not found" } });
    };
  }
});

const { window } = dom;
window.eval(app);
window.eval(sessionPersistence);
window.eval(wordCollections);
await window.VazheyarReady;

async function waitUntil(predicate, message, timeoutMs = 2000) {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error(message);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

const { document } = window;
const ids = serverState.words.slice(0, 10).map((word) => word.id);

for (const id of ids) {
  const button = document.querySelector(`.add-to-box-one[data-id="${id}"]`);
  assert.ok(button, `Expected add button for ${id}`);
  button.click();
}

assert.deepEqual(
  clone(window.VocoraWordCollectionsTest.getWordSaveProgress()),
  { pending: 10, failed: 0 },
  "Ten real app clicks must immediately show ten pending saves before the queue is acknowledged"
);
const indicator = document.querySelector("#wordSaveProgress");
assert.ok(indicator?.classList.contains("show"));
assert.match(indicator.textContent, /۱۰/);
assert.match(indicator.textContent, /در حال ثبت/);
await Promise.resolve();
assert.equal(document.querySelector("#toast").classList.contains("show"), false, "The old immediate success toast must stay suppressed before browser paint");

await waitUntil(() => activationRequests.length === 1, "The first real saveQueue activation request did not start");
assert.equal(fullStateWrites.length, 0, "Word-bank clicks should use compact activation persistence");

for (let index = 0; index < 10; index += 1) {
  assert.equal(activationRequests[index].body.vocabularyId, ids[index], "Queued compact activations must preserve click order");
  activationRequests[index].succeed();
  const expectedPending = 9 - index;
  await waitUntil(
    () => window.VocoraWordCollectionsTest.getWordSaveProgress().pending === expectedPending,
    `Pending count did not decrement to ${expectedPending}`
  );
  if (expectedPending > 0) {
    await waitUntil(() => activationRequests.length === index + 2, "The next queued activation request did not start");
    assert.match(indicator.textContent, new RegExp(new Intl.NumberFormat("fa-IR").format(expectedPending)));
  }
}

await window.VazheyarTest.waitForSaves();
assert.deepEqual(clone(window.VocoraWordCollectionsTest.getWordSaveProgress()), { pending: 0, failed: 0 });
assert.equal(indicator.classList.contains("show"), false, "The real progress indicator must close at zero");
assert.equal(fullStateWrites.length, 0, "Successful rapid word-bank clicks must never fall back to full-state persistence");

const failedId = serverState.words[10].id;
const failedButton = document.querySelector(`.add-to-box-one[data-id="${failedId}"]`);
assert.ok(failedButton);
failedButton.click();
await waitUntil(() => activationRequests.length === 11, "Failed activation request did not start");
activationRequests[10].fail();
await waitUntil(
  () => window.VocoraWordCollectionsTest.getWordSaveProgress().failed === 1,
  "A failed real app activation must remain visibly pending"
);
assert.deepEqual(clone(window.VocoraWordCollectionsTest.getWordSaveProgress()), { pending: 1, failed: 1 });
assert.ok(indicator.classList.contains("show"));
assert.ok(indicator.classList.contains("error"));
assert.match(indicator.textContent, /ثبت نشده/);

console.log("Real-app word-bank save progress integration passed.");
