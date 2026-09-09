import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const uiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(uiRoot, "..");
const workflowRoot = path.join(repositoryRoot, ".github", "workflows");
const guardRelativePath = "tools/e2e-disabled.mjs";
const guardCommand = `node ${guardRelativePath}`;
const read = (root, relative) =>
	fs.readFileSync(path.join(root, relative), "utf8");

const packageJson = JSON.parse(read(uiRoot, "package.json"));
for (const script of ["e2e", "e2e:smoke", "e2e:headed"]) {
	assert.equal(
		packageJson.scripts[script],
		guardCommand,
		`${script} must fail closed through the shared E2E guard.`,
	);
}

const guardPath = path.join(uiRoot, guardRelativePath);
assert.ok(fs.existsSync(guardPath), "The shared E2E guard must exist.");
const guardedRun = spawnSync(process.execPath, [guardPath], {
	encoding: "utf8",
});
assert.equal(guardedRun.status, 1, "The E2E guard must reject execution.");
assert.match(guardedRun.stderr, /E2E_DISABLED/u);
assert.match(guardedRun.stderr, /dedicated test database/iu);

const playwrightConfig = read(uiRoot, "playwright.config.ts");
assert.match(
	playwrightConfig,
	/throw new Error\(/u,
	"Direct Playwright execution must fail while loading its config.",
);
assert.match(playwrightConfig, /E2E_DISABLED/u);
assert.doesNotMatch(
	playwrightConfig,
	/defineConfig|projects\s*:|baseURL\s*:/u,
	"The disabled Playwright config must not retain a runnable browser configuration.",
);

const workflowFiles = fs
	.readdirSync(workflowRoot)
	.filter((name) => /\.ya?ml$/u.test(name));
for (const name of workflowFiles) {
	const source = read(workflowRoot, name);
	assert.doesNotMatch(
		source,
		/(?:playwright(?:\s+install|\s+test)|npm\s+run\s+e2e|@playwright\/test)/iu,
		`${name} must not install or run Playwright in GitHub CI.`,
	);
}

const agentGuide = read(repositoryRoot, "AGENTS.md");
assert.match(agentGuide, /E2E tests are disabled repository-wide\./u);
assert.match(
	agentGuide,
	/Never create, develop, invoke, or run E2E or Playwright tests/u,
);
assert.match(agentGuide, /dedicated, isolated test database/u);

console.log("E2E execution guard contract passed.");
