import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Client, Perfil } from "@/lib/tipus";

export const obtePerfils = cache(async (): Promise<Perfil[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("perfils")
    .select("id, nom, email, actiu, extern, area, color")
    .order("extern")
    .order("nom");
  return data ?? [];
});

export async function nomsPerfils(): Promise<Map<string, string>> {
  return new Map((await obtePerfils()).map((p) => [p.id, p.nom]));
}

export const mapaPersones = (perfils: Perfil[]) => new Map(perfils.map((p) => [p.id, p]));
export async function obtePersones(): Promise<Map<string, Perfil>> {
  return mapaPersones(await obtePerfils());
}

// Responsables de projecte i de client: només membres amb accés.
export const membres = (perfils: Perfil[]) => perfils.filter((p) => p.actiu && !p.extern);

// A qui es pot assignar una fase, un entregable o una tasca: membres i externs actius.
export const assignables = (perfils: Perfil[]) => perfils.filter((p) => p.actiu);

export const etiquetaPersona = (p: Perfil) =>
  p.extern ? `${p.nom} · ${p.area ?? "extern"}` : p.nom;

export const obteClientsActius = cache(async (): Promise<Pick<Client, "id" | "nom">[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("id, nom").eq("actiu", true).order("nom");
  return data ?? [];
});

// Sense fallar en silenci: si una consulta peta, que es vegi.
export function comprova<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(`Error de base de dades: ${r.error.message}`);
  return r.data as T;
}

// Nombre de replanificacions de cada element (exclosa la primera planificació).
export async function comptaReplanificacions(ids: string[]): Promise<Map<string, number>> {
  const compte = new Map<string, number>();
  if (ids.length === 0) return compte;
  const supabase = await createClient();
  const { data } = await supabase
    .from("historial_dates")
    .select("registre_id")
    .in("registre_id", ids)
    .neq("motiu", "planificació inicial");
  for (const r of data ?? []) compte.set(r.registre_id, (compte.get(r.registre_id) ?? 0) + 1);
  return compte;
}
