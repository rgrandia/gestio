import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Perfil } from "@/lib/tipus";

export type Sessio = { usuariId: string; email: string | null; perfil: Perfil | null };

export const obteSessio = cache(async (): Promise<Sessio | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) return null;

  // Si l'usuari no és membre actiu, l'RLS no li retorna ni el seu perfil.
  const { data: perfil } = await supabase
    .from("perfils")
    .select("id, nom, email, actiu, extern, area")
    .eq("id", sub)
    .maybeSingle();

  return {
    usuariId: sub,
    email: (data.claims.email as string | undefined) ?? null,
    perfil: perfil ?? null,
  };
});

// Per a totes les pantalles de l'app: exigeix sessió i perfil actiu.
export async function requereixMembre(): Promise<Perfil> {
  const sessio = await obteSessio();
  if (!sessio) redirect("/login");
  if (!sessio.perfil) redirect("/sense-acces");
  return sessio.perfil;
}
