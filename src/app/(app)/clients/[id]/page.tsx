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
  const ajornats = await obteAjornats(actius);

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

      {ajornats.length > 0 && (
        <section className="seccio">
          <header>
            <span className="titol">
              ajornats més d&apos;una vegada
              <span className="comptador c-risc">{ajornats.length}</span>
            </span>
            <span className="meta">el que encara és obert i s&apos;ha replanificat dues vegades o més: ho sabrà el client</span>
          </header>
          <div className="desplacable">
            <table className="taula">
              <thead>
                <tr>
                  <th>element</th>
                  <th className="num">vegades</th>
                  <th className="num">ara previst</th>
                  <th>motius</th>
                </tr>
              </thead>
              <tbody>
                {ajornats.map((a) => (
                  <tr key={a.clau}>
                    <td>
                      <div>{a.element}</div>
                      <div className="context">
                        <span>{a.que}</span>
                        <span className="sep">·</span>
                        <Link href={`/projectes/${a.projecte_id}?pestanya=historial`}>{a.projecte}</Link>
                      </div>
                    </td>
                    <td className="num"><span className="etiqueta tag-risc">×{a.vegades}</span></td>
                    <td className="num">{dataCurta(a.ara)}</td>
                    <td className="font-sans">{a.motius.join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

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

const QUE: Record<string, string> = { projectes: "fi del projecte", fases: "fase", entregables: "entregable", tasques: "tasca" };

// Elements oberts dels projectes actius replanificats dues vegades o més (la
// primera planificació no compta). És el cas del §4.2: saber, abans d'una
// reunió, que un informe s'ha ajornat quatre vegades.
async function obteAjornats(actius: Projecte[]) {
  if (actius.length === 0) return [];
  const supabase = await createClient();
  const h = comprova(
    await supabase
      .from("v_historial_projecte")
      .select("taula, registre_id, element, projecte_id, data_nova, motiu, creat_el")
      .in("projecte_id", actius.map((p) => p.id))
      .not("data_antiga", "is", null)
      .order("creat_el"),
  ) as { taula: string; registre_id: string; element: string; projecte_id: string; data_nova: string | null; motiu: string }[];

  const grups = new Map<string, typeof h>();
  for (const r of h) grups.set(`${r.taula}:${r.registre_id}`, [...(grups.get(`${r.taula}:${r.registre_id}`) ?? []), r]);
  const candidats = [...grups].filter(([, rs]) => rs.length >= 2);
  if (candidats.length === 0) return [];

  // Només el que encara és obert.
  const ids = (t: string) => candidats.filter(([k]) => k.startsWith(t + ":")).map(([, rs]) => rs[0].registre_id);
  const oberts = new Set<string>();
  for (const t of ["tasques", "fases", "entregables"] as const) {
    const llista = ids(t);
    if (llista.length === 0) continue;
    const { data } = await supabase.from(t).select("id").in("id", llista).is("data_real", null).neq("estat", "cancellat");
    for (const r of data ?? []) oberts.add(`${t}:${r.id}`);
  }
  for (const id of ids("projectes")) oberts.add(`projectes:${id}`); // tots són actius

  const titol = new Map(actius.map((p) => [p.id, (p.numero_estudi ? `${p.numero_estudi} · ` : "") + p.titol]));
  return candidats
    .filter(([k]) => oberts.has(k))
    .map(([clau, rs]) => ({
      clau,
      que: QUE[rs[0].taula] ?? rs[0].taula,
      element: rs[0].element,
      projecte_id: rs[0].projecte_id,
      projecte: titol.get(rs[0].projecte_id) ?? "",
      vegades: rs.length,
      ara: rs.at(-1)!.data_nova,
      motius: [...new Set(rs.map((r) => r.motiu))],
    }))
    .sort((a, b) => b.vegades - a.vegades);
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
