import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import request from "supertest";

import { createTestContext } from "./helpers/fakes.js";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("PWA static assets", () => {
  it("serves the root worker and manifest with update-safe headers", async () => {
    const staticDirectory = await mkdtemp(path.join(os.tmpdir(), "vocora-pwa-"));
    temporaryDirectories.push(staticDirectory);
    await writeFile(path.join(staticDirectory, "index.html"), "<!doctype html><app-root></app-root>");
    await writeFile(path.join(staticDirectory, "service-worker.js"), "self.addEventListener('fetch', () => {});");
    await writeFile(path.join(staticDirectory, "manifest.webmanifest"), JSON.stringify({ name: "Vocora" }));

    const { app } = createTestContext({}, { staticDirectory });

    const worker = await request(app).get("/service-worker.js").expect(200);
    assert.match(worker.headers["cache-control"] || "", /no-store/u);
    assert.equal(worker.headers["service-worker-allowed"], "/");
    assert.match(worker.headers["content-type"] || "", /javascript/u);

    const manifest = await request(app).get("/manifest.webmanifest").expect(200);
    assert.match(manifest.headers["cache-control"] || "", /no-store/u);
    assert.match(manifest.headers["content-type"] || "", /application\/manifest\+json/u);
    assert.equal(manifest.body.name, "Vocora");
  });
});
