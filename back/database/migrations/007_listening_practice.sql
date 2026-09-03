CREATE TABLE IF NOT EXISTS listening_lessons (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id VARCHAR(64) NOT NULL,
  provider VARCHAR(64) NOT NULL,
  slug VARCHAR(160) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  episode_code VARCHAR(64) NULL,
  episode_date DATE NULL,
  source_url VARCHAR(1000) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  schema_version SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  question_count SMALLINT UNSIGNED NOT NULL,
  content_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  source_hash CHAR(64) NOT NULL,
  content_json JSON NOT NULL,
  published_at TIMESTAMP(3) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY listening_lessons_public_id_unique (public_id),
  UNIQUE KEY listening_lessons_provider_slug_unique (provider, slug),
  KEY listening_lessons_catalog_index (provider, status, episode_date)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS listening_attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id VARCHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  lesson_id BIGINT UNSIGNED NOT NULL,
  lesson_content_version BIGINT UNSIGNED NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  started_at TIMESTAMP(3) NOT NULL,
  submitted_at TIMESTAMP(3) NULL,
  total_count SMALLINT UNSIGNED NOT NULL,
  correct_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  wrong_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  answers_json JSON NULL,
  result_json JSON NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY listening_attempts_public_id_unique (public_id),
  KEY listening_attempts_user_index (user_id, started_at),
  KEY listening_attempts_lesson_index (lesson_id, submitted_at),
  CONSTRAINT listening_attempts_user_fk
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT listening_attempts_lesson_fk
    FOREIGN KEY (lesson_id) REFERENCES listening_lessons (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
