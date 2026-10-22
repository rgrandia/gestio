"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, X } from "lucide-react";
import { enviaARevisar } from "@/lib/accions";

export type DarreraRevisio = {
  estat: "pendent" | "aprovada" | "retornada" | "cancellada";
  revisor: string;
  comentari: string | null;
};

// Estat de la darrera revisió d'una tasca o d'un entregable.
export function EtiquetaRevisio({ r }: { r: DarreraRevisio | undefined }) {
  if (!r || r.estat === "cancellada") return null;
  if (r.estat === "pendent")
    return <span className="etiqueta tag-accent ml-1" title={`la revisa ${r.revisor}`}>en revisió · {r.revisor}</span>;
  if (r.estat === "aprovada")
    return <span className="etiqueta tag-fet ml-1" title={`aprovada per ${r.revisor}`}>revisada · {r.revisor}</span>;
  return (
    <span className="etiqueta tag-vencut ml-1" title={`${r.revisor}: ${r.comentari ?? ""}`}>
      retornada: {r.comentari}
    </span>
  );
}

// Enviar a revisar una tasca o un entregable que ja està fet.
export function EnviaARevisar({
  taula,
  id,
  revisors,
}: {
  taula: "tasques" | "entregables";
  id: string;
  revisors: { id: string; nom: string }[];
}) {
  const router = useRouter();
  const [obert, setObert] = useState(false);
  const [revisor, setRevisor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendent, startTransition] = useTransition();

  if (revisors.length === 0) return null;
  if (!obert)
    return (
      <button className="enllac petit ml-2" onClick={() => setObert(true)}>
        enviar a revisar
      </button>
    );
  return (
    <form
      className="inline-flex flex-wrap gap-1 items-center ml-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          const r = await enviaARevisar(taula, id, revisor);
          if (r.error) return setError(r.error);
          setObert(false);
          router.refresh();
        });
      }}
    >
      <select required value={revisor} onChange={(e) => setRevisor(e.target.value)} aria-label="qui la revisa">
        <option value="" disabled>qui la revisa…</option>
        {revisors.map((r) => <option key={r.id} value={r.id}>{r.nom}</option>)}
      </select>
      <button className="boto boto-primari" disabled={pendent}><Send className="icona-petita" aria-hidden /> enviar</button>
      <button type="button" className="boto boto-suau boto-icona" aria-label="tanca" onClick={() => setObert(false)}>
        <X className="icona-petita" aria-hidden />
      </button>
      {error && <span className="error" role="alert">{error}</span>}
    </form>
  );
}
