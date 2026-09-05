import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const installer = new URL("../../scripts/install-listening-episode.sh", import.meta.url);

async function makeHarness(t, { folder, transcriptStatus = "provided_unverified", existing = false }) {
  const root = await mkdtemp(join(tmpdir(), "vocora-listening-install-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const episodes = join(root, "episodes");
  const tool = join(root, "manage-listening-episode.py");
  const python = join(root, "python3");
  const log = join(root, "calls.log");
  const bundle = join(root, "episode bundle.zip");

  await mkdir(episodes, { recursive: true });
  if (existing) await mkdir(join(episodes, folder));
  await writeFile(bundle, "not-a-real-zip; orchestration test stubs verification\n");
  await writeFile(tool, "# fake helper used through the Python wrapper\n");
  await writeFile(log, "");

  await writeFile(
    python,
    `#!/usr/bin/env bash\nset -euo pipefail\nif [[ "$1" == "-" ]]; then\n  source_code="$(cat)"\n  if [[ "$source_code" == *"resolve(strict=True)"* ]]; then\n    python_arg="$2"\n    if [[ "$python_arg" == /* ]]; then printf '%s\\n' "$python_arg"; else printf '%s/%s\\n' "$PWD" "$python_arg"; fi\n  else\n    printf '%s\\n%s\\n' "$FAKE_FOLDER" "$FAKE_TRANSCRIPT_STATUS"\n  fi\n  exit 0\nfi\nprintf '%q ' "$@" >> "$INSTALL_LOG"\nprintf '\\n' >> "$INSTALL_LOG"\n`,
  );
  await chmod(python, 0o755);

  const env = {
    ...process.env,
    PYTHON_BIN: python,
    VOCORA_EPISODES_DIR: episodes,
    VOCORA_EPISODE_TOOL: tool,
    FAKE_FOLDER: folder,
    FAKE_TRANSCRIPT_STATUS: transcriptStatus,
    INSTALL_LOG: log,
  };

  return { root, episodes, bundle, log, env };
}

test("installer prints usage when the ZIP argument is missing", () => {
  const result = spawnSync("bash", [installer.pathname], { encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage:/);
});

test("existing episode installs audio only and preserves managed files", async (t) => {
  const folder = "2026-06-18-limiting-screen-time-for-children";
  const harness = await makeHarness(t, { folder, existing: true, transcriptStatus: "source_reference_only" });
  const result = spawnSync("bash", [installer.pathname, "episode bundle.zip"], {
    cwd: harness.root,
    env: harness.env,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /installing audio only/);
  const calls = (await readFile(harness.log, "utf8")).trim().split("\n");
  assert.equal(calls.length, 2);
  assert.match(calls[0], /verify/);
  assert.match(calls[1], /install/);
  assert.match(calls[1], /--audio-only/);
  assert.doesNotMatch(calls[1], /--allow-source-transcript/);
});

test("new source-reference bundle is installed completely with explicit transcript allowance", async (t) => {
  const folder = "2026-07-01-new-listening-episode";
  const harness = await makeHarness(t, { folder, transcriptStatus: "source_reference_only" });
  const result = spawnSync("bash", [installer.pathname, harness.bundle], {
    env: harness.env,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /New episode detected/);
  assert.match(result.stderr, /source reference only/);
  const calls = (await readFile(harness.log, "utf8")).trim().split("\n");
  assert.match(calls[1], /install/);
  assert.match(calls[1], /--allow-source-transcript/);
  assert.doesNotMatch(calls[1], /--audio-only/);
});

test("new complete-transcript bundle is installed without source-reference override", async (t) => {
  const folder = "2026-07-02-another-listening-episode";
  const harness = await makeHarness(t, { folder });
  const result = spawnSync("bash", [installer.pathname, harness.bundle], {
    env: harness.env,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  const calls = (await readFile(harness.log, "utf8")).trim().split("\n");
  assert.match(calls[1], /install/);
  assert.doesNotMatch(calls[1], /--audio-only|--allow-source-transcript/);
});
