"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { avui, dataCurta, esDataValida, extreuData, sumaDies } from "@/lib/dates";
import { missatgeError } from "@/lib/errors";
import { feinaOberta } from "@/lib/dades";
import { avisDisponibilitat } from "@/lib/disponibilitat";
import type { EstatIdea, EstatProjecte, TaulaItem } from "@/lib/tipus";

// Totes les escriptures passen per aquí, amb la sessió de l'usuari i la clau
// pública: l'RLS és qui decideix. Cap acció esborra res (§7.2).

// `avis`: s'ha fet, però hi ha alguna cosa a saber (p. ex. la persona té
// vacances aquell dia). `missatge`: informació del que s'ha fet de més.
export type Resultat = { error?: string; ok?: boolean; avis?: string; missatge?: string };

const TAULES_ITEM: TaulaItem[] = ["fases", "entregables", "tasques"];
const ESTATS_PROJECTE: EstatProjecte[] = ["actiu", "pausat", "tancat", "cancellat"];
const ESTATS_IDEA: EstatIdea[] = ["proposada", "valorada", "assignada", "descartada"];
const TIPUS_CLIENT = ["municipi", "partit", "institucio", "altre"];
const TIPUS_PROJECTE = ["estudi", "consultoria", "altre"];

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
  | { accio: "fet"; taula: TaulaItem; id: string; data: string; revisor?: string }
  | { accio: "replanificar"; taula: TaulaItem | "projectes"; id: string; data: string; motiu: string; cascada?: boolean }
  | { accio: "revisat"; taula: TaulaItem; id: string }
  | { accio: "cancellar"; taula: TaulaItem; id: string }
  | { accio: "reobrir"; taula: TaulaItem; id: string };

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
    if (a.taula !== "fases" && a.revisor) {
      const { error: e2 } = await supabase.from("revisions").insert(element(a.taula, a.id, a.revisor));
      if (e2) return { error: `Marcat com a fet, però no s'ha pogut enviar a revisar: ${missatgeError(e2)}` };
    }
    return { ok: true };
  }

  // Reobrir el que es va marcar fet o cancel·lar per error. Si tenia data
  // real, torna a "en curs"; si no, a "pendent". La base de dades no ho deixa
  // fer si hi ha una revisió pendent.
  if (a.accio === "reobrir") {
    const { data: actual } = await supabase.from(a.taula).select("data_real").eq("id", a.id).maybeSingle();
    if (!actual) return { error: "No s'ha trobat l'element. Recarrega la pàgina." };
    const { error } = await supabase
      .from(a.taula)
      .update({ estat: actual.data_real ? "en_curs" : "pendent", data_real: null })
      .eq("id", a.id);
    if (error) return { error: missatgeError(error) };
    revalidatePath("/", "layout");
    return { ok: true };
  }

  if (a.accio === "replanificar") {
    if (!esDataValida(a.data)) return { error: "Indica la nova data en format AAAA-MM-DD." };
    // El motiu és opcional (migració 0015): si arriba buit, la base de dades
    // hi posa «sense motiu». El canvi queda a l'historial igualment (§4.2).
    // Una fase pot arrossegar les següents i les seves tasques (migració 0021).
    if (a.taula === "fases" && a.cascada) {
      const { data: r, error } = await supabase.rpc("replanifica_en_cascada", {
        p_fase: a.id,
        p_data: a.data,
        p_motiu: a.motiu.trim(),
      });
      if (error) return { error: missatgeError(error) };
      const { fases = 0, tasques = 0 } = (r ?? {}) as { fases?: number; tasques?: number };
      const parts = [
        fases ? `${fases} ${fases === 1 ? "fase següent" : "fases següents"}` : "",
        tasques ? `${tasques} ${tasques === 1 ? "tasca" : "tasques"}` : "",
      ].filter(Boolean);
      return {
        ok: true,
        missatge: parts.length ? `També s'han mogut ${parts.join(" i ")}.` : undefined,
        avis: await avisDisponibilitat(supabase, "fases", a.id, { data: a.data }),
      };
    }
    const { error } = await supabase.rpc("replanificar", {
      p_taula: a.taula,
      p_id: a.id,
      p_data: a.data,
      p_motiu: a.motiu.trim(),
    });
    if (error) return { error: missatgeError(error) };
    if (a.taula === "projectes") return { ok: true };
    return { ok: true, avis: await avisDisponibilitat(supabase, a.taula, a.id, { data: a.data }) };
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

// Accions de la safata sobre diverses línies alhora. Es fan una a una, amb
// les mateixes regles; si alguna falla, les altres es fan igual i es diu
// quantes han fallat.
export type ElementBloc = { taula: TaulaItem; id: string; prevista: string | null };

export async function accioEnBloc(
  elements: ElementBloc[],
  accio: "dia" | "setmana" | "revisat" | "fet",
  motiu = "",
): Promise<Resultat> {
  if (elements.length === 0) return { ok: true };
  if (elements.length > 200) return { error: "Massa elements alhora." };
  const hui = avui();
  const errors: string[] = [];
  for (const e of elements) {
    let r: Resultat;
    if (accio === "fet") r = await accioItem({ accio: "fet", taula: e.taula, id: e.id, data: hui });
    else if (accio === "revisat") r = await accioItem({ accio: "revisat", taula: e.taula, id: e.id });
    else {
      const base = e.prevista && e.prevista > hui ? e.prevista : hui;
      const data = sumaDies(base, accio === "setmana" ? 7 : 1);
      r = await accioItem({ accio: "replanificar", taula: e.taula, id: e.id, data, motiu });
    }
    if (r.error) errors.push(r.error);
  }
  revalidatePath("/", "layout");
  if (errors.length)
    return { error: `${errors.length} de ${elements.length} no s'han pogut fer: ${[...new Set(errors)].join(" · ")}` };
  return { ok: true };
}

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
  const numero_estudi = opcional(fd, "numero_estudi");

  if (!titol) return { error: "El projecte necessita un títol." };
  if (numero_estudi && !/^[0-9]{4}$/.test(numero_estudi))
    return { error: "El número d'estudi ha de tenir exactament 4 xifres." };
  if (!TIPUS_PROJECTE.includes(tipus)) return { error: "Tria estudi, consultoria o altre." };
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
      numero_estudi,
      subtipus: opcional(fd, "subtipus"),
      data_inici,
      data_fi_prevista,
      dies_silenci_max: silenci,
      notes: opcional(fd, "notes"),
    })
    .select("id")
    .single();
  if (error) return { error: missatgeError(error) };

  // El projecte ja existeix: si falla el desat de co-responsables, no tornem al
  // formulari (es duplicaria en reenviar-lo); anem a editar-lo per reintentar.
  const errCo = await desaCoresponsables(supabase, data.id, responsable_id, fd.getAll("coresponsables"));
  if (errCo) {
    console.error("coresponsables:", errCo);
    redirect(`/projectes/${data.id}?pestanya=editar`);
  }

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
  const numero_estudi = opcional(fd, "numero_estudi");

  if (!text(fd, "titol")) return { error: "El projecte necessita un títol." };
  if (!ESTATS_PROJECTE.includes(estat)) return { error: "Estat no vàlid." };
  if (numero_estudi && !/^[0-9]{4}$/.test(numero_estudi))
    return { error: "El número d'estudi ha de tenir exactament 4 xifres." };
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
      numero_estudi,
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

  const errCo = await desaCoresponsables(supabase, id, text(fd, "responsable_id"), fd.getAll("coresponsables"));
  if (errCo) return { error: errCo };

  revalidatePath(`/projectes/${id}`);
  return { ok: true };
}

