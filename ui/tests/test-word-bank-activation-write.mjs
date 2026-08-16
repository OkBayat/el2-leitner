import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const script = fs.readFileSync(new URL("../session-persistence.js", import.meta.url), "utf8");
const dom = new JSDOM("<!doctype html><body></body>", {
  runScripts: "outside-only",
  url: "http://localhost/index.html"
});
const { window } = dom;
window.Headers = globalThis.Headers;
window.MutationObserver = class { observe() {} };

const requests = [];
const baselineState = {
  history: [],
  words: [
    { id: "vocab-1", box: 0, due: null, introducedOn: null, addedSource: null },
    { id: "vocab-2", box: 0, due: null, introducedOn: null, addedSource: null }
  ],
  daily: {}
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
  const method = String(options.method || "GET").toUpperCase();
  requests.push({ path, method, options });
  if (path === "/api/state" && method === "GET") {
    return responseFor({ revision: 4, state: structuredClone(baselineState) });
  }
  if (path === "/api/learning/vocabulary-activations" && method === "POST") {
    const command = JSON.parse(options.body);
    return responseFor({ revision: Number(command.revision) + 1 });
  }
  if (path === "/api/state" && method === "PUT") {
    const payload = JSON.parse(options.body);
    return responseFor({ revision: Number(payload.revision) + 1 });
  }
  return responseFor({}, 404);
};

window.eval(script);
await window.fetch("/api/state");

const state = structuredClone(baselineState);
state.words[0] = {
  ...state.words[0],
  box: 1,
  due: "2026-08-16",
  introducedOn: "2026-08-16",
  addedSource: "word-bank"
};
state.daily["2026-08-16"] = {
  attempts: 0,
  correct: 0,
  wrong: 0,
  newAdded: 1,
  sessions: 0,
  durationSeconds: 0
};

const response = await window.fetch("/api/state", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ revision: 4, state })
});
assert.equal(response.status, 200);

const activation = requests.find((request) => request.path === "/api/learning/vocabulary-activations");
assert.ok(activation, "one word-bank activation must use the compact activation endpoint");
assert.equal(requests.some((request) => request.path === "/api/state" && request.method === "PUT"), false,
  "one word-bank activation must not send the full learning state");
assert.deepEqual(JSON.parse(activation.options.body), {
  revision: 4,
  vocabularyId: "vocab-1",
  day: "2026-08-16"
});
assert.equal(window.VocoraSessionPersistenceTest.getPersistedActivationSnapshot().get("vocab-1").introducedOn,
  "2026-08-16");

console.log("Compact word-bank activation persistence tests passed.");
