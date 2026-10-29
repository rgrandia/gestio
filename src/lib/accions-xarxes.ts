"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { avui, esDataValida, extreuData } from "@/lib/dates";
import { missatgeError } from "@/lib/errors";
import { avisDisponibilitat } from "@/lib/disponibilitat";
import type { Resultat } from "@/lib/accions";
import { LLISTA_PLATAFORMES, type Plataforma } from "@/lib/xarxes";

// Xarxes socials (migració 0019). Com a la resta: sessió de l'usuari, clau
// pública i RLS. L'app no publica res enlloc: només desa què, on i quan.

function text(fd: FormData, clau: string): string {
  return String(fd.get(clau) ?? "").trim();
}
function opcional(fd: FormData, clau: string): string | null {
  return text(fd, clau) || null;
}
function enllacValid(v: string | null): boolean {
  return !v || /^https?:\/\/\S+$/i.test(v);
}

const refresca = (id?: string) => {
  revalidatePath("/xarxes", "layout");
  if (id) revalidatePath(`/xarxes/${id}`);
  revalidatePath("/");
};

// ------------------------------------------------------------------
// Qui ho té activat
// ------------------------------------------------------------------

export async function activaFuncio(persona: string, actiu: boolean): Promise<Resultat> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("activa_funcio", { p_persona: persona, p_funcio: "xarxes", p_actiu: actiu });
  if (error) return { error: missatgeError(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

// ------------------------------------------------------------------
// Comptes
// ------------------------------------------------------------------

function llegeixCompte(fd: FormData) {
  const plataforma = text(fd, "plataforma") as Plataforma;
  const cad = text(fd, "cadencia_setmanal");
  return {
    plataforma,
    nom: text(fd, "nom"),
    url: opcional(fd, "url"),
    cadencia_setmanal: cad ? Number(cad) : null,
    signatura: opcional(fd, "signatura"),
  };
}

export async function creaCompte(_p: Resultat, fd: FormData): Promise<Resultat> {
  const c = llegeixCompte(fd);
  if (!LLISTA_PLATAFORMES.includes(c.plataforma)) return { error: "Tria una xarxa." };
  if (!c.nom) return { error: "Posa el nom del compte (p. ex. @gesop)." };
  if (!enllacValid(c.url)) return { error: "L'enllaç ha de començar per https://" };
  if (c.cadencia_setmanal !== null && !(c.cadencia_setmanal >= 1 && c.cadencia_setmanal <= 50))
    return { error: "L'objectiu setmanal ha de ser entre 1 i 50 (o buit)." };
  const supabase = await createClient();
  const { error } = await supabase.from("xarxes_comptes").insert(c);
  if (error) return { error: missatgeError(error) };
  refresca();
  return { ok: true };
}

export async function actualitzaCompte(_p: Resultat, fd: FormData): Promise<Resultat> {
  const id = text(fd, "id");
  const { nom, url, cadencia_setmanal, signatura } = llegeixCompte(fd);
  const c = { nom, url, cadencia_setmanal, signatura }; // la xarxa no es canvia
  if (!c.nom) return { error: "El compte necessita un nom." };
  if (!enllacValid(c.url)) return { error: "L'enllaç ha de començar per https://" };
  if (c.cadencia_setmanal !== null && !(c.cadencia_setmanal >= 1 && c.cadencia_setmanal <= 50))
    return { error: "L'objectiu setmanal ha de ser entre 1 i 50 (o buit)." };
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("xarxes_comptes")
    .update({ ...c, actiu: fd.get("actiu") === "on" }, { count: "exact" })
    .eq("id", id);
  if (error) return { error: missatgeError(error) };
  if (!count) return { error: "No s'ha trobat el compte." };
  refresca();
  return { ok: true };
}

// ------------------------------------------------------------------
// Publicacions
// ------------------------------------------------------------------

export async function creaPublicacio(_p: Resultat, fd: FormData): Promise<Resultat> {
  const rapida = fd.get("rapida") === "1";
  let titol = text(fd, "titol");
  let data = opcional(fd, "data_prevista");
  // A l'alta ràpida el text pot acabar amb una data («dijous», «12/11»…).
  if (rapida && !data) {
    const e = extreuData(titol, avui());
    titol = e.titol;
    data = e.data;
  }
  if (!titol) return { error: "Posa-li un nom (només el veu l'equip)." };
  if (data && !esDataValida(data)) return { error: "La data no és vàlida." };
  const hora = opcional(fd, "hora");
  if (hora && !/^\d{2}:\d{2}$/.test(hora)) return { error: "L'hora ha de ser HH:MM." };
  const comptes = fd.getAll("compte").map(String).filter(Boolean);

  const supabase = await createClient();
  const { data: nova, error } = await supabase
    .from("publicacions")
    .insert({
      titol,
      text: opcional(fd, "text"),
      projecte_id: opcional(fd, "projecte_id"),
      data_prevista: data,
      hora,
      estat: rapida ? "idea" : "esborrany",
    })
    .select("id")
    .single();
  if (error) return { error: missatgeError(error) };
  if (comptes.length > 0) {
    const { error: e2 } = await supabase
      .from("publicacio_canals")
      .insert(comptes.map((compte_id) => ({ publicacio_id: nova.id, compte_id })));
    if (e2) return { error: missatgeError(e2) };
  }
  refresca();
  if (rapida) return { ok: true };
  redirect(`/xarxes/${nova.id}`);
}

// Desa el contingut (no la data ni l'estat: tenen acció pròpia).
export async function desaPublicacio(_p: Resultat, fd: FormData): Promise<Resultat> {
  const id = text(fd, "id");
  const titol = text(fd, "titol");
  if (!titol) return { error: "Posa-li un nom." };
  const hora = opcional(fd, "hora");
  if (hora && !/^\d{2}:\d{2}(:\d{2})?$/.test(hora)) return { error: "L'hora ha de ser HH:MM." };
  const recursos = opcional(fd, "enllac_recursos");
  if (!enllacValid(recursos)) return { error: "L'enllaç als recursos ha de començar per https://" };
  const triats = new Set(fd.getAll("compte").map(String).filter(Boolean));

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("publicacions")
    .update(
      {
        titol,
        text: opcional(fd, "text"),
        projecte_id: opcional(fd, "projecte_id"),
        hora,
        enllac_recursos: recursos,
        notes: opcional(fd, "notes"),
      },
      { count: "exact" },
    )
    .eq("id", id);
  if (error) return { error: missatgeError(error) };
  if (!count) return { error: "No s'ha trobat la publicació." };

  const { data: actuals, error: e1 } = await supabase
    .from("publicacio_canals")
    .select("compte_id, text_adaptat, actiu")
    .eq("publicacio_id", id);
  if (e1) return { error: missatgeError(e1) };
  const perCompte = new Map((actuals ?? []).map((c) => [c.compte_id as string, c]));

  for (const compte_id of triats) {
    const adaptat = opcional(fd, `adaptat_${compte_id}`);
    const ara = perCompte.get(compte_id);
    if (!ara) {
      const { error: e } = await supabase.from("publicacio_canals").insert({ publicacio_id: id, compte_id, text_adaptat: adaptat });
      if (e) return { error: missatgeError(e) };
    } else if (!ara.actiu || (ara.text_adaptat ?? null) !== adaptat) {
      const { error: e } = await supabase
        .from("publicacio_canals")
        .update({ actiu: true, text_adaptat: adaptat })
        .eq("publicacio_id", id)
        .eq("compte_id", compte_id);
      if (e) return { error: missatgeError(e) };
    }
  }
  // Els que s'han tret es desactiven (res no s'esborra, §7.2).
  for (const [compte_id, c] of perCompte) {
    if (c.actiu && !triats.has(compte_id)) {
      const { error: e } = await supabase
        .from("publicacio_canals")
        .update({ actiu: false })
        .eq("publicacio_id", id)
        .eq("compte_id", compte_id);
      if (e) return { error: missatgeError(e) };
    }
  }
  refresca(id);
  return { ok: true };
}

export type CanviEstat =
  | { estat: "idea" | "esborrany" | "programada" | "cancellada" | "aprovada" }
  | { estat: "revisio"; revisor: string }
  | { estat: "retornar"; nota: string }
  | { estat: "publicada"; data: string; enllacos: Record<string, string> };

export async function canviaEstatPublicacio(id: string, c: CanviEstat): Promise<Resultat> {
  const supabase = await createClient();
  let canvi: Record<string, unknown>;
  if (c.estat === "revisio") {
    if (!c.revisor) return { error: "Tria qui l'ha de revisar." };
    canvi = { estat: "revisio", revisor_id: c.revisor };
  } else if (c.estat === "retornar") {
    if (!c.nota.trim()) return { error: "Escriu què cal canviar." };
    canvi = { estat: "esborrany", nota_revisio: c.nota.trim() };
  } else if (c.estat === "publicada") {
    if (!esDataValida(c.data)) return { error: "Indica la data en què s'ha publicat." };
    if (c.data > avui()) return { error: "La data real no pot ser posterior a avui." };
    for (const u of Object.values(c.enllacos)) if (u && !enllacValid(u)) return { error: "Els enllaços han de començar per https://" };
    canvi = { estat: "publicada", data_real: c.data };
  } else {
    canvi = { estat: c.estat };
  }

  const { error, count } = await supabase.from("publicacions").update(canvi, { count: "exact" }).eq("id", id);
  if (error) return { error: missatgeError(error) };
  if (!count) return { error: "No s'ha trobat la publicació o no hi tens accés." };

  if (c.estat === "publicada") {
    for (const [compte_id, url] of Object.entries(c.enllacos)) {
      if (!url) continue;
      const { error: e } = await supabase
        .from("publicacio_canals")
        .update({ enllac_publicat: url })
        .eq("publicacio_id", id)
        .eq("compte_id", compte_id);
      if (e) return { error: missatgeError(e) };
    }
  }
  refresca(id);
  return { ok: true };
}

// Publicada xarxa per xarxa (migració 0023): cada canal té la seva data. Quan
// tots els canals actius en tenen, el trigger marca la publicació sencera com
// a publicada (amb la data més tardana); desmarcar-ne un la torna a programada.
export async function marcaCanalsPublicats(
  id: string,
  data: string,
  canals: { compte_id: string; enllac: string }[],
): Promise<Resultat> {
  if (!esDataValida(data)) return { error: "Indica la data en què s'ha publicat." };
  if (data > avui()) return { error: "La data de publicació no pot ser posterior a avui." };
  if (canals.length === 0) return { error: "Tria almenys una xarxa." };
  for (const c of canals) if (c.enllac && !enllacValid(c.enllac)) return { error: "Els enllaços han de començar per https://" };
  const supabase = await createClient();
  for (const c of canals) {
    const { error, count } = await supabase
      .from("publicacio_canals")
      .update({ publicat_el: data, ...(c.enllac ? { enllac_publicat: c.enllac } : {}) }, { count: "exact" })
      .eq("publicacio_id", id)
      .eq("compte_id", c.compte_id)
      .eq("actiu", true);
    if (error) return { error: missatgeError(error) };
    if (!count) return { error: "No s'ha trobat la xarxa d'aquesta publicació." };
  }
  refresca(id);
  return { ok: true };
}

export async function desmarcaCanal(id: string, compte_id: string): Promise<Resultat> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("publicacio_canals")
    .update({ publicat_el: null }, { count: "exact" })
    .eq("publicacio_id", id)
    .eq("compte_id", compte_id);
  if (error) return { error: missatgeError(error) };
  if (!count) return { error: "No s'ha trobat la xarxa d'aquesta publicació." };
  refresca(id);
  return { ok: true };
}

// Data prevista: sempre per replanificar(), perquè quedi a l'historial (§4.2).
export async function replanificaPublicacio(id: string, data: string | null, motiu: string): Promise<Resultat> {
  if (data && !esDataValida(data)) return { error: "La data no és vàlida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("replanificar", {
    p_taula: "publicacions",
    p_id: id,
    p_data: data,
    p_motiu: motiu,
  });
  if (error) return { error: missatgeError(error) };
  refresca(id);
  return { ok: true, avis: await avisDisponibilitat(supabase, "publicacions", id, { data }) };
}

