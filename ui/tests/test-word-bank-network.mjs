import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const root = new URL("../", import.meta.url);
const html = fs.readFileSync(new URL("index.html", root), "utf8");
const appScript = fs.readFileSync(new URL("app-v2.js", root), "utf8");
const sessionScript = fs.readFileSync(new URL("session-persistence.js", root), "utf8");
const collectionsScript = fs.readFileSync(new URL("word-collections.js", root), "utf8");

function localDay(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const today = localDay();
const words = Array.from({ length: 1952 }, (_, index) => ({
  id: `vocab-${String(index + 1).padStart(4, "0")}`,
  number: index + 1,
  term: `word-${index + 1}`,
  accepted: [`word-${index + 1}`],
  category: "Network regression",
  notes: "",
  createdAt: "2026-08-01T00:00:00.000Z",
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
}));
const history = Array.from({ length: 4712 }, (_, index) => ({
  at: `2026-08-01T00:${String(index % 60).padStart(2, "0")}:00.000Z`,
  day: "2026-08-01",
  wordId: "historical-word",
  term: "historical-word",
  answer: "historical-word",
  correct: true,
  mode: "scheduled",
  promoted: false,
  previousBox: 1,
  newBox: 1,
  mistakeNumber: null
}));

let serverRevision = 4949;
let serverState = {
  schemaVersion: 2,
  createdAt: "2026-07-12T14:24:26.386Z",
  updatedAt: "2026-08-16T13:51:23.532Z",
  settings: { dailyNew: 10, dailyGoal: 20, voiceRate: 0.85, theme: "light" },
  words,
  daily: {
    [today]: { attempts: 0, correct: 0, wrong: 0, newAdded: 36, sessions: 0, durationSeconds: 0 }
  },
  history
};

const requests = [];
function responseFor(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return payload === null ? "" : JSON.stringify(payload); },
    async json() { return structuredClone(payload); },
    clone() { return responseFor(payload, status); }
  };
}

const dom = new JSDOM(html, {
  url: "https://vocora.test/#words",
  runScripts: "outside-only",
  pretendToBeVisual: true,
  beforeParse(window) {
    window.Headers = globalThis.Headers;
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    window.scrollTo = () => {};
    window.confirm = () => true;
    window.SpeechSynthesisUtterance = class { constructor(value) { this.text = value; } };
    window.speechSynthesis = { cancel() {}, speak() {}, getVoices() { return []; } };
    window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
    window.HTMLDialogElement.prototype.close = function close() { this.open = false; };
    window.fetch = async (input, options = {}) => {
      const url = new URL(typeof input === "string" ? input : input.url, window.location.href);
      const method = String(options.method || "GET").toUpperCase();
      requests.push({ url, method, options });

      if (url.pathname === "/api/auth/me" && method === "GET") {
        return responseFor({ user: { id: 7, email: "learner@example.com" } });
      }
      if (url.pathname === "/api/state" && method === "GET") {
        return responseFor({ state: structuredClone(serverState), revision: serverRevision });
      }
      if (url.pathname === "/api/state" && method === "PUT") {
        return responseFor({ error: { code: "FULL_STATE_WRITE", message: "Full state write must not happen." } }, 500);
      }
      if (url.pathname === "/api/library/vocabulary-sources" && method === "GET") {
        return responseFor({ sources: [] });
      }
      if (url.pathname === "/api/learning/vocabulary-activations" && method === "POST") {
        const command = JSON.parse(options.body);
        assert.equal(command.revision, serverRevision);
        const word = serverState.words.find((item) => item.id === command.vocabularyId);
        assert.ok(word, "selected vocabulary must exist in the server fixture");
        word.box = 1;
        word.due = command.day;
        word.introducedOn = command.day;
        word.addedSource = "word-bank";
        serverState.daily[command.day].newAdded += 1;
        serverRevision += 1;
        return responseFor({ revision: serverRevision });
      }
      return responseFor({ error: { code: "NOT_FOUND", message: "Not found." } }, 404);
    };
  }
});

// Match production script order: app -> review persistence -> word-bank integration.
dom.window.eval(appScript);
dom.window.eval(sessionScript);
dom.window.eval(collectionsScript);
await dom.window.VazheyarReady;
await dom.window.VazheyarTest.waitForSaves();
await new Promise((resolve) => setTimeout(resolve, 20));

const stateGetsBefore = requests.filter((request) => request.url.pathname === "/api/state" && request.method === "GET").length;
const statePutsBefore = requests.filter((request) => request.url.pathname === "/api/state" && request.method === "PUT").length;
assert.equal(stateGetsBefore, 1, "the large state may be loaded once at application bootstrap");
assert.equal(statePutsBefore, 0, "bootstrap fixture must not need a full state write");

const addButton = dom.window.document.querySelector(".add-to-box-one[data-id]");
assert.ok(addButton, "word bank must expose an add-to-box-one action");
const selectedId = addButton.dataset.id;
addButton.click();
await dom.window.VazheyarTest.waitForSaves();
await new Promise((resolve) => setTimeout(resolve, 20));

const stateGetsAfter = requests.filter((request) => request.url.pathname === "/api/state" && request.method === "GET").length;
const statePutsAfter = requests.filter((request) => request.url.pathname === "/api/state" && request.method === "PUT").length;
const activations = requests.filter((request) => request.url.pathname === "/api/learning/vocabulary-activations" && request.method === "POST");

assert.equal(stateGetsAfter, stateGetsBefore,
  "adding one word must not reload the multi-megabyte learning state");
assert.equal(statePutsAfter, statePutsBefore,
  "adding one word must not send the multi-megabyte learning state");
assert.equal(activations.length, 1, "one click must produce exactly one compact activation command");
const activationBody = String(activations[0].options.body || "");
const activationPayload = JSON.parse(activationBody);
assert.deepEqual(activationPayload, {
  revision: 4949,
  vocabularyId: selectedId,
  day: today
});
assert.equal(Object.prototype.hasOwnProperty.call(activationPayload, "state"), false);
assert.ok(Buffer.byteLength(activationBody, "utf8") < 150,
  "single-word activation request must stay tiny even when the loaded state has 1,952 words and 4,712 history events");
assert.equal(serverState.words.find((word) => word.id === selectedId).box, 1);

console.log("Production-sized word-bank network regression passed.");
