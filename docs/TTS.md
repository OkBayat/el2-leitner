# Self-hosted Kokoro text-to-speech

Vocora runs [Kokoro-FastAPI](https://github.com/remsky/Kokoro-FastAPI) as the
private `kokoro` Compose service. The pinned default image is
`ghcr.io/remsky/kokoro-fastapi-cpu:v0.8.2`. It is not published to a host port;
only services on the Compose network can reach it. The backend calls its stable
OpenAI-compatible `POST /v1/audio/speech` route.

## Start and configure

Copy `.env.example` to `.env`, provide the required database and JWT values,
then start the stack:

```bash
docker compose up --build --wait
```

The relevant settings are:

| Variable | Default | Purpose |
| --- | --- | --- |
| `KOKORO_IMAGE_TAG` | `v0.8.2` | Pinned Kokoro-FastAPI image release |
| `KOKORO_TTS_URL` | Compose sets `http://kokoro:8880` | Internal provider base URL |
| `KOKORO_TTS_MODEL` | `kokoro` | Provider model name |
| `TTS_CACHE_DIRECTORY` | Compose sets `/app/back/data/tts-cache` | Generated audio root |
| `TTS_ALLOWED_VOICES` | `af_bella,af_heart,af_sky,bf_emma` | Accepted client voices |
| `TTS_DEFAULT_VOICE` | `af_heart` | Voice used when omitted |
| `TTS_DEFAULT_SPEED` | `1` | Speed used when omitted |
| `TTS_DEFAULT_FORMAT` | `mp3` | Format used when omitted |
| `TTS_REQUEST_TIMEOUT_MS` | `120000` | End-to-end provider timeout |
| `TTS_MAX_TEXT_LENGTH` | `5000` | Maximum normalized input characters |
| `TTS_MODEL_VERSION` | `kokoro-v1.0@kokoro-fastapi-v0.8.2` | Cache invalidation identity |

When changing the Kokoro image, model, or another setting that can alter audio,
also update `TTS_MODEL_VERSION`. Kokoro's installed voices can be inspected from
inside the private network with `GET http://kokoro:8880/v1/audio/voices`; add
only desired voice IDs to `TTS_ALLOWED_VOICES`.

## Backend endpoint

`POST /api/tts/speech` requires the normal Vocora authentication cookie. It
accepts JSON:

```json
{
  "text": "Life is like a box of chocolates.",
  "voice": "af_heart",
  "speed": 1,
  "language": "en-us",
  "format": "mp3"
}
```

Only `text` is required. `format` supports `mp3`, `wav`, `opus`, and `flac`.
`speed` is from `0.25` through `4`. `language` defaults to `auto` and supports
`en-us`, `en-gb`, `es`, `fr-fr`, `hi`, `it`, `ja`, `pt-br`, and `zh`.
The response body is the audio binary with the matching content type. Both a
cache hit and a cache miss use the same file-streaming response. The diagnostic
`X-Vocora-TTS-Cache` header is `hit` or `miss`.

Example after logging in and saving the session cookie:

```bash
curl -b cookies.txt -D headers.txt -o speech.mp3 \
  http://localhost:3000/api/tts/speech \
  -H 'Content-Type: application/json' \
  -d '{"text":"Hello from Vocora.","voice":"af_heart","speed":1,"format":"mp3"}'
```

## Content-addressed cache

Text is normalized to Unicode NFC, CRLF/CR line endings become LF, and only
surrounding whitespace is trimmed. Punctuation and internal whitespace are
preserved, and this normalized text is sent to Kokoro.

The SHA-256 key is calculated from one canonical JSON object containing:

```text
tts:v1 + normalized_text + voice + speed + language + model + model_version
       + output_format + provider_normalization=false + streaming=true
```

Files are stored as `<sha256>.<format>` in `TTS_CACHE_DIRECTORY`. Compose mounts
the named `tts_audio_cache` volume there, so files survive container restarts.
No filename, URL, audio ID, or relationship is stored in MySQL.

On a miss, the provider response streams into a unique temporary file and is
atomically renamed only after successful, non-empty generation. Failures remove
the temporary file. Identical concurrent misses share one in-process generation.
The standard Compose topology runs one backend instance; atomic unique temporary
files keep the cache valid if operators later add instances, but a distributed
lock would be needed to eliminate duplicate provider work across those instances.
There is intentionally no pre-generation or cache eviction in this release.

## Verify a cache hit

Send the example request twice. The first response header is `miss` and the
second is `hit`. The cache volume should contain one file:

```bash
docker compose exec app sh -lc 'find /app/back/data/tts-cache -maxdepth 1 -type f -print'
```

Change `voice` or `speed` and repeat; a second hash-named file should appear.
