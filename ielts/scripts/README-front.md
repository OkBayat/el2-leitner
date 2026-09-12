# Vocora IELTS Academic: From Foundational English to Band-9 Readiness

**An evidence-informed, lesson-by-lesson self-study curriculum and authoring specification**  
**Version:** 1.0 · **Research and repository review:** 9 September 2026  
**Repository inspected:** `OkBayat/vocora` at `03e581fb95aefa27268baff5a324948576728b66`  
**Scope:** Listening, Academic Reading, Academic Writing and Speaking; the aspirational endpoint is **9 in each skill**, not merely an overall score rounded to 9.

> **Read the status correctly.** This package provides 960 ordered lesson designs, expanded target-specific exercise/slide specifications, and 12 authored reference packs. It does **not** contain 960 finished lessons or a deployed course. Most long-form texts, recordings, item-specific answer banks, sealed tests and productive-scoring calibration remain to be produced. The design is evidence-informed; its effectiveness as a complete course has not been tested. No completion rule can truthfully guarantee every learner an official IELTS 9.

## Contents

1. Outcome contract, scope and actual deliverables
2. Repository audit and implementation boundaries
3. Evidence-to-design reasoning
4. Course architecture and the 12-stage progression
5. Language system: vocabulary, grammar, chunks and relationships
6. Lesson and slide design
7. Four-skill development and IELTS techniques
8. Error correction, spaced review and adaptive repair
9. Placement, mastery gates and assessment integrity
10. Self-study feedback for Speaking and Writing
11. Study rhythm, motivation and accessibility
12. Original content and media authoring contracts
13. Runtime integration and data contracts
14. Content QA, calibration and release criteria
15. Example lesson: what the learner actually does
16. Implementation and content-production backlog
17. Files, reproducibility and validation
18. All 960 lesson specifications
19. Twelve authored reference packs
20. Source register and evidential limits

---

## 1. Outcome contract, scope and actual deliverables

### 1.1 What the course is trying to accomplish

A learner entering with performance around IELTS 3 should first acquire usable English, not be pushed into full-length examination drills that they cannot understand. The course progressively develops receptive comprehension, accurate and flexible language use, extended production, test literacy and performance under examination constraints. The destination is repeated independent performance consistent with the highest official descriptors, including unfamiliar tasks and topics. Official IELTS scores depend on actual examination performance, not the number of lessons, cards, study hours or words completed. [I01, I06, I07]

The four skills are tracked separately. A strong Reading result cannot compensate for a persistent Speaking weakness in the course's **four-9 readiness goal**, even though the official overall-score calculation aggregates component scores. Early-stage labels such as “3 → 3.5” are orientation labels for curriculum demand, not validated predictions or a one-to-one conversion to CEFR. [I01, I08]

“Without a teacher” means the learner does not need a personal tutor to interpret instructions, find missing materials or obtain routine feedback. It does **not** mean that a provider can dispense with qualified content reviewers, assessment specialists, recorded speakers or independent validation. Those are product-quality responsibilities. An autonomous learner experience is compatible with expert-designed and periodically audited content.

The course is **IELTS Academic**. Listening and Speaking preparation is broadly shared with General Training, but Academic Reading and Academic Task 1 must not be presented as General Training preparation. A General Training route would require its own reading genres and letter-writing curriculum; it is not silently included here. [I02–I05]

### 1.2 What exists in this package

| Deliverable | Actual quantity | Meaning of the count |
|---|---:|---|
| Stages / thematic units / ordered lessons | {{stages}} / {{units}} / {{lessons}} | Explicit curriculum designs, not completed runtime lessons |
| Required exercise specifications | {{required_exercises}} | Ordered instructional and assessment objectives with slide arrays |
| Conditional repair specifications | {{conditional_exercises}} | Target-specific plans used only after relevant errors; not compulsory repetition |
| Total exercise specifications | {{exercise_specs_total}} | Required plus conditional; retries are not counted as new exercises |
| Authoring slide specifications | {{authoring_slide_specs}} | Provisional authoring envelopes, not a claim of finished screens or unique questions |
| Unit-bank lexical occurrences | {{lexical_occurrences_in_unit_banks}} | {{unique_lexical_strings_in_unit_banks}} distinct strings; occurrence is not a distinct word sense or word family |
| Unit-bank chunk occurrences | {{chunk_occurrences_in_unit_banks}} | {{unique_chunk_strings_in_unit_banks}} distinct strings; overlap with lexical entries is possible |
| Authored grammar / discourse diagnostics | {{authored_grammar_diagnostics}} | Worked contrast, corrected illustration and explanation for every unit |
| Authored reference packs | {{authored_reference_packs}} | {{authored_reading_passages}} reading passages, {{authored_listening_scripts}} listening scripts, productive prompts and model writing |
| Keyed comprehension questions in those packs | {{authored_keyed_comprehension_items}} | Actual prompts, answers and rationales, not merely item templates |
| Authored sense-specific lexical entries in reference packs | {{authored_lexical_entries}} | Definitions, contextual grammatical labels and examples |
| Recorded audio / sealed full mock forms / runtime-ready lessons | {{recorded_audio_assets}} / {{sealed_full_mock_forms}} / {{runtime_ready_lessons}} | These are explicit production gaps, not hidden deliverables |

A slide may contain a whole coherent form with several answer fields, while another is a single exposure card. Therefore **slide count is not question count**, and question count is not learning quality. The conditional bank does not inflate the number of required tasks a learner must perform. It provides a distinct repair plan for a word or chunk that can fail independently.

The term `placeholder` is required by the inspected Vocora **authoring contract**. It does not automatically mean the educational text is absent: the reference packs include actual educational content inside that provisional envelope. Conversely, many generated slides explicitly say **AUTHORING BRIEF** because their final prompt, stimulus or answer bank has not been written. Both distinctions are preserved. [V01, V02]

### 1.3 What cannot be concluded

There is no evidence that these exact 960 lessons, these exact stage boundaries, this number of words, or this arrangement of exercises causes universal attainment of band 9. Studies supporting retrieval, feedback, explicit instruction or spacing do not establish the effectiveness of this entire product. Learner progress is heterogeneous; a reported preparation study found variable score gains rather than a universal rate of improvement. [R01, R02, R06, R07, R10, R11]

The accurate product claim at this stage is: **“A comprehensive design for a self-study route towards the language and examination demands of IELTS Academic, with explicit content, implementation and validation requirements.”** “Finish this and you are guaranteed 9” is not an acceptable alternative.

---

## 2. Repository audit and implementation boundaries

### 2.1 Snapshot used

The connected repository was inspected directly. A request for the historical `learning-path` branch returned no such ref; the branch listing did not contain that branch. Consequently, this design uses the existing **main commit pinned above**, rather than claiming to have read a nonexistent branch. No repository files were changed, no branch was created and no pull request was opened for this task.

The principal inspected files were:

```text
.agents/skills/k2-lesson-exercise-design/SKILL.md
.agents/skills/k2-lesson-exercise-design/references/learning-design-rules.md
.agents/skills/k2-lesson-exercise-design/references/output-contract.md
.agents/skills/k2-lesson-exercise-design/scripts/validate-lesson-plan.py
docs/COLLECTION_LEARNING_PATH.md
docs/SAME_SESSION_SPELLING_REMEDIATION.md
```

Full pinned source links appear in [V01–V06]. This is an inspection of these authoritative documents and the authoring validator, not a claim that every frontend component, database migration or production deployment was audited.

### 2.2 Rules carried into this design

| Verified Vocora rule | Consequence for this course |
|---|---|
| A Learning Path belongs to an existing collection | Stage content uses collections and shared vocabulary identities; it does not create a competing content domain |
| A path lesson is not a `collection_section` | Stable lesson IDs and ordered exercise definitions are authored separately |
| Vocabulary-led lessons start with intake, then spelling/dictation | Every canonical lesson in this package uses exactly this opening |
| The same eligible scope belongs to both opening exercises | Words and eligible chunks introduced/retrieved in that lesson appear in both, without silently omitted items |
| Unseen vocabulary activates in House 1 | Already-known words retain their existing state; encountering a word in another stage does not reset it |
| Later exercise choices depend on content and prerequisites | The primary lesson role changes the additional depth; optional repair depends on actual errors |
| A design prerequisite graph does not imply a deployed runtime DAG | The plans have backward-only reasoning edges but retain a linear executable order |
| The server owns progression and verifiable outcomes | A click or client-supplied success flag is not proof of listening, speaking or mastery |
| Existing listening, shadowing and Leitner domains remain authoritative | The path references them rather than copying their attempts, schedules or scoring state |
| Repeat practice does not erase completed progress | Historical completion and current readiness are different concepts |

These rules are repository requirements, not independent educational findings. [V01–V05]

