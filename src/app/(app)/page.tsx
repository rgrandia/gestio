import Link from "next/link";
import { CheckCircle2, Lightbulb, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requereixMembre } from "@/lib/auth/session";
import { assignables, comprova, comptaReplanificacions, membres, obtePersones } from "@/lib/dades";
import { FilaRevisio } from "@/components/FilaRevisio";
import { Persona } from "@/components/Persona";
import { Replanificat } from "@/components/Replanificat";
import { avui, dataCurta, dataLlarga, desplacament, diaCurt, diaRelatiu, diesEntre, salutacio, sumaDies } from "@/lib/dates";
import { FilaAccionable } from "@/components/FilaAccionable";
import { Formulari } from "@/components/Formulari";
import { Seleccio } from "@/components/Seleccio";
import { estatFila } from "@/components/Retard";
import { creaTascaInterna } from "@/lib/accions";
import { SeccioXarxesInici } from "@/components/SeccioXarxesInici";
import { TAULA_DE, type FilaSafata, type ProjecteMut } from "@/lib/tipus";

export const dynamic = "force-dynamic";

type TascaSetmana = {
  id: string;
  titol: string;
  data_prevista: string;
  prioritat: string;
  projecte_id: string;
  projectes: { titol: string; clients: { nom: string } | null } | null;
};

