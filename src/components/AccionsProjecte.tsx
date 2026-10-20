"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, RotateCcw, Trash2 } from "lucide-react";
import { arxivaProjecte, eliminaProjecte } from "@/lib/accions";

type Props = { id: string; titol: string; arxivat: boolean; eliminat: boolean };

export function AccionsProjecte({ id, titol, arxivat, eliminat }: Props) {
  const router = useRouter();
  const [pendent, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const executa = (crida: () => ReturnType<typeof arxivaProjecte>, despres?: string) =>
    startTransition(async () => {
      setError(null);
      const r = await crida();
      if (r.error) return setError(r.error);
      if (despres) router.push(despres);
      else router.refresh();
    });

  if (eliminat) {
    return (
      <span className="flex items-center gap-2">
        <button className="boto boto-primari" disabled={pendent} onClick={() => executa(() => eliminaProjecte(id, false))}>
          <RotateCcw className="icona-petita" aria-hidden /> restaurar
        </button>
        {error && <span className="error" role="alert">{error}</span>}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <button
        className="boto"
        disabled={pendent}
        title={arxivat ? "tornar-lo a la feina diària" : "treure'l de la safata i de les llistes"}
        onClick={() => executa(() => arxivaProjecte(id, !arxivat))}
      >
        {arxivat ? <ArchiveRestore className="icona-petita" aria-hidden /> : <Archive className="icona-petita" aria-hidden />}
        {arxivat ? "desarxivar" : "arxivar"}
      </button>
      <button
        className="boto boto-suau boto-perill"
        disabled={pendent}
        onClick={() => {
          if (confirm(`Enviar «${titol}» a la paperera? Desapareixerà de tot arreu, però es pot restaurar des de la paperera.`))
            executa(() => eliminaProjecte(id, true), "/projectes");
        }}
      >
        <Trash2 className="icona-petita" aria-hidden /> eliminar
      </button>
      {error && <span className="error" role="alert">{error}</span>}
    </span>
  );
}
