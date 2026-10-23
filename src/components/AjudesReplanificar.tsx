"use client";

import { sumaDies } from "@/lib/dates";

// Motius d'un clic (el motiu és opcional, però amb un clic se sap per què
// llisca). Clicar-ne un l'escriu al camp; tornar-lo a clicar el treu.
export const MOTIUS_RAPIDS = ["ho demana el client", "proveïdor / camp", "dependència interna", "càrrega de feina"];

export function MotiusRapids({ motiu, setMotiu }: { motiu: string; setMotiu: (m: string) => void }) {
  return (
    <span className="xips" role="group" aria-label="motius ràpids">
      {MOTIUS_RAPIDS.map((m) => (
        <button
          key={m}
          type="button"
          className="xip"
          aria-pressed={motiu === m}
          onClick={() => setMotiu(motiu === m ? "" : m)}
        >
          {m}
        </button>
      ))}
    </span>
  );
}

// +1 i +2 setmanes des de la data prevista (o des d'avui, si ja ha passat
// o no n'hi ha).
export function DatesRapides({
  prevista,
  hui,
  setData,
}: {
  prevista: string | null | undefined;
  hui: string;
  setData: (d: string) => void;
}) {
  const base = prevista && prevista > hui ? prevista : hui;
  return (
    <span className="xips" role="group" aria-label="dates ràpides">
      {[7, 14].map((d) => (
        <button key={d} type="button" className="xip" onClick={() => setData(sumaDies(base, d))}>
          +{d / 7} setm.
        </button>
      ))}
    </span>
  );
}
