"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { diaCurt, sumaDies } from "@/lib/dates";
import { posaMotiu } from "@/lib/accions";
import { MOTIUS_RAPIDS } from "@/components/AjudesReplanificar";
import { mostraToast } from "@/components/Toasts";

export const SENSE_DATA = "sense-data";

type Arrossegant = { id: string; x: number; y: number; dx: number; dy: number; amplada: number };

// Arrossegar targetes entre dies (planner de xarxes i calendari de l'inici).
// Funciona amb ratolí i amb el dit (pointer events des d'una nansa, amb
// `touch-action: none`) i amb el teclat (nansa + ←/→; Supr per treure la data
// si `senseData`). Els destins són elements amb `data-desti` (una data ISO o
// SENSE_DATA). Moure és desar a la base de dades amb `desa`; si falla, es
// desfà. Mai al passat. Després, un avís ofereix posar el motiu d'un clic.
export function useArrossegar({
  items,
  hui,
  desa,
  senseData = false,
  historial,
}: {
  items: { id: string; data: string | null }[];
  hui: string;
  desa: (id: string, data: string | null) => Promise<{ error?: string; avis?: string }>;
  senseData?: boolean;
  // A quina fila de l'historial va el motiu d'un clic (migració 0021).
  historial: (id: string) => { taula: "tasques" | "publicacions"; id: string };
}) {
  const router = useRouter();
  const [dates, setDates] = useState<Record<string, string | null>>(() => Object.fromEntries(items.map((i) => [i.id, i.data])));
  const [arrossegant, setArrossegant] = useState<Arrossegant | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [desant, setDesant] = useState<string | null>(null);
  const anunci = useRef<HTMLDivElement>(null);

  const permes = (desti: string) => (desti === SENSE_DATA ? senseData : desti >= hui);

  const mou = async (id: string, desti: string) => {
    const nova = desti === SENSE_DATA ? null : desti;
    const abans = dates[id] ?? null;
    if (nova === abans) return;
    if (!permes(desti)) {
      setError(desti === SENSE_DATA ? "Aquí no es pot treure la data." : "No es pot planificar al passat.");
      return;
    }
    setError(null);
    setDates((d) => ({ ...d, [id]: nova }));
    setDesant(id);
    const r = await desa(id, nova);
    setDesant(null);
    if (r.error) {
      setDates((d) => ({ ...d, [id]: abans }));
      setError(r.error);
      return;
    }
    if (anunci.current) anunci.current.textContent = nova ? `Mogut al ${diaCurt(nova)}` : "Sense data";
    // Arrossegar desa «sense motiu»; durant uns segons es pot dir per què
    // amb un clic (si ja tenia data: posar-ne la primera no és lliscar).
    if (abans && nova) {
      const h = historial(id);
      mostraToast({
        text: `Mogut al ${diaCurt(nova)}. Per què?`,
        durada: 8000,
        accions: MOTIUS_RAPIDS.map((m) => ({ etiqueta: m, fes: () => posaMotiu(h.taula, h.id, m) })),
      });
    }
    if (r.avis) mostraToast({ text: r.avis, tipus: "avis", durada: 9000 });
    router.refresh();
  };

  const destiA = (x: number, y: number): string | null =>
    document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-desti]")?.dataset.desti ?? null;

  // Propietats per al botó-nansa de cada targeta (classe .targeta-arrossegable).
  const nansa = (id: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      const r = e.currentTarget.closest<HTMLElement>(".targeta-arrossegable")!.getBoundingClientRect();
      e.currentTarget.setPointerCapture(e.pointerId);
      setArrossegant({ id, x: e.clientX, y: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, amplada: r.width });
    },
    onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!arrossegant) return;
      // a prop de la vora de la finestra, la pàgina es desplaça sola
      if (e.clientY > window.innerHeight - 48) window.scrollBy(0, 16);
      else if (e.clientY < 48) window.scrollBy(0, -16);
      setArrossegant({ ...arrossegant, x: e.clientX, y: e.clientY });
      setSobre(destiA(e.clientX, e.clientY));
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!arrossegant) return;
      const desti = destiA(e.clientX, e.clientY);
      setArrossegant(null);
      setSobre(null);
      if (desti) mou(id, desti);
    },
    onPointerCancel: () => {
      setArrossegant(null);
      setSobre(null);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => {
      const ara = dates[id];
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        mou(id, ara ? sumaDies(ara, e.key === "ArrowRight" ? 1 : -1) : hui);
      } else if (senseData && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        mou(id, SENSE_DATA);
      }
    },
  });

  // Classe d'un destí mentre s'hi passa per sobre.
  const classeDesti = (desti: string) => (sobre === desti ? (permes(desti) ? "sobre" : "prohibit") : "");
  // Posició de la còpia que segueix el punter.
  const fantasma = arrossegant
    ? { id: arrossegant.id, style: { left: arrossegant.x - arrossegant.dx, top: arrossegant.y - arrossegant.dy, width: arrossegant.amplada } }
    : null;

  return { dates, arrossegant: arrossegant?.id ?? null, desant, error, anunci, nansa, classeDesti, fantasma };
}
