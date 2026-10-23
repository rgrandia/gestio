"use client";

import { Fragment, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, CalendarClock, Check, Clock, Pencil, RotateCcw, X } from "lucide-react";
import { accioItem, transfereix } from "@/lib/accions";
import { avui } from "@/lib/dates";
import type { TaulaItem } from "@/lib/tipus";

type Props = {
  taula: TaulaItem;
  id: string;
  estat?: string; // valor de data-estat per al filet esquerre
  tePrevista: boolean;
  acabat: boolean; // té data_real o està cancel·lat: només editar i reobrir
  desapareix?: boolean; // a la safata, la fila marxa amb un fos de 120 ms
  ambRevisat?: boolean;
  // Tasques i entregables: a qui es pot enviar a revisar en marcar-ho fet (membres, sense un mateix).
  revisors?: { id: string; nom: string }[];
  // Tasques i entregables: a qui es poden passar (membres i externs actius).
  persones?: { id: string; nom: string; extern: boolean; area: string | null }[];
  // Formulari d'edició (detall del projecte): s'obre en una fila a sota.
  edicio?: ReactNode;
  columnes?: number;
  children: ReactNode;
};

type Obert = null | "fet" | "replanificar" | "passar" | "reobrir";

// Fila amb les accions de §5 en línia: res de menús, res de navegar.
export function FilaAccionable({
  taula,
  id,
  estat,
  tePrevista,
  acabat,
  desapareix = false,
  ambRevisat = false,
  revisors,
  persones,
  edicio,
  columnes = 8,
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
  const [revisor, setRevisor] = useState("");
  const [desti, setDesti] = useState("");
  const [nota, setNota] = useState("");
  const [editant, setEditant] = useState(false);
  const potPassar = (taula === "tasques" || taula === "entregables") && persones && persones.length > 0;

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

  const botoEditar = edicio && obert === null && (
    <button
      className="boto boto-suau boto-icona"
      disabled={pendent}
      data-tip="editar"
      aria-expanded={editant}
      onClick={() => setEditant(!editant)}
    >
      <Pencil className="icona-petita" aria-hidden />
      <span className="sr-only">editar</span>
    </button>
  );

  return (
    <Fragment>
    <tr
      data-estat={estat}
      className={[sortint ? "sortint" : "", obert || error ? "expandida" : ""].join(" ")}
    >
      {children}
      <td className="accions">
        {acabat && obert === null && (
          <>
            {botoEditar}
            <button className="boto boto-suau boto-icona" disabled={pendent} onClick={() => setObert("reobrir")} data-tip="reobrir (es va marcar per error)">
              <RotateCcw className="icona-petita" aria-hidden /> <span className="sr-only">reobrir</span>
            </button>
          </>
        )}

        {obert === "reobrir" && (
          <span className="inline-flex flex-wrap gap-1 items-center justify-end">
            <span className="petit suau">Es treu la data real i torna a estar obert.</span>
            <button className="boto boto-primari" disabled={pendent} onClick={() => executa(() => accioItem({ accio: "reobrir", taula, id }), false)}>
              <RotateCcw className="icona-petita" aria-hidden /> reobrir
            </button>
            <button type="button" className="boto boto-suau boto-icona" aria-label="tanca" onClick={() => setObert(null)}><X className="icona-petita" aria-hidden /></button>
          </span>
        )}

        {!acabat && obert === null && (
          <>
            <button className="boto boto-fet boto-icona" disabled={pendent} onClick={() => setObert("fet")} data-tip="fet">
              <Check className="icona-petita" aria-hidden /> <span className="sr-only">fet</span>
            </button>
            <button className="boto boto-suau boto-icona" disabled={pendent} onClick={() => setObert("replanificar")} data-tip={tePrevista ? "replanificar" : "planificar"}>
              <CalendarClock className="icona-petita" aria-hidden /> <span className="sr-only">{tePrevista ? "replanificar" : "planificar"}</span>
            </button>
            {ambRevisat && (
              <button
                className="boto boto-suau boto-icona"
                disabled={pendent}
                data-tip="revisat, encara viu (amaga-ho 7 dies)"
                onClick={() => executa(() => accioItem({ accio: "revisat", taula, id }), true)}
              >
                <Clock className="icona-petita" aria-hidden /> <span className="sr-only">revisat</span>
              </button>
            )}
            {botoEditar}
            {potPassar && (
              <button
                className="boto boto-suau boto-icona"
                disabled={pendent}
                data-tip="passar a una altra persona"
                onClick={() => setObert("passar")}
              >
                <ArrowRightLeft className="icona-petita" aria-hidden /> <span className="sr-only">passar</span>
              </button>
            )}
            <button
              className="boto boto-suau boto-perill boto-icona"
              data-tip="cancel·lar"
              disabled={pendent}
              onClick={() => executa(() => accioItem({ accio: "cancellar", taula, id }), true)}
            >
              <X className="icona-petita" aria-hidden /> <span className="sr-only">cancel·lar</span>
            </button>
          </>
        )}

        {obert === "fet" && (
          <form
            className="inline-flex flex-wrap gap-1 items-center justify-end"
            onSubmit={(e) => {
              e.preventDefault();
              executa(
                () => accioItem({ accio: "fet", taula, id, data: dataReal, revisor: revisor || undefined }),
                true,
              );
            }}
          >
            <label className="sr-only" htmlFor={`real-${id}`}>data real</label>
            <input
              id={`real-${id}`}
              type="date"
              value={dataReal}
              max={hui}
              required
              autoFocus
              onChange={(e) => setDataReal(e.target.value)}
            />
            {taula !== "fases" && revisors && revisors.length > 0 && (
              <select value={revisor} onChange={(e) => setRevisor(e.target.value)} aria-label="enviar a revisar">
                <option value="">sense revisió</option>
                {revisors.map((r) => (
                  <option key={r.id} value={r.id}>i que la revisi {r.nom}</option>
                ))}
              </select>
            )}
            <button className="boto boto-fet" disabled={pendent}><Check className="icona-petita" aria-hidden /> marcar fet</button>
            <button type="button" className="boto boto-suau boto-icona" aria-label="tanca" onClick={() => setObert(null)}><X className="icona-petita" aria-hidden /></button>
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
                placeholder="motiu (opcional)"
                value={motiu}
                className="font-sans"
                onChange={(e) => setMotiu(e.target.value)}
              />
            )}
            <button className="boto boto-primari" disabled={pendent}>desar</button>
            <button type="button" className="boto boto-suau boto-icona" aria-label="tanca" onClick={() => setObert(null)}><X className="icona-petita" aria-hidden /></button>
          </form>
        )}

        {obert === "passar" && persones && (
          <form
            className="inline-flex flex-wrap gap-1 items-center justify-end"
            onSubmit={(e) => {
              e.preventDefault();
              executa(() => transfereix(taula as "tasques" | "entregables", id, desti, nota), false);
            }}
          >
            <select required autoFocus value={desti} onChange={(e) => setDesti(e.target.value)} aria-label="a qui la passes">
              <option value="" disabled>a qui la passes…</option>
              <optgroup label="equip">
                {persones.filter((p) => !p.extern).map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
              </optgroup>
              {persones.some((p) => p.extern) && (
                <optgroup label="externs">
                  {persones.filter((p) => p.extern).map((p) => (
                    <option key={p.id} value={p.id}>{p.nom}{p.area ? ` · ${p.area}` : ""}</option>
                  ))}
                </optgroup>
              )}
            </select>
            <input
              type="text"
              placeholder="nota (opcional)"
              aria-label="nota"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
            />
            <button className="boto boto-primari" disabled={pendent}>
              <ArrowRightLeft className="icona-petita" aria-hidden /> passar
            </button>
            <button type="button" className="boto boto-suau boto-icona" aria-label="tanca" onClick={() => setObert(null)}>
              <X className="icona-petita" aria-hidden />
            </button>
          </form>
        )}

        {error && <div className="error" role="alert">{error}</div>}
      </td>
    </tr>
    {edicio && editant && (
      <tr className="fila-edicio">
        <td colSpan={columnes}>{edicio}</td>
      </tr>
    )}
    </Fragment>
  );
}
