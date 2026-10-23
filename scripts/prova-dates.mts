// Proves de extreuData() (dates en català a l'alta ràpida). Ús: node --experimental-strip-types scripts/prova-dates.mts
import { extreuData } from "../src/lib/dates.ts";
const hui = "2026-10-23"; // divendres
const casos: [string, string, string | null][] = [
  ["Trucar a l'alcaldia dijous", "Trucar a l'alcaldia", "2026-10-29"],
  ["Enviar factura divendres", "Enviar factura", "2026-10-30"],
  ["Revisar pressupost demà", "Revisar pressupost", "2026-10-24"],
  ["Revisar pressupost dema", "Revisar pressupost", "2026-10-24"],
  ["Preparar reunió avui", "Preparar reunió", "2026-10-23"],
  ["Preparar reunió passat demà", "Preparar reunió", "2026-10-25"],
  ["Tancar acta d'aquí a 3 dies", "Tancar acta", "2026-10-26"],
  ["Tancar acta d’aquí 10 dies", "Tancar acta", "2026-11-02"],
  ["Tancar acta en 5 dies", "Tancar acta", "2026-10-28"],
  ["Lliurar informe 12/11", "Lliurar informe", "2026-11-12"],
  ["Lliurar informe 05/02", "Lliurar informe", "2027-02-05"],
  ["Lliurar informe 12/11/27", "Lliurar informe", "2027-11-12"],
  ["Lliurar informe 31/02", "Lliurar informe 31/02", null],
  ["Trucar el dilluns", "Trucar", "2026-10-26"],
  ["Pla pròxim dimarts", "Pla", "2026-10-27"],
  ["dijous", "dijous", null],
  ["Llegir el document sobre dimarts electorals", "Llegir el document sobre dimarts electorals", null],
  ["Revisar el text", "Revisar el text", null],
];
let mal = 0;
for (const [t, titol, data] of casos) {
  const r = extreuData(t, hui);
  const ok = r.titol === titol && r.data === data;
  if (!ok) mal++;
  console.log(ok ? "✓" : "✗", JSON.stringify(t), "→", JSON.stringify(r));
}
process.exit(mal ? 1 : 0);
