import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import request from "supertest";
import { createTestContext } from "./helpers/fakes.js";

const RELEASE = "20260808-enter-router2";

describe("frontend review cache policy", () => {
  it("never stores frontend code that must change atomically", async () => {
    const staticDirectory = fileURLToPath(new URL("../../ui", import.meta.url));
    const { app } = createTestContext({}, { staticDirectory });

    for (const asset of [
      "/review-session-ux.js",
      "/review-session-ux.css",
      "/practice-session-keyboard-router.js",
      "/practice-remediation.js",
      "/practice-remediation.css",
      "/practice-remediation-adapter.js",
      "/practice-remediation-keyboard-guard.js",
      "/app-v2.js",
      "/styles-v2.css"
    ]) {
      const response = await request(app).get(asset).expect(200);
      assert.match(response.headers["cache-control"] || "", /no-store/, `${asset} must not be stored by the browser.`);
      assert.match(response.headers["cache-control"] || "", /s-maxage=0/, `${asset} must disable shared-cache freshness.`);
      assert.equal(response.headers["cdn-cache-control"], "no-store", `${asset} must not be stored by the CDN.`);
      assert.equal(response.headers["surrogate-control"], "no-store", `${asset} must not be stored by an intermediary.`);
      assert.equal(response.headers["x-vocora-release"], RELEASE);
      assert.equal(response.headers.etag, undefined, `${asset} must not rely on an old ETag.`);
      assert.equal(response.headers["last-modified"], undefined, `${asset} must not rely on an old Last-Modified validator.`);
    }
  });

  it("clears previously cached frontend responses when HTML is loaded", async () => {
    const staticDirectory = fileURLToPath(new URL("../../ui", import.meta.url));
    const { app } = createTestContext({}, { staticDirectory });

    const response = await request(app).get("/").expect(200);
    assert.match(response.headers["cache-control"] || "", /no-store/);
    assert.equal(response.headers["clear-site-data"], '"cache"');
    assert.equal(response.headers["cdn-cache-control"], "no-store");
    assert.equal(response.headers["surrogate-control"], "no-store");
    assert.equal(response.headers["x-vocora-release"], RELEASE);
    assert.match(response.text, new RegExp(`data-vocora-release="${RELEASE}"`));
    assert.match(response.text, new RegExp(`practice-session-keyboard-router\\.js\\?v=${RELEASE}`));
  });
});
