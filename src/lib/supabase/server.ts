import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Client de Supabase per a Server Components, Server Actions i Route
// Handlers. Fa servir NOMÉS la clau pública: tot el que pot fer ho decideix
// l'RLS amb la sessió de l'usuari. La clau service_role no existeix aquí.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Des d'un Server Component no es poden escriure galetes; el
            // proxy ja refresca la sessió a cada petició.
          }
        },
      },
    },
  );
}
