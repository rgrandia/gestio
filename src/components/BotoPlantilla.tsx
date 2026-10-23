"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, X } from "lucide-react";
import { activaPlantilla } from "@/lib/accions";

// Desactivar o reactivar una línia de plantilla (res no s'esborra, §7.2).
export function BotoPlantilla({ id, actiu }: { id: string; actiu: boolean }) {
  const router = useRouter();
  const [pendent, startTransition] = useTransition();
  const canvia = () =>
    startTransition(async () => {
      await activaPlantilla(id, !actiu);
      router.refresh();
    });
  return actiu ? (
    <button className="boto boto-suau boto-perill boto-icona" disabled={pendent} onClick={canvia} data-tip="treure de la plantilla">
      <X className="icona-petita" aria-hidden /> <span className="sr-only">treure</span>
    </button>
  ) : (
    <button className="boto boto-suau boto-icona" disabled={pendent} onClick={canvia} data-tip="tornar-la a posar">
      <RotateCcw className="icona-petita" aria-hidden /> <span className="sr-only">tornar-la a posar</span>
    </button>
  );
}
