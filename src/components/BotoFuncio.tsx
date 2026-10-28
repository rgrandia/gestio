"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Megaphone } from "lucide-react";
import { activaFuncio } from "@/lib/accions-xarxes";

// Activar o desactivar les xarxes socials a un membre (migració 0019). La pot
// donar qui ja la té; si no la té ningú, qualsevol (per començar).
export function BotoFuncio({ persona, actiu, potCanviar }: { persona: string; actiu: boolean; potCanviar: boolean }) {
  const router = useRouter();
  const [pendent, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!potCanviar)
    return actiu ? <span className="etiqueta tag-accent"><Megaphone className="icona-petita inline" aria-hidden /> xarxes</span> : null;
  return (
    <span className="inline-flex items-center gap-2">
      <button
        className={`boto ${actiu ? "boto-suau" : ""}`}
        disabled={pendent}
        aria-pressed={actiu}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await activaFuncio(persona, !actiu);
            if (r.error) return setError(r.error);
            router.refresh();
          })
        }
        title={actiu ? "desactivar les xarxes socials" : "activar les xarxes socials"}
      >
        <Megaphone className="icona-petita" aria-hidden /> {actiu ? "xarxes activades" : "activar xarxes"}
      </button>
      {error && <span className="error" role="alert">{error}</span>}
    </span>
  );
}
