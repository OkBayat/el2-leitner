import { ValidationError } from "../../domain/errors.js";
import { CollectionDraft } from "../../domain/library/CollectionDraft.js";
import { cleanVocabularyForms } from "../../domain/library/VocabularyNormalizer.js";

function importMode(value) {
  const mode = String(value || "append").toLowerCase();
  if (!["append", "replace"].includes(mode)) {
    throw new ValidationError("INVALID_IMPORT_MODE", "Import mode must be append or replace.");
  }
  return mode;
}

function assertManageableCollectionDraft(draft) {
  if (draft.kind === "personal") {
    throw new ValidationError("RESERVED_COLLECTION_KIND", "The personal collection kind is reserved for learner-owned vocabulary.");
  }
}

function entryInput(input = {}) {
  const forms = cleanVocabularyForms(input.term, input.acceptedForms);
  const sectionPath = input.sectionPath ? String(input.sectionPath).trim() : null;
  const note = input.note ? String(input.note).trim() : null;
  if (sectionPath) {
    const segments = sectionPath.split("/").map((part) => part.trim()).filter(Boolean);
    if (!segments.length || segments.length > 16 || segments.some((part) => part.length > 255)) {
      throw new ValidationError("INVALID_SECTION_PATH", "Section path is too deep or contains a title longer than 255 characters.");
    }
  }
  if (note && note.length > 10_000) {
    throw new ValidationError("ENTRY_NOTE_TOO_LONG", "Entry note must be at most 10000 characters.");
  }
  return {
    primaryForm: forms[0].form,
    acceptedForms: forms.map(({ form }) => form),
    sectionPath,
    note
  };
}

export class LibraryCommands {
  constructor({ libraryRepository, adminPolicy, vocabularyFileParser }) {
    this.libraryRepository = libraryRepository;
    this.adminPolicy = adminPolicy;
    this.vocabularyFileParser = vocabularyFileParser;
  }

  async subscribe(user, collectionId) {
    return { collection: await this.libraryRepository.subscribe(user.id, collectionId) };
  }

  async unsubscribe(user, collectionId) {
    await this.libraryRepository.unsubscribe(user.id, collectionId);
    return { removed: true };
  }

  async create(user, input) {
    this.adminPolicy.assertCanManage(user);
    const draft = new CollectionDraft(input);
    assertManageableCollectionDraft(draft);
    return { collection: await this.libraryRepository.create(user.id, draft) };
  }

  async update(user, collectionId, input) {
    this.adminPolicy.assertCanManage(user);
    const draft = new CollectionDraft(input);
    assertManageableCollectionDraft(draft);
    return { collection: await this.libraryRepository.update(collectionId, draft) };
  }

  async import(user, collectionId, { text, mode } = {}) {
    this.adminPolicy.assertCanManage(user);
    const parsed = this.vocabularyFileParser.parse(text);
    const persisted = await this.libraryRepository.importEntries(collectionId, parsed, importMode(mode));
    return {
      result: {
        ...persisted,
        sourceItemCount: parsed.sourceItemCount,
        uniqueVocabularyCount: parsed.entries.length,
        duplicatesSkipped: parsed.duplicateCount
      }
    };
  }

  async addEntry(user, collectionId, input) {
    this.adminPolicy.assertCanManage(user);
    return {
      entry: await this.libraryRepository.addEntry(collectionId, entryInput(input))
    };
  }

  async updateEntry(user, collectionId, entryId, input) {
    this.adminPolicy.assertCanManage(user);
    return {
      entry: await this.libraryRepository.updateEntry(collectionId, entryId, entryInput(input))
    };
  }

  async removeEntry(user, collectionId, entryId) {
    this.adminPolicy.assertCanManage(user);
    await this.libraryRepository.removeEntry(collectionId, entryId);
    return { removed: true };
  }
}
