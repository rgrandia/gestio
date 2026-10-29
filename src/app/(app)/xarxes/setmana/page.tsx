import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { comprova } from "@/lib/dades";
import { avui, dataCurta, esDataValida, sumaDies } from "@/lib/dates";
import { comptes, marquesEntre, publicacionsEntre, type PublicacioLlista } from "@/lib/dades-xarxes";
import { dilluns, OBERTES, PLATAFORMES, type Compte } from "@/lib/xarxes";
import { PestanyesXarxes } from "@/components/PestanyesXarxes";
import { PlannerSetmanal, type ItemPlanner } from "@/components/PlannerSetmanal";

export const dynamic = "force-dynamic";

// Planner de la setmana: preparar les publicacions arrossegant-les als dies.
export default async function SetmanaXarxes({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const { d } = await searchParams;
  const hui = avui();
  const inici = dilluns(d && esDataValida(d) ? d : hui);
  const fi = sumaDies(inici, 6);
  const supabase = await createClient();

  const [cs, setmana, marques, senseR] = await Promise.all([
    comptes(),
    publicacionsEntre(inici, fi),
    marquesEntre(inici, fi),
    supabase
      .from("publicacions")
      .select("id, titol, estat, data_prevista, data_real, hora, publicacio_canals(compte_id, actiu, enllac_publicat, publicat_el)")
      .is("data_prevista", null)
      .in("estat", OBERTES)
      .order("creat_el", { ascending: false }),
  ]);
  const sense = comprova(senseR) as unknown as PublicacioLlista[];
  const mapa = new Map(cs.map((c) => [c.id, c]));

  const aItem = (p: PublicacioLlista): ItemPlanner => ({
    id: p.id,
    titol: p.titol,
    estat: p.estat,
    data: p.data_real ?? p.data_prevista,
    hora: p.hora,
    xarxes: p.publicacio_canals
      .filter((c) => c.actiu && mapa.has(c.compte_id))
      .map((c) => {
        const k = mapa.get(c.compte_id) as Compte;
        return {
          curt: PLATAFORMES[k.plataforma].curt,
          color: PLATAFORMES[k.plataforma].color,
          nom: k.nom,
          feta: p.estat !== "publicada" && !!c.publicat_el, // publicada només en algunes (0023)
        };
      }),
  });
  const items = [...setmana, ...sense].map(aItem);
  const dies = Array.from({ length: 7 }, (_, i) => sumaDies(inici, i));

  // Objectiu setmanal de cada compte, comptant el que hi ha aquesta setmana
  const cadencies = cs
    .filter((c) => c.actiu && c.cadencia_setmanal)
    .map((c) => ({
      c,
      n: setmana.filter((p) => p.publicacio_canals.some((k) => k.actiu && k.compte_id === c.id)).length,
    }));

  return (
    <>
      <div className="cap-pagina">
        <div>
          <h1>xarxes socials</h1>
          <div className="sub">arrossega les publicacions al dia que toquen; cada canvi queda a l&apos;historial de dates</div>
        </div>
        <Link href="/xarxes/nova" className="boto boto-primari">
          <Plus className="icona-petita" aria-hidden /> nova publicació
        </Link>
      </div>
      <PestanyesXarxes />

      <div className="planner-cap">
        <span className="flex items-center gap-1">
          <Link className="boto boto-suau boto-icona" href={`/xarxes/setmana?d=${sumaDies(inici, -7)}`} aria-label="setmana anterior" title="setmana anterior">
            <ChevronLeft className="icona-petita" aria-hidden />
          </Link>
          <Link className="boto boto-suau" href="/xarxes/setmana">aquesta setmana</Link>
          <Link className="boto boto-suau boto-icona" href={`/xarxes/setmana?d=${sumaDies(inici, 7)}`} aria-label="setmana següent" title="setmana següent">
            <ChevronRight className="icona-petita" aria-hidden />
          </Link>
          <strong className="ml-2">
            {dataCurta(inici)} – {dataCurta(fi)}
          </strong>
        </span>
        {cadencies.length > 0 && (
          <span className="cadencies">
            {cadencies.map(({ c, n }) => (
              <span key={c.id} className={`cadencia ${n < c.cadencia_setmanal! ? "curta" : ""}`} title={`${c.nom}: ${n} de ${c.cadencia_setmanal} aquesta setmana`}>
                <span className="xarxa" style={{ background: PLATAFORMES[c.plataforma].color }}>{PLATAFORMES[c.plataforma].curt}</span>
                {n}/{c.cadencia_setmanal}
              </span>
            ))}
          </span>
        )}
      </div>

      <PlannerSetmanal key={items.map((i) => `${i.id}:${i.data}`).join(",")} dies={dies} hui={hui} items={items} marques={marques} />
    </>
  );
}
