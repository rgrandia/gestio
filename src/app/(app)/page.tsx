import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Hourglass,
  Lightbulb,
  MessageSquareOff,
  Plus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requereixMembre } from "@/lib/auth/session";
import { Fragment } from "react";
import { assignables, comprova, comptaReplanificacions, membres, obtePersones } from "@/lib/dades";
import { FilaRevisio } from "@/components/FilaRevisio";
import { Persona } from "@/components/Persona";
import { Replanificat } from "@/components/Replanificat";
import { avui, dataCurta, dataLlarga, desplacament, diaCurt, diaRelatiu, diesEntre, salutacio, sumaDies } from "@/lib/dates";
import { FilaAccionable } from "@/components/FilaAccionable";
import { Formulari } from "@/components/Formulari";
import { Seleccio } from "@/components/Seleccio";
import { Retard, estatFila } from "@/components/Retard";
import { creaTascaInterna } from "@/lib/accions";
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

  // Agenda: tasques de la setmana agrupades per dia.
  const perDia = new Map<string, TascaSetmana[]>();
  for (const t of filesSetmana) perDia.set(t.data_prevista, [...(perDia.get(t.data_prevista) ?? []), t]);

  const vencuts = filesSafata.filter((f) => f.motiu === "vencut").length;
  const enRisc = filesSafata.length - vencuts;

  return (
    <>
      <div className="cap-pagina">
        <div>
          <h1>{salutacio()}, {perfil.nom}</h1>
          <div className="sub">{dataLlarga(hui)}</div>
        </div>
        <Link href="/projectes/nou" className="boto boto-primari">
          <Plus className="icona-petita" aria-hidden /> nou projecte
        </Link>
      </div>

      <div className="xifres">
        <Xifra href="#a-revisar" classe="x-vencut" valor={vencuts} etiqueta="vençuts" nota="data prevista passada"
          icona={<AlertTriangle className="icona-petita" aria-hidden />} />
        <Xifra href="#a-revisar" classe="x-risc" valor={enRisc} etiqueta="en risc" nota="vencen en 5 dies"
          icona={<Hourglass className="icona-petita" aria-hidden />} />
        <Xifra href="#muts" classe="x-mut" valor={filesMuts.length} etiqueta="projectes muts" nota="sense contacte recent"
          icona={<MessageSquareOff className="icona-petita" aria-hidden />} />
        <Xifra href="#setmana" classe="x-accent" valor={filesSetmana.length} etiqueta="aquesta setmana"
          nota={`tasques fins al ${diaCurt(fiSetmana)}`} icona={<CalendarDays className="icona-petita" aria-hidden />} />
      </div>

      <section className="seccio" id="a-revisar">
        <header>
          <span className="titol">
            a revisar
            {filesSafata.length > 0 && <span className="comptador c-vencut">{filesSafata.length}</span>}
          </span>
          <span
            className="dreceres petit suau"
            title="Amb una línia seleccionada (Tab o clic): ↑↓ moure's · f fet · r replanificar · v revisat · p passar · x marcar per actuar en bloc · Esc tancar"
          >
            dreceres de teclat
          </span>
          <span className="commutador" role="group" aria-label="abast">
            <Link href="/" aria-current={!veureTot}>els meus</Link>
            <Link href="/?tot=1" aria-current={veureTot}>tot l&apos;equip</Link>
          </span>
        </header>
        {filesSafata.length === 0 ? (
          <Buit text="cap element a revisar">
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
                    <td className="nowrap">
                      <span className={`etiqueta ${f.motiu === "vencut" ? "tag-vencut" : "tag-risc"}`}>
                        {f.motiu === "vencut" ? "vençut" : "risc"}
                      </span>
                    </td>
                    <td className={`num dies ${f.motiu === "vencut" ? "tag-vencut" : "tag-risc"}`}>
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

      <section className="seccio" id="intern">
        <header>
          <span className="titol">
            gestió interna
            {internes.length > 0 && (
              <span className={`comptador ${internes.some((t) => t.data_prevista && t.data_prevista < hui) ? "c-vencut" : ""}`}>
                {internes.length}
              </span>
            )}
          </span>
          <span className="meta">el dia a dia que no és de cap client</span>
        </header>
        <Formulari accio={creaTascaInterna} boto="afegir" className="en-linia alta-rapida" buidaEnDesar>
          <input
            name="titol"
            placeholder="nova tasca interna i Enter (pots acabar amb «demà», «dijous», «12/11»…)"
            aria-label="nova tasca interna"
            required
            autoComplete="off"
          />
          <input name="data_prevista" type="date" aria-label="per a quan (opcional)" />
        </Formulari>
        {internes.length > 0 && (
          <div className="desplacable">
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
                    <td className="num nowrap">{t.data_prevista ? diaRelatiuCurt(t.data_prevista, hui) : <span className="fluix">sense data</span>}</td>
                    <td className="num nowrap"><Retard prevista={t.data_prevista} real={null} hui={hui} /></td>
                  </FilaAccionable>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {revisions.length > 0 && (
        <section className="seccio" id="revisions">
          <header>
            <span className="titol">
              revisions
              {perRevisar.length > 0 && <span className="comptador c-vencut">{perRevisar.length}</span>}
            </span>
            <span className="meta">tasques i entregables fets que algú ha de revisar</span>
          </header>
          <div className="desplacable">
            <table className="taula taula-mobil">
              <tbody>
                {perRevisar.length > 0 && (
                  <tr className="dia avui"><td colSpan={3}>et toca revisar</td></tr>
                )}
                {perRevisar.map((r) => (
                  <FilaRevisio key={r.id} id={r.id} soc="revisor">
                    <td className="nowrap"><Persona p={persones.get(r.demanada_per)} nomesAvatar /></td>
                    <td className="ample element">
                      <div className="titol-el trunc" title={r.el?.titol}>
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
                      <div className="titol-el trunc" title={r.el?.titol}>
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
          </div>
        </section>
      )}

      <section className="seccio" id="setmana">
        <header>
          <span className="titol">
            aquesta setmana
            {filesSetmana.length > 0 && <span className="comptador">{filesSetmana.length}</span>}
          </span>
          <span className="meta">les meves tasques fins al {dataCurta(fiSetmana)}</span>
        </header>
        {filesSetmana.length === 0 ? (
          <Buit text="cap tasca assignada per als propers 7 dies">
            <Link href="/projectes">afegeix-ne des d&apos;un projecte</Link>
          </Buit>
        ) : (
          <div className="desplacable">
            <table className="taula taula-mobil">
              <tbody>
                {[...perDia].map(([dia, tasques]) => (
                  <Fragment key={dia}>
                    <tr className={`dia ${dia === hui ? "avui" : ""}`}>
                      <td colSpan={3}>{diaRelatiu(dia, hui)}</td>
                    </tr>
                    {tasques.map((t) => (
                      <FilaAccionable key={t.id} taula="tasques" id={t.id} tePrevista prevista={t.data_prevista} acabat={false} desapareix revisors={revisors} persones={passables}>
                        <td className="ample element">
                          <div className="titol-el trunc" title={t.titol}>
                            {t.titol}{" "}
                            {t.prioritat === "alta" && <span className="etiqueta tag-vencut">alta</span>}
                            <Replanificat n={replans.get(t.id)} />
                          </div>
                          <div className="context">
                            <Link href={`/projectes/${t.projecte_id}`}>{t.projectes?.titol}</Link>
                            <span className="sep">·</span>
                            <span>{t.projectes?.clients?.nom}</span>
                          </div>
                        </td>
                      </FilaAccionable>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {filesMuts.length > 0 && (
        <section className="seccio" id="muts">
          <header>
            <span className="titol">
              projectes muts <span className="comptador c-mut">{filesMuts.length}</span>
            </span>
            <span className="meta">consultories sense contacte ni entregable recent</span>
          </header>
          <div className="desplacable">
            <table className="taula taula-mobil">
              <tbody>
                {filesMuts.map((m) => (
                  <tr key={m.id} data-estat="mut">
                    <td className="nowrap"><span className="etiqueta tag-mut">mut</span></td>
                    <td className="num dies tag-mut">{desplacament(-m.dies_silenci)}</td>
                    <td className="ample element">
                      <div className="titol-el"><Link href={`/projectes/${m.id}`}>{m.titol}</Link></div>
                      <div className="context">
                        <span>{m.client}</span>
                        <span className="sep">·</span>
                        <span>darrer senyal {dataCurta(m.darrer_senyal)}</span>
                        <span className="sep">·</span>
                        <span>llindar {m.dies_silenci_max} dies</span>
                      </div>
                    </td>
                    <td className="accions">
                      <Link href={`/projectes/${m.id}`} className="boto">registrar contacte</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {moment.length > 0 && (
        <section className="seccio" id="moment">
          <header>
            <span className="titol">
              moment polític a prop
              <span className="comptador c-risc">{moment.length}</span>
            </span>
            <span className="meta">idees de l&apos;equip amb data objectiu en 30 dies i encara sense projecte</span>
          </header>
          <table className="taula taula-mobil">
            <tbody>
              {moment.map((i) => (
                <tr key={i.id}>
                  <td className="nowrap"><Persona p={persones.get(i.proposada_per ?? "")} nomesAvatar /></td>
                  <td className="ample element">
                    <div className="titol-el">
                      <Lightbulb className="icona-petita inline mr-1 tag-risc" aria-hidden />
                      <Link href="/idees">{i.titol}</Link>
                    </div>
                    <div className="context">
                      <span>{i.estat}</span>
                      {i.clients?.nom && (
                        <>
                          <span className="sep">·</span>
                          <span>{i.clients.nom}</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="num nowrap tag-risc">
                    {dataCurta(i.data_objectiu)} · {diesEntre(hui, i.data_objectiu) === 0 ? "avui" : `d'aquí ${diesEntre(hui, i.data_objectiu)} dies`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="seccio">
        <header>
          <span className="titol">
            les meves idees
            {filesIdees.length > 0 && <span className="comptador">{filesIdees.length}</span>}
          </span>
          <span className="meta"><Link href="/idees">totes les idees →</Link></span>
        </header>
        {filesIdees.length === 0 ? (
          <Buit text="cap idea proposada pendent de valorar">
            <Link href="/idees">proposa&apos;n una</Link>
          </Buit>
        ) : (
          <table className="taula taula-mobil">
            <tbody>
              {filesIdees.map((i) => (
                <tr key={i.id}>
                  <td className="ample element">
                    <div className="titol-el">
                      <Lightbulb className="icona-petita inline mr-1 tag-risc" aria-hidden />
                      {i.titol}
                    </div>
                  </td>
                  <td className="num suau">{i.data_objectiu ? `per al ${dataCurta(i.data_objectiu)}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function Xifra({
  href,
  classe,
  valor,
  etiqueta,
  nota,
  icona,
}: {
  href: string;
  classe: string;
  valor: number;
  etiqueta: string;
  nota: string;
  icona: React.ReactNode;
}) {
  return (
    <a href={href} className={`xifra ${classe} ${valor === 0 ? "x-zero" : ""}`}>
      <div className="etiq">{icona} {etiqueta}</div>
      <div className="valor">{valor}</div>
      <div className="nota">{nota}</div>
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
