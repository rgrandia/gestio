import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Client, Perfil } from "@/lib/tipus";

export const obtePerfils = cache(async (): Promise<Perfil[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("perfils")
    .select("id, nom, email, actiu, extern, area")
    .order("extern")
    .order("nom");
  return data ?? [];
});

export async function nomsPerfils(): Promise<Map<string, string>> {
  return new Map((await obtePerfils()).map((p) => [p.id, p.nom]));
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
