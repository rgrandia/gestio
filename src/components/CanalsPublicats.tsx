"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Undo2 } from "lucide-react";
import { desmarcaCanal } from "@/lib/accions-xarxes";
import { PLATAFORMES, type Plataforma } from "@/lib/xarxes";
import { dataCurta } from "@/lib/dates";

type Canal = { compte_id: string; nom: string; plataforma: Plataforma; enllac_publicat: string | null; publicat_el: string | null };

// A cada xarxa, si ja hi consta publicada (migració 0023), amb l'enllaç. Es
// pot desfer per a una sola xarxa: si la publicació ja era publicada, torna a
// programada fins que les tingui totes.
export function CanalsPublicats({ id, canals, editable }: { id: string; canals: Canal[]; editable: boolean }) {
  const router = useRouter();
  const [pendent, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const desfes = (compte_id: string) =>
    startTransition(async () => {
      setError(null);
      const r = await desmarcaCanal(id, compte_id);
      if (r.error) return setError(r.error);
      router.refresh();
    });

  return (
    <>
      <ul className="llista-compacta canals-publicats">
        {canals.map((c) => (
          <li key={c.compte_id} data-publicat={c.publicat_el ? "si" : "no"}>
            <span className="flex items-center gap-2">
              <span className="xarxa" style={{ background: PLATAFORMES[c.plataforma].color }}>{PLATAFORMES[c.plataforma].curt}</span>
              {c.enllac_publicat ? (
                <a href={c.enllac_publicat} target="_blank" rel="noreferrer">
                  {c.nom} <ExternalLink className="icona-petita inline" aria-hidden />
                </a>
              ) : (
                <span>{c.nom}</span>
              )}
              {c.publicat_el && editable && (
                <button
                  type="button"
                  className="boto-icona ml-auto"
                  disabled={pendent}
                  onClick={() => desfes(c.compte_id)}
                  title={`desfer: no consta publicada a ${c.nom}`}
                  aria-label={`desfer publicada a ${c.nom}`}
                >
                  <Undo2 className="icona-petita" aria-hidden />
                </button>
              )}
            </span>
            <span className="on">{c.publicat_el ? `publicada el ${dataCurta(c.publicat_el)}` : "encara no consta publicada"}</span>
          </li>
        ))}
      </ul>
      {error && <div className="error mx-3 mb-2" role="alert">{error}</div>}
    </>
  );
}
