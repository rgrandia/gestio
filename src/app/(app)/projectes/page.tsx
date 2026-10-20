import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { comprova, obteClientsActius, obtePerfils } from "@/lib/dades";
import { avui, dataCurta } from "@/lib/dates";
import { Retard } from "@/components/Retard";
import type { EstatProjecte, Projecte } from "@/lib/tipus";

export const dynamic = "force-dynamic";

type Filtres = { tipus?: string; client?: string; responsable?: string; estat?: string };

const ESTATS: (EstatProjecte | "obert" | "tots")[] = ["obert", "actiu", "pausat", "tancat", "cancellat", "tots"];

export default async function Projectes({ searchParams }: { searchParams: Promise<Filtres> }) {
  const f = await searchParams;
  const estat = f.estat ?? "obert";
  const supabase = await createClient();

  let q = supabase
    .from("projectes")
    .select("*, clients(nom)")
    .order("data_fi_prevista", { ascending: true, nullsFirst: false })
    .order("titol");
  if (f.tipus === "estudi" || f.tipus === "consultoria") q = q.eq("tipus", f.tipus);
  if (f.client) q = q.eq("client_id", f.client);
  if (f.responsable) q = q.eq("responsable_id", f.responsable);
  // Per defecte, fora tancats i cancel·lats (§7.2)
  if (estat === "obert") q = q.in("estat", ["actiu", "pausat"]);
  else if (estat !== "tots") q = q.eq("estat", estat);

  const [projectes, clients, perfils] = await Promise.all([q, obteClientsActius(), obtePerfils()]);
  const files = comprova(projectes) as (Projecte & { clients: { nom: string } | null })[];
  const noms = new Map(perfils.map((p) => [p.id, p.nom]));
  const hui = avui();

  return (
    <>
      <h1>projectes</h1>
      <form className="filtres" method="get">
        <select name="tipus" defaultValue={f.tipus ?? ""} aria-label="tipus">
          <option value="">tots els tipus</option>
          <option value="estudi">estudi</option>
          <option value="consultoria">consultoria</option>
        </select>
        <select name="client" defaultValue={f.client ?? ""} aria-label="client">
          <option value="">tots els clients</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
        <select name="responsable" defaultValue={f.responsable ?? ""} aria-label="responsable">
          <option value="">tots els responsables</option>
          {perfils.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
        </select>
        <select name="estat" defaultValue={estat} aria-label="estat">
          {ESTATS.map((e) => (
            <option key={e} value={e}>{e === "obert" ? "actius i pausats" : e === "tots" ? "tots els estats" : e}</option>
          ))}
        </select>
        <button className="boto">filtrar</button>
        <span className="ml-auto"><Link href="/projectes/nou">+ nou projecte</Link></span>
      </form>

      {files.length === 0 ? (
        <div className="buit">cap projecte amb aquests filtres</div>
      ) : (
        <div className="desplacable">
          <table className="taula">
            <thead>
              <tr>
                <th>projecte</th>
                <th>tipus</th>
                <th>client</th>
                <th>responsable</th>
                <th>estat</th>
                <th className="num">fi prevista</th>
                <th className="num">fi real</th>
                <th className="num">desv.</th>
              </tr>
            </thead>
            <tbody>
              {files.map((p) => (
                <tr key={p.id} data-estat={p.estat === "cancellat" ? "cancellat" : undefined}>
                  <td><Link href={`/projectes/${p.id}`}>{p.titol}</Link></td>
                  <td className="suau">{p.tipus}{p.subtipus ? ` · ${p.subtipus}` : ""}</td>
                  <td>{p.clients?.nom}</td>
                  <td>{noms.get(p.responsable_id) ?? "—"}</td>
                  <td>{p.estat}</td>
                  <td className="num">{dataCurta(p.data_fi_prevista)}</td>
                  <td className="num">{dataCurta(p.data_fi_real)}</td>
                  <td className="num">
                    {p.estat === "actiu" || p.data_fi_real ? (
                      <Retard prevista={p.data_fi_prevista} real={p.data_fi_real} hui={hui} />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
