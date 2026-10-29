import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requereixMembre } from "@/lib/auth/session";
import { membres, obtePerfils } from "@/lib/dades";
import { avui, diaCurt, sumaDies } from "@/lib/dates";
import { diesMarcats, fasesQuePorto } from "@/lib/dades-calendari";
import { TIPUS_DIA } from "@/lib/calendari";
import { dilluns } from "@/lib/xarxes";
import { CalendariPersonal, type FeinaDia } from "@/components/CalendariPersonal";
import { createClient } from "@/lib/supabase/server";
import { IconaDia } from "@/components/IconaDia";

export const dynamic = "force-dynamic";

const MESOS = ["gener", "febrer", "març", "abril", "maig", "juny", "juliol", "agost", "setembre", "octubre", "novembre", "desembre"];

// El meu calendari (migració 0020): teletreball, fora, vacances, festius.
export default async function Calendari({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const jo = await requereixMembre();
  const { mes: mesParam } = await searchParams;
  const hui = avui();
  const mes = /^\d{4}-\d{2}$/.test(mesParam ?? "") ? mesParam! : hui.slice(0, 7);
  const primer = `${mes}-01`;
  const darrer = sumaDies(sumaDies(primer, 32).slice(0, 7) + "-01", -1);
  const inici = dilluns(primer);
  const fi = sumaDies(dilluns(darrer), 6);
  const setmana = [dilluns(hui), sumaDies(dilluns(hui), 6)];

  const supabase = await createClient();
  const prj = "projectes!inner(id, titol, numero_estudi, estat, intern_de, arxivat_el, eliminat_el)";
  const [marques, deLaSetmana, perfils, tasquesR, fases] = await Promise.all([
    diesMarcats(inici, fi),
    diesMarcats(setmana[0], setmana[1]),
    obtePerfils(),
    // les meves tasques obertes amb data dins del mes (de projecte i internes)
    supabase
      .from("tasques")
      .select(`id, titol, data_prevista, ${prj}`)
      .eq("assignada_a", jo.id)
      .is("data_real", null)
      .neq("estat", "cancellat")
      .gte("data_prevista", inici)
      .lte("data_prevista", fi)
      .eq("projectes.estat", "actiu")
      .is("projectes.arxivat_el", null)
      .is("projectes.eliminat_el", null),
    fasesQuePorto(jo.id, inici, fi, hui),
  ]);
  type P = { id: string; titol: string; numero_estudi: string | null; intern_de: string | null };
  const nomProjecte = (p: P) => (p.numero_estudi ? `${p.numero_estudi} · ` : "") + p.titol;
  const feina: FeinaDia[] = [
    ...((tasquesR.data ?? []) as unknown as { id: string; titol: string; data_prevista: string; projectes: P }[]).map((t) => ({
      clau: `t${t.id}`,
      data: t.data_prevista,
      tipus: t.projectes.intern_de ? ("interna" as const) : ("tasca" as const),
      titol: t.titol,
      on: t.projectes.intern_de ? "" : nomProjecte(t.projectes),
      href: t.projectes.intern_de ? "/#intern" : `/projectes/${t.projectes.id}`,
      vencut: t.data_prevista < hui,
    })),
    ...fases,
  ].sort((a, b) => (a.tipus.startsWith("fase") ? 1 : 0) - (b.tipus.startsWith("fase") ? 1 : 0));
  const equip = membres(perfils);
  const persones = new Map(equip.map((p) => [p.id, p]));
  // Qui no és a l'oficina aquesta setmana (sense comptar-me a mi)
  const absencies = deLaSetmana
    .filter((m) => m.perfil_id && m.perfil_id !== jo.id && m.tipus !== "oficina")
    .sort((a, b) => a.data.localeCompare(b.data));
  const festiusSetmana = deLaSetmana.filter((m) => m.perfil_id === null);

  const dies: string[] = [];
  for (let d = inici; d <= fi; d = sumaDies(d, 1)) dies.push(d);

  return (
    <>
      <div className="cap-pagina">
        <div>
          <h1>el meu calendari</h1>
          <div className="sub">
            teletreball, dies fora, vacances i festius (ho veu tot l&apos;equip), i a cada dia la teva feina: tasques i, en
            petit, les fases que portes
          </div>
        </div>
      </div>

      {(absencies.length > 0 || festiusSetmana.length > 0) && (
        <section className="seccio compacta">
          <header><span className="titol">aquesta setmana, a l&apos;equip</span></header>
          <ul className="llista-compacta">
            {festiusSetmana.map((f) => (
              <li key={`f${f.data}`}>
                <span><IconaDia tipus="festiu" /> {diaCurt(f.data)} · festiu de tot l&apos;equip{f.nota ? ` (${f.nota})` : ""}</span>
              </li>
            ))}
            {absencies.map((a) => (
              <li key={`${a.perfil_id}${a.data}`} style={{ borderLeftColor: TIPUS_DIA[a.tipus].color }}>
                <span>
                  <IconaDia tipus={a.tipus} /> {diaCurt(a.data)} · {persones.get(a.perfil_id!)?.nom ?? "—"}: {TIPUS_DIA[a.tipus].nom}
                  {a.nota ? ` (${a.nota})` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="seccio">
        <header>
          <span className="titol">{MESOS[Number(mes.slice(5)) - 1]} {mes.slice(0, 4)}</span>
          <span className="meta flex items-center gap-1">
            <Link className="boto boto-suau boto-icona" href={`/calendari?mes=${sumaDies(primer, -1).slice(0, 7)}`} aria-label="mes anterior" title="mes anterior">
              <ChevronLeft className="icona-petita" aria-hidden />
            </Link>
            <Link className="boto boto-suau" href="/calendari">avui</Link>
            <Link className="boto boto-suau boto-icona" href={`/calendari?mes=${sumaDies(darrer, 1).slice(0, 7)}`} aria-label="mes següent" title="mes següent">
              <ChevronRight className="icona-petita" aria-hidden />
            </Link>
          </span>
        </header>
        <CalendariPersonal
          key={mes}
          mes={mes}
          dies={dies}
          hui={hui}
          jo={jo.id}
          marques={marques}
          persones={equip.map((p) => ({ id: p.id, nom: p.nom, color: p.color }))}
          feina={feina}
        />
      </section>
    </>
  );
}
