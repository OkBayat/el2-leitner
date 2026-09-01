import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(testDir, "..");
const read = (name) => fs.readFileSync(path.join(uiRoot, name), "utf8");

const pages = ["index.html", "library.html", "leitner-house.html", "login.html", "register.html"];
for (const page of pages) {
  const markup = read(page);
  const { document } = new JSDOM(markup).window;
  const stylesheets = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .map((link) => link.getAttribute("href")?.split(/[?#]/u, 1)[0])
    .filter(Boolean);

  assert.ok(
    stylesheets.includes("material3.css"),
    `${page} must consume the shared Material 3 design-system stylesheet.`
  );
  assert.equal(
    stylesheets.includes("styles.css"),
    false,
    `${page} must not load the obsolete compatibility stylesheet.`
  );

  for (const script of document.querySelectorAll("script[src]")) {
    assert.doesNotMatch(
      script.getAttribute("src") || "",
      /material(?:-components|\/web|3).*\.js/iu,
      `${page} must not add a styling runtime or a second UI state owner.`
    );
  }
}

assert.equal(
  fs.existsSync(path.join(uiRoot, "styles.css")),
  false,
  "The empty compatibility stylesheet must be deleted rather than kept as dead code."
);

const indexMarkup = read("index.html");
assert.equal(
  new JSDOM(indexMarkup).window.document.querySelectorAll("head > style").length,
  0,
  "Shared component styling must not be duplicated in an inline style block."
);

const theme = read("material3.css");
const requiredTokens = [
  "--md-sys-color-primary",
  "--md-sys-color-on-primary",
  "--md-sys-color-primary-container",
  "--md-sys-color-on-primary-container",
  "--md-sys-color-secondary-container",
  "--md-sys-color-on-secondary-container",
  "--md-sys-color-tertiary-container",
  "--md-sys-color-on-tertiary-container",
  "--md-sys-color-error",
  "--md-sys-color-error-container",
  "--md-sys-color-background",
  "--md-sys-color-on-background",
  "--md-sys-color-surface",
  "--md-sys-color-on-surface",
  "--md-sys-color-surface-container-low",
  "--md-sys-color-surface-container",
  "--md-sys-color-surface-container-high",
  "--md-sys-color-outline",
  "--md-sys-color-outline-variant",
  "--md-sys-shape-corner-small",
  "--md-sys-shape-corner-medium",
  "--md-sys-shape-corner-large",
  "--md-sys-shape-corner-extra-large",
  "--md-sys-elevation-level1",
  "--md-sys-elevation-level2",
  "--md-sys-typescale-body-medium-size",
  "--md-sys-typescale-label-large-size",
  "--md-sys-motion-duration-short2",
  "--md-sys-motion-easing-standard"
];
for (const token of requiredTokens) {
  assert.match(theme, new RegExp(`${token.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\s*:`), `${token} is required.`);
}

assert.match(theme, /\[data-theme=["']dark["']\]/u, "Dark mode must have its own Material color roles.");
assert.match(theme, /@media\s*\(prefers-reduced-motion:\s*reduce\)/u, "Motion must respect the user's reduced-motion preference.");

for (const [legacy, material] of [
  ["--bg", "--md-sys-color-background"],
  ["--surface", "--md-sys-color-surface"],
  ["--surface-2", "--md-sys-color-surface-container-low"],
  ["--text", "--md-sys-color-on-surface"],
  ["--muted", "--md-sys-color-on-surface-variant"],
  ["--line", "--md-sys-color-outline-variant"],
  ["--primary", "--md-sys-color-primary"],
  ["--primary-soft", "--md-sys-color-primary-container"],
  ["--danger", "--md-sys-color-error"],
  ["--danger-soft", "--md-sys-color-error-container"]
]) {
  assert.match(
    theme,
    new RegExp(`${legacy.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\s*:\\s*var\\(${material.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\)`),
    `${legacy} must be a compatibility alias to ${material}, not a second palette value.`
  );
}

for (const selector of [".btn-primary", ".btn-light", ".icon-btn", ".panel", ".nav-item.active", ".field input", ".search-field"]) {
  assert.ok(theme.includes(selector), `${selector} must have a Material 3 presentation rule.`);
}
assert.match(theme, /:focus-visible/u, "The design system must provide a visible keyboard focus state.");
assert.match(theme, /min-height:\s*40px/u, "Interactive controls must preserve Material minimum control sizing.");

const packageJson = JSON.parse(read("package.json"));
assert.equal(packageJson.dependencies?.["@material/web"], undefined, "Material 3 styling must not add an unnecessary runtime dependency.");
assert.equal(packageJson.devDependencies?.["@material/web"], undefined, "Material 3 styling must not add an unnecessary build dependency.");
assert.match(packageJson.scripts.test, /test-material3-design-system\.mjs/u, "The Material 3 architecture test must run in the default suite.");

console.log("Material 3 design-system architecture tests passed.");
