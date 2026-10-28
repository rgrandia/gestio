"use client";

import Link from "next/link";
import { GripVertical } from "lucide-react";
import { accioItem } from "@/lib/accions";
import { replanificaPublicacio } from "@/lib/accions-xarxes";
import { TIPUS_DIA, type TipusDia } from "@/lib/calendari";
import { useArrossegar } from "@/components/useArrossegar";
import { IconaDia } from "@/components/IconaDia";

export type CitaSetmana = {
  clau: string; // "t:<id>" tasca (també interna) · "p:<id>" publicació
  titol: string;
  data: string;
  href: string;
  on: string;
  alta: boolean;
  tipus: "tasca" | "interna" | "pub";
  estat?: string;
  xarxes: { curt: string; color: string; nom: string }[];
  fixa: boolean; // ja publicada: no es mou
};
export type DiaSetmana = { data: string; etiqueta: string; capDeSetmana: boolean; marca: { tipus: TipusDia; nota: string | null; equip: boolean } | null };

// Calendari dels 7 dies de la pàgina d'inici. Les tasques i les publicacions
// s'arrosseguen a un altre dia (o nansa + ←/→): és replanificar, amb historial
// (§4.2, «sense motiu»). Avisa si una cosa cau en un dia de vacances o festiu.
export function SetmanaArrossegable({ dies, items, hui }: { dies: DiaSetmana[]; items: CitaSetmana[]; hui: string }) {
  const { dates, arrossegant, desant, error, anunci, nansa, classeDesti, fantasma } = useArrossegar({
    items: items.map((i) => ({ id: i.clau, data: i.data })),
    hui,
    desa: (clau, data) => {
      const id = clau.slice(2);
      if (!data) return Promise.resolve({ error: "Cal una data." });
      return clau.startsWith("p:")
        ? replanificaPublicacio(id, data, "")
        : accioItem({ accio: "replanificar", taula: "tasques", id, data, motiu: "" });
    },
  });

  const delDia = (d: string) => items.filter((i) => dates[i.clau] === d);
  const noLaborable = (d: DiaSetmana) => !!d.marca && !TIPUS_DIA[d.marca.tipus].laborable;
  const arrossegat = fantasma ? items.find((i) => i.clau === fantasma.id) : null;

  return (
    <div className={`setmana-arrossegable ${arrossegant ? "arrossegant" : ""}`}>
      {error && <p className="error ml-3" role="alert">{error}</p>}
      <div className="sr-only" aria-live="polite" ref={anunci} />
      <div
        className="setmana-inici"
        style={{
          gridTemplateColumns: dies
            .map((d) => ((d.capDeSetmana || noLaborable(d)) && delDia(d.data).length === 0 ? "minmax(0, .5fr)" : "minmax(0, 1fr)"))
            .join(" "),
        }}
      >
        {dies.map((d) => {
          const llista = delDia(d.data);
          return (
            <div
              key={d.data}
              data-desti={d.data}
              className={[
                "dia-inici",
                d.data === hui ? "avui" : "",
                llista.length === 0 ? "sense-res" : "",
                d.capDeSetmana || noLaborable(d) ? "festiu" : "",
                classeDesti(d.data),
              ].join(" ")}
            >
              <div className="cap-dia-inici">
                {d.etiqueta}
                <span>{Number(d.data.slice(8))}</span>
              </div>
              {d.marca && (
                <div className="marca-dia" style={{ borderLeftColor: TIPUS_DIA[d.marca.tipus].color }} title={d.marca.nota ?? undefined}>
                  <IconaDia tipus={d.marca.tipus} /> {d.marca.equip ? d.marca.nota || "festiu" : TIPUS_DIA[d.marca.tipus].nom}
                </div>
              )}
              {llista.map((c) => (
                <div
                  key={c.clau}
                  className={[
                    "cita",
                    "targeta-arrossegable",
                    `cita-${c.tipus === "pub" ? "xarxa" : c.tipus === "interna" ? "interna" : "tasca"}`,
                    arrossegant === c.clau ? "fantasma-origen" : "",
                    desant === c.clau ? "desant" : "",
                    noLaborable(d) ? "en-dia-lliure" : "",
                  ].join(" ")}
                  data-estat={c.estat}
                  style={c.xarxes[0] ? { borderLeftColor: c.xarxes[0].color } : undefined}
                  title={noLaborable(d) ? `Cau en un dia de ${d.marca!.tipus === "festiu" ? "festiu" : "vacances"}` : undefined}
                >
                  {!c.fixa && (
                    <button type="button" className="nansa" aria-label={`moure «${c.titol}» a un altre dia (arrossega, o fletxes ← →)`} title="arrossega per canviar el dia" {...nansa(c.clau)}>
                      <GripVertical className="icona-petita" aria-hidden />
                    </button>
                  )}
                  <span className="cos-cita">
                    {c.tipus === "interna" ? <a href={c.href}>{c.titol}</a> : <Link href={c.href}>{c.titol}</Link>}
                    {c.alta && <span className="etiqueta tag-vencut">alta</span>}
                    <span className="on" title={c.on}>
                      {c.xarxes.map((x, i) => (
                        <span key={i} className="xarxa" style={{ background: x.color }} title={x.nom}>{x.curt}</span>
                      ))}{" "}
                      {c.on}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {fantasma && arrossegat && (
        <div className="cita fantasma" style={{ ...fantasma.style, position: "fixed", ...(arrossegat.xarxes[0] ? { borderLeftColor: arrossegat.xarxes[0].color } : {}) }} aria-hidden>
          <span className="cos-cita">{arrossegat.titol}</span>
        </div>
      )}
    </div>
  );
}
