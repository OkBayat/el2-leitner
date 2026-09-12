#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(scriptDir, "..");

function runValidator(root) {
  const result = spawnSync(
    "python3",
    [path.join(root, "scripts", "validate-design-system.py")],
    {
      encoding: "utf8",
    },
  );
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

function withFixture(mutator, expectation) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "k2-design-system-"));
  const fixtureRoot = path.join(directory, "k2-design-system");
  try {
    fs.cpSync(skillRoot, fixtureRoot, { recursive: true });
    mutator(fixtureRoot);
    expectation(runValidator(fixtureRoot));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function mutateTokens(root, mutator) {
  const tokenPath = path.join(root, "references", "tokens.json");
  const tokens = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
  mutator(tokens);
  fs.writeFileSync(tokenPath, `${JSON.stringify(tokens, null, 2)}\n`);
}

const current = runValidator(skillRoot);
assert.equal(current.status, 0, current.output);

const skill = fs.readFileSync(path.join(skillRoot, "SKILL.md"), "utf8");
const interfaceSource = fs.readFileSync(
  path.join(skillRoot, "agents", "openai.yaml"),
  "utf8",
);
assert.match(skill, /name: k2-design-system/u);
assert.match(interfaceSource, /display_name: "K2 Design System"/u);
assert.match(interfaceSource, /\$k2-design-system/u);
assert.match(skill, /ui\/tests\/test-design-system-architecture\.mjs/u);

withFixture(
  (root) =>
    mutateTokens(root, (tokens) => {
      tokens.color["spark-blue"].$value = "#000000";
    }),
  ({ status, output }) => {
    assert.notEqual(status, 0);
    assert.match(output, /color\.spark-blue must equal #1CB0F6/u);
  },
);

withFixture(
  (root) => {
    const materialPath = path.join(root, "references", "material-theme.scss");
    fs.writeFileSync(
      materialPath,
      fs
        .readFileSync(materialPath, "utf8")
        .replace(
          "--mat-sys-inverse-primary: var(--vocora-inverse-primary);",
          "--mat-sys-inverse-primary: var(--vocora-primary);",
        ),
    );
  },
  ({ output }) =>
    assert.match(
      output,
      /material-theme\.scss must map --mat-sys-inverse-primary to --vocora-inverse-primary/u,
    ),
);

withFixture(
  (root) =>
    mutateTokens(root, (tokens) => {
      delete tokens.themes.dark.border.default;
      tokens.themes.light.semantic.secondary = tokens.themes.light.text.secondary;
    }),
  ({ output }) => {
    assert.match(output, /Theme key parity failed for group 'border'/u);
    assert.match(
      output,
      /themes\.light\.semantic\.secondary must equal #000437/u,
    );
  },
);

withFixture(
  (root) => {
    const skillPath = path.join(root, "SKILL.md");
    fs.writeFileSync(
      skillPath,
      fs
        .readFileSync(skillPath, "utf8")
        .replace("are removed from the tab order", "leave the tab order"),
    );
  },
  ({ status, output }) => {
    assert.notEqual(status, 0);
    assert.match(
      output,
      /SKILL\.md must say disabled Voco links are removed from the tab order/u,
    );
  },
);

withFixture(
  (root) => {
    const designPath = path.join(root, "references", "DESIGN.md");
    fs.writeFileSync(
      designPath,
      fs
        .readFileSync(designPath, "utf8")
        .replace("is removed from the tab order", "leaves the tab order"),
    );
  },
  ({ status, output }) => {
    assert.notEqual(status, 0);
    assert.match(
      output,
      /DESIGN\.md must say disabled Voco links are removed from the tab order/u,
    );
  },
);

withFixture(
  (root) =>
    mutateTokens(root, (tokens) => {
      tokens.themes.light.action.primary = "#58CC02";
      tokens.themes.light.action.secondaryForeground = "#1CB0F6";
      tokens.themes.light.action.disabledBackground = "#AFAFAF";
      tokens.themes.dark.action.success = "#49C0F8";
      tokens.themes.dark.action.secondaryForeground = "#F0F7F2";
    }),
  ({ output }) => {
    for (const expected of [
      "themes.light.action.primary must equal #1CB0F6",
      "themes.light.action.secondaryForeground must equal #4B4B4B",
      "themes.light.action.disabledBackground must equal #D9D9D9",
      "themes.dark.action.success must equal #72D72B",
      "themes.dark.action.secondaryForeground must equal #4B4B4B",
    ])
      assert.match(
        output,
        new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"),
      );
  },
);

withFixture(
  (root) =>
    mutateTokens(root, (tokens) => {
      delete tokens.color["eager-green"].$type;
      tokens.font.feather.$description = "";
    }),
  ({ output }) => {
    assert.match(output, /color\.eager-green must use type color/u);
    assert.match(output, /font\.feather must have a description/u);
  },
);

withFixture(
  (root) =>
    mutateTokens(root, (tokens) => {
      tokens.$extensions["com.vocora.design-system"].buttonRadius = "8px";
      delete tokens.themes.dark.action.error;
    }),
  ({ output }) => {
    assert.match(output, /The canonical button radius must be 13px/u);
    assert.match(output, /Theme key parity failed for group 'action'/u);
  },
);

withFixture(
  (root) => {
    const variablesPath = path.join(root, "references", "variables.scss");
    fs.writeFileSync(
      variablesPath,
      fs
        .readFileSync(variablesPath, "utf8")
        .replace(
          "--color-spark-blue: #1cb0f6;",
          "--color-spark-blue: #000000;",
        ),
    );
  },
  ({ output }) =>
    assert.match(
      output,
      /variables\.scss must map --color-spark-blue to #1CB0F6/u,
    ),
);

withFixture(
  (root) => {
    const designPath = path.join(root, "references", "DESIGN.md");
    fs.writeFileSync(
      designPath,
      fs
        .readFileSync(designPath, "utf8")
        .replace(
          "Reusable product-specific primitive?",
          "Reusable product primitive?",
        ),
    );
  },
  ({ output }) =>
    assert.match(
      output,
      /DESIGN\.md is missing decision-tree step: Reusable product-specific primitive\?/u,
    ),
);

withFixture(
  (root) => {
    const designPath = path.join(root, "references", "DESIGN.md");
    fs.writeFileSync(
      designPath,
      fs
        .readFileSync(designPath, "utf8")
        .replaceAll("voco-navigation-button", "removed-navigation-button"),
    );
  },
  ({ status, output }) => {
    assert.notEqual(status, 0);
    assert.match(
      output,
      /DESIGN\.md is missing button selector: voco-navigation-button/u,
    );
  },
);

withFixture(
  (root) => {
    const designPath = path.join(root, "references", "DESIGN.md");
    fs.writeFileSync(
      designPath,
      fs
        .readFileSync(designPath, "utf8")
        .replace("`(activated)` is the public action event", "The public action event"),
    );
  },
  ({ status, output }) => {
    assert.notEqual(status, 0);
    assert.match(
      output,
      /DESIGN\.md must document the public voco activated event/u,
    );
  },
);

withFixture(
  (root) => {
    const designPath = path.join(root, "references", "DESIGN.md");
    fs.writeFileSync(
      designPath,
      fs
        .readFileSync(designPath, "utf8")
        .replaceAll("VocoWarningButtonComponent", "RemovedWarningButton"),
    );
  },
  ({ status, output }) => {
    assert.notEqual(status, 0);
    assert.match(
      output,
      /DESIGN\.md is missing public button class: VocoWarningButtonComponent/u,
    );
  },
);

for (const [contractText, expected] of [
  [
    "removes both native `href` and `routerLink`",
    /DESIGN\.md must define disabled Voco link behavior/u,
  ],
  [
    "`voco-audio-button` is the square icon-oriented audio transport control",
    /DESIGN\.md must distinguish square audio controls from textual audio actions/u,
  ],
  [
    "not a generic Voco\nbutton replacement",
    /DESIGN\.md must keep vocoButtonInteraction selection-only/u,
  ],
]) {
  withFixture(
    (root) => {
      const designPath = path.join(root, "references", "DESIGN.md");
      fs.writeFileSync(
        designPath,
        fs.readFileSync(designPath, "utf8").replace(contractText, "removed contract"),
      );
    },
    ({ status, output }) => {
      assert.notEqual(status, 0);
      assert.match(output, expected);
    },
  );
}

console.log("K2 design-system validator tests passed.");
