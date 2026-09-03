-- Improve sentence quality before removing provenance-only columns.

-- These updates target the generic sentence templates used by earlier revisions of PR #55.

UPDATE sentences
SET sentence_text = CASE variant_number
  WHEN 1 THEN 'It is easy to get into debt if you spend more than you earn.'
  WHEN 2 THEN 'Many people get into debt when they rely too much on credit cards.'
  WHEN 3 THEN 'Students can get into debt if they borrow more money than they can repay.'
  ELSE sentence_text
END
WHERE source_key = 'american-english-file-3-core-vocabulary'
  AND source_item_number = 74;

UPDATE sentences
SET sentence_text = CASE variant_number
  WHEN 1 THEN 'My ex moved to another city last year.'
  WHEN 2 THEN 'I ran into my ex at a café yesterday.'
  WHEN 3 THEN 'She still speaks to her ex occasionally.'
  ELSE sentence_text
END
WHERE source_key = 'american-english-file-3-core-vocabulary'
  AND source_item_number = 236;

UPDATE sentences
SET sentence_text = CASE variant_number
  WHEN 1 THEN 'Please return the book to the library by Friday.'
  WHEN 2 THEN 'I need to return this shirt to the store.'
  WHEN 3 THEN 'They will return home after the trip.'
  ELSE sentence_text
END
WHERE source_key = 'american-english-file-3-core-vocabulary'
  AND source_item_number = 422;

UPDATE sentences
SET sentence_text = CASE variant_number
  WHEN 1 THEN 'Please include your phone number on the form.'
  WHEN 2 THEN 'The price does not include breakfast.'
  WHEN 3 THEN 'The report should include a short summary.'
  ELSE sentence_text
END
WHERE source_key = 'cambridge-vocabulary-for-ielts'
  AND source_item_number = 764;