### 2.3 Existing, provisional and proposed capabilities

The inspected architecture describes `vocabulary.intake`, `vocabulary.quick-review`, `vocabulary.mastery-check`, `listening.ielts`, `speaking.shadowing` and `slides.sequence`. A slide sequence can submit responses for server-side verification; its runtime deck has exactly one terminal final slide. The provisional **authoring** contract instead has the 16 interaction types listed in §6 and no `final` type. A future compiler must bridge these deliberately distinct representations. [V02, V04]

The inspected `slides.sequence` documentation states that **Speaking and Writing responses provide production evidence but are not auto-scored**. It also distinguishes a formative original IELTS-style slide exercise from an authoritative listening-domain attempt. Therefore this document does not claim that today's app already supplies complete IELTS feedback or sealed four-skill examinations. [V04]

The following are **proposed extensions**, not verified current features: automatic weakest-skill placement; conditional routing for non-spelling errors; a readiness dashboard that can fall independently of historical completion; calibrated Writing and Speaking feedback; a full four-skill mock-test orchestrator; and a compiler from this authoring envelope to verified runtime contracts. Their absence is a release blocker, not a reason to fake their outputs.

---

## 3. Evidence-to-design reasoning

### 3.1 The level of claim must match the evidence

Three types of justification are kept separate:

**Official test specifications** define what is tested, the task shapes, timing and rating criteria. They do not prescribe a universal course sequence. [I01–I11]

**Research findings** support narrower learning principles. A vocabulary experiment is not proof that a speech model can award band 9; a classroom feedback study is not a validation of any arbitrary automated feedback system. [R01–R14]

**Vocora design synthesis** chooses topics, lesson boundaries, prerequisite edges, practice formats, scheduling interfaces and provisional thresholds. Every such choice can be revised after pilot data. “Research-backed” must never be used to disguise a product decision as an experimentally established law.

### 3.2 Evidence-to-implementation matrix

| Principle / evidence | Concrete course decision | Limit on the inference |
|---|---|---|
| Retrieval practice [R01] | After exposure, ask for a word, explanation, sentence or supported answer without showing the solution | Does not prove the entire lesson order or a score gain per retrieval |
| Spacing in L2 learning [R02] | Revisit targets across sessions through existing Leitner; use delayed new-context checks | No universal optimum of 1/3/7 days; the course must not replace the scheduler |
| Multiple dimensions of lexical knowledge [R03] | Separate meaning, form, role, aural recognition, collocation and productive use | A multiple-choice meaning answer cannot certify all dimensions |
| Focused collocation learning [R04] | Match partners, recall a missing partner, then use the chunk in context | Does not justify stuffing every chunk into every response |
| Four strands framework [R05] | Include meaning-focused input, output, language-focused learning and fluency work in the weekly experience | Rough balance is a design framework, not an exact experimentally mandated 25% per day |
| Oral corrective feedback [R06] | Elicit a repair of a specific communication/language problem, then test a fresh follow-up | Classroom findings do not validate uncalibrated speech-model ratings |
| Written corrective feedback [R07] | Preserve the draft, explain selected errors, revise and transfer | Better accuracy alone does not establish task response, argument or overall Writing 9 |
| AI-in-preparation research [R08] | Require evidence-based feedback, uncertainty disclosure and calibration; separate assistance from scores | The report is not a universal efficacy trial of app-only learning |
| Preparation practices research [R09] | Explain task demands and score interpretations within the app rather than assume assessment literacy | Reported practices/experiences do not establish causal effectiveness |
| Variable progression [R10] | Let actual per-skill evidence determine continuation and repair, not a calendar promise | Do not extrapolate a cohort average into a time-to-9 guarantee |
| Explicit L2 instruction [R11] | Brief rule/meaning explanation, worked contrast, controlled application, then communication | Narrow instructed-test gains do not establish unrestricted transfer |
| Extensive reading [R12] | Add an in-app graded reading library with genuinely easy, meaning-focused reading | Intensive questions attached to every paragraph are not the same activity |
| Fluency through task repetition [R13] | Selective repeated speaking after diagnosis, followed by a different prompt | Small-study evidence does not prescribe faster speech, a universal timer or identical memorised answers |
| Listening-process instruction [R14] | Predict information categories, monitor understanding, compare evidence and evaluate a failure | Do not allow process scaffolds or replay inside a sealed exam and call it equivalent performance |

Research IDs and actual source references are attached to every exercise object. Those references justify its **learning mechanism**, not the invented content facts of a fictional passage. Exact source access and exclusions are documented in §20.

### 3.3 Books inform coverage, not licensed reproduction

The publisher descriptions of *The Official Cambridge Guide to IELTS*, *Essential Grammar in Use*, IELTS Grammar, IELTS Vocabulary, *English Vocabulary in Use: Advanced* and *English Collocations in Use* were used as scope checks. Foundational form, vocabulary in context, explicit word partnerships and integrated exam work should all be represented. The complete commercial books were **not** inspected, and this course is not a page-by-page reproduction or a licensed adaptation. [B01–B06]

The original reference passages, scripts, question stems and sample responses in this package were composed for Vocora. Fictional data are labelled. For an actual book-based extension, the author must inspect the licensed unit, enumerate its targets and identify every additional task as a `vocora_extension`, in accordance with the repository rule. Original commissioned curriculum content may serve as the lesson source; that does not make it a textbook extract. [V01, V02]

---

## 4. Course architecture and the 12-stage progression

### 4.1 Hierarchy and stable identity

The design has **12 stages × 10 thematic units × 8 ordered lessons = 960 lessons**. Stage names express developing capabilities. The same broad domains return with more demanding purposes, discourse and evidence requirements; this is intentional spiralling rather than 120 unrelated topics.

A proposed course-level presentation groups the stages. The current verified engine is collection-scoped, so the practical integration can use one finite path per stage collection, with a thin course-level overview linking them. That overview and cross-path gating require an explicit implementation decision; they are not assumed existing API behavior. Alternatively, one collection can hold the full finite path if repository content and navigation constraints permit. Do not create 12 competing vocabulary-progress systems. [V04]

Authoring IDs are stable: `S01-U01`, `L0001`, `L0001-E01`, `L0001-E01-S01`. These are content IDs, not a claim that the public API uses these values as numeric route IDs. Preserve a mapping when content is synchronized.

### 4.2 Stage map

{{stage_table}}

The full stage specifications include input length envelopes, speech/response demands, grammar focus, phonology, scaffolding and gate evidence. They are in `data/stages.json` and the lesson appendix. The orientation labels are **not official IELTS cut scores**.

### 4.3 Ten recurring domains

The domains are food and food systems; homes and housing; people and society; learning and research; work and the economy; transport and travel; health and services; the natural environment; technology and digital systems; and culture and media. A beginner describes a meal. An advanced learner can evaluate uncertainty in a food-supply decision while preserving the difference between observed evidence and a proposed explanation. Specialist factual knowledge must always be supplied by the task rather than demanded as hidden background knowledge.

Each thematic unit includes 24 **core lexical entries** and six target chunks. These are authored selections, not claimed corpus-frequency or CEFR classifications. A six-word early subset is a manageable design starting point; it must be adjusted if pilot completion, comprehension or delayed recall reveals overload. Later unit-review lessons retrieve the wider unit set rather than introducing 30 new items at once.

### 4.4 Eight lesson roles within a unit

| Position | Dominant purpose | What becomes deeper, while the other skills remain present |
|---|---|---|
| 1 | Form and meaning | Sense-specific lexical representations; first simple use |
| 2 | Sentence architecture | Heads, roles, agreement, complements and meaning-form relationships |
| 3 | Chunks and spoken recognition | Collocation discrimination, retrieval and sound boundaries |
| 4 | Reading with evidence | Coherent text comprehension, task-family mechanics and evidence |
| 5 | Listening with evidence | Speaker tracking, corrections, discourse and task constraints |
| 6 | Speaking for a listener | Relevant response, development, intelligibility, repair and follow-up |
| 7 | Writing for a reader | Task requirements, organisation, draft, revision and transfer |
| 8 | Integration and transfer | Wider unit retrieval and unfamiliar four-skill performance |

This is a curriculum organization, not a claim that every lesson should have exactly the same exercise list. Each role adds different subskills; later stages add paraphrase or qualified inference only when those capabilities are part of the demand. Repair exercises are conditional and are not compulsory padding.

### 4.5 How difficulty increases

Increase difficulty along meaningful dimensions, rather than making everything longer or inserting rare words:

- **Language:** simple propositions → clause relations → flexible, precise, qualified discourse.
- **Input:** explicit local detail → connected explanation → implication, competing perspectives and information density.
- **Output:** intelligible short response → developed organisation → sustained, well-supported and flexible response.
- **Support:** worked model and replay → partial cue → no answer-bearing support on a new task.
- **Conditions:** generous training time → complete task conventions → realistic integrated timing and first-play listening.

