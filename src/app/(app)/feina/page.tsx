import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { comprova, obtePerfils } from "@/lib/dades";
import { avui, dataCurta, desplacament, diesEntre, sumaDies } from "@/lib/dates";
import { Persona } from "@/components/Persona";
import type { Perfil } from "@/lib/tipus";

export const dynamic = "force-dynamic";

type Projecte = { titol: string; numero_estudi: string | null; responsable_id: string };
type Element = {
  tipus: "tasca" | "fase" | "entregable";
  id: string;
  titol: string;
  data_prevista: string | null;
  projecte_id: string;
  projecte: Projecte;
  qui: string | null; // persona a qui està assignat (o el responsable del projecte)
  delProjecte: boolean; // no té ningú assignat: és del responsable del projecte
};

// Filtre comú: elements oberts de projectes actius, no arxivats ni a la paperera.
const OBERTS = "projectes!inner(titol, numero_estudi, responsable_id, estat, arxivat_el, eliminat_el)";

const HORITZO = 30; // dies

export default async function FeinaEquip({
  searchParams,
}: {
  searchParams: Promise<{ externs?: string; tot?: string }>;
}) {
  const { externs, tot } = await searchParams;
  const ambExterns = externs !== "0";
  const totElHoritzo = tot === "1";
  const hui = avui();
  const supabase = await createClient();

  const [tasquesR, fasesR, entregablesR, perfils] = await Promise.all([
    supabase
      .from("tasques")
      .select(`id, titol, data_prevista, projecte_id, assignada_a, ${OBERTS}`)
      .is("data_real", null)
      .neq("estat", "cancellat")
      .eq("projectes.estat", "actiu")
      .is("projectes.arxivat_el", null)
      .is("projectes.eliminat_el", null),
    supabase
      .from("fases")
      .select(`id, nom, data_prevista, projecte_id, responsable_id, ${OBERTS}`)
      .is("data_real", null)
      .neq("estat", "cancellat")
      .eq("projectes.estat", "actiu")
      .is("projectes.arxivat_el", null)
      .is("projectes.eliminat_el", null),
    supabase
      .from("entregables")
      .select(`id, titol, data_prevista, projecte_id, responsable_id, ${OBERTS}`)
      .is("data_real", null)
      .neq("estat", "cancellat")
      .eq("projectes.estat", "actiu")
      .is("projectes.arxivat_el", null)
      .is("projectes.eliminat_el", null),
    obtePerfils(),
  ]);

  type FilaBD = {
    id: string;
    titol?: string;
    nom?: string;
    data_prevista: string | null;
    projecte_id: string;
    assignada_a?: string | null;
    responsable_id?: string | null;
    projectes: Projecte;
  };
  const elements: Element[] = [
    ...(comprova(tasquesR) as unknown as FilaBD[]).map((t) => ({
      tipus: "tasca" as const,
      id: t.id,
      titol: t.titol!,
      data_prevista: t.data_prevista,
      projecte_id: t.projecte_id,
      projecte: t.projectes,
      qui: t.assignada_a ?? null,
      delProjecte: false,
    })),
    ...(comprova(fasesR) as unknown as FilaBD[])
      // fases sense data ni responsable: massa soroll per a aquest tauler
      .filter((f) => f.data_prevista || f.responsable_id)
      .map((f) => ({
        tipus: "fase" as const,
        id: f.id,
        titol: f.nom!,
        data_prevista: f.data_prevista,
        projecte_id: f.projecte_id,
        projecte: f.projectes,
        qui: f.responsable_id ?? f.projectes.responsable_id,
        delProjecte: !f.responsable_id,
      })),
    ...(comprova(entregablesR) as unknown as FilaBD[]).map((e) => ({
      tipus: "entregable" as const,
      id: e.id,
      titol: e.titol!,
      data_prevista: e.data_prevista,
      projecte_id: e.projecte_id,
      projecte: e.projectes,
      qui: e.responsable_id ?? e.projectes.responsable_id,
      delProjecte: !e.responsable_id,
    })),
  ];

  // Per data; sense data, al final.
  elements.sort((a, b) => (a.data_prevista ?? "9999") < (b.data_prevista ?? "9999") ? -1 : 1);

  // Per defecte, només el que és vençut o venç en els propers 30 dies.
  const limit = sumaDies(hui, HORITZO);
  const visible = (e: Element) => totElHoritzo || (e.data_prevista !== null && e.data_prevista <= limit);

  const persones = perfils.filter((p) => p.actiu && (ambExterns || !p.extern));
  const columnes: { persona: Perfil | null; tots: Element[]; items: Element[] }[] = [
    ...persones.map((p) => ({ persona: p, tots: elements.filter((e) => e.qui === p.id) })),
    { persona: null, tots: elements.filter((e) => !e.qui) },
  ]
    .map((c) => ({ ...c, items: c.tots.filter(visible) }))
    .filter((c) => c.persona || c.items.length > 0);

  const enllac = (canvis: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const v = { externs: ambExterns ? undefined : "0", tot: totElHoritzo ? "1" : undefined, ...canvis };
    for (const [k, val] of Object.entries(v)) if (val) u.set(k, val);
    return `/feina${u.size ? `?${u}` : ""}`;
  };

  return (
    <>
      <div className="cap-pagina">
        <div>
          <h1>feina de l&apos;equip</h1>
          <div className="sub">
            què té obert cadascú (tasques, fases i entregables), per data
          </div>
        </div>
        <span className="flex flex-wrap gap-2">
          <span className="commutador" role="group" aria-label="horitzó">
            <Link href={enllac({ tot: undefined })} aria-current={!totElHoritzo}>propers {HORITZO} dies</Link>
            <Link href={enllac({ tot: "1" })} aria-current={totElHoritzo}>tot</Link>
          </span>
          <span className="commutador" role="group" aria-label="externs">
            <Link href={enllac({ externs: undefined })} aria-current={ambExterns}>amb externs</Link>
            <Link href={enllac({ externs: "0" })} aria-current={!ambExterns}>només l&apos;equip</Link>
          </span>
        </span>
      </div>

      <div className="tauler">
        {columnes.map(({ persona, tots, items }) => {
          const vencuts = items.filter((e) => e.data_prevista && e.data_prevista < hui).length;
          const setmana = items.filter(
            (e) => e.data_prevista && e.data_prevista >= hui && e.data_prevista <= sumaDies(hui, 7),
          ).length;
          return (
            <section key={persona?.id ?? "ningu"} className="columna">
              <header style={persona && !persona.extern ? { borderTopColor: persona.color ?? undefined } : undefined}>
                {persona ? <Persona p={persona} /> : <span className="titol-el">sense assignar</span>}
                <span className="xifres-columna">
                  <span title="obertes">{tots.length} obertes</span>
                  {vencuts > 0 && <span className="tag-vencut" title="vençudes">{vencuts} vençudes</span>}
                  {setmana > 0 && <span className="tag-risc" title="aquesta setmana">{setmana} aquesta setmana</span>}
                </span>
              </header>
              {items.length === 0 ? (
                <p className="buit petit">{tots.length ? `res en els propers ${HORITZO} dies` : "res obert"}</p>
              ) : (
                <ul>
                  {items.map((e) => {
                    const d = e.data_prevista ? diesEntre(hui, e.data_prevista) : null;
                    const estat = d === null ? "" : d < 0 ? "vencut" : d <= 5 ? "risc" : "";
                    return (
                      <li key={`${e.tipus}-${e.id}`} data-estat={estat}>
                        <Link href={`/projectes/${e.projecte_id}`}>
                          <span className="t">{e.titol}</span>
                          <span className="d">
                            {e.tipus}
                            {e.delProjecte && " · com a responsable"}
                            {" · "}
                            {e.projecte.numero_estudi ? `${e.projecte.numero_estudi} ` : ""}
                            {e.projecte.titol}
                          </span>
                          <span className={`q ${estat ? `tag-${estat}` : ""}`}>
                            {e.data_prevista ? (
                              <>
                                {dataCurta(e.data_prevista)} <b>{desplacament(d!)}</b>
                              </>
                            ) : (
                              <span className="fluix">sense data</span>
                            )}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                  {tots.length > items.length && (
                    <li className="mes">
                      <Link href={enllac({ tot: "1" })}>i {tots.length - items.length} més, més endavant o sense data</Link>
                    </li>
                  )}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
