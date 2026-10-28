import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { diaCurt } from "@/lib/dates";

type Taula = "tasques" | "fases" | "entregables" | "publicacions";

// Avís (no bloqueja res) si la persona que ha de fer una cosa no hi és aquell
// dia: té vacances o és festiu (seu o de tot l'equip), segons el calendari
// personal (migració 0020). La persona és qui la té assignada o, si no n'hi
// ha (o és externa), el responsable del projecte. Sense la 0020, cap avís.
export async function avisDisponibilitat(
  supabase: SupabaseClient,
  taula: Taula,
  id: string,
  opcions: { data?: string | null; persona?: string | null } = {},
): Promise<string | undefined> {
  let data = opcions.data;
  let persona = opcions.persona ?? null;

  if (data === undefined || !persona) {
    const camps =
      taula === "tasques"
        ? "data_prevista, assignada_a, projectes(responsable_id)"
        : taula === "publicacions"
          ? "data_prevista, responsable_id"
          : "data_prevista, responsable_id, projectes(responsable_id)";
    const { data: fila } = await supabase.from(taula).select(camps).eq("id", id).maybeSingle();
    if (!fila) return undefined;
    const f = fila as unknown as {
      data_prevista: string | null;
      assignada_a?: string | null;
      responsable_id?: string | null;
      projectes?: { responsable_id: string } | null;
    };
    if (data === undefined) data = f.data_prevista;
    if (!persona) persona = f.assignada_a ?? f.responsable_id ?? null;
    // un extern no té calendari: mana el del responsable del projecte
    if (persona) {
      const { data: p } = await supabase.from("perfils").select("extern").eq("id", persona).maybeSingle();
      if (p?.extern) persona = null;
    }
    if (!persona) persona = f.projectes?.responsable_id ?? null;
  }
  if (!data) return undefined;

  const { data: dies, error } = await supabase
    .from("calendari_dies")
    .select("perfil_id, tipus, nota")
    .eq("data", data)
    .eq("actiu", true)
    .in("tipus", ["vacances", "festiu"]);
  if (error || !dies?.length) return undefined;

  const equip = dies.find((d) => d.perfil_id === null);
  if (equip) return `Compte: el ${diaCurt(data)} és festiu de tot l'equip${equip.nota ? ` (${equip.nota})` : ""}.`;
  const seu = persona ? dies.find((d) => d.perfil_id === persona) : undefined;
  if (!seu) return undefined;
  const { data: p } = await supabase.from("perfils").select("nom").eq("id", persona!).maybeSingle();
  const qui = p?.nom ?? "Aquesta persona";
  return `Compte: ${qui} té ${seu.tipus === "vacances" ? "vacances" : "festiu"} el ${diaCurt(data)}.`;
}
