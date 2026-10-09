#!/usr/bin/env bash
set -Eeuo pipefail

readonly FRONT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly FIXTURE_DIR="${FRONT_DIR}/tests/fixtures/server-only-boundary"
readonly TEMP_DIR="$(mktemp -d)"
readonly TEMP_FRONT_DIR="${TEMP_DIR}/front"
readonly TEST_BFF_SECRET='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='

export NODE_ENV=test
export BACKEND_INTERNAL_URL='http://backend.test'
export FRONTEND_PUBLIC_URL='http://localhost:3000'
export BFF_INTERNAL_TOKEN="${TEST_BFF_SECRET}"
export ORIGIN_FINGERPRINT_KEY="${TEST_BFF_SECRET}"
export EDGE_PROVIDER=fixture
export REGISTRATION_FLOW_SECRET="${TEST_BFF_SECRET}"
export AUTH_SESSION_SECRET="${TEST_BFF_SECRET}"
export PROFILE_INVITATION_KEY="${TEST_BFF_SECRET}"
export PROFILE_MEDIA_KEY="${TEST_BFF_SECRET}"
export AUTH_UI_ENABLED=true
export PROFILE_UI_ENABLED=true

cleanup() {
  if [[ -d "${TEMP_DIR}" ]]; then
    rm -r "${TEMP_DIR}"
  fi
}
trap cleanup EXIT

rsync -a --exclude '.next' --exclude 'node_modules' --exclude '.env' --exclude '.env.*' "${FRONT_DIR}/" "${TEMP_FRONT_DIR}/"
ln -s "${FRONT_DIR}/node_modules" "${TEMP_FRONT_DIR}/node_modules"
mkdir -p "${TEMP_FRONT_DIR}/src/app/server-only-boundary"
cp "${FIXTURE_DIR}/app/page.tsx" "${TEMP_FRONT_DIR}/src/app/server-only-boundary/page.tsx"

run_build() {
  local target="$1"
  (cd "${target}" && NODE_ENV=test PORT=3000 HOSTNAME=127.0.0.1 bunx next build --webpack 2>&1)
}

set +e
output="$(run_build "${TEMP_FRONT_DIR}")"
status=$?
set -e
printf '%s\n' "${output}"

if [[ ${status} -eq 0 ]]; then
  echo 'Expected the client fixture to be rejected by server-only.' >&2
  exit 1
fi

if ! grep -Eq "['\"]use client['\"]" "${FIXTURE_DIR}/app/page.tsx" || \
  ! grep -q "shared/server/catalog-bff" "${FIXTURE_DIR}/app/page.tsx" || \
  ! grep -q "shared/server/profile-bff" "${FIXTURE_DIR}/app/page.tsx"; then
  echo 'The client fixture no longer imports both protected BFF modules.' >&2
  exit 1
fi
build_evidence="${output}"
if [[ -d "${TEMP_FRONT_DIR}/.next/server" ]]; then
  for marker in server-only catalog-bff profile-bff; do
    marker_evidence="$(rg -n -F -m 1 "${marker}" "${TEMP_FRONT_DIR}/.next/server" || true)"
    if [[ -n "${marker_evidence}" ]]; then
      build_evidence+=$'\n'
      build_evidence+="${marker_evidence}"
    fi
  done
fi
for marker in server-only catalog-bff profile-bff; do
  if ! grep -qi "${marker}" <<<"${build_evidence}"; then
    echo "The Next build did not attribute the rejection to ${marker} crossing the server-only boundary." >&2
    exit 1
  fi
done

echo 'The client fixture was rejected by the Next build through both BFF modules and server-only.'