Not every later lesson must be more difficult than the preceding one in every dimension. Retrieval and fluency practice intentionally revisit easier material. A strictly increasing staircase with no consolidation would contradict the purpose of review. The progression is in the **independent capability expected**, not constant item difficulty.

At the highest stage, the objective is precision and effortless relevance, not obscurity. Rare words, elaborate syntax, an artificial accent or memorised “band-9 phrases” are not substitutes for the official criteria. [I06, I07]

---

## 5. Language system: vocabulary, grammar, chunks and relationships

### 5.1 Word knowledge is represented by sense and use

A lexical target should ultimately have: lemma and sense ID; written form; contextual part of speech; pronunciation variants; plain-English meaning; useful L1 gloss where appropriate; countability/transitivity or another relevant usage constraint; common partners; one ordinary example; and links to related forms. These are **content-authoring requirements**, not invented runtime fields in the canonical lesson object. Store them in the owning content domain or an approved sidecar contract. [R03, V02, V04]

The course's lexical strings are a core teaching inventory, not a complete dictionary. The normalized unit banks contain {{unique_lexical_strings_in_unit_banks}} distinct strings, including some multiword expressions, and {{unique_chunk_strings_in_unit_banks}} distinct chunk strings. These figures must not be added and advertised as “unique words mastered”: overlap, polysemy and word-family relationships prevent that interpretation.

The core list alone is **not evidence of sufficient vocabulary for band 9**. Advanced independent comprehension also requires substantial meaningful exposure and the ability to infer and confirm unfamiliar language. The release therefore includes an in-app extensive-reading and listening-library requirement, plus a controlled route for useful newly encountered vocabulary to enter the existing shared inventory. No fixed “IELTS requires exactly N words” claim is made. [I01, R03, R12]

### 5.2 The relationship graph the learner learns

Teach relationships through sentences rather than labels in isolation:

| Relationship | Beginner representation | Later extension / diagnostic |
|---|---|---|
| Subject and finite verb | `I eat rice.` Identify who performs the action and where the verb is | Find the head of a long subject phrase before selecting agreement |
| Verb and object | `She drinks water.` Distinguish action from the affected/selected object | Verb complementation: `suggest doing`, `allow someone to do`; meaning-specific patterns |
| Noun and adjective | `a small room`; `the room is small` | Adjective scope, noun-phrase embedding and evaluation versus observation |
| Verb and adverb | Explain how an action happens without calling every `-ly` form a rule | Adverb position, stance adverbs and the scope of `only`, `generally`, `apparently` |
| Determiner and noun | Count/uncount distinction in the intended sense | Articles with generic and abstract reference; quantifier strength |
| Clause and clause | `because`, `but`, time relations | Concession, condition, counterfactual, limitation and causality versus association |
| Form and family | Related forms where the meaning link is useful | Derivation does not license every possible suffix or guarantee the same register |
| Word and partner | `have breakfast`, `heavy rain` | Register, complement patterns and choosing a natural partner rather than a near-synonym |
| Reference across sentences | Who `she`, `it` or `they` refers to | Ambiguous antecedents, reference chains, this/that + summary noun |
| Claim and evidence | What was explicitly stated | What follows, what is merely possible, and what remains unknown |

These are the course's operational learning targets. Explicit form instruction and multidimensional vocabulary research support teaching and testing more than surface recognition; the exact graph is a design synthesis. [R03, R04, R11]

### 5.3 A concrete grammar cycle

For `The room are small`:

1. Establish the intended meaning and show `The room is small`.
2. Identify the subject head `room`, not simply the nearest visible noun.
3. Explain the singular subject and `is` relationship.
4. Ask for a corrected response with the model removed.
5. Change the context: a plural subject, or a longer noun phrase at a suitable stage.
6. Look for the relationship again in a later independent spoken or written response.

A correction of the displayed example is evidence of **repair**, not evidence that the learner can use agreement automatically. The same distinction applies at an advanced level to preserving a claim's scope or separating a measured effect from an assumption.

Some upper-stage diagnostics are discourse or reasoning contrasts rather than malformed grammar. The feedback must say “the sentence overstates the evidence” when that is the problem, rather than incorrectly labelling a grammatical sentence ungrammatical.

### 5.4 Managing new language and reuse

Lessons 1–4 of a unit introduce six-word subsets. Later lessons reuse combinations of those items and the unit's chunks. “Introduce” means bring the target into this course context; a learner may already know it globally. Use existing shared identity and activation rules. [V01, V04]

When a target reappears, vary the **retrieval dimension**: definition → aural recognition → contextual role → collocation → message production. Merely showing the same four options on a new background is not the intended progression. A word need not appear naturally in every paragraph or response. Target coverage belongs to the whole planned task sequence, not to an unnatural requirement to force every word into one answer.

---

## 6. Lesson and slide design

### 6.1 Fixed opening, then a justified sequence

Every vocabulary-led lesson here starts with:

**Exercise 1 — `vocabulary_intake`.** Introduce all lesson-eligible words and chunks. Establish the intended meaning, expose pronunciation when available and activate only unseen shared entries in House 1. Include supported recognition. The event means exposure/intake, not mastery.

**Exercise 2 — `spelling_dictation`.** Use exactly the same eligible scope. Require typed form recall from an aural or suitably constrained cue. Hide the author-side transcription. Occasional recognition scaffolding does not replace typed retrieval of the main scope.

These are exact repository requirements. Every later exercise must justify its targets, earlier prerequisites, response evidence and source references. [V01–V03]

For this integrated course, units deliberately specify lexical, grammatical, receptive and productive targets. That content justifies a basic progression through contextual use, grammar, chunks, an aural bridge, intact reading/listening, independent production and revision. The lesson's main role determines further depth. No type is added merely to demonstrate a UI component.

### 6.2 The 16 authoring interactions

| Slide type | Appropriate cognitive action | Required feedback / design protection |
|---|---|---|
| `teaching-card` | Explain or model one relationship | Exposure is not scored retrieval; later test answers are not pre-disclosed |
| `choice` | Discriminate meanings, claims or options | One defensible key or an explicitly specified multiple-selection rule; plausible alternatives |
| `truth` | Classify support, contradiction or missing evidence | Distinguish not stated from false; opinions use the appropriate agreement distinction |
| `matching` | Connect a heading, feature, speaker or partner | Clear many-to-one/reuse rules; grade the whole assignment where needed |
| `classification` | Identify contextual roles or evidence classes | Supply boundaries and legitimate alternatives; do not classify words without a sentence |
| `ordering` | Reconstruct a real process, argument or sentence order | There must be a meaningful order; accept multiple valid structures where possible |
| `cloze` | Retrieve a missing form or partner in context | Avoid unintended synonyms; distinguish exact-source completion from free language use |
| `structured-completion` | Complete a coherent form, table, notes or planning structure | Preserve the shared stimulus, numbering, word limits and all linked fields |
| `short-answer` | Retrieve or explain with reduced support | Separate the scored answer from an optional explanation/evidence span |
| `word-formation` | Produce an attested related form fitting the sentence | Use only verified families; never generate a derivative just because a suffix exists |
| `error-correction` | Diagnose and repair a particular mismatch | Do not invent errors; distinguish form, meaning, organisation and unsupported claims |
| `rewrite` | Preserve or improve meaning under a stated constraint | Allow natural alternatives; synonyms that change scope are not equivalent |
| `pronunciation` | Notice and practise intelligibility-related sound features | Audio evidence is needed; accent difference alone is not an error |
| `dictation` | Convert an aural cue to written form | No hidden transcript leaks; specify spelling variants and multiword boundaries |
| `speaking-response` | Produce and record a meaningful response | An uploaded recording proves participation, not an automatically valid band |
| `writing-response` | Compose an independent written response | Preserve draft, assistance state, rubric evidence and revision separately |

The type allowlist and placeholder structure are verified authoring rules, not an assertion that a final production data schema was checked for every component. `word-formation` is available but not used merely to fill a quota: a proper morphological-family bank is still required before adding such items. [V02]

### 6.3 Practice and assessment are different modes

| Property | Learning / repair | Cumulative check | Full mock / readiness evidence |
|---|---|---|---|
| Hints / models | Appropriate, progressively withdrawn | No answer-bearing hints | None |
| Audio replay | Allowed when teaching the subskill | Defined in the task; unassisted check normally first play | Once-only IELTS Listening conditions |
| Transcript | Reveal after an attempt when teaching | Not before or during the scored task | Never during the listening attempt |
| Feedback | Immediate when it helps; group-delayed if answers are linked | After the whole coherent task | After submission of the section/test |
| Reattempt | Useful, labelled repaired or repeated | Use a fresh parallel form for independent evidence | Retire exposed items from the sealed pool |
| Score meaning | Learning evidence | Local competency evidence | Provisional readiness only after calibration |