// Deixa actius exactament els co-responsables marcats (sense el principal).
// Els que es desmarquen es desactiven, no s'esborren (§7.2).
async function desaCoresponsables(
  supabase: SupabaseClient,
  projecteId: string,
  principal: string,
  valors: FormDataEntryValue[],
): Promise<string | null> {
  const marcats = [...new Set(valors.map(String))].filter((v) => v && v !== principal);

  const { error: e1 } = await supabase
    .from("projecte_responsables")
    .update({ actiu: false })
    .eq("projecte_id", projecteId)
    .not("perfil_id", "in", `(${marcats.length ? marcats.join(",") : "00000000-0000-0000-0000-000000000000"})`);
  if (e1) return missatgeError(e1);

  if (marcats.length) {
    const { error: e2 } = await supabase
      .from("projecte_responsables")
      .upsert(marcats.map((perfil_id) => ({ projecte_id: projecteId, perfil_id, actiu: true })));
    if (e2) return missatgeError(e2);
  }
  return null;
}

// Nova onada d'un estudi: mateixes fases, gent i tasques, dates desplaçades.
export async function novaOnada(_p: Resultat, fd: FormData): Promise<Resultat> {
  const origen = text(fd, "origen");
  const titol = text(fd, "titol");
  const data_inici = text(fd, "data_inici");
  const numero = opcional(fd, "numero_estudi");
  if (!titol) return { error: "Posa un títol a la nova onada." };
  if (!esDataValida(data_inici)) return { error: "Indica quan comença la nova onada (AAAA-MM-DD)." };
  if (numero && !/^[0-9]{4}$/.test(numero))
    return { error: "El número d'estudi ha de tenir exactament 4 xifres." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("nova_onada", {
    p_origen: origen,
    p_titol: titol,
    p_inici: data_inici,
    p_numero: numero,
  });
  if (error) return { error: missatgeError(error) };
  revalidatePath("/", "layout");
  redirect(`/projectes/${data}`);
}

// Arxivar i paperera: res no s'esborra (§7.2). Es marca amb una data i es
// desfà tornant-la a null.
export async function arxivaProjecte(id: string, arxivar: boolean): Promise<Resultat> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("projectes")
    .update({ arxivat_el: arxivar ? new Date().toISOString() : null }, { count: "exact" })
    .eq("id", id);
  if (error) return { error: missatgeError(error) };
  if (!count) return { error: "No s'ha trobat el projecte. Recarrega la pàgina." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function eliminaProjecte(id: string, eliminar: boolean): Promise<Resultat> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const { error, count } = await supabase
    .from("projectes")
    .update(
      eliminar
        ? { eliminat_el: new Date().toISOString(), eliminat_per: claims?.claims?.sub ?? null }
        : { eliminat_el: null, eliminat_per: null },
      { count: "exact" },
    )
    .eq("id", id);
  if (error) return { error: missatgeError(error) };
  if (!count) return { error: "No s'ha trobat el projecte. Recarrega la pàgina." };
  revalidatePath("/", "layout");
  return { ok: true };
}

// ------------------------------------------------------------------
// Fases, entregables, tasques, contactes
// ------------------------------------------------------------------

export async function creaFase(_p: Resultat, fd: FormData): Promise<Resultat> {
  const projecte_id = text(fd, "projecte_id");
  const nom = text(fd, "nom");
  const data_inici = dataOpcional(fd, "data_inici");
  const data_prevista = dataOpcional(fd, "data_prevista");
  if (!nom) return { error: "La fase necessita un nom." };
  if (data_prevista === "invalida" || data_inici === "invalida")
    return { error: "La data ha de tenir format AAAA-MM-DD." };
  if (data_inici && data_prevista && data_inici > data_prevista)
    return { error: "L'inici de la fase ha de ser anterior o igual al final previst." };

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
    data_inici,
    data_prevista,
  });
  if (error) return { error: missatgeError(error) };
  revalidatePath(`/projectes/${projecte_id}`);
  return { ok: true };
}

