import { History } from "lucide-react";

// Quantes vegades s'ha mogut la data prevista d'un element (sense comptar la
// primera planificació). És el que fa visible que una cosa ha anat lliscant.
export function Replanificat({ n }: { n: number | undefined }) {
  if (!n) return null;
  return (
    <span
      className={`etiqueta replanificat ${n >= 3 ? "tag-vencut" : "tag-risc"}`}
      title={`replanificat ${n} ${n === 1 ? "vegada" : "vegades"}`}
    >
      <History className="icona-petita" aria-hidden />×{n}
    </span>
  );
}
