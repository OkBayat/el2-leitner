# Library collection covers

Library cards can show one optional cover image per collection using the collection's unique, stable `slug`.

## File naming

```text
ui/assets/library/covers/<collection.slug>.webp
```

For example, a collection with the slug `business-vocabulary-in-use-elementary` uses:

```text
ui/assets/library/covers/business-vocabulary-in-use-elementary.webp
```

The slug is used instead of the display title so renaming the title does not unexpectedly change the asset contract.

## Registering bundled covers

Missing covers are intentionally not requested by the browser. This prevents optional images from producing one 404 per card as lazy-loaded Library cards enter the viewport.

When a real `.webp` cover is added to this directory, add its collection slug to `BUNDLED_LIBRARY_COVER_SLUGS` in:

```text
ui/src/app/features/library/library-cover.ts
```

Collections that are not registered use the CSS-designed fallback without making an image request to a missing static asset.

## Image guidance

- Format: WebP
- Recommended aspect ratio: 16:9
- Recommended size: 1200 × 675 or larger
- Keep important content away from the outer edges because the image uses `object-fit: cover`.
