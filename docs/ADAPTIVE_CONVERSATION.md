# Adaptive Conversation Practice

> Status: **proposed design boundary; not yet a registered runtime slide**.
> First planned consumer: IELTS L0001 exercise E09.

Adaptive conversation practice is a reusable, JSON-configured learning
interaction. It is not an IELTS component and it does not own an IELTS scoring
policy. A lesson supplies the communicative goal and safe content bounds; the
application owns recording, transcription, turn evaluation, question generation,
speech synthesis, persistence, and completion evidence.

Read this document with [Shadowing](SHADOWING.md), [TTS](TTS.md), the
[enterprise architecture playbook](../ARCHITECTURE_PLAYBOOK.md), and the
[IELTS implementation direction](../ielts/IMPLEMENTATION.md).

## Product loop

```text
server-owned opening question
    -> application-owned, turn-bound TTS operation -> existing Kokoro provider
    -> browser playback
    -> existing PCM recorder captures the learner's answer
    -> authenticated backend streams PCM to the private ASR boundary
    -> server preserves the transcript and ASR uncertainty
    -> private text-model adapter evaluates the answer and proposes one next question
    -> backend validates the structured result and question
    -> turn-bound TTS operation synthesizes the accepted question with Kokoro
    -> browser playback starts the next turn
```

The browser owns microphone permission, PCM capture, recording controls, audio
playback, and accessible state presentation. It does **not** choose the model,
rubric, next-question constraints, provider URL, completion policy, or score.

Reuse `PcmRecorderService` and its AudioWorklet contract initially. The browser
already converts microphone input to bounded 16 kHz mono PCM. Keep speech-to-text
behind the authenticated backend and private Vosk adapter rather than adding the
browser `SpeechRecognition` API or a large WASM model. This preserves the current
privacy and provider-consistency boundary. A future on-device transcriber must be
a separately measured adapter with the same transcript contract; it must not
change lesson JSON.

## Reusable JSON contract

The planned registered slide type is `adaptive-conversation`. Provider and model
names are deliberately absent.

```json
{
  "id": "example-conversation",
  "type": "adaptive-conversation",
  "data": {
    "mode": "guided-dialogue",
    "goal": "Exchange simple information about a familiar meal.",
    "openingPrompt": "What do you eat in the morning?",
    "minimumTurns": 2,
    "maximumTurns": 3,
    "responseSeconds": 30,
    "learnerLevel": "beginner",
    "targetVocabulary": ["bread", "rice", "water", "milk", "eat", "drink"],
    "questionConstraints": {
      "maximumWords": 14,
      "oneQuestionOnly": true,
      "avoidAnswerDisclosure": true
    }
  }
}
```

The runtime validator must reject unknown modes, empty goals/prompts, duplicate
target vocabulary, limits outside repository-owned bounds, provider fields, model
fields, system prompts, rubrics, answer keys, and executable markup. Initial
bounds are two to four turns, 5 to 30 response seconds, and a 20-word maximum for
each generated question. These are product safety bounds, not model settings.

Lesson JSON may select only content-level behavior. The backend resolves the
versioned evaluation policy, prompt template, local model identity, voice,
language, rate limits, retention policy, and feature availability.

## Turn result contract

The initial private text-model candidate is the locally served
`Qwen3-4B-Instruct-2507` already selected for formative text feedback. It receives
the server-owned goal, accepted constraints, bounded prior turns, and current
transcript as untrusted data. It has no tools, network access, database access,
filesystem access, or state-changing commands.

The provider must return one strict, versioned JSON object. The application
validates it before saving or synthesizing anything:

```json
{
  "schemaVersion": 1,
  "assessmentStatus": "feedback_available",
  "taskResponse": "complete",
  "formativeTaskScore": 2,
  "feedback": "You answered the question and gave a clear food item.",
  "nextQuestion": "What do you drink with breakfast?",
  "endConversation": false,
  "notAssessed": ["ielts_band", "pronunciation", "fluency"]
}
```

`taskResponse` is `complete`, `partial`, `off_topic`, or `not_assessed`.
`formativeTaskScore` is a narrow 0–2 task-response signal: 0 means no usable or
relevant answer, 1 means a relevant but incomplete answer, and 2 means the current
question was answered. It is not an IELTS band, pronunciation grade, grammar
proof, mastery signal, or Leitner event. It must be displayed with its rubric,
never as a bare percentage. Model feedback cannot change deterministic lesson
completion or closed-answer results.

If the transcript is empty or ASR reports insufficient evidence, no learner error
is recorded and the user can record again. If model output is invalid, unsafe,
truncated, too long, or outside the schema, the turn enters a retryable processing
failure; raw model text is never spoken. Kokoro receives only the backend-accepted
`nextQuestion`. The backend resolves an owned turn ID to that accepted text; the
browser never resubmits model text to the general `/api/tts/speech` route as if
it were authoritative.