Changing mode changes the allowed assistance, not merely the colour of the page. The server should reject a “no-hints” claim inconsistent with its recorded interaction history. Existing runtime controls must be verified before this policy is enabled. [I02, V04]

---

## 7. Four-skill development and IELTS techniques

### 7.1 Listening: from word recognition to a complete recorded message

Early work trains meaningful sound boundaries, familiar words, literal detail and recovery after a missed phrase. Later work adds speaker purpose, corrections, agreement, paraphrase, academic explanation and inference. Pre-listening activity teaches useful language and information categories; it must not give the factual answers to the later listening task. [R03, R14, V03]

For a beginner, use a short natural exchange about a meal, ask for the item actually chosen and only then reveal the transcript. For an intermediate learner, include an initial suggestion followed by a correction. At advanced stages, ask which concern the speaker endorses, not merely which concern was mentioned. A stronger learner may correctly hear every word and still need work on interpreting the relationship between ideas.

The exam blueprint contains four parts with 10 questions each: a social dialogue, a social monologue, an educational/training conversation and an academic monologue. Recordings are played once in examination conditions. Practice must therefore eventually cover both conversations and monologues, not just word-level dictation or shadowing. [I02]

| Task family | How it is taught | What the learner must eventually do |
|---|---|---|
| Form / note / table completion | Predict likely word class and information type; follow the form's structure | Type the actual stated information with valid spelling and word count |
| Flow-chart / sentence completion | Follow sequence, condition or cause in a coherent message | Preserve grammatical fit and distinguish a previous idea from the final answer |
| Multiple choice, single or multiple | Compare meanings before listening; recognise distractors as possibilities rather than keys | Select according to the complete question, not a repeated word |
| Matching | Track speakers/features and inspect whether options can be reused | Attribute the correct view, action or reason |
| Plan / map / diagram labelling | Establish the reference point and orientation; follow relative locations | Track movement and spatial relations without losing the shared visual |
| Short answer | Identify the requested category and constraint | Give the concise answer, not an unnecessary explanatory sentence |

The scheduled family appears in every unit specification. The curriculum also needs dedicated **diagram-labelling** assets and complete recordings representing all four parts; a plan-label entry in a text manifest does not produce a map or a real listening test. These are content-production requirements.

Teach recovery explicitly: when one answer is missed, keep track of the next number, listen for the next useful anchor and avoid missing three subsequent answers while reconstructing one. Do not turn this into permission to guess without listening. In practice, diagnose whether the loss arose from vocabulary, segmentation, reference, inference, spelling or attention to task constraints.

Computer-delivered IELTS Listening has an end-of-test checking period rather than the old paper-format ten-minute transfer routine; the reviewed IDP guidance specifies two minutes. The official 2026 delivery update is market-dependent, so the application must use a verified test-mode profile rather than hard-code one historical paper procedure for every candidate. [I10, I11]

### 7.2 Reading: understand the text, then apply the task mechanics

Reading work progresses from stated people/actions/objects to reference chains, paragraph purpose, comparison, argument, attitude, inference and qualified claims. The course teaches both fluent comprehension and task-specific evidence checking. Keyword recognition is a starting aid, not a complete reading method.

The Academic Reading test has 40 questions in 60 minutes across three sections, with a combined text length of approximately 2,150–2,750 words. A collection of isolated two-sentence screens cannot substitute for that integrated demand. The reading interface must keep the complete passage accessible while the learner handles linked questions. [I03]

| Family | Practice progression | Common error to diagnose |
|---|---|---|
| True / False / Not Given | Find the exact claim; decide whether it is supported, contradicted or not established | Calling an unstated claim false because it seems unlikely |
| Yes / No / Not Given | Identify the writer's view and its scope | Confusing another person's quoted view with the writer's position |
| Matching headings | Summarise paragraph function before viewing alternatives | Choosing a heading from one attractive detail |
| Matching information | Search for a specified fact or relationship and verify it in context | Assuming every matching family follows passage order |
| Matching features | Track names/categories and their attributed properties | Matching a nearby name rather than the actual attribution |
| Matching sentence endings | Check meaning and grammatical compatibility together | Completing a plausible sentence unsupported by the passage |
| Multiple choice | Read the question precisely and eliminate distortions using evidence | Selecting shared vocabulary rather than the best supported meaning |
| Completion / short answer | Respect source wording, answer limit and grammatical fit | Supplying an accurate idea in an invalid answer format |
| Diagram labelling | Connect descriptions to the visual's parts and relations | Treating labels as independent vocabulary questions |

Summary, note, table, flow-chart and diagram completion require separate production assets where the representation changes the task. Do not claim that a generic cloze automatically covers all of them. Question-order rules must be attached to the actual family and item set, not presented as “IELTS answers always follow the text.” [I03]

A separate in-app graded library provides meaning-focused extensive reading. It should offer choice and texts easy enough to understand without stopping at every sentence. Ask for a brief response or summary where useful, not a heavy examination after every page. The extensive-reading evidence supports including this experience, while the precise library size and allocation require piloting. The actual library is not included in this package. [R12]

### 7.3 Writing: sentences, connected meaning and two complete task types

The course starts with complete messages rather than essay templates. It develops accurate sentences, reference, paragraph purpose, development, comparison and organisation before expecting full examination responses. A 60-word paragraph is valid training when labelled as such; it is not a completed IELTS Task 2.

Academic Writing lasts 60 minutes. Task 1 requires at least 150 words and Task 2 at least 250; Task 2 contributes twice as much to the Writing score. A 20/40-minute division is a preparation strategy consistent with the task demands, not a separate scored criterion. [I04]

**Task 1 progression.** Identify what is represented, units and time scope; distinguish overview from detail; select the main features; group meaningful comparisons; report numbers accurately; and avoid unsupported explanations. The curriculum explicitly rotates line graphs, bars, tables, pie charts, maps, processes, mixed visuals and non-time comparisons. Every visual must have clear labels, units, dates, readable values and consistent totals. A process should show its actual order; a map should support the stated spatial comparison. [I04, I06]

Teach numeric language directly: percentage versus percentage point, increase **by** versus increase **to**, level versus change, proportional comparison, approximation justified by the visual, and exceptions to the overall pattern. A polished sentence with the wrong number or invented causal explanation remains a problem.

**Task 2 progression.** Identify all parts of the prompt; choose a defensible position where required; develop reasons with explanation and relevant illustration; consider another view where the task demands it; maintain a coherent line of reasoning; and conclude without inserting an unprepared new argument. The course rotates opinion, discussion of both views, advantages/disadvantages, outweigh, causes/solutions, problems/solutions, paired direct questions and evaluation prompts. These are useful practice groupings, not a promise that every future task fits a memorised template. [I04, I06]

For later stages, precision matters more than ornament. The learner should distinguish an example from evidence, qualify a claim without becoming evasive, acknowledge an exception and avoid repeating a claim as if repetition developed it. References to research, statistics or studies must not be fabricated in the learner's model essay. Fictional illustrations should be framed as examples, not as real survey findings.

Feedback follows the four official Writing dimensions: task achievement/response, coherence and cohesion, lexical resource, and grammatical range and accuracy. A response must not receive a high readiness estimate merely because it exceeds the word minimum, contains complex sentences or includes several target words. Model answers illustrate choices; they are not the only acceptable response or an examiner-certified score. [I06]

### 7.4 Speaking: communication, not shadowing alone

The course moves from an intelligible personal answer to developed description, narrative, explanation, comparison, hypothetical discussion and flexible handling of a follow-up. Shadowing can support a particular aural or pronunciation goal, but repeating someone else's message is not equivalent to formulating an independent answer.

The Speaking test has three parts and normally lasts 11–14 minutes. Preparation must include familiar questions, a long turn with preparation time, and a more abstract discussion related to its theme. The Part 2 training route must eventually include approximately one minute to prepare and a one-to-two-minute response, with appropriate follow-up interaction. [I05]

| Speaking phase | Early preparation | Later independent demand |
|---|---|---|
| Part 1 | Answer a familiar question with a direct statement and useful detail | Respond naturally without a memorised monologue or irrelevant extension |
| Part 2 | Plan a few ideas; organise who/what/when/why; practise a coherent short account | Sustain a relevant long turn from brief notes, with flexible development |
| Part 3 | Compare two ideas, give a reason and explain an example | Discuss implications, alternatives, conditions and limitations while answering follow-ups |

The assessment dimensions are fluency/coherence, lexical resource, grammatical range/accuracy and pronunciation. Pronunciation work targets intelligibility, meaningful prominence, boundaries and control; a native accent is not a requirement. Speaking feedback needs the audio, because an ASR transcript omits or distorts important evidence about timing, sound and delivery. [I07]

