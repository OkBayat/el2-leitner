import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const root = new URL("../", import.meta.url);
const libraryMarkup = fs.readFileSync(new URL("library.html", root), "utf8");
const libraryScript = fs.readFileSync(new URL("library.js", root), "utf8");

function installDialogSupport(window) {
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute("open", ""); };
  window.HTMLDialogElement.prototype.close = function close() { this.removeAttribute("open"); };
}

function jsonResponse(payload) {
  return {
    ok: true,
    status: 200,
    async text() { return JSON.stringify(payload); }
  };
}

const dom = new JSDOM(libraryMarkup, {
  runScripts: "outside-only",
  url: "http://localhost/library.html"
});
const { window } = dom;
installDialogSupport(window);

let copiedText = null;
Object.defineProperty(window.navigator, "clipboard", {
  configurable: true,
  value: {
    async writeText(value) { copiedText = value; }
  }
});

window.fetch = async (input) => {
  const path = new URL(typeof input === "string" ? input : input.url, window.location.href).pathname;
  if (path === "/api/auth/me") return jsonResponse({ user: { id: "1", email: "admin@example.com" } });
  if (path === "/api/library") return jsonResponse({ capabilities: { canManage: true }, collections: [] });
  throw new Error(`Unexpected request: ${path}`);
};

window.eval(libraryScript);
await new Promise((resolve) => setTimeout(resolve, 20));

const copyButton = window.document.querySelector("#copyImportTemplateBtn");
assert.ok(copyButton, "library must expose a ChatGPT import-template copy button");
assert.equal(copyButton.classList.contains("hidden"), false, "template copy button must be available to library managers");

copyButton.click();
await new Promise((resolve) => setTimeout(resolve, 0));

assert.ok(copiedText, "clicking the button must copy a prompt/template to the clipboard");
assert.match(copiedText, /خروجی را فقط به صورت Markdown/u);
assert.match(copiedText, /## Unit 1/u);
assert.match(copiedText, /### Lesson A/u);
assert.match(copiedText, /1\. crowded/u);
assert.match(copiedText, /2\. centre \/ center/u);
assert.match(copiedText, /3\. get along with/u);
assert.match(copiedText, /عبارت‌ها، اصطلاحات و collocation/u);

console.log("Library import-template copy test passed.");
