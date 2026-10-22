#!/usr/bin/env bash
# Aixeca un Supabase mínim per a les proves de punta a punta, sense Docker:
# Postgres (ja ha d'estar en marxa) + GoTrue (auth) + PostgREST + una passarel·la
# que els serveix com a /auth/v1 i /rest/v1 a 127.0.0.1:54321, igual que Supabase.
#
# NOMÉS PER A PROVES. Les claus i contrasenyes d'aquí són de joguina i no
# s'han de fer servir enlloc més.
#
# Variables (valors per defecte pensats per a la CI):
#   E2E_DB_HOST (localhost; un camí de directori = socket), E2E_DB_PORT (5432),
#   E2E_DB_NAME (postgres), E2E_DB_PASS (postgres), E2E_DIR (/tmp/gestio-e2e)
#
# En acabar, la clau anon queda a $E2E_DIR/anon.key.
set -euo pipefail
cd "$(dirname "$0")/../.."

HOST=${E2E_DB_HOST:-localhost}
PORT=${E2E_DB_PORT:-5432}
DB=${E2E_DB_NAME:-postgres}
PASS=${E2E_DB_PASS:-postgres}
DIR=${E2E_DIR:-/tmp/gestio-e2e}
JWT_SECRET="secret-de-proves-locals-de-com-a-minim-32-caracters"
GOTRUE_VERSIO=v2.177.0
POSTGREST_VERSIO=v12.2.3
mkdir -p "$DIR"

url() { # url USUARI CONTRASENYA
  if [[ "$HOST" == /* ]]; then
    echo "postgres://$1:$2@localhost:$PORT/$DB?host=$HOST&sslmode=disable"
  else
    echo "postgres://$1:$2@$HOST:$PORT/$DB?sslmode=disable"
  fi
}
ADMIN=$(url postgres "$PASS")
psql_() { psql "$ADMIN" -X -q -v ON_ERROR_STOP=1 "$@"; }
espera() { # espera URL NOM
  for _ in $(seq 1 60); do curl -s -o /dev/null "$1" && return 0; sleep 1; done
  echo "$2 no respon" >&2; exit 1
}

# --- binaris ---------------------------------------------------------------
if [ ! -x "$DIR/auth" ]; then
  curl -sSL "https://github.com/supabase/auth/releases/download/$GOTRUE_VERSIO/auth-$GOTRUE_VERSIO-x86.tar.gz" \
    | tar xz -C "$DIR"
fi
if [ ! -x "$DIR/postgrest" ]; then
  curl -sSL "https://github.com/PostgREST/postgrest/releases/download/$POSTGREST_VERSIO/postgrest-$POSTGREST_VERSIO-linux-static-x64.tar.xz" \
    | tar xJ -C "$DIR"
fi

# --- rols i esquema auth, com a Supabase -----------------------------------
psql_ <<SQL
do \$\$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator login noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin login createrole; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end \$\$;
alter role authenticator password '$PASS';
alter role supabase_auth_admin password '$PASS';
grant anon, authenticated, service_role to authenticator;
create schema if not exists auth authorization supabase_auth_admin;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
grant create on database "$DB" to supabase_auth_admin;
alter role supabase_auth_admin set search_path = auth;
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
SQL

# --- GoTrue: crea les taules d'auth en arrencar ------------------------------
(
  cd "$DIR"
  export GOTRUE_DB_DRIVER=postgres
  export DATABASE_URL GOTRUE_DB_DATABASE_URL
  DATABASE_URL=$(url supabase_auth_admin "$PASS"); GOTRUE_DB_DATABASE_URL=$DATABASE_URL
  export GOTRUE_JWT_SECRET="$JWT_SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated
  export GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role
  export API_EXTERNAL_URL=http://127.0.0.1:54321/auth/v1 GOTRUE_SITE_URL=http://127.0.0.1:3000
  export GOTRUE_API_HOST=127.0.0.1 PORT=9999 GOTRUE_DISABLE_SIGNUP=true
  export GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_MAILER_AUTOCONFIRM=true
  export GOTRUE_PASSWORD_MIN_LENGTH=12 GOTRUE_LOG_LEVEL=warn
  nohup ./auth > auth.log 2>&1 < /dev/null &
)
espera http://127.0.0.1:9999/health GoTrue

# --- l'esquema de l'app ------------------------------------------------------
DATABASE_URL="$ADMIN" scripts/aplica-migracions.sh

# --- PostgREST i passarel·la ---------------------------------------------------
cat > "$DIR/postgrest.conf" <<CONF
db-uri = "$(url authenticator "$PASS")"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-port = 3001
server-host = "127.0.0.1"
CONF
(cd "$DIR"; nohup ./postgrest postgrest.conf > postgrest.log 2>&1 < /dev/null &)
nohup node scripts/e2e/passarella.mjs > "$DIR/passarella.log" 2>&1 < /dev/null &
espera http://127.0.0.1:3001/ PostgREST
espera http://127.0.0.1:54321/rest/v1/ passarel·la

# --- claus i usuaris de prova ------------------------------------------------
ANON=$(JWT_SECRET="$JWT_SECRET" node scripts/e2e/token.mjs anon)
SR=$(JWT_SECRET="$JWT_SECRET" node scripts/e2e/token.mjs service_role)
echo "$ANON" > "$DIR/anon.key"
for u in roc:Roc aina:Aina intrus:Intrus; do
  curl -sSf -o /dev/null -X POST http://127.0.0.1:54321/auth/v1/admin/users \
    -H "apikey: $SR" -H "Authorization: Bearer $SR" -H "Content-Type: application/json" \
    -d "{\"email\":\"${u%%:*}@prova.test\",\"password\":\"contrasenya-llarga-1\",\"email_confirm\":true,\"user_metadata\":{\"full_name\":\"${u##*:}\"}}"
done
# Els perfils neixen inactius; l'intrús es queda així.
psql_ -c "update perfils set actiu = true where email in ('roc@prova.test', 'aina@prova.test')"
echo "entorn de proves a punt (anon a $DIR/anon.key)"
