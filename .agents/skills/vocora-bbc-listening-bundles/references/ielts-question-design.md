# IELTS-style listening question design

Read this reference BEFORE authoring or revising any BBC listening test. Apply it together with `authoring-workflow.md` and the application schema in `back/data/listening/episodes/README.md`. A parseable JSON file is not necessarily a good listening test.

## Source authority and honest claims

Checked on 2026-09-05 against these primary sources:

1. IELTS, Academic Listening format: https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-listening
2. British Council, listening teaching guidance: https://takeielts.britishcouncil.org/teach-ielts/teaching-resources/videos/listening
3. IDP, listening question types: https://ielts.idp.com/prepare/article-question-types-listening
4. IDP, multiple-choice listening guidance: https://ielts.idp.com/prepare/article-ielts-listening-test-multiple-choice-questions

The actual IELTS Listening examination has FOUR parts, TEN questions in EACH part, and FORTY questions overall. Ten is the fixed per-part count and Vocora mirrors that exact count for each BBC practice test. Recordings are heard once and questions follow the order of information in the recording. Each correct answer earns one mark.

Vocora uses short BBC recordings for supplementary IELTS-style practice. EACH practice test must contain exactly TEN scored questions, matching one IELTS Listening part. Headings, options and accepted-answer variants do not count as additional questions. Do not claim that a BBC practice set is an official paper, an accredited IELTS test, a full examination simulation, or a calibrated IELTS band score. Playback controls remain practice aids; this content task must not silently remove them.

Difficulty names and the numerical quality thresholds below are Vocora editorial policy, NOT official IELTS rules. Recheck official guidance when revising this policy. Never infer listening rules from a page about IELTS Reading.

## Official task families versus implemented tasks

The official Listening format describes:

| Official family | What a candidate does | Current Vocora support |
| --- | --- | --- |
| Multiple choice | Select one answer from three options; some official tasks select several answers | `multiple_choice_single`, ONE answer, A/B/C only for authored IELTS-style tests |
| Matching | Match recording items to a shared lettered option list | Not implemented; do not disguise individual MCQs as matching |
| Plan/map/diagram labelling | Relate spoken information to labels on an actual visual | Not implemented; do not invent a map or call prose a diagram |
| Form/note/table/flow-chart completion | Complete a structured outline with recording information, subject to explicit answer limits | `note_completion`; form/table/flow-chart renderers are not implemented |
| Sentence completion | Supply recording words that complete a grammatical sentence | `sentence_completion` |
| Short-answer questions | Answer a focused factual question with a limited number of recording words/numbers | `short_answer` |

Use ALL FOUR currently implemented types in EVERY newly authored or redesigned Vocora test. This is a Vocora variety requirement: IELTS itself does not require every question family in every part. A recommended ten-question blueprint is four coherent groups containing 3 + 3 + 2 + 2 questions. The sequence of task types may vary between tests, but grouping must follow the recording, not reorder it. Each group should normally contain at least two related questions with one consistent instruction and limit. Do not switch types after every single question simply to tick a diversity box.

Other IELTS families require a separate end-to-end feature (domain schema, scoring, API, UI, accessibility and tests) before use. This workflow must not invent unsupported `taskType` values. True/False/Not Given, Yes/No/Not Given, matching reading headings and open-ended opinion essays are NOT substitutes for the implemented IELTS Listening tasks.

## Required authoring sequence

1. Read the current application contract and this policy before writing questions.
2. Read the entire official transcript and check the actual lesson audio, not a different podcast edit with advertisements.
3. Build a private source timeline before selecting question targets. Record ordered answer locations, explicit factual support and potential contrasts. Do not publish a copied full transcript.
4. Select exactly ten worthwhile information targets for each test. Include substantive material from the beginning, middle and later discussion. Do not pad the count with presenter names, the programme title, closing advertisements, unsupported trivia or repeated dictionary definitions.
5. Divide those targets into coherent consecutive task groups. Number questions globally from 1 through N. Group-local `position` restarts at 1; question `number` does not.
6. Write ORIGINAL prompts, choices and answer keys. Do not copy BBC exercises or official IELTS questions. Reusing a source fact across variants is acceptable only with a materially different listening operation; relabelling or superficial rewording is not another test.
7. Record private source evidence for EVERY question: the verified audio interval and an original concise description of what establishes the answer. Keep this authoring evidence out of learner-facing responses. Record the exact audio hash so intervals cannot silently refer to another edit.
8. Review each answer, distractor, sentence completion and limit against the source, then review the complete test in audio order, including transitions between groups.
9. Run the canonical parser AND the question-quality validator. Repair failures; do not bypass the checks or shrink the task.

## Audio chronology: a hard invariant

The answer to Q1 must be available before Q2, and so on THROUGH THE ENTIRE TEST, including task-type boundaries. Never put all notes first and all MCQs later when doing so takes the listener back to an earlier part of the audio. Do not shuffle groups, questions or the underlying evidence sequence.

Use the interval that establishes the answer asked for, not merely the first occurrence of a matching word. A quiz answer confirmed near the end belongs near the end; its introduction near the beginning is not evidence of the correct answer. A quotation later explained or corrected must be interpreted in context. For a question about an explicit initial opinion, use that initial-opinion interval and say so in the prompt. Do not force the learner to remember an unannounced earlier passage after a later group.

Avoid overloading one sentence with several independently numbered items. Leave enough listening space to respond. Do not reuse the same fact twice in a single test. An audio interval is evidence to be checked, not a timestamp invented from a question number. ASR/forced alignment can help locate material but cannot establish factual correctness alone; verify against the official reference. If accurate timing cannot be established, stop and resolve it rather than fabricate evidence.

