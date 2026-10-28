"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Flag, GripVertical, Inbox, Lightbulb, Plus } from "lucide-react";
import { replanificaPublicacio } from "@/lib/accions-xarxes";
import { NOM_ESTAT, type EstatPublicacio } from "@/lib/xarxes";
import { diaCurt, sumaDies } from "@/lib/dates";

export type ItemPlanner = {
  id: string;
  titol: string;
  estat: EstatPublicacio;
  data: string | null; // la real si ja s'ha publicat; si no, la prevista
  hora: string | null;
  xarxes: { curt: string; color: string; nom: string }[];
};
type Marca = { data: string; titol: string; tipus: "efemeride" | "idea" };

const SENSE = "sense-data";

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
  const router = useRouter();
  const [dates, setDates] = useState<Record<string, string | null>>(() => Object.fromEntries(items.map((i) => [i.id, i.data])));
  const [arrossegant, setArrossegant] = useState<{ id: string; x: number; y: number; dx: number; dy: number; amplada: number } | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [desant, setDesant] = useState<string | null>(null);
  const anunci = useRef<HTMLDivElement>(null);

  const permes = (desti: string) => desti === SENSE || desti >= hui;

  const mou = async (id: string, desti: string) => {
    const nova = desti === SENSE ? null : desti;
    const abans = dates[id] ?? null;
    if (nova === abans) return;
    if (!permes(desti)) {
      setError("No es pot planificar al passat.");
      return;
    }
    setError(null);
    setDates((d) => ({ ...d, [id]: nova }));
    setDesant(id);
    const r = await replanificaPublicacio(id, nova, "");
    setDesant(null);
    if (r.error) {
      setDates((d) => ({ ...d, [id]: abans }));
      setError(r.error);
      return;
    }
    if (anunci.current) anunci.current.textContent = nova ? `Moguda al ${diaCurt(nova)}` : "Treta del calendari";
    router.refresh();
  };

  const destiA = (x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-desti]");
    return el?.dataset.desti ?? null;
  };

  const nansa = (item: ItemPlanner) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      const targeta = e.currentTarget.closest<HTMLElement>(".targeta-planner")!.getBoundingClientRect();
      e.currentTarget.setPointerCapture(e.pointerId);
      setArrossegant({ id: item.id, x: e.clientX, y: e.clientY, dx: e.clientX - targeta.left, dy: e.clientY - targeta.top, amplada: targeta.width });
    },
    onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!arrossegant) return;
      setArrossegant({ ...arrossegant, x: e.clientX, y: e.clientY });
      setSobre(destiA(e.clientX, e.clientY));
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!arrossegant) return;
      const desti = destiA(e.clientX, e.clientY);
      setArrossegant(null);
      setSobre(null);
      if (desti) mou(item.id, desti);
    },
    onPointerCancel: () => {
      setArrossegant(null);
      setSobre(null);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => {
      const ara = dates[item.id];
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const base = ara ?? hui;
        const desti = ara ? sumaDies(base, e.key === "ArrowRight" ? 1 : -1) : hui;
        mou(item.id, desti);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        mou(item.id, SENSE);
      }
    },
  });

  const targeta = (item: ItemPlanner) => {
    const fixa = item.estat === "publicada";
    return (
      <div
        key={item.id}
        className={`targeta-planner ${arrossegant?.id === item.id ? "fantasma-origen" : ""} ${desant === item.id ? "desant" : ""}`}
        data-estat={item.estat}
        style={{ borderLeftColor: item.xarxes[0]?.color ?? "var(--linia-forta)" }}
      >
        {!fixa && (
          <button
            type="button"
            className="nansa"
            aria-label={`moure «${item.titol}» (arrossega, o fletxes ← → i Supr)`}
            title="arrossega per canviar el dia"
            {...nansa(item)}
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
                <span key={i} className="xarxa" style={{ background: x.color }} title={x.nom}>{x.curt}</span>
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
  const arrossegat = arrossegant ? items.find((i) => i.id === arrossegant.id) : null;

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
              className={["planner-dia", d === hui ? "avui" : "", passat ? "passat" : "", sobre === d ? (permes(d) ? "sobre" : "prohibit") : ""].join(" ")}
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

      <section className={`planner-safata ${sobre === SENSE ? "sobre" : ""}`} data-desti={SENSE} aria-label="sense data">
        <header>
          <Inbox className="icona-petita" aria-hidden /> sense data
          <span className="petit suau">· arrossega-les a un dia per planificar-les</span>
        </header>
        <div className="planner-safata-llista">
          {delDia(null).length === 0 ? <p className="buit-petit">res sense data</p> : delDia(null).map(targeta)}
        </div>
      </section>

      {arrossegant && arrossegat && (
        <div
          className="targeta-planner fantasma"
          style={{
            left: arrossegant.x - arrossegant.dx,
            top: arrossegant.y - arrossegant.dy,
            width: arrossegant.amplada,
            borderLeftColor: arrossegat.xarxes[0]?.color ?? "var(--linia-forta)",
          }}
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
