const LIBRARY_COVER_DIRECTORY = 'assets/library/covers';

export function libraryCoverAssetPath(slug: string): string {
  return `${LIBRARY_COVER_DIRECTORY}/${encodeURIComponent(slug)}.webp`;
}

export function libraryCoverMonogram(title: string): string {
  const words = title.trim().split(/\s+/u).filter(Boolean);
  if (words.length === 0) return 'V';
  if (words.length === 1) return Array.from(words[0]).slice(0, 2).join('').toUpperCase();
  return `${Array.from(words[0])[0] || ''}${Array.from(words[1])[0] || ''}`.toUpperCase();
}
