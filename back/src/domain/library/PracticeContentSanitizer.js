export function stripExclamationMarks(value) {
  return String(value ?? "").replaceAll("!", "");
}