UPDATE sentences SET sentence_text = CASE variant_number WHEN 1 THEN 'The course materials introduced the notation “relationship (between/with)”.' WHEN 2 THEN 'The teacher explained how “relationship (between/with)” is used.' WHEN 3 THEN 'The notes included an example with “relationship (between/with)”.' ELSE sentence_text END WHERE source_key = 'cambridge-vocabulary-for-ielts' AND source_item_number = 17;
UPDATE sentences SET sentence_text = CASE variant_number WHEN 1 THEN 'The course materials introduced the notation “relate (to)”.' WHEN 2 THEN 'The teacher explained how “relate (to)” is used.' WHEN 3 THEN 'The notes included an example with “relate (to)”.' ELSE sentence_text END WHERE source_key = 'cambridge-vocabulary-for-ielts' AND source_item_number = 51;
UPDATE sentences SET sentence_text = CASE variant_number WHEN 1 THEN 'The course materials introduced the notation “(eating) disorder”.' WHEN 2 THEN 'The teacher explained how “(eating) disorder” is used.' WHEN 3 THEN 'The notes included an example with “(eating) disorder”.' ELSE sentence_text END WHERE source_key = 'cambridge-vocabulary-for-ielts' AND source_item_number = 122;
UPDATE sentences SET sentence_text = CASE variant_number WHEN 1 THEN 'The course materials introduced the notation “(achieve a) balance”.' WHEN 2 THEN 'The teacher explained how “(achieve a) balance” is used.' WHEN 3 THEN 'The notes included an example with “(achieve a) balance”.' ELSE sentence_text END WHERE source_key = 'cambridge-vocabulary-for-ielts' AND source_item_number = 183;
UPDATE sentences SET sentence_text = CASE variant_number WHEN 1 THEN 'The course materials introduced the notation “achieve (a goal)”.' WHEN 2 THEN 'The teacher explained how “achieve (a goal)” is used.' WHEN 3 THEN 'The notes included an example with “achieve (a goal)”.' ELSE sentence_text END WHERE source_key = 'cambridge-vocabulary-for-ielts' AND source_item_number = 218;
UPDATE sentences SET sentence_text = CASE variant_number WHEN 1 THEN 'The course materials introduced the notation “miss (an opportunity)”.' WHEN 2 THEN 'The teacher explained how “miss (an opportunity)” is used.' WHEN 3 THEN 'The notes included an example with “miss (an opportunity)”.' ELSE sentence_text END WHERE source_key = 'cambridge-vocabulary-for-ielts' AND source_item_number = 238;
UPDATE sentences SET sentence_text = CASE variant_number WHEN 1 THEN 'The course materials introduced the notation “set (a goal)”.' WHEN 2 THEN 'The teacher explained how “set (a goal)” is used.' WHEN 3 THEN 'The notes included an example with “set (a goal)”.' ELSE sentence_text END WHERE source_key = 'cambridge-vocabulary-for-ielts' AND source_item_number = 240;
UPDATE sentences SET sentence_text = CASE variant_number WHEN 1 THEN 'The course materials introduced the notation “take part (in)”.' WHEN 2 THEN 'The teacher explained how “take part (in)” is used.' WHEN 3 THEN 'The notes included an example with “take part (in)”.' ELSE sentence_text END WHERE source_key = 'cambridge-vocabulary-for-ielts' AND source_item_number = 241;
UPDATE sentences SET sentence_text = CASE variant_number WHEN 1 THEN 'The course materials introduced the notation “field (of study)”.' WHEN 2 THEN 'The teacher explained how “field (of study)” is used.' WHEN 3 THEN 'The notes included an example with “field (of study)”.' ELSE sentence_text END WHERE source_key = 'cambridge-vocabulary-for-ielts' AND source_item_number = 257;
UPDATE sentences SET sentence_text = CASE variant_number WHEN 1 THEN 'The course materials introduced the notation “adopt (an approach)”.' WHEN 2 THEN 'The teacher explained how “adopt (an approach)” is used.' WHEN 3 THEN 'The notes included an example with “adopt (an approach)”.' ELSE sentence_text END WHERE source_key = 'cambridge-vocabulary-for-ielts' AND source_item_number = 300;
UPDATE sentences SET sentence_text = CASE variant_number WHEN 1 THEN 'The course materials introduced the notation “learn (about)”.' WHEN 2 THEN 'The teacher explained how “learn (about)” is used.' WHEN 3 THEN 'The notes included an example with “learn (about)”.' ELSE sentence_text END WHERE source_key = 'cambridge-vocabulary-for-ielts' AND source_item_number = 307;
UPDATE sentences SET sentence_text = CASE variant_number WHEN 1 THEN 'The course materials introduced the notation “take (a course)”.' WHEN 2 THEN 'The teacher explained how “take (a course)” is used.' WHEN 3 THEN 'The notes included an example with “take (a course)”.' ELSE sentence_text END WHERE source_key = 'cambridge-vocabulary-for-ielts' AND source_item_number = 313;
UPDATE sentences SET sentence_text = CASE variant_number WHEN 1 THEN 'The course materials introduced the notation “refer (to)”.' WHEN 2 THEN 'The teacher explained how “refer (to)” is used.' WHEN 3 THEN 'The notes included an example with “refer (to)”.' ELSE sentence_text END WHERE source_key = 'cambridge-vocabulary-for-ielts' AND source_item_number = 352;
UPDATE sentences SET sentence_text = CASE variant_number WHEN 1 THEN 'The course materials introduced the notation “prior (to)”.' WHEN 2 THEN 'The teacher explained how “prior (to)” is used.' WHEN 3 THEN 'The notes included an example with “prior (to)”.' ELSE sentence_text END WHERE source_key = 'cambridge-vocabulary-for-ielts' AND source_item_number = 435;
UPDATE sentences SET sentence_text = CASE variant_number WHEN 1 THEN 'The course materials introduced the notation “crop(s)”.' WHEN 2 THEN 'The teacher explained how “crop(s)” is used.' WHEN 3 THEN 'The notes included an example with “crop(s)”.' ELSE sentence_text END WHERE source_key = 'cambridge-vocabulary-for-ielts' AND source_item_number = 457;
UPDATE sentences SET sentence_text = CASE variant_number WHEN 1 THEN 'The course materials introduced the notation “laptop (computer)”.' WHEN 2 THEN 'The teacher explained how “laptop (computer)” is used.' WHEN 3 THEN 'The notes included an example with “laptop (computer)”.' ELSE sentence_text END WHERE source_key = 'cambridge-vocabulary-for-ielts' AND source_item_number = 635;
UPDATE sentences SET sentence_text = CASE variant_number WHEN 1 THEN 'The course materials introduced the notation “(have a) monopoly”.' WHEN 2 THEN 'The teacher explained how “(have a) monopoly” is used.' WHEN 3 THEN 'The notes included an example with “(have a) monopoly”.' ELSE sentence_text END WHERE source_key = 'cambridge-vocabulary-for-ielts' AND source_item_number = 686;
UPDATE sentences SET sentence_text = CASE variant_number WHEN 1 THEN 'The course materials introduced the notation “exhaust (fumes)”.' WHEN 2 THEN 'The teacher explained how “exhaust (fumes)” is used.' WHEN 3 THEN 'The notes included an example with “exhaust (fumes)”.' ELSE sentence_text END WHERE source_key = 'cambridge-vocabulary-for-ielts' AND source_item_number = 792;
UPDATE sentences SET sentence_text = CASE variant_number WHEN 1 THEN 'The course materials introduced the notation “in danger (of)”.' WHEN 2 THEN 'The teacher explained how “in danger (of)” is used.' WHEN 3 THEN 'The notes included an example with “in danger (of)”.' ELSE sentence_text END WHERE source_key = 'cambridge-vocabulary-for-ielts' AND source_item_number = 821;
UPDATE sentences SET sentence_text = CASE variant_number WHEN 1 THEN 'The course materials introduced the notation “unleaded (petrol)”.' WHEN 2 THEN 'The teacher explained how “unleaded (petrol)” is used.' WHEN 3 THEN 'The notes included an example with “unleaded (petrol)”.' ELSE sentence_text END WHERE source_key = 'cambridge-vocabulary-for-ielts' AND source_item_number = 873;
UPDATE sentences SET sentence_text = CASE variant_number WHEN 1 THEN 'The course materials introduced the notation “invest (in)”.' WHEN 2 THEN 'The teacher explained how “invest (in)” is used.' WHEN 3 THEN 'The notes included an example with “invest (in)”.' ELSE sentence_text END WHERE source_key = 'cambridge-vocabulary-for-ielts' AND source_item_number = 955;
UPDATE sentences SET sentence_text = CASE variant_number WHEN 1 THEN 'The course materials introduced the notation “petty (crime)”.' WHEN 2 THEN 'The teacher explained how “petty (crime)” is used.' WHEN 3 THEN 'The notes included an example with “petty (crime)”.' ELSE sentence_text END WHERE source_key = 'cambridge-vocabulary-for-ielts' AND source_item_number = 1010;
UPDATE sentences SET sentence_text = CASE variant_number WHEN 1 THEN 'The course materials introduced the notation “abide (by)”.' WHEN 2 THEN 'The teacher explained how “abide (by)” is used.' WHEN 3 THEN 'The notes included an example with “abide (by)”.' ELSE sentence_text END WHERE source_key = 'cambridge-vocabulary-for-ielts' AND source_item_number = 1016;
UPDATE sentences SET sentence_text = CASE variant_number WHEN 1 THEN 'The course materials introduced the notation “be (held) responsible for”.' WHEN 2 THEN 'The teacher explained how “be (held) responsible for” is used.' WHEN 3 THEN 'The notes included an example with “be (held) responsible for”.' ELSE sentence_text END WHERE source_key = 'cambridge-vocabulary-for-ielts-advanced' AND source_item_number = 481;

