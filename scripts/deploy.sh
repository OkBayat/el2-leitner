#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

source_fingerprint() {
  local file
  {
    # Use Git's index as the fast path and add only local deltas. This avoids
    # spawning one hash process for every tracked file on every deployment.
    git ls-files --stage -- "$@"
    git diff --binary -- "$@"
    git diff --cached --binary -- "$@"
    while IFS= read -r -d '' file; do
      printf '%s\0' "$file"
      sha256sum -- "$file"
    done < <(git ls-files --others --exclude-standard -z -- "$@")
  } | sha256sum | cut -d ' ' -f 1
}

build_if_source_changed() {
  local service="$1"
  local image="$2"
  local expected_hash="$3"
  local current_hash
  current_hash="$(docker image inspect --format '{{ index .Config.Labels "ir.vocora.source-hash" }}' "$image" 2>/dev/null || true)"
  if [[ "$current_hash" == "$expected_hash" ]]; then
    printf 'Skipping unchanged %s image build.\n' "$service"
    return
  fi
  docker compose build "$service"
}

ensure_qwen_model() {
  local model="qwen3:4b-instruct-2507-q4_K_M"
  local expected_digest="0edcdef34593eac1aa2be9c7d06c432dcf81945adca5eca2f27662c18f168ba0"
  local manifest="/root/.ollama/models/manifests/registry.ollama.ai/library/qwen3/4b-instruct-2507-q4_K_M"
  local actual_digest
  actual_digest="$(
    docker compose --profile ai exec -T ollama sha256sum "$manifest" 2>/dev/null |
      awk '{ print $1 }'
  )" || true
  if docker compose --profile ai exec -T ollama ollama show "$model" >/dev/null 2>&1 &&
    [[ "$actual_digest" == "$expected_digest" ]]; then
    printf 'Skipping installed Qwen model %s.\n' "$model"
    return
  fi
  docker compose --profile ai exec -T ollama ollama pull "$model"
  actual_digest="$(
    docker compose --profile ai exec -T ollama sha256sum "$manifest" 2>/dev/null |
      awk '{ print $1 }'
  )" || true
  if [[ "$actual_digest" != "$expected_digest" ]]; then
    printf 'Qwen model digest mismatch for %s: expected %s, got %s.\n' \
      "$model" "$expected_digest" "${actual_digest:-missing}" >&2
    return 1
  fi
}

export VOCORA_APP_SOURCE_HASH="$(source_fingerprint .dockerignore back ui)"
export VOCORA_SPEECH_SOURCE_HASH="$(source_fingerprint .dockerignore speech)"

build_if_source_changed app leitner-ielts-app "$VOCORA_APP_SOURCE_HASH"
build_if_source_changed speech leitner-ielts-speech "$VOCORA_SPEECH_SOURCE_HASH"

docker compose up -d --wait mysql
# Run setup on every deployment, including content-only changes in the bind
# mount. Its migrations and publishers are idempotent; a failure keeps the
# currently serving app untouched.
docker compose run --rm --no-deps db-setup
# The app is deployed with --no-deps, so health-gate every private provider.
docker compose up -d --wait speech
docker compose up -d --wait kokoro
docker compose --profile ai up -d --wait ollama
ensure_qwen_model

# Compose reuses the current container when its image and configuration are
# unchanged. Avoid force-recreating a healthy app on no-op deployments.
docker compose up -d --no-deps --wait app
docker compose up -d --no-deps phpmyadmin