Select one or two high-value issues per repair cycle. The learner listens to the relevant excerpt, tries a better version and then answers a different question. A repeated speech may improve a practiced performance; only the fresh follow-up tests transfer. [R06, R13]

---

## 8. Error correction, spaced review and adaptive repair

### 8.1 Three distinct events

Every practice system must distinguish **the original attempt**, **repair after feedback** and **a later independent retrieval**. Recording a wrong answer followed by ten guided successes as eleven independent successes would misrepresent learning. The first attempt remains available for diagnosis; a repair is a learning event; a later new-context attempt supplies separate retention or transfer evidence.

The existing Leitner domain owns vocabulary scheduling, promotion, demotion and scheduled-review state. This course must not create another vocabulary scheduler, another set of houses or duplicate review events. A course-specific grammar or skill diagnosis can reference the same attempt without rewriting its vocabulary outcome. [V01, V04, V05]

### 8.2 Preserve the implemented spelling-repair policy exactly

The inspected same-session repair feature applies to **Box 1 practice** and **initial practice of selected new words**, not the scheduled “today review” flow. [V05]

Its sequence is:

1. Record the primary answer through the existing application.
2. Show the closest accepted spelling and the learner's version; identify inserted, missing, replaced or transposed graphemes.
3. Remove the correct spelling from the DOM and request complete recall.
4. If recall fails, require a focused correct copy, remove the answer again, and require recall.
5. Recheck after **three intervening practice cards**.
6. If that recheck fails, use the repair cycle and schedule one final recheck after **one intervening card**.
7. Cap at **two rechecks** and flush pending rechecks before a finite new-word session finishes.

Those exact numbers are **existing product policy**, not a scientifically optimal schedule established by a paper. The repair and recheck events do not become extra Leitner assessments, attempts, correct/wrong totals or daily-history events. Exit clears the transient queue. Scheduled reviews keep their established behavior. [V05]

The course's conditional repair descriptions refer to this mechanism only within its existing supported scope. They must not silently extend it to scheduled reviews or persist transient same-session outcomes as promotions.

### 8.3 Proposed repair taxonomy beyond spelling

| Observed problem | Diagnose before repair | Repair action | Independent check |
|---|---|---|---|
| Meaning confusion | Did the learner know the relevant sense, or only another sense? | One explicit contrast; fresh situation cue | Retrieve from a different contextual cue |
| Word-partner error | Wrong meaning, wrong partner or wrong complement pattern? | Show the natural combination and a meaningful contrast | Produce the chunk in another message |
| Grammar / agreement | Which relationship is misunderstood? | Identify head/role; explain; correct with model removed | New sentence plus later productive use |
| Listening segmentation | Unknown word or known word not recognised in speech? | Short replay with boundaries; phrase dictation; then intact message | Different recording containing the capability |
| Listening interpretation | Was the phrase heard but its correction/attitude missed? | Compare stated possibilities with the final decision | New dialogue with a different correction |
| Reading inference | Unsupported outside assumption, lost reference or ignored qualification? | Mark the evidence and explain its limit | New paragraph and altered claim scope |
| Task mechanics | Meaning correct but answer format invalid? | Explain the exact word/selection/label constraint | Parallel task with the same constraint, new answer |
| Speaking development | Relevant idea but insufficient explanation or unclear connection? | Elicit one useful reason/example; replay a specific excerpt | Unfamiliar follow-up without notes |
| Writing organisation | Missing prompt part, weak paragraph purpose or unsupported inference? | Revise the relevant unit, not an indiscriminate whole-essay rewrite | New prompt requiring the same capability |

This taxonomy is a **proposed course layer**. It uses the learning principles in [R01, R03, R04, R06, R07, R11, R14] but is not claimed to be deployed or experimentally validated as a package. Only dispatch a repair when its actual error evidence exists. A secure target should not trigger an unnecessary corrective exercise.

### 8.4 Feedback and retry rules

Learning feedback should be specific enough that a learner understands the mismatch. “Wrong, try again” is insufficient for a conceptual distinction. For a closed item, explain the correct interpretation and why the selected distractor fails. For an open response, cite the relevant language span or audio timestamp and offer a small, actionable revision goal. Avoid overwhelming the learner with every possible stylistic change.

Repeated failure should reduce the size of the target problem, restore a model and check a prerequisite rather than simply repeat the same item indefinitely. When a learner supplies an alternative valid answer, fix the item or its accepted-response rules; do not force the learner to reproduce the author’s preferred wording.

For a linked reading/listening group or a sealed assessment, defer feedback until the coherent task is submitted so one answer does not leak the next. In the final check, a retake with changed option order but identical facts is still a repeated item, not a fresh assessment.

### 8.5 Error record and review evidence

A proposed diagnostic sidecar should retain: learner/attempt references; content version; target and error dimension; original response; assistance/replay state; source evidence span or timestamp; feedback version; correction attempt reference; whether the recheck is repeated or genuinely new; and the reason for the next recommended action. These are **proposed diagnostic fields**, not additional accepted keys in the current canonical authoring JSON.

Vocabulary review events remain owned by Leitner. Course-level events are linked evidence, not duplicate assessments. The dashboard should distinguish “I have completed this lesson” from “I can still perform this capability independently.” A lapse may produce a review recommendation without erasing historical completion or progress achievements. [V04, V05]

---

## 9. Placement, mastery gates and assessment integrity

### 9.1 Entry diagnostic before L0001

The entry diagnostic is **not a vocabulary-led instructional lesson**, so it must not begin by teaching the words or answers it is about to assess. It belongs to a separate diagnostic workflow. The first two mandatory opening exercises apply to the authored vocabulary-led lessons, not to a sealed examination. This follows the scope limitation of the lesson-design skill. [V01]

Assess a sample of all four skills, basic reading access, keyboard/audio setup and understanding of instructions. Check receptive and productive ability separately. A learner who can recognise a word but cannot understand it in a sentence or use it should not be placed solely by vocabulary recognition.

The entry check must explicitly confirm recognition of common pronouns, basic be-forms, familiar everyday function words and a simple personal statement. The first food lesson also provides receptive support for eats/drinks with a named subject; independent third-person agreement is developed subsequently. A short foundation bridge is required for learners who cannot yet process the English instructions, distinguish essential written forms or produce a very simple message. It should provide optional first-language explanation, familiar examples and technology orientation inside the app. This bridge is a specified need, **not an additional completed lesson bank included in the 960 count**.

Automatic placement and skipping are proposed capabilities. Because the verified path engine is sequential, do not imply that it already supports arbitrary branching. Before routing is implemented and validated, let placement recommend a starting stage with explicit evidence rather than silently bypass required runtime progression rules. [V04]

### 9.2 Gate policies: explicit, provisional and non-official

The following are initial **product policies to pilot**, not research-derived universal thresholds. They must be versioned, audited and recalibrated. A course cannot certify high-stakes proficiency using arbitrary completion percentages.

| Gate | Purpose | Initial policy / minimum evidence | What it does not mean |
|---|---|---|---|
| **G1 — Lesson capability** | Confirm the lesson's central targets after teaching | First-attempt, no-hint evidence on a fresh local check; initially target at least 80% on an adequately sized closed-item sample, plus relevant independent spoken and written responses | Not 80% = a particular IELTS band; not all lexical dimensions tested by one item |
| **G2 — Unit retention and transfer** | Check broader capability after eight lesson roles | Fresh tasks cover all four skills and important unit relationships; no skill can be omitted; a later independent sample is required, with timing coordinated with existing review | Not a second vocabulary scheduler or a repeat of the exposed final quiz |
| **G3 — Stage progression** | Confirm the next stage will be productive | Multiple unfamiliar tasks per skill; use the stage's stated can-do demands and approved rubrics; investigate any inconsistent or borderline profile | Not promotion merely because every screen was visited |
| **G4 — Band-9 readiness evidence** | Assess sustained highest-level performance | Several sealed, complete, mode-correct forms on different days; calibrated L/R interpretation and independent descriptor-anchored S/W evidence; meaningful uncertainty remains visible | Not an official IELTS result or a guarantee for a future sitting |

Do not award independent mastery from a tiny item set whose chance success or one mistake dominates the result. A provisional G1 sample should contain at least 10 meaningful scored decisions where closed scoring is used, plus appropriate productive evidence. The exact sample size, acceptable error types and pass policy require piloting. A slide specification may represent several decisions; simply counting slides is not a gate.

For productive local gates, the reviewer/model should establish whether the response meets the lesson's communicative demand, not invent a half-band from a 20-second beginner answer. If the assessor cannot judge reliably, the status is **insufficient evidence**, not automatically passed or failed.

### 9.3 Full-form assessment schedule

