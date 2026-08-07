CREATE TABLE IF NOT EXISTS user_state_revisions (
  user_id BIGINT UNSIGNED NOT NULL,
  revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
  state_created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  metadata_json JSON NULL,
  learning_reset_at TIMESTAMP(3) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id),
  CONSTRAINT user_state_revisions_user_fk
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_collections (
  user_id BIGINT UNSIGNED NOT NULL,
  collection_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  subscribed_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  removed_at TIMESTAMP(3) NULL,
  last_seen_version BIGINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, collection_id),
  KEY user_collections_collection_index (collection_id, status),
  CONSTRAINT user_collections_user_fk
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT user_collections_collection_fk
    FOREIGN KEY (collection_id) REFERENCES collections (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_vocabulary_progress (
  user_id BIGINT UNSIGNED NOT NULL,
  vocabulary_entry_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  box TINYINT UNSIGNED NOT NULL DEFAULT 0,
  due_date DATE NULL,
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  correct_count INT UNSIGNED NOT NULL DEFAULT 0,
  mistake_count INT UNSIGNED NOT NULL DEFAULT 0,
  current_streak INT UNSIGNED NOT NULL DEFAULT 0,
  introduced_on DATE NULL,
  introduced_via VARCHAR(64) NULL,
  last_reviewed_at TIMESTAMP(3) NULL,
  last_promoted_on DATE NULL,
  blocked_until DATE NULL,
  mastered_at TIMESTAMP(3) NULL,
  personal_note TEXT NULL,
  legacy_category VARCHAR(255) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, vocabulary_entry_id),
  KEY user_vocabulary_due_index (user_id, status, due_date),
  KEY user_vocabulary_box_index (user_id, status, box),
  KEY user_vocabulary_entry_index (vocabulary_entry_id),
  CONSTRAINT user_vocabulary_progress_user_fk
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT user_vocabulary_progress_entry_fk
    FOREIGN KEY (vocabulary_entry_id) REFERENCES vocabulary_entries (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS practice_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id VARCHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  mode VARCHAR(64) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  started_at TIMESTAMP(3) NOT NULL,
  completed_at TIMESTAMP(3) NULL,
  planned_count INT UNSIGNED NULL,
  completed_count INT UNSIGNED NOT NULL DEFAULT 0,
  correct_count INT UNSIGNED NOT NULL DEFAULT 0,
  wrong_count INT UNSIGNED NOT NULL DEFAULT 0,
  duration_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  metadata_json JSON NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY practice_sessions_public_id_unique (public_id),
  KEY practice_sessions_user_index (user_id, started_at),
  CONSTRAINT practice_sessions_user_fk
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS review_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_key CHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  vocabulary_entry_id BIGINT UNSIGNED NULL,
  collection_id BIGINT UNSIGNED NULL,
  practice_session_id BIGINT UNSIGNED NULL,
  occurred_at TIMESTAMP(3) NOT NULL,
  local_day DATE NOT NULL,
  answer TEXT NULL,
  correct BOOLEAN NOT NULL,
  mode VARCHAR(64) NULL,
  previous_box TINYINT UNSIGNED NULL,
  new_box TINYINT UNSIGNED NULL,
  promoted BOOLEAN NOT NULL DEFAULT FALSE,
  mistake_number INT UNSIGNED NULL,
  term_snapshot VARCHAR(512) NOT NULL,
  metadata_json JSON NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY review_events_event_key_unique (event_key),
  KEY review_events_user_day_index (user_id, local_day, occurred_at),
  KEY review_events_user_entry_index (user_id, vocabulary_entry_id, occurred_at),
  KEY review_events_session_index (practice_session_id, occurred_at),
  CONSTRAINT review_events_user_fk
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT review_events_entry_fk
    FOREIGN KEY (vocabulary_entry_id) REFERENCES vocabulary_entries (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT review_events_collection_fk
    FOREIGN KEY (collection_id) REFERENCES collections (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT review_events_session_fk
    FOREIGN KEY (practice_session_id) REFERENCES practice_sessions (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_daily_stats (
  user_id BIGINT UNSIGNED NOT NULL,
  day DATE NOT NULL,
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  correct_count INT UNSIGNED NOT NULL DEFAULT 0,
  wrong_count INT UNSIGNED NOT NULL DEFAULT 0,
  new_added INT UNSIGNED NOT NULL DEFAULT 0,
  session_count INT UNSIGNED NOT NULL DEFAULT 0,
  duration_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, day),
  KEY user_daily_stats_day_index (day),
  CONSTRAINT user_daily_stats_user_fk
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_settings (
  user_id BIGINT UNSIGNED NOT NULL,
  daily_new SMALLINT UNSIGNED NOT NULL DEFAULT 10,
  daily_goal SMALLINT UNSIGNED NOT NULL DEFAULT 20,
  voice_rate DECIMAL(4,2) NOT NULL DEFAULT 0.85,
  theme VARCHAR(32) NOT NULL DEFAULT 'system',
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id),
  CONSTRAINT user_settings_user_fk
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
