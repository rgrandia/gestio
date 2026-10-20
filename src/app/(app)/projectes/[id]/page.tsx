import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  assignables,
  comprova,
  comptaReplanificacions,
  etiquetaPersona,
  mapaPersones,
  membres,
  obtePerfils,
} from "@/lib/dades";
import { Replanificat } from "@/components/Replanificat";
import { TiraFases } from "@/components/TiraFases";
import { EnviaARevisar, EtiquetaRevisio, type DarreraRevisio } from "@/components/Revisio";
import { requereixMembre } from "@/lib/auth/session";
import { avui, dataCurta, desplacament, diesEntre } from "@/lib/dates";
import {
  actualitzaProjecte,
  creaContacte,
  creaEntregable,
  actualitzaFase,
  creaFase,
  creaTasca,
} from "@/lib/accions";
import { FilaAccionable } from "@/components/FilaAccionable";
import { Formulari } from "@/components/Formulari";
import { MouFase } from "@/components/MouFase";
import { ReplanificaProjecte } from "@/components/ReplanificaProjecte";
import { Retard, estatFila } from "@/components/Retard";
import { Persona } from "@/components/Persona";
import { ChevronRight } from "lucide-react";
import { CampCoresponsables } from "@/components/CampCoresponsables";
import { AccionsProjecte } from "@/components/AccionsProjecte";
import { EtiquetaEstat } from "@/components/EtiquetaEstat";
import type {
  Perfil,
  Contacte,
  Entregable,
  Fase,
  Projecte,
  Replanificacio,
  Tasca,
} from "@/lib/tipus";

export const dynamic = "force-dynamic";

type Pestanya = "detall" | "historial" | "editar";

