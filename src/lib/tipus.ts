// Tipus escrits a mà a partir de supabase/migrations. Si l'esquema canvia,
// s'han d'actualitzar aquí (o generar-los amb `supabase gen types`).

export type TipusProjecte = "estudi" | "consultoria" | "altre";
export type EstatItem = "pendent" | "en_curs" | "fet" | "cancellat";
export type EstatProjecte = "actiu" | "pausat" | "tancat" | "cancellat";
export type EstatIdea = "proposada" | "valorada" | "assignada" | "descartada";
export type Prioritat = "alta" | "normal" | "baixa";
export type TipusClient = "municipi" | "partit" | "institucio" | "altre";

// Taules amb data prevista i accions de safata
export type TaulaItem = "fases" | "entregables" | "tasques";
export type TipusItem = "fase" | "entregable" | "tasca";

export const TAULA_DE: Record<TipusItem, TaulaItem> = {
  fase: "fases",
  entregable: "entregables",
  tasca: "tasques",
};

// `extern`: persona sense accés a l'app (p. ex. algú de dades), només per assignar-li feina.
export type Perfil = {
  id: string;
  nom: string;
  email: string | null;
  actiu: boolean;
  extern: boolean;
  area: string | null;
  color: string | null;
};

export type Client = {
  id: string;
  nom: string;
  tipus: TipusClient;
  territori: string | null;
  responsable_id: string | null;
  notes: string | null;
  actiu: boolean;
};

export type Projecte = {
  id: string;
  client_id: string;
  titol: string;
  tipus: TipusProjecte;
  subtipus: string | null;
  responsable_id: string;
  estat: EstatProjecte;
  numero_estudi: string | null;
  data_inici: string | null;
  data_fi_prevista: string | null;
  data_fi_real: string | null;
  dies_silenci_max: number;
  notes: string | null;
  arxivat_el: string | null;
  eliminat_el: string | null; // a la paperera
  eliminat_per: string | null;
};

export type Fase = {
  id: string;
  projecte_id: string;
  nom: string;
  ordre: number;
  data_inici: string | null;
  data_prevista: string | null; // final previst
  data_real: string | null;
  estat: EstatItem;
  revisat_el: string | null;
  responsable_id: string | null;
  notes: string | null;
};

export type Entregable = {
  id: string;
  projecte_id: string;
  titol: string;
  tipus: string | null;
  data_prevista: string | null;
  data_real: string | null;
  estat: EstatItem;
  revisat_el: string | null;
  responsable_id: string | null;
  enllac: string | null;
  notes: string | null;
};

export type Tasca = {
  id: string;
  projecte_id: string;
  fase_id: string | null;
  entregable_id: string | null;
  titol: string;
  descripcio: string | null;
  assignada_a: string | null;
  data_prevista: string | null;
  data_real: string | null;
  estat: EstatItem;
  prioritat: Prioritat;
  revisat_el: string | null;
};

export type Contacte = {
  id: string;
  projecte_id: string;
  data: string;
  tipus: string | null;
  resum: string | null;
  usuari_id: string | null;
};

export type Idea = {
  id: string;
  titol: string;
  descripcio: string | null;
  client_id: string | null;
  projecte_id: string | null;
  estat: EstatIdea;
  proposada_per: string | null;
  data_objectiu: string | null;
  creat_el: string;
};

export type FilaSafata = {
  tipus_item: TipusItem;
  id: string;
  titol: string;
  projecte_id: string;
  data_prevista: string;
  estat: string;
  responsable_id: string | null;
  projecte: string;
  tipus_projecte: TipusProjecte;
  client: string;
  motiu: "vencut" | "en_risc";
  dies_retard: number;
};

export type ProjecteMut = {
  id: string;
  titol: string;
  client_id: string;
  client: string;
  responsable_id: string;
  dies_silenci_max: number;
  darrer_senyal: string;
  dies_silenci: number;
};

export type Replanificacio = {
  id: number;
  taula: string;
  registre_id: string;
  data_antiga: string | null;
  data_nova: string | null;
  motiu: string;
  usuari: string | null;
  element: string;
  projecte_id: string;
  creat_el: string;
};
