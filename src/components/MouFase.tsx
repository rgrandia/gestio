"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { mouFase } from "@/lib/accions";

export function MouFase({ id, primera, darrera }: { id: string; primera: boolean; darrera: boolean }) {
  const router = useRouter();
  const [pendent, startTransition] = useTransition();
  const mou = (d: -1 | 1) =>
    startTransition(async () => {
      const r = await mouFase(id, d);
      if (r.error) alert(r.error);
      router.refresh();
    });
  return (
    <span className="nowrap">
      <button className="enllac" aria-label="puja" disabled={pendent || primera} onClick={() => mou(-1)}><ArrowUp className="icona-petita" aria-hidden /></button>{" "}
      <button className="enllac" aria-label="baixa" disabled={pendent || darrera} onClick={() => mou(1)}><ArrowDown className="icona-petita" aria-hidden /></button>
    </span>
  );
}
