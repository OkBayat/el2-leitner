-- Improve generic sentence templates before removing provenance-only columns.

-- Text updates are idempotent; the schema cleanup runs only while source_key still exists.

UPDATE sentences
SET sentence_text = CONCAT(
  'The lecturer mentioned ',
  SUBSTRING(
    sentence_text,
    CHAR_LENGTH('The lecturer returned to ') + 1,
    CHAR_LENGTH(sentence_text) - CHAR_LENGTH('The lecturer returned to ') - CHAR_LENGTH(' later in the lesson.')
  ),
  ' again later in the lesson.'
)
WHERE sentence_text LIKE 'The lecturer returned to % later in the lesson.';

UPDATE sentences
SET sentence_text = CONCAT(
  'The teacher gave a clear example using “',
  SUBSTRING(
    sentence_text,
    CHAR_LENGTH('The conversation included a clear example involving ') + 1,
    CHAR_LENGTH(sentence_text) - CHAR_LENGTH('The conversation included a clear example involving ') - CHAR_LENGTH('.')
  ),
  '”.'
)
WHERE sentence_text LIKE 'The conversation included a clear example involving %.';

UPDATE sentences
SET sentence_text = CONCAT(
  'The term “',
  SUBSTRING(
    sentence_text,
    CHAR_LENGTH('The lesson returned to ') + 1,
    CHAR_LENGTH(sentence_text) - CHAR_LENGTH('The lesson returned to ') - CHAR_LENGTH(' during the discussion.')
  ),
  '” came up during the discussion.'
)
WHERE sentence_text LIKE 'The lesson returned to % during the discussion.';

UPDATE sentences
SET sentence_text = CONCAT(
  'The notes included another example with “',
  SUBSTRING(
    sentence_text,
    CHAR_LENGTH('The notes include a short example connected with ') + 1,
    CHAR_LENGTH(sentence_text) - CHAR_LENGTH('The notes include a short example connected with ') - CHAR_LENGTH('.')
  ),
  '”.'
)
WHERE sentence_text LIKE 'The notes include a short example connected with %.';

UPDATE sentences
SET sentence_text = CONCAT(
  'The speaker used “',
  SUBSTRING(
    sentence_text,
    CHAR_LENGTH('The speaker described the situation as ') + 1,
    CHAR_LENGTH(sentence_text) - CHAR_LENGTH('The speaker described the situation as ') - CHAR_LENGTH('.')
  ),
  '” as a description.'
)
WHERE sentence_text LIKE 'The speaker described the situation as %.';

UPDATE sentences
SET sentence_text = CONCAT(
  'The reviewer chose “',
  SUBSTRING(
    sentence_text,
    CHAR_LENGTH('The reviewer considered the result ') + 1,
    CHAR_LENGTH(sentence_text) - CHAR_LENGTH('The reviewer considered the result ') - CHAR_LENGTH('.')
  ),
  '” as the best description.'
)
WHERE sentence_text LIKE 'The reviewer considered the result %.';

UPDATE sentences
SET sentence_text = CONCAT(
  'The example showed how “',
  SUBSTRING(
    sentence_text,
    CHAR_LENGTH('They found the experience surprisingly ') + 1,
    CHAR_LENGTH(sentence_text) - CHAR_LENGTH('They found the experience surprisingly ') - CHAR_LENGTH('.')
  ),
  '” can be used naturally.'
)
WHERE sentence_text LIKE 'They found the experience surprisingly %.';

UPDATE sentences
SET sentence_text = CONCAT(
  'The lesson included an example using “',
  SUBSTRING(
    sentence_text,
    CHAR_LENGTH('The lesson includes a practical example built around ') + 1,
    CHAR_LENGTH(sentence_text) - CHAR_LENGTH('The lesson includes a practical example built around ') - CHAR_LENGTH('.')
  ),
  '”.'
)
WHERE sentence_text LIKE 'The lesson includes a practical example built around %.';

UPDATE sentences
SET sentence_text = CONCAT(
  'The teacher reviewed how “',
  SUBSTRING(
    sentence_text,
    CHAR_LENGTH('The teacher returned to ') + 1,
    CHAR_LENGTH(sentence_text) - CHAR_LENGTH('The teacher returned to ') - CHAR_LENGTH(' during the exercise.')
  ),
  '” is used during the exercise.'
)
WHERE sentence_text LIKE 'The teacher returned to % during the exercise.';

