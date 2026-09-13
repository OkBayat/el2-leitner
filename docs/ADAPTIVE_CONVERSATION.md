# Adaptive speaking conversation

Vocora's `adaptive-conversation` slide is an exercise-driven, authenticated,
multi-turn speaking flow:

```text
browser PCM -> existing Vosk ASR -> saved transcript -> OpenAI Responses API
-> validated next question and concise UI feedback -> canonical Kokoro cache
-> browser audio playback -> next learner turn
```

OpenAI never receives audio. The visible Vosk transcript is the evidence used
for language feedback. The model is explicitly prohibited from claiming it can
assess pronunciation, accent, intonation, stress, pause quality, acoustic
fluency, or an IELTS band from text.

## Trusted exercise context

The backend resolves the path, lesson, exercise, slide and started attempt from
the managed learning-path source. The client identifies the slide and sends
recording chunks; it cannot supply a rubric or prompt. The authored definition
controls the goal, learner level, target vocabulary, response duration, minimum
and maximum turns, and question constraints.

Only a bounded number of accepted turns is sent on each OpenAI request. Learner
strings are JSON-encoded as untrusted data under a fixed server instruction.
No tools, web search, file search, or external actions are enabled.

## State and failure behavior

Persisted sessions are owner-, lesson-, exercise-, slide-, and attempt-scoped.
Turn states are `ready`, `recording`, `queued`, `evaluating`,
`feedback_available`, and `retryable_failure`. The UI separately represents
microphone permission, recording, upload/transcription, thinking, voice
generation, playback, and the next turn.

Transcripts are saved before AI queue admission. Idempotency keys, optimistic
session revisions, one selected recording per turn, bounded queues, and explicit
retry prevent duplicate paid requests. Provider timeout, rate limit, malformed
output, ASR failure, and Kokoro failure never mark an answer wrong or complete
the exercise. Raw provider errors and learner transcripts are not logged.

## OpenAI and structured response

The semantic `OpenAIConversationProvider` uses the shared server-only
`OpenAIStructuredTextClient`. It calls the Responses API with `gpt-5-nano` by
default, minimal reasoning, low verbosity, `store:false`, no automatic SDK
retry, and a strict JSON Schema. The result keeps natural spoken text
(`nextQuestion`) separate from concise on-screen teaching feedback.

The server, not the model, derives the narrow 0–2 task-response signal and owns
completion. The model may suggest ending only inside the authored turn bounds.
A text-free completion receipt is used by Learning Path progress.

## ASR and Kokoro

The existing private Vosk service remains the ASR owner. It supplies transcript
status, word evidence where available, and provider identity. Audio chunks stay
bounded and are not persisted as lesson assets.

The next question is resolved from the owned session and synthesized by the
existing `SynthesizeSpeech` use case and `KokoroTtsClient`. This preserves
canonical normalization, content-addressed file caching, and single-flight
generation. Conversation routes remain authenticated and return no-store audio.

## Configuration

```dotenv
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-nano
OPENAI_TIMEOUT_MS=30000
ADAPTIVE_CONVERSATION_ENABLED=false
ADAPTIVE_CONVERSATION_RETENTION_DAYS=30
```

`OPENAI_API_KEY` belongs only to the backend environment and is required when
the feature is enabled. Automated tests inject provider doubles and never make
paid calls. `SHADOWING_SPEECH_URL`, Kokoro, and TTS cache settings retain their
existing contracts.

## Limits

- One active conversation per owner and bounded global active sessions.
- At most three recording/evaluation attempts per turn.
- At most the authored maximum turns; history cannot grow without bound.
- Input, PCM chunks, output tokens, provider time, and daily session counts are
  bounded.
- Feedback derived from transcripts cannot replace acoustic assessment.

The feature flag controls new sessions; retained history remains readable when
disabled. E2E execution is prohibited by repository policy; unit, behavior,
contract, persistence, and Angular state tests cover this workflow.
