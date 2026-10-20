import type { Perfil } from "@/lib/tipus";

// Color de reserva per si un perfil encara no en té (abans de la migració 0008).
const COLORS = ["#2563EB", "#DB2777", "#059669", "#EA580C", "#7C3AED", "#0891B2"];
function colorDe(nom: string): string {
  let h = 0;
  for (const c of nom) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

type PersonaMinima = Pick<Perfil, "nom" | "extern"> & { color?: string | null };

// Avatar quadrat amb inicial, del color propi de cada persona, + nom.
// Externs (sense accés a l'app): avatar buit amb vora discontínua.
export function Persona({
  p,
  nomesAvatar = false,
  gran = false,
}: {
  p: PersonaMinima | null | undefined;
  nomesAvatar?: boolean;
  gran?: boolean;
}) {
  if (!p) return <span className="fluix">—</span>;
  const color = p.color ?? colorDe(p.nom);
  const avatar = (
    <span
      className={["avatar", gran ? "gran" : "", p.extern ? "extern" : ""].join(" ")}
      style={p.extern ? { color, borderColor: color } : { background: color }}
      aria-hidden={!nomesAvatar}
      title={p.extern ? `${p.nom} (extern, sense accés)` : p.nom}
    >
      {p.nom.slice(0, 1).toUpperCase()}
    </span>
  );
  if (nomesAvatar) return avatar;
  return (
    <span className="persona">
      {avatar}
      {p.nom}
    </span>
  );
}
