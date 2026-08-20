import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const root = new URL("../", import.meta.url);
const html = fs.readFileSync(new URL("index.html", root), "utf8")
  .replace(/<script src="[^"]+"><\/script>/gu, "");
const vocabulary = fs.readFileSync(new URL("vocabulary.js", root), "utf8");
const shareStory = fs.readFileSync(new URL("share-story-v2.js", root), "utf8");
const practiceRemediation = fs.readFileSync(new URL("practice-remediation.js", root), "utf8");
const remediationKeyboardGuard = fs.readFileSync(new URL("practice-remediation-keyboard-guard.js", root), "utf8");
const app = fs.readFileSync(new URL("app-v2.js", root), "utf8");
const sessionPersistence = fs.readFileSync(new URL("session-persistence.js", root), "utf8");
const wordCollections = fs.readFileSync(new URL("word-collections.js", root), "utf8");
const leitnerStatus = fs.readFileSync(new URL("leitner-status.js", root), "utf8");
const remediationAdapter = fs.readFileSync(new URL("practice-remediation-adapter.js", root), "utf8");
const remediationRecheckPrompt = fs.readFileSync(new URL("practice-remediation-recheck-prompt.js", root), "utf8");

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
// This is the exact browser state that was missing from earlier regressions:
// the card is due in house 5 but lastPromotedDay is already today. app-v2 alone
// records the correct answer without graduating it; the production persistence
// adapter and server authority must normalize the terminal review.
const previousPromotionDay = today;
let serverRevision = 7;
let fullStatePutCount = 0;
const requests = [];
let serverState = {
  schemaVersion: 2,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  settings: { dailyNew: 1, dailyGoal: 5, voiceRate: 0.85, theme: "system" },
  words: [{
    id: "production-box-five",
    number: 1,
    term: "graduation",
    accepted: ["graduation"],
    category: "Regression",
    notes: "",
    createdAt: new Date().toISOString(),
    box: 5,
    due: today,
    attempts: 4,
    correct: 4,
    mistakes: 0,
    currentStreak: 4,
    introducedOn: addDays(today, -60),
    addedSource: "daily",
    lastReviewed: `${previousPromotionDay}T08:00:00.000Z`,
    lastPromotedDay: previousPromotionDay,
    blockedUntil: null,
    masteredAt: null
  }],
  daily: {
    [today]: {
      attempts: 0,
      correct: 0,
      wrong: 0,
      newAdded: 1,
      sessions: 0,
      durationSeconds: 0
    }
  },
  history: [{
    at: `${previousPromotionDay}T08:00:00.000Z`,
    day: previousPromotionDay,
    wordId: "production-box-five",
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
  const raw = payload === null ? "" : JSON.stringify(payload);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    headers: new window.Headers(),
    async text() { return raw; },
    async json() { return payload === null ? null : structuredClone(payload); },
    clone() { return responseFor(window, payload, status); }
  };
}

function installServerFetch(window) {
  window.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url, window.location.href);
    const path = url.pathname;
    const method = String(options.method || (typeof input === "string" ? "GET" : input.method) || "GET").toUpperCase();
    requests.push({ path, method, options, search: url.search });

    if (path === "/api/auth/me" && method === "GET") {
      return responseFor(window, { user: { id: 77, email: "box5-production@example.com" } });
    }
    if (path === "/api/state" && method === "GET") {
      return responseFor(window, {
        revision: serverRevision,
        state: structuredClone(serverState)
      });
    }
    if (path === "/api/library/vocabulary-sources" && method === "GET") {
      return responseFor(window, { sources: [] });
    }
    if (path === "/api/learning/sessions" && method === "POST") {
      return responseFor(window, { session: { id: "session-box5", status: "active" } }, 201);
    }
    if (path === "/api/learning/reviews" && method === "POST") {
      const command = JSON.parse(options.body);
      assert.equal(command.revision, serverRevision, "the compact final review must use the current server revision");
      const word = serverState.words.find((item) => item.id === command.word.id);
      assert.ok(word, "the compact final review must target the persisted box-five word");
      Object.assign(word, structuredClone(command.word));
      serverState.history.push(structuredClone(command.event));
      serverState.daily[command.event.day] = structuredClone(command.daily);
      serverRevision += 1;
      return responseFor(window, { revision: serverRevision });
    }
    if (path === "/api/state" && method === "PUT") {
      fullStatePutCount += 1;
      return responseFor(window, {
        error: { code: "UNEXPECTED_FULL_STATE_WRITE", message: "A live final review must use the compact endpoint." }
      }, 500);
    }
    if (path.endsWith("/complete") || path.endsWith("/abandon")) {
      return responseFor(window, { session: { id: "session-box5", status: "completed" } });
    }
    return responseFor(window, { error: { code: "NOT_FOUND", message: "Not found" } }, 404);
  };
}

