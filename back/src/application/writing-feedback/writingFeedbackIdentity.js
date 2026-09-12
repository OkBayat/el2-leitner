/** JSON object order is not preserved by the database; identity ignores key order. */
export function canonicalWritingFeedbackJson(value) {
  if (Array.isArray(value)) return value.map(canonicalWritingFeedbackJson);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalWritingFeedbackJson(value[key])]));
  return value;
}

export const writingFeedbackProfileKey = (profile) => JSON.stringify(canonicalWritingFeedbackJson(profile ?? null));
