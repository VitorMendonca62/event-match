#!/usr/bin/env bash
# Runs backend integration tests against isolated, disposable PostgreSQL.
set -Eeuo pipefail

readonly ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly COMPOSE_FILE="${ROOT_DIR}/docker-compose.back.test.yml"
readonly ENV_FILE="${ROOT_DIR}/back/.env.test.local"
readonly PROJECT_NAME="eventmatch-integration-test-${$}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo 'back/.env.test.local is required for backend test runners.' >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

compose=(docker compose --env-file "${ENV_FILE}" --project-name "${PROJECT_NAME}" --file "${COMPOSE_FILE}")

cleanup() {
  local exit_code=$?
  "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
  exit "${exit_code}"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if ! docker info >/dev/null 2>&1; then
  echo 'Docker daemon is unavailable.' >&2
  exit 1
fi

if ! command -v bun >/dev/null 2>&1; then
  echo 'Bun is required to run backend tests.' >&2
  exit 1
fi

: "${POSTGRES_DB:=eventmatch}"
: "${POSTGRES_USER:=eventmatch}"
: "${POSTGRES_PORT:=0}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set in back/.env.test.local}"
: "${CONTACT_HASH_KEY:?CONTACT_HASH_KEY must be set in back/.env.test.local}"
: "${CONTACT_ENCRYPTION_KEY:?CONTACT_ENCRYPTION_KEY must be set in back/.env.test.local}"
: "${VERIFICATION_SECRET_KEY:?VERIFICATION_SECRET_KEY must be set in back/.env.test.local}"
export POSTGRES_DB POSTGRES_USER POSTGRES_PORT POSTGRES_PASSWORD
export CONTACT_HASH_KEY CONTACT_ENCRYPTION_KEY VERIFICATION_SECRET_KEY

# Waits on the Compose healthcheck instead of a fixed polling budget, which flaked on cold starts.
if ! "${compose[@]}" up --detach --wait --wait-timeout 120 postgres >/dev/null; then
  echo 'Temporary PostgreSQL did not become ready.' >&2
  exit 1
fi

binding="$("${compose[@]}" port postgres 5432)"
postgres_port="${binding##*:}"
if [[ ! "${postgres_port}" =~ ^[0-9]+$ ]]; then
  echo 'Could not determine the temporary PostgreSQL port.' >&2
  exit 1
fi

export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${postgres_port}/${POSTGRES_DB}"
export DATABASE_INTEGRATION_URL="${DATABASE_URL}"

cd "${ROOT_DIR}"
bun run --cwd back db:migrate
bun run --cwd back test:integration
