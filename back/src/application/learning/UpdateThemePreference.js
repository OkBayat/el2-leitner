import { ConflictError, ValidationError } from "../../domain/errors.js";

const THEME_MODES = new Set(["system", "light", "dark"]);

export class UpdateThemePreference {
  constructor({ learningStateRepository }) {
    this.learningStateRepository = learningStateRepository;
  }

  async execute(userId, input = {}) {
    const theme = input?.theme;
    const expectedRevision = input?.revision;

    if (!THEME_MODES.has(theme)) {
      throw new ValidationError(
        "INVALID_THEME",
        "Theme must be one of: system, light, dark."
      );
    }
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
      throw new ValidationError(
        "INVALID_REVISION",
        "Revision must be a non-negative safe integer."
      );
    }

    const current = await this.learningStateRepository.findByUserId(userId);
    if (!current.state || current.revision !== expectedRevision) {
      throw new ConflictError(
        "STATE_CONFLICT",
        "Learning state was updated by another session. Reload and try again."
      );
    }

    const state = structuredClone(current.state);
    state.settings = { ...(state.settings || {}), theme };
    state.updatedAt = new Date().toISOString();

    const revision = await this.learningStateRepository.save(
      userId,
      state,
      expectedRevision
    );

    return { theme, revision };
  }
}
