// Totes les dates de negoci són `date` (sense hora) en format ISO
// AAAA-MM-DD. "Avui" és avui a Barcelona, no a UTC.

const ZONA = "Europe/Madrid";

export function avui(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date());
}

export function sumaDies(iso: string, dies: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + dies);
  return d.toISOString().slice(0, 10);
}

export function diesEntre(desDe: string, fins: string): number {
  return Math.round(
    (Date.parse(fins + "T00:00:00Z") - Date.parse(desDe + "T00:00:00Z")) / 86_400_000,
  );
}

// Desplaçament signat respecte d'avui (§11.5): -14d = fa 14 dies, +2d = d'aquí 2.
export function desplacament(dies: number): string {
  if (dies === 0) return "0d";
  return `${dies > 0 ? "+" : "-"}${Math.abs(dies)}d`;
}

const DIES = ["dg", "dl", "dt", "dc", "dj", "dv", "ds"];

// "dc 22"
export function diaCurt(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${DIES[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, "0")}`;
}

// "22/10/26"
export function dataCurta(iso: string | null): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a.slice(2)}`;
}

export function esDataValida(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));
}
