#!/usr/bin/env bash
# P11 conformance gate — schemathesis vs openapi.yml against a live server.
#
# Excluded checks + rationale:
#   ignored_auth                 — static X-Camplx-Demo-User-Id header keeps auth
#                                  valid while schemathesis swaps Authorization.
#   allow_header_conformance     — Starlette OPTIONS/Allow artifact.
#   positive_data_acceptance     — openapi examples use external image URLs and
#                                  unconstrained strings; we intentionally require
#                                  server-stored media refs + business min-lengths.
#   negative_data_rejection      — conflicts with contract-lenient public query
#                                  parsing (enum filters ignored, not 400) and
#                                  with pydantic 400s on ops whose contract omits
#                                  a 400 response (wrong-typed JSON bodies).
set -euo pipefail
cd "$(dirname "$0")/.."

BASE_URL="${BASE_URL:-http://127.0.0.1:8000/api/v1}"
DEMO_USER_ID="${DEMO_USER_ID:-}"

ARGS=(-u "$BASE_URL" --phases examples,coverage --max-time "${MAX_TIME:-150}"
  --exclude-checks ignored_auth,allow_header_conformance,positive_data_acceptance,negative_data_rejection
  -c all)
if [[ "${MAX_FAILURES:-0}" -ge 1 ]]; then
  ARGS+=(--max-failures "$MAX_FAILURES")
fi
if [[ -n "$DEMO_USER_ID" ]]; then
  ARGS+=(-H "X-Camplx-Demo-User-Id: $DEMO_USER_ID")
fi

exec .venv/bin/schemathesis run ../openapi.yml "${ARGS[@]}"
