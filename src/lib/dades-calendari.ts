import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DiaMarcat } from "@/lib/calendari";

// Dies marcats (de tothom i festius d'equip) entre dues dates. Si la base de
// dades encara no té la migració 0020, retorna una llista buida.
export async function diesMarcats(des: string, fins: string): Promise<DiaMarcat[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calendari_dies")
    .select("perfil_id, data, tipus, nota")
    .eq("actiu", true)
    .gte("data", des)
    .lte("data", fins);
  return error ? [] : ((data ?? []) as DiaMarcat[]);
}
