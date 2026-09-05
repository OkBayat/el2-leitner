import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";
import { createTestContext } from "./helpers/fakes.js";

async function register(agent, email = "learner@example.com") {
  await agent.post("/api/auth/register").send({ email, password: "password123" }).expect(201);
}

describe("library API", () => {
  it("lists the built-in collection and lets a learner subscribe", async () => {
    const { app } = createTestContext();
    const agent = request.agent(app);
    await register(agent);

    const library = await agent.get("/api/library").expect(200);
    assert.equal(library.body.collections[0].id, "ielts-listening-core-1500");
    assert.equal(library.body.capabilities.canManage, false);

    await agent.post("/api/library/ielts-listening-core-1500/subscription").expect(200);
    const detail = await agent.get("/api/library/ielts-listening-core-1500").expect(200);
    assert.equal(detail.body.collection.subscribed, true);
  });

  it("allows only configured admins to create and import public collections", async () => {
    const { app } = createTestContext({ LIBRARY_ADMIN_EMAILS: "owner@example.com" });
    const learner = request.agent(app);
    const owner = request.agent(app);
    await register(learner, "learner@example.com");
    await register(owner, "owner@example.com");

    await learner.post("/api/library").send({
      title: "AEF 3",
      slug: "american-english-file-3",
      kind: "book",
      visibility: "public",
      status: "published"
    }).expect(403);

    await owner.post("/api/library").send({
      title: "American English File 3",
      slug: "american-english-file-3",
      description: "Course book vocabulary",
      kind: "book",
      visibility: "public",
      status: "published"
    }).expect(201);

    const imported = await owner
      .post("/api/library/american-english-file-3/import")
      .send({
        text: `# American English File 3
## Unit 1
- crowded
  - definition: Full of many people.
  - example: The bus was crowded this morning.
- centre / center
  - definition: The middle part of something.
  - example: We met in the centre of town.`,
        mode: "replace"
      })
      .expect(200);
    assert.equal(imported.body.result.found, 2);
  });

  it("persists explicit practice-session lifecycle through dedicated commands", async () => {
    const { app } = createTestContext();
    const agent = request.agent(app);
    await register(agent);

    const started = await agent.post("/api/learning/sessions").send({ mode: "review", plannedCount: 3 }).expect(201);
    const id = started.body.session.id;
    const completed = await agent.put(`/api/learning/sessions/${id}/complete`).send({
      completedCount: 3,
      correctCount: 2,
      wrongCount: 1,
      durationSeconds: 90
    }).expect(200);
    assert.equal(completed.body.session.status, "completed");
  });
});
