import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Client, Perfil } from "@/lib/tipus";

export const obtePerfils = cache(async (): Promise<Perfil[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("perfils").select("id, nom, email, actiu").order("nom");
  return data ?? [];
});

export async function nomsPerfils(): Promise<Map<string, string>> {
  return new Map((await obtePerfils()).map((p) => [p.id, p.nom]));
}

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
