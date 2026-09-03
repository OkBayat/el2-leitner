ALTER TABLE listening_lessons
  ADD COLUMN audio_file VARCHAR(255) NULL AFTER source_url;

UPDATE listening_lessons
SET audio_file = CONCAT(public_id, '.mp3')
WHERE audio_file IS NULL;
