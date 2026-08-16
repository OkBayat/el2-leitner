import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";

import { createTestContext } from "./helpers/fakes.js";

describe("origin timing observability", () => {
  it("reports Vocora origin duration and received request bytes independently of the CDN", async () => {
    const { app } = createTestContext();

    const health = await request(app).get("/api/health").expect(200);
    assert.match(health.headers["server-timing"], /(?:^|,\s*)vocora;dur=\d+(?:\.\d+)?/u);
    assert.match(health.headers["x-vocora-origin-ms"], /^\d+(?:\.\d+)?$/u);
    assert.equal(health.headers["x-vocora-request-bytes"], "0");

    const unknown = await request(app)
      .post("/api/does-not-exist")
      .send({ probe: true })
      .expect(404);
    assert.ok(Number(unknown.headers["x-vocora-request-bytes"]) > 0);
    assert.match(unknown.headers["server-timing"], /(?:^|,\s*)vocora;dur=\d+(?:\.\d+)?/u);
  });
});
