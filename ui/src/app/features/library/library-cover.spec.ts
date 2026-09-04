import {describe, expect, it} from 'vitest';
import {libraryCoverAssetPath} from './library-cover';

describe('library cover presentation', () => {
  it('derives one stable WebP asset name from the unique collection slug', () => {
    expect(libraryCoverAssetPath('business-vocabulary-in-use-elementary'))
      .toBe('assets/library/covers/business-vocabulary-in-use-elementary.webp');
  });

  it('escapes unsafe slug characters instead of allowing asset-path traversal', () => {
    expect(libraryCoverAssetPath('../private cover'))
      .toBe('assets/library/covers/..%2Fprivate%20cover.webp');
  });
});
