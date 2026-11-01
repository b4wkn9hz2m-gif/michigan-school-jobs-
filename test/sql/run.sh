#!/usr/bin/env bash
# Runs the migration + security checks against a throwaway local Postgres 16 (run as root in CI/containers).
set -euo pipefail
cd "$(dirname "$0")/../.."
P=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
T=$(mktemp -d); chmod 755 "$T"; cp supabase/migrations/*.sql test/sql/*.sql "$T"; chmod 644 "$T"/*.sql; chown -R postgres "$T"
su postgres -c "$P/initdb -D $T/data -A trust >/dev/null && $P/pg_ctl -D $T/data -o \"-k '' -p 5499 -c listen_addresses=localhost\" -l $T/log -w start >/dev/null"
trap 'su postgres -c "$P/pg_ctl -D $T/data stop -m fast >/dev/null"; rm -rf "$T"' EXIT
Q="psql -h localhost -p 5499 -X -q -v ON_ERROR_STOP=1 -t"
su postgres -c "$Q -f $T/auth-stub.sql $(for f in supabase/migrations/*.sql; do printf -- '-f %s/%s ' "$T" "$(basename "$f")"; done) -f $T/security.sql"