// Nom, inici previst i responsable d'una fase. El final previst NO: va per
// replanificar(), perquè quedi a l'historial.
export async function actualitzaFase(_p: Resultat, fd: FormData): Promise<Resultat> {
  const id = text(fd, "id");
  const projecte_id = text(fd, "projecte_id");
  const nom = text(fd, "nom");
  const data_inici = dataOpcional(fd, "data_inici");
  if (!nom) return { error: "La fase necessita un nom." };
  if (data_inici === "invalida") return { error: "La data ha de tenir format AAAA-MM-DD." };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("fases")
    .update({ nom, data_inici, responsable_id: opcional(fd, "responsable_id") }, { count: "exact" })
    .eq("id", id);
  if (error) return { error: missatgeError(error) };
  if (!count) return { error: "No s'ha trobat la fase. Recarrega la pàgina." };
  revalidatePath(`/projectes/${projecte_id}`);
  return { ok: true };
}

// Estudis creats abans de la migració 0010: passa'ls a les fases noves.
export async function aplicaFasesPerDefecte(projecteId: string): Promise<Resultat> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("aplica_fases_per_defecte", { p_projecte: projecteId });
  if (error) return { error: missatgeError(error) };
  revalidatePath(`/projectes/${projecteId}`);
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

// Edició d'una tasca. La persona va per transfereix() (avisa) i la data
// prevista per replanificar() (historial): aquí no es toquen.
export async function actualitzaTasca(_p: Resultat, fd: FormData): Promise<Resultat> {
  const id = text(fd, "id");
  const projecte_id = text(fd, "projecte_id");
  const titol = text(fd, "titol");
  const prioritat = text(fd, "prioritat");
  const [tipusAncora, idAncora] = text(fd, "ancora").split(":");
  if (!titol) return { error: "La tasca necessita un títol." };
  if (!["alta", "normal", "baixa"].includes(prioritat)) return { error: "Prioritat no vàlida." };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("tasques")
    .update(
      {
        titol,
        descripcio: opcional(fd, "descripcio"),
        prioritat,
        fase_id: tipusAncora === "fase" ? idAncora : null,
        entregable_id: tipusAncora === "entregable" ? idAncora : null,
      },
      { count: "exact" },
    )
    .eq("id", id);
  if (error) return { error: missatgeError(error) };
  if (!count) return { error: "No s'ha trobat la tasca. Recarrega la pàgina." };
  revalidatePath(`/projectes/${projecte_id}`);
  return { ok: true };
}

