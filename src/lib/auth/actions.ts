"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PROVEIDOR_AUTH } from "./config";

export type EstatLogin = { error?: string };

export async function iniciaSessioContrasenya(
  _prev: EstatLogin,
  formData: FormData,
): Promise<EstatLogin> {
  if (PROVEIDOR_AUTH !== "password") return { error: "L'accés amb contrasenya està desactivat." };

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Escriu el correu i la contrasenya." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Correu o contrasenya incorrectes." };

  redirect("/");
}

export async function iniciaSessioEntra() {
  if (PROVEIDOR_AUTH !== "azure") redirect("/login");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "azure",
    options: {
      scopes: "email",
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });
  if (error || !data.url) redirect("/login?error=oauth");
  redirect(data.url);
}

export async function tancaSessio() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
