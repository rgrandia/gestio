// Xarxes socials (migració 0019). Codi compartit entre servidor i navegador.

export type Plataforma =
  | "x"
  | "linkedin"
  | "instagram"
  | "facebook"
  | "bluesky"
  | "threads"
  | "mastodon"
  | "youtube"
  | "tiktok"
  | "altra";

export type EstatPublicacio =
  | "idea"
  | "esborrany"
  | "revisio"
  | "aprovada"
  | "programada"
  | "publicada"
  | "cancellada";

// `limit`: caràcters màxims del text d'una publicació normal (sense
// subscripcions de pagament; a Mastodon depèn del servidor, 500 per defecte). `enllac`: quant compta un enllaç, si la xarxa
// l'escurça (X: 23). `visual`: no es pot publicar sense imatge o vídeo.
export const PLATAFORMES: Record<
  Plataforma,
  { nom: string; curt: string; limit: number | null; enllac?: number; visual?: boolean; color: string }
> = {
  x: { nom: "X", curt: "X", limit: 280, enllac: 23, color: "#111827" },
  linkedin: { nom: "LinkedIn", curt: "in", limit: 3000, color: "#0A66C2" },
  instagram: { nom: "Instagram", curt: "IG", limit: 2200, visual: true, color: "#C13584" },
  facebook: { nom: "Facebook", curt: "fb", limit: 63206, color: "#1877F2" },
  bluesky: { nom: "Bluesky", curt: "bs", limit: 300, color: "#0085FF" },
  threads: { nom: "Threads", curt: "th", limit: 500, color: "#404040" },
  mastodon: { nom: "Mastodon", curt: "ma", limit: 500, color: "#6364FF" },
  youtube: { nom: "YouTube", curt: "YT", limit: 5000, visual: true, color: "#DC2626" },
  tiktok: { nom: "TikTok", curt: "tt", limit: null, visual: true, color: "#0F766E" },
  altra: { nom: "Altra", curt: "··", limit: null, color: "#6B7280" },
};
export const LLISTA_PLATAFORMES = Object.keys(PLATAFORMES) as Plataforma[];

export const ESTATS_PUBLICACIO: { id: EstatPublicacio; nom: string }[] = [
  { id: "idea", nom: "idea" },
  { id: "esborrany", nom: "esborrany" },
  { id: "revisio", nom: "en revisió" },
  { id: "aprovada", nom: "aprovada" },
  { id: "programada", nom: "programada" },
  { id: "publicada", nom: "publicada" },
  { id: "cancellada", nom: "cancel·lada" },
];
export const NOM_ESTAT = Object.fromEntries(ESTATS_PUBLICACIO.map((e) => [e.id, e.nom])) as Record<EstatPublicacio, string>;
export const OBERTES: EstatPublicacio[] = ["idea", "esborrany", "revisio", "aprovada", "programada"];

export type Compte = {
  id: string;
  plataforma: Plataforma;
  nom: string;
  url: string | null;
  cadencia_setmanal: number | null;
  signatura: string | null;
  actiu: boolean;
};

export type Canal = {
  compte_id: string;
  text_adaptat: string | null;
  enllac_publicat: string | null;
  actiu: boolean;
};

export type Publicacio = {
  id: string;
  titol: string;
  text: string | null;
  projecte_id: string | null;
  responsable_id: string | null;
  revisor_id: string | null;
  estat: EstatPublicacio;
  data_prevista: string | null;
  hora: string | null;
  data_real: string | null;
  enllac_recursos: string | null;
  nota_revisio: string | null;
  aprovada_per: string | null;
  sense_revisio?: boolean; // validada directament per qui la porta (0022)
  notes: string | null;
};

const URL_RE = /https?:\/\/[^\s]+/g;

// Caràcters tal com els compta la xarxa: per grafemes (un emoji és 1) i, a X,
// cada enllaç val 23 encara que sigui més llarg.
export function comptaCaracters(text: string, plataforma: Plataforma): number {
  const p = PLATAFORMES[plataforma];
  let t = text;
  let extra = 0;
  if (p.enllac) {
    const enllacos = t.match(URL_RE) ?? [];
    extra = enllacos.length * p.enllac;
    t = t.replace(URL_RE, "");
  }
  return grafemes(t) + extra;
}

function grafemes(t: string): number {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return Array.from(new Intl.Segmenter("ca", { granularity: "grapheme" }).segment(t)).length;
  }
  return [...t].length;
}

export const comptaHashtags = (text: string) => (text.match(/(^|\s)#[\p{L}\p{N}_]+/gu) ?? []).length;

// Text final per a un compte: l'adaptat si n'hi ha, si no el base, i la
// signatura del compte al final si encara no hi és.
export function textFinal(base: string | null, adaptat: string | null, signatura: string | null): string {
  const t = (adaptat?.trim() ? adaptat : base ?? "").trim();
  const s = signatura?.trim();
  if (!s || t.includes(s)) return t;
  return t ? `${t}\n\n${s}` : s;
}

// Avisos objectius abans de publicar (res d'opinions sobre l'algoritme).
export function avisosCanal(text: string, plataforma: Plataforma, teRecursos: boolean): string[] {
  const p = PLATAFORMES[plataforma];
  const av: string[] = [];
  const n = comptaCaracters(text, plataforma);
  if (!text.trim()) av.push("sense text");
  if (p.limit && n > p.limit) av.push(`${n - p.limit} caràcters de més`);
  if (p.visual && !teRecursos) av.push("cal una imatge o un vídeo (enllaç als recursos)");
  return av;
}

// Dilluns de la setmana d'una data ISO.
export function dilluns(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  const dia = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dia);
  return d.toISOString().slice(0, 10);
}
