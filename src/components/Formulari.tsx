"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import type { Resultat } from "@/lib/accions";

type Props = {
  accio: (prev: Resultat, fd: FormData) => Promise<Resultat>;
  className?: string;
  boto: string;
  buidaEnDesar?: boolean;
  children: ReactNode;
};

// Formulari genèric: mostra l'error que retorna l'acció i, si cal, es buida.
export function Formulari({ accio, className = "formulari", boto, buidaEnDesar = false, children }: Props) {
  const [estat, envia, pendent] = useActionState(accio, {});
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estat.ok && buidaEnDesar) ref.current?.reset();
  }, [estat, buidaEnDesar]);

  return (
    <form ref={ref} action={envia} className={className}>
      {children}
      <div className="flex items-center gap-2">
        <button className="boto boto-primari" disabled={pendent}>{boto}</button>
        {estat.error && <span className="error" role="alert">{estat.error}</span>}
        {estat.ok && !buidaEnDesar && <span className="petit suau">desat</span>}
      </div>
    </form>
  );
}
