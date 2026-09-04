# Library collection covers

Library cards look for one optional cover image per collection using the collection's unique, stable `slug`.

## File naming

```text
ui/assets/library/covers/<collection.slug>.webp
```

For example, a collection with the slug `business-vocabulary-in-use-elementary` uses:

```text
ui/assets/library/covers/business-vocabulary-in-use-elementary.webp
```

The slug is used instead of the display title so renaming the title does not unexpectedly change the asset contract.

## Image guidance

- Format: WebP
- Recommended aspect ratio: 16:9
- Recommended size: 1200 × 675 or larger
- Keep important content away from the outer edges because the image uses `object-fit: cover`.

Adding an image is optional. If the file does not exist or fails to load, the Library card automatically keeps the CSS-designed fallback artwork underneath it; no database field or code change is required.
