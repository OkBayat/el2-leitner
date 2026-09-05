ALTER TABLE listening_lessons
  ADD COLUMN level VARCHAR(32) NOT NULL DEFAULT 'intermediate',
  ADD COLUMN asset_directory VARCHAR(160) NULL,
  ADD COLUMN image_file VARCHAR(255) NULL,
  ADD COLUMN vocabulary_collection_id VARCHAR(64) NULL,
  ADD CONSTRAINT listening_lessons_vocabulary_collection_fk
    FOREIGN KEY (vocabulary_collection_id) REFERENCES collections (public_id)
    ON UPDATE CASCADE ON DELETE RESTRICT;

-- Reuse PR #63's provenance table; keep authored order for episode-specific examples.
ALTER TABLE collection_entry_examples
  ADD COLUMN position SMALLINT UNSIGNED NOT NULL DEFAULT 0;
