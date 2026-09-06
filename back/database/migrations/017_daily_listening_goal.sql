ALTER TABLE user_settings
  ADD COLUMN daily_listening_goal TINYINT UNSIGNED NOT NULL DEFAULT 3 AFTER daily_goal;
