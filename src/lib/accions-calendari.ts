"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { esDataValida } from "@/lib/dates";
import { missatgeError } from "@/lib/errors";
import type { Resultat } from "@/lib/accions";
import { LLISTA_TIPUS_DIA, type TipusDia } from "@/lib/calendari";

// Marca (o treu, amb tipus null) dies del meu calendari o, amb `equip`,
// festius de tot l'equip. Les regles són a marca_dies() (migració 0020).
export async function marcaDies(dates: string[], tipus: TipusDia | null, nota: string, equip: boolean): Promise<Resultat> {
  if (dates.length === 0) return { error: "Tria algun dia." };
  if (dates.some((d) => !esDataValida(d))) return { error: "Alguna data no és vàlida." };
  if (tipus && !LLISTA_TIPUS_DIA.includes(tipus)) return { error: "Tipus de dia desconegut." };
  if (nota.length > 80) return { error: "La nota pot tenir com a molt 80 caràcters." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("marca_dies", { p_dates: dates, p_tipus: tipus, p_nota: nota, p_equip: equip });
  if (error) return { error: missatgeError(error) };
  revalidatePath("/calendari");
  revalidatePath("/");
  return { ok: true };
}
