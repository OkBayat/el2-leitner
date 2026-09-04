const LIBRARY_COVER_DIRECTORY = 'assets/library/covers';

export function libraryCoverAssetPath(slug: string): string {
  return `${LIBRARY_COVER_DIRECTORY}/${encodeURIComponent(slug)}.webp`;
}