UPDATE sentences
SET sentence_text = CONCAT(
  'The group discussed how “',
  SUBSTRING(
    sentence_text,
    CHAR_LENGTH('The group discussed how ') + 1,
    CHAR_LENGTH(sentence_text) - CHAR_LENGTH('The group discussed how ') - CHAR_LENGTH(' works in context.')
  ),
  '” is used in context.'
)
WHERE sentence_text LIKE 'The group discussed how % works in context.';

UPDATE sentences
SET sentence_text = CONCAT(
  'The conversation naturally included “',
  SUBSTRING(
    sentence_text,
    CHAR_LENGTH('The conversation naturally included the expression ') + 1,
    CHAR_LENGTH(sentence_text) - CHAR_LENGTH('The conversation naturally included the expression ') - CHAR_LENGTH('.')
  ),
  '”.'
)
WHERE sentence_text LIKE 'The conversation naturally included the expression %.';

UPDATE sentences
SET sentence_text = CONCAT(
  'The lesson showed a useful context for “',
  SUBSTRING(
    sentence_text,
    CHAR_LENGTH('The lesson gives a useful context for ') + 1,
    CHAR_LENGTH(sentence_text) - CHAR_LENGTH('The lesson gives a useful context for ') - CHAR_LENGTH('.')
  ),
  '”.'
)
WHERE sentence_text LIKE 'The lesson gives a useful context for %.';

UPDATE sentences
SET sentence_text = CONCAT(
  'The speaker used “',
  SUBSTRING(
    sentence_text,
    CHAR_LENGTH('The speaker returned to ') + 1,
    CHAR_LENGTH(sentence_text) - CHAR_LENGTH('The speaker returned to ') - CHAR_LENGTH(' later in the discussion.')
  ),
  '” later in the discussion.'
)
WHERE sentence_text LIKE 'The speaker returned to % later in the discussion.';

UPDATE sentences
SET sentence_text = CONCAT(
  'The report used “',
  SUBSTRING(
    sentence_text,
    CHAR_LENGTH('The report uses ') + 1,
    CHAR_LENGTH(sentence_text) - CHAR_LENGTH('The report uses ') - CHAR_LENGTH(' to qualify the statement.')
  ),
  '” to qualify the statement.'
)
WHERE sentence_text LIKE 'The report uses % to qualify the statement.';

UPDATE sentences
SET sentence_text = CONCAT(
  'The speaker included “',
  SUBSTRING(
    sentence_text,
    CHAR_LENGTH('The speaker included ') + 1,
    CHAR_LENGTH(sentence_text) - CHAR_LENGTH('The speaker included ') - CHAR_LENGTH(' in the explanation.')
  ),
  '” in the explanation.'
)
WHERE sentence_text LIKE 'The speaker included % in the explanation.';

UPDATE sentences
SET sentence_text = CONCAT(
  'The lecturer highlighted “',
  SUBSTRING(
    sentence_text,
    CHAR_LENGTH('The lecturer highlighted ') + 1,
    CHAR_LENGTH(sentence_text) - CHAR_LENGTH('The lecturer highlighted ') - CHAR_LENGTH(' during the example.')
  ),
  '” during the example.'
)
WHERE sentence_text LIKE 'The lecturer highlighted % during the example.';

DELETE duplicate_sentence
FROM sentences AS duplicate_sentence
JOIN sentences AS keeper
  ON keeper.sentence_text = duplicate_sentence.sentence_text
 AND keeper.id < duplicate_sentence.id;

SET @sentence_has_legacy_columns := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sentences'
    AND COLUMN_NAME = 'source_key'
);

SET @sentence_cleanup_ddl := IF(@sentence_has_legacy_columns > 0, 'ALTER TABLE sentences DROP INDEX sentences_source_variant_unique, DROP INDEX sentences_active_language_index, DROP INDEX sentences_source_hash_index, DROP COLUMN language_code, DROP COLUMN source_key, DROP COLUMN source_item_number, DROP COLUMN variant_number, DROP COLUMN category, DROP COLUMN source_hash, ADD KEY sentences_active_index (status, id)', 'SELECT 1');

PREPARE sentence_cleanup_stmt FROM @sentence_cleanup_ddl;
EXECUTE sentence_cleanup_stmt;
DEALLOCATE PREPARE sentence_cleanup_stmt;
