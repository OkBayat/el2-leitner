CREATE TABLE IF NOT EXISTS user_vocabulary_overrides (
  user_id BIGINT UNSIGNED NOT NULL,
  vocabulary_entry_id BIGINT UNSIGNED NOT NULL,
  primary_form VARCHAR(512) NOT NULL,
  accepted_forms_json JSON NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, vocabulary_entry_id),
  KEY user_vocabulary_overrides_entry_index (vocabulary_entry_id),
  CONSTRAINT user_vocabulary_overrides_user_fk
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT user_vocabulary_overrides_entry_fk
    FOREIGN KEY (vocabulary_entry_id) REFERENCES vocabulary_entries (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
