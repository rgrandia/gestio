#!/usr/bin/env bash
# Aplica, en ordre, les migracions de supabase/migrations que la base de dades
# encara no té (segons la taula migracions_aplicades, migració 0014).
#
# Ús: DATABASE_URL=postgres://... scripts/aplica-migracions.sh
#
# Cada migració s'aplica en una sola transacció junt amb la fila que la
# registra: o entra sencera o no entra.
#
# Casos:
#   * base de dades buida (sense taula projectes): les aplica totes;
#   * base de dades amb la 0014 o posterior: aplica les que falten;
#   * base de dades anterior a la 0014: s'atura. No hi ha manera de saber
#     quines de les antigues té; aplica la 0014 a mà a l'editor SQL i a partir
#     d'aquí ja va sol.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${DATABASE_URL:?Cal la variable DATABASE_URL}"

psql_() { psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 "$@"; }

te_registre=$(psql_ -tAc "select to_regclass('public.migracions_aplicades') is not null")
te_esquema=$(psql_ -tAc "select to_regclass('public.projectes') is not null")

if [ "$te_registre" != "t" ] && [ "$te_esquema" = "t" ]; then
  echo "La base de dades té l'esquema però no la taula migracions_aplicades (és anterior a la 0014)." >&2
  echo "Aplica la migració 0014 a mà a l'editor SQL de Supabase i torna-ho a provar." >&2
  exit 1
fi

aplicades=""
if [ "$te_registre" = "t" ]; then
  aplicades=$(psql_ -tAc "select nom from migracions_aplicades")
fi

n=0
for f in supabase/migrations/*.sql; do
  nom=$(basename "$f" .sql)
  if grep -qxF "$nom" <<<"$aplicades"; then
    continue
  fi
  echo "· aplicant $nom"
  # La fila de registre va al final i dins de la mateixa transacció. Les
  # migracions anteriors a la 0014 no la poden escriure (la taula encara no
  # existeix): la 0014 les registra totes en crear-la.
  {
    cat "$f"
    echo
    echo "do \$\$ begin
      if to_regclass('public.migracions_aplicades') is not null then
        insert into public.migracions_aplicades (nom) values ('$nom') on conflict do nothing;
      end if;
    end \$\$;"
  } | psql_ -1 -f -
  n=$((n + 1))
done

echo "migracions aplicades ara: $n · darrera: $(psql_ -tAc 'select versio_esquema()')"
