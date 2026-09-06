import { ValidationError } from "../errors.js";

export const SHADOWING_EXERCISE_TYPE = "speaking.shadowing";
export const SHADOWING_COMPLETION_POLICY = "shadowing-completed-session";

export function resolveShadowingExerciseDefinition(exercise) {
  if (!exercise || exercise.type !== SHADOWING_EXERCISE_TYPE || Number(exercise.schemaVersion) !== 1 || exercise.completionPolicy !== SHADOWING_COMPLETION_POLICY) {
    throw new ValidationError(
      "INVALID_SHADOWING_EXERCISE_DEFINITION",
      "Shadowing exercises must use speaking.shadowing schema v1 and server-verified Shadowing completion.",
    );
  }
  return { type: SHADOWING_EXERCISE_TYPE, schemaVersion: 1 };
}
