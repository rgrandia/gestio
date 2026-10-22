#!/usr/bin/env bash
# Comprovacions estàtiques de les migracions (CI):
#   * src/lib/versio.ts apunta a la darrera migració;
#   * cada migració des de la 0014 es registra ella mateixa a
#     migracions_aplicades (així consta encara que s'apliqui a mà).
set -euo pipefail
cd "$(dirname "$0")/.."

darrera=$(basename "$(ls supabase/migrations/*.sql | sort | tail -1)" .sql)
esperada=$(sed -n 's/.*ESQUEMA_ESPERAT = "\(.*\)".*/\1/p' src/lib/versio.ts)
if [ "$darrera" != "$esperada" ]; then
  echo "src/lib/versio.ts diu $esperada però la darrera migració és $darrera" >&2
  exit 1
fi

errors=0
for f in supabase/migrations/*.sql; do
  nom=$(basename "$f" .sql)
  [[ "$nom" < "20261029000014" ]] && continue
  if ! grep -q "insert into migracions_aplicades (nom) values ('$nom')" "$f"; then
    echo "$f no es registra a migracions_aplicades" >&2
    errors=1
  fi
done
exit $errors
