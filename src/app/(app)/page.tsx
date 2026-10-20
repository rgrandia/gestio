import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requereixMembre } from "@/lib/auth/session";
import { comprova } from "@/lib/dades";
import { avui, desplacament, diaCurt, sumaDies, dataCurta } from "@/lib/dates";
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

  return (
    <>
      <h1>la meva setmana</h1>

      <section className="seccio">
        <header>
          <span>a revisar</span>
          <span className="meta">
            {filesSafata.length} {filesSafata.length === 1 ? "element" : "elements"} ·{" "}
            {veureTot ? <Link href="/">només els meus</Link> : <Link href="/?tot=1">veure-ho tot</Link>}
          </span>
        </header>
        {filesSafata.length === 0 ? (
          <div className="buit">cap element a revisar</div>
        ) : (
          <div className="desplacable">
            <table className="taula">
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
                      <span className={`tag ${f.motiu === "vencut" ? "tag-vencut" : "tag-risc"}`}>
                        {f.motiu === "vencut" ? "vencut" : "risc"}
                      </span>
                    </td>
                    <td className="num">{desplacament(-f.dies_retard)}</td>
                    <td>
                      {f.titol} <span className="petit suau">{f.tipus_item}</span>
                    </td>
                    <td>
                      <Link href={`/projectes/${f.projecte_id}`}>{f.projecte}</Link>
                    </td>
                    <td className="suau">{f.client}</td>
                  </FilaAccionable>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="seccio">
        <header>
          <span>aquesta setmana</span>
          <span className="meta">les meves tasques fins al {dataCurta(sumaDies(hui, 7))}</span>
        </header>
        {filesSetmana.length === 0 ? (
          <div className="buit">cap tasca assignada per als propers 7 dies</div>
        ) : (
          <div className="desplacable">
            <table className="taula">
              <tbody>
                {filesSetmana.map((t) => (
                  <FilaAccionable key={t.id} taula="tasques" id={t.id} tePrevista acabat={false} desapareix>
                    <td className="nowrap">{diaCurt(t.data_prevista)}</td>
                    <td>
                      {t.titol}
                      {t.prioritat === "alta" && <span className="tag tag-vencut"> alta</span>}
                    </td>
                    <td>
                      <Link href={`/projectes/${t.projecte_id}`}>{t.projectes?.titol}</Link>
                    </td>
                    <td className="suau">{t.projectes?.clients?.nom}</td>
                  </FilaAccionable>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {filesMuts.length > 0 && (
        <section className="seccio">
          <header>
            <span>projectes muts</span>
            <span className="meta">consultories sense contacte ni entregable recent</span>
          </header>
          <div className="desplacable">
            <table className="taula">
              <tbody>
                {filesMuts.map((m) => (
                  <tr key={m.id} data-estat="mut">
                    <td className="nowrap"><span className="tag tag-mut">mut</span></td>
                    <td className="num">{desplacament(-m.dies_silenci)}</td>
                    <td><Link href={`/projectes/${m.id}`}>{m.titol}</Link></td>
                    <td className="suau">{m.client}</td>
                    <td className="petit suau nowrap">llindar {m.dies_silenci_max}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="seccio">
        <header>
          <span>les meves idees</span>
          <span className="meta"><Link href="/idees">totes les idees</Link></span>
        </header>
        {filesIdees.length === 0 ? (
          <div className="buit">cap idea proposada pendent de valorar</div>
        ) : (
          <table className="taula">
            <tbody>
              {filesIdees.map((i) => (
                <tr key={i.id}>
                  <td>{i.titol}</td>
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
