#!/usr/bin/env bash
# I7 — Verify client-side routes return 200 (index.html), not 404 from the static host.
# Usage: ./scripts/smoke-spa-routes.sh https://minos.example.com
BASE="${1:?Usage: $0 <spa-base-url>}"
BASE="${BASE%/}"

routes=(
  "/"
  "/home"
  "/characteristics"
  "/drugs"
  "/patients"
  "/patients/test-root-id"
  "/treatments"
  "/follow-ups"
)

failed=0
for path in "${routes[@]}"; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" "$BASE$path")
  if [[ "$code" == "200" ]]; then
    echo "OK  $code  $path"
  else
    echo "FAIL $code  $path (expected 200 — check SPA fallback / index.html)"
    failed=1
  fi
done

exit $failed
