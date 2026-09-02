CREATE TABLE IF NOT EXISTS vocabulary_sentences (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  vocabulary_entry_id BIGINT UNSIGNED NOT NULL,
  source_key VARCHAR(160) NOT NULL,
  source_item_number SMALLINT UNSIGNED NOT NULL,
  variant_number TINYINT UNSIGNED NOT NULL,
  category VARCHAR(255) NOT NULL,
  sentence_text VARCHAR(1000) NOT NULL,
  answer_text VARCHAR(512) NOT NULL,
  source_hash CHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY vocabulary_sentences_source_variant_unique (source_key, source_item_number, variant_number),
  KEY vocabulary_sentences_entry_index (vocabulary_entry_id, status),
  KEY vocabulary_sentences_source_hash_index (source_key, source_hash),
  CONSTRAINT vocabulary_sentences_entry_fk
    FOREIGN KEY (vocabulary_entry_id) REFERENCES vocabulary_entries (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