Early stages prioritize manageable competency checks rather than repeated demoralising full examinations. From the middle stages, introduce intact sections and then complete tests. Advanced stages need unseen full forms with all required formats and realistic conditions. Allocate forms before publication so that the teaching bank and held-out bank never draw the same answer-bearing material.

A practical initial G4 policy is **three to five complete fresh forms across several days**, plus a delayed independent check after a meaningful interval. This is a proposed sampling policy, not a published guarantee. The forms must cover distinct content and include a sufficient range of task types; three cosmetic rewordings of one test are not three independent forms.

For Listening and Reading, results near 39–40 out of 40 would be encouraging evidence of very strong performance, but the raw-to-band interpretation depends on the form and its calibration. Do not hard-code “39 always equals 9” for original, unvalidated Vocora items. For Writing and Speaking, a score claim needs criterion-level evidence and credible rater calibration, not only a language model's confident number. [I01, I06, I07]

### 9.4 Separation of teaching, review and holdout pools

Maintain three content pools:

**Teaching:** models, guided tasks, corrected examples and the public reference packs in this package.

**Review:** different cues and contexts for previously taught capabilities. Reuse is legitimate but the learner's exposure history is retained.

**Sealed assessment:** unseen answer-bearing texts, audio, visuals and prompts. Access is controlled and feedback retires an item from the learner's future sealed pool.

Split by meaningful content, not just ID. Near-duplicate passages, the same data under a different title or a voice change on the same script can leak answers. Audit lexical cues, distinctive facts, options, visual data, model responses and retrieval-augmented tutor access. The tutor must not retrieve a sealed answer key while helping the learner prepare.

An assessment may legitimately contain previously learned **language**. What must remain unseen is the **answer-bearing situation and task**, not every word. Preventing all familiar language would defeat the purpose of learning.

### 9.5 No false band arithmetic

Do not convert vocabulary accuracy, streak length, total XP, hint-free cards or app completion into an official IELTS band. Do not average an unvalidated spoken score with a valid reading result and present the composite as credible. Do not hide weak Speaking behind a high overall average when the target is four component 9s. Official aggregation and local diagnostic displays serve different purposes. [I01]

A useful readiness display has separate fields for recent independent evidence, assistance used, content freshness, uncertainty and missing evidence. A learner can be “course completed; high Reading evidence; Speaking evidence insufficient” without that being a contradiction.

---

## 10. Self-study feedback for Speaking and Writing

### 10.1 What an autonomous feedback loop must do

A self-study learner needs a complete loop inside the app: understand the task; attempt independently; receive trustworthy feedback; repair a manageable problem; and test transfer. Merely recording a microphone response or storing an essay is not that loop.

The inspected runtime stores production evidence but does not auto-score these slide responses. Consequently, the feedback service and its assessment quality are central release blockers for this course, not optional cosmetic improvements. [V04]

### 10.2 Proposed Writing feedback contract

For each complete prompt and saved draft, return a structured report with:

- A task-coverage diagnosis: what the prompt required, what was addressed and what is missing or distorted.
- A small set of criterion-linked observations with exact textual evidence and a reason the issue matters.
- One or two prioritized revision actions, followed by a fresh transfer prompt.

A model response can be revealed after the independent attempt, but must be labelled an illustration. Do not silently replace the learner's voice with a highly edited essay and count that as improvement. Preserve the original draft and any accepted variants.

Separate deterministic checks—word count, required uploaded response, valid task reference—from evaluative judgments about development, coherence, lexical choice and grammar. The former are easier to verify but do not replace the latter. [I04, I06]

### 10.3 Proposed Speaking feedback contract

Use the **audio artifact**, task context, preparation/assistance history and a transcript with uncertainty markers. Feedback should point to specific moments of communication or language use. A transcription failure must not automatically become a learner pronunciation error. Validate the input quality; request a new recording when there is insufficient intelligible audio rather than hallucinate a confident score.

The service should be able to identify relevance, development, coherence, lexical flexibility, grammatical control and intelligibility, while distinguishing thoughtful pauses from persistent breakdown. It should not punish a natural accent for being non-native or reward an unnaturally fast rehearsed response. [I07]

### 10.4 Calibration and abstention

Before numeric IELTS-style productive estimates are released, compare the system against independently rated response sets covering the range of ability, relevant accents, task types, recording conditions and common error patterns. Use more than one qualified rater where feasible, reconcile substantial disagreement, and keep an untouched evaluation set. Model-to-model agreement is not a substitute for external calibration.

Evaluate systematic over/under-scoring, false “ready” decisions, instability under harmless wording changes and differential errors across learner groups. Test prompt injection inside essays/transcripts, off-topic but polished answers, copied models and cases with good grammar but poor task response. Revalidate after model, prompt, rubric or content changes.

The provider should publish what the score is, what it was calibrated against and its uncertainty. Until that evidence exists, deliver useful **qualitative practice feedback** with clear limits rather than a fabricated official-equivalent band. The reviewed AI preparation report provides reasons for caution and contextual evaluation; it does not validate this proposed implementation. [R08]

### 10.5 No compulsory personal tutor, but honest escalation

The learner should not have to hire a tutor to use the course. A low-confidence automated assessment can lead to another carefully selected task or, if the provider offers it, quality-controlled review within the product. Neither route should silently award a pass when evidence is inadequate. Expert involvement in product evaluation is different from requiring a personal coach for every lesson.

---

## 11. Study rhythm, motivation and accessibility

### 11.1 Plan by opportunities to learn, not a promised finish date

The 960 lessons are not necessarily 960 calendar days. Their workload varies: a small lexical lesson, a revision cycle and a full-length writing session are not interchangeable. An implementation should measure actual time and cognitive load during piloting before publishing duration estimates.

For planning only, an average of 45–75 minutes per integrated lesson would imply **720–1,200 hours** for the 960-lesson path, before separate extensive input, reviews and full mock examinations. This is arithmetic under an assumption, not evidence that 720 or 1,200 hours produces band 9. Some learners will place out of foundations; others will need more repair, input or time. [R10]

A typical study block should include due review, one meaningful new or developing capability, receptive input, productive use and a short reflection. A long lesson can be split at exercise boundaries with reliable resume state. Do not demand a complete essay and full Speaking test every time the learner studies six words.

### 11.2 Balance the weekly experience

Use the four-strands framework as a check on opportunity: meaning-focused input, meaning-focused output, language-focused learning and fluency development should all be present. Review actual **time and cognitive purpose**, not the number of cards bearing each skill icon. Listening to a definition repeatedly is not equivalent to understanding a meaningful conversation. [R05]

An initial weekly review can ask whether vocabulary drills have crowded out extended reading, whether the learner has produced any independent speech, and whether writing revision ever transfers to a new task. Do not force an exact 25% split inside each short lesson.

### 11.3 In-app extensive input is necessary for the intended scope

The eventual app must contain an accessible graded reading and listening library, with appropriate licensing or original authorship. Early texts need familiar syntax and sufficient known language; advanced texts need variety without requiring hidden specialist expertise. Audio should include natural dialogues and monologues with varied intelligible voices. These libraries are not provided by simply displaying the 12 reference packs repeatedly.

Offer easy input for fluency as well as more demanding input for development. Learner choice can support engagement, but coverage monitoring should detect persistent avoidance of a skill. Unknown-word capture should select useful recurrent items instead of adding every unfamiliar proper noun or specialist term to compulsory review. [R03, R05, R12]

### 11.4 Daily progress without false proficiency claims

Show what the learner achieved: completed a task, independently retrieved a capability, repaired an error or sustained a streak. Keep XP and streaks motivational rather than using them as evidence of language proficiency. Repeating a revealed answer should not create unlimited learning-credit inflation.

A useful overview can show current unit, completed required exercises, due reviews, recent skill evidence and the next actionable task. “Behind” should refer to an optional personal study plan, not a shame-inducing assumption that everyone learns at the same rate. Historical completion remains intact even if a later check suggests review. [V04]

### 11.5 Access and usability

Provide clear instructions, keyboard navigation, readable typography, persistent stimuli, recording checks and recoverable network failures. Optional first-language explanation can support the learning mode; withdrawing it during a specified independent check must be explicit.

Distinguish accessibility accommodations from the standard test-mode profile. Transcripts and alternative text can provide learning access, but when they change the skill being measured, the resulting evidence should not be labelled standard Listening performance. A learner should know what was practiced and what remains unassessed.

Audio and written responses require understandable consent, access control, retention and deletion options. These are implementation requirements to resolve with the product's applicable policy, not a claim that this package supplies a jurisdiction-specific legal compliance assessment.

---

## 12. Original content and media authoring contracts

### 12.1 A finished lesson is more than an exercise manifest

