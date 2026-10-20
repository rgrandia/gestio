import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { comprova, membres, obteClientsActius, obtePerfils } from "@/lib/dades";
import { avui, dataCurta } from "@/lib/dates";
import { Retard } from "@/components/Retard";
import { Persona } from "@/components/Persona";
import { EtiquetaEstat } from "@/components/EtiquetaEstat";
import { Plus } from "lucide-react";
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
    .select("*, clients(nom), projecte_responsables(perfil_id, actiu)")
    .order("data_fi_prevista", { ascending: true, nullsFirst: false })
    .order("titol");
  if (f.tipus === "estudi" || f.tipus === "consultoria" || f.tipus === "altre") q = q.eq("tipus", f.tipus);
  if (f.client) q = q.eq("client_id", f.client);
  if (f.responsable) {
    // principal o co-responsable
    const { data: co } = await supabase
      .from("projecte_responsables")
      .select("projecte_id")
      .eq("perfil_id", f.responsable)
      .eq("actiu", true);
    const ids = (co ?? []).map((r) => r.projecte_id);
    q = ids.length
      ? q.or(`responsable_id.eq.${f.responsable},id.in.(${ids.join(",")})`)
      : q.eq("responsable_id", f.responsable);
  }
  // Per defecte, fora tancats i cancel·lats (§7.2)
  if (estat === "obert") q = q.in("estat", ["actiu", "pausat"]);
  else if (estat !== "tots") q = q.eq("estat", estat);

  const [projectes, clients, perfils] = await Promise.all([q, obteClientsActius(), obtePerfils()]);
  const files = comprova(projectes) as (Projecte & {
    clients: { nom: string } | null;
    projecte_responsables: { perfil_id: string; actiu: boolean }[];
  })[];
  const noms = new Map(perfils.map((p) => [p.id, p.nom]));
  const hui = avui();

  return (
    <>
      <div className="cap-pagina">
        <div>
          <h1>projectes</h1>
          <div className="sub">{files.length} {files.length === 1 ? "projecte" : "projectes"}</div>
        </div>
        <Link href="/projectes/nou" className="boto boto-primari"><Plus className="icona-petita" aria-hidden /> nou projecte</Link>
      </div>
      <section className="seccio">
      <form className="filtres" method="get">
        <select name="tipus" defaultValue={f.tipus ?? ""} aria-label="tipus">
          <option value="">tots els tipus</option>
          <option value="estudi">estudi</option>
          <option value="consultoria">consultoria</option>
          <option value="altre">altre</option>
        </select>
        <select name="client" defaultValue={f.client ?? ""} aria-label="client">
          <option value="">tots els clients</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
        <select name="responsable" defaultValue={f.responsable ?? ""} aria-label="responsable">
          <option value="">tots els responsables</option>
          {membres(perfils).map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
        </select>
        <select name="estat" defaultValue={estat} aria-label="estat">
          {ESTATS.map((e) => (
            <option key={e} value={e}>{e === "obert" ? "actius i pausats" : e === "tots" ? "tots els estats" : e}</option>
          ))}
        </select>
        <button className="boto">filtrar</button>
      </form>

      {files.length === 0 ? (
        <div className="buit">cap projecte amb aquests filtres</div>
      ) : (
        <div className="desplacable">
          <table className="taula">
            <thead>
              <tr>
                <th className="num">núm.</th>
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
                  <td className="num suau">{p.numero_estudi ?? ""}</td>
                  <td className="element">
                    <div className="titol-el"><Link href={`/projectes/${p.id}`}>{p.titol}</Link></div>
                    {p.subtipus && <div className="context">{p.subtipus}</div>}
                  </td>
                  <td><span className={`etiqueta ${p.tipus === "estudi" ? "tag-accent" : ""}`}>{p.tipus}</span></td>
                  <td>{p.clients?.nom}</td>
                  <td>
                    <span className="flex items-center gap-1">
                      <Persona nom={noms.get(p.responsable_id)} />
                      {p.projecte_responsables
                        .filter((r) => r.actiu && r.perfil_id !== p.responsable_id)
                        .map((r) => <Persona key={r.perfil_id} nom={noms.get(r.perfil_id)} nomesAvatar />)}
                    </span>
                  </td>
                  <td><EtiquetaEstat estat={p.estat} /></td>
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
      </section>
    </>
  );
}
