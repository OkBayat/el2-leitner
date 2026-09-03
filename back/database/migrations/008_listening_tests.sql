ALTER TABLE listening_attempts
  ADD COLUMN test_id VARCHAR(64) NULL AFTER lesson_id;

UPDATE listening_attempts
SET test_id = 'test-1'
WHERE test_id IS NULL;

ALTER TABLE listening_attempts
  MODIFY COLUMN test_id VARCHAR(64) NOT NULL,
  ADD KEY listening_attempts_lesson_test_index (lesson_id, test_id, submitted_at),
  ADD KEY listening_attempts_user_test_index (user_id, lesson_id, test_id, status);
