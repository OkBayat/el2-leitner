import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("deployment starts Kokoro before replacing the app", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "vocora-tts-deploy-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const log = join(root, "docker-calls.log");
  await writeFile(
    join(root, "docker"),
    `#!/usr/bin/env bash
echo "$*" >> "$DEPLOY_TEST_LOG"
if [[ "\${FAIL_KOKORO:-}" == 1 && "$*" == "compose up -d --wait kokoro" ]]; then exit 9; fi
`,
    { mode: 0o755 },
  );
  const script = new URL("../../scripts/deploy.sh", import.meta.url);
  const env = { ...process.env, PATH: `${root}:${process.env.PATH}`, DEPLOY_TEST_LOG: log };

  assert.equal(spawnSync("bash", [script.pathname], { env }).status, 0);
  const calls = (await readFile(log, "utf8")).trim().split("\n");
  const kokoro = calls.indexOf("compose up -d --wait kokoro");
  assert.ok(kokoro > calls.indexOf("compose run --rm --no-deps db-setup"));
  assert.ok(kokoro < calls.indexOf("compose up -d --no-deps --wait app"));

  await writeFile(log, "");
  assert.equal(spawnSync("bash", [script.pathname], { env: { ...env, FAIL_KOKORO: "1" } }).status, 9);
  assert.ok(!(await readFile(log, "utf8")).includes("compose up -d --no-deps --wait app"));
});
