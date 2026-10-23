// Escriu la consulta SQL que comprova que la base de dades té tot el que
// demana src/lib/esquema-requerit.json. Ús: node scripts/comprova-requerit.mjs | psql ...
import { readFileSync } from "node:fs";

const r = JSON.parse(readFileSync(new URL("../src/lib/esquema-requerit.json", import.meta.url)));
const llista = (xs) => `array[${xs.map((x) => `'${x.replaceAll("'", "''")}'`).join(", ")}]::text[]`;
console.log(`do $$
declare falta text[] := falten_objectes(${llista(r.funcions)}, ${llista(r.columnes)});
begin
  if cardinality(falta) > 0 then
    raise exception 'Falten objectes a la base de dades: %', array_to_string(falta, ', ');
  end if;
  raise notice 'esquema requerit: tot hi és';
end $$;`);
