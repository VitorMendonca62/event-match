#!/usr/bin/env bash
# Runs the registration E2E in real browsers against Next.js (host), NestJS, PostgreSQL and the
# fake Brevo (containers). Everything is disposable and torn down on exit (SDD-012, ADR-032).
set -Eeuo pipefail

readonly ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly COMPOSE_FILE="${ROOT_DIR}/docker-compose.back.test.yml"
readonly ENV_FILE="${ROOT_DIR}/back/.env.test.local"
readonly PROJECT_NAME="eventmatch-front-e2e-${$}"
readonly FRONT_PORT="${FRONT_E2E_PORT:-3100}"
readonly LOG_DIR="${ROOT_DIR}/front/test-results"
next_pid=""

if [[ ! -f "${ENV_FILE}" ]]; then
  echo 'back/.env.test.local is required for the E2E runner.' >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

compose=(docker compose --env-file "${ENV_FILE}" --project-name "${PROJECT_NAME}" --file "${COMPOSE_FILE}")

cleanup() {
  local exit_code=$?
  if [[ -n "${next_pid}" ]]; then
    kill "${next_pid}" >/dev/null 2>&1 || true
    pkill -P "${next_pid}" >/dev/null 2>&1 || true
    wait "${next_pid}" >/dev/null 2>&1 || true
  fi
  "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
  exit "${exit_code}"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if ! docker info >/dev/null 2>&1; then echo 'Docker daemon is unavailable.' >&2; exit 1; fi
for tool in bun curl; do
  if ! command -v "${tool}" >/dev/null 2>&1; then echo "${tool} is required to run the frontend E2E." >&2; exit 1; fi
done
if curl --silent --output /dev/null "http://localhost:${FRONT_PORT}"; then
  echo "Port ${FRONT_PORT} is already in use. Set FRONT_E2E_PORT to a free port." >&2
  exit 1
fi

: "${POSTGRES_DB:=eventmatch}"
: "${POSTGRES_USER:=eventmatch}"
: "${POSTGRES_PORT:=0}"
: "${BACK_PORT:=0}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set in back/.env.test.local}"
: "${CONTACT_HASH_KEY:?CONTACT_HASH_KEY must be set in back/.env.test.local}"
: "${CONTACT_ENCRYPTION_KEY:?CONTACT_ENCRYPTION_KEY must be set in back/.env.test.local}"
: "${VERIFICATION_SECRET_KEY:?VERIFICATION_SECRET_KEY must be set in back/.env.test.local}"
# Secrets are disposable per run; the same token must reach the backend and the BFF.
random_secret() { bun -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("base64"))'; }
REGISTRATION_FLOW_SECRET="$(random_secret)"
BFF_INTERNAL_TOKEN="$(random_secret)"
ORIGIN_FINGERPRINT_KEY="$(random_secret)"
AUTH_SESSION_SECRET="$(random_secret)"
PROFILE_INVITATION_KEY="$(random_secret)"
PROFILE_MEDIA_KEY="$(random_secret)"
FRONTEND_PUBLIC_URL="http://localhost:${FRONT_PORT}"
export POSTGRES_DB POSTGRES_USER POSTGRES_PORT BACK_PORT POSTGRES_PASSWORD
export CONTACT_HASH_KEY CONTACT_ENCRYPTION_KEY VERIFICATION_SECRET_KEY
export REGISTRATION_FLOW_SECRET BFF_INTERNAL_TOKEN FRONTEND_PUBLIC_URL AUTH_SESSION_SECRET PROFILE_INVITATION_KEY PROFILE_MEDIA_KEY
# Every fixture login shares one origin fingerprint (EDGE_PROVIDER=fixture); the per-contact limit stays 5.
export AUTH_LOGIN_ORIGIN_LIMIT=1000
export PROFILE_MEDIA_ENABLED=true PROFILE_MEDIA_PROVIDER=fake
url_encode() { bun -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$1"; }
encoded_user="$(url_encode "${POSTGRES_USER}")"
encoded_password="$(url_encode "${POSTGRES_PASSWORD}")"
export DATABASE_URL="postgresql://${encoded_user}:${encoded_password}@postgres:5432/${POSTGRES_DB}"

if ! "${compose[@]}" up --detach --wait --wait-timeout 120 postgres >/dev/null; then
  echo 'Temporary PostgreSQL did not become ready.' >&2
  exit 1
fi
"${compose[@]}" run --rm back bun run --cwd back db:migrate >/dev/null
"${compose[@]}" up --detach back >/dev/null

back_binding="$("${compose[@]}" port back 3001)"
back_port="${back_binding##*:}"
brevo_binding="$("${compose[@]}" port fake-brevo 4010)"
postgres_binding="$("${compose[@]}" port postgres 5432)"
if [[ ! "${back_port}" =~ ^[0-9]+$ ]]; then echo 'Could not determine the backend test port.' >&2; exit 1; fi

for _ in {1..90}; do
  if curl --fail --silent --output /dev/null "http://127.0.0.1:${back_port}/health"; then break; fi
  sleep 1
done
if ! curl --fail --silent --output /dev/null "http://127.0.0.1:${back_port}/health"; then
  echo 'Backend container did not become ready.' >&2
  exit 1
fi

mkdir -p "${LOG_DIR}"
export NODE_ENV=test EDGE_PROVIDER=fixture PORT="${FRONT_PORT}" HOSTNAME=127.0.0.1 AUTH_UI_ENABLED=true PROFILE_UI_ENABLED=true
export BACKEND_INTERNAL_URL="http://127.0.0.1:${back_port}"
export ORIGIN_FINGERPRINT_KEY

bun run --cwd "${ROOT_DIR}/front" build >"${LOG_DIR}/next-build.log" 2>&1 || {
  cat "${LOG_DIR}/next-build.log" >&2
  echo 'next build failed.' >&2
  exit 1
}
bun run --cwd "${ROOT_DIR}/front" start >"${LOG_DIR}/next-start.log" 2>&1 &
next_pid=$!

for _ in {1..60}; do
  if curl --fail --silent --output /dev/null "http://localhost:${FRONT_PORT}/cadastro"; then break; fi
  if ! kill -0 "${next_pid}" >/dev/null 2>&1; then cat "${LOG_DIR}/next-start.log" >&2; echo 'next start exited.' >&2; exit 1; fi
  sleep 1
done
if ! curl --fail --silent --output /dev/null "http://localhost:${FRONT_PORT}/cadastro"; then
  cat "${LOG_DIR}/next-start.log" >&2
  echo 'Next.js did not answer on /cadastro.' >&2
  exit 1
fi

export E2E_FRONT_URL="http://localhost:${FRONT_PORT}"
export E2E_FAKE_BREVO_URL="http://127.0.0.1:${brevo_binding##*:}"
export E2E_DATABASE_URL="postgresql://${encoded_user}:${encoded_password}@127.0.0.1:${postgres_binding##*:}/${POSTGRES_DB}"

cd "${ROOT_DIR}/front"
bunx playwright test "$@"
