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
  if (error) {
    // Al registre de Vercel queda la causa real; a la pantalla, una de
    // concreta. Abans tot sortia com a "contrasenya incorrecta" i amagava
    // errors de configuració.
    console.error("login:", error.code, error.status, error.message);
    // TEMPORAL (diagnòstic d'invalid_credentials): què arriba al servidor.
    // Mai la contrasenya; només la llargada i si té caràcters no ASCII.
    const noAscii = (s: string) =>
      [...s].filter((c) => c.codePointAt(0)! > 126).map((c) => "U+" + c.codePointAt(0)!.toString(16));
    console.error(
      "login-diag:",
      JSON.stringify({
        email,
        emailLlargada: email.length,
        emailNoAscii: noAscii(email),
        pwLlargada: password.length,
        pwNoAscii: noAscii(password).length,
        pwVoraBlanca: password !== password.trim(),
        supabase: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host,
      }),
    );
    return { error: missatgeLogin(error.code, error.status) };
  }

  redirect("/");
}

function missatgeLogin(code: string | undefined, status: number | undefined): string {
  switch (code) {
    case "invalid_credentials":
      return "Correu o contrasenya incorrectes.";
    case "email_not_confirmed":
      return "L'usuari no està confirmat. Confirma'l a Supabase (Authentication → Users).";
    case "user_banned":
      return "Aquest usuari està bloquejat a Supabase.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Massa intents seguits. Espera uns minuts.";
  }
  if (status === 401 || code === "no_authorization" || code === "bad_jwt")
    return "La clau de Supabase no és vàlida. Revisa NEXT_PUBLIC_SUPABASE_ANON_KEY a Vercel i torna a desplegar.";
  if (!status || status === 404 || status >= 500)
    return "No s'ha pogut connectar amb Supabase. Revisa NEXT_PUBLIC_SUPABASE_URL a Vercel i torna a desplegar.";
  return `Error d'autenticació (${code ?? status}).`;
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
