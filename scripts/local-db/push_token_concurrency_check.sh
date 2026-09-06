#!/usr/bin/env bash
#
# push_token_concurrency_check.sh
#
# Two users register the same device token at the same moment, with no active
# row to arbitrate between them. The advisory lock in claim_device_push_token
# has to serialize them so the later registration wins, instead of the second
# one failing on the one-active-owner unique index.
#
# The single-session fixture cannot express this: it needs two connections.
#
# Usage, against a container left by verify-migrations.sh --keep:
#   scripts/local-db/verify-migrations.sh --keep
#   scripts/local-db/push_token_concurrency_check.sh <container-name>
#
# Exit 0 = PASS. The script removes its own rows and leaves the container up.

set -euo pipefail

CONTAINER="${1:-}"
if [[ -z "$CONTAINER" ]]; then
  echo "usage: $0 <postgres-container-name>" >&2
  exit 2
fi

USER_A='dddddddd-3000-4000-8000-000000000001'
USER_B='dddddddd-3000-4000-8000-000000000002'
TOKEN='ExponentPushToken[concurrency-shared-device]'
# Session 1 holds its transaction open this long after claiming.
HOLD_SECONDS=3

psql_in() {
  docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"
}

cleanup() {
  psql_in -q <<SQL || true
delete from public.device_push_tokens where user_id in ('$USER_A', '$USER_B');
delete from public.users where id in ('$USER_A', '$USER_B');
delete from auth.users where id in ('$USER_A', '$USER_B');
SQL
}
trap cleanup EXIT

echo "==> Seeding two users"
psql_in -q <<SQL
insert into auth.users (id, email) values
  ('$USER_A', 'concurrency-a@example.test'),
  ('$USER_B', 'concurrency-b@example.test')
on conflict (id) do nothing;
insert into public.users (id, email, name, role) values
  ('$USER_A', 'concurrency-a@example.test', 'Concurrency A', 'employee'),
  ('$USER_B', 'concurrency-b@example.test', 'Concurrency B', 'employee')
on conflict (id) do nothing;
delete from public.device_push_tokens where expo_push_token = '$TOKEN';
SQL

echo "==> Session 1 claims the token and holds its transaction for ${HOLD_SECONDS}s"
(
  psql_in -q <<SQL
begin;
insert into public.device_push_tokens (user_id, expo_push_token, platform, active)
values ('$USER_A', '$TOKEN', 'ios', true);
select pg_sleep($HOLD_SECONDS);
commit;
SQL
  echo "    session 1 committed"
) &
SESSION_ONE=$!

# Long enough that session 1 is certainly inside its transaction holding the
# advisory lock, short enough that it is still holding it.
python3 -c "import time; time.sleep(1)"

echo "==> Session 2 registers the same token while session 1 still holds it"
SECOND_START=$(python3 -c "import time; print(time.time())")
if ! psql_in -q <<SQL
begin;
insert into public.device_push_tokens (user_id, expo_push_token, platform, active)
values ('$USER_B', '$TOKEN', 'ios', true);
commit;
SQL
then
  echo "FAIL: the second registration errored instead of taking the token over" >&2
  wait "$SESSION_ONE" || true
  exit 1
fi
SECOND_WAITED=$(python3 -c "import time; print(round(time.time() - $SECOND_START, 2))")
echo "    session 2 committed after waiting ${SECOND_WAITED}s"

wait "$SESSION_ONE"

echo "==> Result"
psql_in -c "select user_id, active, claimed_at from public.device_push_tokens where expo_push_token = '$TOKEN' order by claimed_at;"

WINNER="$(psql_in -Atc "select user_id::text from public.device_push_tokens where expo_push_token = '$TOKEN' and active")"
LOSERS="$(psql_in -Atc "select count(*) from public.device_push_tokens where expo_push_token = '$TOKEN' and not active")"

if [[ "$WINNER" != "$USER_B" ]]; then
  echo "FAIL: the later registration did not win the token (active owner: '$WINNER')" >&2
  exit 1
fi
if [[ "$LOSERS" != "1" ]]; then
  echo "FAIL: expected exactly one retired row, found $LOSERS" >&2
  exit 1
fi
if python3 -c "import sys; sys.exit(0 if $SECOND_WAITED >= 0.5 else 1)"; then
  echo "PASS: concurrent claims serialized, the later registration won, no unique violation."
else
  echo "FAIL: session 2 did not wait, so it never contended for the lock" >&2
  exit 1
fi
