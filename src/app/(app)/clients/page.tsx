import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { comprova, nomsPerfils } from "@/lib/dades";
import type { Client } from "@/lib/tipus";

export const dynamic = "force-dynamic";

export default async function Clients({ searchParams }: { searchParams: Promise<{ inactius?: string }> }) {
  const { inactius } = await searchParams;
  const ambInactius = inactius === "1";
  const supabase = await createClient();

  let q = supabase.from("clients").select("*, projectes(estat)").order("nom");
  if (!ambInactius) q = q.eq("actiu", true);

  const [clientsR, noms] = await Promise.all([q, nomsPerfils()]);
  const clients = comprova(clientsR) as (Client & { projectes: { estat: string }[] })[];

  return (
    <>
      <h1>clients</h1>
      <div className="filtres">
        {ambInactius ? <Link href="/clients">amaga inactius</Link> : <Link href="/clients?inactius=1">mostra inactius</Link>}
        <span className="ml-auto"><Link href="/clients/nou" className="boto boto-primari">+ nou client</Link></span>
      </div>
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
                  <td className="suau">{c.tipus}</td>
                  <td className="suau">{c.territori ?? ""}</td>
                  <td>{noms.get(c.responsable_id ?? "") ?? "—"}</td>
                  <td className="num">{c.projectes.filter((p) => p.estat === "actiu").length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
