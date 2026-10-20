import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requereixMembre } from "@/lib/auth/session";
import { comprova } from "@/lib/dades";
import { avui, dataCurta, dataLlarga, desplacament, diaCurt, salutacio, sumaDies } from "@/lib/dates";
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
  const supabase = await createClient();

  let consultaSafata = supabase
    .from("v_safata")
    .select("*")
    .order("data_prevista")
    .order("projecte");
  if (!veureTot) consultaSafata = consultaSafata.eq("responsable_id", perfil.id);

  const [safata, setmana, muts, idees] = await Promise.all([
    consultaSafata,
    supabase
      .from("tasques")
      .select("id, titol, data_prevista, prioritat, projecte_id, projectes!inner(titol, estat, clients(nom))")
      .eq("assignada_a", perfil.id)
      .is("data_real", null)
      .not("estat", "in", "(fet,cancellat)")
      .eq("projectes.estat", "actiu")
      .gte("data_prevista", hui)
      .lte("data_prevista", sumaDies(hui, 7))
      .order("data_prevista"),
    supabase.from("v_projectes_muts").select("*").eq("responsable_id", perfil.id).order("darrer_senyal"),
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

  const vencuts = filesSafata.filter((f) => f.motiu === "vencut").length;
  const enRisc = filesSafata.length - vencuts;

  return (
    <>
      <div className="cap-pagina">
        <h1>{salutacio()}, {perfil.nom}</h1>
        <div className="data">{dataLlarga(hui)}</div>
        <div className="resum">
          {filesSafata.length === 0 && filesMuts.length === 0 ? (
            <span className="r-ok">res pendent de revisar</span>
          ) : (
            <>
              {vencuts > 0 && <a href="#a-revisar" className="r-vencut"><b>{vencuts}</b> vençuts</a>}
              {enRisc > 0 && <a href="#a-revisar" className="r-risc"><b>{enRisc}</b> en risc</a>}
              {filesMuts.length > 0 && <a href="#muts" className="r-mut"><b>{filesMuts.length}</b> {filesMuts.length === 1 ? "projecte mut" : "projectes muts"}</a>}
            </>
          )}
          <a href="#setmana"><b>{filesSetmana.length}</b> {filesSetmana.length === 1 ? "tasca" : "tasques"} aquesta setmana</a>
        </div>
      </div>

      <section className="seccio" id="a-revisar">
        <header>
          <span className="titol">
            a revisar
            {filesSafata.length > 0 && <span className="comptador c-vencut">{filesSafata.length}</span>}
          </span>
          <span className="meta">
            {veureTot ? "de tot l'equip · " : "on soc responsable · "}
            {veureTot ? <Link href="/">només els meus</Link> : <Link href="/?tot=1">veure-ho tot</Link>}
          </span>
        </header>
        {filesSafata.length === 0 ? (
          <div className="buit">
            cap element a revisar
            {!veureTot && <Link href="/?tot=1">mira els de l&apos;equip</Link>}
          </div>
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
                      <span className={`tag etiqueta ${f.motiu === "vencut" ? "tag-vencut" : "tag-risc"}`}>
                        {f.motiu === "vencut" ? "vençut" : "risc"}
                      </span>
                    </td>
                    <td className="num">{desplacament(-f.dies_retard)}</td>
                    <td className="principal">
                      <span className="trunc" title={f.titol}>
                        {f.titol} <span className="petit suau">{f.tipus_item}</span>
                      </span>
                    </td>
                    <td className="secundari">
                      <Link href={`/projectes/${f.projecte_id}`} className="trunc trunc-curt" title={f.projecte}>
                        {f.projecte}
                      </Link>
                    </td>
                    <td className="suau amaga-mobil"><span className="trunc trunc-curt" title={f.client}>{f.client}</span></td>
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
          <span className="meta">les meves tasques fins al {dataCurta(sumaDies(hui, 7))}</span>
        </header>
        {filesSetmana.length === 0 ? (
          <div className="buit">
            cap tasca assignada per als propers 7 dies
            <Link href="/projectes">afegeix-ne des d&apos;un projecte</Link>
          </div>
        ) : (
          <div className="desplacable">
            <table className="taula taula-mobil">
              <tbody>
                {filesSetmana.map((t) => (
                  <FilaAccionable key={t.id} taula="tasques" id={t.id} tePrevista acabat={false} desapareix>
                    <td className="nowrap">{diaCurt(t.data_prevista)}</td>
                    <td className="principal">
                      <span className="trunc" title={t.titol}>
                        {t.titol}
                        {t.prioritat === "alta" && <span className="tag tag-vencut"> alta</span>}
                      </span>
                    </td>
                    <td className="secundari">
                      <Link href={`/projectes/${t.projecte_id}`} className="trunc trunc-curt" title={t.projectes?.titol}>
                        {t.projectes?.titol}
                      </Link>
                    </td>
                    <td className="suau amaga-mobil"><span className="trunc trunc-curt">{t.projectes?.clients?.nom}</span></td>
                  </FilaAccionable>
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
                    <td className="nowrap"><span className="tag etiqueta tag-mut">mut</span></td>
                    <td className="num">{desplacament(-m.dies_silenci)}</td>
                    <td className="principal"><Link href={`/projectes/${m.id}`}>{m.titol}</Link></td>
                    <td className="suau amaga-mobil">{m.client}</td>
                    <td className="petit suau nowrap amaga-mobil">llindar {m.dies_silenci_max}d</td>
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
          <span className="meta"><Link href="/idees">totes les idees</Link></span>
        </header>
        {filesIdees.length === 0 ? (
          <div className="buit">
            cap idea proposada pendent de valorar
            <Link href="/idees">proposa&apos;n una</Link>
          </div>
        ) : (
          <table className="taula taula-mobil">
            <tbody>
              {filesIdees.map((i) => (
                <tr key={i.id}>
                  <td className="principal">{i.titol}</td>
                  <td className="num suau">{i.data_objectiu ? dataCurta(i.data_objectiu) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
