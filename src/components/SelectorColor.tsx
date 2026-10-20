// Paleta compartida amb la migració 0008 (paleta_colors()).
export const PALETA = ["#2563EB", "#DB2777", "#059669", "#EA580C", "#7C3AED", "#0891B2", "#CA8A04", "#475569"];

// Quadrats de color per triar-ne un. Els que ja fa servir un altre membre
// surten desactivats i amb el seu nom al títol.
export function SelectorColor({
  actual,
  ocupats,
}: {
  actual: string | null;
  ocupats: Map<string, string>; // color -> nom de qui el fa servir
}) {
  return (
    <span className="selector-color" role="radiogroup" aria-label="color">
      {PALETA.map((c) => {
        const qui = ocupats.get(c);
        return (
          <label key={c} title={qui ? `el fa servir ${qui}` : c}>
            <input type="radio" name="color" value={c} defaultChecked={c === actual} disabled={Boolean(qui)} />
            <span style={{ background: c }} />
          </label>
        );
      })}
    </span>
  );
}
