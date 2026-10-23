import Link from "next/link";
import { CalendarClock, CheckCircle2, Hourglass } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { comprova, obtePersones } from "@/lib/dades";
import { avui, dataCurta, dataLlarga, desplacament, diaCurt, diesEntre, sumaDies } from "@/lib/dates";
import { Persona } from "@/components/Persona";
import { BotoImprimir } from "@/components/BotoImprimir";
import type { Replanificacio, TipusItem } from "@/lib/tipus";

export const dynamic = "force-dynamic";

// Resum per a la reunió de dilluns: què s'ha tancat, què ha lliscat (i per
// què) i què venç aquesta setmana. Llistes, sense xifres agregades (§2, §6.1).

type ProjecteMini = { titol: string; numero_estudi: string | null; responsable_id: string };
type Element = {
  tipus: TipusItem;
  id: string;
  titol: string;
  projecte_id: string;
  projecte: ProjecteMini;
  persona: string | null;
  data: string;
};
type Fila = {
  id: string;
  projecte_id: string;
  data_real: string | null;
  data_prevista: string | null;
  projectes: ProjecteMini;
  titol?: string;
  nom?: string;
  assignada_a?: string | null;
  responsable_id?: string | null;
};

const PROJECTE = "projectes!inner(titol, numero_estudi, responsable_id, estat, arxivat_el, eliminat_el)";

