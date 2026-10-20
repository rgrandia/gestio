import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { RUTES_PUBLIQUES } from "./config";

// Refresca la sessió de Supabase a cada petició i envia a /login qui no
// n'hagi iniciat. No decideix qui és membre: això ho fa l'RLS (es_membre())
// i, per a la interfície, requereixMembre().
export async function actualitzaSessio(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const autenticat = Boolean(data?.claims?.sub);
  const ruta = request.nextUrl.pathname;
  const publica = RUTES_PUBLIQUES.some((r) => ruta === r || ruta.startsWith(r + "/"));

  if (!autenticat && !publica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
