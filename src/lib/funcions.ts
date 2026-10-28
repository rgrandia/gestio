import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Funcions opcionals per persona (migració 0019). Ara només n'hi ha una:
// 'xarxes'. El menú en depèn, però qui decideix què es pot llegir és l'RLS.
// Si la base de dades encara no té la 0019, la crida falla i no es mostra res.
export const teXarxes = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("te_funcio", { p_funcio: "xarxes" });
  return !error && data === true;
});
