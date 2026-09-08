---
type: Concept
title: Vocora Text-to-Speech
description: Shared on-demand Kokoro synthesis, content-addressed audio caching, client consumption, and environment-local deployment.
tags: [project, text-to-speech, kokoro, audio, cache, deployment]
timestamp: 2026-09-08T12:55:15Z
---

Vocora exposes one authenticated backend contract for on-demand speech. Callers
submit synthesis input and receive audio bytes; they do not manage cache
identities, provider URLs, filesystem paths, or database relationships.

# Backend Contract

`POST /api/tts/speech` accepts JSON with required `text` and optional `voice`,
`speed`, `format`, and `language`. Defaults come from environment-backed backend
configuration. The response is the audio body with the correct MIME type, such
as `audio/mpeg` or `audio/wav`. It does not return a durable audio URL.

The `X-Vocora-TTS-Cache` response header is `hit` or `miss` for diagnostics.
This distinction is otherwise transparent to the caller: both paths stream the
resolved cache file through the same HTTP response mechanism.

# Shared Backend Ownership

* The HTTP interface authenticates, invokes the use case, and streams the
  resolved file.
* `SynthesizeSpeech` owns cache lookup, cache-miss generation, and process-local
  single-flight coordination for identical requests.
* `TtsRequest` owns allowed options, defaults, validation, and conservative text
  normalization.
* `TtsCacheKey` is the only cache-key builder.
* `FileTtsAudioCache` owns filesystem reads and atomic temporary-file-to-final-file
  publication.
* `KokoroTtsClient` owns the private HTTP provider contract.

# Cache Identity And Storage

The cache key is SHA-256 over canonical JSON containing `tts:v1`, normalized
text, voice, speed, language, model, model version, output format, provider
normalization behavior, and streaming behavior. Text normalization uses Unicode
NFC, converts CRLF and CR line endings to LF, and trims only surrounding
whitespace. Punctuation and internal whitespace remain meaningful.

The filesystem is the cache source of truth. Files use `<hash>.<format>` inside
`/app/back/data/tts-cache`, backed by the Compose `tts_audio_cache` named volume.
Generation writes a unique temporary file and atomically renames it only after
successful completion. Audio files and relationships are not stored in the
database. Generation is lazy, and automatic eviction is intentionally absent.

# Client Consumption

Any vocabulary, lesson, exercise, or listening UI can call the same endpoint;
the request is independent of a lesson or vocabulary database ID. An Angular
adapter should request the response as a `Blob`, create a temporary browser
object URL for an audio element, and revoke that object URL after playback or
component cleanup. The object URL is client-local and is not a persisted Vocora
audio URL.

# Runtime And Deployment

Kokoro-FastAPI runs as the private `kokoro` Compose service with no host port.
The backend reaches it at `http://kokoro:8880` on the environment-local Compose
network. `scripts/deploy.sh` explicitly starts and health-gates `kokoro` before
replacing the app because the app deployment uses `--no-deps`.

Staging and production run separate Kokoro containers, private networks, and
`tts_audio_cache` volumes under their separate Compose project identities.
Docker may reuse the same image layers on a shared host, but model processes and
generated audio caches remain environment-local. Repeating `docker compose up
-d --wait kokoro` is idempotent when the service definition and image are
unchanged. A failed Kokoro start stops the deployment before app replacement.

# Known Limit

Single-flight coordination is process-local. The current deployment has one
backend process per environment. Multiple backend replicas would require a
distributed lock to prevent duplicate generation across processes.

# Citations

[1] [Text-to-speech documentation](../../docs/TTS.md)
[2] [Docker Compose topology](../../docker-compose.yml)
[3] [Deployment workflow](../../scripts/deploy.sh)
[4] [Synthesis use case](../../back/src/application/text-to-speech/SynthesizeSpeech.js)
[5] [Canonical request](../../back/src/domain/text-to-speech/TtsRequest.js)
[6] [Cache-key builder](../../back/src/domain/text-to-speech/TtsCacheKey.js)
[7] [Filesystem cache adapter](../../back/src/infrastructure/text-to-speech/FileTtsAudioCache.js)
[8] [Kokoro provider adapter](../../back/src/infrastructure/text-to-speech/KokoroTtsClient.js)
[9] [HTTP interface](../../back/src/interfaces/http/apiRouter.js)
[10] [Deployment regression test](../../back/tests/tts-deploy.test.js)
