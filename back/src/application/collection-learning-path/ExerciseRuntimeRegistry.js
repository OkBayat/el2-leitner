import { ConflictError } from "../../domain/errors.js";

function entries(value) {
  if (value instanceof Map) return [...value.entries()];
  return Object.entries(value ?? {});
}

export class ExerciseRuntimeRegistry {
  constructor({ contextHydrators = {}, completionPolicies = {} } = {}) {
    this.contextHydrators = new Map(entries(contextHydrators));
    this.completionPolicies = new Map(entries(completionPolicies));
  }

  async hydrate(context) {
    const hydrator = this.contextHydrators.get(context.exercise.type);
    return hydrator ? hydrator(context) : null;
  }

  async verifyCompletion(context) {
    const verifier = this.completionPolicies.get(context.exercise.completionPolicy);
    if (!verifier) {
      throw new ConflictError(
        "LEARNING_PATH_COMPLETION_POLICY_UNAVAILABLE",
        "This exercise cannot be completed until its server-side completion policy is available.",
      );
    }
    const evidence = await verifier(context);
    if (evidence === false || evidence == null) {
      throw new ConflictError(
        "LEARNING_PATH_COMPLETION_EVIDENCE_REQUIRED",
        "Server-verifiable completion evidence is required for this exercise.",
      );
    }
    return {
      evidenceType: evidence.evidenceType ?? null,
      evidenceRef: evidence.evidenceRef ?? null,
    };
  }
}

export function createDefaultExerciseRuntimeRegistry({
  contextHydrators = {},
  completionPolicies = {},
} = {}) {
  return new ExerciseRuntimeRegistry({
    contextHydrators,
    completionPolicies: new Map([
      ["explicit", async () => ({ evidenceType: null, evidenceRef: null })],
      ...entries(completionPolicies),
    ]),
  });
}
