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

Do not delete the MySQL, TTS, or Ollama volumes during a normal deploy.

## Private Ollama and Qwen provisioning

The deployment starts the opt-in `ollama` Compose service on the private app
network. It has no host port, disables Ollama cloud behavior, and persists model
data in the environment-local `ollama_models` volume. Normal `docker compose up`
and CI do not start it because the service belongs to the `ai` profile; the
deployment workflow targets it explicitly.

Defaults are configured through `.env`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `OLLAMA_IMAGE_TAG` | `0.34.0` | Ollama container release used by this trial |
| `OLLAMA_NO_CLOUD` | `1` | Prevent cloud fallback |
| `OLLAMA_NUM_PARALLEL` | `1` | Bound CPU concurrency |
| `OLLAMA_MAX_LOADED_MODELS` | `1` | Bound resident models |
| `OLLAMA_MAX_QUEUE` | `8` | Bound queued inference |
| `OLLAMA_KEEP_ALIVE` | `5m` | Release idle model memory |

The candidate tag `qwen3:4b-instruct-2507-q4_K_M` is fixed by Compose and the
deployment script so an environment cannot silently substitute another model.
The script also verifies its full manifest digest
`0edcdef34593eac1aa2be9c7d06c432dcf81945adca5eca2f27662c18f168ba0`.
After the service is healthy, deployment skips the download only when both the
tag and digest match. It pulls an absent or mismatched model, then fails closed
if the resulting digest still differs. The first deployment therefore downloads
the model; later deployments reuse the verified persistent volume.

This is provisioning for the documented CPU and feedback-quality experiment,
not an enabled learner feature or proof that the model meets IELTS quality or
latency requirements. Record the resolved image/model identity and real
target-host measurements before an inference adapter or learner workflow is
released. The digest above binds this initial trial artifact; the complete
release record must additionally capture the container digest, Ollama version,
quantization, template, and benchmark evidence required by the IELTS plan.
