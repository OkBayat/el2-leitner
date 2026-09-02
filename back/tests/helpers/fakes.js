import { loadConfig } from "../../src/config/loadConfig.js";
import { createContainer } from "../../src/container.js";
import { createApp } from "../../src/createApp.js";
import { ConflictError, NotFoundError } from "../../src/domain/errors.js";
import { User } from "../../src/domain/user/User.js";

export class InMemoryUserRepository {
  constructor() {
    this.users = new Map();
    this.nextId = 1;
  }

  async findByEmail(email) {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }

  async findById(id) {
    return this.users.get(String(id)) ?? null;
  }

  async create({ email, passwordHash }) {
    if ([...this.users.values()].some((user) => user.email === email)) {
      throw new ConflictError("EMAIL_ALREADY_REGISTERED", "This email is already registered.");
    }
    const user = new User({ id: this.nextId++, email, passwordHash });
    this.users.set(user.id, user);
    return user;
  }
}

export class InMemoryLearningStateRepository {
  constructor() {
    this.states = new Map();
  }

  async findByUserId(userId) {
    const record = this.states.get(String(userId));
    return record === undefined ? { state: null, revision: 0 } : structuredClone(record);
  }

  async save(userId, state, expectedRevision) {
    const key = String(userId);
    const current = this.states.get(key);
    const currentRevision = current?.revision ?? 0;
    if (currentRevision !== expectedRevision) {
      throw new ConflictError(
        "STATE_CONFLICT",
        "Learning state was updated by another session. Reload and try again."
      );
    }
    const revision = expectedRevision + 1;
    this.states.set(key, { state: structuredClone(state), revision });
    return revision;
  }

  async updateVocabulary(userId, word, expectedRevision) {
    const key = String(userId);
    const current = this.states.get(key);
    const currentRevision = current?.revision ?? 0;
    if (currentRevision !== expectedRevision) {
      throw new ConflictError(
        "STATE_CONFLICT",
        "Learning state was updated by another session. Reload and try again."
      );
    }
    const state = structuredClone(current?.state);
    const target = state?.words?.find((item) => String(item.id) === String(word.id));
    if (!target) throw new NotFoundError("VOCABULARY_NOT_FOUND", "Vocabulary was not found for this learner.");
    target.term = word.term;
    target.accepted = [...word.accepted];
    target.category = word.category;
    target.notes = word.notes;
    state.updatedAt = new Date().toISOString();
    const revision = expectedRevision + 1;
    this.states.set(key, { state, revision });
    return revision;
  }
}

export class InMemoryLibraryRepository {
  constructor() {
    this.collections = new Map([
      ["ielts-listening-core-1500", {
        id: "ielts-listening-core-1500",
        slug: "ielts-listening-core-1500",
        title: "1500 IELTS Listening Words",
        description: "IELTS",
        kind: "exam",
        visibility: "public",
        status: "published",
        contentVersion: 1,
        metadata: {},
        isDefault: true,
        wordCount: 1500,
        subscribed: false,
        lastSeenVersion: 0,
        entries: [],
        sections: []
      }]
    ]);
  }

  async listForUser() {
    return [...this.collections.values()].map((collection) => structuredClone(collection));
  }

  async getForUser(id) {
    const collection = this.collections.get(id);
    if (!collection) throw new NotFoundError("COLLECTION_NOT_FOUND", "Collection was not found.");
    return structuredClone(collection);
  }

  async getVocabularySources() {
    return [];
  }

  async subscribe(_userId, id) {
    const collection = this.collections.get(id);
    if (!collection) throw new NotFoundError("COLLECTION_NOT_FOUND", "Collection was not found.");
    collection.subscribed = true;
    return { id, title: collection.title, subscribed: true, contentVersion: collection.contentVersion };
  }

  async unsubscribe(_userId, id) {
    const collection = this.collections.get(id);
    if (!collection) throw new NotFoundError("COLLECTION_NOT_FOUND", "Collection was not found.");
    collection.subscribed = false;
  }

