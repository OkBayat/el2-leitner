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

function response(status, payload = null) {
  const raw = payload === null ? "" : JSON.stringify(payload);
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return raw; },
    async json() { return clone(payload); },
    clone() { return response(status, payload); }
  };
}

function word(id, number, term) {
  return {
    id,
    number,
    term,
    accepted: [term],
    category: "Nouns",
    tags: ["Nouns"],
    lessons: ["Unit 2 — Mental and physical development"],
    notes: "",
    createdAt: "2026-08-25T18:00:00.000Z",
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

let revision = 12;
const state = {
  schemaVersion: 2,
  createdAt: "2026-08-25T18:00:00.000Z",
  updatedAt: "2026-08-25T18:00:00.000Z",
  settings: { dailyNew: 0, dailyGoal: 20, voiceRate: 0.85, theme: "light" },
  words: [
    word("vocab-ability", 1, "ability"),
    word("vocab-adolescent", 2, "adolescent"),
    { ...word("vocab-allergy", 3, "allergy"), tags: ["Nouns"], lessons: ["Unit 3 — Keeping fit"] }
  ],
  daily: {},
  history: []
};

const activationBodies = [];
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
        return response(200, { user: { id: 7, email: "lesson-search@example.com" } });
      }
      if (url.pathname === "/api/state" && method === "GET") {
        return response(200, { state: clone(state), revision });
      }
      if (url.pathname === "/api/library/vocabulary-sources" && method === "GET") {
        const ids = String(url.searchParams.get("ids") || "").split(",").filter(Boolean);
        return response(200, {
          sources: ids.map((id) => ({
            vocabularyId: id,
            term: state.words.find((item) => item.id === id)?.term || id,
            collections: [{ id: "cambridge-vocabulary-ielts", title: "Cambridge Vocabulary for IELTS" }]
          }))
        });
      }
      if (url.pathname === "/api/learning/vocabulary-activations" && method === "POST") {
        const body = JSON.parse(options.body);
        activationBodies.push(body);
        revision += 1;
        return response(200, { revision });
      }
      if (url.pathname === "/api/state" && method === "PUT") {
        fullStateWrites.push(JSON.parse(options.body));
        return response(500, { error: { code: "UNEXPECTED_FULL_STATE_WRITE", message: "Unexpected full state write" } });
      }
      return response(404, { error: { code: "NOT_FOUND", message: "Not found" } });
    };
  }
});

const { window } = dom;
window.eval(app);
window.eval(sessionPersistence);
window.eval(wordCollections);
await window.VazheyarReady;
await new Promise((resolve) => setTimeout(resolve, 20));

const { document } = window;
const search = document.querySelector("#wordSearch");
search.value = "Unit 2";
search.dispatchEvent(new window.Event("input", { bubbles: true }));
await new Promise((resolve) => setTimeout(resolve, 20));

assert.equal(search.value, "Unit 2", "the original search input must keep the learner query");
assert.equal(document.querySelectorAll("#wordsTableBody tr").length, 2,
  "the existing word-bank search must find both words from Unit 2");
assert.ok(document.querySelector('.add-to-box-one[data-id="vocab-ability"]'));
assert.ok(document.querySelector('.add-to-box-one[data-id="vocab-adolescent"]'));

const first = document.querySelector('.add-to-box-one[data-id="vocab-ability"]');
first.click();
await window.VazheyarTest.waitForSaves();
await new Promise((resolve) => setTimeout(resolve, 20));

assert.deepEqual(activationBodies, [{
  revision: 12,
  vocabularyId: "vocab-ability",
  day: window.VazheyarTest.localDay()
}], "the existing compact House-1 activation path must remain unchanged");
assert.equal(fullStateWrites.length, 0, "lesson search must not change activation persistence behavior");
assert.equal(search.value, "Unit 2", "adding a searched word must not clear the active search");
assert.equal(document.querySelectorAll("#wordsTableBody tr").length, 2,
  "after adding one result, the same Unit search results must remain visible");
assert.equal(document.querySelector('.add-to-box-one[data-id="vocab-ability"]'), null,
  "the activated result stays visible but loses its plus button");
assert.ok(document.querySelector('.add-to-box-one[data-id="vocab-adolescent"]'),
  "the next matching word must still be immediately addable without refresh or re-search");

console.log("Real-app lesson search activation regression passed.");