UPDATE sentences
SET sentence_text = CONCAT('The lecturer mentioned ', SUBSTRING(sentence_text, CHAR_LENGTH('The lecturer returned to ') + 1, CHAR_LENGTH(sentence_text) - CHAR_LENGTH('The lecturer returned to ') - CHAR_LENGTH(' later in the lesson.')), ' again later in the lesson.')
WHERE sentence_text LIKE 'The lecturer returned to % later in the lesson.';

UPDATE sentences
SET sentence_text = CONCAT('The teacher gave a clear example using “', SUBSTRING(sentence_text, CHAR_LENGTH('The conversation included a clear example involving ') + 1, CHAR_LENGTH(sentence_text) - CHAR_LENGTH('The conversation included a clear example involving ') - CHAR_LENGTH('.')), '”.')
WHERE sentence_text LIKE 'The conversation included a clear example involving %.';

UPDATE sentences
SET sentence_text = CONCAT('The term “', SUBSTRING(sentence_text, CHAR_LENGTH('The lesson returned to ') + 1, CHAR_LENGTH(sentence_text) - CHAR_LENGTH('The lesson returned to ') - CHAR_LENGTH(' during the discussion.')), '” came up during the discussion.')
WHERE sentence_text LIKE 'The lesson returned to % during the discussion.';

