-- Remove sentence rows produced by the rejected generic/metalinguistic templates.
-- The curated sentence seed runs after migrations and restores only reviewed natural sentences.
-- This migration also repairs databases that already ran the earlier quote-based cleanup.

DELETE FROM sentences
WHERE LOCATE(CHAR(34), sentence_text) > 0
   OR LOCATE(CONVERT(0xE2809C USING utf8mb4), sentence_text) > 0
   OR LOCATE(CONVERT(0xE2809D USING utf8mb4), sentence_text) > 0
   OR sentence_text LIKE 'The discussion included useful information about %'
   OR REGEXP_LIKE(
     sentence_text,
     '(practical[[:space:]]+example|short[[:space:]]+example|example[[:space:]]+using|example[[:space:]]+with|clear[[:space:]]+example[[:space:]]+involving|lesson[[:space:]]+returned[[:space:]]+to|teacher[[:space:]]+returned[[:space:]]+to|lecturer[[:space:]]+returned[[:space:]]+to|mentioned.+later[[:space:]]+in[[:space:]]+the[[:space:]]+lesson|used[[:space:]]+in[[:space:]]+context|reviewed[[:space:]]+how.+is[[:space:]]+used|as[[:space:]]+a[[:space:]]+description|best[[:space:]]+description|naturally[[:space:]]+included|useful[[:space:]]+context[[:space:]]+for|term.+came[[:space:]]+up[[:space:]]+during[[:space:]]+the[[:space:]]+discussion|works[[:space:]]+in[[:space:]]+context)',
     'i'
   );

DELETE duplicate_sentence
FROM sentences AS duplicate_sentence
JOIN sentences AS keeper
  ON keeper.sentence_text = duplicate_sentence.sentence_text
 AND keeper.id < duplicate_sentence.id;
