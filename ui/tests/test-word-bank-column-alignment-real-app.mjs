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

function word({ id, number, term, category, tags, lessons, box = 0 }) {
  return {
    id,
    number,
    term,
    accepted: [term],
    category,
    tags,
    lessons,
    notes: "",
    createdAt: "2026-08-25T18:00:00.000Z",
    box,
    due: box ? "2026-09-05" : null,
    attempts: box ? 11 : 0,
    correct: 0,
    mistakes: box ? 2 : 0,
    currentStreak: 0,
    introducedOn: box ? "2026-08-01" : null,
    addedSource: box ? "daily" : null,
    lastReviewed: null,
    lastPromotedDay: null,
    blockedUntil: null,
    masteredAt: null
  };
}

const state = {
  schemaVersion: 2,
  createdAt: "2026-08-25T18:00:00.000Z",
  updatedAt: "2026-08-25T18:00:00.000Z",
  settings: { dailyNew: 0, dailyGoal: 20, voiceRate: 0.85, theme: "light" },
  words: [
    word({
      id: "dictionary",
      number: 1,
      term: "dictionary",
      category: "University and study",
      tags: [],
      lessons: ["University and study"],
      box: 5
    }),
    word({
      id: "ability",
      number: 2,
      term: "ability",
      category: "Nouns",
      tags: ["Nouns"],
      lessons: ["Unit 2 — Mental and physical development"]
    })
  ],
  daily: {},
  history: []
};

const sources = new Map([
  ["dictionary", [{ id: "ielts-listening-1500", title: "IELTS Listening Words 1500" }]],
  ["ability", [{ id: "cambridge-vocabulary-ielts", title: "Cambridge Vocabulary for IELTS" }]]
]);

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
        return response(200, { user: { id: 7, email: "columns@example.com" } });
      }
      if (url.pathname === "/api/state" && method === "GET") {
        return response(200, { state: clone(state), revision: 9 });
      }
      if (url.pathname === "/api/library/vocabulary-sources" && method === "GET") {
        const ids = String(url.searchParams.get("ids") || "").split(",").filter(Boolean);
        return response(200, {
          sources: ids.map((id) => ({
            vocabularyId: id,
            term: state.words.find((item) => item.id === id)?.term || id,
            collections: sources.get(id) || []
          }))
        });
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
await new Promise((resolve) => setTimeout(resolve, 40));

const { document } = window;
const headerLabels = [...document.querySelectorAll("#view-words thead th")]
  .map((cell) => cell.textContent.trim());
assert.deepEqual(
  headerLabels.slice(0, 4),
  ["کلمه", "تگ‌ها", "مجموعه‌ها", "درس"],
  "word-bank taxonomy columns must keep the intended order"
);

const dictionaryRow = [...document.querySelectorAll("#wordsTableBody tr")]
  .find((row) => row.cells[0]?.textContent.includes("dictionary"));
assert.ok(dictionaryRow, "dictionary row should be rendered");
assert.equal(
  dictionaryRow.cells.length,
  headerLabels.length,
  "every rendered word row must have exactly one cell per header after collection decoration"
);
assert.equal(dictionaryRow.cells[0].textContent.trim(), "dictionary");
assert.equal(
  dictionaryRow.cells[1].textContent.trim(),
  "—",
  "a root lesson/section must not be duplicated into the tag column"
);
assert.match(dictionaryRow.cells[2].textContent, /IELTS Listening Words 1500/u);
assert.equal(
  dictionaryRow.cells[3].textContent.trim(),
  "University and study",
  "the root collection section must be shown in the lesson column"
);
assert.match(
  dictionaryRow.cells[4].textContent,
  /خانه/u,
  "House must stay under the House header instead of shifting into Lesson"
);

const abilityRow = [...document.querySelectorAll("#wordsTableBody tr")]
  .find((row) => row.cells[0]?.textContent.includes("ability"));
assert.ok(abilityRow, "nested Unit word should be rendered");
assert.equal(abilityRow.cells[1].textContent.trim(), "Nouns");
assert.match(abilityRow.cells[2].textContent, /Cambridge Vocabulary for IELTS/u);
assert.equal(abilityRow.cells[3].textContent.trim(), "Unit 2 — Mental and physical development");

const parsedMarkup = new JSDOM(rawHtml).window.document;
const appSrc = parsedMarkup.querySelector('script[src^="app-v2.js"]')?.getAttribute("src") || "";
assert.match(
  appSrc,
  /^app-v2\.js\?v=word-bank-columns-/u,
  "index must cache-bust app-v2 when the word-row schema changes, otherwise a new header can run with an old row renderer"
);

console.log("Real-app word-bank column alignment regression passed.");