export default async function DetallProjecte({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pestanya?: string; tot?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const pestanya: Pestanya =
    sp.pestanya === "historial" || sp.pestanya === "editar" ? sp.pestanya : "detall";
  const mostraTancats = sp.tot === "1";
  const hui = avui();

  const supabase = await createClient();
  const { data: projecte } = await supabase
    .from("projectes")
    .select("*, clients(id, nom), projecte_responsables(perfil_id, actiu)")
    .eq("id", id)
    .maybeSingle();
  if (!projecte) notFound();
  const p = projecte as Projecte & {
    clients: { id: string; nom: string } | null;
    projecte_responsables: { perfil_id: string; actiu: boolean }[];
  };
  const coresponsables = p.projecte_responsables
    .filter((r) => r.actiu && r.perfil_id !== p.responsable_id)
    .map((r) => r.perfil_id);

  const perfils = await obtePerfils();
  const noms = new Map(perfils.map((x) => [x.id, x.nom]));
  const persones = mapaPersones(perfils);

  const base = `/projectes/${id}`;

  return (
    <>
      <div className="cap-pagina">
        <div>
          <div className="molla">
            <Link href="/projectes">projectes</Link> /{" "}
            {p.clients ? <Link href={`/clients/${p.clients.id}`}>{p.clients.nom}</Link> : "—"}
          </div>
          <h1>{p.titol}</h1>
          <div className="sub flex gap-2 items-center mt-2">
            {p.numero_estudi && <span className="etiqueta tag-accent">núm. {p.numero_estudi}</span>}
            <span className={`etiqueta ${p.tipus === "estudi" ? "tag-accent" : ""}`}>{p.tipus}</span>
            {p.subtipus && <span className="etiqueta">{p.subtipus}</span>}
            <EtiquetaEstat estat={p.estat} />
            {p.arxivat_el && <span className="etiqueta tag-mut">arxivat</span>}
            {p.eliminat_el && <span className="etiqueta tag-vencut">a la paperera</span>}
          </div>
        </div>
        <AccionsProjecte id={p.id} titol={p.titol} arxivat={Boolean(p.arxivat_el)} eliminat={Boolean(p.eliminat_el)} />
      </div>

      {p.eliminat_el && (
        <p className="notes avis-vencut">
          Aquest projecte és a la paperera des del {dataCurta(p.eliminat_el.slice(0, 10))}
          {p.eliminat_per && noms.get(p.eliminat_per) ? ` (l'hi va enviar ${noms.get(p.eliminat_per)})` : ""}. No surt
          enlloc més. Restaura&apos;l si ha estat un error.
        </p>
      )}
      {p.arxivat_el && !p.eliminat_el && (
        <p className="notes avis-mut">
          Projecte arxivat el {dataCurta(p.arxivat_el.slice(0, 10))}: no surt a la safata ni a les llistes.
        </p>
      )}

      <dl className="capcalera">
        <div>
          <dt>{coresponsables.length ? "responsables" : "responsable"}</dt>
          <dd>
            <Persona p={persones.get(p.responsable_id)} />
            {coresponsables.map((id) => <Persona key={id} p={persones.get(id)} />)}
          </dd>
        </div>
        <div>
          <dt>inici</dt>
          <dd>{dataCurta(p.data_inici)}</dd>
        </div>
        <div>
          <dt>fi prevista</dt>
          <dd>
            {dataCurta(p.data_fi_prevista)}
            {!p.data_fi_real && p.data_fi_prevista && <Retard prevista={p.data_fi_prevista} real={null} hui={hui} />}
            {p.estat === "actiu" && <ReplanificaProjecte id={p.id} tePrevista={Boolean(p.data_fi_prevista)} />}
          </dd>
        </div>
        <div>
          <dt>fi real</dt>
          <dd>
            {dataCurta(p.data_fi_real)}
            {p.data_fi_real && <Retard prevista={p.data_fi_prevista} real={p.data_fi_real} hui={hui} />}
          </dd>
        </div>
        {p.tipus === "consultoria" && (
          <div>
            <dt>silenci màxim</dt>
            <dd>{p.dies_silenci_max} dies</dd>
          </div>
        )}
      </dl>
      {p.notes && <p className="prosa notes">{p.notes}</p>}

      <nav className="pestanyes" aria-label="seccions del projecte">
        <Link href={base} aria-current={pestanya === "detall" ? "page" : undefined}>detall</Link>
        <Link href={`${base}?pestanya=historial`} aria-current={pestanya === "historial" ? "page" : undefined}>
          historial de replanificacions
        </Link>
        <Link href={`${base}?pestanya=editar`} aria-current={pestanya === "editar" ? "page" : undefined}>editar</Link>
      </nav>

      {pestanya === "historial" && <Historial projecteId={id} />}
      {pestanya === "editar" && <Editar p={p} perfils={perfils} coresponsables={coresponsables} />}
      {pestanya === "detall" && (
        <Detall p={p} hui={hui} persones={persones} perfils={perfils} mostraTancats={mostraTancats} base={base} />
      )}
    </>
  );
}

async function Detall({
  p,
  persones,
  hui,
  perfils,
  mostraTancats,
  base,
}: {
  p: Projecte;
  hui: string;
  persones: Map<string, Perfil>;
  perfils: Perfil[];
  mostraTancats: boolean;
  base: string;
}) {
  const supabase = await createClient();
  const [fasesR, entregablesR, tasquesR, contactesR] = await Promise.all([
    supabase.from("fases").select("*").eq("projecte_id", p.id).order("ordre"),
    supabase.from("entregables").select("*").eq("projecte_id", p.id).order("data_prevista", { nullsFirst: false }),
    supabase
      .from("tasques")
      .select("*")
      .eq("projecte_id", p.id)
      .order("data_prevista", { nullsFirst: false })
      .order("creat_el"),
    p.tipus === "consultoria"
      ? supabase.from("contactes").select("*").eq("projecte_id", p.id).order("data", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  const fases = comprova(fasesR) as Fase[];
  const entregablesTots = comprova(entregablesR) as Entregable[];
  const tasquesTotes = comprova(tasquesR) as Tasca[];
  const contactes = comprova(contactesR) as Contacte[];
  const [replans, revisionsR, jo] = await Promise.all([
    comptaReplanificacions([
      ...fases.map((x) => x.id),
      ...entregablesTots.map((x) => x.id),
      ...tasquesTotes.map((x) => x.id),
    ]),
    supabase
      .from("revisions")
      .select("tasca_id, estat, revisor_id, comentari, creat_el")
      .in("tasca_id", tasquesTotes.map((t) => t.id))
      .order("creat_el", { ascending: false }),
    requereixMembre(),
  ]);
  // Darrera revisió de cada tasca.
  const revisions = new Map<string, DarreraRevisio>();
  for (const r of (revisionsR.data ?? []) as {
    tasca_id: string;
    estat: DarreraRevisio["estat"];
    revisor_id: string;
    comentari: string | null;
  }[]) {
    if (!revisions.has(r.tasca_id))
      revisions.set(r.tasca_id, { estat: r.estat, revisor: persones.get(r.revisor_id)?.nom ?? "?", comentari: r.comentari });
  }
  const revisors = membres(perfils)
    .filter((x) => x.id !== jo.id)
    .map((x) => ({ id: x.id, nom: x.nom }));

  // Cancel·lats i fets fora per defecte (tasques i entregables), amb filtre per recuperar-los.
  const visible = (x: { estat: string; data_real: string | null }) =>
    mostraTancats || (x.estat !== "cancellat" && !x.data_real);
  const entregables = entregablesTots.filter(visible);
  const tasques = tasquesTotes.filter(visible);
  const amagats =
    entregablesTots.length - entregables.length + (tasquesTotes.length - tasques.length);

  const nomFase = new Map(fases.map((f) => [f.id, f.nom]));
  const nomEntregable = new Map(entregablesTots.map((e) => [e.id, e.titol]));

  return (
    <>
      {p.tipus === "estudi" && (
        <section className="seccio">
          <header>
            <span className="titol">fases</span>
            <span className="meta">les actualitza el responsable del projecte; l&apos;app no sap si una fase ha acabat</span>
          </header>
          <TiraFases fases={fases} hui={hui} />
          <div className="desplacable">
            <table className="taula taula-fases">
              <thead>
                <tr>
                  <th></th>
                  <th>fase</th>
                  <th>qui la fa</th>
                  <th className="num">inici</th>
                  <th className="num">final previst</th>
                  <th className="num">real</th>
                  <th className="num">retard</th>
                  <th></th>
                </tr>
              </thead>
              {fases.map((f, i) => {
                const tasquesFase = tasquesTotes.filter((t) => t.fase_id === f.id);
                const obertes = tasquesFase.filter((t) => !t.data_real && t.estat !== "cancellat").length;
                const qui = f.responsable_id ?? p.responsable_id;
                return (
                  // Un tbody per fase: la fila i el seu desplegable van junts.
                  <tbody key={f.id} className="fase">
                    <FilaAccionable
                      taula="fases"
                      id={f.id}
                      estat={estatFila(f.data_prevista, f.data_real, f.estat, hui)}
                      tePrevista={Boolean(f.data_prevista)}
                      acabat={Boolean(f.data_real) || f.estat === "cancellat"}
                    >
                      <td className="nowrap">
                        <input type="checkbox" id={`desplega-${f.id}`} className="desplega" />
                        <label htmlFor={`desplega-${f.id}`} className="boto boto-suau boto-icona" title="tasques i detalls de la fase">
                          <ChevronRight className="icona-petita fletxa" aria-hidden />
                          <span className="sr-only">desplega {f.nom}</span>
                        </label>
                        <MouFase id={f.id} primera={i === 0} darrera={i === fases.length - 1} />
                      </td>
                      <td className="element">
                        <div className="titol-el">
                          {f.nom}
                          <Replanificat n={replans.get(f.id)} />
                        </div>
                        <div className="context">
                          {tasquesFase.length === 0
                            ? "cap tasca"
                            : `${tasquesFase.length} ${tasquesFase.length === 1 ? "tasca" : "tasques"}${obertes ? ` · ${obertes} obertes` : ""}`}
                          {f.estat === "cancellat" && " · cancel·lada"}
                        </div>
                      </td>
                      <td>
                        <Persona p={persones.get(qui)} />
                        
                      </td>
                      <td className="num">{dataCurta(f.data_inici)}</td>
                      <td className="num">{dataCurta(f.data_prevista)}</td>
                      <td className="num">{dataCurta(f.data_real)}</td>
                      <td className="num">
                        {f.estat !== "cancellat" && <Retard prevista={f.data_prevista} real={f.data_real} hui={hui} />}
                      </td>
                    </FilaAccionable>
                    <tr className="fase-detall">
                      <td colSpan={9}>
                        <div className="fase-panell">
                          {tasquesFase.length === 0 ? (
                            <p className="suau petit">Aquesta fase encara no té tasques.</p>
                          ) : (
                            <table className="taula taula-interior">
                              <tbody>
                                {tasquesFase.map((t) => (
                                  <tr key={t.id} data-estat={estatFila(t.data_prevista, t.data_real, t.estat, hui)}>
                                    <td className="ample">
                                      {t.titol}{" "}
                                      {t.prioritat === "alta" && <span className="etiqueta tag-vencut">alta</span>}
                                      <Replanificat n={replans.get(t.id)} />
                                    </td>
                                    <td><Persona p={persones.get(t.assignada_a ?? "")} /></td>
                                    <td className="num">{dataCurta(t.data_prevista)}</td>
                                    <td className="num">
                                      {t.estat === "cancellat" ? (
                                        <EtiquetaEstat estat="cancellat" />
                                      ) : (
                                        <Retard prevista={t.data_prevista} real={t.data_real} hui={hui} />
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                          <div className="fase-forms">
                            <Formulari accio={creaTasca} boto="afegir tasca" className="flex flex-wrap gap-2 items-center" buidaEnDesar>
                              <input type="hidden" name="projecte_id" value={p.id} />
                              <input type="hidden" name="ancora" value={`fase:${f.id}`} />
                              <input name="titol" placeholder={`nova tasca de ${f.nom.toLowerCase()}`} aria-label="títol" required />
                              <SelectPersona nom="assignada_a" perfils={perfils} buit="sense assignar" />
                              <input name="data_prevista" type="date" aria-label="data prevista" />
                            </Formulari>
                            <Formulari accio={actualitzaFase} boto="desar fase" className="flex flex-wrap gap-2 items-center">
                              <input type="hidden" name="id" value={f.id} />
                              <input type="hidden" name="projecte_id" value={p.id} />
                              <label className="petit suau flex items-center gap-2">
                                inici
                                <input name="data_inici" type="date" defaultValue={f.data_inici ?? ""} aria-label="inici de la fase" />
                              </label>
                              <label className="petit suau flex items-center gap-2">
                                qui la fa
                                <SelectPersona
                                  nom="responsable_id"
                                  perfils={perfils}
                                  valor={f.responsable_id ?? ""}
                                  buit="el responsable del projecte"
                                />
                              </label>
                            </Formulari>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                );
              })}
            </table>
          </div>
          <Formulari accio={creaFase} boto="afegir fase" className="en-linia" buidaEnDesar>
            <input type="hidden" name="projecte_id" value={p.id} />
            <input name="nom" placeholder="nova fase" aria-label="nom de la fase" required />
            <label className="petit suau flex items-center gap-2">
              inici <input name="data_inici" type="date" aria-label="inici" />
            </label>
            <label className="petit suau flex items-center gap-2">
              final <input name="data_prevista" type="date" aria-label="final previst" />
            </label>
          </Formulari>
        </section>
      )}

      {(p.tipus !== "estudi" || entregablesTots.length > 0) && (
        <section className="seccio">
          <header>
            <span className="titol">entregables</span>
            <span className="meta">{entregables.length} oberts</span>
          </header>
          {entregables.length === 0 ? (
            <div className="buit">cap entregable obert</div>
          ) : (
            <div className="desplacable">
              <table className="taula">
                <thead>
                  <tr>
                    <th>entregable</th>
                    <th>tipus</th>
                    <th>responsable</th>
                    <th className="num">previst</th>
                    <th className="num">real</th>
                    <th className="num">retard</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {entregables.map((e) => (
                    <FilaAccionable
                      key={e.id}
                      taula="entregables"
                      id={e.id}
                      estat={estatFila(e.data_prevista, e.data_real, e.estat, hui)}
                      tePrevista={Boolean(e.data_prevista)}
                      acabat={Boolean(e.data_real) || e.estat === "cancellat"}
                    >
                      <td>
                        {e.enllac ? (
                          <a href={e.enllac} target="_blank" rel="noopener noreferrer">{e.titol}</a>
                        ) : (
                          e.titol
                        )}
                        <Replanificat n={replans.get(e.id)} />
                      </td>
                      <td className="suau">{e.tipus ?? ""}</td>
                      <td><Persona p={persones.get(e.responsable_id ?? p.responsable_id)} /></td>
                      <td className="num">{dataCurta(e.data_prevista)}</td>
                      <td className="num">{dataCurta(e.data_real)}</td>
                      <td className="num">
                        {e.estat !== "cancellat" && <Retard prevista={e.data_prevista} real={e.data_real} hui={hui} />}
                      </td>
                    </FilaAccionable>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Formulari accio={creaEntregable} boto="afegir entregable" className="en-linia" buidaEnDesar>
            <input type="hidden" name="projecte_id" value={p.id} />
            <input name="titol" placeholder="nou entregable" aria-label="títol" required />
            <select name="tipus" aria-label="tipus" defaultValue="">
              <option value="">tipus</option>
              {["informe", "discurs", "nota", "pla", "altre"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input name="data_prevista" type="date" aria-label="data prevista" />
            <select name="responsable_id" aria-label="responsable" defaultValue="">
              <option value="">responsable del projecte</option>
              {assignables(perfils).map((x) => <option key={x.id} value={x.id}>{etiquetaPersona(x)}</option>)}
            </select>
            <input name="enllac" type="url" placeholder="https:// (SharePoint/Drive)" aria-label="enllaç" />
          </Formulari>
        </section>
      )}

      {p.tipus === "consultoria" && (
        <section className="seccio">
          <header>
            <span className="titol">contactes</span>
            <span className="meta">
              darrer: {contactes[0] ? dataCurta(contactes[0].data) : "cap"}
            </span>
          </header>
          {contactes.length === 0 ? (
            <div className="buit">cap contacte registrat</div>
          ) : (
            <table className="taula">
              <tbody>
                {contactes.map((c) => (
                  <tr key={c.id}>
                    <td className="num nowrap">{dataCurta(c.data)}</td>
                    <td className="suau nowrap">{c.tipus ?? ""}</td>
                    <td className="font-sans">{c.resum ?? ""}</td>
                    <td className="nowrap"><Persona p={persones.get(c.usuari_id ?? "")} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Formulari accio={creaContacte} boto="registrar contacte" className="en-linia" buidaEnDesar>
            <input type="hidden" name="projecte_id" value={p.id} />
            <input name="data" type="date" defaultValue={hui} max={hui} aria-label="data" required />
            <select name="tipus" aria-label="tipus" defaultValue="reunio">
              {["reunio", "trucada", "correu", "presentacio"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input name="resum" placeholder="resum breu" aria-label="resum" className="font-sans flex-1" />
          </Formulari>
        </section>
      )}

      <section className="seccio">
        <header>
          <span className="titol">tasques</span>
          <span className="meta">
            {amagats > 0 || mostraTancats ? (
              mostraTancats ? (
                <Link href={base}>amaga fetes i cancel·lades</Link>
              ) : (
                <Link href={`${base}?tot=1`}>mostra {amagats} fetes o cancel·lades</Link>
              )
            ) : null}
          </span>
        </header>
        {tasques.length === 0 ? (
          <div className="buit">cap tasca oberta</div>
        ) : (
          <div className="desplacable">
            <table className="taula">
              <thead>
                <tr>
                  <th>tasca</th>
                  <th>penja de</th>
                  <th>assignada a</th>
                  <th className="num">previst</th>
                  <th className="num">real</th>
                  <th className="num">retard</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tasques.map((t) => (
                  <FilaAccionable
                    key={t.id}
                    taula="tasques"
                    id={t.id}
                    estat={estatFila(t.data_prevista, t.data_real, t.estat, hui)}
                    tePrevista={Boolean(t.data_prevista)}
                    acabat={Boolean(t.data_real) || t.estat === "cancellat"}
                    revisors={revisors}
                  >
                    <td>
                      {t.titol}
                      {t.prioritat === "alta" && <span className="etiqueta tag-vencut ml-1">alta</span>}
                      <Replanificat n={replans.get(t.id)} />
                      <EtiquetaRevisio r={revisions.get(t.id)} />
                      {t.data_real && revisions.get(t.id)?.estat !== "pendent" && (
                        <EnviaARevisar tascaId={t.id} revisors={revisors} />
                      )}
                    </td>
                    <td className="suau">
                      {t.fase_id ? nomFase.get(t.fase_id) : t.entregable_id ? nomEntregable.get(t.entregable_id) : ""}
                    </td>
                    <td><Persona p={persones.get(t.assignada_a ?? "")} /></td>
                    <td className="num">{dataCurta(t.data_prevista)}</td>
                    <td className="num">{dataCurta(t.data_real)}</td>
                    <td className="num">
                      {t.estat !== "cancellat" && <Retard prevista={t.data_prevista} real={t.data_real} hui={hui} />}
                    </td>
                  </FilaAccionable>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Formulari accio={creaTasca} boto="afegir tasca" className="en-linia" buidaEnDesar>
          <input type="hidden" name="projecte_id" value={p.id} />
          <input name="titol" placeholder="nova tasca" aria-label="títol" required />
          <select name="assignada_a" aria-label="assignada a" defaultValue="">
            <option value="">sense assignar</option>
            {assignables(perfils).map((x) => <option key={x.id} value={x.id}>{etiquetaPersona(x)}</option>)}
          </select>
          <input name="data_prevista" type="date" aria-label="data prevista" />
          <select name="ancora" aria-label="penja de" defaultValue="">
            <option value="">del projecte</option>
            {fases.filter((f) => f.estat !== "cancellat").map((f) => (
              <option key={f.id} value={`fase:${f.id}`}>fase: {f.nom}</option>
            ))}
            {entregablesTots.filter((e) => e.estat !== "cancellat").map((e) => (
              <option key={e.id} value={`entregable:${e.id}`}>entregable: {e.titol}</option>
            ))}
          </select>
          <select name="prioritat" aria-label="prioritat" defaultValue="normal">
            <option value="alta">alta</option>
            <option value="normal">normal</option>
            <option value="baixa">baixa</option>
          </select>
        </Formulari>
      </section>
    </>
  );
}

async function Historial({ projecteId }: { projecteId: string }) {
  const supabase = await createClient();
  const files = comprova(
    await supabase
      .from("v_historial_projecte")
      .select("*")
      .eq("projecte_id", projecteId)
      .order("creat_el", { ascending: false }),
  ) as Replanificacio[];

  if (files.length === 0) return <section className="seccio"><div className="buit">cap canvi de data registrat</div></section>;

  const nomTaula: Record<string, string> = {
    projectes: "projecte",
    fases: "fase",
    entregables: "entregable",
    tasques: "tasca",
  };

  return (
    <section className="seccio">
    <div className="desplacable">
      <table className="taula">
        <thead>
          <tr>
            <th className="num">quan</th>
            <th>element</th>
            <th className="num">de</th>
            <th className="num">a</th>
            <th className="num">canvi</th>
            <th>motiu</th>
            <th>qui</th>
          </tr>
        </thead>
        <tbody>
          {files.map((h) => (
            <tr key={h.id}>
              <td className="num nowrap">{dataCurta(h.creat_el.slice(0, 10))}</td>
              <td>
                {h.element} <span className="petit suau">{nomTaula[h.taula] ?? h.taula}</span>
              </td>
              <td className="num">{dataCurta(h.data_antiga)}</td>
              <td className="num">{dataCurta(h.data_nova)}</td>
              <td className="num">
                {h.data_antiga && h.data_nova ? (
                  <span className={`dies ${h.data_nova > h.data_antiga ? "tag-vencut" : "tag-fet"}`}>
                    {desplacament(diesEntre(h.data_antiga, h.data_nova))}
                  </span>
                ) : (
                  <span className="fluix">—</span>
                )}
              </td>
              <td className="font-sans">{h.motiu}</td>
              <td className="suau nowrap">{h.usuari ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </section>
  );
}

function Editar({ p, perfils, coresponsables }: { p: Projecte; perfils: Perfil[]; coresponsables: string[] }) {
  return (
    <Formulari accio={actualitzaProjecte} boto="desar canvis">
      <input type="hidden" name="id" value={p.id} />
      <div className="grid gap-4" style={{ gridTemplateColumns: "120px 1fr" }}>
        <label>
          núm. d&apos;estudi
          <input
            name="numero_estudi"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            placeholder="0000"
            defaultValue={p.numero_estudi ?? ""}
          />
        </label>
        <label>
          títol
          <input name="titol" required defaultValue={p.titol} />
        </label>
      </div>
      <div className="fila-camps">
        <label>
          subtipus
          <input name="subtipus" defaultValue={p.subtipus ?? ""} />
        </label>
        <label>
          responsable principal
          <select name="responsable_id" defaultValue={p.responsable_id}>
            {membres(perfils).map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}
          </select>
        </label>
        <label>
          estat
          <select name="estat" defaultValue={p.estat}>
            {["actiu", "pausat", "tancat", "cancellat"].map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </label>
      </div>
      <CampCoresponsables membres={membres(perfils)} marcats={coresponsables} />
      <div className="fila-camps">
        <label>
          data d&apos;inici
          <input name="data_inici" type="date" defaultValue={p.data_inici ?? ""} />
        </label>
        <label>
          fi real
          <input name="data_fi_real" type="date" defaultValue={p.data_fi_real ?? ""} />
        </label>
        <label>
          dies de silenci màx.
          <input name="dies_silenci_max" type="number" min={1} defaultValue={p.dies_silenci_max} />
        </label>
      </div>
      <p className="petit suau">
        La fi prevista es canvia amb «replanificar» a la capçalera, perquè quedi a l&apos;historial.
      </p>
      <label>
        notes
        <textarea name="notes" rows={4} defaultValue={p.notes ?? ""} />
      </label>
    </Formulari>
  );
}

// Desplegable de persones: membres primer i externs marcats.
function SelectPersona({
  nom,
  perfils,
  valor,
  buit,
}: {
  nom: string;
  perfils: Perfil[];
  valor?: string;
  buit: string;
}) {
  const llista = assignables(perfils);
  return (
    <select name={nom} defaultValue={valor ?? ""} aria-label={nom === "responsable_id" ? "qui la fa" : "assignada a"}>
      <option value="">{buit}</option>
      <optgroup label="equip">
        {llista.filter((x) => !x.extern).map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}
      </optgroup>
      {llista.some((x) => x.extern) && (
        <optgroup label="externs (sense accés)">
          {llista.filter((x) => x.extern).map((x) => <option key={x.id} value={x.id}>{etiquetaPersona(x)}</option>)}
        </optgroup>
      )}
    </select>
  );
}