  async create(_userId, draft) {
    const collection = {
      id: draft.slug,
      slug: draft.slug,
      title: draft.title,
      description: draft.description,
      kind: draft.kind,
      visibility: draft.visibility,
      status: draft.status,
      contentVersion: 1,
      metadata: draft.metadata,
      isDefault: false,
      wordCount: 0,
      subscribed: false,
      lastSeenVersion: 0,
      entries: [],
      sections: []
    };
    this.collections.set(collection.id, collection);
    return structuredClone(collection);
  }

  async update(id, draft) {
    const current = this.collections.get(id);
    if (!current) throw new NotFoundError("COLLECTION_NOT_FOUND", "Collection was not found.");
    Object.assign(current, draft);
    return structuredClone(current);
  }

  async importEntries(id, parsed) {
    const current = this.collections.get(id);
    if (!current) throw new NotFoundError("COLLECTION_NOT_FOUND", "Collection was not found.");
    current.wordCount = parsed.entries.length;
    current.contentVersion += 1;
    return { version: current.contentVersion, found: parsed.entries.length, added: parsed.entries.length, updated: 0, removed: 0 };
  }

  async addEntry(id, input) {
    return { id: `entry-${Date.now()}`, term: input.primaryForm, acceptedForms: input.acceptedForms, sectionPath: input.sectionPath };
  }

  async updateEntry(_id, entryId, input) {
    return { id: entryId, term: input.primaryForm, acceptedForms: input.acceptedForms, sectionPath: input.sectionPath };
  }

  async removeEntry() {}
}

export class InMemoryPracticeSessionRepository {
  constructor() {
    this.sessions = new Map();
    this.nextId = 1;
  }
  async start(userId, input) {
    const session = { id: `session-${this.nextId++}`, userId: String(userId), status: "active", ...input };
    this.sessions.set(session.id, session);
    return structuredClone(session);
  }
  async complete(userId, id, input) {
    const session = this.sessions.get(id);
    if (!session || session.userId !== String(userId)) throw new NotFoundError("PRACTICE_SESSION_NOT_FOUND", "Practice session was not found.");
    Object.assign(session, input, { status: "completed" });
    return structuredClone(session);
  }
  async abandon(userId, id, input) {
    const session = this.sessions.get(id);
    if (!session || session.userId !== String(userId)) throw new NotFoundError("PRACTICE_SESSION_NOT_FOUND", "Practice session was not found.");
    Object.assign(session, input, { status: "abandoned" });
    return structuredClone(session);
  }
}

export class FakePasswordHasher {
  async hash(password) {
    return `hashed:${password}`;
  }

  async compare(password, passwordHash) {
    return passwordHash === `hashed:${password}`;
  }
}

export function createTestContext(environmentOverrides = {}, appOverrides = {}) {
  const config = loadConfig({
    NODE_ENV: "test",
    JWT_SECRET: "test-secret-at-least-thirty-two-characters",
    AUTH_COOKIE_NAME: "test_session",
    COOKIE_SECURE: "false",
    ...environmentOverrides
  });
  const userRepository = new InMemoryUserRepository();
  const learningStateRepository = new InMemoryLearningStateRepository();
  const libraryRepository = new InMemoryLibraryRepository();
  const practiceSessionRepository = new InMemoryPracticeSessionRepository();
  const container = createContainer({
    config,
    adapters: {
      userRepository,
      learningStateRepository,
      libraryRepository,
      practiceSessionRepository,
      passwordHasher: new FakePasswordHasher()
    }
  });
  const app = createApp({
    container,
    staticDirectory: false,
    nodeEnv: "test",
    logger: { error() {} },
    ...appOverrides
  });

  return {
    app,
    config,
    container,
    userRepository,
    learningStateRepository,
    libraryRepository,
    practiceSessionRepository
  };
}