For each of the 960 lessons, the final author must supply the actual sense-specific lexical content, contextual examples, readings, listening scripts and recordings, complete task prompts, keys or rubrics, feedback, required visuals and sealed transfer material. The current `lesson_index.jsonl` gives topic, target language, skill goals, task-family coverage and authoring briefs. Most of those briefs remain unfinished material, deliberately labelled as such.

The 12 supplied reference packs are a higher-completeness layer: they have real reading text, a script, 16 keyed comprehension items, six lexical entries, three chunks, Speaking instructions and Writing instructions with a model. They are not complete substitutes for all eligible targets, production rubrics, media or sealed tests in their corresponding lesson designs.

### 12.2 Reading asset requirements

A reading asset must state its ID/version, title, complete text, paragraph boundaries, provenance/licence, stage demand, target usage and actual word count. Provide question stems, instructions, all options where relevant, accepted responses, evidence spans and rationales for plausible distractors. Explain whether a task is a focused excerpt, an intact examination passage or a full section.

Use realistic discourse and coherent ideas, not sentences mechanically assembled to contain every target word. Do not introduce a factual health, scientific or policy claim without a valid source unless the scenario is explicitly fictional. For invented tables or studies, label them hypothetical; do not invent the name of a real journal or institution as supposed evidence.

### 12.3 Listening asset requirements

A script must preserve speaker turns and the intended meaning of corrections, emphasis, disagreement and reference. A recorded asset needs a verified file/reference, duration, rights/provenance, speaker metadata, quality checks, transcript alignment and relevant evidence timestamps.

TTS is useful for word/phrase pronunciation and some formative dialogue work. The inspected runtime supports a multi-turn synthetic dialogue stimulus, but a browser-synthesised conversation must not be mislabelled an authentic examination recording. Full readiness testing requires natural, complete audio with controlled task conditions and adequate variety. No audio file has been generated or supplied in this package. [V03, V04]

Prepare the lexical and aural prerequisites using **different facts** from later comprehension and tests. An intake card may teach `appointment`; it must not reveal that the answer to the later booking form is “Thursday at 10.”

### 12.4 Questions and answer keys

Closed questions require a defensible answer and a check that distractors are genuinely wrong for the stated task. “One word” must not have a two-word expected answer. A correct paraphrase must not be rejected in a free-response task merely because it differs from one model; an exact-source completion must follow its source-wording instruction.

Allow accepted spelling varieties where the item permits them. Handle contractions, hyphens, numbers and abbreviations consistently with the task instruction and verified exam rules. Homophones in isolated dictation need context when the intended written form would otherwise be ambiguous. Do not normalize away errors the item is explicitly designed to assess.

Some reference-pack items are learning questions such as ordering, explanation or rewrite; they are **not all official IELTS question types**. The distinction is intentional: an instructional exercise can build a capability without pretending to be a full exam simulation.

### 12.5 Productive prompts and models

Every Writing task needs a complete prompt and, for Task 1, its actual visual/data stimulus. Every Speaking task needs its communicative purpose, preparation conditions, recording requirements and appropriate follow-ups. The final examiner-style conversation cannot be reduced to an isolated monologue with no response to interaction.

A model must be labelled illustrative unless it has credible external rating evidence. It should explain important choices rather than invite memorisation. Beginner examples may be short because the objective is a sentence or small message; full examination tasks must meet their stated minimums and conditions. The supplied upper-stage Task 2 models are at least 250 words, but none is claimed examiner-certified. [I04, I06, I07]

### 12.6 Coverage and provenance per exercise

The canonical object records `source_target_ids`, `extension_ids`, `source_refs`, applicable research-principle IDs and a sequence reason. Every slide refers to declared targets. The union of its slide targets equals its exercise's declared target scope; the lesson coverage partition is complete.

For this original commission, the normalized module bank and grammar inventory are source content. Additional exercises on those already declared targets are not falsely attributed to a commercial book. A later author who adds material beyond the source must declare its extension and rationale. Passing this structural coverage check means **every target has a planned home**, not that every target is already represented by a finished valid question. [V01, V02]

---

## 13. Runtime integration and data contracts

### 13.1 Canonical authoring envelope

Each JSONL line in `data/lesson_plans.jsonl` is one canonical lesson object:

```json
{
  "schema_version": 1,
  "lesson": {},
  "design": {},
  "evidence_catalog": [],
  "exercises": [],
  "coverage": {},
  "validation": {}
}
```

Exercise positions strictly increase. Prerequisites point only to earlier exercise IDs with reasons. Every exercise has an ordered slide array. Agent-facing fields use `snake_case`; the slide data uses only the inspected placeholder envelope. The source-target and extension namespaces remain disjoint. [V02]

A real example can be extracted without loading the complete bank:

```bash
python scripts/extract_lesson.py L0001 --output lesson-L0001.json
```

A production compiler is not included. It must not translate the placeholders into guessed component properties or assume the authoring vocabulary `spelling_dictation` is already a registered runtime exercise type. Verify and map to the relevant domain adapter or `slides.sequence` contract. Add the runtime's single terminal final slide only at the appropriate layer. [V02, V04]

### 13.2 Server-authoritative evidence

Use existing domain references for authoritative listening attempts and avoid copying their answer keys into learner-facing path configuration. Validate learner responses on the server. For recordings, bind the stored audio artifact to the authenticated learner, attempt, exercise and slide. Preserve the original response and content version before feedback or revision. [V04]

Do not allow a failed media upload, missing recording, unknown slide type or unsupported exercise to silently count as completed. A practice repeat should not reset historical completion. Content revisions should preserve stable identity and explain when an item is retired, replaced or no longer comparable.

### 13.3 Completion, mastery and conditional routing

The current engine's completion policy and the proposed course mastery policy must be reconciled explicitly. Completion can mean that a required exercise was legitimately attempted; independent mastery is a stronger claim. Do not implement the stronger claim by trusting a client boolean or by reusing eventual-correct training evidence as a first-attempt score.

Conditional repairs are represented as `required: false` specifications, with their intended trigger explained in the objective and sequence rationale. The current documents do not establish a complete adaptive trigger engine for these plans. A renderer may expose them as recommended targeted practice until validated automatic dispatch exists. A blank or missing trigger is not permission to force all repairs on every learner.

### 13.4 Assessment isolation and observability

Proposed operational events include started/submitted/cancelled attempt, assistance used, primary outcome, repair outcome, content exposure, independent transfer and assessor abstention. Keep these distinct from reward counters. Audit improbable identical responses, model-answer leakage and sudden score jumps before making readiness claims.

Assessment data, learner recordings and answer keys require access control. Do not expose authoring JSON containing expected answers to a test client merely because the file is convenient. This README and its public reference packs are author materials, not a secure exam delivery format.

---

## 14. Content QA, calibration and release criteria

### 14.1 Different validation layers answer different questions

**Structural validation:** Are IDs unique, fields allowed, references resolvable, prerequisites backward-only, the opening scope exact and coverage complete?

**Educational review:** Are the meanings, grammar, examples, prompts, accepted answers and distractors defensible? Does the learner have the prerequisite language? Is the task natural, and does the claimed feedback follow from the stimulus?

**Media/runtime review:** Does the recording exist and match the script? Are visuals readable? Is the learner client free of answer leaks? Does submission produce valid server evidence?

**Assessment calibration:** Do original items and productive judgments behave as intended on independent learner data? Are readiness decisions stable and fair enough for the claims being made?

**Outcome evaluation:** Does the complete self-study experience improve performance on genuinely independent outcomes, for whom, under what conditions and with what uncertainty?

The first layer is useful but cannot answer the other four. A script returning “valid” never proves scientific effectiveness or band-9 attainment.

### 14.2 Review checklist

Before publication, inspect target sense and register; natural collocations; grammar versus semantic errors; realistic lexical load; coherent text; valid inference; exact numeric data; spelling/word limits; alternative answers; distractor ambiguity; recording alignment; unavailable media; assistance leakage; productive-rubric alignment; duplicate/near-duplicate assessment content; and mismatch between the claimed mode and actual conditions.

At high stages, specifically look for arguments that sound sophisticated but do not follow from the evidence. At low stages, check whether the explanation itself is harder than the target. At every stage, avoid turning fictional scenario facts into supposedly real external evidence.

### 14.3 Pilot and calibration sequence

First review a small complete unit at each broad demand range. Observe task completion, error categories, cognitive burden, interface confusion, delayed independent retrieval and transfer—not just satisfaction or total clicks. Revise the lesson sequence or word load when the observations reveal a problem.

Then pilot larger stage segments with diverse learners. Compare the intended skill coverage with actual practice, inspect differential item behavior and assess whether productive feedback causes useful revisions. Build independent rater anchors and a held-out assessment set before issuing score-like predictions.

