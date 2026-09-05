#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Run setup on EVERY deployment, including content-only changes in the bind mount.
# Never restart the app after a failed validation/migration/import.
docker compose build app db-setup
docker compose up -d --wait mysql
docker compose run --rm --no-deps db-setup
docker compose up -d --no-deps --force-recreate app
docker compose up -d --no-deps phpmyadmin
