import "server-only";
import { createClient } from "@/lib/supabase/server";
import { comprova } from "@/lib/dades";

// Projectes als quals es pot lligar una publicació (no interns, ni tancats,
// ni a la paperera).
export async function projectesPerLligar(): Promise<{ id: string; titol: string }[]> {
  const supabase = await createClient();
  const files = comprova(
    await supabase
      .from("projectes")
      .select("id, titol, numero_estudi, clients(nom)")
      .is("intern_de", null)
      .is("eliminat_el", null)
      .in("estat", ["actiu", "pausat"])
      .order("titol"),
  ) as unknown as { id: string; titol: string; numero_estudi: string | null; clients: { nom: string } | null }[];
  return files.map((p) => ({
    id: p.id,
    titol: [(p.numero_estudi ? `${p.numero_estudi} · ` : "") + p.titol, p.clients?.nom].filter(Boolean).join(" — "),
  }));
}
