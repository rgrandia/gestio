import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Obrir un avís: el marca com a llegit i porta on apunta.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("notificacions")
    .update({ llegida_el: new Date().toISOString() })
    .eq("id", Number(id))
    .select("enllac")
    .maybeSingle();
  const desti = data?.enllac?.startsWith("/") ? data.enllac : "/avisos";
  // Redirecció relativa: el navegador la resol contra l'adreça on és, i no
  // es perd la sessió si el servidor veu un altre nom d'host (p. ex. localhost).
  return new NextResponse(null, { status: 303, headers: { Location: desti } });
}
