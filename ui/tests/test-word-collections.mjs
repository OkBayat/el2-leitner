import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const script = fs.readFileSync(new URL("../word-collections.js", import.meta.url), "utf8");
const dom = new JSDOM(`<!doctype html><body>
<section id="view-words"><table><thead><tr><th>کلمه</th><th>دسته</th><th>خانه</th></tr></thead>
<tbody id="wordsTableBody"><tr><td>centre / center</td><td>Unit 1</td><td>خانه ۱</td><td><button data-id="vocab-1">ویرایش</button></td></tr></tbody></table></section>
<input id="wordSearch"><select id="boxFilter"></select><select id="sortWords"></select><button id="prevPage"></button><button id="nextPage"></button>
</body>`, { runScripts: "outside-only", url: "http://localhost/index.html" });
const { window } = dom;
window.fetch = async () => ({
  ok: true,
  status: 200,
  async json() {
    return {
      sources: [{
        vocabularyId: "vocab-1",
        term: "centre",
        collections: [
          { id: "ielts", title: "1500 IELTS Listening Words" },
          { id: "aef3", title: "American English File 3" }
        ]
      }]
    };
  }
});
window.eval(script);
await new Promise((resolve) => setTimeout(resolve, 15));

const header = window.document.querySelector('th[data-vocora-source-column]');
assert.equal(header.textContent, "مجموعه‌ها");
const sourceCell = window.document.querySelector('td[data-vocora-source-column]');
assert.match(sourceCell.textContent, /1500 IELTS Listening Words/u);
assert.match(sourceCell.textContent, /American English File 3/u);
assert.equal(sourceCell.querySelectorAll("a.word-source-chip").length, 2);
assert.equal(window.VocoraWordCollectionsTest.normalize(" Interest–Free  Credit "), "interest-free credit");

console.log("Word collection integration tests passed.");
