import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requereixMembre } from "@/lib/auth/session";
import { comprova, obtePersones } from "@/lib/dades";
import { avui, dataCurta, diesEntre, sumaDies } from "@/lib/dates";
import { Persona } from "@/components/Persona";

export const dynamic = "force-dynamic";

// Prova de cronograma (Gantt), demanada pel client l'octubre de 2026.
// Finestra de 13 setmanes que comença dues setmanes abans d'avui.

const SETMANES = 13;
const MESOS = ["gen", "feb", "març", "abr", "maig", "juny", "jul", "ag", "set", "oct", "nov", "des"];

type Fase = { id: string; nom: string; ordre: number; data_inici: string | null; data_prevista: string | null; data_real: string | null; estat: string };
type Entregable = { id: string; titol: string; data_prevista: string | null; data_real: string | null; estat: string };
type Projecte = {
  id: string;
  titol: string;
  numero_estudi: string | null;
  tipus: string;
  responsable_id: string;
  data_inici: string | null;
  data_fi_prevista: string | null;
  data_fi_real: string | null;
  creat_el: string;
  clients: { nom: string } | null;
  fases: Fase[];
  entregables: Entregable[];
  projecte_responsables: { perfil_id: string; actiu: boolean }[];
};

function dilluns(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7; // 0 = dilluns
  return sumaDies(iso, -dow);
}

function estatDe(prevista: string | null, real: string | null, estat: string, hui: string) {
  if (estat === "cancellat") return "cancellat";
  if (real) return "fet";
  if (!prevista) return "pendent";
  const d = diesEntre(hui, prevista);
  return d < 0 ? "vencut" : d <= 5 ? "risc" : "pendent";
}

