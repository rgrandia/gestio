"use client";

import { Fragment, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, CalendarClock, Check, Clock, Pencil, RotateCcw, X } from "lucide-react";
import { accioItem, transfereix } from "@/lib/accions";
import { DatesRapides, MotiusRapids } from "@/components/AjudesReplanificar";
import { avui } from "@/lib/dates";
import { clauElement, useSeleccio } from "@/components/Seleccio";
import { mostraToast } from "@/components/Toasts";
import type { TaulaItem } from "@/lib/tipus";

type Props = {
  taula: TaulaItem;
  id: string;
  estat?: string; // valor de data-estat per al filet esquerre
  tePrevista: boolean;
  prevista?: string | null; // data prevista actual, per als botons "+1 setm."
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
  prevista,
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
  const [cascada, setCascada] = useState(true); // fases: arrossegar també les següents
  const [revisor, setRevisor] = useState("");
  const [desti, setDesti] = useState("");
  const [nota, setNota] = useState("");
  const [editant, setEditant] = useState(false);
  const ctxSeleccio = useSeleccio();
  const potPassar = (taula === "tasques" || taula === "entregables") && persones && persones.length > 0;

  function executa(crida: () => ReturnType<typeof accioItem>, treu: boolean) {
    setError(null);
    startTransition(async () => {
      const r = await crida();
      if (r.error) {
        setError(r.error);
        return;
      }
      if (r.missatge) mostraToast({ text: r.missatge });
      if (r.avis) mostraToast({ text: r.avis, tipus: "avis", durada: 9000 });
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

  // Dins d'una <Seleccio> (la safata), cada línia oberta es pot marcar.
  const seleccio = acabat ? null : ctxSeleccio;
  const marcat = seleccio?.seleccionats.has(clauElement({ taula, id })) ?? false;
  const commuta = () => seleccio?.commuta({ taula, id, prevista: prevista ?? null });

  // Dreceres de teclat amb la línia enfocada (Tab o fletxes):
  // ↑/↓ (o k/j) moure's · f fet · r replanificar · v revisat · p passar ·
  // x seleccionar · Esc tancar.
  function tecla(e: React.KeyboardEvent<HTMLTableRowElement>) {
    if (e.key === "Escape" && obert) {
      setObert(null);
      e.currentTarget.focus();
      return;
    }
    if (e.target !== e.currentTarget || e.metaKey || e.ctrlKey || e.altKey) return;
    const moure = (dir: 1 | -1) => {
      const files = [...document.querySelectorAll<HTMLTableRowElement>("tr[data-fila]")];
      files[files.indexOf(e.currentTarget) + dir]?.focus();
    };
    const accions: Record<string, () => void> = {
      ArrowDown: () => moure(1),
      j: () => moure(1),
      ArrowUp: () => moure(-1),
      k: () => moure(-1),
    };
    if (!acabat) {
      accions.f = () => setObert("fet");
      accions.r = () => setObert("replanificar");
      if (potPassar) accions.p = () => setObert("passar");
      if (ambRevisat) accions.v = () => executa(() => accioItem({ accio: "revisat", taula, id }), true);
      if (seleccio) accions.x = commuta;
    }
    const fes = accions[e.key];
    if (fes) {
      e.preventDefault();
      fes();
    }
  }

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
      data-fila=""
      tabIndex={0}
      onKeyDown={tecla}
      aria-selected={seleccio ? marcat : undefined}
      className={[sortint ? "sortint" : "", obert || error ? "expandida" : "", marcat ? "marcada" : ""].join(" ")}
    >
      {seleccio && (
        <td className="tria">
          <input type="checkbox" checked={marcat} onChange={commuta} aria-label="seleccionar per actuar-hi en bloc" tabIndex={-1} />
        </td>
      )}
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
                () => accioItem({ accio: "replanificar", taula, id, data: novaData, motiu, cascada: taula === "fases" && tePrevista && cascada }),
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
            <DatesRapides prevista={prevista} hui={hui} setData={setNovaData} />
            {tePrevista && (
              <>
                <input
                  type="text"
                  aria-label="motiu"
                  placeholder="motiu (opcional)"
                  value={motiu}
                  className="font-sans"
                  onChange={(e) => setMotiu(e.target.value)}
                />
                <MotiusRapids motiu={motiu} setMotiu={setMotiu} />
                {taula === "fases" && (
                  <label className="petit flex items-center gap-1" title="les fases posteriors no acabades, i les seves tasques obertes, es mouen els mateixos dies">
                    <input type="checkbox" checked={cascada} onChange={(e) => setCascada(e.target.checked)} className="min-h-0" />
                    moure també les fases següents
                  </label>
                )}
              </>
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
