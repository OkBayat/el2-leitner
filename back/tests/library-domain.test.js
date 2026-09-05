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

const validSource = `
# American English File 3

## 1A — Eating in and out

- centre / center
  - definition: The middle part of something.
  - example: We met in the centre of town.

- gap year
  - definition: A year away from school before more study.
  - example: She took a gap year before college.

## 1B — Modern families

- sibling
  - definition: A brother or sister.
  - example: I have one sibling.
`;

describe("library domain", () => {
  it("normalizes equivalent spelling forms consistently", () => {
    assert.equal(normalizeVocabularyForm("  Interest–Free   Credit "), "interest-free credit");
    assert.equal(normalizeVocabularyForm("CENTRE"), "centre");
  });

  it("parses book, lesson, accepted spellings, definitions, and examples", () => {
    const parsed = new VocabularyFileParser().parse(validSource);
    assert.equal(parsed.title, "American English File 3");
    assert.deepEqual(parsed.sections.map((section) => section.path), [
      "1A — Eating in and out",
      "1B — Modern families"
    ]);
    assert.deepEqual(parsed.entries[0], {
      sourceNumber: 1,
      position: 1,
      primaryForm: "centre",
      acceptedForms: ["centre", "center"],
      sectionPath: "1A — Eating in and out",
      definitions: ["The middle part of something."],
      examples: ["We met in the centre of town."]
    });
    assert.equal(parsed.entries[2].sectionPath, "1B — Modern families");
  });

  it("supports more than one definition and example for one vocabulary item", () => {
    const parsed = new VocabularyFileParser().parse(`
# Example
## Lesson 1
- charge
  - definition: To ask someone to pay money.
  - definition: The amount of money you must pay.
  - example: They charge ten dollars for delivery.
  - example: There is no extra charge.
`);
    assert.deepEqual(parsed.entries[0].definitions, [
      "To ask someone to pay money.",
      "The amount of money you must pay."
    ]);
    assert.deepEqual(parsed.entries[0].examples, [
      "They charge ten dollars for delivery.",
      "There is no extra charge."
    ]);
  });

  it("allows a vocabulary item without an example but still requires a definition", () => {
    const parsed = new VocabularyFileParser().parse(`
# Example
## Lesson 1
- Monday
  - definition: The day after Sunday.
`);
    assert.deepEqual(parsed.entries[0].examples, []);
    assert.throws(
      () => new VocabularyFileParser().parse("# Example\n## Lesson 1\n- Monday\n  - example: I will call you on Monday."),
      { code: "INVALID_COLLECTION_SOURCE", statusCode: 400 }
    );
  });

  it("rejects duplicate vocabulary identities instead of silently losing lesson content", () => {
    assert.throws(
      () => new VocabularyFileParser().parse(`
# Example
## Lesson 1
- centre / center
  - definition: The middle part of something.
  - example: We met in the centre.
## Lesson 2
- center
  - definition: The middle part of something.
  - example: Stand in the center.
`),
      { code: "INVALID_COLLECTION_SOURCE", statusCode: 400 }
    );
  });

  it("distinguishes absent collection metadata from an explicit metadata update", () => {
    const untouched = new CollectionDraft({ title: "AEF 3", slug: "aef-3", kind: "book", visibility: "public", status: "published" });
    assert.equal(untouched.metadataProvided, false);
    const supplied = new CollectionDraft({ title: "AEF 3", slug: "aef-3", metadata: { edition: 3 } });
    assert.equal(supplied.metadataProvided, true);
    assert.deepEqual(supplied.metadata, { edition: 3 });
  });

  it("rejects overlong imported lesson titles before persistence", () => {
    assert.throws(
      () => new VocabularyFileParser().parse(`# Example\n## ${"x".repeat(256)}\n- Monday\n  - definition: The day after Sunday.\n  - example: I work on Monday.`),
      { code: "INVALID_COLLECTION_SOURCE", statusCode: 400 }
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
        { text: validSource, mode: "append" }
      ),
      { code: "LIBRARY_MANAGEMENT_FORBIDDEN", statusCode: 403 }
    );

    const result = await commands.import(
      { id: "2", email: "OWNER@example.com" },
      "book",
      { text: validSource, mode: "replace" }
    );
    assert.equal(result.result.added, 3);
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
