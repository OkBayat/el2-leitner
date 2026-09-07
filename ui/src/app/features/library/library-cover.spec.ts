import {describe, expect, it} from 'vitest';
import {libraryCoverAssetPath, libraryCoverFilePath} from './library-cover';

describe('library cover presentation', () => {
  it('does not request an optional cover that is not bundled', () => {
    expect(libraryCoverAssetPath('business-vocabulary-in-use-elementary'))
      .toMatch(/^data:image\/svg\+xml,/u);
  });

  it('derives one stable WebP asset name from the unique collection slug', () => {
    expect(libraryCoverFilePath('business-vocabulary-in-use-elementary'))
      .toBe('assets/library/covers/business-vocabulary-in-use-elementary.webp');
  });

  it('escapes unsafe slug characters instead of allowing asset-path traversal', () => {
    expect(libraryCoverFilePath('../private cover'))
      .toBe('assets/library/covers/..%2Fprivate%20cover.webp');
  });
});