export async function passaPublicacio(id: string, persona: string): Promise<Resultat> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("publicacions")
    .update({ responsable_id: persona }, { count: "exact" })
    .eq("id", id);
  if (error) return { error: missatgeError(error) };
  if (!count) return { error: "No s'ha trobat la publicació." };
  refresca(id);
  return { ok: true };
}

// Reaprofitar: una còpia en esborrany, amb els mateixos comptes i textos,
// sense data ni res de la publicació original.
export async function duplicaPublicacio(id: string): Promise<Resultat> {
  const supabase = await createClient();
  const { data: o, error } = await supabase
    .from("publicacions")
    .select("titol, text, projecte_id, enllac_recursos, publicacio_canals(compte_id, text_adaptat, actiu)")
    .eq("id", id)
    .single();
  if (error) return { error: missatgeError(error) };
  const { data: nova, error: e1 } = await supabase
    .from("publicacions")
    .insert({ titol: `${o.titol} (reaprofitada)`, text: o.text, projecte_id: o.projecte_id, enllac_recursos: o.enllac_recursos })
    .select("id")
    .single();
  if (e1) return { error: missatgeError(e1) };
  const canals = (o.publicacio_canals ?? []).filter((c) => c.actiu);
  if (canals.length > 0) {
    const { error: e2 } = await supabase
      .from("publicacio_canals")
      .insert(canals.map((c) => ({ publicacio_id: nova.id, compte_id: c.compte_id, text_adaptat: c.text_adaptat })));
    if (e2) return { error: missatgeError(e2) };
  }
  refresca();
  redirect(`/xarxes/${nova.id}`);
}

// ------------------------------------------------------------------
// Dates clau
// ------------------------------------------------------------------

export async function creaEfemeride(_p: Resultat, fd: FormData): Promise<Resultat> {
  const data = text(fd, "data");
  const titol = text(fd, "titol");
  if (!esDataValida(data)) return { error: "Indica la data." };
  if (!titol) return { error: "Posa-li un nom." };
  const supabase = await createClient();
  const { error } = await supabase.from("efemerides").insert({ data, titol, recurrent: fd.get("recurrent") === "on" });
  if (error) return { error: missatgeError(error) };
  refresca();
  return { ok: true };
}

export async function activaEfemeride(id: string, actiu: boolean): Promise<Resultat> {
  const supabase = await createClient();
  const { error } = await supabase.from("efemerides").update({ actiu }).eq("id", id);
  if (error) return { error: missatgeError(error) };
  refresca();
  return { ok: true };
}
