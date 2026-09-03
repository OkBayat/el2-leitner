ALTER TABLE sentences
  MODIFY COLUMN source_item_number BIGINT UNSIGNED NULL,
  MODIFY COLUMN sentence_text TEXT NOT NULL,
  ADD COLUMN audio_id BIGINT UNSIGNED NULL AFTER sentence_text,
  ADD COLUMN audio_url VARCHAR(512) NULL AFTER audio_id,
  ADD COLUMN audio_contributor VARCHAR(255) NULL AFTER audio_url,
  ADD COLUMN audio_license VARCHAR(128) NULL AFTER audio_contributor,
  ADD COLUMN audio_attribution_url VARCHAR(1000) NULL AFTER audio_license,
  ADD UNIQUE KEY sentences_audio_id_unique (audio_id),
  ADD FULLTEXT KEY sentences_text_fulltext (sentence_text);