## Rules for each supported task

### Note completion

Use a descriptive topic heading and concise notes that form a useful outline of the discussion. Test concrete information a listener would naturally note, such as a problem, reason, action, material, outcome or quantity. Prompts are note-like rather than an unrelated list of vocabulary definitions. Include exactly one `{{blank}}` per scored item. The missing word(s) must occur in the recording and fit the note.

### Sentence completion

Use complete, natural sentences with exactly one `{{blank}}`. The completed sentence must be grammatical AND accurately express the source. Check articles, singular/plural forms, tense, prepositions and collocations for every accepted variant. Paraphrase the sentence around the gap, especially at higher difficulty, but do not require the learner to invent a synonym absent from the recording. Do not put the target answer in the heading or instruction.

### Short answer

Ask a precise question about a fact explicitly recoverable from the recording. Specify the relevant speaker/event when necessary. Append one answer blank, as required by the existing renderer. Ask for one response per numbered item. Avoid general-knowledge questions, opinions, vague explanations, several unrelated details under one number, and answers that cannot fit the stated limit.

### Multiple choice, single answer

Use exactly three parallel, plausible options labelled A, B and C and exactly one defensible correct answer. The answer key is the letter, not the option ID. Use the standard instruction to choose ONE letter. Balance answer positions across the test; do not always put the correct option first. Write distractors grounded in a nearby contrast, mistaken attribution, rejected explanation, overgeneralisation, cause/result reversal or incomplete interpretation. An option is not a good distractor merely because it contains a familiar word.

Do not use joke answers, visibly absurd alternatives, length/grammar clues, `all of the above`, two synonymous correct options, or two options that the recording cannot distinguish. Do not introduce a correction, disagreement or exception that the speaker never made. In harder items, record why EACH distractor fails against the recording, not a generic claim that the answer is obvious.

## Answer limits and scoring

The displayed answer instruction and numeric limits MUST agree. Use clear limits such as `ONE WORD ONLY`, `NO MORE THAN TWO WORDS`, or `NO MORE THAN TWO WORDS AND/OR A NUMBER`. Choose the smallest sensible consistent limit for a group; split a group only when both chronology and coherence remain intact. Do not accept a four-word answer in a two-word group.

For completion tasks, take answers from the recording without changing the spoken word form. Synonyms belong primarily in the prompt/options, not in an invented accepted-answer list. Accept alternatives only when the source, meaning, grammar and limit justify them. British/American spelling and appropriate digit/word-number forms can be accepted; unrelated semantic alternatives cannot. Hyphenated compounds count as one word under IELTS guidance. Do not use contractions as answer targets. Keep exact spelling and required singular/plural distinctions; do not enable fuzzy scoring to conceal defective keys.

Test every accepted answer through Vocora's ACTUAL scorer. Also test blank, unrelated, misspelt, wrong-option and over-limit responses where applicable. A machine check proves contract/scoring behaviour, not that an authored question is meaningful.

## Difficulty rubric

| Level | Language and listening demand | What must NOT change |
| --- | --- | --- |
| `very_easy` / `easy` | Familiar vocabulary; clear local anchors; mostly explicit details; short prompts; limited but natural rephrasing; distinct yet credible options | Minimum count, four task types, source support, chronology, grammatical quality and answer limits |
| `medium` | Moderate lexical and structural paraphrase; selection between nearby details; reasons, purposes or consequences made clear in the source; fair speaker attribution | No invented facts, irrelevant complexity or ambiguous scoring |
| `hard` / `very_hard` | Substantial paraphrase/synonyms in stems or options; less direct cues; careful distinction of cause from effect, qualification, attitude or contrasted explanations; plausible closely related distractors | The correct answer remains objectively supported; completion answers remain words actually spoken |

As a reviewable Vocora guardrail, at least half of hard/very-hard questions must genuinely require paraphrase recognition, and at least two must require an evidenced contrast, qualification, attitude or cause/effect distinction. Medium tests should include meaningful paraphrase rather than pure transcription throughout. Easy tests should predominantly target explicit local detail. Annotated claims of paraphrasing are not enough: a reviewer must compare source meaning and question wording.

Do NOT manufacture difficulty by obscure wording unrelated to the recording, longer answer limits, missing context, trick grammar, outside subject knowledge, unsupported inferences, faster artificial playback, fewer questions or a different badge. Both variants at the same difficulty must use materially different targets or listening operations. Compare complete prompt sets and answer sequences; reject duplicate tests.

## Definition of done

Every affected test must have exactly ten genuine scored questions, all four currently supported task types, sequential numbering 1–10, coherent instructions, valid answer limits, unique stable identities and verified forward-only source evidence. Preserve episode identities and test routes when editing existing content. Do not destroy completed attempt snapshots or learner progress.

Automate what is deterministic: count, supported type coverage, positions, IDs, instructions/limits, option shape, duplicate prompts, evidence presence/order/range, audio identity and scoring fixtures. Keep source truth, naturalness, distractor fairness and difficulty calibration agent-owned. Both reviews are required; neither substitutes for the other. Report exactly which checks ran and any limitations. Never equate schema-valid with pedagogically sound.

## Recording the review without a manual hash fallback

Use the file-only `sourceReview` and `evidence` contract in `back/data/listening/episodes/README.md`. After semantic review, run `node back/scripts/record-listening-question-review.js --episode <episode-dir> --confirm-reviewed --require-audio`, then the canonical episode validator. Do not calculate/paste a replacement digest by hand or interpret a digest as independent certification. A changed question or evidence interval invalidates the review binding until reviewed again. Reference text, ASR output and audio are not committed as part of this audit trail.