UPDATE sentences
SET sentence_text = CONCAT('The notes included another example with “', SUBSTRING(sentence_text, CHAR_LENGTH('The notes include a short example connected with ') + 1, CHAR_LENGTH(sentence_text) - CHAR_LENGTH('The notes include a short example connected with ') - CHAR_LENGTH('.')), '”.')
WHERE sentence_text LIKE 'The notes include a short example connected with %.';

UPDATE sentences
SET sentence_text = CONCAT('The speaker used “', SUBSTRING(sentence_text, CHAR_LENGTH('The speaker described the situation as ') + 1, CHAR_LENGTH(sentence_text) - CHAR_LENGTH('The speaker described the situation as ') - CHAR_LENGTH('.')), '” as a description.')
WHERE sentence_text LIKE 'The speaker described the situation as %.';

UPDATE sentences
SET sentence_text = CONCAT('The reviewer chose “', SUBSTRING(sentence_text, CHAR_LENGTH('The reviewer considered the result ') + 1, CHAR_LENGTH(sentence_text) - CHAR_LENGTH('The reviewer considered the result ') - CHAR_LENGTH('.')), '” as the best description.')
WHERE sentence_text LIKE 'The reviewer considered the result %.';

UPDATE sentences
SET sentence_text = CONCAT('The example showed how “', SUBSTRING(sentence_text, CHAR_LENGTH('They found the experience surprisingly ') + 1, CHAR_LENGTH(sentence_text) - CHAR_LENGTH('They found the experience surprisingly ') - CHAR_LENGTH('.')), '” can be used naturally.')
WHERE sentence_text LIKE 'They found the experience surprisingly %.';

UPDATE sentences
SET sentence_text = CONCAT('The lesson included an example using “', SUBSTRING(sentence_text, CHAR_LENGTH('The lesson includes a practical example built around ') + 1, CHAR_LENGTH(sentence_text) - CHAR_LENGTH('The lesson includes a practical example built around ') - CHAR_LENGTH('.')), '”.')
WHERE sentence_text LIKE 'The lesson includes a practical example built around %.';

UPDATE sentences
SET sentence_text = CONCAT('The teacher reviewed how “', SUBSTRING(sentence_text, CHAR_LENGTH('The teacher returned to ') + 1, CHAR_LENGTH(sentence_text) - CHAR_LENGTH('The teacher returned to ') - CHAR_LENGTH(' during the exercise.')), '” is used during the exercise.')
WHERE sentence_text LIKE 'The teacher returned to % during the exercise.';

