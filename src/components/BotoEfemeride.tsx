"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, X } from "lucide-react";
import { activaEfemeride } from "@/lib/accions-xarxes";

// Treure o tornar a posar una data clau al calendari (res no s'esborra, §7.2).
export function BotoEfemeride({ id, actiu }: { id: string; actiu: boolean }) {
  const router = useRouter();
  const [pendent, startTransition] = useTransition();
  const canvia = () =>
    startTransition(async () => {
      await activaEfemeride(id, !actiu);
      router.refresh();
    });
  return actiu ? (
    <button className="boto boto-suau boto-perill boto-icona" disabled={pendent} onClick={canvia} data-tip="treure del calendari">
      <X className="icona-petita" aria-hidden /> <span className="sr-only">treure del calendari</span>
    </button>
  ) : (
    <button className="boto boto-suau boto-icona" disabled={pendent} onClick={canvia} data-tip="tornar-la a posar">
      <RotateCcw className="icona-petita" aria-hidden /> <span className="sr-only">tornar-la a posar</span>
    </button>
  );
}