export async function actualitzaEntregable(_p: Resultat, fd: FormData): Promise<Resultat> {
  const id = text(fd, "id");
  const projecte_id = text(fd, "projecte_id");
  const titol = text(fd, "titol");
  const enllac = opcional(fd, "enllac");
  if (!titol) return { error: "L'entregable necessita un títol." };
  if (enllac && !/^https:\/\//.test(enllac))
    return { error: "L'enllaç ha de començar per https:// (SharePoint o Drive)." };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("entregables")
    .update({ titol, tipus: opcional(fd, "tipus"), enllac, notes: opcional(fd, "notes") }, { count: "exact" })
    .eq("id", id);
  if (error) return { error: missatgeError(error) };
  if (!count) return { error: "No s'ha trobat l'entregable. Recarrega la pàgina." };
  revalidatePath(`/projectes/${projecte_id}`);
  return { ok: true };
}

// Plantilles de tasques per subtipus (s'apliquen en crear el projecte).
export async function creaPlantilla(_p: Resultat, fd: FormData): Promise<Resultat> {
  const subtipus = text(fd, "subtipus").toLowerCase();
  const titol = text(fd, "titol");
  const diesText = text(fd, "dies");
  const dies = diesText === "" ? null : Number(diesText);
  if (!subtipus) return { error: "Indica el subtipus (p. ex. barometre)." };
  if (!titol) return { error: "La tasca necessita un títol." };
  if (dies !== null && (!Number.isInteger(dies) || dies < -365 || dies > 730))
    return { error: "Els dies han de ser un enter entre -365 i 730." };

  const supabase = await createClient();
  const { count } = await supabase
    .from("plantilles_tasques")
    .select("id", { count: "exact", head: true })
    .eq("subtipus", subtipus);
  const { error } = await supabase.from("plantilles_tasques").insert({
    subtipus,
    titol,
    fase: opcional(fd, "fase"),
    dies,
    ordre: (count ?? 0) + 1,
  });
  if (error) return { error: missatgeError(error) };
  revalidatePath("/plantilles");
  return { ok: true };
}

export async function activaPlantilla(id: string, actiu: boolean): Promise<Resultat> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("plantilles_tasques")
    .update({ actiu }, { count: "exact" })
    .eq("id", id);
  if (error) return { error: missatgeError(error) };
  if (!count) return { error: "No s'ha trobat la línia. Recarrega la pàgina." };
  revalidatePath("/plantilles");
  return { ok: true };
}

