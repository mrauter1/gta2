#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${BLOCK_CITY_PORT:-8123}"
BASE_URL="http://127.0.0.1:${PORT}/"
LOG_DIR="${ROOT_DIR}/validation/logs"
HTTP_LOG="${LOG_DIR}/block-city-http-server.log"
VALIDATION_LOG="${LOG_DIR}/block-city-run-validation.log"

mkdir -p "${LOG_DIR}"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "${SERVER_PID}" 2>/dev/null; then
    kill "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT

python3 -m http.server "${PORT}" --directory "${ROOT_DIR}" >"${HTTP_LOG}" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 100); do
  if curl -fsS "${BASE_URL}" >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done

curl -fsS "${BASE_URL}" >/dev/null

node "${ROOT_DIR}/validation/block-city-run-validation.mjs" --base-url="${BASE_URL}" | tee "${VALIDATION_LOG}"
