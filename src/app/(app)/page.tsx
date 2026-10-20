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
import { comprova, comptaReplanificacions } from "@/lib/dades";
import { Replanificat } from "@/components/Replanificat";
import { avui, dataCurta, dataLlarga, desplacament, diaCurt, diaRelatiu, salutacio, sumaDies } from "@/lib/dates";
import { FilaAccionable } from "@/components/FilaAccionable";
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
    .order("projecte");
  if (!veureTot) consultaSafata = consultaSafata.contains("responsables", [perfil.id]);

  const [safata, setmana, muts, idees] = await Promise.all([
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
  ]);

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
                    acabat={false}
                    desapareix
                    ambRevisat
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
        )}
      </section>

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
                      <FilaAccionable key={t.id} taula="tasques" id={t.id} tePrevista acabat={false} desapareix>
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