// Preferències de cadascú (tema i menú), desades al perfil per tenir-les a
// qualsevol ordinador. La galeta continua fent de memòria ràpida.
export async function desaPreferencia(clau: "tema" | "menu", valor: string): Promise<void> {
  const valids = { tema: ["clar", "fosc"], menu: ["plegat", "desplegat"] };
  if (!valids[clau]?.includes(valor)) return;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const jo = claims?.claims?.sub;
  if (!jo) return;
  await supabase.from("perfils").update({ [clau]: valor }).eq("id", jo);
}

// Gestió interna: tasca meva al meu projecte intern (es crea el primer cop).
export async function creaTascaInterna(_p: Resultat, fd: FormData): Promise<Resultat> {
  const dataCamp = dataOpcional(fd, "data_prevista");
  if (dataCamp === "invalida") return { error: "La data ha de tenir format AAAA-MM-DD." };
  // "Trucar a l'alcaldia dijous": si no s'ha triat data al calendari, es mira
  // si el text n'acaba amb una (extreuData).
  const escrit = dataCamp ? { titol: text(fd, "titol"), data: null } : extreuData(text(fd, "titol"), avui());
  const titol = escrit.titol;
  const data_prevista = dataCamp ?? escrit.data;
  if (!titol) return { error: "Escriu què has de fer." };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const jo = claims?.claims?.sub;
  if (!jo) return { error: "La sessió ha caducat. Torna a entrar." };
  const { data: projecte_id, error: e1 } = await supabase.rpc("projecte_intern");
  if (e1) return { error: missatgeError(e1) };
  const { error } = await supabase.from("tasques").insert({ projecte_id, titol, data_prevista, assignada_a: jo });
  if (error) return { error: missatgeError(error) };
  revalidatePath("/");
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

// ------------------------------------------------------------------
// Persones externes: s'hi pot assignar feina però no tenen accés
// ------------------------------------------------------------------

export async function creaPersonaExterna(_p: Resultat, fd: FormData): Promise<Resultat> {
  const nom = text(fd, "nom");
  if (!nom) return { error: "La persona necessita un nom." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("crea_persona_externa", {
    p_nom: nom,
    p_area: text(fd, "area"),
  });
  if (error) return { error: missatgeError(error) };
  revalidatePath("/equip");
  return { ok: true };
}

export async function actualitzaPersonaExterna(_p: Resultat, fd: FormData): Promise<Resultat> {
  const nom = text(fd, "nom");
  if (!nom) return { error: "La persona necessita un nom." };
  const supabase = await createClient();
  // Desactivar algú amb feina oberta la deixa sense ningú que la vegi.
  if (fd.get("actiu") !== "on" && fd.get("igualment") !== "on") {
    const { data: abans } = await supabase.from("perfils").select("actiu").eq("id", text(fd, "id")).maybeSingle();
    const n = abans?.actiu ? (await feinaOberta()).get(text(fd, "id")) ?? 0 : 0;
    if (n > 0)
      return {
        error: `${nom} té ${n} ${n === 1 ? "cosa oberta" : "coses obertes"}. Passa-les abans a algú altre o marca «desactivar-la igualment».`,
      };
  }
  const { error } = await supabase.rpc("actualitza_persona_externa", {
    p_id: text(fd, "id"),
    p_nom: nom,
    p_area: text(fd, "area"),
    p_actiu: fd.get("actiu") === "on",
    p_color: opcional(fd, "color"),
  });
  if (error) return { error: missatgeError(error) };
  revalidatePath("/equip");
  return { ok: true };
}

// Cada membre tria el seu color (la RLS només deixa canviar el propi perfil).
export async function canviaElMeuColor(_p: Resultat, fd: FormData): Promise<Resultat> {
  const color = text(fd, "color").toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(color)) return { error: "Tria un color de la llista." };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const jo = claims?.claims?.sub;
  if (!jo) return { error: "La sessió ha caducat. Torna a entrar." };
  const { error, count } = await supabase
    .from("perfils")
    .update({ color }, { count: "exact" })
    .eq("id", jo);
  if (error) return { error: missatgeError(error) };
  if (!count) return { error: "No s'ha pogut desar el color." };
  revalidatePath("/", "layout");
  return { ok: true };
}

// ------------------------------------------------------------------
// Avisos
// ------------------------------------------------------------------

export async function marcaAvisosLlegits(): Promise<void> {
  const supabase = await createClient();
  await supabase.from("notificacions").update({ llegida_el: new Date().toISOString() }).is("llegida_el", null);
  revalidatePath("/", "layout");
}

// ------------------------------------------------------------------
// Cerca global (projectes, clients, tasques i idees)
// ------------------------------------------------------------------

export type ResultatCerca = {
  tipus: "projecte" | "client" | "tasca" | "idea" | "publicacio" | "dia";
  titol: string;
  detall: string;
  href: string;
};

export async function cercaGlobal(consulta: string): Promise<ResultatCerca[]> {
  // Es treuen els caràcters amb significat dins dels filtres de PostgREST.
  const q = consulta.replace(/[,()%*\\]/g, " ").trim();
  if (q.length < 2) return [];
  const supabase = await createClient();
  const patro = `%${q}%`;

  const [projectes, clients, tasques, idees, publicacions, dies] = await Promise.all([
    supabase
      .from("projectes")
      .select("id, titol, numero_estudi, tipus, clients(nom)")
      .or(`titol.ilike.${patro},numero_estudi.ilike.${patro}`)
      .is("eliminat_el", null)
      .limit(6),
    supabase.from("clients").select("id, nom, territori").ilike("nom", patro).eq("actiu", true).limit(4),
    supabase
      .from("tasques")
      .select("id, titol, projecte_id, projectes!inner(titol, eliminat_el)")
      .ilike("titol", patro)
      .neq("estat", "cancellat")
      .is("projectes.eliminat_el", null)
      .limit(5),
    supabase.from("idees").select("id, titol, estat").ilike("titol", patro).neq("estat", "descartada").limit(3),
    // Sense les xarxes activades l'RLS no en retorna cap (migració 0019).
    supabase
      .from("publicacions")
      .select("id, titol, estat, data_prevista")
      .or(`titol.ilike.${patro},text.ilike.${patro}`)
      .neq("estat", "cancellada")
      .order("data_prevista", { ascending: false, nullsFirst: false })
      .limit(4),
    // Dies marcats amb una nota (festius, vacances…; migració 0020).
    supabase
      .from("calendari_dies")
      .select("data, tipus, nota, perfil_id, perfils!calendari_dies_perfil_id_fkey(nom)")
      .ilike("nota", patro)
      .eq("actiu", true)
      .order("data", { ascending: false })
      .limit(3),
  ]);

  type P = { id: string; titol: string; numero_estudi: string | null; tipus: string; clients: { nom: string } | null };
  type T = { id: string; titol: string; projecte_id: string; projectes: { titol: string } | null };
  type D = { data: string; tipus: string; nota: string | null; perfil_id: string | null; perfils: { nom: string } | null };
  return [
    ...((projectes.data ?? []) as unknown as P[]).map((p) => ({
      tipus: "projecte" as const,
      titol: (p.numero_estudi ? `${p.numero_estudi} · ` : "") + p.titol,
      detall: [p.tipus, p.clients?.nom].filter(Boolean).join(" · "),
      href: `/projectes/${p.id}`,
    })),
    ...(clients.data ?? []).map((c) => ({
      tipus: "client" as const,
      titol: c.nom,
      detall: c.territori ?? "client",
      href: `/clients/${c.id}`,
    })),
    ...((tasques.data ?? []) as unknown as T[]).map((t) => ({
      tipus: "tasca" as const,
      titol: t.titol,
      detall: t.projectes?.titol ?? "",
      href: `/projectes/${t.projecte_id}`,
    })),
    ...(idees.data ?? []).map((i) => ({
      tipus: "idea" as const,
      titol: i.titol,
      detall: i.estat,
      href: "/idees",
    })),
    ...((publicacions.error ? [] : publicacions.data) ?? []).map((p) => ({
      tipus: "publicacio" as const,
      titol: p.titol,
      detall: ["xarxes", p.estat, p.data_prevista ? dataCurta(p.data_prevista) : null].filter(Boolean).join(" · "),
      href: `/xarxes/${p.id}`,
    })),
    ...((dies.error ? [] : dies.data) as unknown as D[] | null ?? []).map((d) => ({
      tipus: "dia" as const,
      titol: d.nota ?? d.tipus,
      detall: [dataCurta(d.data), d.tipus, d.perfil_id ? d.perfils?.nom : "tot l'equip"].filter(Boolean).join(" · "),
      href: `/calendari?mes=${d.data.slice(0, 7)}`,
    })),
  ];
}

// ------------------------------------------------------------------
// Revisions de tasques i entregables fets
// ------------------------------------------------------------------

function element(taula: "tasques" | "entregables", id: string, revisor: string) {
  return {
    tasca_id: taula === "tasques" ? id : null,
    entregable_id: taula === "entregables" ? id : null,
    revisor_id: revisor,
  };
}

export async function enviaARevisar(
  taula: "tasques" | "entregables",
  id: string,
  revisorId: string,
): Promise<Resultat> {
  if (taula !== "tasques" && taula !== "entregables") return { error: "Tipus d'element no vàlid." };
  if (!revisorId) return { error: "Tria qui l'ha de revisar." };
  const supabase = await createClient();
  const { error } = await supabase.from("revisions").insert(element(taula, id, revisorId));
  if (error) {
    if (error.code === "23505") return { error: "Ja té una revisió pendent." };
    return { error: missatgeError(error) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function resolRevisio(
  id: string,
  estat: "aprovada" | "retornada" | "cancellada",
  comentari = "",
): Promise<Resultat> {
  if (estat === "retornada" && !comentari.trim())
    return { error: "Explica què cal canviar abans de retornar-la." };
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("revisions")
    .update({ estat, comentari: comentari.trim() || null }, { count: "exact" })
    .eq("id", id);
  if (error) return { error: missatgeError(error) };
  if (!count) return { error: "Aquesta revisió ja s'ha resolt. Recarrega la pàgina." };
  revalidatePath("/", "layout");
  return { ok: true };
}

// ------------------------------------------------------------------
// Passar una tasca o un entregable a una altra persona
// ------------------------------------------------------------------

export async function transfereix(
  taula: "tasques" | "entregables",
  id: string,
  persona: string,
  nota: string,
): Promise<Resultat> {
  if (taula !== "tasques" && taula !== "entregables") return { error: "Tipus d'element no vàlid." };
  if (!persona) return { error: "Tria a qui la passes." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("transfereix", {
    p_taula: taula,
    p_id: id,
    p_persona: persona,
    p_nota: nota.trim() || null,
  });
  if (error) return { error: missatgeError(error) };
  revalidatePath("/", "layout");
  return { ok: true, avis: await avisDisponibilitat(supabase, taula, id, { persona }) };
}

// Motiu d'un clic just després d'arrossegar (migració 0021): omple el
// «sense motiu» del darrer canvi propi, com a molt 5 minuts després.
export async function posaMotiu(taula: TaulaItem | "publicacions", id: string, motiu: string): Promise<Resultat> {
  if (!["fases", "entregables", "tasques", "publicacions"].includes(taula)) return { error: "Tipus d'element no vàlid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("posa_motiu", { p_taula: taula, p_id: id, p_motiu: motiu });
  if (error) return { error: missatgeError(error) };
  return { ok: true };
}
