import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import request from "supertest";
import { createTestContext } from "./helpers/fakes.js";

describe("HTTP API", () => {
  it("reports service health without authentication", async () => {
    const { app } = createTestContext();
    const response = await request(app).get("/api/health").expect(200, { status: "ok" });
    assert.doesNotMatch(
      response.headers["content-security-policy"],
      /upgrade-insecure-requests/
    );
  });

  it("prevents stale frontend releases from mixing HTML, CSS, and JavaScript", async () => {
    const staticDirectory = fileURLToPath(new URL("../../ui", import.meta.url));
    const { app } = createTestContext({}, { staticDirectory });

    const html = await request(app).get("/").expect(200);
    assert.match(html.headers["cache-control"], /no-store/);
    assert.equal(html.headers["cdn-cache-control"], "no-store");

    const stylesheet = await request(app).get("/styles-v2.css").expect(200);
    assert.match(stylesheet.headers["cache-control"], /no-store/);
    assert.equal(stylesheet.headers["cdn-cache-control"], "no-store");
    assert.equal(stylesheet.headers["surrogate-control"], "no-store");
    assert.match(stylesheet.headers["content-type"], /^text\/css/);

    const script = await request(app).get("/app-v2.js").expect(200);
    assert.match(script.headers["cache-control"], /no-store/);
    assert.equal(script.headers["cdn-cache-control"], "no-store");
    assert.equal(script.headers["surrogate-control"], "no-store");
    assert.match(script.headers["content-type"], /javascript/);

    const logo = await request(app).get("/assets/vocora-logo.png").expect(200);
    assert.match(logo.headers["content-type"], /^image\/png/);

    const icon = await request(app).get("/assets/vocora-icon.png").expect(200);
    assert.match(icon.headers["content-type"], /^image\/png/);

    const missingStylesheet = await request(app)
      .get("/definitely-missing.css")
      .set("Accept", "text/css,*/*;q=0.1")
      .expect(404);
    assert.match(missingStylesheet.headers["content-type"], /^application\/json/);
    assert.deepEqual(missingStylesheet.body, {
      error: { code: "NOT_FOUND", message: "Resource not found." }
    });
    assert.doesNotMatch(missingStylesheet.text, /<!doctype html>/iu);
  });

  it("registers, authenticates, reports the user, and logs out", async () => {
    const { app } = createTestContext();
    const agent = request.agent(app);

    const registration = await agent
      .post("/api/auth/register")
      .send({ email: " Learner@Example.com ", password: "password123" })
      .expect(201);

    assert.deepEqual(registration.body, {
      user: { id: "1", email: "learner@example.com" }
    });
    assert.equal(registration.headers["cache-control"], "no-store");
    assert.match(registration.headers["set-cookie"][0], /HttpOnly/);
    assert.match(registration.headers["set-cookie"][0], /SameSite=Lax/);

    await agent.get("/api/auth/me").expect(200, registration.body);
    await agent.post("/api/auth/logout").expect(204);
    await agent.get("/api/auth/me").expect(401, {
      error: { code: "AUTHENTICATION_REQUIRED", message: "Authentication is required." }
    });

    const login = await agent
      .post("/api/auth/login")
      .send({ email: "learner@example.com", password: "password123" })
      .expect(200);
    assert.deepEqual(login.body, registration.body);
  });

  it("rejects duplicates and incorrect credentials with the canonical error shape", async () => {
    const { app } = createTestContext();
    const agent = request.agent(app);

    await agent
      .post("/api/auth/register")
      .send({ email: "learner@example.com", password: "password123" })
      .expect(201);

    await request(app)
      .post("/api/auth/register")
      .send({ email: "LEARNER@EXAMPLE.COM", password: "password123" })
      .expect(409, {
        error: {
          code: "EMAIL_ALREADY_REGISTERED",
          message: "This email is already registered."
        }
      });

    await request(app)
      .post("/api/auth/login")
      .send({ email: "learner@example.com", password: "wrong-password" })
      .expect(401, {
        error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect." }
      });
  });

  it("keeps each authenticated learner state isolated", async () => {
    const { app } = createTestContext();
    const first = request.agent(app);
    const second = request.agent(app);

    await first
      .post("/api/auth/register")
      .send({ email: "first@example.com", password: "password123" })
      .expect(201);
    await second
      .post("/api/auth/register")
      .send({ email: "second@example.com", password: "password123" })
      .expect(201);

    await first.get("/api/state").expect(200, { state: null, revision: 0 });
    await second.get("/api/state").expect(200, { state: null, revision: 0 });

    await first
      .put("/api/state")
      .send({ state: { words: [{ id: "first" }] }, revision: 0 })
      .expect(200, { revision: 1 });
    await second
      .put("/api/state")
      .send({ state: { words: [{ id: "second" }] }, revision: 0 })
      .expect(200, { revision: 1 });

    const firstState = await first.get("/api/state").expect(200);
    const secondState = await second.get("/api/state").expect(200);
    assert.deepEqual(firstState.body, { state: { words: [{ id: "first" }] }, revision: 1 });
    assert.deepEqual(secondState.body, { state: { words: [{ id: "second" }] }, revision: 1 });
  });

  it("requires authentication and validates the state envelope", async () => {
    const { app } = createTestContext();
    const agent = request.agent(app);

    await request(app).get("/api/state").expect(401, {
      error: { code: "AUTHENTICATION_REQUIRED", message: "Authentication is required." }
    });
    await request(app).put("/api/state").send({ state: {} }).expect(401);

    await agent
      .post("/api/auth/register")
      .send({ email: "learner@example.com", password: "password123" })
      .expect(201);

    await agent.put("/api/state").send({ state: {} }).expect(400, {
      error: { code: "INVALID_REVISION", message: "Revision must be a non-negative safe integer." }
    });
    await agent.put("/api/state").send({ state: [], revision: 0 }).expect(400, {
      error: { code: "INVALID_STATE", message: "State must be a JSON object." }
    });
  });

  it("rate limits repeated authentication attempts with the canonical error shape", async () => {
    const { app } = createTestContext({}, { authRateLimit: { windowMs: 60_000, max: 2 } });

    await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "wrong-password" })
      .expect(401);
    await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "wrong-password" })
      .expect(401);
    await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "wrong-password" })
      .expect(429, {
        error: { code: "AUTH_RATE_LIMITED", message: "Too many authentication attempts. Try again later." }
      });
  });

  it("returns structured errors for malformed JSON and unknown API paths", async () => {
    const { app } = createTestContext();

    await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email":')
      .expect(400, {
        error: { code: "INVALID_JSON", message: "Request body must be valid JSON." }
      });

    await request(app).get("/api/does-not-exist").expect(404, {
      error: { code: "NOT_FOUND", message: "API endpoint not found." }
    });
  });
});
