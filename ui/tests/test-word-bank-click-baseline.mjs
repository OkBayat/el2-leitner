import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const script = fs.readFileSync(new URL("../word-collections.js", import.meta.url), "utf8");
const dom = new JSDOM(`<!doctype html><body>
<section id="view-words"><table><thead><tr><th>word</th><th>category</th><th>box</th></tr></thead>
<tbody id="wordsTableBody">
<tr><td>become friends</td><td>5B</td><td>new</td><td><button class="add-to-box-one" data-id="become-friends">+</button></td></tr>
<tr><td>have something in common</td><td>5B</td><td>new</td><td><button class="add-to-box-one" data-id="have-common">+</button></td></tr>
<tr><td>fall in love</td><td>5B</td><td>new</td><td><button class="add-to-box-one" data-id="fall-in-love">+</button></td></tr>
</tbody></table></section>
<input id="wordSearch"><select id="boxFilter"></select><select id="sortWords"></select>
<button id="prevPage"></button><button id="nextPage"></button>
</body>`, { runScripts: "outside-only", url: "https://vocora.test/#words" });
const { window } = dom;
const requests = [];

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return structuredClone(payload); },
    clone() { return response(payload, status); }
  };
}

const state = {
  settings: { dailyNew: 10, dailyGoal: 20, voiceRate: 0.85, theme: "light" },
  words: [
    {
      id: "become-friends", number: 1, term: "become friends", accepted: ["become friends"], category: "5B", notes: "",
      createdAt: "2026-08-07T12:54:06.081Z", box: 0, due: null, attempts: 0, correct: 0,
      mistakes: 0, currentStreak: 0, introducedOn: null, addedSource: null, lastReviewed: null,
      lastPromotedDay: null, blockedUntil: null, masteredAt: null
    },
    {
      id: "have-common", number: 2, term: "have something in common", accepted: ["have something in common"], category: "5B", notes: "",
      createdAt: "2026-08-07T12:54:06.088Z", box: 0, due: null, attempts: 0, correct: 0,
      mistakes: 0, currentStreak: 0, introducedOn: null, addedSource: null, lastReviewed: null,
      lastPromotedDay: null, blockedUntil: null, masteredAt: null
    },
    {
      id: "fall-in-love", number: 3, term: "fall in love", accepted: ["fall in love"], category: "5B", notes: "",
      createdAt: "2026-08-07T12:54:06.096Z", box: 0, due: null, attempts: 0, correct: 0,
      mistakes: 0, currentStreak: 0, introducedOn: null, addedSource: null, lastReviewed: null,
      lastPromotedDay: null, blockedUntil: null, masteredAt: null
    },
    ...Array.from({ length: 1949 }, (_, index) => ({
      id: `filler-${index + 4}`,
      number: index + 4,
      term: `filler word ${index + 4}`,
      accepted: [`filler word ${index + 4}`],
      category: "Regression fixture",
      notes: "",
      createdAt: "2026-08-07T12:54:06.100Z",
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
    }))
  ],
  history: [{ id: 4713 }],
  daily: {
    "2026-08-16": { attempts: 393, correct: 273, wrong: 120, newAdded: 42, sessions: 3, durationSeconds: 1260 }
  }
};

window.fetch = async (input, options = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url, window.location.href);
  const method = String(options.method || "GET").toUpperCase();
  requests.push({ url, method, options });
  if (url.pathname === "/api/library/vocabulary-sources") return response({ sources: [] });
  if (url.pathname === "/api/state" && method === "GET") {
    return response({ state: structuredClone(state), revision: 4955 });
  }
  if (url.pathname === "/api/learning/vocabulary-activations" && method === "POST") {
    const body = JSON.parse(options.body);
    return response({ revision: body.revision + 1 });
  }
  if (url.pathname === "/api/state" && method === "PUT") {
    return response({ error: { code: "FULL_STATE_WRITE" } }, 500);
  }
  return response({}, 404);
};

window.eval(script);
await new Promise((resolve) => setTimeout(resolve, 10));

// Establish the server-confirmed baseline exactly once. Rapid clicks must not replace it
// with newer local state while older save snapshots are still waiting in saveQueue.
await window.fetch("/api/state");

const snapshots = [];
const ids = ["become-friends", "have-common", "fall-in-love"];
for (let index = 0; index < ids.length; index += 1) {
  window.document.querySelector(`.add-to-box-one[data-id="${ids[index]}"]`).click();
  const word = state.words.find((item) => item.id === ids[index]);
  word.box = 1;
  word.due = "2026-08-16";
  word.introducedOn = "2026-08-16";
  word.addedSource = "word-bank";
  state.daily["2026-08-16"].newAdded += 1;
  snapshots.push(structuredClone(state));
}

for (let index = 0; index < snapshots.length; index += 1) {
  const fullBody = JSON.stringify({ revision: 4955 + index, state: snapshots[index] });
  assert.ok(fullBody.length > 500000, "each queued snapshot must reproduce the large production payload");
  const result = await window.fetch("/api/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: fullBody
  });
  assert.equal(result.status, 200);
}

assert.equal(
  requests.filter((request) => request.url.pathname === "/api/state" && request.method === "PUT").length,
  0,
  "rapid queued word-bank saves must never leak a full-state PUT"
);
const activations = requests.filter((request) => request.url.pathname === "/api/learning/vocabulary-activations");
assert.equal(activations.length, 3, "each queued click must become exactly one compact activation");
assert.deepEqual(
  activations.map((request) => JSON.parse(request.options.body)),
  [
    { revision: 4955, vocabularyId: "become-friends", day: "2026-08-16" },
    { revision: 4956, vocabularyId: "have-common", day: "2026-08-16" },
    { revision: 4957, vocabularyId: "fall-in-love", day: "2026-08-16" }
  ]
);
assert.ok(activations.every((request) => request.options.body.length < 150));

console.log("Rapid queued word-bank activation regression passed.");
