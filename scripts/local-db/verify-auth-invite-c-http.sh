#!/usr/bin/env bash
#
# Verify Auth flow C against a real local GoTrue, PostgREST, and Edge Runtime
# stack. This uses only disposable local identities and the isolated 54720
# port range.
#
# The stack must already be running:
#   FULL_STACK_PORT_BASE=54720 scripts/local-db/full-stack.sh up
#
# The verifier leaves the stack running and removes only fixture rows/users it
# creates.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$BASH_SOURCE")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PORT_BASE="$(/usr/bin/printenv FULL_STACK_PORT_BASE 2>/dev/null || echo 54720)"
API_PORT=$((PORT_BASE + 1))
DB_PORT=$((PORT_BASE + 2))
INBUCKET_PORT=$((PORT_BASE + 4))
API_BASE="http://127.0.0.1:$API_PORT"
STATUS_FILE="/private/tmp/smelter-auth-flow-c-status.env"
DB_CONTAINER_NAME="supabase_db_$(basename "$REPO_ROOT")"

if [[ "$PORT_BASE" != "54720" ]]; then
  echo "FAIL: FULL_STACK_PORT_BASE must be exactly 54720" >&2
  exit 2
fi

run_dir="$(/usr/bin/mktemp -d /private/tmp/smelter-auth-flow-c-http.XXXXXX)"
user_id_list=""
manager_id=""
location_id=""
preview_token=""
credential_token=""
link_token=""
already_team_token=""
weak_token=""
expired_token=""

die() {
  echo "FAIL: $1" >&2
  exit 1
}

db_psql() {
  /usr/local/bin/docker exec -i "$DB_CONTAINER_NAME" psql -U postgres -d postgres \
    -v ON_ERROR_STOP=1 -q -X "$@"
}

cleanup() {
  set +e

  # Remove invite rows before auth users because created_by references auth.users.
  if [[ -n "$manager_id" ]]; then
  db_psql >/dev/null 2>"$run_dir/cleanup-db.err" <<SQL
delete from public.invites
where token in ('$preview_token', '$credential_token', '$link_token', '$already_team_token', '$weak_token', '$expired_token');
delete from public.locations where id = '$location_id';
SQL
  fi

  for user_id in $user_id_list; do
    [[ -n "$user_id" ]] || continue
    /usr/bin/curl --noproxy '*' -sS --connect-timeout 2 --max-time 8 \
      -X DELETE "$API_BASE/auth/v1/admin/users/$user_id" \
      -H "apikey: $SERVICE_ROLE_KEY" \
      -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
      -o /dev/null 2>"$run_dir/cleanup-auth.err" || true
  done

  /bin/rm -f "$STATUS_FILE"
  /bin/rm -rf "$run_dir"
}
trap cleanup EXIT

# Refresh on every run so a recreated local stack cannot reuse stale keys.
/opt/homebrew/bin/supabase status -o env --workdir "$REPO_ROOT" \
  >"$STATUS_FILE" 2>"$run_dir/status.err" \
  || die "supabase status could not read the local stack"
/bin/chmod 600 "$STATUS_FILE"

# The status command records the temporary config's default labels after the
# full-stack script restores config.toml. Endpoints stay pinned to 54721/22/24.
set -a
. "$STATUS_FILE"
set +a

declare -p PUBLISHABLE_KEY >/dev/null 2>&1 || die "local publishable key is unavailable"
declare -p SERVICE_ROLE_KEY >/dev/null 2>&1 || die "local service-role key is unavailable"

health_file="$run_dir/health.json"
if health_code=$(/usr/bin/curl --noproxy '*' -sS --connect-timeout 3 --max-time 8 \
  -o "$health_file" -w '%{http_code}' "$API_BASE/auth/v1/health" \
  2>"$run_dir/health.err"); then
  :
else
  health_code=000
fi
[[ "$health_code" == "200" ]] || die "GoTrue health did not return HTTP 200"

