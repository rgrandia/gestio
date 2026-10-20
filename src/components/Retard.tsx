import { desplacament, diesEntre } from "@/lib/dates";

// Previst contra real: retard d'una fase acabada o desplaçament d'una oberta.
export function Retard({ prevista, real, hui }: { prevista: string | null; real: string | null; hui: string }) {
  if (!prevista) return <span className="suau">—</span>;
  if (real) {
    const d = diesEntre(prevista, real);
    if (d <= 0) return <span className="tag tag-fet">a temps</span>;
    return <span className="tag tag-vencut">{d}d tard</span>;
  }
  const d = diesEntre(hui, prevista);
  const classe = d < 0 ? "tag-vencut" : d <= 5 ? "tag-risc" : "suau";
  return <span className={`tag ${classe}`}>{desplacament(d)}</span>;
}

// Valor de data-estat per al filet esquerre d'un element obert
export function estatFila(
  prevista: string | null,
  real: string | null,
  estat: string,
  hui: string,
): string | undefined {
  if (estat === "cancellat") return "cancellat";
  if (real || estat === "fet") return "fet";
  if (!prevista) return undefined;
  const d = diesEntre(hui, prevista);
  if (d < 0) return "vencut";
  if (d <= 5) return "risc";
  return undefined;
}
