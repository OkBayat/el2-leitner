ALTER TABLE sentences
  ADD COLUMN is_curated BOOLEAN NOT NULL DEFAULT FALSE AFTER sentence_hash;

CREATE TABLE IF NOT EXISTS collection_entry_forms (
  collection_entry_id BIGINT UNSIGNED NOT NULL,
  vocabulary_form_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (collection_entry_id, vocabulary_form_id),
  KEY collection_entry_forms_form_index (vocabulary_form_id, collection_entry_id),
  CONSTRAINT collection_entry_forms_entry_fk
    FOREIGN KEY (collection_entry_id) REFERENCES collection_entries (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT collection_entry_forms_form_fk
    FOREIGN KEY (vocabulary_form_id) REFERENCES vocabulary_forms (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS collection_entry_examples (
  collection_entry_id BIGINT UNSIGNED NOT NULL,
  sentence_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (collection_entry_id, sentence_id),
  KEY collection_entry_examples_sentence_index (sentence_id, collection_entry_id),
  CONSTRAINT collection_entry_examples_entry_fk
    FOREIGN KEY (collection_entry_id) REFERENCES collection_entries (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT collection_entry_examples_sentence_fk
    FOREIGN KEY (sentence_id) REFERENCES sentences (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
