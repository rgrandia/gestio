import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DiaMarcat } from "@/lib/calendari";
import type { FeinaDia } from "@/components/CalendariPersonal";

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

type ProjecteFase = { id: string; titol: string; numero_estudi: string | null; responsable_id: string };

// L'inici i el final previst de les fases obertes que porto (assignades a mi,
// o sense ningú en un projecte del qual soc responsable; mai les d'un extern)
// que cauen entre dues dates. En petit al meu calendari i als 7 dies de l'inici.
export async function fasesQuePorto(jo: string, des: string, fins: string, hui: string): Promise<FeinaDia[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fases")
    .select("id, nom, data_inici, data_prevista, responsable_id, projectes!inner(id, titol, numero_estudi, responsable_id, estat, arxivat_el, eliminat_el)")
    .is("data_real", null)
    .neq("estat", "cancellat")
    .or(`and(data_prevista.gte.${des},data_prevista.lte.${fins}),and(data_inici.gte.${des},data_inici.lte.${fins})`)
    .eq("projectes.estat", "actiu")
    .is("projectes.arxivat_el", null)
    .is("projectes.eliminat_el", null);
  const fases = (data ?? []) as unknown as {
    id: string;
    nom: string;
    data_inici: string | null;
    data_prevista: string | null;
    responsable_id: string | null;
    projectes: ProjecteFase;
  }[];
  return fases
    .filter((f) => f.responsable_id === jo || (!f.responsable_id && f.projectes.responsable_id === jo))
    .flatMap((f) => {
      const p = f.projectes;
      const base = { titol: f.nom, on: (p.numero_estudi ? `${p.numero_estudi} · ` : "") + p.titol, href: `/projectes/${p.id}` };
      const r: FeinaDia[] = [];
      if (f.data_inici && f.data_inici >= des && f.data_inici <= fins && f.data_inici !== f.data_prevista)
        r.push({ ...base, clau: `fi${f.id}`, data: f.data_inici, tipus: "fase-inici", vencut: false });
      if (f.data_prevista && f.data_prevista >= des && f.data_prevista <= fins)
        r.push({ ...base, clau: `ff${f.id}`, data: f.data_prevista, tipus: "fase-fi", vencut: f.data_prevista < hui });
      return r;
    });
}
