"use client";

import Link from "next/link";
import { Flag, GripVertical, Inbox, Lightbulb, Plus } from "lucide-react";
import { replanificaPublicacio } from "@/lib/accions-xarxes";
import { NOM_ESTAT, type EstatPublicacio } from "@/lib/xarxes";
import { diaCurt } from "@/lib/dates";
import { SENSE_DATA as SENSE, useArrossegar } from "@/components/useArrossegar";

export type ItemPlanner = {
  id: string;
  titol: string;
  estat: EstatPublicacio;
  data: string | null; // la real si ja s'ha publicat; si no, la prevista
  hora: string | null;
  xarxes: { curt: string; color: string; nom: string; feta?: boolean }[];
};
type Marca = { data: string; titol: string; tipus: "efemeride" | "idea" };

// Planificar la setmana arrossegant. Moure una targeta és replanificar
// (replanificar(), amb historial, §4.2). Funciona amb ratolí i amb el dit
// (pointer events, des de la nansa) i amb el teclat (nansa + ←/→, Supr per
// treure-la del dia). Ni al passat ni les ja publicades.
export function PlannerSetmanal({
  dies,
  hui,
  items,
  marques,
}: {
  dies: string[];
  hui: string;
  items: ItemPlanner[];
  marques: Marca[];
}) {
  const { dates, arrossegant, desant, error, anunci, nansa, classeDesti, fantasma } = useArrossegar({
    items,
    hui,
    desa: (id, data) => replanificaPublicacio(id, data, ""),
    senseData: true,
    historial: (id) => ({ taula: "publicacions", id }),
  });

  const targeta = (item: ItemPlanner) => {
    const fixa = item.estat === "publicada";
    return (
      <div
        key={item.id}
        className={`targeta-planner targeta-arrossegable ${arrossegant === item.id ? "fantasma-origen" : ""} ${desant === item.id ? "desant" : ""}`}
        data-estat={item.estat}
        style={{ borderLeftColor: item.xarxes[0]?.color ?? "var(--linia-forta)" }}
      >
        {!fixa && (
          <button
            type="button"
            className="nansa"
            aria-label={`moure «${item.titol}» (arrossega, o fletxes ← → i Supr)`}
            title="arrossega per canviar el dia"
            {...nansa(item.id)}
          >
            <GripVertical className="icona-petita" aria-hidden />
          </button>
        )}
        <Link href={`/xarxes/${item.id}`} className="cos-targeta">
          <span className="xip-cap">
            {item.xarxes.length === 0 ? (
              <span className="xarxa buida">sense compte</span>
            ) : (
              item.xarxes.map((x, i) => (
                <span key={i} className={`xarxa ${x.feta ? "feta" : ""}`} style={{ background: x.color }} title={x.feta ? `${x.nom}: ja publicada` : x.nom}>
                    {x.feta ? "✓" : ""}
                    {x.curt}
                  </span>
              ))
            )}
            {item.hora && <span className="suau">{item.hora.slice(0, 5)}</span>}
            <span className="xip-estat">{NOM_ESTAT[item.estat]}</span>
          </span>
          <span className="xip-titol">{item.titol}</span>
        </Link>
      </div>
    );
  };

  const delDia = (d: string | null) => items.filter((i) => (dates[i.id] ?? null) === d);
  const arrossegat = fantasma ? items.find((i) => i.id === fantasma.id) : null;

  return (
    <div className={`planner ${arrossegant ? "arrossegant" : ""}`}>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="sr-only" aria-live="polite" ref={anunci} />
      <div className="planner-graella">
        {dies.map((d) => {
          const passat = d < hui;
          const ms = marques.filter((m) => m.data === d);
          return (
            <section
              key={d}
              className={["planner-dia", d === hui ? "avui" : "", passat ? "passat" : "", classeDesti(d)].join(" ")}
              data-desti={d}
              aria-label={diaCurt(d)}
            >
              <header>
                <span>{diaCurt(d)}</span>
                {!passat && (
                  <Link href={`/xarxes/nova?data=${d}`} className="afegir-dia" aria-label={`nova publicació el ${diaCurt(d)}`} title="nova publicació aquest dia">
                    <Plus className="icona-petita" aria-hidden />
                  </Link>
                )}
              </header>
              {ms.map((m, i) => (
                <div key={i} className={`marca marca-${m.tipus}`}>
                  {m.tipus === "idea" ? <Lightbulb className="icona-petita" aria-hidden /> : <Flag className="icona-petita" aria-hidden />}
                  {m.titol}
                </div>
              ))}
              {delDia(d).map(targeta)}
            </section>
          );
        })}
      </div>

      <section className={`planner-safata ${classeDesti(SENSE)}`} data-desti={SENSE} aria-label="sense data">
        <header>
          <Inbox className="icona-petita" aria-hidden /> sense data
          <span className="petit suau">· arrossega-les a un dia per planificar-les</span>
        </header>
        <div className="planner-safata-llista">
          {delDia(null).length === 0 ? <p className="buit-petit">res sense data</p> : delDia(null).map(targeta)}
        </div>
      </section>

      {fantasma && arrossegat && (
        <div
          className="targeta-planner fantasma"
          style={{ ...fantasma.style, borderLeftColor: arrossegat.xarxes[0]?.color ?? "var(--linia-forta)" }}
          aria-hidden
        >
          <span className="cos-targeta">
            <span className="xip-titol">{arrossegat.titol}</span>
          </span>
        </div>
      )}
    </div>
  );
}
