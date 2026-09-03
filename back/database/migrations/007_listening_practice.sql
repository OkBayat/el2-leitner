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
  content_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  source_hash CHAR(64) NOT NULL,
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

CREATE TABLE IF NOT EXISTS listening_question_groups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id VARCHAR(64) NOT NULL,
  lesson_id BIGINT UNSIGNED NOT NULL,
  position SMALLINT UNSIGNED NOT NULL,
  heading VARCHAR(255) NOT NULL,
  task_type VARCHAR(64) NOT NULL,
  instruction TEXT NOT NULL,
  answer_instruction TEXT NOT NULL,
  max_words SMALLINT UNSIGNED NULL,
  max_numbers SMALLINT UNSIGNED NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY listening_groups_public_id_unique (public_id),
  UNIQUE KEY listening_groups_lesson_position_unique (lesson_id, position),
  CONSTRAINT listening_groups_lesson_fk
    FOREIGN KEY (lesson_id) REFERENCES listening_lessons (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS listening_questions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id VARCHAR(64) NOT NULL,
  lesson_id BIGINT UNSIGNED NOT NULL,
  group_id BIGINT UNSIGNED NOT NULL,
  question_number SMALLINT UNSIGNED NOT NULL,
  position SMALLINT UNSIGNED NOT NULL,
  response_type VARCHAR(32) NOT NULL,
  prompt TEXT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY listening_questions_public_id_unique (public_id),
  UNIQUE KEY listening_questions_lesson_number_unique (lesson_id, question_number),
  UNIQUE KEY listening_questions_group_position_unique (group_id, position),
  KEY listening_questions_group_index (group_id, position),
  CONSTRAINT listening_questions_lesson_fk
    FOREIGN KEY (lesson_id) REFERENCES listening_lessons (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT listening_questions_group_fk
    FOREIGN KEY (group_id) REFERENCES listening_question_groups (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS listening_question_options (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id VARCHAR(64) NOT NULL,
  question_id BIGINT UNSIGNED NOT NULL,
  label VARCHAR(8) NOT NULL,
  option_text TEXT NOT NULL,
  position SMALLINT UNSIGNED NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY listening_options_public_id_unique (public_id),
  UNIQUE KEY listening_options_question_label_unique (question_id, label),
  UNIQUE KEY listening_options_question_position_unique (question_id, position),
  CONSTRAINT listening_options_question_fk
    FOREIGN KEY (question_id) REFERENCES listening_questions (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS listening_question_answers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  question_id BIGINT UNSIGNED NOT NULL,
  accepted_text VARCHAR(512) NULL,
  normalized_text VARCHAR(512) NULL,
  option_id BIGINT UNSIGNED NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY listening_answers_question_index (question_id, is_primary),
  KEY listening_answers_option_index (option_id),
  CONSTRAINT listening_answers_question_fk
    FOREIGN KEY (question_id) REFERENCES listening_questions (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT listening_answers_option_fk
    FOREIGN KEY (option_id) REFERENCES listening_question_options (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
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

CREATE TABLE IF NOT EXISTS listening_attempt_answers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  attempt_id BIGINT UNSIGNED NOT NULL,
  question_public_id VARCHAR(64) NOT NULL,
  question_number SMALLINT UNSIGNED NOT NULL,
  response_type VARCHAR(32) NOT NULL,
  submitted_value TEXT NULL,
  submitted_answer TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  correct BOOLEAN NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY listening_attempt_answers_question_unique (attempt_id, question_public_id),
  KEY listening_attempt_answers_order_index (attempt_id, question_number),
  CONSTRAINT listening_attempt_answers_attempt_fk
    FOREIGN KEY (attempt_id) REFERENCES listening_attempts (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
