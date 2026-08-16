import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const script = fs.readFileSync(new URL("../word-collections.js", import.meta.url), "utf8");
const dom = new JSDOM(`<!doctype html><body>
<section id="view-words"><table><thead><tr><th>word</th><th>category</th><th>box</th></tr></thead>
<tbody id="wordsTableBody"><tr><td>get to know</td><td>5B</td><td>new</td><td>
<button class="add-to-box-one" data-id="get-to-know">+</button></td></tr></tbody></table></section>
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

window.fetch = async (input, options = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url, window.location.href);
  const method = String(options.method || "GET").toUpperCase();
  requests.push({ url, method, options });
  if (url.pathname === "/api/library/vocabulary-sources") return response({ sources: [] });
  if (url.pathname === "/api/learning/vocabulary-activations" && method === "POST") {
    const body = JSON.parse(options.body);
    return response({ revision: body.revision + 1 });
  }
  if (url.pathname === "/api/state" && method === "PUT") {
    return response({ error: { code: "FULL_STATE_WRITE" } }, 500);
  }
  return response({}, 404);
};

const state = {
  settings: { dailyNew: 10, dailyGoal: 20, voiceRate: 0.85, theme: "light" },
  words: [
    {
      id: "roommate", number: 1, term: "roommate", accepted: ["roommate"], category: "5B", notes: "",
      createdAt: "2026-08-07T12:54:06.067Z", box: 0, due: null, attempts: 0, correct: 0,
      mistakes: 0, currentStreak: 0, introducedOn: null, addedSource: null, lastReviewed: null,
      lastPromotedDay: null, blockedUntil: null, masteredAt: null
    },
    {
      id: "get-to-know", number: 2, term: "get to know", accepted: ["get to know"], category: "5B", notes: "",
      createdAt: "2026-08-07T12:54:06.074Z", box: 0, due: null, attempts: 0, correct: 0,
      mistakes: 0, currentStreak: 0, introducedOn: null, addedSource: null, lastReviewed: null,
      lastPromotedDay: null, blockedUntil: null, masteredAt: null
    }
  ],
  history: Array.from({ length: 4713 }, (_, index) => ({ id: index + 1 })),
  daily: {
    "2026-08-16": { attempts: 393, correct: 273, wrong: 120, newAdded: 41, sessions: 3, durationSeconds: 1260 }
  }
};
window.VazheyarTest = { getState: () => state };
window.eval(script);
await new Promise((resolve) => setTimeout(resolve, 10));

// No state GET is performed in this fixture. The click itself must capture the authoritative
// pre-mutation baseline before the application's bubble handler changes the state.
window.document.querySelector(".add-to-box-one").click();
state.words[1].box = 1;
state.words[1].due = "2026-08-16";
state.words[1].introducedOn = "2026-08-16";
state.words[1].addedSource = "word-bank";
state.daily["2026-08-16"].newAdded = 42;
// Reproduce the unrelated createdAt drift observed in the production payload.
state.words[0].createdAt = "2026-08-16T14:40:36.072Z";

const fullBody = JSON.stringify({ revision: 4955, state });
assert.ok(fullBody.length > 100000, "fixture must make a full-state upload materially large");
const result = await window.fetch("/api/state", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: fullBody
});
assert.equal(result.status, 200);
assert.equal(
  requests.filter((request) => request.url.pathname === "/api/state" && request.method === "PUT").length,
  0,
  "a click-time baseline must prevent the multi-megabyte state PUT even when startup GET was missed"
);
const activation = requests.find((request) => request.url.pathname === "/api/learning/vocabulary-activations");
assert.ok(activation, "one compact activation command must be sent");
assert.equal(
  activation.options.body,
  JSON.stringify({ revision: 4955, vocabularyId: "get-to-know", day: "2026-08-16" })
);
assert.ok(activation.options.body.length < 150);

console.log("Click-time word-bank baseline regression passed.");
