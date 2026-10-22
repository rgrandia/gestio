"use client";

import { Printer } from "lucide-react";

export function BotoImprimir() {
  return (
    <button className="boto amaga-imprimir" onClick={() => window.print()}>
      <Printer className="icona-petita" aria-hidden /> imprimir
    </button>
  );
}
