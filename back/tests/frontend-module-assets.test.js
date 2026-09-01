import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import request from "supertest";

import { createTestContext } from "./helpers/fakes.js";

describe("frontend module assets", () => {
  it("serves nested ES modules and the design system with the frontend no-store policy", async () => {
    const staticDirectory = fileURLToPath(new URL("../../ui", import.meta.url));
    const { app } = createTestContext({}, { staticDirectory });

    for (const [asset, contentType] of [
      ["/src/features/auth/index.js", /javascript/],
      ["/src/features/leitner-house/index.js", /javascript/],
      ["/src/design-system/material3.css", /^text\/css/]
    ]) {
      const response = await request(app).get(asset).expect(200);
      assert.match(response.headers["cache-control"] || "", /no-store/, `${asset} must not be cached across releases.`);
      assert.equal(response.headers["cdn-cache-control"], "no-store", `${asset} must not be cached by the CDN.`);
      assert.equal(response.headers["surrogate-control"], "no-store", `${asset} must not be cached by intermediaries.`);
      assert.match(response.headers["content-type"] || "", contentType, `${asset} must have the browser-compatible MIME type.`);
    }
  });

  it("does not serve the replaced root frontend owners", async () => {
    const staticDirectory = fileURLToPath(new URL("../../ui", import.meta.url));
    const { app } = createTestContext({}, { staticDirectory });

    for (const asset of ["/auth.js", "/auth.css", "/leitner-house.js", "/leitner-house.css", "/material3.css", "/styles.css"]) {
      const response = await request(app)
        .get(asset)
        .set("Accept", asset.endsWith(".css") ? "text/css,*/*;q=0.1" : "application/javascript,*/*;q=0.1")
        .expect(404);
      assert.match(response.headers["content-type"] || "", /^application\/json/);
      assert.deepEqual(response.body, {
        error: { code: "NOT_FOUND", message: "Resource not found." }
      });
    }
  });
});
