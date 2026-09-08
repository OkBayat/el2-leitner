CREATE TABLE IF NOT EXISTS learning_path_recording_artifacts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(36) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  exercise_id BIGINT UNSIGNED NOT NULL,
  exercise_started_at TIMESTAMP(3) NOT NULL,
  slide_public_id VARCHAR(160) NOT NULL,
  mime_type VARCHAR(64) NOT NULL,
  byte_size INT UNSIGNED NOT NULL,
  sha256 CHAR(64) NOT NULL,
  audio_data MEDIUMBLOB NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY learning_path_recording_artifacts_public_id_unique (public_id),
  KEY learning_path_recording_artifacts_owner_index (user_id, exercise_id, exercise_started_at, slide_public_id),
  KEY learning_path_recording_artifacts_created_index (created_at),
  CONSTRAINT learning_path_recording_artifacts_user_fk
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT learning_path_recording_artifacts_exercise_fk
    FOREIGN KEY (exercise_id) REFERENCES learning_path_exercises (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
