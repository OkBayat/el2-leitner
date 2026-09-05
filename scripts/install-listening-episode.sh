#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${VOCORA_REPO_ROOT:-$(cd -- "$SCRIPT_DIR/.." && pwd)}"
EPISODES_DIR="${VOCORA_EPISODES_DIR:-$REPO_ROOT/back/data/listening/episodes}"
EPISODE_TOOL="${VOCORA_EPISODE_TOOL:-$REPO_ROOT/back/scripts/manage-listening-episode.py}"
PYTHON_BIN="${PYTHON_BIN:-python3}"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/install-listening-episode.sh <episode-bundle.zip>

Examples:
  bash scripts/install-listening-episode.sh vocora-bbc-260618-source-reference.zip
  bash scripts/install-listening-episode.sh /tmp/bbc-episode.zip

The script verifies the bundle first, then:
  - installs only audio when the episode already exists in the repository;
  - installs the complete episode when it is new;
  - never overwrites an existing different audio file.

This command does not deploy the application. Run `bash scripts/deploy.sh` separately when ready.
EOF
}

fail() {
  printf 'Listening episode installation failed: %s\n' "$*" >&2
  exit 1
}

if [[ $# -ne 1 ]]; then
  usage >&2
  exit 2
fi

command -v "$PYTHON_BIN" >/dev/null 2>&1 || fail "Python 3 is required."
[[ -f "$EPISODE_TOOL" ]] || fail "Episode management tool not found: $EPISODE_TOOL"
[[ -d "$EPISODES_DIR" ]] || fail "Episode catalog directory not found: $EPISODES_DIR"

BUNDLE_INPUT="$1"
if [[ "$BUNDLE_INPUT" != /* ]]; then
  BUNDLE_INPUT="$PWD/$BUNDLE_INPUT"
fi
[[ -f "$BUNDLE_INPUT" ]] || fail "ZIP file not found: $1"
[[ ! -L "$BUNDLE_INPUT" ]] || fail "ZIP file must not be a symbolic link."
[[ "${BUNDLE_INPUT,,}" == *.zip ]] || fail "Bundle must be a .zip file."

BUNDLE="$($PYTHON_BIN - "$BUNDLE_INPUT" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1]).resolve(strict=True)
print(path)
PY
)"

printf 'Verifying bundle: %s\n' "$BUNDLE"
"$PYTHON_BIN" "$EPISODE_TOOL" verify "$BUNDLE"

readarray -t BUNDLE_INFO < <("$PYTHON_BIN" - "$BUNDLE" <<'PY'
import json
from pathlib import Path
import sys
import zipfile

bundle = Path(sys.argv[1])
with zipfile.ZipFile(bundle) as archive:
    names = archive.namelist()
    if not names:
        raise SystemExit("Bundle is empty.")
    folder = names[0].split("/", 1)[0]
    report_name = f"{folder}/BUNDLE.json"
    try:
        report = json.loads(archive.read(report_name))
    except KeyError as error:
        raise SystemExit("Bundle manifest is missing.") from error

print(folder)
print(report.get("transcriptStatus", ""))
PY
)

EPISODE_FOLDER="${BUNDLE_INFO[0]:-}"
TRANSCRIPT_STATUS="${BUNDLE_INFO[1]:-}"
[[ -n "$EPISODE_FOLDER" ]] || fail "Could not determine the episode folder from the verified bundle."

DESTINATION="$EPISODES_DIR/$EPISODE_FOLDER"
INSTALL_ARGS=(install "$BUNDLE" --into "$EPISODES_DIR")

if [[ -e "$DESTINATION" || -L "$DESTINATION" ]]; then
  printf 'Episode already exists; installing audio only: %s\n' "$EPISODE_FOLDER"
  INSTALL_ARGS+=(--audio-only)
else
  printf 'New episode detected; installing complete bundle: %s\n' "$EPISODE_FOLDER"
  if [[ "$TRANSCRIPT_STATUS" == "source_reference_only" ]]; then
    printf 'Warning: transcript is a source reference only, not a full transcript.\n' >&2
    INSTALL_ARGS+=(--allow-source-transcript)
  fi
fi

"$PYTHON_BIN" "$EPISODE_TOOL" "${INSTALL_ARGS[@]}"

printf '\nInstalled successfully.\n'
printf 'Episode directory: %s\n' "$DESTINATION"
printf 'Deploy when ready with: bash scripts/deploy.sh\n'
