#!/usr/bin/env bash
# Runs backend E2E tests against disposable PostgreSQL and backend containers.
set -Eeuo pipefail

readonly ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly COMPOSE_FILE="${ROOT_DIR}/docker-compose.back.test.yml"
readonly ENV_FILE="${ROOT_DIR}/back/.env.test.local"
readonly PROJECT_NAME="eventmatch-e2e-test-${$}"
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

if ! docker info >/dev/null 2>&1; then echo 'Docker daemon is unavailable.' >&2; exit 1; fi
if ! command -v bun >/dev/null 2>&1; then echo 'Bun is required to run backend tests.' >&2; exit 1; fi
if ! command -v curl >/dev/null 2>&1; then echo 'curl is required to probe the backend container.' >&2; exit 1; fi

: "${POSTGRES_DB:=eventmatch}"
: "${POSTGRES_USER:=eventmatch}"
: "${POSTGRES_PORT:=0}"
: "${BACK_PORT:=0}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set in back/.env.test.local}"
: "${CONTACT_HASH_KEY:?CONTACT_HASH_KEY must be set in back/.env.test.local}"
: "${CONTACT_ENCRYPTION_KEY:?CONTACT_ENCRYPTION_KEY must be set in back/.env.test.local}"
: "${VERIFICATION_SECRET_KEY:?VERIFICATION_SECRET_KEY must be set in back/.env.test.local}"
export POSTGRES_DB POSTGRES_USER POSTGRES_PORT BACK_PORT POSTGRES_PASSWORD
export CONTACT_HASH_KEY CONTACT_ENCRYPTION_KEY VERIFICATION_SECRET_KEY
# Percent-encode credentials: a valid password may contain URL-reserved characters (@ # ? / :).
url_encode() { bun -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$1"; }
encoded_user="$(url_encode "${POSTGRES_USER}")"
encoded_password="$(url_encode "${POSTGRES_PASSWORD}")"
export DATABASE_URL="postgresql://${encoded_user}:${encoded_password}@postgres:5432/${POSTGRES_DB}"

# Waits on the Compose healthcheck instead of a fixed polling budget, which flaked on cold starts.
if ! "${compose[@]}" up --detach --wait --wait-timeout 120 postgres >/dev/null; then
  echo 'Temporary PostgreSQL did not become ready.' >&2
  exit 1
fi

"${compose[@]}" run --rm back bun run --cwd back db:migrate >/dev/null
"${compose[@]}" up --detach back >/dev/null
binding="$("${compose[@]}" port back 3001)"
back_port="${binding##*:}"
if [[ ! "${back_port}" =~ ^[0-9]+$ ]]; then echo 'Could not determine the backend test port.' >&2; exit 1; fi
export E2E_BASE_URL="http://127.0.0.1:${back_port}"

for _ in {1..90}; do
  if curl --fail --silent --output /dev/null "${E2E_BASE_URL}/health"; then break; fi
  sleep 1
done
if ! curl --fail --silent --output /dev/null "${E2E_BASE_URL}/health"; then echo 'Backend container did not become ready.' >&2; exit 1; fi

cd "${ROOT_DIR}/back"
bun test --preload ./test/setup.ts test/e2e
