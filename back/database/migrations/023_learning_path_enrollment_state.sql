ALTER TABLE user_learning_path_progress
  ADD COLUMN enrollment_status VARCHAR(32) NOT NULL DEFAULT 'active' AFTER status,
  ADD COLUMN enrollment_removed_at TIMESTAMP(3) NULL AFTER enrollment_status,
  ADD KEY user_learning_path_enrollment_status_index (user_id, enrollment_status);
