ALTER TABLE vocabulary_forms
  MODIFY normalized_form VARCHAR(512)
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_bin
    NOT NULL;