UPDATE sentences
SET sentence_text = CONCAT('The group discussed how “', SUBSTRING(sentence_text, CHAR_LENGTH('The group discussed how ') + 1, CHAR_LENGTH(sentence_text) - CHAR_LENGTH('The group discussed how ') - CHAR_LENGTH(' works in context.')), '” is used in context.')
WHERE sentence_text LIKE 'The group discussed how % works in context.';

UPDATE sentences
SET sentence_text = CONCAT('The conversation naturally included “', SUBSTRING(sentence_text, CHAR_LENGTH('The conversation naturally included the expression ') + 1, CHAR_LENGTH(sentence_text) - CHAR_LENGTH('The conversation naturally included the expression ') - CHAR_LENGTH('.')), '”.')
WHERE sentence_text LIKE 'The conversation naturally included the expression %.';

UPDATE sentences
SET sentence_text = CONCAT('The lesson showed a useful context for “', SUBSTRING(sentence_text, CHAR_LENGTH('The lesson gives a useful context for ') + 1, CHAR_LENGTH(sentence_text) - CHAR_LENGTH('The lesson gives a useful context for ') - CHAR_LENGTH('.')), '”.')
WHERE sentence_text LIKE 'The lesson gives a useful context for %.';

UPDATE sentences
SET sentence_text = CONCAT('The speaker used “', SUBSTRING(sentence_text, CHAR_LENGTH('The speaker returned to ') + 1, CHAR_LENGTH(sentence_text) - CHAR_LENGTH('The speaker returned to ') - CHAR_LENGTH(' later in the discussion.')), '” later in the discussion.')
WHERE sentence_text LIKE 'The speaker returned to % later in the discussion.';

UPDATE sentences
SET sentence_text = CONCAT('The report used “', SUBSTRING(sentence_text, CHAR_LENGTH('The report uses ') + 1, CHAR_LENGTH(sentence_text) - CHAR_LENGTH('The report uses ') - CHAR_LENGTH(' to qualify the statement.')), '” to qualify the statement.')
WHERE sentence_text LIKE 'The report uses % to qualify the statement.';

UPDATE sentences
SET sentence_text = CONCAT('The speaker included “', SUBSTRING(sentence_text, CHAR_LENGTH('The speaker included ') + 1, CHAR_LENGTH(sentence_text) - CHAR_LENGTH('The speaker included ') - CHAR_LENGTH(' in the explanation.')), '” in the explanation.')
WHERE sentence_text LIKE 'The speaker included % in the explanation.';

UPDATE sentences
SET sentence_text = CONCAT('The lecturer highlighted “', SUBSTRING(sentence_text, CHAR_LENGTH('The lecturer highlighted ') + 1, CHAR_LENGTH(sentence_text) - CHAR_LENGTH('The lecturer highlighted ') - CHAR_LENGTH(' during the example.')), '” during the example.')
WHERE sentence_text LIKE 'The lecturer highlighted % during the example.';

-- Duplicate sentence texts do not add practice variety once provenance is removed.
DELETE duplicate_sentence
FROM sentences AS duplicate_sentence
JOIN sentences AS keeper
  ON keeper.sentence_text = duplicate_sentence.sentence_text
 AND keeper.id < duplicate_sentence.id;

-- Runtime only needs the sentence text and active state.
ALTER TABLE sentences
  DROP INDEX sentences_source_variant_unique,
  DROP INDEX sentences_active_language_index,
  DROP INDEX sentences_source_hash_index,
  DROP COLUMN language_code,
  DROP COLUMN source_key,
  DROP COLUMN source_item_number,
  DROP COLUMN variant_number,
  DROP COLUMN category,
  DROP COLUMN source_hash,
  ADD KEY sentences_active_index (status, id);
