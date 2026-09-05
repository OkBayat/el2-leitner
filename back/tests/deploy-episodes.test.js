import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("every deployment runs setup and a failed setup prevents an app restart", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "vocora-deploy-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const log = join(root, "docker-calls.log");
  await writeFile(join(root, "docker"), '#!/usr/bin/env bash\necho "$*" >> "$DEPLOY_TEST_LOG"\nif [[ "${FAIL_SETUP:-}" == 1 && "$*" == "compose run --rm --no-deps db-setup" ]]; then exit 9; fi\n', { mode: 0o755 });
  const script = new URL("../../scripts/deploy.sh", import.meta.url);
  const env = { ...process.env, PATH: `${root}:${process.env.PATH}`, DEPLOY_TEST_LOG: log };
  for (let run = 0; run < 2; run += 1) assert.equal(spawnSync("bash", [script.pathname], { env }).status, 0);
  let calls = (await readFile(log, "utf8")).trim().split("\n");
  assert.equal(calls.filter((line) => line === "compose run --rm --no-deps db-setup").length, 2);
  await writeFile(log, "");
  assert.equal(spawnSync("bash", [script.pathname], { env: { ...env, FAIL_SETUP: "1" } }).status, 9);
  calls = (await readFile(log, "utf8")).trim().split("\n");
  assert.ok(calls.at(-1).endsWith("db-setup"));
  assert.equal(calls.some((line) => line.includes("--force-recreate app")), false);
});