For a credible efficacy claim, specify the study population, entry proficiency, actual use, comparison condition where feasible, dropout handling, independent outcomes, follow-up interval and uncertainty. A result from motivated completers alone must not be generalized to everyone who signs up. A pilot can support a bounded claim; it cannot logically prove that every future learner will obtain 9.

### 14.4 Release states

Use separate states such as **design drafted**, **materials authored**, **expert reviewed**, **media ready**, **runtime validated**, **piloted** and **assessment calibrated** in the production workflow. These are proposed workflow labels, not extra keys allowed by the existing lesson schema.

In the current canonical objects, the supported `validation.status` is deliberately **`blocked`** because the necessary material/media/scoring conditions are unresolved. All 960 plans can pass structural checks while remaining blocked for production. That is the correct outcome, not an inconsistency. [V02]

---

## 15. Example lesson: what the learner actually does

### L0001 — Food and everyday meals: form and meaning

The first reference lesson begins with **bread, rice, water, milk, eat, drink**. The normalized module also provides the target chunks **have breakfast** and **drink water** for this lesson's eligible scope. Its initial grammar target is a simple subject–verb–object statement with `I/you/we/they`; later unit work extends the scope. The reference pack contains further language in context, but its mere presence is not an instruction to test an untaught grammatical rule.

The relevant material is embedded in §19 as **EX01** and available independently in `examples/EX01.md`.

| Step | Learner action | Concrete content / evidence |
|---|---|---|
| Intake | See the intended meaning, hear the word when audio exists, recognise a meaning | `bread`: a food made from flour and water and usually baked; `I eat bread.` |
| Dictation | Type from an aural cue, with the written answer absent | Expected forms include `bread`, `rice`, `water`, `milk`, `eat`, `drink`; recordings still need production |
| Context / relationship | Identify who performs the action and what they eat/drink | Do not confuse a food noun with the action verb |
| Grammar | Compare `I rice eat.` with `I eat rice.` | Explain the subject–verb–object relationship, then hide the model for repair |
| Chunk work | Retrieve the word partner in a meaningful situation | `drink water`; `have breakfast`; final cue/distractor authoring still required |
| Reading | Read the short account of Mina and Sam | “What does Mina eat in the morning? Write ONE WORD.” → `bread`, supported by the text |
| Listening | Hear the Ari/Jo exchange and follow the actual choice | The complete script and eight keyed teaching questions are supplied; natural audio is absent |
| Speaking | Produce a simple personal answer, not read the transcript | Record a relevant short response with intelligible familiar language |
| Writing | Write a small message about one meal | The reference task requests 20–40 words; this is not an IELTS Task 2 |
| Repair | Revisit only a diagnosed problem | Preserve the primary error; target spelling, meaning or the sentence relation as appropriate |
| Transfer | Use the capability on an unfamiliar small message | A new sealed task is required; the public example cannot serve as its own holdout |

This illustrates how topic, lexical targets, grammar, receptive text, productive response and correction fit together. It does **not** claim that one short lesson covers the complete food domain or establishes an IELTS band.

The other reference packs revisit food at increasing demands: quantities and orders; sequence; labels and comparisons; surplus systems; irrigation data; policy choices; resilience; uncertainty; innovation claims; competing criteria; and qualified synthesis. All example scenarios and numerical datasets are explicitly fictional teaching material, not facts about real programmes or research.

---

## 16. Implementation and content-production backlog

### 16.1 Priorities, with explicit acceptance conditions

| Priority | Work | Acceptance condition |
|---|---|---|
| P0 | Resolve authoring/runtime boundary | Verified final slide schemas, compiler mapping and focused contract tests; no guessed properties |
| P0 | Complete a pilot unit rather than publish the whole generated bank | Every target has reviewed content, complete tasks, working assets and valid evidence handling |
| P0 | Build trustworthy productive feedback | Qualitative evidence-based feedback first; numeric score estimates withheld until calibrated |
| P0 | Keep learning and assessment content separate | No answer keys or model responses leak into sealed attempts |
| P1 | Author the remaining lesson material packs | Original/licensed readings, scripts, recordings, visuals, keys and rationales meet the stage specifications |
| P1 | Validate the lexical and chunk inventories | Sense, grammatical behavior, register and useful partners verified; duplicates resolved by shared identity |
| P1 | Create the extensive input library | Meaning-focused graded reading/listening is genuinely available inside the app |
| P1 | Implement conditional repair recommendations | Error evidence selects the appropriate plan without changing scheduled Leitner semantics |
| P1 | Produce and calibrate full mock forms | Complete four-skill conditions and independent scoring evidence, not generic slide quizzes |
| P2 | Validate course-level placement and readiness routing | Decisions agree sufficiently with independent evidence and disclose uncertainty |
| P2 | Pilot and evaluate the complete course | Publish bounded outcome claims with transparent methods and limitations |

### 16.2 Instructions for a downstream content agent

Do not ingest `AUTHORING BRIEF` strings as if they were learner prompts. Take one lesson ID, inspect its source bank and prerequisite capabilities, author the missing material and attach evidence at the exercise level. Preserve the fixed opening and the original meaning of target relationships. Check the target coverage again after editing; a new passage can change the required lexical burden.

For a source-derived book lesson, inspect the actual authorized source rather than inventing its content from its title. For this original curriculum, construct new stimuli and label them original. Do not claim that a research paper supplied the words, facts or exact task order when it only supports a general learning principle.

Keep a lesson blocked until the required media and response evidence exist. Run the repository's authoritative validator in the checked-out repository when producing its final canonical authoring object; the independent checker in this package is not a replacement for that integration step. [V01, V06]

---

## 17. Files, reproducibility and validation

### 17.1 Package layout

```text
README.md                              Self-contained design, 960 lessons, examples, sources
data/
  modules.txt                          Original 120-unit lexical/chunk selections
  modules.normalized.json              Deduplicated normalized banks used by the build
  grammar.txt                          120 worked grammar/discourse diagnostics
  stages.json                          12 progressive demand profiles
  sources.json                         37-source evidence/provenance register
  lesson_index.jsonl                    960 lesson manifests and detailed asset briefs
  lesson_plans.jsonl                    960 canonical authoring objects, all production-blocked
  exercise_index.jsonl                  Expanded required/conditional exercise specifications
examples/
  EX01.md ... EX12.md                   Authored reference packs, one per stage
  reference_materials.json              Structured authored text, script, question and model data
stages/
  S01.md ... S12.md                     Smaller navigable copies of the lesson specifications
scripts/
  author_examples.py                    Rebuild the 12 authored packs
  build_course.py                      Expand the original curriculum design deterministically
  extract_lesson.py                     Extract one canonical object from the large JSONL bank
  validate_course.py                    Independent contract-oriented structural checks
  README-front.md                       Source of the narrative sections
  render_readme.py                      Optional HTML renderer (requires markdown-it-py)
  build_manifest.py                    Recompute hashes/counts and create the ZIP
audit/
  counts.json                          Actual computed counts, not promises
  validation.json                      Independent structural-check results and limitations
  manifest.json                        File hashes and sizes
```

`README.html` is a browser-readable copy with collapsible lesson sections. Only its optional renderer requires the third-party `markdown-it-py` package; the four core build/extraction/check commands below use the standard library. `audit/manifest.json` is authoritative about the files actually present. No audio asset or deployment binary should be inferred from an authoring reference string.

### 17.2 Rebuild and inspect

From the package directory, using Python 3.10 or later and the standard library:

```bash
python scripts/author_examples.py
python scripts/build_course.py
python scripts/validate_course.py
python scripts/extract_lesson.py L0001 --output lesson-L0001.json
```

`lesson_plans.jsonl` and `exercise_index.jsonl` are intentionally large. Stream them line by line instead of loading the entire exercise bank into a browser. The ZIP compresses repeated structural fields; it does not change the distinction between authored material and a design specification.

The build corrects a small set of duplicate strings within original unit rows and reorders the first food subset to match the authored reference pack. It writes those changes to the normalized bank rather than silently changing the source file. Repetition **across** units is intentional spiralling and is reported as occurrences versus distinct strings.

### 17.3 What the validation report establishes

The package checker verifies lesson/exercise/slide identity, allowed fields and slide types, exact opening scope, backward prerequisites, source/extension references, coverage unions, evidence IDs, declared material blockers and reproducible counts. It also checks the authored reference-pack structure and relevant writing-model minimums.

It is an **independent checker implemented for this deliverable against the inspected contract**. It is not represented as a successful execution of the repository's own validator or a full application integration test. It does not prove pedagogical correctness, validate all distractors, create missing media, calibrate scores or demonstrate learning outcomes.

The final `audit/validation.json` records exactly which checks passed and which limitations remain. A positive structural result must always be read alongside `runtime_ready_lessons: 0` and the explicit `blocked` status of each lesson object.

---
