import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import request from "supertest";
import { createTestContext } from "./helpers/fakes.js";

describe("frontend review cache policy", () => {
  it("never stores the practice assets that must change atomically", async () => {
    const staticDirectory = fileURLToPath(new URL("../../ui", import.meta.url));
    const { app } = createTestContext({}, { staticDirectory });

    for (const asset of [
      "/review-session-ux.js",
      "/review-session-ux.css",
      "/practice-remediation.js",
      "/practice-remediation.css",
      "/practice-remediation-adapter.js",
      "/practice-remediation-keyboard-guard.js"
    ]) {
      const response = await request(app).get(asset).expect(200);
      assert.match(response.headers["cache-control"] || "", /no-store/, `${asset} must not be stored by the browser.`);
      assert.equal(response.headers["cdn-cache-control"], "no-store", `${asset} must not be stored by the CDN.`);
      assert.equal(response.headers["surrogate-control"], "no-store", `${asset} must not be stored by an intermediary.`);
    }
  });

  it("forces generic JavaScript and CSS to revalidate and prevents CDN storage", async () => {
    const staticDirectory = fileURLToPath(new URL("../../ui", import.meta.url));
    const { app } = createTestContext({}, { staticDirectory });

    for (const asset of ["/app-v2.js", "/styles-v2.css"]) {
      const response = await request(app).get(asset).expect(200);
      assert.equal(response.headers["cache-control"], "no-cache, max-age=0, must-revalidate");
      assert.equal(response.headers["cdn-cache-control"], "no-store");
      assert.equal(response.headers["surrogate-control"], "no-store");
    }
  });
});
