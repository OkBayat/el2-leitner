import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const root = new URL("../", import.meta.url);
const indexMarkup = fs.readFileSync(new URL("index.html", root), "utf8");
const libraryMarkup = fs.readFileSync(new URL("library.html", root), "utf8");
const libraryScript = fs.readFileSync(new URL("library.js", root), "utf8");

{
  const { document } = new JSDOM(indexMarkup).window;
  const libraryLink = document.querySelector('.main-nav a.library-nav-link[href="library.html"]');
  assert.ok(libraryLink, "main navigation must expose the library");
  assert.match(libraryLink.textContent, /کتابخانه/u);
  assert.equal(libraryLink.classList.contains("nav-item"), false, "library link must not trigger the SPA view switcher");
  const headers = [...document.querySelectorAll("#view-words thead th")].map((node) => node.textContent.trim());
  assert.ok(headers.includes("مجموعه‌ها"), "word bank must show collection membership");
  assert.ok(document.querySelector('script[src="word-collections.js"]'));
  assert.ok(document.querySelector('script[src="session-persistence.js"]'));
}

{
  const dom = new JSDOM(libraryMarkup, {
    runScripts: "outside-only",
    url: "http://localhost/library.html"
  });
  const { window } = dom;
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute("open", ""); };
  window.HTMLDialogElement.prototype.close = function close() { this.removeAttribute("open"); };
  const payloads = {
    "/api/auth/me": { user: { id: "7", email: "learner@example.com" } },
    "/api/library": {
      capabilities: { canManage: false },
      collections: [{
        id: "aef3",
        slug: "american-english-file-3",
        title: "American English File 3",
        description: "Course vocabulary",
        kind: "book",
        visibility: "public",
        status: "published",
        contentVersion: 2,
        wordCount: 120,
        subscribed: false
      }]
    },
    "/api/library/aef3/subscription": { collection: { id: "aef3", subscribed: true } }
  };
  window.fetch = async (input, options = {}) => {
    const path = new URL(typeof input === "string" ? input : input.url, window.location.href).pathname;
    const payload = payloads[path];
    assert.ok(payload || path === "/api/auth/logout", `Unexpected request: ${path} ${options.method || "GET"}`);
    return {
      ok: true,
      status: path === "/api/auth/logout" ? 204 : 200,
      async text() { return path === "/api/auth/logout" ? "" : JSON.stringify(payload); }
    };
  };
  window.eval(libraryScript);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(window.document.querySelector("#userEmail").textContent, "learner@example.com");
  assert.match(window.document.querySelector("#libraryGrid").textContent, /American English File 3/u);
  assert.ok(window.document.querySelector("#createCollectionBtn").classList.contains("hidden"));
  assert.equal(window.VocoraLibraryTest.normalize("  Centre  "), "centre");

  window.document.querySelector(".subscribe-card").click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.match(window.document.querySelector("#libraryGrid").textContent, /حذف از جعبه/u);
}

console.log("Library UI tests passed.");
