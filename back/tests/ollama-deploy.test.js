import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const MODEL = "qwen3:4b-instruct-2507-q4_K_M";
const MODEL_DIGEST = "0edcdef34593eac1aa2be9c7d06c432dcf81945adca5eca2f27662c18f168ba0";

test("Ollama stays private and opt-in outside the deployment workflow", async () => {
  const compose = await readFile(new URL("../../docker-compose.yml", import.meta.url), "utf8");
  const start = compose.indexOf("  ollama:\n");
  const service = compose.slice(start, compose.indexOf("\n  app:\n", start));

  assert.notEqual(start, -1);
  assert.match(service, /image: ollama\/ollama:\$\{OLLAMA_IMAGE_TAG:-0\.34\.0\}/);
  assert.match(service, /profiles: \["ai"\]/);
  assert.match(service, /OLLAMA_NO_CLOUD: \$\{OLLAMA_NO_CLOUD:-1\}/);
  assert.match(service, /QWEN_MODEL: qwen3:4b-instruct-2507-q4_K_M/);
  assert.match(service, /ollama_models:\/root\/\.ollama/);
  assert.doesNotMatch(service, /^\s+ports:/m);
});

test("deployment skips unchanged images and an installed Qwen model", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "vocora-incremental-deploy-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const log = join(root, "docker-calls.log");
  await writeFile(
    join(root, "docker"),
    `#!/usr/bin/env bash
echo "$*" >> "$DEPLOY_TEST_LOG"
if [[ "$1 $2" == "image inspect" ]]; then
  image="\${@: -1}"
  if [[ "$image" == "leitner-ielts-app" ]]; then echo "$VOCORA_APP_SOURCE_HASH"; exit 0; fi
  if [[ "$image" == "leitner-ielts-speech" ]]; then echo "$VOCORA_SPEECH_SOURCE_HASH"; exit 0; fi
fi
if [[ "$*" == "compose --profile ai exec -T ollama ollama show ${MODEL}" ]]; then
  [[ "\${MODEL_PRESENT:-1}" == 1 ]]
  exit $?
fi
if [[ "$*" == "compose --profile ai exec -T ollama ollama pull ${MODEL}" ]]; then
  [[ "\${PULL_FAIL:-0}" != 1 ]]
  exit $?
fi
if [[ "$*" == compose\\ --profile\\ ai\\ exec\\ -T\\ ollama\\ sha256sum* ]]; then
  if [[ "\${DIGEST_MATCH:-1}" == 1 ]]; then echo "${MODEL_DIGEST}  manifest"; else echo "bad-digest  manifest"; fi
  exit 0
fi
`,
    { mode: 0o755 },
  );
  const script = new URL("../../scripts/deploy.sh", import.meta.url);
  const env = {
    ...process.env,
    PATH: `${root}:${process.env.PATH}`,
    DEPLOY_TEST_LOG: log,
    MODEL_PRESENT: "1",
  };

  const initialRun = spawnSync("bash", [script.pathname], { env, encoding: "utf8" });
  assert.equal(initialRun.status, 0, initialRun.stderr);
  let calls = (await readFile(log, "utf8")).trim().split("\n");
  assert.equal(calls.some((line) => line.startsWith("compose build ")), false);
  assert.ok(calls.includes("compose --profile ai up -d --wait ollama"));
  assert.ok(calls.includes(`compose --profile ai exec -T ollama ollama show ${MODEL}`));
  assert.equal(calls.some((line) => line.includes("ollama pull")), false);
  assert.ok(calls.includes("compose up -d --no-deps --wait app"));
  assert.equal(calls.some((line) => line.includes("--force-recreate")), false);

  await writeFile(log, "");
  assert.equal(spawnSync("bash", [script.pathname], { env: { ...env, MODEL_PRESENT: "0" } }).status, 0);
  calls = (await readFile(log, "utf8")).trim().split("\n");
  assert.ok(calls.includes(`compose --profile ai exec -T ollama ollama pull ${MODEL}`));

  await writeFile(log, "");
  assert.equal(
    spawnSync("bash", [script.pathname], { env: { ...env, MODEL_PRESENT: "0", PULL_FAIL: "1" } }).status,
    1,
  );
  calls = (await readFile(log, "utf8")).trim().split("\n");
  assert.equal(calls.some((line) => line.includes("compose up -d --no-deps --wait app")), false);

  await writeFile(log, "");
  assert.equal(
    spawnSync("bash", [script.pathname], { env: { ...env, DIGEST_MATCH: "0" } }).status,
    1,
  );
  calls = (await readFile(log, "utf8")).trim().split("\n");
  assert.ok(calls.includes(`compose --profile ai exec -T ollama ollama pull ${MODEL}`));
  assert.equal(calls.some((line) => line.includes("compose up -d --no-deps --wait app")), false);
});