export default async function ResumSetmanal() {
  const hui = avui();
  const desDe = sumaDies(hui, -7);
  const finsA = sumaDies(hui, 6);
  const supabase = await createClient();

  // Mateixa consulta per a tasques, fases i entregables, de projectes vius.
  const consulta = (taula: "tasques" | "fases" | "entregables", columnes: string) =>
    supabase
      .from(taula)
      .select(`id, projecte_id, data_real, data_prevista, ${columnes}, ${PROJECTE}`)
      .is("projectes.arxivat_el", null)
      .is("projectes.eliminat_el", null);

  const [tFet, fFet, eFet, tVen, fVen, eVen, histR, projectesTancatsR, persones] = await Promise.all([
    consulta("tasques", "titol, assignada_a").eq("estat", "fet").gte("data_real", desDe).lte("data_real", hui),
    consulta("fases", "nom, responsable_id").eq("estat", "fet").gte("data_real", desDe).lte("data_real", hui),
    consulta("entregables", "titol, responsable_id").eq("estat", "fet").gte("data_real", desDe).lte("data_real", hui),
    consulta("tasques", "titol, assignada_a")
      .is("data_real", null)
      .not("estat", "in", "(fet,cancellat)")
      .eq("projectes.estat", "actiu")
      .gte("data_prevista", hui)
      .lte("data_prevista", finsA),
    consulta("fases", "nom, responsable_id")
      .is("data_real", null)
      .not("estat", "in", "(fet,cancellat)")
      .eq("projectes.estat", "actiu")
      .gte("data_prevista", hui)
      .lte("data_prevista", finsA),
    consulta("entregables", "titol, responsable_id")
      .is("data_real", null)
      .not("estat", "in", "(fet,cancellat)")
      .eq("projectes.estat", "actiu")
      .gte("data_prevista", hui)
      .lte("data_prevista", finsA),
    supabase
      .from("v_historial_projecte")
      .select("*")
      .gte("creat_el", desDe)
      .not("data_antiga", "is", null)
      .order("creat_el", { ascending: false }),
    supabase
      .from("projectes")
      .select("id, titol, numero_estudi, responsable_id, data_fi_real")
      .gte("data_fi_real", desDe)
      .lte("data_fi_real", hui)
      .is("eliminat_el", null),
    obtePersones(),
  ]);

  const aElements = (
    r: { data: unknown; error: { message: string } | null },
    tipus: TipusItem,
    camp: "data_real" | "data_prevista",
  ) =>
    (comprova(r) as Fila[]).map((f) => ({
      tipus,
      id: f.id,
      titol: f.titol ?? f.nom ?? "",
      projecte_id: f.projecte_id,
      projecte: f.projectes,
      // Fases i entregables sense persona són del responsable del projecte.
      persona: f.assignada_a !== undefined ? f.assignada_a : (f.responsable_id ?? f.projectes.responsable_id),
      data: f[camp] as string,
    }));

  const tancats: Element[] = [
    ...aElements(fFet, "fase", "data_real"),
    ...aElements(eFet, "entregable", "data_real"),
    ...aElements(tFet, "tasca", "data_real"),
  ];
  const vencen: Element[] = [
    ...aElements(fVen, "fase", "data_prevista"),
    ...aElements(eVen, "entregable", "data_prevista"),
    ...aElements(tVen, "tasca", "data_prevista"),
  ].sort((a, b) => a.data.localeCompare(b.data));

  // Només el que s'ha endarrerit (no els avançaments) i de projectes vius.
  const endarrerits = (comprova(histR) as Replanificacio[]).filter(
    (h) => h.data_antiga && h.data_nova && h.data_nova > h.data_antiga,
  );
  const vius = new Map(
    (
      comprova(
        await supabase
          .from("projectes")
          .select("id, titol, numero_estudi")
          .in("id", [...new Set(endarrerits.map((h) => h.projecte_id))])
          .is("arxivat_el", null)
          .is("eliminat_el", null),
      ) as { id: string; titol: string; numero_estudi: string | null }[]
    ).map((p) => [p.id, p]),
  );
  const historial = endarrerits.filter((h) => vius.has(h.projecte_id));
  const projectesTancats = comprova(projectesTancatsR) as {
    id: string;
    titol: string;
    numero_estudi: string | null;
    responsable_id: string;
    data_fi_real: string;
  }[];

  const nomProjecte = (p: { titol: string; numero_estudi: string | null }) =>
    (p.numero_estudi ? `${p.numero_estudi} · ` : "") + p.titol;

  // Agrupa per projecte, en l'ordre d'aparició.
  const perProjecte = (llista: Element[]) => {
    const m = new Map<string, Element[]>();
    for (const e of llista) m.set(e.projecte_id, [...(m.get(e.projecte_id) ?? []), e]);
    return [...m.values()];
  };

  return (
    <>
      <div className="cap-pagina">
        <div>
          <h1>resum setmanal</h1>
          <div className="sub">
            per a la reunió de l&apos;equip: del {dataCurta(desDe)} a avui, i el que venç fins al {dataLlarga(finsA)}
          </div>
        </div>
        <BotoImprimir />
      </div>

      <p className="notes petit suau">
        Surt el que consta a l&apos;app. Una cosa acabada que ningú ha marcat amb data real no apareix com a tancada.
      </p>

      <section className="seccio">
        <header>
          <span className="titol">
            <CheckCircle2 className="icona" aria-hidden /> s&apos;ha tancat
          </span>
          <span className="meta">data real dels darrers 7 dies</span>
        </header>
        {tancats.length === 0 && projectesTancats.length === 0 ? (
          <div className="buit">res no consta tancat aquesta setmana</div>
        ) : (
          <table className="taula taula-mobil taula-resum">
            <tbody>
              {projectesTancats.map((p) => (
                <tr key={p.id}>
                  <td className="ample element">
                    <div className="titol-el">
                      <span className="etiqueta tag-fet mr-1">projecte tancat</span>
                      <Link href={`/projectes/${p.id}`}>{nomProjecte(p)}</Link>
                    </div>
                  </td>
                  <td className="nowrap"><Persona p={persones.get(p.responsable_id)} /></td>
                  <td className="num nowrap">{diaCurt(p.data_fi_real)}</td>
                </tr>
              ))}
              {perProjecte(tancats).map((grup) => (
                <GrupProjecte key={grup[0].projecte_id} grup={grup} persones={persones} nomProjecte={nomProjecte} />
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="seccio">
        <header>
          <span className="titol">
            <CalendarClock className="icona" aria-hidden /> ha lliscat
          </span>
          <span className="meta">dates previstes endarrerides els darrers 7 dies, amb el motiu</span>
        </header>
        {historial.length === 0 ? (
          <div className="buit">no s&apos;ha endarrerit res aquesta setmana</div>
        ) : (
          <div className="desplacable">
            <table className="taula">
              <thead>
                <tr>
                  <th>element</th>
                  <th className="num">de</th>
                  <th className="num">a</th>
                  <th className="num">canvi</th>
                  <th>motiu</th>
                  <th>qui</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <div>{h.element}</div>
                      <div className="context">
                        <span>{NOM_TAULA[h.taula] ?? h.taula}</span>
                        <span className="sep">·</span>
                        <Link href={`/projectes/${h.projecte_id}?pestanya=historial`}>
                          {nomProjecte(vius.get(h.projecte_id)!)}
                        </Link>
                      </div>
                    </td>
                    <td className="num">{dataCurta(h.data_antiga)}</td>
                    <td className="num">{dataCurta(h.data_nova)}</td>
                    <td className="num">
                      <span className="dies tag-vencut">{desplacament(diesEntre(h.data_antiga!, h.data_nova!))}</span>
                    </td>
                    <td className={h.motiu === "sense motiu" ? "fluix" : "font-sans"}>{h.motiu}</td>
                    <td className="suau nowrap">{h.usuari ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="seccio">
        <header>
          <span className="titol">
            <Hourglass className="icona" aria-hidden /> venç aquesta setmana
          </span>
          <span className="meta">obert, amb data prevista d&apos;avui al {dataCurta(finsA)}</span>
        </header>
        {vencen.length === 0 ? (
          <div className="buit">no venç res aquesta setmana</div>
        ) : (
          <table className="taula taula-mobil taula-resum">
            <tbody>
              {vencen.map((e) => (
                <tr key={e.tipus + e.id}>
                  <td className="ample element">
                    <div className="titol-el">
                      {e.tipus !== "tasca" && <span className="etiqueta mr-1">{e.tipus}</span>}
                      {e.titol}
                    </div>
                    <div className="context">
                      <Link href={`/projectes/${e.projecte_id}`}>{nomProjecte(e.projecte)}</Link>
                    </div>
                  </td>
                  <td className="nowrap"><Persona p={persones.get(e.persona ?? "")} /></td>
                  <td className="num nowrap">{e.data === hui ? "avui" : diaCurt(e.data)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

const NOM_TAULA: Record<string, string> = {
  projectes: "fi del projecte",
  fases: "fase",
  entregables: "entregable",
  tasques: "tasca",
};

function GrupProjecte({
  grup,
  persones,
  nomProjecte,
}: {
  grup: Element[];
  persones: Map<string, import("@/lib/tipus").Perfil>;
  nomProjecte: (p: { titol: string; numero_estudi: string | null }) => string;
}) {
  return (
    <>
      <tr className="dia">
        <td colSpan={3}>
          <Link href={`/projectes/${grup[0].projecte_id}`}>{nomProjecte(grup[0].projecte)}</Link>
        </td>
      </tr>
      {grup.map((e) => (
        <tr key={e.tipus + e.id}>
          <td className="ample element">
            <div className="titol-el">
              {e.tipus !== "tasca" && <span className="etiqueta mr-1">{e.tipus}</span>}
              {e.titol}
            </div>
          </td>
          <td className="nowrap"><Persona p={persones.get(e.persona ?? "")} /></td>
          <td className="num nowrap">{diaCurt(e.data)}</td>
        </tr>
      ))}
    </>
  );
}
