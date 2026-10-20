"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { accioItem } from "@/lib/accions";

// La data de fi prevista d'un projecte també passa per replanificar() (§4.2).
export function ReplanificaProjecte({ id, tePrevista }: { id: string; tePrevista: boolean }) {
  const router = useRouter();
  const [obert, setObert] = useState(false);
  const [data, setData] = useState("");
  const [motiu, setMotiu] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendent, startTransition] = useTransition();

  if (!obert)
    return (
      <button className="boto boto-suau" onClick={() => setObert(true)}>
        <CalendarClock className="icona-petita" aria-hidden /> {tePrevista ? "replanificar" : "planificar"}
      </button>
    );

  return (
    <form
      className="inline-flex flex-wrap gap-1 items-center ml-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const r = await accioItem({ accio: "replanificar", taula: "projectes", id, data, motiu });
          if (r.error) return setError(r.error);
          setObert(false);
          router.refresh();
        });
      }}
    >
      <input type="date" aria-label="nova fi prevista" required autoFocus value={data} onChange={(e) => setData(e.target.value)} />
      {tePrevista && (
        <input
          type="text"
          aria-label="motiu"
          placeholder="motiu (obligatori)"
          required
          minLength={3}
          className="font-sans"
          value={motiu}
          onChange={(e) => setMotiu(e.target.value)}
        />
      )}
      <button className="boto boto-primari" disabled={pendent}>desar</button>
      <button type="button" className="boto" onClick={() => setObert(false)}>×</button>
      {error && <span className="error" role="alert">{error}</span>}
    </form>
  );
}
