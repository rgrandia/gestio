#!/usr/bin/env bash
# Prova que una còpia (pg_dump -Fc de l'esquema public) es pot restaurar:
# la restaura en una base de dades buida i compara quantes files té cada
# taula amb l'original. Una còpia que no s'ha restaurat mai és una suposició.
#
# Ús: ORIGEN=postgres://... DESTI=postgres://... scripts/prova-restauracio.sh copia.dump
#   ORIGEN: la base de dades d'on ve la còpia (per comparar)
#   DESTI:  una base de dades BUIDA i d'usar i llençar (s'hi escriu)
set -euo pipefail
cd "$(dirname "$0")/.."
: "${ORIGEN:?Cal ORIGEN}" "${DESTI:?Cal DESTI}"
COPIA=${1:?Cal el fitxer de la còpia}

psql_() { psql "$1" -X -q -v ON_ERROR_STOP=1 "${@:2}"; }

# Supabase hi té l'esquema auth i els rols; en una base buida cal simular-los.
psql_ "$DESTI" -f supabase/tests/stub_auth_local.sql >/dev/null

errors=$(pg_restore --no-owner --no-privileges -d "$DESTI" "$COPIA" 2>&1 \
  | grep -E "^pg_restore: error" | grep -v 'schema "public" already exists' || true)
if [ -n "$errors" ]; then
  echo "La restauració ha donat errors:" >&2
  echo "$errors" >&2
  exit 1
fi

taules="perfils clients projectes fases entregables tasques contactes idees historial_dates revisions notificacions migracions_aplicades"
diferents=0
for t in $taules; do
  a=$(psql_ "$ORIGEN" -tAc "select count(*) from public.$t")
  b=$(psql_ "$DESTI" -tAc "select count(*) from public.$t")
  if [ "$a" != "$b" ]; then
    echo "· $t: original $a, restaurada $b" >&2
    diferents=1
  else
    echo "· $t: $a files"
  fi
done
if [ "$diferents" = 1 ]; then
  echo "La còpia restaurada no té les mateixes files que l'original (si algú hi escrivia en aquell moment, torneu-ho a provar)." >&2
  exit 1
fi
echo "restauració correcta: versió $(psql_ "$DESTI" -tAc 'select versio_esquema()')"
