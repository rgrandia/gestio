import Link from "next/link";
import { ChevronLeft, ChevronRight, Flag, Lightbulb, Plus } from "lucide-react";
import { requereixMembre } from "@/lib/auth/session";
import { avui, dataCurta, diesEntre, sumaDies } from "@/lib/dates";
import { comptes, foratsCadencia, marquesEntre, oportunitats, publicacionsEntre, publicacionsObertes } from "@/lib/dades-xarxes";
import { dilluns, PLATAFORMES } from "@/lib/xarxes";
import { PestanyesXarxes } from "@/components/PestanyesXarxes";
import { XipPublicacio } from "@/components/XipPublicacio";

export const dynamic = "force-dynamic";

const MESOS = ["gener", "febrer", "març", "abril", "maig", "juny", "juliol", "agost", "setembre", "octubre", "novembre", "desembre"];
const DIES = ["dl", "dt", "dc", "dj", "dv", "ds", "dg"];

// Calendari editorial: un mes, amb les publicacions, les dates clau i les
// idees amb moment polític. A dalt, el que demana una decisió.
export default async function CalendariXarxes({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const jo = await requereixMembre();
  const { mes: mesParam } = await searchParams;
  const hui = avui();
  const mes = /^\d{4}-\d{2}$/.test(mesParam ?? "") ? mesParam! : hui.slice(0, 7);
  const primer = `${mes}-01`;
  const darrer = sumaDies(sumaDies(primer, 32).slice(0, 7) + "-01", -1);
  const inici = dilluns(primer);
  const fi = sumaDies(dilluns(darrer), 6);
  const mesAnterior = sumaDies(primer, -1).slice(0, 7);
  const mesSeguent = sumaDies(darrer, 1).slice(0, 7);

  const [cs, delMes, obertes, marques, setmanes, oport] = await Promise.all([
    comptes(),
    publicacionsEntre(inici, fi),
    publicacionsObertes(),
    marquesEntre(inici, fi),
    publicacionsEntre(dilluns(hui), sumaDies(dilluns(hui), 13)),
    oportunitats(hui),
  ]);
  const mapaComptes = new Map(cs.map((c) => [c.id, c]));
  const actius = cs.filter((c) => c.actiu);

  // Cal atenció
  const vencudes = obertes.filter((p) => p.data_prevista && p.data_prevista < hui);
  const perRevisar = obertes.filter((p) => p.estat === "revisio" && p.revisor_id === jo.id);
  const retornades = obertes.filter((p) => p.estat === "esborrany" && p.nota_revisio && p.responsable_id === jo.id);
  const properes = obertes.filter(
    (p) => p.data_prevista && p.data_prevista >= hui && p.data_prevista <= sumaDies(hui, 1) && !["aprovada", "programada"].includes(p.estat),
  );
  const forats = foratsCadencia(cs, setmanes, hui);
  const res = vencudes.length + perRevisar.length + retornades.length + properes.length + forats.length + oport.length;

  const dies: string[] = [];
  for (let d = inici; d <= fi; d = sumaDies(d, 1)) dies.push(d);
  const perDia = new Map<string, typeof delMes>();
  for (const p of delMes) {
    const d = p.data_real ?? p.data_prevista!;
    perDia.set(d, [...(perDia.get(d) ?? []), p]);
  }
  const marquesDia = new Map<string, typeof marques>();
  for (const m of marques) marquesDia.set(m.data, [...(marquesDia.get(m.data) ?? []), m]);

  return (
    <>
      <div className="cap-pagina">
        <div>
          <h1>xarxes socials</h1>
          <div className="sub">
            es redacta i es revisa aquí, es publica a cada xarxa i aquí es marca com a publicada amb l&apos;enllaç
          </div>
        </div>
        <Link href="/xarxes/nova" className="boto boto-primari">
          <Plus className="icona-petita" aria-hidden /> nova publicació
        </Link>
      </div>
      <PestanyesXarxes />

      {actius.length === 0 && (
        <p className="avis-fases-noves petit">
          Encara no hi ha cap compte corporatiu. <Link href="/xarxes/comptes">Afegeix-ne un</Link> per poder triar on va cada publicació.
        </p>
      )}

      {res > 0 && (
        <section className="seccio" id="atencio">
          <header>
            <span className="titol">cal atenció</span>
          </header>
          <ul className="llista-compacta atencio-xarxes">
            {perRevisar.map((p) => (
              <li key={`r${p.id}`} data-estat="risc">
                <Link href={`/xarxes/${p.id}`}>{p.titol}</Link>
                <span className="on">et toca revisar-la{p.data_prevista ? ` · per al ${dataCurta(p.data_prevista)}` : ""}</span>
              </li>
            ))}
            {retornades.map((p) => (
              <li key={`t${p.id}`} data-estat="risc">
                <Link href={`/xarxes/${p.id}`}>{p.titol}</Link>
                <span className="on">retornada: {p.nota_revisio}</span>
              </li>
            ))}
            {vencudes.map((p) => (
              <li key={`v${p.id}`} data-estat="vencut">
                <Link href={`/xarxes/${p.id}`}>{p.titol}</Link>
                <span className="on">
                  prevista el {dataCurta(p.data_prevista)} ({diesEntre(p.data_prevista!, hui)} dies) i no consta publicada
                </span>
              </li>
            ))}
            {properes.map((p) => (
              <li key={`p${p.id}`} data-estat="risc">
                <Link href={`/xarxes/${p.id}`}>{p.titol}</Link>
                <span className="on">
                  {p.data_prevista === hui ? "avui" : "demà"} i encara és {p.estat === "revisio" ? "en revisió" : p.estat}
                </span>
              </li>
            ))}
            {forats.map((f) => (
              <li key={`f${f.compte.id}${f.setmana}`}>
                <span>
                  <span className="xarxa" style={{ background: PLATAFORMES[f.compte.plataforma].color }}>
                    {PLATAFORMES[f.compte.plataforma].curt}
                  </span>{" "}
                  {f.compte.nom}
                </span>
                <span className="on">
                  {f.previstes} de {f.compte.cadencia_setmanal} {f.setmana === dilluns(hui) ? "aquesta setmana" : "la setmana que ve"}
                </span>
              </li>
            ))}
            {oport.map((o) => (
              <li key={`o${o.projecte_id}`}>
                <Link href={`/xarxes/nova?projecte=${o.projecte_id}`}>
                  <Flag className="icona-petita inline mr-1" aria-hidden />
                  {o.projecte}
                </Link>
                <span className="on">
                  {o.que} {o.feta ? "feta" : "prevista"} el {dataCurta(o.data)} i cap publicació preparada · només si el client
                  n&apos;autoritza la difusió
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="seccio calendari-xarxes">
        <header>
          <span className="titol">
            {MESOS[Number(mes.slice(5)) - 1]} {mes.slice(0, 4)}
          </span>
          <span className="meta flex items-center gap-1">
            <Link className="boto boto-suau boto-icona" href={`/xarxes?mes=${mesAnterior}`} aria-label="mes anterior" title="mes anterior">
              <ChevronLeft className="icona-petita" aria-hidden />
            </Link>
            <Link className="boto boto-suau" href="/xarxes">avui</Link>
            <Link className="boto boto-suau boto-icona" href={`/xarxes?mes=${mesSeguent}`} aria-label="mes següent" title="mes següent">
              <ChevronRight className="icona-petita" aria-hidden />
            </Link>
          </span>
        </header>
        <div className="graella-mes" role="grid">
          {DIES.map((d) => (
            <div key={d} className="cap-dia" role="columnheader">{d}</div>
          ))}
          {dies.map((d) => {
            const fora = d.slice(0, 7) !== mes;
            const pubs = perDia.get(d) ?? [];
            const ms = marquesDia.get(d) ?? [];
            return (
              <div
                key={d}
                role="gridcell"
                className={["dia", fora ? "fora" : "", d === hui ? "avui" : "", d < hui ? "passat" : ""].join(" ")}
                data-data={d}
              >
                <div className="num-dia">
                  <span>{Number(d.slice(8))}</span>
                  {!fora && d >= hui && (
                    <Link href={`/xarxes/nova?data=${d}`} className="afegir-dia" aria-label={`nova publicació el ${dataCurta(d)}`} title="nova publicació aquest dia">
                      <Plus className="icona-petita" aria-hidden />
                    </Link>
                  )}
                </div>
                {ms.map((m, i) => (
                  <div key={i} className={`marca marca-${m.tipus}`} title={m.tipus === "idea" ? "idea amb moment polític" : "data clau"}>
                    {m.tipus === "idea" ? <Lightbulb className="icona-petita" aria-hidden /> : <Flag className="icona-petita" aria-hidden />}
                    {m.titol}
                  </div>
                ))}
                {pubs.map((p) => (
                  <XipPublicacio key={p.id} p={p} comptes={mapaComptes} />
                ))}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
