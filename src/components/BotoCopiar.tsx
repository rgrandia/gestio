"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

// Copia un text preparat (p. ex. el resum setmanal) per enganxar-lo a Teams o
// a un correu. Sense enviar res des de l'app (§2).
export function BotoCopiar({ text, etiqueta = "copiar com a text" }: { text: string; etiqueta?: string }) {
  const [fet, setFet] = useState(false);
  const copia = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Navegadors sense permís de porta-retalls: un textarea temporal.
      const t = document.createElement("textarea");
      t.value = text;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setFet(true);
    setTimeout(() => setFet(false), 2000);
  };
  return (
    <button className="boto amaga-imprimir" onClick={copia}>
      {fet ? <Check className="icona-petita" aria-hidden /> : <Copy className="icona-petita" aria-hidden />}
      {fet ? " copiat" : ` ${etiqueta}`}
    </button>
  );
}
