#!/usr/bin/env bash
# Aplica les migracions sobre una base de dades local buida (amb l'esquema
# auth simulat) i executa supabase/tests/verificacio.sql.
#
# Ús: PGHOST=... PGPORT=... PGUSER=postgres scripts/prova-sql.sh
set -euo pipefail
cd "$(dirname "$0")/.."

DB="gestio_prova_$$"
psql -v ON_ERROR_STOP=1 -q -d postgres -c "create database $DB"
trap 'psql -q -d postgres -c "drop database if exists $DB" >/dev/null' EXIT

# Supabase anomena la base de dades `postgres`; la migració 0001 hi fixa la
# zona horària. En local la redirigim a la base de proves.
run() { sed "s/alter database postgres/alter database $DB/" "$1" | psql -v ON_ERROR_STOP=1 -q -d "$DB" -f -; }

run supabase/tests/stub_auth_local.sql
for f in supabase/migrations/*.sql; do
  echo "· $f"
  run "$f"
done
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/tests/verificacio.sql
