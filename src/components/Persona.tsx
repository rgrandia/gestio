// Inicial en un quadrat de color estable per persona + nom.
const COLORS = ["#2563EB", "#7C3AED", "#0891B2", "#DB2777", "#EA580C", "#059669"];

function colorDe(nom: string): string {
  let h = 0;
  for (const c of nom) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

export function Persona({
  nom,
  nomesAvatar = false,
  gran = false,
  extern = false,
}: {
  nom: string | null | undefined;
  nomesAvatar?: boolean;
  gran?: boolean;
  extern?: boolean; // sense accés a l'app: avatar buit amb vora discontínua
}) {
  if (!nom) return <span className="fluix">—</span>;
  const avatar = (
    <span
      className={["avatar", gran ? "gran" : "", extern ? "extern" : ""].join(" ")}
      style={extern ? { color: colorDe(nom), borderColor: colorDe(nom) } : { background: colorDe(nom) }}
      aria-hidden={!nomesAvatar}
      title={extern ? `${nom} (extern, sense accés)` : nom}
    >
      {nom.slice(0, 1).toUpperCase()}
    </span>
  );
  if (nomesAvatar) return avatar;
  return (
    <span className="persona">
      {avatar}
      {nom}
    </span>
  );
}
