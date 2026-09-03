export function normalizeListeningAnswer(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[‘’]/gu, "'")
    .replace(/[‐‑‒–—―]/gu, "-")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("en");
}
