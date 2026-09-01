import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import request from "supertest";

import { createTestContext } from "./helpers/fakes.js";

describe("Angular SPA fallback", () => {
  it("serves the Angular source shell for HTML deep links without weakening API or asset 404s", async () => {
    const staticDirectory = fileURLToPath(new URL("../../ui", import.meta.url));
    const { app } = createTestContext({}, { staticDirectory });

    const navigation = await request(app)
      .get("/review")
      .set("Accept", "text/html")
      .expect(200);
    assert.match(navigation.text, /<app-root><\/app-root>/u);
    assert.match(navigation.headers["cache-control"] || "", /no-store/u);

    await request(app)
      .get("/api/not-a-real-endpoint")
      .set("Accept", "text/html")
      .expect(404)
      .expect(({ body }) => assert.equal(body.error.code, "NOT_FOUND"));

    await request(app)
      .get("/missing-runtime.js")
      .set("Accept", "application/javascript,*/*;q=0.1")
      .expect(404)
      .expect(({ body }) => assert.equal(body.error.code, "NOT_FOUND"));
  });
});
