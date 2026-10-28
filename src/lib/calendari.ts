// Calendari personal (migració 0020). Compartit entre servidor i navegador.

export type TipusDia = "oficina" | "teletreball" | "fora" | "vacances" | "festiu";

// `laborable`: si aquell dia es treballa (per avisar si hi cau una tasca).
export const TIPUS_DIA: Record<TipusDia, { nom: string; color: string; laborable: boolean }> = {
  oficina: { nom: "oficina", color: "#2563EB", laborable: true },
  teletreball: { nom: "teletreball", color: "#0D9488", laborable: true },
  fora: { nom: "fora", color: "#7C3AED", laborable: true },
  vacances: { nom: "vacances", color: "#D97706", laborable: false },
  festiu: { nom: "festiu", color: "#DC2626", laborable: false },
};
export const LLISTA_TIPUS_DIA = Object.keys(TIPUS_DIA) as TipusDia[];

export type DiaMarcat = { perfil_id: string | null; data: string; tipus: TipusDia; nota: string | null };

// "vacances 3/11–7/11", "teletreball 30/10": dies seguits del mateix tipus,
// agrupats. Per a «feina de l'equip» (qui no hi serà els propers dies).
export function trams(dies: { data: string; tipus: TipusDia }[]): { tipus: TipusDia; text: string }[] {
  const ordenats = [...dies].sort((a, b) => a.data.localeCompare(b.data));
  const curt = (iso: string) => `${Number(iso.slice(8))}/${Number(iso.slice(5, 7))}`;
  const seguent = (iso: string) => {
    const d = new Date(iso + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  };
  const res: { tipus: TipusDia; ini: string; fi: string }[] = [];
  for (const d of ordenats) {
    const darrer = res[res.length - 1];
    if (darrer && darrer.tipus === d.tipus && seguent(darrer.fi) === d.data) darrer.fi = d.data;
    else res.push({ tipus: d.tipus, ini: d.data, fi: d.data });
  }
  return res.map((t) => ({ tipus: t.tipus, text: t.ini === t.fi ? curt(t.ini) : `${curt(t.ini)}–${curt(t.fi)}` }));
}
