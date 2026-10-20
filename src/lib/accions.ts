"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { avui, esDataValida } from "@/lib/dates";
import { missatgeError } from "@/lib/errors";
import type { EstatIdea, EstatProjecte, TaulaItem } from "@/lib/tipus";

// Totes les escriptures passen per aquí, amb la sessió de l'usuari i la clau
// pública: l'RLS és qui decideix. Cap acció esborra res (§7.2).

export type Resultat = { error?: string; ok?: boolean };

const TAULES_ITEM: TaulaItem[] = ["fases", "entregables", "tasques"];
const ESTATS_PROJECTE: EstatProjecte[] = ["actiu", "pausat", "tancat", "cancellat"];
const ESTATS_IDEA: EstatIdea[] = ["proposada", "valorada", "assignada", "descartada"];
const TIPUS_CLIENT = ["municipi", "partit", "institucio", "altre"];

function text(fd: FormData, clau: string): string {
  return String(fd.get(clau) ?? "").trim();
}
function opcional(fd: FormData, clau: string): string | null {
  return text(fd, clau) || null;
}
function dataOpcional(fd: FormData, clau: string): string | null | "invalida" {
  const v = text(fd, clau);
  if (!v) return null;
  return esDataValida(v) ? v : "invalida";
}

// ------------------------------------------------------------------
// Les quatre accions de la safata (§5). També es fan servir al detall.
// ------------------------------------------------------------------

export type AccioItem =
  | { accio: "fet"; taula: TaulaItem; id: string; data: string }
  | { accio: "replanificar"; taula: TaulaItem | "projectes"; id: string; data: string; motiu: string }
  | { accio: "revisat"; taula: TaulaItem; id: string }
  | { accio: "cancellar"; taula: TaulaItem; id: string };

export async function accioItem(a: AccioItem): Promise<Resultat> {
  const taulaValida =
    TAULES_ITEM.includes(a.taula as TaulaItem) ||
    (a.accio === "replanificar" && a.taula === "projectes");
  if (!taulaValida) return { error: "Tipus d'element no vàlid." };

  const supabase = await createClient();
  const hui = avui();

  if (a.accio === "fet") {
    if (!esDataValida(a.data)) return { error: "Indica la data real en format AAAA-MM-DD." };
    if (a.data > hui) return { error: "La data real no pot ser posterior a avui." };
    const { error, count } = await supabase
      .from(a.taula)
      .update({ estat: "fet", data_real: a.data }, { count: "exact" })
      .eq("id", a.id);
    if (error) return { error: missatgeError(error) };
    if (!count) return { error: "No s'ha trobat l'element. Recarrega la pàgina." };
    return { ok: true };
  }

  if (a.accio === "replanificar") {
    if (!esDataValida(a.data)) return { error: "Indica la nova data en format AAAA-MM-DD." };
    // El motiu és obligatori excepte en la primera planificació; ho valida el
    // trigger de la base de dades, que és qui mana (§4.2).
    const { error } = await supabase.rpc("replanificar", {
      p_taula: a.taula,
      p_id: a.id,
      p_data: a.data,
      p_motiu: a.motiu.trim(),
    });
    if (error) return { error: missatgeError(error) };
    return { ok: true };
  }

  const canvi =
    a.accio === "revisat" ? { revisat_el: hui } : { estat: "cancellat" as const };
  const { error, count } = await supabase
    .from(a.taula)
    .update(canvi, { count: "exact" })
    .eq("id", a.id);
  if (error) return { error: missatgeError(error) };
  if (!count) return { error: "No s'ha trobat l'element. Recarrega la pàgina." };
  return { ok: true };
}

// ------------------------------------------------------------------
// Clients
// ------------------------------------------------------------------

export async function creaClient(_p: Resultat, fd: FormData): Promise<Resultat> {
  const nom = text(fd, "nom");
  const tipus = text(fd, "tipus");
  if (!nom) return { error: "El client necessita un nom." };
  if (!TIPUS_CLIENT.includes(tipus)) return { error: "Tria un tipus de client." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      nom,
      tipus,
      territori: opcional(fd, "territori"),
      responsable_id: opcional(fd, "responsable_id"),
      notes: opcional(fd, "notes"),
    })
    .select("id")
    .single();
  if (error) return { error: missatgeError(error) };
  redirect(`/clients/${data.id}`);
}

