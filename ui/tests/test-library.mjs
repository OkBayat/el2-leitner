import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const root = new URL("../", import.meta.url);
const indexMarkup = fs.readFileSync(new URL("index.html", root), "utf8");
const libraryMarkup = fs.readFileSync(new URL("library.html", root), "utf8");
const libraryScript = fs.readFileSync(new URL("library.js", root), "utf8");
const libraryCss = fs.readFileSync(new URL("library.css", root), "utf8");

function installDialogSupport(window) {
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute("open", ""); };
  window.HTMLDialogElement.prototype.close = function close() { this.removeAttribute("open"); };
}

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return status === 204 ? "" : JSON.stringify(payload); }
  };
}

{
  const { document } = new JSDOM(indexMarkup).window;
  const libraryLink = document.querySelector('.main-nav a.library-nav-link[href="library.html"]');
  assert.ok(libraryLink, "main navigation must expose the library");
  assert.match(libraryLink.textContent, /کتابخانه/u);
  assert.equal(libraryLink.classList.contains("nav-item"), false, "library link must not trigger the SPA view switcher");
  const headers = [...document.querySelectorAll("#view-words thead th")].map((node) => node.textContent.trim());
  assert.ok(headers.includes("مجموعه‌ها"), "word bank must show collection membership");
  assert.ok(document.querySelector('script[src^="word-collections.js?v="]'));
  assert.ok(document.querySelector('script[src^="session-persistence.js?v="]'));
}

{
  const { document } = new JSDOM(libraryMarkup).window;
  assert.ok(document.querySelector("#collectionLevelInput"), "collection editor must expose a CEFR level field");
  assert.ok(document.querySelector("#libraryWordCount"), "library must expose total word statistics");
  assert.ok(document.querySelector("#subscribedWordCount"), "library must expose subscribed word statistics");
  assert.ok(document.querySelector(".library-detail-summary"), "detail modal must use the compact summary layout");
  assert.ok(document.querySelector(".library-file-drop"), "import modal must keep a dedicated file drop target");
  assert.equal(document.querySelector('link[rel="stylesheet"][href^="styles.css"]'), null, "library must not request the obsolete styles.css path");
  assert.ok(document.querySelector('link[rel="stylesheet"][href^="styles-v2.css?v="]'), "base stylesheet must be cache-busted");
  assert.ok(document.querySelector('link[rel="stylesheet"][href^="library.css?v="]'), "library stylesheet must be cache-busted");
  assert.ok(document.querySelector('script[src^="library.js?v="]'), "library runtime must be cache-busted with the matching HTML release");
  assert.match(libraryCss, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/u, "desktop library must use compact three-column cards");
  assert.match(libraryCss, /max-height:calc\(100dvh - 42px\)/u, "dialogs must stay inside the viewport");
}

{
  const dom = new JSDOM(libraryMarkup, {
    runScripts: "outside-only",
    url: "http://localhost/library.html"
  });
  const { window } = dom;
  installDialogSupport(window);
  const collection = {
    id: "aef3",
    slug: "american-english-file-3",
    title: "American English File 3",
    description: "Course vocabulary",
    kind: "book",
    visibility: "public",
    status: "published",
    contentVersion: 2,
    wordCount: 120,
    subscribed: false,
    metadata: { level: "B1" },
    updatedAt: "2026-08-07T10:00:00.000Z"
  };
  const payloads = {
    "/api/auth/me": { user: { id: "7", email: "learner@example.com" } },
    "/api/library": {
      capabilities: { canManage: false },
      collections: [collection]
    },
    "/api/library/aef3": {
      capabilities: { canManage: false },
      collection: { ...collection, sections: [], entries: [] }
    },
    "/api/library/aef3/subscription": { collection: { id: "aef3", subscribed: true } }
  };
  window.fetch = async (input, options = {}) => {
    const path = new URL(typeof input === "string" ? input : input.url, window.location.href).pathname;
    const payload = payloads[path];
    assert.ok(payload || path === "/api/auth/logout", `Unexpected request: ${path} ${options.method || "GET"}`);
    return jsonResponse(payload, path === "/api/auth/logout" ? 204 : 200);
  };
  window.eval(libraryScript);
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(window.document.querySelector("#userEmail").textContent, "learner@example.com");
  assert.match(window.document.querySelector("#libraryGrid").textContent, /American English File 3/u);
  assert.match(window.document.querySelector("#libraryGrid").textContent, /B1/u, "level must be visible on the collection card");
  assert.equal(window.document.querySelector("#collectionCount").textContent, "۱");
  assert.equal(window.document.querySelector("#libraryWordCount").textContent, "۱۲۰");
  assert.equal(window.document.querySelector("#subscribedWordCount").textContent, "۰");
  assert.ok(window.document.querySelector("#createCollectionBtn").classList.contains("hidden"));
  assert.equal(window.VocoraLibraryTest.normalize("  Centre  "), "centre");
  assert.equal(window.VocoraLibraryTest.collectionLevel(collection), "B1");
  assert.equal(window.VocoraLibraryTest.slugifyAscii("American English File 3"), "american-english-file-3");

  window.document.querySelector(".detail-card").click();
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(window.document.querySelector("#detailLevel").textContent, "B1");
  assert.ok(window.document.querySelector("#collectionDialog").hasAttribute("open"));

  window.document.querySelector(".subscribe-card").click();
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.match(window.document.querySelector("#libraryGrid").textContent, /اضافه شده/u);
  assert.equal(window.document.querySelector("#subscribedWordCount").textContent, "۱۲۰");
}

