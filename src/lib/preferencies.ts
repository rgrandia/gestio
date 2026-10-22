// Preferències de cada persona en aquest navegador (galetes, no base de
// dades): tema i menú lateral. El servidor les llegeix per pintar la pàgina
// directament amb l'estat bo, sense parpelleig.
export const GALETA_TEMA = "gestio_tema";
export const GALETA_MENU = "gestio_menu";
export type Tema = "clar" | "fosc";
export type Menu = "plegat" | "desplegat";

export function llegeixTema(v: string | undefined): Tema {
  return v === "fosc" ? "fosc" : "clar";
}
export function llegeixMenu(v: string | undefined): Menu {
  return v === "desplegat" ? "desplegat" : "plegat";
}