export async function actualitzaClient(_p: Resultat, fd: FormData): Promise<Resultat> {
  const id = text(fd, "id");
  const nom = text(fd, "nom");
  const tipus = text(fd, "tipus");
  if (!nom) return { error: "El client necessita un nom." };
  if (!TIPUS_CLIENT.includes(tipus)) return { error: "Tria un tipus de client." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({
      nom,
      tipus,
      territori: opcional(fd, "territori"),
      responsable_id: opcional(fd, "responsable_id"),
      notes: opcional(fd, "notes"),
      actiu: fd.get("actiu") === "on",
    })
    .eq("id", id);
  if (error) return { error: missatgeError(error) };
  revalidatePath(`/clients/${id}`);
  return { ok: true };
}

// ------------------------------------------------------------------
// Projectes
// ------------------------------------------------------------------

export async function creaProjecte(_p: Resultat, fd: FormData): Promise<Resultat> {
  const titol = text(fd, "titol");
  const tipus = text(fd, "tipus");
  const client_id = text(fd, "client_id");
  const responsable_id = text(fd, "responsable_id");
  const data_inici = dataOpcional(fd, "data_inici");
  const data_fi_prevista = dataOpcional(fd, "data_fi_prevista");
  const idea_id = opcional(fd, "idea_id");

  if (!titol) return { error: "El projecte necessita un títol." };
  if (tipus !== "estudi" && tipus !== "consultoria") return { error: "Tria estudi o consultoria." };
  if (!client_id) return { error: "Tria un client." };
  if (!responsable_id) return { error: "Tria un responsable." };
  if (data_inici === "invalida" || data_fi_prevista === "invalida")
    return { error: "Les dates han de tenir format AAAA-MM-DD." };

  const silenci = Number(text(fd, "dies_silenci_max") || 45);
  if (!Number.isInteger(silenci) || silenci <= 0)
    return { error: "Els dies de silenci han de ser un enter positiu." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projectes")
    .insert({
      titol,
      tipus,
      client_id,
      responsable_id,
      subtipus: opcional(fd, "subtipus"),
      data_inici,
      data_fi_prevista,
      dies_silenci_max: silenci,
      notes: opcional(fd, "notes"),
    })
    .select("id")
    .single();
  if (error) return { error: missatgeError(error) };

  if (idea_id) {
    await supabase.from("idees").update({ projecte_id: data.id, client_id }).eq("id", idea_id);
  }
  redirect(`/projectes/${data.id}`);
}

export async function actualitzaProjecte(_p: Resultat, fd: FormData): Promise<Resultat> {
  const id = text(fd, "id");
  const estat = text(fd, "estat") as EstatProjecte;
  const data_inici = dataOpcional(fd, "data_inici");
  const data_fi_real = dataOpcional(fd, "data_fi_real");
  const silenci = Number(text(fd, "dies_silenci_max"));

  if (!text(fd, "titol")) return { error: "El projecte necessita un títol." };
  if (!ESTATS_PROJECTE.includes(estat)) return { error: "Estat no vàlid." };
  if (data_inici === "invalida" || data_fi_real === "invalida")
    return { error: "Les dates han de tenir format AAAA-MM-DD." };
  if (!Number.isInteger(silenci) || silenci <= 0)
    return { error: "Els dies de silenci han de ser un enter positiu." };

  // data_fi_prevista no es toca aquí: només per replanificar() (§8).
  const supabase = await createClient();
  const { error } = await supabase
    .from("projectes")
    .update({
      titol: text(fd, "titol"),
      subtipus: opcional(fd, "subtipus"),
      responsable_id: text(fd, "responsable_id"),
      estat,
      data_inici,
      data_fi_real,
      dies_silenci_max: silenci,
      notes: opcional(fd, "notes"),
    })
    .eq("id", id);
  if (error) return { error: missatgeError(error) };
  revalidatePath(`/projectes/${id}`);
  return { ok: true };
}

// ------------------------------------------------------------------
// Fases, entregables, tasques, contactes
// ------------------------------------------------------------------

export async function creaFase(_p: Resultat, fd: FormData): Promise<Resultat> {
  const projecte_id = text(fd, "projecte_id");
  const nom = text(fd, "nom");
  const data_prevista = dataOpcional(fd, "data_prevista");
  if (!nom) return { error: "La fase necessita un nom." };
  if (data_prevista === "invalida") return { error: "La data ha de tenir format AAAA-MM-DD." };

  const supabase = await createClient();
  const { data: darrera } = await supabase
    .from("fases")
    .select("ordre")
    .eq("projecte_id", projecte_id)
    .order("ordre", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("fases").insert({
    projecte_id,
    nom,
    ordre: (darrera?.ordre ?? 0) + 1,
    data_prevista,
  });
  if (error) return { error: missatgeError(error) };
  revalidatePath(`/projectes/${projecte_id}`);
  return { ok: true };
}

export async function mouFase(id: string, direccio: -1 | 1): Promise<Resultat> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mou_fase", { p_id: id, p_direccio: direccio });
  if (error) return { error: missatgeError(error) };
  return { ok: true };
}

export async function creaEntregable(_p: Resultat, fd: FormData): Promise<Resultat> {
  const projecte_id = text(fd, "projecte_id");
  const titol = text(fd, "titol");
  const data_prevista = dataOpcional(fd, "data_prevista");
  const enllac = opcional(fd, "enllac");
  const idea_id = opcional(fd, "idea_id");
  if (!projecte_id) return { error: "Tria un projecte." };
  if (!titol) return { error: "L'entregable necessita un títol." };
  if (data_prevista === "invalida") return { error: "La data ha de tenir format AAAA-MM-DD." };
  if (enllac && !/^https:\/\//.test(enllac))
    return { error: "L'enllaç ha de començar per https:// (SharePoint o Drive)." };

  const supabase = await createClient();
  const { error } = await supabase.from("entregables").insert({
    projecte_id,
    titol,
    tipus: opcional(fd, "tipus"),
    data_prevista,
    responsable_id: opcional(fd, "responsable_id"),
    enllac,
    notes: opcional(fd, "notes"),
  });
  if (error) return { error: missatgeError(error) };

  if (idea_id) {
    await supabase.from("idees").update({ projecte_id }).eq("id", idea_id);
    revalidatePath("/idees");
  }
  revalidatePath(`/projectes/${projecte_id}`);
  return { ok: true };
}

export async function creaTasca(_p: Resultat, fd: FormData): Promise<Resultat> {
  const projecte_id = text(fd, "projecte_id");
  const titol = text(fd, "titol");
  const data_prevista = dataOpcional(fd, "data_prevista");
  const ancora = text(fd, "ancora"); // "fase:<id>" | "entregable:<id>" | ""
  if (!titol) return { error: "La tasca necessita un títol." };
  if (data_prevista === "invalida") return { error: "La data ha de tenir format AAAA-MM-DD." };

  const [tipusAncora, idAncora] = ancora.split(":");
  const prioritat = text(fd, "prioritat") || "normal";

  const supabase = await createClient();
  const { error } = await supabase.from("tasques").insert({
    projecte_id,
    titol,
    descripcio: opcional(fd, "descripcio"),
    assignada_a: opcional(fd, "assignada_a"),
    data_prevista,
    prioritat,
    fase_id: tipusAncora === "fase" ? idAncora : null,
    entregable_id: tipusAncora === "entregable" ? idAncora : null,
  });
  if (error) return { error: missatgeError(error) };
  revalidatePath(`/projectes/${projecte_id}`);
  return { ok: true };
}

export async function creaContacte(_p: Resultat, fd: FormData): Promise<Resultat> {
  const projecte_id = text(fd, "projecte_id");
  const data = text(fd, "data") || avui();
  if (!esDataValida(data)) return { error: "La data ha de tenir format AAAA-MM-DD." };
  if (data > avui()) return { error: "Un contacte no pot tenir data futura." };

  const supabase = await createClient();
  const { error } = await supabase.from("contactes").insert({
    projecte_id,
    data,
    tipus: opcional(fd, "tipus"),
    resum: opcional(fd, "resum"),
  });
  if (error) return { error: missatgeError(error) };
  revalidatePath(`/projectes/${projecte_id}`);
  return { ok: true };
}

// ------------------------------------------------------------------
// Idees
// ------------------------------------------------------------------

export async function creaIdea(_p: Resultat, fd: FormData): Promise<Resultat> {
  const titol = text(fd, "titol");
  const data_objectiu = dataOpcional(fd, "data_objectiu");
  if (!titol) return { error: "La idea necessita un títol." };
  if (data_objectiu === "invalida") return { error: "La data ha de tenir format AAAA-MM-DD." };

  const supabase = await createClient();
  const { error } = await supabase.from("idees").insert({
    titol,
    descripcio: opcional(fd, "descripcio"),
    client_id: opcional(fd, "client_id"),
    data_objectiu,
  });
  if (error) return { error: missatgeError(error) };
  revalidatePath("/idees");
  return { ok: true };
}

export async function canviaEstatIdea(id: string, estat: EstatIdea): Promise<Resultat> {
  if (!ESTATS_IDEA.includes(estat)) return { error: "Estat no vàlid." };
  const supabase = await createClient();
  const { error } = await supabase.from("idees").update({ estat }).eq("id", id);
  if (error) return { error: missatgeError(error) };
  revalidatePath("/idees");
  return { ok: true };
}
