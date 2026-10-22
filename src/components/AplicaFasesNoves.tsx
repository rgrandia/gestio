"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListRestart, X } from "lucide-react";
import { aplicaFasesPerDefecte } from "@/lib/accions";

// Estudi creat amb les fases d'abans d'octubre de 2026 i encara no començat:
// es pot passar a les noves sense perdre dates, persones ni tasques.
export function AplicaFasesNoves({ projecteId }: { projecteId: string }) {
  const router = useRouter();
  const [obert, setObert] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendent, startTransition] = useTransition();

  return (
    <div className="avis-fases-noves">
      <p className="petit">
        Aquest estudi té les fases per defecte antigues i encara no ha començat.{" "}
        {!obert && (
          <button className="enllac" onClick={() => setObert(true)}>
            Passa&apos;l a les fases noves
          </button>
        )}
      </p>
      {obert && (
        <div className="flex flex-wrap gap-2 items-center mt-2">
          <span className="petit suau">
            Qüestionari → Qüestionari i mostra, Tabulació → Dades, s&apos;afegeix Briefing i es cancel·la Revisió (les
            seves tasques hi continuen penjant). Les dates, les persones i les tasques de la resta es conserven.
          </span>
          <button
            className="boto boto-primari"
            disabled={pendent}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const r = await aplicaFasesPerDefecte(projecteId);
                if (r.error) return setError(r.error);
                setObert(false);
                router.refresh();
              })
            }
          >
            <ListRestart className="icona-petita" aria-hidden /> aplicar les fases noves
          </button>
          <button type="button" className="boto boto-suau boto-icona" aria-label="tanca" onClick={() => setObert(false)}>
            <X className="icona-petita" aria-hidden />
          </button>
        </div>
      )}
      {error && <div className="error" role="alert">{error}</div>}
    </div>
  );
}
