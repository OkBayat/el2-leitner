-- Preserve the existing public vocabulary identity for the Cambridge phrase while removing
-- punctuation that learners should not need to type as part of the answer.
UPDATE vocabulary_entries
SET primary_form = 'you can say that again',
    normalized_form = 'you can say that again',
    canonical_key = 'public:en:you can say that again'
WHERE owner_user_id IS NULL
  AND normalized_form = 'you can say that again!';

UPDATE vocabulary_forms vf
JOIN vocabulary_entries ve ON ve.id = vf.vocabulary_entry_id
SET vf.form = REPLACE(vf.form, '!', ''),
    vf.normalized_form = REPLACE(vf.normalized_form, '!', '')
WHERE ve.owner_user_id IS NULL
  AND vf.normalized_form = 'you can say that again!';

-- Existing sentence-practice rows may have been generated from content that contained an
-- exclamation mark. Remove duplicate dirty rows first, then normalize the remaining rows in place.
DELETE dirty
FROM sentences dirty
JOIN sentences clean
  ON clean.id <> dirty.id
 AND clean.sentence_text = REPLACE(dirty.sentence_text, '!', '')
WHERE dirty.sentence_text LIKE '%!%';

UPDATE sentences
SET sentence_text = REPLACE(sentence_text, '!', ''),
    sentence_hash = SHA2(REPLACE(sentence_text, '!', ''), 256)
WHERE sentence_text LIKE '%!%';
