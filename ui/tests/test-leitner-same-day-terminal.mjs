import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const root = new URL("../", import.meta.url);
const html = fs.readFileSync(new URL("index.html", root), "utf8")
  .replace(/<script src="[^"]+"><\/script>/gu, "");
const vocabulary = fs.readFileSync(new URL("vocabulary.js", root), "utf8");
const shareStory = fs.readFileSync(new URL("share-story-v2.js", root), "utf8");
const app = fs.readFileSync(new URL("app-v2.js", root), "utf8");

function localDay(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(day, amount) {
  const [year, month, date] = day.split("-").map(Number);
  return localDay(new Date(year, month - 1, date + amount, 12));
}

const today = localDay();
let revision = 7;
const state = {
  schemaVersion: 2,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  settings: { dailyNew: 1, dailyGoal: 5, voiceRate: 0.85, theme: "system" },
  words: [{
    id: "same-day-terminal",
    number: 1,
    term: "graduation",
    accepted: ["graduation"],
    category: "Regression",
    notes: "",
    createdAt: new Date().toISOString(),
    box: 5,
    due: today,
    attempts: 5,
    correct: 5,
    mistakes: 0,
    currentStreak: 5,
    introducedOn: addDays(today, -60),
    addedSource: "daily",
    lastReviewed: `${today}T08:00:00.000Z`,
    // This is the production edge case: an earlier same-day action left the
    // promotion marker on today while the final house-five review is still due.
    lastPromotedDay: today,
    blockedUntil: null,
    masteredAt: null
  }],
  daily: {
    [today]: { attempts: 0, correct: 0, wrong: 0, newAdded: 1, sessions: 0, durationSeconds: 0 }
  },
  history: [{
    at: `${today}T08:00:00.000Z`,
    day: today,
    wordId: "same-day-terminal",
    term: "graduation",
    answer: "graduation",
    correct: true,
    mode: "scheduled",
    promoted: true,
    previousBox: 4,
    newBox: 5,
    mistakeNumber: null
  }]
};

function responseFor(window, payload, status = 200) {
  const raw = JSON.stringify(payload);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    headers: new window.Headers(),
    async text() { return raw; },
    async json() { return structuredClone(payload); },
    clone() { return responseFor(window, payload, status); }
  };
}

const dom = new JSDOM(html, {
  url: "https://vocora.test/#review",
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
      const method = String(options.method || "GET").toUpperCase();
      if (url.pathname === "/api/auth/me") {
        return responseFor(window, { user: { id: 77, email: "same-day@example.com" } });
      }
      if (url.pathname === "/api/state" && method === "GET") {
        return responseFor(window, { revision, state: structuredClone(state) });
      }
      if (url.pathname === "/api/state" && method === "PUT") {
        revision += 1;
        return responseFor(window, { revision });
      }
      return responseFor(window, { error: { code: "NOT_FOUND", message: "Not found" } }, 404);
    };
  }
});

dom.window.eval(vocabulary);
dom.window.eval(shareStory);
dom.window.eval(app);
await dom.window.VazheyarReady;

const { document, VazheyarTest } = dom.window;
document.querySelector("#beginSessionBtn").click();
assert.equal(VazheyarTest.getCurrentWord()?.box, 5);
assert.equal(VazheyarTest.getCurrentWord()?.due, today);
assert.equal(VazheyarTest.getCurrentWord()?.lastPromotedDay, today);

document.querySelector("#answerInput").value = "graduation";
document.querySelector('#answerForm button[type="submit"]').click();

// These assertions intentionally run immediately, before saveState can be
// repaired by any persistence adapter or server. app-v2 itself owns the
// scheduling transition and must produce the correct terminal state.
const word = VazheyarTest.getState().words[0];
const event = VazheyarTest.getState().history.at(-1);
assert.equal(word.box, 5);
assert.equal(word.due, null, "a due final house-five review must graduate even when lastPromotedDay is already today");
assert.ok(word.masteredAt, "app-v2 must mark the word mastered synchronously");
assert.equal(word.masteredAt, word.lastReviewed);
assert.equal(event.promoted, true, "the app must record the terminal 5 -> 5 review as promoted");
assert.equal(event.previousBox, 5);
assert.equal(event.newBox, 5);
assert.match(document.querySelector("#feedbackDetail").textContent, /چرخهٔ مرور لایتنر خارج شد/u);

dom.window.close();
console.log("Same-day terminal app regression test passed.");
