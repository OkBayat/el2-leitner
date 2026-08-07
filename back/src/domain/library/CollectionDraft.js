import { ValidationError } from "../errors.js";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const TOKEN_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/u;
const VISIBILITIES = new Set(["public", "private", "unlisted"]);
const STATUSES = new Set(["draft", "published", "archived"]);

function text(value, maxLength, code, message, { required = true } = {}) {
  const normalized = String(value ?? "").trim();
  if ((required && !normalized) || normalized.length > maxLength) {
    throw new ValidationError(code, message);
  }
  return normalized || null;
}

export class CollectionDraft {
  constructor(input = {}) {
    this.title = text(input.title, 255, "INVALID_COLLECTION_TITLE", "Collection title is required and must be at most 255 characters.");
    this.slug = text(input.slug, 160, "INVALID_COLLECTION_SLUG", "Collection slug is required and must be at most 160 characters.");
    if (!SLUG_PATTERN.test(this.slug)) {
      throw new ValidationError("INVALID_COLLECTION_SLUG", "Collection slug may contain lowercase letters, numbers, and single hyphens only.");
    }
    this.description = text(input.description, 10_000, "INVALID_COLLECTION_DESCRIPTION", "Collection description is too long.", { required: false });
    this.kind = String(input.kind || "collection").trim().toLowerCase();
    if (!TOKEN_PATTERN.test(this.kind)) {
      throw new ValidationError("INVALID_COLLECTION_KIND", "Collection kind is invalid.");
    }
    this.visibility = String(input.visibility || "public").trim().toLowerCase();
    if (!VISIBILITIES.has(this.visibility)) {
      throw new ValidationError("INVALID_COLLECTION_VISIBILITY", "Collection visibility is invalid.");
    }
    this.status = String(input.status || "draft").trim().toLowerCase();
    if (!STATUSES.has(this.status)) {
      throw new ValidationError("INVALID_COLLECTION_STATUS", "Collection status is invalid.");
    }
    this.metadataProvided = Object.prototype.hasOwnProperty.call(input, "metadata");
    if (this.metadataProvided && (input.metadata === null || typeof input.metadata !== "object" || Array.isArray(input.metadata))) {
      throw new ValidationError("INVALID_COLLECTION_METADATA", "Collection metadata must be an object.");
    }
    this.metadata = this.metadataProvided ? structuredClone(input.metadata) : {};
  }
}