export default async function LaMevaSetmana({
  searchParams,
}: {
  searchParams: Promise<{ tot?: string }>;
}) {
  const perfil = await requereixMembre();
  const { tot } = await searchParams;
  const veureTot = tot === "1";
  const hui = avui();
  const fiSetmana = sumaDies(hui, 7);
  const supabase = await createClient();

  let consultaSafata = supabase
    .from("v_safata")
    .select("*")
    .order("data_prevista")
    .order("projecte")
    .eq("intern", false); // les internes tenen la seva secció
  if (!veureTot) consultaSafata = consultaSafata.contains("responsables", [perfil.id]);

  const [safata, setmana, muts, idees, revisionsR, persones, sensDataR, internesR, momentR] = await Promise.all([
    consultaSafata,
    supabase
      .from("tasques")
      .select("id, titol, data_prevista, prioritat, projecte_id, projectes!inner(titol, estat, clients(nom))")
      .eq("assignada_a", perfil.id)
      .is("data_real", null)
      .not("estat", "in", "(fet,cancellat)")
      .eq("projectes.estat", "actiu")
      .is("projectes.arxivat_el", null)
      .is("projectes.eliminat_el", null)
      .is("projectes.intern_de", null)
      .gte("data_prevista", hui)
      .lte("data_prevista", fiSetmana)
      .order("data_prevista"),
    supabase.from("v_projectes_muts").select("*").contains("responsables", [perfil.id]).order("darrer_senyal"),
    supabase
      .from("idees")
      .select("id, titol, data_objectiu")
      .eq("proposada_per", perfil.id)
      .eq("estat", "proposada")
      .order("creat_el", { ascending: false }),
    supabase
      .from("revisions")
      .select(
        "id, revisor_id, demanada_per, creat_el, tasques(titol, projecte_id, projectes(titol)), entregables(titol, projecte_id, projectes(titol))",
      )
      .eq("estat", "pendent")
      .or(`revisor_id.eq.${perfil.id},demanada_per.eq.${perfil.id}`)
      .order("creat_el"),
    obtePersones(),
    // Tasques obertes meves sense data: no poden vèncer ni sortir a la safata.
    supabase
      .from("tasques")
      .select("id, projectes!inner(intern_de)", { count: "exact", head: true })
      .eq("assignada_a", perfil.id)
      .is("data_prevista", null)
      .is("data_real", null)
      .not("estat", "in", "(fet,cancellat)")
      .is("projectes.intern_de", null),
    // Gestió interna: les meves tasques obertes de projectes interns (el meu
    // o el d'algú que me n'ha passat una).
    supabase
      .from("tasques")
      .select("id, titol, descripcio, data_prevista, prioritat, projectes!inner(intern_de)")
      .eq("assignada_a", perfil.id)
      .is("data_real", null)
      .not("estat", "in", "(fet,cancellat)")
      .not("projectes.intern_de", "is", null)
      .order("data_prevista", { nullsFirst: false })
      .order("creat_el"),
    // Idees de l'equip encara no convertides el moment polític de les quals
    // (data_objectiu) arriba en 30 dies: si no es mouen ara, no hi arribaran.
    supabase
      .from("idees")
      .select("id, titol, data_objectiu, estat, proposada_per, clients(nom)")
      .in("estat", ["proposada", "valorada", "assignada"])
      .is("projecte_id", null)
      .gte("data_objectiu", hui)
      .lte("data_objectiu", sumaDies(hui, 30))
      .order("data_objectiu"),
  ]);
  const moment = comprova(momentR) as unknown as {
    id: string;
    titol: string;
    data_objectiu: string;
    estat: string;
    proposada_per: string | null;
    clients: { nom: string } | null;
  }[];
  const internes = comprova(internesR) as unknown as {
    id: string;
    titol: string;
    descripcio: string | null;
    data_prevista: string | null;
    prioritat: string;
  }[];
  const sensData = sensDataR.count ?? 0;

  type ElementRevisat = { titol: string; projecte_id: string; projectes: { titol: string } | null };
  type Revisio = {
    id: string;
    revisor_id: string;
    demanada_per: string;
    creat_el: string;
    tasques: ElementRevisat | null;
    entregables: ElementRevisat | null;
  };
  // Cada revisió és d'una tasca o d'un entregable: `el` és el que sigui.
  const revisions = (comprova(revisionsR) as unknown as Revisio[]).map((r) => ({
    ...r,
    el: r.tasques ?? r.entregables,
    esEntregable: !r.tasques,
  }));
  const perRevisar = revisions.filter((r) => r.revisor_id === perfil.id);
  const esperant = revisions.filter((r) => r.demanada_per === perfil.id);
  // A qui puc enviar a revisar: membres actius, menys jo.
  // A qui puc passar una tasca o un entregable: membres i externs actius.
  const passables = assignables([...persones.values()]).map((p) => ({
    id: p.id,
    nom: p.nom,
    extern: p.extern,
    area: p.area,
  }));
  const revisors = membres([...persones.values()])
    .filter((p) => p.id !== perfil.id)
    .map((p) => ({ id: p.id, nom: p.nom }));

  const filesSafata = comprova(safata) as FilaSafata[];
  const filesSetmana = comprova(setmana) as unknown as TascaSetmana[];
  const filesMuts = comprova(muts) as ProjecteMut[];
  const filesIdees = comprova(idees) as { id: string; titol: string; data_objectiu: string | null }[];

  const replans = await comptaReplanificacions([
    ...filesSafata.map((f) => f.id),
    ...filesSetmana.map((t) => t.id),
  ]);

  // Agenda de la setmana: les meves tasques de projecte i les internes amb data,
  // agrupades per dia. És un calendari per veure què ve: les accions es fan a
  // «a revisar» i a «gestió interna» (abans hi eren repetides).
  type Cita = { id: string; titol: string; data: string; alta: boolean; projecte_id: string; on: string; intern: boolean };
  const cites: Cita[] = [
    ...filesSetmana.map((t) => ({
      id: t.id,
      titol: t.titol,
      data: t.data_prevista,
      alta: t.prioritat === "alta",
      projecte_id: t.projecte_id,
      on: [t.projectes?.titol, t.projectes?.clients?.nom].filter(Boolean).join(" · "),
      intern: false,
    })),
    ...internes
      .filter((t) => t.data_prevista && t.data_prevista >= hui && t.data_prevista <= fiSetmana)
      .map((t) => ({ id: t.id, titol: t.titol, data: t.data_prevista!, alta: t.prioritat === "alta", projecte_id: "", on: "gestió interna", intern: true })),
  ].sort((a, b) => a.data.localeCompare(b.data));
  const perDia = new Map<string, Cita[]>();
  for (const c of cites) perDia.set(c.data, [...(perDia.get(c.data) ?? []), c]);

  const vencuts = filesSafata.filter((f) => f.motiu === "vencut").length;
  const enRisc = filesSafata.length - vencuts;
  const internesVencudes = internes.filter((t) => t.data_prevista && t.data_prevista < hui).length;

  return (
    <>
      <div className="cap-pagina">
        <div>
          <h1>{salutacio()}, {perfil.nom}</h1>
          <div className="sub">{dataLlarga(hui)}</div>
          <nav className="pastilles" aria-label="resum">
            <Pastilla href="#a-revisar" classe="p-vencut" n={vencuts} text={vencuts === 1 ? "vençut" : "vençuts"} />
            <Pastilla href="#a-revisar" classe="p-risc" n={enRisc} text="en risc" />
            {perRevisar.length > 0 && (
              <Pastilla href="#revisions" classe="p-accent" n={perRevisar.length} text={perRevisar.length === 1 ? "revisió per fer" : "revisions per fer"} />
            )}
            {internesVencudes > 0 && (
              <Pastilla href="#intern" classe="p-vencut" n={internesVencudes} text={internesVencudes === 1 ? "interna vençuda" : "internes vençudes"} />
            )}
            <Pastilla href="#setmana" classe="p-accent" n={cites.length} text="aquesta setmana" />
            {filesMuts.length > 0 && (
              <Pastilla href="#muts" classe="p-mut" n={filesMuts.length} text={filesMuts.length === 1 ? "projecte mut" : "projectes muts"} />
            )}
          </nav>
        </div>
        <Link href="/projectes/nou" className="boto boto-primari">
          <Plus className="icona-petita" aria-hidden /> nou projecte
        </Link>
      </div>

      <div className="inici">
        <div className="inici-principal">
          <section className="seccio" id="a-revisar">
            <header>
              <span className="titol">
                a revisar
                {filesSafata.length > 0 && <span className="comptador c-vencut">{filesSafata.length}</span>}
              </span>
              <span className="flex items-center gap-2">
                <span
                  className="dreceres petit suau"
                  title="Amb una línia seleccionada (Tab o clic): ↑↓ moure's · f fet · r replanificar · v revisat · p passar · x marcar per actuar en bloc · Esc tancar"
                >
                  dreceres
                </span>
                <span className="commutador" role="group" aria-label="abast">
                  <Link href="/" aria-current={!veureTot}>els meus</Link>
                  <Link href="/?tot=1" aria-current={veureTot}>tot l&apos;equip</Link>
                </span>
              </span>
            </header>
            {filesSafata.length === 0 ? (
              <Buit text="res vençut ni a punt de vèncer">
                {!veureTot && <Link href="/?tot=1">mira els de l&apos;equip</Link>}
              </Buit>
            ) : (
              <Seleccio>
                <div className="desplacable">
                  <table className="taula taula-mobil">
                    <tbody>
                      {filesSafata.map((f) => (
                        <FilaAccionable
                          key={`${f.tipus_item}-${f.id}`}
                          taula={TAULA_DE[f.tipus_item]}
                          id={f.id}
                          estat={f.motiu === "vencut" ? "vencut" : "risc"}
                          tePrevista
                          prevista={f.data_prevista}
                          acabat={false}
                          desapareix
                          ambRevisat
                          revisors={f.tipus_item !== "fase" ? revisors : undefined}
                          persones={f.tipus_item === "fase" ? undefined : passables}
                        >
                          <td className={`num dies nowrap ${f.motiu === "vencut" ? "tag-vencut" : "tag-risc"}`}>
                            {desplacament(-f.dies_retard)}
                          </td>
                          <td className="ample element">
                            <div className="titol-el trunc" title={f.titol}>
                              {f.titol}
                              <Replanificat n={replans.get(f.id)} />
                            </div>
                            <div className="context">
                              <span>{f.tipus_item}</span>
                              <span className="sep">·</span>
                              <Link href={`/projectes/${f.projecte_id}`}>{f.projecte}</Link>
                              <span className="sep">·</span>
                              <span>{f.client}</span>
                            </div>
                          </td>
                        </FilaAccionable>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Seleccio>
            )}
          </section>

          {sensData > 0 && (
            <p className="avis-sense-data">
              {sensData === 1
                ? "Tens 1 tasca oberta sense data prevista: no pot vèncer i per això no surt a «a revisar». "
                : `Tens ${sensData} tasques obertes sense data prevista: no poden vèncer i per això no surten a «a revisar». `}
              <Link href="/feina?tot=1">Posa-hi data</Link>.
            </p>
          )}
        </div>

        <aside className="inici-lateral" aria-label="el dia a dia">
          {revisions.length > 0 && (
            <section className="seccio compacta" id="revisions">
              <header>
                <span className="titol">
                  revisions
                  {perRevisar.length > 0 && <span className="comptador c-vencut">{perRevisar.length}</span>}
                </span>
              </header>
              <table className="taula taula-mobil">
                <tbody>
                  {perRevisar.length > 0 && (
                    <tr className="dia avui"><td colSpan={3}>et toca revisar</td></tr>
                  )}
                  {perRevisar.map((r) => (
                    <FilaRevisio key={r.id} id={r.id} soc="revisor">
                      <td className="nowrap"><Persona p={persones.get(r.demanada_per)} nomesAvatar /></td>
                      <td className="ample element">
                        <div className="titol-el" title={r.el?.titol}>
                          {r.esEntregable && <span className="etiqueta mr-1">entregable</span>}
                          {r.el?.titol}
                        </div>
                        <div className="context">
                          <span>t&apos;ho demana {persones.get(r.demanada_per)?.nom}</span>
                          <span className="sep">·</span>
                          <Link href={`/projectes/${r.el?.projecte_id}`}>{r.el?.projectes?.titol}</Link>
                        </div>
                      </td>
                    </FilaRevisio>
                  ))}
                  {esperant.length > 0 && (
                    <tr className="dia"><td colSpan={3}>esperant revisió</td></tr>
                  )}
                  {esperant.map((r) => (
                    <FilaRevisio key={r.id} id={r.id} soc="demanant">
                      <td className="nowrap"><Persona p={persones.get(r.revisor_id)} nomesAvatar /></td>
                      <td className="ample element">
                        <div className="titol-el" title={r.el?.titol}>
                          {r.esEntregable && <span className="etiqueta mr-1">entregable</span>}
                          {r.el?.titol}
                        </div>
                        <div className="context">
                          <span>la revisa {persones.get(r.revisor_id)?.nom}</span>
                          <span className="sep">·</span>
                          <Link href={`/projectes/${r.el?.projecte_id}`}>{r.el?.projectes?.titol}</Link>
                        </div>
                      </td>
                    </FilaRevisio>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <SeccioXarxesInici jo={perfil.id} hui={hui} />

          <section className="seccio compacta" id="intern">
            <header>
              <span className="titol">
                gestió interna
                {internes.length > 0 && (
                  <span className={`comptador ${internesVencudes > 0 ? "c-vencut" : ""}`}>{internes.length}</span>
                )}
              </span>
              <span className="meta">el que no és de cap client</span>
            </header>
            <Formulari accio={creaTascaInterna} boto="afegir" className="en-linia alta-rapida" buidaEnDesar>
              <input
                name="titol"
                placeholder="nova tasca i Enter («… dijous», «… 12/11»)"
                title="Pots acabar amb una data: avui, demà, dijous, 12/11, d'aquí a 3 dies…"
                aria-label="nova tasca interna"
                required
                autoComplete="off"
              />
              <input name="data_prevista" type="date" aria-label="per a quan (opcional)" />
            </Formulari>
            {internes.length > 0 && (
              <table className="taula taula-mobil">
                <tbody>
                  {internes.map((t) => (
                    <FilaAccionable
                      key={t.id}
                      taula="tasques"
                      id={t.id}
                      estat={estatFila(t.data_prevista, null, "pendent", hui)}
                      tePrevista={Boolean(t.data_prevista)}
                      prevista={t.data_prevista}
                      acabat={false}
                      desapareix
                      persones={passables}
                    >
                      <td className="ample element">
                        <div className="titol-el">
                          {t.titol}
                          {t.prioritat === "alta" && <span className="etiqueta tag-vencut ml-1">alta</span>}
                        </div>
                        {t.descripcio && <div className="context descripcio">{t.descripcio}</div>}
                      </td>
                      <td className="nowrap petit">
                        {t.data_prevista ? (
                          <span className={t.data_prevista < hui ? "tag-vencut" : "suau"}>{diaRelatiuCurt(t.data_prevista, hui)}</span>
                        ) : (
                          <span className="fluix">sense data</span>
                        )}
                      </td>
                    </FilaAccionable>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="seccio compacta" id="setmana">
            <header>
              <span className="titol">
                aquesta setmana
                {cites.length > 0 && <span className="comptador">{cites.length}</span>}
              </span>
              <span className="meta">fins al {diaCurt(fiSetmana)}</span>
            </header>
            {cites.length === 0 ? (
              <p className="buit-petit">Res amb data per als propers 7 dies.</p>
            ) : (
              <ol className="agenda">
                {[...perDia].map(([dia, llista]) => (
                  <li key={dia}>
                    <div className={`agenda-dia ${dia === hui ? "avui" : ""}`}>{diaRelatiu(dia, hui)}</div>
                    <ul>
                      {llista.map((c) => (
                        <li key={c.id}>
                          <span>
                            {c.intern ? (
                              <a href="#intern">{c.titol}</a>
                            ) : (
                              <Link href={`/projectes/${c.projecte_id}`}>{c.titol}</Link>
                            )}
                            {c.alta && <span className="etiqueta tag-vencut ml-1">alta</span>}
                          </span>
                          <span className="on">{c.on}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {filesMuts.length > 0 && (
            <section className="seccio compacta" id="muts">
              <header>
                <span className="titol">
                  projectes muts <span className="comptador c-mut">{filesMuts.length}</span>
                </span>
                <span className="meta">sense contacte recent</span>
              </header>
              <ul className="llista-compacta">
                {filesMuts.map((m) => (
                  <li key={m.id} data-estat="mut">
                    <Link href={`/projectes/${m.id}`}>{m.titol}</Link>
                    <span className="on">
                      {m.client} · darrer senyal {dataCurta(m.darrer_senyal)} ({desplacament(-m.dies_silenci)})
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {moment.length > 0 && (
            <section className="seccio compacta" id="moment">
              <header>
                <span className="titol">
                  moment polític a prop
                  <span className="comptador c-risc">{moment.length}</span>
                </span>
                <span className="meta">idees sense projecte</span>
              </header>
              <ul className="llista-compacta">
                {moment.map((i) => (
                  <li key={i.id}>
                    <span className="flex items-center gap-2">
                      <Persona p={persones.get(i.proposada_per ?? "")} nomesAvatar />
                      <Link href="/idees">{i.titol}</Link>
                    </span>
                    <span className="on">
                      <span className="tag-risc">
                        {dataCurta(i.data_objectiu)} · {diesEntre(hui, i.data_objectiu) === 0 ? "avui" : `d'aquí ${diesEntre(hui, i.data_objectiu)} dies`}
                      </span>
                      {i.clients?.nom ? ` · ${i.clients.nom}` : ""} · {i.estat}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="seccio compacta">
            <header>
              <span className="titol">
                les meves idees
                {filesIdees.length > 0 && <span className="comptador">{filesIdees.length}</span>}
              </span>
              <span className="meta"><Link href="/idees">totes →</Link></span>
            </header>
            {filesIdees.length === 0 ? (
              <p className="buit-petit">
                Cap idea pendent de valorar. <Link href="/idees">Proposa&apos;n una</Link>.
              </p>
            ) : (
              <ul className="llista-compacta">
                {filesIdees.map((i) => (
                  <li key={i.id}>
                    <span>
                      <Lightbulb className="icona-petita inline mr-1 tag-risc" aria-hidden />
                      {i.titol}
                    </span>
                    {i.data_objectiu && <span className="on">per al {dataCurta(i.data_objectiu)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

function Pastilla({ href, classe, n, text }: { href: string; classe: string; n: number; text: string }) {
  return (
    <a href={href} className={`pastilla ${classe} ${n === 0 ? "p-zero" : ""}`}>
      <strong>{n}</strong> {text}
    </a>
  );
}

function Buit({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="buit">
      <CheckCircle2 className="icona" aria-hidden />
      <span>{text}</span>
      {children}
    </div>
  );
}

// "avui", "demà", "ahir" o "dj 30".
function diaRelatiuCurt(iso: string, hui: string): string {
  const d = diesEntre(hui, iso);
  if (d === 0) return "avui";
  if (d === 1) return "demà";
  if (d === -1) return "ahir";
  return diaCurt(iso);
}
