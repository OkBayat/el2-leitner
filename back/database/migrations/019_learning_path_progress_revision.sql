ALTER TABLE user_learning_path_progress
  ADD COLUMN revision BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER last_seen_content_version;
