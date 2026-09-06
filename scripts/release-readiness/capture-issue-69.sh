#!/usr/bin/env bash
#
# capture-issue-69.sh - capture one evidence pair (screenshot + describe-ui JSON)
# for the issue #69 mutation pass. Headless, by UDID, through scripts/sim.sh.
#
# Usage: scripts/release-readiness/capture-issue-69.sh <slug>
# Writes docs/release-readiness/e2e/issue-69/<slug>.png and <slug>-ui.json

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUT="$REPO_ROOT/docs/release-readiness/e2e/issue-69"
SLUG="${1:?usage: capture-issue-69.sh <slug>}"

export SMELTER_AXE_PATH="${SMELTER_AXE_PATH:-/opt/homebrew/bin/axe}"

mkdir -p "$OUT"
"$REPO_ROOT/scripts/sim.sh" io screenshot "$OUT/$SLUG.png" >/dev/null
"$REPO_ROOT/scripts/sim.sh" input describe-ui > "$OUT/$SLUG-ui.json"
echo "captured $OUT/$SLUG.png"
