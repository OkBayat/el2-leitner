import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { LibraryCommands } from "../src/application/library/LibraryCommands.js";
import { LibraryAdminPolicy } from "../src/domain/library/LibraryAdminPolicy.js";
import { CollectionDraft } from "../src/domain/library/CollectionDraft.js";
import { VocabularyFileParser } from "../src/domain/library/VocabularyFileParser.js";
import { normalizeVocabularyForm } from "../src/domain/library/VocabularyNormalizer.js";

class RecordingLibraryRepository {
  constructor() {
    this.calls = [];
  }

  async importEntries(collectionId, parsed, mode) {
    this.calls.push({ operation: "import", collectionId, parsed, mode });
    return { added: parsed.entries.length, updated: 0, removed: 0, version: 2 };
  }

  async subscribe(userId, collectionId) {
    this.calls.push({ operation: "subscribe", userId, collectionId });
    return { id: collectionId, subscribed: true };
  }
}

describe("library domain", () => {
  it("normalizes equivalent spelling forms consistently", () => {
    assert.equal(normalizeVocabularyForm("  Interest–Free   Credit "), "interest-free credit");
    assert.equal(normalizeVocabularyForm("CENTRE"), "centre");
  });

  it("parses hierarchical markdown sections and accepted spellings", () => {
    const parsed = new VocabularyFileParser().parse(`
## Unit 1
### Lesson A
1. centre / center
2. gap year
### Lesson B
3. cheque / check
`);
    assert.deepEqual(parsed.sections.map((section) => section.path), [
      "Unit 1",
      "Unit 1 / Lesson A",
      "Unit 1 / Lesson B"
    ]);
    assert.deepEqual(parsed.entries[0], {
      sourceNumber: 1,
      position: 1,
      primaryForm: "centre",
      acceptedForms: ["centre", "center"],
      sectionPath: "Unit 1 / Lesson A"
    });
    assert.equal(parsed.entries[2].sectionPath, "Unit 1 / Lesson B");
  });

  it("deduplicates aliases that point at the same vocabulary identity", () => {
    const parsed = new VocabularyFileParser().parse("## Spelling\n1. centre / center\n2. center\n3. colour / color");
    assert.deepEqual(parsed.entries.map((entry) => entry.primaryForm), ["centre", "colour"]);
  });
  it("deduplicates repeated primary forms inside one import", () => {
    const parsed = new VocabularyFileParser().parse("1. Monday\n2. monday\n3. Tuesday");
    assert.deepEqual(parsed.entries.map((entry) => entry.primaryForm), ["Monday", "Tuesday"]);
  });

  it("distinguishes absent collection metadata from an explicit metadata update", () => {
    const untouched = new CollectionDraft({ title: "AEF 3", slug: "aef-3", kind: "book", visibility: "public", status: "published" });
    assert.equal(untouched.metadataProvided, false);
    const supplied = new CollectionDraft({ title: "AEF 3", slug: "aef-3", metadata: { edition: 3 } });
    assert.equal(supplied.metadataProvided, true);
    assert.deepEqual(supplied.metadata, { edition: 3 });
  });
  it("rejects overlong imported section titles before persistence", () => {
    assert.throws(
      () => new VocabularyFileParser().parse(`## ${"x".repeat(256)}\n1. Monday`),
      { code: "SECTION_TITLE_TOO_LONG", statusCode: 400 }
    );
  });

  it("keeps public collection mutation behind the configured admin policy", async () => {
    const repository = new RecordingLibraryRepository();
    const commands = new LibraryCommands({
      libraryRepository: repository,
      adminPolicy: new LibraryAdminPolicy(["owner@example.com"]),
      vocabularyFileParser: new VocabularyFileParser()
    });

    await assert.rejects(
      commands.import(
        { id: "1", email: "learner@example.com" },
        "book",
        { text: "1. Monday", mode: "append" }
      ),
      { code: "LIBRARY_MANAGEMENT_FORBIDDEN", statusCode: 403 }
    );

    const result = await commands.import(
      { id: "2", email: "OWNER@example.com" },
      "book",
      { text: "1. Monday\n2. Tuesday", mode: "replace" }
    );
    assert.equal(result.result.added, 2);
    assert.equal(repository.calls[0].mode, "replace");
  });

  it("reserves personal collections for the learning-state adapter", async () => {
    const commands = new LibraryCommands({
      libraryRepository: new RecordingLibraryRepository(),
      adminPolicy: new LibraryAdminPolicy(["owner@example.com"]),
      vocabularyFileParser: new VocabularyFileParser()
    });
    await assert.rejects(
      commands.create(
        { id: "2", email: "owner@example.com" },
        { title: "Personal", slug: "personal", kind: "personal", visibility: "private", status: "published" }
      ),
      { code: "RESERVED_COLLECTION_KIND", statusCode: 400 }
    );
  });

  it("allows every authenticated learner to subscribe without management permission", async () => {
    const repository = new RecordingLibraryRepository();
    const commands = new LibraryCommands({
      libraryRepository: repository,
      adminPolicy: new LibraryAdminPolicy([]),
      vocabularyFileParser: new VocabularyFileParser()
    });
    const result = await commands.subscribe({ id: "9", email: "learner@example.com" }, "aef3");
    assert.equal(result.collection.subscribed, true);
    assert.deepEqual(repository.calls[0], { operation: "subscribe", userId: "9", collectionId: "aef3" });
  });
});
