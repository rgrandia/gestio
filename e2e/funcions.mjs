// Funcions d'edició, reobrir, fases noves, revisió d'entregables, nova onada i
// resum setmanal. Necessita les dades de dades-prova.sql. Ús: node funcions.mjs
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
const B = process.env.E2E_URL ?? "http://127.0.0.1:3000";
const SHOTS = process.env.E2E_CAPTURES ?? new URL("./captures/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const ok = (c, m) => { if (!c) throw new Error("FALLA: " + m); console.log("✓", m); };
const errors = [];
async function login(email) {
  const p = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(B + "/login");
  await p.fill("input[name=email]", email);
  await p.fill("input[name=password]", "contrasenya-llarga-1");
  await p.click("button:has-text('entrar')");
  await p.waitForURL(B + "/");
  return p;
}
const obre = async (p, titol) => { await p.goto(B + "/projectes"); await p.click(`a:has-text('${titol}')`); await p.waitForURL(/projectes\/[0-9a-f-]{36}/); return p.url().split("?")[0]; };

const p = await login("roc@prova.test");
const u1 = await obre(p, "Baròmetre municipal onada 2");

// editar una tasca
const tasques = p.locator("section.seccio", { has: p.locator("header .titol", { hasText: /^tasques/ }) });
const fila = tasques.locator("tbody tr", { hasText: "Revisar literals del qüestionari" });
await fila.locator("button[data-tip=editar]").click();
const ed = tasques.locator("tr.fila-edicio");
await ed.locator("input[name=titol]").fill("Revisar literals del qüestionari (v2)");
await ed.locator("textarea[name=descripcio]").fill("Sobretot les preguntes de valoració de líders");
await ed.locator("select[name=ancora]").selectOption({ label: "fase: Qüestionari i mostra" });
await ed.locator("button:has-text('desar tasca')").click();
await p.waitForTimeout(1000);
await p.reload();
ok(await tasques.locator("text=Revisar literals del qüestionari (v2)").isVisible(), "tasca reanomenada");
ok(await tasques.locator("text=Sobretot les preguntes de valoració de líders").isVisible(), "descripció visible a la llista");
const filaV2 = tasques.locator("tbody tr", { hasText: "(v2)" }).first();
ok(await filaV2.locator("td", { hasText: "Qüestionari i mostra" }).count() === 1, "àncora canviada a la fase");
await p.screenshot({ path: `${SHOTS}/g1-editar.png`, fullPage: true });

// marcar fet i reobrir
await filaV2.locator("button:has-text('fet')").first().click();
await filaV2.locator("button:has-text('marcar fet')").click();
await p.waitForTimeout(1000);
await p.goto(u1 + "?tot=1");
const filaFeta = tasques.locator("tbody tr", { hasText: "(v2)" }).first();
await filaFeta.locator("button:has-text('reobrir')").click();
await filaFeta.locator("button:has-text('reobrir')").click();
await p.waitForTimeout(1000);
await p.goto(u1);
ok(await tasques.locator("tbody tr", { hasText: "(v2)" }).locator("button:has-text('fet')").count() >= 1, "tasca reoberta torna a tenir accions");

// renombrar una fase
const faseCamp = p.locator("tbody.fase", { hasText: "Camp" });
await faseCamp.locator("label.boto").click();
await faseCamp.locator("input[name=nom]").fill("Camp telefònic");
await faseCamp.locator("button:has-text('desar fase')").click();
await p.waitForTimeout(1000);
await p.reload();
ok(await p.isVisible("tbody.fase >> text=Camp telefònic"), "fase reanomenada");

// estudi antic → fases noves
await obre(p, "Enquesta de serveis");
ok(await p.isVisible("text=té les fases per defecte antigues"), "avís de fases antigues");
await p.click("button:has-text(\"Passa'l a les fases noves\")");
await p.click("button:has-text('aplicar les fases noves')");
await p.waitForTimeout(1200);
const noms = await p.locator("tbody.fase .titol-el").allInnerTexts();
console.log(noms.map((n) => n.split("\n")[0]));
ok(noms[0].startsWith("Qüestionari i mostra") && noms[1].startsWith("Briefing") && noms[3].startsWith("Dades"), "fases noves aplicades en ordre");
ok(!(await p.isVisible("text=té les fases per defecte antigues")), "l'avís desapareix");
await p.screenshot({ path: `${SHOTS}/g1-fases-noves.png`, fullPage: true });

// revisió d'entregable: Roc el marca fet i l'envia a l'Aina
const u3 = await obre(p, "Acompanyament comunicació 2027");
const ent = p.locator("tbody tr", { hasText: "Argumentari ple" });
await ent.locator("button:has-text('fet')").first().click();
await ent.locator("select[aria-label='enviar a revisar']").selectOption({ label: "i que la revisi Aina" });
await ent.locator("button:has-text('marcar fet')").click();
await p.waitForTimeout(1000);
await p.goto(u3 + "?tot=1");
ok(await p.isVisible("text=en revisió · Aina"), "entregable en revisió");

const a = await login("aina@prova.test");
const fr = a.locator("#revisions tr", { hasText: "Argumentari ple" });
ok(await fr.locator("text=entregable").count() >= 1, "l'Aina veu l'entregable a revisar");
await fr.locator("button:has-text('retornar')").click();
await fr.locator("input[aria-label=comentari]").fill("falta el cas de la moció");
await fr.locator("button:has-text('retornar')").click();
await a.waitForTimeout(1000);
await p.goto(u3);
ok(await p.isVisible("text=retornada: falta el cas de la moció"), "entregable retornat i reobert");
await p.screenshot({ path: `${SHOTS}/g3-revisio-entregable.png`, fullPage: true });

// editar l'entregable
const ent2 = p.locator("tbody tr", { hasText: "Argumentari ple" }).first();
await ent2.locator("button[data-tip=editar]").click();
await p.locator("tr.fila-edicio input[name=enllac]").fill("https://gesop.sharepoint.com/argumentari");
await p.locator("tr.fila-edicio button:has-text('desar entregable')").click();
await p.waitForTimeout(1000);
await p.reload();
ok(await p.isVisible("a[href='https://gesop.sharepoint.com/argumentari']"), "enllaç de l'entregable desat");

// nova onada
await p.goto(u1 + "?pestanya=onada");
await p.fill("input[name=titol]", "Baròmetre municipal onada 3");
await p.fill("input[name=numero_estudi]", "2702");
const en90 = new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10);
await p.fill("input[name=data_inici]", en90);
await p.click("button:has-text('crear la nova onada')");
await p.waitForURL((u) => !u.toString().includes(u1.split("/").pop()));
ok(await p.isVisible("h1:has-text('Baròmetre municipal onada 3')"), "nova onada creada");
ok(await p.locator("tbody.fase").count() === 6, "nova onada amb 6 fases");
ok(await p.isVisible("text=Camp telefònic"), "conserva els noms de fase editats");
await p.screenshot({ path: `${SHOTS}/g3-onada.png`, fullPage: true });
const aina2 = await login("aina@prova.test");
await aina2.goto(B + "/avisos");
ok(await aina2.isVisible("text=ha creat la nova onada 2702"), "l'Aina rep un sol avís de resum");

