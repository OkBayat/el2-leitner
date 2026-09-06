-- Preserve calendar-day evidence without changing scores, session totals, or review revisions.
-- Existing single-day sessions remain readable through the timeline's legacy fallback.
CREATE TABLE IF NOT EXISTS practice_session_days (
  practice_session_id BIGINT UNSIGNED NOT NULL,
  local_day DATE NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (practice_session_id, local_day),
  CONSTRAINT practice_session_days_session_fk
    FOREIGN KEY (practice_session_id) REFERENCES practice_sessions (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
