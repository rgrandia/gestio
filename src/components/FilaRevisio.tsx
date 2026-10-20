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
          <button className="boto boto-suau boto-perill" disabled={pendent} onClick={() => resol("cancellada")}>
            <X className="icona-petita" aria-hidden /> <span className="text-boto">cancel·lar</span>
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
            <button className="boto boto-fet" disabled={pendent} onClick={() => resol("aprovada")}>
              <Check className="icona-petita" aria-hidden /> aprovar
            </button>
            <button className="boto boto-suau" disabled={pendent} onClick={() => setRetornant(true)}>
              <CornerUpLeft className="icona-petita" aria-hidden /> <span className="text-boto">retornar</span>
            </button>
          </>
        )}
        {error && <div className="error" role="alert">{error}</div>}
      </td>
    </tr>
  );
}