async function bootClient() {
  const dom = new JSDOM(html, {
    url: "https://vocora.test/",
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
      installServerFetch(window);
    }
  });

  dom.window.eval(vocabulary);
  dom.window.eval(shareStory);
  dom.window.eval(practiceRemediation);
  dom.window.eval(remediationKeyboardGuard);
  dom.window.eval(app);
  dom.window.eval(sessionPersistence);
  dom.window.eval(wordCollections);
  dom.window.eval(leitnerStatus);
  dom.window.eval(remediationAdapter);
  dom.window.eval(remediationRecheckPrompt);
  await dom.window.VazheyarReady;
  await dom.window.VazheyarTest.waitForSaves();
  return dom;
}

const firstClient = await bootClient();
const {
  document,
  VazheyarTest,
  VocoraSessionPersistenceTest,
  VocoraWordCollectionsTest,
  VocoraLeitnerStatus
} = firstClient.window;

assert.ok(VocoraWordCollectionsTest);
assert.ok(VocoraLeitnerStatus);
assert.ok(
  requests.some(({ path, method, search }) => path === "/api/state" && method === "GET" && search === "?view=bootstrap")
);

document.querySelector('[data-view="review"]').click();
document.querySelector("#beginSessionBtn").click();
await new Promise((resolve) => setTimeout(resolve, 20));
assert.equal(VocoraSessionPersistenceTest.getActiveSession()?.id, "session-box5");
assert.equal(VazheyarTest.getCurrentWord()?.box, 5);

document.querySelector("#answerInput").value = "graduation";
document.querySelector('#answerForm button[type="submit"]').click();
await VazheyarTest.waitForSaves();
assert.equal(await VocoraSessionPersistenceTest.waitForStateWrites(), true);

const compactRequests = requests.filter(({ path, method }) => path === "/api/learning/reviews" && method === "POST");
assert.equal(compactRequests.length, 1, "the complete production script chain must persist one final review exactly once");
assert.equal(fullStatePutCount, 0, "the live box-five review must not fall back to a full-state PUT");

const compactBody = JSON.parse(compactRequests[0].options.body);
assert.equal(compactBody.word.box, 5);
assert.equal(compactBody.word.due, null, "the same-day terminal review must clear the due date");
assert.ok(compactBody.word.masteredAt);
assert.equal(compactBody.word.masteredAt, compactBody.word.lastReviewed);
assert.equal(compactBody.word.masteredAt, compactBody.event.at);
assert.equal(compactBody.word.lastPromotedDay, today);
assert.deepEqual(
  {
    correct: compactBody.event.correct,
    promoted: compactBody.event.promoted,
    previousBox: compactBody.event.previousBox,
    newBox: compactBody.event.newBox
  },
  { correct: true, promoted: true, previousBox: 5, newBox: 5 }
);

const liveWord = VazheyarTest.getState().words[0];
assert.equal(liveWord.due, null, "the acknowledged compact write must repair the in-memory card before the next UI render");
assert.equal(liveWord.masteredAt, compactBody.event.at);

const persistedWord = serverState.words[0];
assert.equal(persistedWord.due, null);
assert.equal(persistedWord.masteredAt, compactBody.event.at);
assert.equal(serverState.history.at(-1).at, persistedWord.masteredAt);

firstClient.window.close();
const requestCountBeforeReload = requests.length;
const reloadedClient = await bootClient();
const reloadedWord = reloadedClient.window.VazheyarTest.getState().words[0];
assert.equal(reloadedWord.box, 5);
assert.equal(reloadedWord.due, null, "a browser reload must not resurrect the box-five due date");
assert.equal(reloadedWord.masteredAt, persistedWord.masteredAt);
assert.equal(reloadedClient.window.VazheyarTest.buildAnalysisReport().profile.masteredWords, 1);

reloadedClient.window.document.querySelector('[data-view="review"]').click();
assert.equal(
  reloadedClient.window.document.querySelector("#reviewEmpty").classList.contains("hidden"),
  false,
  "the mastered word must not return to the scheduled queue after a real reload"
);
assert.equal(
  requests.slice(requestCountBeforeReload).some(({ path, method }) => path === "/api/state" && method === "PUT"),
  false
);

reloadedClient.window.close();
console.log("Same-day production box-five persistence regression test passed.");
