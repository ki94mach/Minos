#!/usr/bin/env bash
# Deploy CRA build/ to a static web root (I7).
# Usage: ./deploy/sync-spa.sh /var/www/minos/build
set -euo pipefail
DEST="${1:?Usage: $0 /path/to/web/root}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ ! -f "$ROOT/build/index.html" ]]; then
  echo "Missing $ROOT/build/index.html — run: npm run build" >&2
  exit 1
fi

mkdir -p "$DEST"
rsync -a --delete "$ROOT/build/" "$DEST/"
echo "Deployed SPA to $DEST"
