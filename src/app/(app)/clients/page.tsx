import Link from "next/link";
import { Plus } from "lucide-react";
import { Persona } from "@/components/Persona";
import { createClient } from "@/lib/supabase/server";
import { comprova, obtePersones } from "@/lib/dades";
import type { Client } from "@/lib/tipus";

export const dynamic = "force-dynamic";

export default async function Clients({ searchParams }: { searchParams: Promise<{ inactius?: string }> }) {
  const { inactius } = await searchParams;
  const ambInactius = inactius === "1";
  const supabase = await createClient();

  let q = supabase.from("clients").select("*, projectes(estat, arxivat_el, eliminat_el)").order("nom");
  if (!ambInactius) q = q.eq("actiu", true);

  const [clientsR, persones] = await Promise.all([q, obtePersones()]);
  const clients = comprova(clientsR) as (Client & {
    projectes: { estat: string; arxivat_el: string | null; eliminat_el: string | null }[];
  })[];

  return (
    <>
      <div className="cap-pagina">
        <div>
          <h1>clients</h1>
          <div className="sub">
            {clients.length} {clients.length === 1 ? "client" : "clients"} ·{" "}
            {ambInactius ? <Link href="/clients">amaga inactius</Link> : <Link href="/clients?inactius=1">mostra inactius</Link>}
          </div>
        </div>
        <Link href="/clients/nou" className="boto boto-primari"><Plus className="icona-petita" aria-hidden /> nou client</Link>
      </div>
      <section className="seccio">
      {clients.length === 0 ? (
        <div className="buit">cap client. <Link href="/clients/nou">crea el primer</Link></div>
      ) : (
        <div className="desplacable">
          <table className="taula">
            <thead>
              <tr>
                <th>client</th>
                <th>tipus</th>
                <th>territori</th>
                <th>responsable</th>
                <th className="num">projectes actius</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} data-estat={c.actiu ? undefined : "cancellat"}>
                  <td><Link href={`/clients/${c.id}`}>{c.nom}</Link></td>
                  <td><span className="etiqueta">{c.tipus}</span></td>
                  <td className="suau">{c.territori ?? ""}</td>
                  <td><Persona p={persones.get(c.responsable_id ?? "")} /></td>
                  <td className="num">{c.projectes.filter((p) => p.estat === "actiu" && !p.arxivat_el && !p.eliminat_el).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </section>
    </>
  );
}
