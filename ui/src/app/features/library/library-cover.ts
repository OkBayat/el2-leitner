const LIBRARY_COVER_DIRECTORY = 'assets/library/covers';
const EMPTY_LIBRARY_COVER = 'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22/%3E';

// Keep this list in sync with ui/assets/library/covers/*.webp.
// Missing/optional covers must never be requested from the browser because each
// failed lazy-loaded image would otherwise add another 404 while scrolling.
const BUNDLED_LIBRARY_COVER_SLUGS = new Set<string>([]);

export function libraryCoverFilePath(slug: string): string {
  return `${LIBRARY_COVER_DIRECTORY}/${encodeURIComponent(slug)}.webp`;
}

export function libraryCoverAssetPath(slug: string): string {
  return BUNDLED_LIBRARY_COVER_SLUGS.has(slug)
    ? libraryCoverFilePath(slug)
    : EMPTY_LIBRARY_COVER;
}
