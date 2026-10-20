import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { comprova, obtePerfils } from "@/lib/dades";
import { actualitzaClient } from "@/lib/accions";
import { avui, dataCurta, desplacament, diesEntre } from "@/lib/dates";
import { Formulari } from "@/components/Formulari";
import { CampsClient } from "../CampsClient";
import type { Client, Idea, Projecte } from "@/lib/tipus";

export const dynamic = "force-dynamic";

// Fitxa per preparar una reunió en trenta segons (§6.4).
export default async function FitxaClient({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ editar?: string }>;
}) {
  const { id } = await params;
  const { editar } = await searchParams;
  const supabase = await createClient();

  const { data: clientR } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (!clientR) notFound();
  const client = clientR as Client;

  const [projectesR, ideesR, perfils] = await Promise.all([
    supabase
      .from("projectes")
      .select("*, contactes(data)")
      .eq("client_id", id)
      .order("data_inici", { ascending: false, nullsFirst: false }),
    supabase
      .from("idees")
      .select("*")
      .eq("client_id", id)
      .in("estat", ["proposada", "valorada", "assignada"])
      .order("data_objectiu", { nullsFirst: false }),
    obtePerfils(),
  ]);
  const projectes = comprova(projectesR) as (Projecte & { contactes: { data: string }[] })[];
  const idees = comprova(ideesR) as Idea[];
  const noms = new Map(perfils.map((p) => [p.id, p.nom]));
  const hui = avui();

  const darrerContacte = projectes
    .flatMap((p) => p.contactes.map((c) => c.data))
    .sort()
    .at(-1);
  const actius = projectes.filter((p) => p.estat === "actiu" || p.estat === "pausat");
  const tancats = projectes.filter((p) => p.estat === "tancat" || p.estat === "cancellat");

  return (
    <>
      <h1>
        {client.nom} {!client.actiu && <span className="tag suau">inactiu</span>}
      </h1>

      <dl className="capcalera">
        <dt>tipus</dt>
        <dd>{client.tipus}</dd>
        <dt>territori</dt>
        <dd>{client.territori ?? "—"}</dd>
        <dt>responsable</dt>
        <dd>{noms.get(client.responsable_id ?? "") ?? "—"}</dd>
        <dt>darrer contacte</dt>
        <dd>
          {darrerContacte ? (
            <>
              {dataCurta(darrerContacte)}{" "}
              <span className="suau">{desplacament(diesEntre(hui, darrerContacte))}</span>
            </>
          ) : (
            "cap registrat"
          )}
        </dd>
      </dl>
      {client.notes && <p className="prosa mb-6">{client.notes}</p>}

      <section className="seccio">
        <header>
          <span>projectes actius</span>
          <span className="meta"><Link href={`/projectes/nou?client=${client.id}`}>+ nou projecte</Link></span>
        </header>
        <LlistaProjectes projectes={actius} noms={noms} buit="cap projecte actiu" />
      </section>

      <section className="seccio">
        <header>
          <span>idees obertes</span>
          <span className="meta"><Link href="/idees">idees</Link></span>
        </header>
        {idees.length === 0 ? (
          <div className="buit">cap idea oberta per a aquest client</div>
        ) : (
          <table className="taula">
            <tbody>
              {idees.map((i) => (
                <tr key={i.id}>
                  <td>{i.titol}</td>
                  <td className="suau">{i.estat}</td>
                  <td className="num">{i.data_objectiu ? dataCurta(i.data_objectiu) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="seccio">
        <header>
          <span>projectes tancats</span>
          <span className="meta">{tancats.length}</span>
        </header>
        <LlistaProjectes projectes={tancats} noms={noms} buit="cap projecte tancat" />
      </section>

      <section className="seccio">
        <header>
          <span>dades del client</span>
          <span className="meta">
            {editar === "1" ? <Link href={`/clients/${id}`}>tanca</Link> : <Link href={`/clients/${id}?editar=1`}>editar</Link>}
          </span>
        </header>
        {editar === "1" && (
          <div className="pt-3">
            <Formulari accio={actualitzaClient} boto="desar canvis">
              <input type="hidden" name="id" value={client.id} />
              <CampsClient client={client} perfils={perfils} />
              <label className="check">
                <input type="checkbox" name="actiu" defaultChecked={client.actiu} /> client actiu
              </label>
            </Formulari>
          </div>
        )}
      </section>
    </>
  );
}

function LlistaProjectes({
  projectes,
  noms,
  buit,
}: {
  projectes: Projecte[];
  noms: Map<string, string>;
  buit: string;
}) {
  if (projectes.length === 0) return <div className="buit">{buit}</div>;
  return (
    <div className="desplacable">
      <table className="taula">
        <tbody>
          {projectes.map((p) => (
            <tr key={p.id} data-estat={p.estat === "cancellat" ? "cancellat" : undefined}>
              <td><Link href={`/projectes/${p.id}`}>{p.titol}</Link></td>
              <td className="suau">{p.tipus}{p.subtipus ? ` · ${p.subtipus}` : ""}</td>
              <td>{noms.get(p.responsable_id) ?? "—"}</td>
              <td className="suau">{p.estat}</td>
              <td className="num">{dataCurta(p.data_fi_real ?? p.data_fi_prevista)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
