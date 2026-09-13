# Server deployment

Vocora's server deployment is `scripts/deploy.sh`. Run it from a clean checkout
whose environment-specific `.env` is already configured. The script validates
and publishes managed database content before changing the serving application.
It stops on the first failed build, migration, provider health check, or model
download before app replacement, leaving the previously serving app untouched.
The final app health check detects a bad replacement but is not a blue-green
deployment or automatic rollback mechanism.

## Environment contract

Keep a separate `.env` beside each staging and production checkout. At minimum,
replace every secret placeholder in `.env.example` and set the exact browser
origin for that environment:

```dotenv
# Staging
CORS_ALLOWED_ORIGINS=https://dev.vocora.ir

# Production (in the production checkout only)
CORS_ALLOWED_ORIGINS=https://vocora.ir
```

Add `https://localhost` or `capacitor://localhost` only when that environment
serves the corresponding native client. Credentialed CORS must never use `*`.
Set `TRUST_PROXY=true` when the app is behind the environment's trusted reverse
proxy. Compose fails before starting when `CORS_ALLOWED_ORIGINS` is absent.

## Incremental behavior

Run:

```bash
bash scripts/deploy.sh
```

The script derives separate source fingerprints for the application and speech
images. It reads each built image's `ir.vocora.source-hash` label and skips that
build when the relevant source is unchanged. The `app` and `db-setup` services
declare the same image, so the deployment builds that image only once.

Database setup still runs on every deployment. That exception is intentional:
managed listening and learning content can change without changing an image,
and its migrations and publishers are idempotent. Compose then reuses healthy
provider and app containers when their image and configuration are unchanged;
the deploy script does not force-recreate the app.

Do not delete the MySQL or TTS volumes during a normal deploy.

## OpenAI educational feedback

Writing evaluation and adaptive speaking conversation use the server-side OpenAI
Responses API. Configure the backend environment only:

Defaults are configured through `.env`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | none | Required when either AI feature is enabled; backend only |
| `OPENAI_MODEL` | `gpt-5-nano` | Responses API model |
| `OPENAI_TIMEOUT_MS` | `30000` | One bounded provider attempt; no automatic retry |
| `WRITING_FEEDBACK_ENABLED` | `false` | Enable submitted Writing evaluation |
| `ADAPTIVE_CONVERSATION_ENABLED` | `false` | Enable transcript-driven Speaking turns |

The key is never written to Angular environment files or returned by an API.
CI and automated tests use injected provider doubles and do not need a key or
make paid requests. Kokoro and the existing speech service remain private
Compose services; conversational text is synthesized through the canonical TTS
cache.
