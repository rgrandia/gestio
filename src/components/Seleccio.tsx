"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, Clock, X } from "lucide-react";
import { accioEnBloc, type ElementBloc } from "@/lib/accions";
import { MotiusRapids } from "@/components/AjudesReplanificar";

type Ctx = {
  seleccionats: Map<string, ElementBloc>;
  commuta: (e: ElementBloc) => void;
};

const SeleccioCtx = createContext<Ctx | null>(null);
export const useSeleccio = () => useContext(SeleccioCtx);
export const clauElement = (e: Pick<ElementBloc, "taula" | "id">) => `${e.taula}:${e.id}`;

// Selecció de diverses línies de la safata per actuar-hi de cop: quan hi ha
// quaranta vençuts acumulats, una a una no s'hi posa ningú (§10).
export function Seleccio({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [seleccionats, setSeleccionats] = useState<Map<string, ElementBloc>>(new Map());
  const [motiu, setMotiu] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendent, startTransition] = useTransition();

  const commuta = (e: ElementBloc) =>
    setSeleccionats((ant) => {
      const nou = new Map(ant);
      const k = clauElement(e);
      if (nou.has(k)) nou.delete(k);
      else nou.set(k, e);
      return nou;
    });

  const fes = (accio: "setmana" | "dia" | "revisat" | "fet") =>
    startTransition(async () => {
      setError(null);
      const r = await accioEnBloc([...seleccionats.values()], accio, motiu);
      if (r.error) setError(r.error);
      setSeleccionats(new Map());
      setMotiu("");
      router.refresh();
    });

  const n = seleccionats.size;
  return (
    <SeleccioCtx.Provider value={{ seleccionats, commuta }}>
      {n > 0 && (
        <div className="barra-bloc" role="region" aria-label="accions en bloc">
          <strong>{n} {n === 1 ? "seleccionat" : "seleccionats"}</strong>
          <button className="boto boto-fet" disabled={pendent} onClick={() => fes("fet")}>
            <Check className="icona-petita" aria-hidden /> fet avui
          </button>
          <button className="boto" disabled={pendent} onClick={() => fes("dia")}>
            <CalendarClock className="icona-petita" aria-hidden /> +1 dia
          </button>
          <button className="boto" disabled={pendent} onClick={() => fes("setmana")}>
            <CalendarClock className="icona-petita" aria-hidden /> +1 setm.
          </button>
          <MotiusRapids motiu={motiu} setMotiu={setMotiu} />
          <button className="boto" disabled={pendent} onClick={() => fes("revisat")}>
            <Clock className="icona-petita" aria-hidden /> revisat
          </button>
          <button className="boto boto-suau boto-icona" aria-label="treu la selecció" onClick={() => setSeleccionats(new Map())}>
            <X className="icona-petita" aria-hidden />
          </button>
          {error && <span className="error" role="alert">{error}</span>}
        </div>
      )}
      {children}
    </SeleccioCtx.Provider>
  );
}
