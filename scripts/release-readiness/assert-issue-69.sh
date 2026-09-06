#!/usr/bin/env bash
#
# assert-issue-69.sh - run one psql assertion against the local full stack and
# append the exact command and output to the issue #69 evidence log.
#
# Usage: scripts/release-readiness/assert-issue-69.sh <slug> <<'SQL'
#          select ...;
#        SQL
#
# Loopback only. Reads the SQL from stdin so multi-statement assertions keep
# their formatting in the log.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUT="$REPO_ROOT/docs/release-readiness/e2e/issue-69"
LOG="$OUT/psql-assertions.md"
DB_CONTAINER="supabase_db_$(basename "$REPO_ROOT")"
SLUG="${1:?usage: assert-issue-69.sh <slug> < sql}"

mkdir -p "$OUT"
sql="$(cat)"
result="$(printf '%s\n' "$sql" | docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -X 2>&1)"

{
  printf '\n## %s\n\n' "$SLUG"
  printf 'Run at %s against `%s`.\n\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$DB_CONTAINER"
  printf '```sql\n%s\n```\n\n' "$sql"
  printf '```\n%s\n```\n' "$result"
} >> "$LOG"

printf '%s\n' "$result"