db_health=$(/usr/local/bin/docker inspect --format '{{.State.Health.Status}}' \
  "$DB_CONTAINER_NAME" 2>"$run_dir/docker.err" || true)
[[ "$db_health" == "healthy" ]] || die "isolated Postgres container is not healthy"

db_scalar() {
  local sql="$1"
  db_psql -Atc "$sql" 2>"$run_dir/psql.err" | /usr/bin/tr -d '\r\n'
}

request_json() {
  local output="$1"
  shift
  local status
  if status=$(/usr/bin/curl --noproxy '*' -sS --connect-timeout 5 --max-time 20 \
    -o "$output" -w '%{http_code}' "$@" 2>"$run_dir/curl.err"); then
    printf '%s' "$status"
  else
    printf '000'
  fi
}

json_reason() {
  local output="$1"
  /usr/bin/jq -r 'if type == "object" then ((.reason // .error // .msg // "no structured error") | tostring | gsub("[[:space:]]+"; " ")) else "non-object response" end' \
    "$output" 2>/dev/null || echo "unreadable response"
}

expect_status() {
  local label="$1" actual="$2" expected="$3" output="$4"
  if [[ "$actual" != "$expected" ]]; then
    die "$label returned HTTP $actual, expected $expected ($(json_reason "$output"))"
  fi
  echo "PASS: $label HTTP $actual"
}

expect_json() {
  local label="$1" output="$2" expression="$3"
  if ! /usr/bin/jq -e "$expression" "$output" >/dev/null 2>"$run_dir/jq.err"; then
    die "$label response did not satisfy its contract"
  fi
  echo "PASS: $label response"
}

