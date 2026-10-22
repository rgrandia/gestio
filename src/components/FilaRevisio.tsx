"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, CornerUpLeft, X } from "lucide-react";
import { resolRevisio } from "@/lib/accions";

// Fila d'una revisió pendent. El revisor l'aprova o la retorna amb un
// comentari; qui l'ha demanada la pot cancel·lar.
export function FilaRevisio({ id, soc, children }: { id: string; soc: "revisor" | "demanant"; children: ReactNode }) {
  const router = useRouter();
  const [retornant, setRetornant] = useState(false);
  const [comentari, setComentari] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendent, startTransition] = useTransition();

  const resol = (estat: "aprovada" | "retornada" | "cancellada") =>
    startTransition(async () => {
      setError(null);
      const r = await resolRevisio(id, estat, comentari);
      if (r.error) return setError(r.error);
      router.refresh();
    });

  return (
    <tr className={retornant || error ? "expandida" : ""}>
      {children}
      <td className="accions">
        {soc === "demanant" ? (
          <button className="boto boto-suau boto-perill boto-icona" disabled={pendent} onClick={() => resol("cancellada")} data-tip="cancel·lar la revisió">
            <X className="icona-petita" aria-hidden /> <span className="sr-only">cancel·lar</span>
          </button>
        ) : retornant ? (
          <form
            className="inline-flex flex-wrap gap-1 items-center justify-end"
            onSubmit={(e) => {
              e.preventDefault();
              resol("retornada");
            }}
          >
            <input
              autoFocus
              required
              placeholder="què cal canviar?"
              aria-label="comentari"
              value={comentari}
              onChange={(e) => setComentari(e.target.value)}
              style={{ minWidth: "16rem" }}
            />
            <button className="boto boto-primari" disabled={pendent}>retornar</button>
            <button type="button" className="boto boto-suau boto-icona" aria-label="tanca" onClick={() => setRetornant(false)}>
              <X className="icona-petita" aria-hidden />
            </button>
          </form>
        ) : (
          <>
            <button className="boto boto-fet boto-icona" disabled={pendent} onClick={() => resol("aprovada")} data-tip="aprovar">
              <Check className="icona-petita" aria-hidden /> <span className="sr-only">aprovar</span>
            </button>
            <button className="boto boto-suau boto-icona" disabled={pendent} onClick={() => setRetornant(true)} data-tip="retornar amb un comentari">
              <CornerUpLeft className="icona-petita" aria-hidden /> <span className="sr-only">retornar</span>
            </button>
          </>
        )}
        {error && <div className="error" role="alert">{error}</div>}
      </td>
    </tr>
  );
}
