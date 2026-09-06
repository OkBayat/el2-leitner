CREATE TABLE IF NOT EXISTS collection_learning_paths (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id VARCHAR(64) NOT NULL,
  collection_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  mode VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  content_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  source_hash CHAR(64) NULL,
  published_at TIMESTAMP(3) NULL,
  retired_at TIMESTAMP(3) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY collection_learning_paths_public_id_unique (public_id),
  KEY collection_learning_paths_collection_index (collection_id, status, retired_at),
  CONSTRAINT collection_learning_paths_collection_fk
    FOREIGN KEY (collection_id) REFERENCES collections (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_path_lessons (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id VARCHAR(64) NOT NULL,
  learning_path_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  position INT UNSIGNED NOT NULL,
  source_kind VARCHAR(64) NULL,
  source_ref VARCHAR(255) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  introduced_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  retired_version BIGINT UNSIGNED NULL,
  published_at TIMESTAMP(3) NULL,
  retired_at TIMESTAMP(3) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY learning_path_lessons_public_id_unique (public_id),
  KEY learning_path_lessons_path_order_index (learning_path_id, retired_at, position),
  KEY learning_path_lessons_source_index (source_kind, source_ref),
  CONSTRAINT learning_path_lessons_path_fk
    FOREIGN KEY (learning_path_id) REFERENCES collection_learning_paths (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_path_exercises (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id VARCHAR(64) NOT NULL,
  lesson_id BIGINT UNSIGNED NOT NULL,
  position INT UNSIGNED NOT NULL,
  type VARCHAR(96) NOT NULL,
  schema_version INT UNSIGNED NOT NULL,
  required BOOLEAN NOT NULL DEFAULT TRUE,
  completion_policy VARCHAR(96) NOT NULL,
  config_json JSON NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  introduced_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  retired_version BIGINT UNSIGNED NULL,
  published_at TIMESTAMP(3) NULL,
  retired_at TIMESTAMP(3) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY learning_path_exercises_public_id_unique (public_id),
  KEY learning_path_exercises_lesson_order_index (lesson_id, retired_at, position),
  KEY learning_path_exercises_type_index (type, schema_version),
  CONSTRAINT learning_path_exercises_lesson_fk
    FOREIGN KEY (lesson_id) REFERENCES learning_path_lessons (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_learning_path_progress (
  user_id BIGINT UNSIGNED NOT NULL,
  learning_path_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMP(3) NOT NULL,
  completed_at TIMESTAMP(3) NULL,
  last_activity_at TIMESTAMP(3) NOT NULL,
  last_seen_content_version BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, learning_path_id),
  KEY user_learning_path_progress_path_index (learning_path_id, status),
  KEY user_learning_path_progress_user_activity_index (user_id, last_activity_at),
  CONSTRAINT user_learning_path_progress_user_fk
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT user_learning_path_progress_path_fk
    FOREIGN KEY (learning_path_id) REFERENCES collection_learning_paths (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_learning_path_lesson_progress (
  user_id BIGINT UNSIGNED NOT NULL,
  lesson_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMP(3) NOT NULL,
  completed_at TIMESTAMP(3) NULL,
  last_activity_at TIMESTAMP(3) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, lesson_id),
  KEY user_learning_path_lesson_progress_lesson_index (lesson_id, status),
  KEY user_learning_path_lesson_progress_user_activity_index (user_id, last_activity_at),
  CONSTRAINT user_learning_path_lesson_progress_user_fk
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT user_learning_path_lesson_progress_lesson_fk
    FOREIGN KEY (lesson_id) REFERENCES learning_path_lessons (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_learning_path_exercise_progress (
  user_id BIGINT UNSIGNED NOT NULL,
  exercise_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMP(3) NOT NULL,
  completed_at TIMESTAMP(3) NULL,
  last_activity_at TIMESTAMP(3) NOT NULL,
  evidence_type VARCHAR(96) NULL,
  evidence_ref VARCHAR(255) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, exercise_id),
  KEY user_learning_path_exercise_progress_exercise_index (exercise_id, status),
  KEY user_learning_path_exercise_progress_user_activity_index (user_id, last_activity_at),
  KEY user_learning_path_exercise_progress_evidence_index (evidence_type, evidence_ref),
  CONSTRAINT user_learning_path_exercise_progress_user_fk
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT user_learning_path_exercise_progress_exercise_fk
    FOREIGN KEY (exercise_id) REFERENCES learning_path_exercises (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
