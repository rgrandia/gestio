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
