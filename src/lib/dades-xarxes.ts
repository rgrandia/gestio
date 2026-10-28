import "server-only";
import { createClient } from "@/lib/supabase/server";
import { comprova } from "@/lib/dades";
import { sumaDies } from "@/lib/dates";
import { dilluns, OBERTES, type Compte, type Publicacio } from "@/lib/xarxes";

export type PublicacioLlista = Publicacio & {
  publicacio_canals: { compte_id: string; actiu: boolean; enllac_publicat: string | null }[];
  projectes: { id: string; titol: string; numero_estudi: string | null } | null;
};

const CAMPS =
  "id, titol, text, projecte_id, responsable_id, revisor_id, estat, data_prevista, hora, data_real, enllac_recursos, nota_revisio, aprovada_per, notes, publicacio_canals(compte_id, actiu, enllac_publicat), projectes(id, titol, numero_estudi)";

export async function comptes(): Promise<Compte[]> {
  const supabase = await createClient();
  return comprova(
    await supabase
      .from("xarxes_comptes")
      .select("id, plataforma, nom, url, cadencia_setmanal, signatura, actiu")
      .order("actiu", { ascending: false })
      .order("plataforma")
      .order("nom"),
  ) as Compte[];
}

// Les que surten al calendari entre dues dates: per data prevista o, si ja
// s'han publicat, per data real.
export async function publicacionsEntre(des: string, fins: string): Promise<PublicacioLlista[]> {
  const supabase = await createClient();
  return comprova(
    await supabase
      .from("publicacions")
      .select(CAMPS)
      .neq("estat", "cancellada")
      .or(`and(data_prevista.gte.${des},data_prevista.lte.${fins}),and(data_real.gte.${des},data_real.lte.${fins})`)
      .order("hora", { nullsFirst: false }),
  ) as unknown as PublicacioLlista[];
}

export async function publicacionsObertes(): Promise<PublicacioLlista[]> {
  const supabase = await createClient();
  return comprova(
    await supabase
      .from("publicacions")
      .select(CAMPS)
      .in("estat", OBERTES)
      .order("data_prevista", { nullsFirst: false })
      .order("creat_el", { ascending: false }),
  ) as unknown as PublicacioLlista[];
}

export async function publicadesDesDe(des: string): Promise<PublicacioLlista[]> {
  const supabase = await createClient();
  return comprova(
    await supabase
      .from("publicacions")
      .select(CAMPS)
      .eq("estat", "publicada")
      .gte("data_real", des)
      .order("data_real", { ascending: false }),
  ) as unknown as PublicacioLlista[];
}

export type Marca = { data: string; titol: string; tipus: "efemeride" | "idea" };

// Dates clau i idees amb moment polític dins d'un interval.
export async function marquesEntre(des: string, fins: string): Promise<Marca[]> {
  const supabase = await createClient();
  const [ef, id] = await Promise.all([
    supabase.from("efemerides").select("data, titol, recurrent").eq("actiu", true),
    supabase
      .from("idees")
      .select("titol, data_objectiu")
      .neq("estat", "descartada")
      .gte("data_objectiu", des)
      .lte("data_objectiu", fins),
  ]);
  const marques: Marca[] = [];
  const anys = new Set([des.slice(0, 4), fins.slice(0, 4)]);
  for (const e of comprova(ef) as { data: string; titol: string; recurrent: boolean }[]) {
    const dates = e.recurrent ? [...anys].map((a) => `${a}${e.data.slice(4)}`) : [e.data];
    for (const d of dates) if (d >= des && d <= fins) marques.push({ data: d, titol: e.titol, tipus: "efemeride" });
  }
  for (const i of comprova(id) as { titol: string; data_objectiu: string }[])
    marques.push({ data: i.data_objectiu, titol: i.titol, tipus: "idea" });
  return marques;
}

// Comptes amb objectiu setmanal que no hi arriben (setmana de `hui` i la següent).
export type ForatCadencia = { compte: Compte; setmana: string; previstes: number };
export function foratsCadencia(cs: Compte[], pubs: PublicacioLlista[], hui: string): ForatCadencia[] {
  const forats: ForatCadencia[] = [];
  for (const setmana of [dilluns(hui), sumaDies(dilluns(hui), 7)]) {
    const fi = sumaDies(setmana, 6);
    for (const c of cs) {
      if (!c.actiu || !c.cadencia_setmanal) continue;
      const n = pubs.filter((p) => {
        const d = p.data_real ?? p.data_prevista;
        return d && d >= setmana && d <= fi && p.publicacio_canals.some((k) => k.actiu && k.compte_id === c.id);
      }).length;
      if (n < c.cadencia_setmanal) forats.push({ compte: c, setmana, previstes: n });
    }
  }
  return forats;
}

// Estudis amb la presentació feta fa poc o a punt, i cap
// publicació preparada. Que el client n'autoritzi la difusió ho decideix
// l'equip: l'app només ho recorda.
export type Oportunitat = { projecte_id: string; projecte: string; que: string; data: string; feta: boolean };
export async function oportunitats(hui: string): Promise<Oportunitat[]> {
  const supabase = await createClient();
  const des = sumaDies(hui, -14);
  const fins = sumaDies(hui, 21);
  const filtre = `and(data_real.gte.${des},data_real.lte.${hui}),and(data_real.is.null,data_prevista.gte.${hui},data_prevista.lte.${fins})`;
  const prj = "projectes!inner(id, titol, numero_estudi, estat, intern_de, eliminat_el, arxivat_el)";
  const [fases, lligades] = await Promise.all([
    supabase.from("fases").select(`nom, data_prevista, data_real, estat, ${prj}`).ilike("nom", "presentaci%").neq("estat", "cancellat").or(filtre),
    supabase.from("publicacions").select("projecte_id").neq("estat", "cancellada").not("projecte_id", "is", null),
  ]);
  const ambPublicacio = new Set((comprova(lligades) as { projecte_id: string }[]).map((p) => p.projecte_id));
  type P = { id: string; titol: string; numero_estudi: string | null; estat: string; intern_de: string | null; eliminat_el: string | null; arxivat_el: string | null };
  type Fila = { nom?: string; titol?: string; data_prevista: string | null; data_real: string | null; projectes: P };
  const res = new Map<string, Oportunitat>();
  for (const f of comprova(fases) as unknown as Fila[]) {
    const p = f.projectes;
    if (p.estat !== "actiu" || p.intern_de || p.eliminat_el || p.arxivat_el || ambPublicacio.has(p.id)) continue;
    const data = (f.data_real ?? f.data_prevista)!;
    const ara = res.get(p.id);
    if (ara && ara.data >= data) continue;
    res.set(p.id, {
      projecte_id: p.id,
      projecte: (p.numero_estudi ? `${p.numero_estudi} · ` : "") + p.titol,
      que: (f.nom ?? f.titol ?? "").toLowerCase(),
      data,
      feta: !!f.data_real,
    });
  }
  return [...res.values()].sort((a, b) => a.data.localeCompare(b.data));
}
