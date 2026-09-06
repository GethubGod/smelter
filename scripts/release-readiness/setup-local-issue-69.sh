#!/usr/bin/env bash
#
# setup-local-issue-69.sh - build the disposable fixture set for the issue #69
# mutation pass on the local full stack. Loopback only. Never point this at a
# remote Supabase project.
#
# Usage:
#   FULL_STACK_PORT_BASE=54520 scripts/release-readiness/setup-local-issue-69.sh
#
# Assumes scripts/local-db/full-stack.sh up has already run on the same port
# base. Creates three auth users through the local GoTrue admin API, loads the
# two release-readiness fixtures, writes known PINs into login_identities, and
# applies the service_role grants that issue #63 tracks.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PORT_BASE="${FULL_STACK_PORT_BASE:-54420}"
API_URL="http://127.0.0.1:$((PORT_BASE + 1))"
DB_CONTAINER="supabase_db_$(basename "$REPO_ROOT")"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU}"

if [[ "$API_URL" != http://127.0.0.1:* ]]; then
  echo "setup-local-issue-69: refusing a non-loopback API URL" >&2
  exit 1
fi

psql_in() {
  docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres "$@"
}

create_user() {
  # $1 email, $2 password. Prints the auth user id, creating the user if new.
  local email="$1" password="$2" id
  id="$(psql_in -Atc "select id from auth.users where email = '$email'")"
  if [[ -n "$id" ]]; then
    echo "$id"
    return 0
  fi
  curl -sS -X POST "$API_URL/auth/v1/admin/users" \
    -H "apikey: $SERVICE_KEY" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$password\",\"email_confirm\":true}" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])'
}

echo "==> Creating disposable auth users on $API_URL"
MANAGER_ID="$(create_user e2e.manager@smelter.test 'LocalQaManager1!')"
EMPLOYEE_ID="$(create_user e2e.employee@smelter.test 'LocalQaEmployee1!')"
EMPLOYEE2_ID="$(create_user e2e.employee2@smelter.test 'LocalQaEmployee2!')"
echo "manager   $MANAGER_ID"
echo "employee  $EMPLOYEE_ID"
echo "employee2 $EMPLOYEE2_ID"

echo "==> Loading release-readiness fixtures"
psql_in -v ON_ERROR_STOP=1 -q \
  -v manager_id="$MANAGER_ID" \
  -v employee_id="$EMPLOYEE_ID" \
  -v employee2_id="$EMPLOYEE2_ID" \
  < "$SCRIPT_DIR/seed-local-mobile-e2e.sql"
psql_in -v ON_ERROR_STOP=1 -q < "$SCRIPT_DIR/seed-local-quick-order-catalog.sql"

echo "==> Writing known sign-in PINs (manager 1111, employee 2222, employee two 3333)"
psql_in -v ON_ERROR_STOP=1 -q \
  -v manager_id="$MANAGER_ID" \
  -v employee_id="$EMPLOYEE_ID" \
  -v employee2_id="$EMPLOYEE2_ID" <<'SQL'
insert into public.login_identities (user_id, login_name, display_name, credential_kind, secret_hash, updated_by)
values
  (:'manager_id'::uuid, public.normalize_login_name('E2E Manager'), 'E2E Manager', 'pin', extensions.crypt('1111', extensions.gen_salt('bf')), :'manager_id'::uuid),
  (:'employee_id'::uuid, public.normalize_login_name('E2E Employee'), 'E2E Employee', 'pin', extensions.crypt('2222', extensions.gen_salt('bf')), :'manager_id'::uuid),
  (:'employee2_id'::uuid, public.normalize_login_name('E2E Employee Two'), 'E2E Employee Two', 'pin', extensions.crypt('3333', extensions.gen_salt('bf')), :'manager_id'::uuid)
on conflict (user_id) do update set
  login_name = excluded.login_name,
  display_name = excluded.display_name,
  credential_kind = excluded.credential_kind,
  secret_hash = excluded.secret_hash,
  updated_by = excluded.updated_by;
SQL

echo "==> Applying service_role grants (issue #63 workaround)"
psql_in -v ON_ERROR_STOP=1 -q <<'SQL'
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;
SQL

cat <<EOF
PASS: issue #69 fixture ready.
  MANAGER_ID=$MANAGER_ID
  EMPLOYEE_ID=$EMPLOYEE_ID
  EMPLOYEE2_ID=$EMPLOYEE2_ID
EOF
