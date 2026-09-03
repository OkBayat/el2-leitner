CREATE TABLE IF NOT EXISTS sentences (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  language_code VARCHAR(16) NOT NULL DEFAULT 'en',
  source_key VARCHAR(160) NULL,
  source_item_number SMALLINT UNSIGNED NULL,
  variant_number TINYINT UNSIGNED NULL,
  category VARCHAR(255) NULL,
  sentence_text VARCHAR(1000) NOT NULL,
  source_hash CHAR(64) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY sentences_source_variant_unique (source_key, source_item_number, variant_number),
  KEY sentences_active_language_index (status, language_code, id),
  KEY sentences_source_hash_index (source_key, source_hash)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