export default async function Cronograma({
  searchParams,
}: {
  searchParams: Promise<{ tot?: string; des?: string; fases?: string }>;
}) {
  const perfil = await requereixMembre();
  const sp = await searchParams;
  const veureTot = sp.tot === "1";
  const ambFases = sp.fases !== "0";
  const desplac = Number.isInteger(Number(sp.des)) ? Number(sp.des) : 0; // en setmanes
  const hui = avui();
  const inici = sumaDies(dilluns(hui), -14 + desplac * 7);
  const dies = SETMANES * 7;
  const fi = sumaDies(inici, dies - 1);

  const supabase = await createClient();
  const [projectesR, persones] = await Promise.all([
    supabase
      .from("projectes")
      .select(
        "id, titol, numero_estudi, tipus, responsable_id, data_inici, data_fi_prevista, data_fi_real, creat_el, clients(nom), fases(id, nom, ordre, data_inici, data_prevista, data_real, estat), entregables(id, titol, data_prevista, data_real, estat), projecte_responsables(perfil_id, actiu)",
      )
      .in("estat", ["actiu", "pausat"])
      .is("arxivat_el", null)
      .is("eliminat_el", null)
      .is("intern_de", null),
    obtePersones(),
  ]);
  let projectes = comprova(projectesR) as unknown as Projecte[];
  if (!veureTot) {
    projectes = projectes.filter(
      (p) =>
        p.responsable_id === perfil.id ||
        p.projecte_responsables.some((r) => r.actiu && r.perfil_id === perfil.id),
    );
  }

  // Extrems de cada projecte: dates pròpies o, si no n'hi ha, les de les fases i entregables.
  const files = projectes
    .map((p) => {
      const datesFills = [
        ...p.fases.flatMap((f) => [f.data_inici, f.data_prevista, f.data_real]),
        ...p.entregables.flatMap((e) => [e.data_prevista, e.data_real]),
      ].filter(Boolean) as string[];
      datesFills.sort();
      const desDe = p.data_inici ?? datesFills[0] ?? p.creat_el.slice(0, 10);
      const finsA = p.data_fi_real ?? p.data_fi_prevista ?? datesFills.at(-1) ?? null;
      return { p, desDe, finsA };
    })
    .filter(({ desDe, finsA }) => (finsA ?? fi) >= inici && desDe <= fi)
    .sort((a, b) => (a.desDe < b.desDe ? -1 : 1));

  // Posició dins la finestra, en %, retallada als extrems.
  const pos = (iso: string) => Math.min(100, Math.max(0, (diesEntre(inici, iso) / dies) * 100));
  const barra = (desDe: string, finsA: string) => {
    const l = pos(desDe);
    const r = pos(sumaDies(finsA, 1));
    return { left: `${l}%`, width: `${Math.max(r - l, 0.6)}%` };
  };

  const setmanes = Array.from({ length: SETMANES }, (_, i) => sumaDies(inici, i * 7));
  const avuiDins = hui >= inici && hui <= fi;
  const enllac = (canvis: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    const v = { tot: veureTot ? "1" : undefined, des: desplac || undefined, fases: ambFases ? undefined : "0", ...canvis };
    for (const [k, val] of Object.entries(v)) if (val !== undefined && val !== 0 && val !== "") u.set(k, String(val));
    const s = u.toString();
    return `/cronograma${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <div className="cap-pagina">
        <div>
          <h1>cronograma</h1>
          <div className="sub">
            {dataCurta(inici)} – {dataCurta(fi)} · {files.length} {files.length === 1 ? "projecte" : "projectes"}
          </div>
        </div>
        <span className="flex flex-wrap items-center gap-2">
          <span className="commutador" role="group" aria-label="abast">
            <Link href={enllac({ tot: undefined })} aria-current={!veureTot}>els meus</Link>
            <Link href={enllac({ tot: "1" })} aria-current={veureTot}>tots</Link>
          </span>
          <span className="commutador" role="group" aria-label="fases">
            <Link href={enllac({ fases: undefined })} aria-current={ambFases}>amb fases</Link>
            <Link href={enllac({ fases: "0" })} aria-current={!ambFases}>només projectes</Link>
          </span>
          <Link href={enllac({ des: desplac - 4 })} className="boto boto-icona" aria-label="4 setmanes enrere">
            <ChevronLeft className="icona-petita" aria-hidden />
          </Link>
          <Link href={enllac({ des: undefined })} className="boto">avui</Link>
          <Link href={enllac({ des: desplac + 4 })} className="boto boto-icona" aria-label="4 setmanes endavant">
            <ChevronRight className="icona-petita" aria-hidden />
          </Link>
        </span>
      </div>

      <section className="seccio gantt" style={{ ["--setmanes" as string]: SETMANES }}>
        <div className="g-fila g-capcalera">
          <div className="g-nom">projecte</div>
          <div className="g-temps">
            {setmanes.map((s, i) => {
              const d = new Date(s + "T00:00:00Z");
              const nouMes = i === 0 || d.getUTCDate() <= 7;
              return (
                <span key={s} className="g-setmana" style={{ left: `${pos(s)}%` }}>
                  {nouMes && <b>{MESOS[d.getUTCMonth()]}</b>}
                  {d.getUTCDate()}
                </span>
              );
            })}
          </div>
        </div>

        {files.length === 0 && <div className="buit">cap projecte en aquestes dates</div>}

        {files.map(({ p, desDe, finsA }) => {
          const fases = [...p.fases].filter((f) => f.estat !== "cancellat").sort((a, b) => a.ordre - b.ordre);
          return (
            <div key={p.id} className="g-grup">
              <div className="g-fila g-projecte">
                <div className="g-nom">
                  <Persona p={persones.get(p.responsable_id)} nomesAvatar />
                  <Link href={`/projectes/${p.id}`} className="trunc" title={p.titol}>
                    {p.numero_estudi ? `${p.numero_estudi} · ` : ""}
                    {p.titol}
                  </Link>
                </div>
                <div className="g-temps">
                  {avuiDins && <span className="g-avui" style={{ left: `${pos(hui)}%` }} />}
                  <span
                    className={`g-barra g-b-projecte ${finsA ? "" : "obert"}`}
                    style={{
                      ...barra(desDe, finsA ?? fi),
                      background: persones.get(p.responsable_id)?.color ?? undefined,
                    }}
                    title={`${p.titol}: ${dataCurta(desDe)} – ${finsA ? dataCurta(finsA) : "sense data de fi"}`}
                  />
                  {p.entregables
                    .filter((e) => e.estat !== "cancellat" && (e.data_real ?? e.data_prevista))
                    .map((e) => {
                      const data = (e.data_real ?? e.data_prevista)!;
                      if (data < inici || data > fi) return null;
                      return (
                        <span
                          key={e.id}
                          className={`g-fita e-${estatDe(e.data_prevista, e.data_real, e.estat, hui)}`}
                          style={{ left: `${pos(data) + 50 / dies}%` }}
                          title={`${e.titol}: ${dataCurta(data)}${e.data_real ? " (lliurat)" : ""}`}
                        />
                      );
                    })}
                </div>
              </div>
              {ambFases &&
                p.tipus === "estudi" &&
                fases.map((f, i) => {
                  const final = f.data_real ?? f.data_prevista;
                  if (!final) return null;
                  const anterior = fases[i - 1]?.data_real ?? fases[i - 1]?.data_prevista;
                  const comenca = f.data_inici ?? (anterior ? sumaDies(anterior, 1) : final);
                  if (final < inici || comenca > fi) return null;
                  const e = estatDe(f.data_prevista, f.data_real, f.estat, hui);
                  return (
                    <div key={f.id} className="g-fila g-fase">
                      <div className="g-nom">{f.nom}</div>
                      <div className="g-temps">
                        {avuiDins && <span className="g-avui" style={{ left: `${pos(hui)}%` }} />}
                        <span
                          className={`g-barra g-b-fase e-${e}`}
                          style={barra(comenca <= final ? comenca : final, final)}
                          title={`${f.nom}: ${dataCurta(comenca)} – ${dataCurta(final)}${f.data_real ? " (feta)" : ""}`}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          );
        })}
      </section>

      <p className="petit suau">
        Barra del projecte del color del seu responsable · fases: <span className="tag-fet">feta</span>,{" "}
        <span className="tag-vencut">vençuda</span>, <span className="tag-risc">en risc</span>, pendent · ◆ entregable.
        Si una fase no té inici, comença on acaba l&apos;anterior.
      </p>
    </>
  );
}
