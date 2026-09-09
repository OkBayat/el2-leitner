# Shadowing: Box 1

Open **Home → Shadowing: Box 1**, or `/shadowing`. This is a separate authenticated, full-screen exercise using the existing sentence/review layout. Sentence Practice's cloze and daily Leitner review are unchanged.

## Exercise

The existing sentence catalog and user-scoped Box 1 lookup supply complete sentences, not gaps. Each word's sentence is selected randomly; successive cycles avoid immediately repeating a word when another is available, and prefer a different sentence for that word. Words without an eligible sentence are omitted. The server rechecks active Box 1 membership and sentence identity before each recording, including after another tab changes a word's box.

Each new card requests playback through the existing English `SpeechService`; Play sentence and Slower replay it. Browsers can block autoplay until a gesture: the explicit playback control remains available. Microphone permission is requested only after Click to speak. Starting recording cancels playback, and playback controls are disabled while capturing/checking.

The complete sentence stays visible. Recognized words turn blue as provisional transcripts arrive. Provisional recognition can change and never records a result. Stop, a pause after speaking, or the 30-second limit finalizes the attempt. An ordered, occurrence-consuming alignment evaluates the final transcript. Coverage is matched displayed words divided by target displayed words; **at least 90%** succeeds. The threshold is checked before display rounding. Missing words remain visible and are underlined in the final result. Wrong attempts offer Try again; successful attempts offer Continue. Skip does not count an attempt. Free practice continues until Finish practice or Exit.

Case, punctuation, explicit common contractions, a small set of British/American spellings, and numbers 0–20 are normalized. Negation and tense are not discarded. Extra words do not earn credit; repeated target occurrences require distinct recognized occurrences. This is **word recognition/coverage, not phoneme accuracy, accent grading, or an IELTS speaking score**. Recognition errors are possible. Use a quiet room, a clear microphone, and the retry control.

## Deployment

The normal Compose stack now includes a private `speech` service; `app` connects to `http://speech:8080`. There is no published speech port, API subscription, GPU requirement, or client-side third-party speech API. The image installs `vosk==0.3.45` and downloads the versioned `vosk-model-small-en-us-0.15` English model during its first build. Internet access is needed for image/package/model downloads, not for runtime speech recognition. The small model is a resource-conscious baseline, not a guarantee of recognition accuracy for every learner.

After the PR is merged, the existing deployment/build process includes the new image. No new database migration or destructive reset is required. The regular app can remain available when speech is down; Shadowing shows an actionable unavailable state instead of grading speech as incorrect.

Microphone capture requires **HTTPS**, except on localhost. An HTTP LAN IP is not sufficient, including in an installed PWA. Use a current browser supporting getUserMedia, AudioContext and AudioWorklet. No SpeechRecognition browser API is required. The existing TTS voice still depends on browser/OS availability. Mobile hardware and accent acceptance should be checked on the actual deployment; mocked browser tests cannot validate those.

For a non-Compose app development process:

```bash
docker build -t vocora-speech ./speech
docker run --rm -p 127.0.0.1:8082:8080 vocora-speech
# Set in the backend environment before starting the app:
# SHADOWING_SPEECH_URL=http://127.0.0.1:8082
```

Do not expose the internal speech service directly to the Internet. All browser requests must go through the authenticated Vocora backend. The model download URL can be overridden with the image's `VOSK_MODEL_URL` build argument for a compatible, operator-verified English model. Account for its license, memory, download size and recognition behavior before changing it.

## Boundaries and resources

- Angular's AudioWorklet resamples the actual device sample rate (including 44.1/48 kHz) to mono PCM16 LE at 16 kHz. Half-second chunks are sent sequentially, with bounded buffering, through the existing API client. RMS drives the waveform; it is not a simulated speaking animation. Captured audio is never routed to the speakers.
- `ShadowingPractice` owns session access, Box 1 revalidation, transcript alignment, final grading and practice accounting. The expected sentence is never supplied as constrained recognition grammar. The speech adapter receives only PCM audio and a random recording ID.
- `HttpSpeechRecognizer` calls the private Python/Vosk process. Speech sessions and audio live in memory only. Neither service writes recordings to disk or logs their contents. Stop, cancel, navigation, hidden-page interruption and late permission responses release microphone resources; the recognizer also has a 90-second idle expiry.
- The speech process admits at most eight recording slots and serializes recognition work. The app admits at most sixteen practice sessions, with one active session per user and 30-minute idle expiry. Audio is limited to 30 seconds / 960,000 bytes; each request is at most 32,000 bytes. Authenticated request rate limiting and upstream timeouts are separate from login limits.
- Session state currently belongs to one Node process. Restarting it requires starting a new exercise. Multi-replica deployments need sticky routing or a shared coordinator before enabling Shadowing across replicas.
- Partial results never change statistics. A finalized, recognizable recording updates only `practice_sessions` (`shadowing-house-1`) and daily practice totals. No review event, promotion, demotion, due date, or vocabulary mistake count is written. Silence, permission failures and transport/provider errors do not count as wrong answers. Final-response retries reuse the same recording result and do not double-count. Interrupted unfinalized recordings do not count.

## API

All endpoints are under `/api/shadowing`, authenticated and `Cache-Control: no-store`:

| Method/path | Purpose |
| --- | --- |
| POST `/sessions` | Start a Box 1 deck and practice session. No house selector. |
| DELETE `/sessions/:sessionId` | Finish the owned session using server-held counts. |
| POST `/sessions/:sessionId/recordings` | Validate `wordId`, `sentenceId`, local `day`; allocate recording. |
| POST `/sessions/:sessionId/recordings/:id/chunks?sequence=N` | Bounded `application/octet-stream` PCM, ordered from zero; provisional alignment. |
| POST `/sessions/:sessionId/recordings/:id/finish` | Final assessment and exactly-once normal retry handling for statistics. |
| DELETE `/sessions/:sessionId/recordings/:id` | Discard a recording without grading. |

## Verification

Existing backend and Angular workflows pick up the new tests. `Shadowing speech` additionally builds the real image and streams Vosk's commit-pinned public example WAV through the private service, checking duplicate chunk/final retries. That public sample is downloaded only in CI and its Git blob hash is verified; no learner recordings are added to the repository.

Focused commands:

```bash
cd back && node --test tests/shadowing-*.test.js
cd ../ui && npm run test:unit
cd .. && python -m unittest discover -s speech -p 'test_server.py' -v
```

Upstream references: https://alphacephei.com/vosk/models, https://github.com/alphacep/vosk-api, https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia, https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet.