`endConversation` is advisory model output. The application ignores it before
`minimumTurns`, ends at `maximumTurns` regardless of its value, and may accept it
only between those bounds. The server-derived session state is authoritative.

The current Vosk adapter exposes text only. Before this interaction is released,
its port must return a versioned transcript result with `text`, `status`, and
provider confidence when available. A missing confidence value remains `null`;
it must never be manufactured.

## Application ownership and persistence

The application starts a conversation only from an authenticated, owned learning
path exercise and resolves the slide configuration from the server-managed path.
The client submits path, lesson, exercise, slide, session, recording, and
idempotency identifiers; it never submits an authoritative prompt or rubric.

Persist a conversation session and immutable turns through repository ports. A
turn stores the content/config version, transcript result, accepted model-result
version, provider/model/prompt identities, and the exact accepted next question.
Do not persist raw microphone chunks in the first release. Generated conversation
audio is learner-derived data and must not enter the current shared,
content-addressed TTS cache, which has no eviction policy. Add an application-owned
ephemeral audio artifact with owner, turn, expiry, content type, and model/voice
identity, or stream a single generation without caching. The authenticated audio
read verifies the session owner and deletes or expires the artifact under the
approved retention policy. It never exposes a provider URL or public object URL.

Use a bounded job for text-model inference so a slow CPU request holds neither an
HTTP request nor a database transaction. The state machine is:

```text
ready -> recording -> transcribing -> queued -> evaluating
      -> feedback_available -> synthesizing -> ready
      -> retryable_failure
      -> completed | cancelled | expired
```

Only one recording and one inference job may be active per session. Chunk order,
byte and duration limits, ownership checks, idempotent finish, queue admission,
lease expiry, bounded retry, cancellation, and TTL are server-enforced. A worker
restart may delay a turn but must not create a second accepted result.

Completion requires the configured minimum number of accepted learner turns and
a terminal session bound to the same owner, path, lesson, exercise, slide, and
exercise-start version. Completing the interaction records practice evidence;
it does not assert mastery or an IELTS score.

## API operations

Public route names are selected with the existing collection-learning-path route
owner during implementation. The required authenticated operations are:

1. Start or resume the owned slide session using an idempotency key.
2. Allocate a bounded recording for the current question.
3. Append ordered PCM chunks and return provisional transcript status.
4. Finish the recording and queue the immutable transcript for evaluation.
5. Poll or subscribe to the turn state and accepted feedback.
6. Request audio by owned turn ID. The backend resolves the accepted question,
   delegates generation to the existing Kokoro provider owner, and returns an
   authenticated ephemeral stream.
7. Cancel a recording/session without marking a wrong answer.
8. Finish the session and return server-verifiable completion evidence.

Transport failures, ASR uncertainty, model abstention, and TTS failure are
distinct states. Add a server-only playback mode to `SpeechService` for this
interaction: it reports Kokoro failure to the slide and never silently falls back
to browser speech synthesis. TTS failure must leave the accepted question visible
and allow an explicit playback retry. No provider failure should mark the learner
wrong or erase an accepted transcript.

## First IELTS use

L0001 E09 will configure this general slide with the goal “exchange simple
information about everyday meals,” the opening question “What do you eat in the
morning?”, two required turns, three maximum turns, and the eight lesson targets.
The next question should ask naturally about a related missing detail such as a
drink, time, place, or another person. The model must not force the learner to
copy the reference dialogue or invent a personal fact.

E09 stays out of the managed lesson JSON until the type, backend workflow,
registry entry, tests, and design-system states ship together. This prevents an
unregistered placeholder from making a draft lesson appear runtime-ready.

## Verification and release gates

Do not create or run E2E/Playwright tests. The implementation slice requires:

- pure contract tests for JSON and model-result parsing;
- behavior tests for turn state, idempotency, ownership, retry, cancellation,
  limits, completion, and failure separation;
- provider contract tests for Vosk, Qwen/Ollama, and Kokoro boundaries;
- focused Angular tests for recording, transcript, processing, feedback, replay,
  keyboard, mobile-width, light-theme, and dark-theme states;
- learning-path completion tests proving a conversation session cannot be reused
  across users or exercises;
- a target-host CPU and quality benchmark before enabling the feature flag.

Release remains disabled until the exact local model/runtime identity is pinned,
capacity is measured with Vosk and Kokoro co-located, reviewed examples meet an
approved quality threshold, and privacy/retention copy is approved. There is no
automatic cloud fallback.
