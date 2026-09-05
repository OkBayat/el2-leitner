CREATE TABLE IF NOT EXISTS collection_entry_definitions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id VARCHAR(64) NOT NULL,
  collection_entry_id BIGINT UNSIGNED NOT NULL,
  language_code VARCHAR(16) NOT NULL DEFAULT 'en',
  definition_text TEXT NOT NULL,
  position SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY collection_entry_definitions_public_id_unique (public_id),
  UNIQUE KEY collection_entry_definitions_position_unique (
    collection_entry_id,
    language_code,
    position
  ),
  KEY collection_entry_definitions_entry_index (collection_entry_id),
  CONSTRAINT collection_entry_definitions_entry_fk
    FOREIGN KEY (collection_entry_id) REFERENCES collection_entries (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

DELETE duplicate_sentence
FROM sentences AS duplicate_sentence
JOIN sentences AS keeper
  ON TRIM(keeper.sentence_text) = TRIM(duplicate_sentence.sentence_text)
 AND keeper.id < duplicate_sentence.id;

ALTER TABLE sentences
  ADD COLUMN sentence_hash CHAR(64) NULL AFTER sentence_text;

UPDATE sentences
SET sentence_text = TRIM(sentence_text),
    sentence_hash = SHA2(TRIM(sentence_text), 256)
WHERE sentence_hash IS NULL;

ALTER TABLE sentences
  MODIFY sentence_hash CHAR(64) NOT NULL,
  ADD UNIQUE KEY sentences_hash_unique (sentence_hash);

CREATE TABLE IF NOT EXISTS sentence_vocabulary_entries (
  sentence_id BIGINT UNSIGNED NOT NULL,
  vocabulary_entry_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (sentence_id, vocabulary_entry_id),
  KEY sentence_vocabulary_entries_vocabulary_index (vocabulary_entry_id, sentence_id),
  CONSTRAINT sentence_vocabulary_entries_sentence_fk
    FOREIGN KEY (sentence_id) REFERENCES sentences (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT sentence_vocabulary_entries_vocabulary_fk
    FOREIGN KEY (vocabulary_entry_id) REFERENCES vocabulary_entries (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