// resum setmanal
await p.goto(B + "/resum");
ok(await p.isVisible("section:has-text('ha lliscat') >> text=el gabinet demana més temps"), "el resum mostra què ha lliscat i el motiu");
ok(await p.isVisible("section:has-text('venç aquesta setmana') >> text=Revisar ponderació"), "el resum mostra què venç aquesta setmana");
await p.screenshot({ path: `${SHOTS}/resum.png`, fullPage: true });

// les meves tasques del projecte, i replanificar sense motiu
await p.goto(u1);
const meves = p.locator("details.meves-tasques");
await meves.locator("summary").click();
ok(await meves.locator("text=Revisar ponderació").isVisible(), "desplegable amb les meves tasques del projecte");
ok(!(await meves.locator("text=Seguiment de quotes diari").isVisible()), "no hi surten tasques d'altres");
const filaMeva = meves.locator("tr", { hasText: "Revisar ponderació" });
await filaMeva.locator("button[data-tip=replanificar]").click();
await filaMeva.locator("input[type=date]").fill(new Date(Date.now() + 9 * 864e5).toISOString().slice(0, 10));
await filaMeva.locator("button:has-text('desar')").click();
await p.waitForTimeout(1200);
await p.goto(u1 + "?pestanya=historial");
ok(await p.isVisible("tr:has-text('Revisar ponderació') >> text=sense motiu"), "replanificar sense motiu queda a l'historial com a «sense motiu»");

