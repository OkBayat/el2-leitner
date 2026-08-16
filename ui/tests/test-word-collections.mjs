import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const script = fs.readFileSync(new URL("../word-collections.js", import.meta.url), "utf8");
const dom = new JSDOM(`<!doctype html><body>
<section id="view-words"><table><thead><tr><th>کلمه</th><th>دسته</th><th>خانه</th></tr></thead>
<tbody id="wordsTableBody">
<tr><td>centre / center</td><td>Unit 1</td><td>وارد نشده</td><td><button class="add-to-box-one" data-id="vocab-1">+</button></td></tr>
<tr><td>ability</td><td>Unit 1</td><td>وارد نشده</td><td><button class="add-to-box-one" data-id="vocab-2">+</button></td></tr>
</tbody></table></section>
<input id="wordSearch"><select id="boxFilter"></select><select id="sortWords"></select><button id="prevPage"></button><button id="nextPage"></button>
</body>`, { runScripts: "outside-only", url: "http://localhost/index.html" });
const { window } = dom;
const requests = [];

function responseFor(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return structuredClone(payload); },
    clone() { return responseFor(payload, status); }
  };
}

window.fetch = async (input, options = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url, window.location.href);
  const method = String(options.method || "GET").toUpperCase();
  requests.push({ url, method, options });
  if (url.pathname === "/api/library/vocabulary-sources") {
    const ids = String(url.searchParams.get("ids") || "").split(",").filter(Boolean);
    return responseFor({
      sources: ids.map((id) => ({
        vocabularyId: id,
        term: id === "vocab-1" ? "centre" : "ability",
        collections: [{ id: "ielts", title: "1500 IELTS Listening Words" }]
      }))
    });
  }
  if (url.pathname === "/api/learning/vocabulary-activations" && method === "POST") {
    const command = JSON.parse(options.body);
    return responseFor({ revision: Number(command.revision) + 1 });
  }
  if (url.pathname === "/api/state" && method === "PUT") {
    const payload = JSON.parse(options.body);
    return responseFor({ revision: Number(payload.revision) + 1 });
  }
  return responseFor({}, 404);
};

window.eval(script);
await new Promise((resolve) => setTimeout(resolve, 20));

const sourceRequest = requests.find((request) => request.url.pathname === "/api/library/vocabulary-sources");
assert.ok(sourceRequest, "visible vocabulary source metadata should be requested");
assert.deepEqual(
  String(sourceRequest.url.searchParams.get("ids")).split(",").sort(),
  ["vocab-1", "vocab-2"],
  "source lookup must be scoped to the visible rows instead of the whole vocabulary bank"
);
assert.equal(requests.filter((request) => request.url.pathname === "/api/library/vocabulary-sources").length, 1);

const header = window.document.querySelector('th[data-vocora-source-column]');
assert.equal(header.textContent, "مجموعه‌ها");
assert.equal(window.document.querySelectorAll('td[data-vocora-source-column] a.word-source-chip').length, 2);
assert.equal(window.VocoraWordCollectionsTest.normalize(" Interest–Free  Credit "), "interest-free credit");

const addButton = window.document.querySelector('.add-to-box-one[data-id="vocab-1"]');
addButton.click();
assert.equal(window.VocoraWordCollectionsTest.getPendingActivationId(), "vocab-1",
  "the actual word-bank click must identify the mutation before app-v2 saves state");

const state = {
  history: [],
  words: [
    {
      id: "vocab-1",
      box: 1,
      due: "2026-08-16",
      introducedOn: "2026-08-16",
      addedSource: "word-bank"
    },
    { id: "vocab-2", box: 0, due: null, introducedOn: null, addedSource: null }
  ],
  daily: {
    "2026-08-16": { attempts: 0, correct: 0, wrong: 0, newAdded: 1, sessions: 0, durationSeconds: 0 }
  }
};
const saveResponse = await window.fetch("/api/state", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ revision: 8, state })
});
assert.equal(saveResponse.status, 200);
assert.equal(requests.some((request) => request.url.pathname === "/api/state" && request.method === "PUT"), false,
  "the clicked word-bank activation must never send the full learning state");
const activation = requests.find((request) => request.url.pathname === "/api/learning/vocabulary-activations");
assert.ok(activation);
assert.deepEqual(JSON.parse(activation.options.body), {
  revision: 8,
  vocabularyId: "vocab-1",
  day: "2026-08-16"
});
assert.equal(window.VocoraWordCollectionsTest.getPendingActivationId(), null);

window.document.querySelector("#wordsTableBody").innerHTML =
  '<tr><td>new word</td><td>Unit 2</td><td>وارد نشده</td><td><button class="add-to-box-one" data-id="vocab-3">+</button></td></tr>';
await new Promise((resolve) => setTimeout(resolve, 20));
const sourceRequests = requests.filter((request) => request.url.pathname === "/api/library/vocabulary-sources");
assert.equal(sourceRequests.length, 2, "changing the visible page may fetch sources again, but only for that page");
assert.equal(sourceRequests[1].url.searchParams.get("ids"), "vocab-3");

console.log("Word collection integration tests passed.");
