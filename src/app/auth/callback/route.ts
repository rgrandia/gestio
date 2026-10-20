import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Retorn d'OAuth (Entra ID): bescanvia el codi per una sessió.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const desti = new URL("/", request.url);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(desti);
  }
  return NextResponse.redirect(new URL("/login?error=oauth", request.url));
}