register_user() {
  local label="$1" email="$2" password="$3" full_name="$4"
  local output="$run_dir/$label.json"
  local body user_id status
  body=$(/usr/bin/jq -cn --arg email "$email" --arg password "$password" \
    --arg full_name "$full_name" \
    '{email:$email,password:$password,email_confirm:true,user_metadata:{full_name:$full_name}}')
  status=$(request_json "$output" -X POST "$API_BASE/auth/v1/admin/users" \
    -H "apikey: $SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H 'Content-Type: application/json' \
    --data "$body")
  expect_status "$label account creation" "$status" "200" "$output"
  user_id=$(/usr/bin/jq -r '.id // .user.id // empty' "$output" 2>/dev/null || true)
  [[ "$user_id" =~ ^[0-9a-fA-F-]{36}$ ]] || die "$label account creation returned no user id"
  user_id_list="$user_id_list $user_id"
  REGISTERED_USER_ID="$user_id"
  echo "PASS: $label account id received"
}

sign_in() {
  local label="$1" email="$2" password="$3"
  local output="$run_dir/$label-sign-in.json"
  local body status
  body=$(/usr/bin/jq -cn --arg email "$email" --arg password "$password" \
    '{email:$email,password:$password}')
  status=$(request_json "$output" -X POST \
    "$API_BASE/auth/v1/token?grant_type=password" \
    -H "apikey: $PUBLISHABLE_KEY" \
    -H 'Content-Type: application/json' \
    --data "$body")
  expect_status "$label sign-in" "$status" "200" "$output"
  SIGN_IN_ACCESS_TOKEN=$(/usr/bin/jq -r '.access_token // empty' "$output" 2>/dev/null || true)
  SIGN_IN_USER_ID=$(/usr/bin/jq -r '.user.id // empty' "$output" 2>/dev/null || true)
  [[ -n "$SIGN_IN_ACCESS_TOKEN" ]] || die "$label sign-in returned no access token"
  [[ "$SIGN_IN_USER_ID" =~ ^[0-9a-fA-F-]{36}$ ]] || die "$label sign-in returned no user id"
  echo "PASS: $label real GoTrue session"
}

invoke_accept() {
  local output="$1" body="$2" bearer="$3"
  ACCEPT_STATUS=$(request_json "$output" -X POST \
    "$API_BASE/functions/v1/accept-invite" \
    -H "apikey: $PUBLISHABLE_KEY" \
    -H "Authorization: Bearer $bearer" \
    -H 'Content-Type: application/json' \
    --data "$body")
}

run_tag="$(/bin/date +%s)-$(/opt/homebrew/bin/openssl rand -hex 3)"
manager_email="authflow.manager.$run_tag@example.com"
credential_email="authflow.credential.$run_tag@example.com"
provider_email="authflow.provider.$run_tag@example.com"
link_email="authflow.link.$run_tag@example.com"
already_team_email="authflow.existing.$run_tag@example.com"
weak_email="authflow.weak.$run_tag@example.com"
expired_email="authflow.expired.$run_tag@example.com"
manager_password="AuthFlow-Manager-$run_tag"
credential_password="AuthFlow-Credential-$run_tag"
provider_password="AuthFlow-Provider-$run_tag"
link_password="AuthFlow-Link-$run_tag"
already_team_password="AuthFlow-Existing-$run_tag"

preview_token="$(/opt/homebrew/bin/openssl rand -hex 16)"
credential_token="$(/opt/homebrew/bin/openssl rand -hex 16)"
link_token="$(/opt/homebrew/bin/openssl rand -hex 16)"
already_team_token="$(/opt/homebrew/bin/openssl rand -hex 16)"
weak_token="$(/opt/homebrew/bin/openssl rand -hex 16)"
expired_token="$(/opt/homebrew/bin/openssl rand -hex 16)"

register_user manager "$manager_email" "$manager_password" 'HTTP Manager'
manager_id="$REGISTERED_USER_ID"
location_id="$(db_scalar "select gen_random_uuid();")"
[[ "$location_id" =~ ^[0-9a-fA-F-]{36}$ ]] || die "local fixture location id was not generated"

# Set up only local fixture rows. The manager row is needed for invitedBy and
# created_by; later membership state is produced by the Edge Function.
db_psql 2>"$run_dir/setup-db.err" <<SQL
insert into public.users (id, email, name, role)
values ('$manager_id', '$manager_email', 'HTTP Manager', 'manager')
on conflict (id) do update set email = excluded.email, name = excluded.name, role = excluded.role;

insert into public.profiles (id, email, full_name, role, provider, profile_completed)
values ('$manager_id', '$manager_email', 'HTTP Manager', 'manager', 'email', true)
on conflict (id) do update set email = excluded.email, full_name = excluded.full_name,
  role = excluded.role, provider = excluded.provider, profile_completed = true;

insert into public.locations (id, name, short_code, active)
values ('$location_id', 'HTTP Sushi Fixture', 'S-$run_tag', true);

insert into public.invites (token, invited_name, invited_email, role, module_preset,
  location_group, expires_at, created_by)
values
  ('$preview_token', 'HTTP Preview Invite', '$credential_email', 'employee',
    '{"ordering_simple":true,"tips":false,"junk":true}', 'sushi', now() + interval '1 day', '$manager_id'),
  ('$credential_token', 'HTTP Credential Invite', '$credential_email', 'employee',
    '{"ordering_simple":true,"tips":false,"junk":true}', 'sushi', now() + interval '1 day', '$manager_id'),
  ('$link_token', 'HTTP Link Invite', null, 'employee',
    '{"ordering_simple":true,"tips":false}', 'sushi', now() + interval '1 day', '$manager_id'),
  ('$already_team_token', 'HTTP Existing Invite', null, 'manager',
    '{}', 'sushi', now() + interval '1 day', '$manager_id'),
  ('$weak_token', 'HTTP Weak Password Invite', '$weak_email', 'employee',
    '{}', 'sushi', now() + interval '1 day', '$manager_id'),
  ('$expired_token', 'HTTP Expired Invite', '$expired_email', 'employee',
    '{}', 'sushi', now() - interval '1 minute', '$manager_id');
SQL
echo 'PASS: local fixture rows created'

sign_in manager "$manager_email" "$manager_password"
manager_access_token="$SIGN_IN_ACCESS_TOKEN"

link_body=$(/usr/bin/jq -cn --arg token "$link_token" '{token:$token}')
missing_bearer_output="$run_dir/missing-bearer.json"
invoke_accept "$missing_bearer_output" "$link_body" ''
expect_status 'link request without bearer' "$ACCEPT_STATUS" '401' "$missing_bearer_output"
invalid_bearer_output="$run_dir/invalid-bearer.json"
invoke_accept "$invalid_bearer_output" "$link_body" 'invalid-local-test-token'
expect_status 'link request with invalid bearer' "$ACCEPT_STATUS" '401' "$invalid_bearer_output"
echo 'PASS: link requests require a valid authenticated bearer'

preview_body=$(/usr/bin/jq -cn --arg token "$preview_token" \
  '{token:$token,validateOnly:true}')
preview_output="$run_dir/preview.json"
invoke_accept "$preview_output" "$preview_body" "$PUBLISHABLE_KEY"
expect_status 'invite preview' "$ACCEPT_STATUS" '200' "$preview_output"
expect_json 'invite preview' "$preview_output" \
  '(.valid == true and .invitedName == "HTTP Preview Invite" and .invitedBy == "HTTP Manager" and .role == "employee" and .locationGroup == "sushi")'
preview_invited_email=$(/usr/bin/jq -r '.invitedEmail // empty' "$preview_output")
[[ "$preview_invited_email" == "$credential_email" ]] || die 'invite preview returned the wrong invitedEmail'
echo 'PASS: invite preview returns invitedEmail and invitedBy'

expired_preview_body=$(/usr/bin/jq -cn --arg token "$expired_token" \
  '{token:$token,validateOnly:true}')
expired_preview_output="$run_dir/expired-preview.json"
invoke_accept "$expired_preview_output" "$expired_preview_body" "$PUBLISHABLE_KEY"
expect_status 'expired invite preview' "$ACCEPT_STATUS" '200' "$expired_preview_output"
expect_json 'expired invite preview' "$expired_preview_output" \
  '(.valid == false and .reason == "expired" and .invitedBy == "HTTP Manager")'
expired_accept_body=$(/usr/bin/jq -cn --arg token "$expired_token" --arg email "$expired_email" \
  --arg password "$credential_password" '{token:$token,email:$email,password:$password}')
expired_accept_output="$run_dir/expired-accept.json"
invoke_accept "$expired_accept_output" "$expired_accept_body" "$PUBLISHABLE_KEY"
expect_status 'expired invite acceptance' "$ACCEPT_STATUS" '409' "$expired_accept_output"
expect_json 'expired invite reason' "$expired_accept_output" '(.reason == "expired")'
expired_state=$(db_scalar "select case when used_at is null and used_by is null and not exists (select 1 from auth.users where lower(email) = '$expired_email') then '1' else '0' end from public.invites where token = '$expired_token';")
[[ "$expired_state" == '1' ]] || die 'expired invite acceptance left partial state'
echo 'PASS: expired invite is rejected without consumption'

credential_body=$(/usr/bin/jq -cn --arg token "$credential_token" \
  --arg email "$credential_email" --arg password "$credential_password" \
  --arg name 'Client Name Must Not Win' \
  '{token:$token,email:$email,password:$password,name:$name}')
credential_output="$run_dir/credential-accept.json"
invoke_accept "$credential_output" "$credential_body" "$PUBLISHABLE_KEY"
expect_status 'email/password invite acceptance' "$ACCEPT_STATUS" '200' "$credential_output"
expect_json 'email/password invite acceptance' "$credential_output" \
  '(.ok == true and .role == "employee" and .locationGroup == "sushi")'

sign_in credential "$credential_email" "$credential_password"
credential_id="$SIGN_IN_USER_ID"
credential_access_token="$SIGN_IN_ACCESS_TOKEN"
credential_state=$(db_scalar "select case when p.full_name = 'HTTP Credential Invite' and p.role = 'employee' and u.name = 'HTTP Credential Invite' and i.used_by = '$credential_id' and i.used_at is not null then '1' else '0' end from public.profiles p join public.users u on u.id = p.id join public.invites i on i.token = '$credential_token' where p.id = '$credential_id';")
[[ "$credential_state" == '1' ]] || die 'email/password acceptance did not apply invite-owned membership state'
echo 'PASS: email/password acceptance applied invite name and consumed token'

module_state=$(db_scalar "select case when (select enabled from public.user_modules where user_id = '$credential_id' and module_key = 'ordering_simple') = true and not exists (select 1 from public.user_modules where user_id = '$credential_id' and module_key = 'junk') then '1' else '0' end;")
[[ "$module_state" == '1' ]] || die 'module preset filtering was not applied'
echo 'PASS: module preset applied known keys only'

# Model an unaffiliated provider identity while retaining a disposable local
# account for the manager list-users check.
register_user provider "$provider_email" "$provider_password" 'HTTP Provider User'
provider_id="$REGISTERED_USER_ID"
db_psql 2>"$run_dir/provider-db.err" <<SQL
update auth.users set raw_app_meta_data = '{"provider":"apple"}' where id = '$provider_id';
insert into public.users (id, email, name, role)
values ('$provider_id', '$provider_email', 'HTTP Provider User', 'employee')
on conflict (id) do update set email = excluded.email, name = excluded.name, role = 'employee';
insert into public.profiles (id, email, full_name, role, provider, profile_completed)
values ('$provider_id', '$provider_email', 'HTTP Provider User', null, 'apple', false)
on conflict (id) do update set email = excluded.email, full_name = excluded.full_name,
  role = null, provider = 'apple', profile_completed = false;
SQL
list_users_output="$run_dir/list-users.json"
list_users_status=$(request_json "$list_users_output" -X POST \
  "$API_BASE/functions/v1/list-users" \
  -H "apikey: $PUBLISHABLE_KEY" \
  -H "Authorization: Bearer $manager_access_token" \
  -H 'Content-Type: application/json' --data '{}')
expect_status 'manager list-users' "$list_users_status" '200' "$list_users_output"
unresolved_provider_count=$(/usr/bin/jq --arg user_id "$provider_id" \
  '[.users[]? | select(.id == $user_id)] | length' "$list_users_output")
[[ "$unresolved_provider_count" == '0' ]] || die 'unaffiliated provider identity leaked into manager user list'
echo 'PASS: manager list-users excludes unresolved provider identity'
register_user link "$link_email" "$link_password" 'HTTP Link User'
link_id="$REGISTERED_USER_ID"
sign_in link "$link_email" "$link_password"
link_access_token="$SIGN_IN_ACCESS_TOKEN"

link_output="$run_dir/link-accept.json"
invoke_accept "$link_output" "$link_body" "$link_access_token"
expect_status 'authenticated token-only link acceptance' "$ACCEPT_STATUS" '200' "$link_output"
expect_json 'authenticated token-only link acceptance' "$link_output" \
  '(.ok == true and .role == "employee" and .locationGroup == "sushi")'

if [[ "${SMELTER_SKIP_IDEMPOTENT_RETRY:-0}" == '1' ]]; then
  echo 'SKIP: same-user link retry (explicit diagnostic mode)'
else
  link_retry_output="$run_dir/link-retry.json"
  invoke_accept "$link_retry_output" "$link_body" "$link_access_token"
  expect_status 'same-user link retry' "$ACCEPT_STATUS" '200' "$link_retry_output"
  expect_json 'same-user link retry' "$link_retry_output" \
    '(.ok == true and .role == "employee" and .locationGroup == "sushi")'
  link_state=$(db_scalar "select case when i.used_by = '$link_id' and i.used_at is not null and (select count(*) from public.profiles where id = '$link_id') = 1 then '1' else '0' end from public.invites i where i.token = '$link_token';")
  [[ "$link_state" == '1' ]] || die 'link retry did not preserve one consumed membership'
  echo 'PASS: link acceptance is idempotent for the same authenticated user'
fi

different_user_output="$run_dir/link-different-user.json"
sign_in different-user "$credential_email" "$credential_password"
different_user_access_token="$SIGN_IN_ACCESS_TOKEN"
invoke_accept "$different_user_output" "$link_body" "$different_user_access_token"
expect_status 'different-user used invite rejection' "$ACCEPT_STATUS" '409' "$different_user_output"
expect_json 'different-user used invite reason' "$different_user_output" '(.reason == "used")'
echo 'PASS: a different authenticated user cannot reuse the consumed invite'

register_user already-team "$already_team_email" "$already_team_password" 'HTTP Existing User'
already_team_id="$REGISTERED_USER_ID"
sign_in already-team "$already_team_email" "$already_team_password"
already_team_access_token="$SIGN_IN_ACCESS_TOKEN"
db_psql 2>"$run_dir/existing-team-db.err" <<SQL
insert into public.users (id, email, name, role)
values ('$already_team_id', '$already_team_email', 'HTTP Existing User', 'employee')
on conflict (id) do update set email = excluded.email, name = excluded.name, role = 'employee';
insert into public.profiles (id, email, full_name, role, provider, profile_completed)
values ('$already_team_id', '$already_team_email', 'HTTP Existing User', 'employee', 'email', true)
on conflict (id) do update set email = excluded.email, full_name = excluded.full_name,
  role = 'employee', provider = excluded.provider, profile_completed = true;
SQL
existing_membership_state=$(db_scalar "select case when (select role from public.profiles where id = '$already_team_id') = 'employee' and (select role from public.users where id = '$already_team_id') = 'employee' then '1' else '0' end;")
[[ "$existing_membership_state" == '1' ]] || die 'already-on-team fixture did not establish an employee membership'
echo 'PASS: existing-user fixture has an employee membership'

already_team_body=$(/usr/bin/jq -cn --arg token "$already_team_token" '{token:$token}')
already_team_output="$run_dir/already-team.json"
invoke_accept "$already_team_output" "$already_team_body" "$already_team_access_token"
expect_status 'already-on-team rejection' "$ACCEPT_STATUS" '409' "$already_team_output"
expect_json 'already-on-team reason' "$already_team_output" '(.reason == "already_on_team")'
already_team_state=$(db_scalar "select case when used_at is null and used_by is null then '1' else '0' end from public.invites where token = '$already_team_token';")
[[ "$already_team_state" == '1' ]] || die 'already-on-team rejection consumed its invite'
echo 'PASS: already-on-team rejection preserves the invite'

weak_password="$(/usr/bin/printenv SMELTER_WEAK_PASSWORD 2>/dev/null || echo x)"
weak_body=$(/usr/bin/jq -cn --arg token "$weak_token" --arg email "$weak_email" \
  --arg password "$weak_password" '{token:$token,email:$email,password:$password,name:"HTTP Weak Password"}')
weak_output="$run_dir/weak-password.json"
invoke_accept "$weak_output" "$weak_body" "$PUBLISHABLE_KEY"
expect_status 'weak-password mapping' "$ACCEPT_STATUS" '422' "$weak_output"
expect_json 'weak-password reason' "$weak_output" '(.reason == "password_rejected")'
weak_state=$(db_scalar "select case when used_at is null and used_by is null and not exists (select 1 from auth.users where lower(email) = '$weak_email') then '1' else '0' end from public.invites where token = '$weak_token';")
[[ "$weak_state" == '1' ]] || die 'weak-password rejection left an auth user or consumed its invite'
echo 'PASS: weak-password error maps to 422/password_rejected without partial state'

echo "PASS: Auth flow C local HTTP validation complete on API $API_PORT, DB $DB_PORT, Inbucket $INBUCKET_PORT"
