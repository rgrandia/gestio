"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { accioItem } from "@/lib/accions";
import { avui } from "@/lib/dates";
import type { TaulaItem } from "@/lib/tipus";

type Props = {
  taula: TaulaItem;
  id: string;
  estat?: string; // valor de data-estat per al filet esquerre
  tePrevista: boolean;
  acabat: boolean; // té data_real o està cancel·lat: sense accions
  desapareix?: boolean; // a la safata, la fila marxa amb un fos de 120 ms
  ambRevisat?: boolean;
  children: ReactNode;
};

type Obert = null | "fet" | "replanificar";

// Fila amb les accions de §5 en línia: res de menús, res de navegar.
export function FilaAccionable({
  taula,
  id,
  estat,
  tePrevista,
  acabat,
  desapareix = false,
  ambRevisat = false,
  children,
}: Props) {
  const router = useRouter();
  const [obert, setObert] = useState<Obert>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortint, setSortint] = useState(false);
  const [amagada, setAmagada] = useState(false);
  const [pendent, startTransition] = useTransition();

  const hui = avui();
  const [dataReal, setDataReal] = useState(hui);
  const [novaData, setNovaData] = useState("");
  const [motiu, setMotiu] = useState("");

  function executa(crida: () => ReturnType<typeof accioItem>, treu: boolean) {
    setError(null);
    startTransition(async () => {
      const r = await crida();
      if (r.error) {
        setError(r.error);
        return;
      }
      setObert(null);
      if (treu && desapareix) {
        setSortint(true);
        const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        setTimeout(() => {
          setAmagada(true);
          router.refresh();
        }, reduit ? 0 : 120);
      } else {
        router.refresh();
      }
    });
  }

  if (amagada) return null;

  return (
    <tr
      data-estat={estat}
      className={[sortint ? "sortint" : "", obert || error ? "expandida" : ""].join(" ")}
    >
      {children}
      <td className="accions">
        {!acabat && obert === null && (
          <>
            <button className="boto" disabled={pendent} onClick={() => setObert("fet")}>
              fet
            </button>
            <button className="boto" disabled={pendent} onClick={() => setObert("replanificar")}>
              {tePrevista ? "replanificar" : "planificar"}
            </button>
            {ambRevisat && (
              <button
                className="boto"
                disabled={pendent}
                title="amaga-ho 7 dies"
                onClick={() => executa(() => accioItem({ accio: "revisat", taula, id }), true)}
              >
                revisat
              </button>
            )}
            <button
              className="boto"
              disabled={pendent}
              onClick={() => executa(() => accioItem({ accio: "cancellar", taula, id }), true)}
            >
              cancel·lar
            </button>
          </>
        )}

        {obert === "fet" && (
          <form
            className="inline-flex gap-1 items-center"
            onSubmit={(e) => {
              e.preventDefault();
              executa(() => accioItem({ accio: "fet", taula, id, data: dataReal }), true);
            }}
          >
            <label className="petit suau" htmlFor={`real-${id}`}>data real</label>
            <input
              id={`real-${id}`}
              type="date"
              value={dataReal}
              max={hui}
              required
              autoFocus
              onChange={(e) => setDataReal(e.target.value)}
            />
            <button className="boto boto-primari" disabled={pendent}>marcar fet</button>
            <button type="button" className="boto" onClick={() => setObert(null)}>×</button>
          </form>
        )}

        {obert === "replanificar" && (
          <form
            className="inline-flex flex-wrap gap-1 items-center justify-end"
            onSubmit={(e) => {
              e.preventDefault();
              executa(
                () => accioItem({ accio: "replanificar", taula, id, data: novaData, motiu }),
                true,
              );
            }}
          >
            <input
              type="date"
              aria-label="nova data prevista"
              value={novaData}
              required
              autoFocus
              onChange={(e) => setNovaData(e.target.value)}
            />
            {tePrevista && (
              <input
                type="text"
                aria-label="motiu"
                placeholder="motiu (obligatori)"
                value={motiu}
                required
                minLength={3}
                className="font-sans"
                onChange={(e) => setMotiu(e.target.value)}
              />
            )}
            <button className="boto boto-primari" disabled={pendent}>desar</button>
            <button type="button" className="boto" onClick={() => setObert(null)}>×</button>
          </form>
        )}

        {error && <div className="error" role="alert">{error}</div>}
      </td>
    </tr>
  );
}
