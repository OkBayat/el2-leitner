function categoryParts(category) {
  return String(category || "")
    .split(" / ")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function genericSourceTemplates(category) {
  const root = categoryParts(category)[0] ?? "";
  if (/^(unit\s+\d+|file\s+\d+)/iu.test(root)) {
    throw new Error(
      "Generic sentence generation for imported vocabulary books is disabled; use the curated sentence catalog instead."
    );
  }
  return null;
}
