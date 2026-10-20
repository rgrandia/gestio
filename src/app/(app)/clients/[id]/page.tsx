import Link from "next/link";
import { Plus } from "lucide-react";
import { Persona } from "@/components/Persona";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { comprova, mapaPersones, membres, obtePerfils } from "@/lib/dades";
import { actualitzaClient } from "@/lib/accions";
import { avui, dataCurta, desplacament, diesEntre } from "@/lib/dates";
import { Formulari } from "@/components/Formulari";
import { CampsClient } from "../CampsClient";
import type { Client, Idea, Perfil, Projecte } from "@/lib/tipus";

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
      .is("eliminat_el", null) // la paperera no surt a la fitxa
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
  const persones = mapaPersones(perfils);
  const hui = avui();

  const darrerContacte = projectes
    .flatMap((p) => p.contactes.map((c) => c.data))
    .sort()
    .at(-1);
  // Els arxivats van amb els tancats, encara que el seu estat sigui "actiu".
  const actius = projectes.filter((p) => !p.arxivat_el && (p.estat === "actiu" || p.estat === "pausat"));
  const tancats = projectes.filter((p) => p.arxivat_el || p.estat === "tancat" || p.estat === "cancellat");

  return (
    <>
      <div className="cap-pagina">
        <div>
          <div className="molla"><Link href="/clients">clients</Link></div>
          <h1>{client.nom}</h1>
          <div className="sub flex gap-2 items-center mt-2">
            <span className="etiqueta">{client.tipus}</span>
            {client.territori && <span className="etiqueta">{client.territori}</span>}
            {!client.actiu && <span className="etiqueta tag-mut">inactiu</span>}
          </div>
        </div>
        <Link href={`/projectes/nou?client=${client.id}`} className="boto boto-primari">
          <Plus className="icona-petita" aria-hidden /> nou projecte
        </Link>
      </div>

      <dl className="capcalera">
        <div>
          <dt>responsable</dt>
          <dd><Persona p={persones.get(client.responsable_id ?? "")} /></dd>
        </div>
        <div>
          <dt>darrer contacte</dt>
          <dd>
            {darrerContacte ? (
              <>
                {dataCurta(darrerContacte)}
                <span className="suau">{desplacament(diesEntre(hui, darrerContacte))}</span>
              </>
            ) : (
              "cap registrat"
            )}
          </dd>
        </div>
        <div>
          <dt>projectes actius</dt>
          <dd>{actius.length}</dd>
        </div>
        <div>
          <dt>idees obertes</dt>
          <dd>{idees.length}</dd>
        </div>
      </dl>
      {client.notes && <p className="prosa notes">{client.notes}</p>}

      <section className="seccio">
        <header>
          <span className="titol">projectes actius</span>
          
        </header>
        <LlistaProjectes projectes={actius} persones={persones} buit="cap projecte actiu" />
      </section>

      <section className="seccio">
        <header>
          <span className="titol">idees obertes</span>
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
          <span className="titol">projectes tancats i arxivats</span>
          <span className="meta">{tancats.length}</span>
        </header>
        <LlistaProjectes projectes={tancats} persones={persones} buit="cap projecte tancat" />
      </section>

      <section className="seccio">
        <header>
          <span className="titol">dades del client</span>
          <span className="meta">
            {editar === "1" ? <Link href={`/clients/${id}`}>tanca</Link> : <Link href={`/clients/${id}?editar=1`}>editar</Link>}
          </span>
        </header>
        {editar === "1" && (
          <div className="cos">
            <Formulari accio={actualitzaClient} boto="desar canvis">
              <input type="hidden" name="id" value={client.id} />
              <CampsClient client={client} perfils={membres(perfils)} />
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
  persones,
  buit,
}: {
  projectes: Projecte[];
  persones: Map<string, Perfil>;
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
              <td><Persona p={persones.get(p.responsable_id)} /></td>
              <td className="suau">{p.arxivat_el ? "arxivat" : p.estat}</td>
              <td className="num">{dataCurta(p.data_fi_real ?? p.data_fi_prevista)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