{
  const dom = new JSDOM(libraryMarkup, {
    runScripts: "outside-only",
    url: "http://localhost/library.html"
  });
  const { window } = dom;
  installDialogSupport(window);

  [
    "#libraryDate",
    "#libraryWordCount",
    "#subscribedWordCount",
    "#detailIcon",
    "#detailMainName",
    "#detailLevel",
    "#detailSummaryLine",
    "#collectionLevelInput"
  ].forEach((selector) => window.document.querySelector(selector)?.remove());
  const legacySubscribedCount = window.document.createElement("span");
  legacySubscribedCount.id = "subscribedCount";
  window.document.body.appendChild(legacySubscribedCount);

  const collection = {
    id: "legacy-aef3",
    slug: "american-english-file-3",
    title: "American English File 3",
    description: "Course vocabulary",
    kind: "book",
    visibility: "public",
    status: "published",
    contentVersion: 2,
    wordCount: 120,
    subscribed: true,
    metadata: { level: "B1" }
  };
  window.fetch = async (input) => {
    const path = new URL(typeof input === "string" ? input : input.url, window.location.href).pathname;
    if (path === "/api/auth/me") return jsonResponse({ user: { id: "7", email: "legacy@example.com" } });
    if (path === "/api/library") return jsonResponse({ capabilities: { canManage: false }, collections: [collection] });
    if (path === "/api/library/legacy-aef3") return jsonResponse({ capabilities: { canManage: false }, collection: { ...collection, sections: [], entries: [] } });
    throw new Error(`Unexpected request: ${path}`);
  };

  window.eval(libraryScript);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.match(window.document.querySelector("#libraryGrid").textContent, /American English File 3/u, "new runtime must still render on stale markup");
  assert.equal(legacySubscribedCount.textContent, "۱", "legacy summary id must remain supported during cache skew");
  assert.equal(window.document.querySelector("#libraryNotice").textContent, "", "optional stale fields must not crash the library");

  window.document.querySelector(".detail-card").click();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok(window.document.querySelector("#collectionDialog").hasAttribute("open"), "detail view must tolerate missing redesign-only fields");
}

{
  const dom = new JSDOM(libraryMarkup, {
    runScripts: "outside-only",
    url: "http://localhost/library.html"
  });
  const { window } = dom;
  installDialogSupport(window);
  const collection = {
    id: "aef3",
    slug: "american-english-file-3",
    title: "American English File 3",
    description: "Course vocabulary",
    kind: "book",
    visibility: "public",
    status: "published",
    contentVersion: 2,
    wordCount: 120,
    subscribed: true,
    metadata: { level: "B1", coverLabel: "AEF 3" },
    sections: [],
    entries: []
  };
  let savedPayload = null;
  window.fetch = async (input, options = {}) => {
    const path = new URL(typeof input === "string" ? input : input.url, window.location.href).pathname;
    if (path === "/api/auth/me") return response({ user: { id: "1", email: "admin@example.com" } });
    if (path === "/api/library" && (!options.method || options.method === "GET")) {
      return response({ capabilities: { canManage: true }, collections: [collection] });
    }
    if (path === "/api/library/aef3" && options.method === "PUT") {
      savedPayload = JSON.parse(options.body);
      Object.assign(collection, savedPayload);
      return response({ collection });
    }
    if (path === "/api/library/aef3") return response({ capabilities: { canManage: true }, collection });
    throw new Error(`Unexpected request: ${path} ${options.method || "GET"}`);
  };
  function response(payload) {
    return { ok: true, status: 200, async text() { return JSON.stringify(payload); } };
  }

  window.eval(libraryScript);
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(window.document.querySelector("#createCollectionBtn").classList.contains("hidden"), false);
  window.document.querySelector(".edit-card").click();
  assert.equal(window.document.querySelector("#collectionLevelInput").value, "B1");
  window.document.querySelector("#collectionLevelInput").value = "B2";
  window.document.querySelector("#collectionForm").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 35));
  assert.equal(savedPayload.metadata.level, "B2", "edited level must be persisted in collection metadata");
  assert.equal(savedPayload.metadata.coverLabel, "AEF 3", "editing level must preserve unrelated metadata");
}

console.log("Library UI tests passed.");
