"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Info, X } from "lucide-react";

// Avisos flotants breus (cantonada inferior). No bloquegen res: diuen el que
// s'ha fet de més o el que cal saber, i poden dur botons d'un clic (p. ex. el
// motiu després d'arrossegar). Es criden amb mostraToast() des de qualsevol
// component client; <Toasts /> és al layout de l'app.

type Accio = { etiqueta: string; fes: () => Promise<{ error?: string }> };
export type Toast = { text: string; tipus?: "info" | "avis"; accions?: Accio[]; durada?: number };
type ToastViu = Toast & { id: number; fet?: string };

let seguent = 1;
const oients = new Set<(t: ToastViu) => void>();

export function mostraToast(t: Toast) {
  const viu = { ...t, id: seguent++ };
  oients.forEach((o) => o(viu));
}

export function Toasts() {
  const [llista, setLlista] = useState<ToastViu[]>([]);

  useEffect(() => {
    const oient = (t: ToastViu) => {
      setLlista((l) => [...l.slice(-2), t]);
      setTimeout(() => setLlista((l) => l.filter((x) => x.id !== t.id)), t.durada ?? 6000);
    };
    oients.add(oient);
    return () => {
      oients.delete(oient);
    };
  }, []);

  const tanca = (id: number) => setLlista((l) => l.filter((x) => x.id !== id));
  const marca = (id: number, fet: string) => setLlista((l) => l.map((x) => (x.id === id ? { ...x, fet, accions: [] } : x)));

  return (
    <div className="toasts" aria-live="polite">
      {llista.map((t) => (
        <div key={t.id} className={`toast toast-${t.tipus ?? "info"}`} role={t.tipus === "avis" ? "alert" : "status"}>
          {t.tipus === "avis" ? <AlertTriangle className="icona-petita" aria-hidden /> : <Info className="icona-petita" aria-hidden />}
          <div className="toast-cos">
            <span>{t.fet ?? t.text}</span>
            {!!t.accions?.length && (
              <span className="xips">
                {t.accions.map((a) => (
                  <button
                    key={a.etiqueta}
                    type="button"
                    className="xip"
                    onClick={async () => {
                      const r = await a.fes();
                      marca(t.id, r.error ?? `Motiu desat: ${a.etiqueta}`);
                    }}
                  >
                    {a.etiqueta}
                  </button>
                ))}
              </span>
            )}
            {t.fet && !t.fet.startsWith("Ja no") && <Check className="icona-petita" aria-hidden />}
          </div>
          <button type="button" className="boto boto-suau boto-icona" aria-label="tanca l'avís" onClick={() => tanca(t.id)}>
            <X className="icona-petita" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
