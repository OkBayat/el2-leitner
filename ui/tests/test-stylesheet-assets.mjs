import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(testDir, "..");
const pages = ["index.html", "library.html", "leitner-house.html", "login.html", "register.html"];
const designSystem = "src/design-system/material3.css";

for (const page of pages) {
  const markup = fs.readFileSync(path.join(uiRoot, page), "utf8");
  const { document } = new JSDOM(markup).window;
  const hrefs = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .map((link) => link.getAttribute("href"))
    .filter((href) => href && !/^(?:https?:)?\/\//u.test(href));
  const cleanHrefs = hrefs.map((href) => href.split(/[?#]/u, 1)[0]);

  assert.ok(hrefs.length > 0, `${page} should load at least one local stylesheet`);
  assert.equal(new Set(cleanHrefs).size, cleanHrefs.length, `${page} must not load the same stylesheet more than once.`);
  assert.equal(cleanHrefs.at(-1), designSystem, `${page} must load the presentation layer last so one system owns visual states.`);

  for (const href of hrefs) {
    const cleanPath = href.split(/[?#]/u, 1)[0];
    const assetPath = path.resolve(uiRoot, cleanPath);
    assert.ok(assetPath.startsWith(`${uiRoot}${path.sep}`), `${page} stylesheet must stay inside the UI root: ${href}`);
    assert.ok(fs.existsSync(assetPath), `${page} references a missing stylesheet: ${href}`);
    assert.ok(fs.statSync(assetPath).isFile(), `${page} stylesheet is not a file: ${href}`);
  }
}

console.log("Stylesheet asset integrity tests passed.");