// gestió interna: alta ràpida amb Enter, no surt a "a revisar"
await p.goto(B + "/");
await p.fill("#intern input[name=titol]", "Renovar la subscripció del panel");
await p.press("#intern input[name=titol]", "Enter");
await p.waitForTimeout(1200);
ok(await p.isVisible("#intern >> text=Renovar la subscripció del panel"), "tasca interna creada amb Enter");
ok(!(await p.isVisible("#a-revisar >> text=Renovar la subscripció del panel")), "la tasca interna no surt a «a revisar»");
await p.goto(B + "/projectes");
ok(!(await p.isVisible("text=Gestió interna")), "el projecte intern no surt a la llista de projectes");

// replanificar amb +1 setmana i un motiu d'un clic
await p.goto(B + "/?tot=1");
const filaSafata = p.locator("#a-revisar tr", { hasText: "Preparar plantilla de taules" });
await filaSafata.locator("button[data-tip=replanificar]").click();
await filaSafata.locator("button:has-text('+1 setm.')").click();
const novaData = await filaSafata.locator("input[type=date]").inputValue();
ok(/^\d{4}-\d{2}-\d{2}$/.test(novaData) && novaData > new Date().toISOString().slice(0, 10), "+1 setm. posa una data futura");
await filaSafata.locator("button:has-text('proveïdor / camp')").click();
ok((await filaSafata.locator("input[aria-label=motiu]").inputValue()) === "proveïdor / camp", "el motiu d'un clic s'escriu al camp");
await filaSafata.locator("button:has-text('desar')").click();
await p.waitForTimeout(1200);
await p.goto(B + "/resum");
ok(await p.isVisible("tr:has-text('Preparar plantilla de taules') >> text=proveïdor / camp"), "el motiu d'un clic surt al resum");

// plantilles de tasques
await p.goto(B + "/plantilles");
for (const [titol, dies] of [["Guió de la dinàmica", "3"], ["Transcripcions", "20"]]) {
  await p.fill("input[name=subtipus]", "qualitatiu");
  await p.fill("input[name=titol]", titol);
  await p.locator("select[name=fase]").selectOption(titol === "Transcripcions" ? "Dades" : "Qüestionari i mostra");
  await p.fill("input[name=dies]", dies);
  await p.click("button:has-text('afegir')");
  await p.waitForTimeout(800);
}
ok(await p.isVisible("section:has-text('qualitatiu') >> text=Transcripcions"), "plantilla desada");
await p.goto(B + "/projectes/nou");
ok(await p.isVisible("text=qualitatiu (2)"), "el formulari de projecte nou diu quins subtipus tenen plantilla");
await p.fill("input[name=titol]", "Grups de discussió joves");
await p.selectOption("select[name=tipus]", "estudi");
await p.fill("input[name=subtipus]", "qualitatiu");
await p.selectOption("select[name=client_id]", { index: 1 });
await p.fill("input[name=data_inici]", new Date().toISOString().slice(0, 10));
await p.click("button:has-text('crear projecte')");
await p.waitForURL(/\/projectes\/[0-9a-f-]{36}$/);
ok(await p.isVisible("section.seccio:has(header .titol:text-is('tasques')) td:has-text('Transcripcions')"), "el projecte nou té les tasques de la plantilla");

// preferències: mode fosc i menú desplegat, recordats en recarregar
await p.click("button.pref-tema");
await p.click("button.pref-menu");
await p.reload();
const [tema, menu] = await p.evaluate(() => [document.documentElement.dataset.tema, document.documentElement.dataset.menu]);
ok(tema === "fosc" && menu === "desplegat", "el mode fosc i el menú desplegat es recorden");
ok(await p.isVisible("nav[aria-label=principal] >> text=resum setmanal"), "amb el menú desplegat es veuen els noms");
// desades al perfil: en un navegador nou (sense galetes) també
const p2 = await login("roc@prova.test");
await p2.waitForTimeout(500);
const [tema2, menu2] = await p2.evaluate(() => [document.documentElement.dataset.tema, document.documentElement.dataset.menu]);
ok(tema2 === "fosc" && menu2 === "desplegat", "les preferències es recuperen del perfil en un altre navegador");

ok(errors.length === 0, "cap error de JS " + errors.join(" | "));
await browser.close();
