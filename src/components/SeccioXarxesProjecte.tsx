import Link from "next/link";
import { Plus } from "lucide-react";
import { teXarxes } from "@/lib/funcions";
import { createClient } from "@/lib/supabase/server";
import { comptes, type PublicacioLlista } from "@/lib/dades-xarxes";
import { XipPublicacio } from "@/components/XipPublicacio";

// Al detall del projecte, només per a qui té les xarxes activades: què se
// n'ha publicat o se'n prepara.
export async function SeccioXarxesProjecte({ projecteId }: { projecteId: string }) {
  if (!(await teXarxes())) return null;
  const supabase = await createClient();
  const [{ data }, cs] = await Promise.all([
    supabase
      .from("publicacions")
      .select("id, titol, estat, data_prevista, data_real, hora, responsable_id, revisor_id, nota_revisio, publicacio_canals(compte_id, actiu, enllac_publicat)")
      .eq("projecte_id", projecteId)
      .neq("estat", "cancellada")
      .order("data_prevista", { nullsFirst: true }),
    comptes(),
  ]);
  const pubs = (data ?? []) as unknown as PublicacioLlista[];
  const mapa = new Map(cs.map((c) => [c.id, c]));
  return (
    <section className="seccio" id="xarxes">
      <header>
        <span className="titol">
          a xarxes socials {pubs.length > 0 && <span className="comptador">{pubs.length}</span>}
        </span>
        <span className="meta">
          <Link href={`/xarxes/nova?projecte=${projecteId}`} className="boto boto-suau">
            <Plus className="icona-petita" aria-hidden /> preparar-ne una
          </Link>
        </span>
      </header>
      {pubs.length === 0 ? (
        <p className="buit-petit">cap publicació lligada a aquest projecte (només si el client n&apos;autoritza la difusió)</p>
      ) : (
        <div className="cos xips-projecte">
          {pubs.map((p) => (
            <XipPublicacio key={p.id} p={p} comptes={mapa} ambData />
          ))}
        </div>
      )}
    </section>
  );
}
