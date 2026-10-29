// Calendari dels 7 dies de l'inici (arrossegar tasques) i el meu calendari
// (migració 0020: teletreball, vacances, festius). Necessita dades-prova.sql.
// Ús: node calendari.mjs
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
const B = process.env.E2E_URL ?? "http://127.0.0.1:3000";
const SHOTS = process.env.E2E_CAPTURES ?? new URL("./captures/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const ok = (c, m) => { if (!c) throw new Error("FALLA: " + m); console.log("✓", m); };
const errors = [];
async function login(email, viewport = { width: 1280, height: 900 }) {
  const p = await (await browser.newContext({ viewport })).newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(B + "/login");
  await p.fill("input[name=email]", email);
  await p.fill("input[name=password]", "contrasenya-llarga-1");
  await p.click("button:has-text('entrar')");
  await p.waitForURL(B + "/");
  return p;
}
const hui = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
const dia = (n) => { const d = new Date(hui + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
async function arrossega(p, nansa, desti) {
  await desti.scrollIntoViewIfNeeded();
  await nansa.scrollIntoViewIfNeeded();
  const a = await nansa.boundingBox();
  const b = await desti.boundingBox();
  await p.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await p.mouse.down();
  await p.mouse.move(b.x + b.width / 2, b.y + Math.min(60, b.height / 2), { steps: 12 });
  await p.mouse.up();
}

const roc = await login("roc@prova.test");

// inici: arrossegar una tasca a un altre dia
const tasca = "Enviar fitxer de quotes al proveïdor"; // data prevista: d'aquí a 4 dies
const col = (n) => roc.locator(`#setmana [data-desti='${dia(n)}']`);
ok(await col(4).locator(`text=${tasca}`).isVisible(), "la tasca surt al seu dia al calendari de l'inici");
ok(await col(3).locator(".fases-dia .fd-fase-inici", { hasText: "Camp" }).isVisible(), "l'inici d'una fase que porto surt, en petit, als 7 dies de l'inici");
ok((await roc.locator("#setmana .fases-dia li", { hasText: "Dades" }).count()) === 0, "la fase d'un extern no surt als 7 dies de l'inici");
await arrossega(roc, col(4).locator(".cita", { hasText: tasca }).locator("button.nansa"), col(1));
await col(1).locator(`text=${tasca}`).waitFor();
// motiu d'un clic (migració 0021)
await roc.locator(".toast >> text=Per què?").waitFor();
await roc.click(".toast button:has-text('proveïdor / camp')");
await roc.locator(".toast >> text=Motiu desat").waitFor();
ok(true, "després d'arrossegar es pot posar el motiu d'un clic");
await roc.reload();
ok(await col(1).locator(`text=${tasca}`).isVisible(), "arrossegar-la a demà la replanifica (i es desa)");
await col(1).locator(".cita", { hasText: tasca }).locator("button.nansa").focus();
await roc.keyboard.press("ArrowRight");
await col(2).locator(`text=${tasca}`).waitFor();
await roc.waitForTimeout(800);
await roc.reload();
ok(await col(2).locator(`text=${tasca}`).isVisible(), "amb el teclat (→) també es mou");
await roc.click(`#setmana a:has-text('${tasca}')`);
await roc.waitForURL(/projectes\/[0-9a-f-]{36}/);
await roc.goto(roc.url().split("?")[0] + "?pestanya=historial");
ok(await roc.isVisible(`tr:has-text('${tasca}') >> text=sense motiu`), "moure-la queda a l'historial de replanificacions");
ok(await roc.isVisible(`tr:has-text('${tasca}') >> text=proveïdor / camp`), "el motiu d'un clic queda a l'historial");

// cascada: replanificar una fase arrossega les següents (migració 0021)
const fila = roc.locator("tbody.fase tr", { hasText: "Informe" }).first();
await roc.goto(roc.url().split("?")[0]);
await fila.locator("button[data-tip=replanificar]").click();
ok(await fila.locator("text=moure també les fases següents").isVisible(), "en replanificar una fase s'ofereix moure les següents");
await fila.locator("input[aria-label='nova data prevista']").fill(dia(22));
await fila.locator("button:has-text('desar')").click();
await roc.locator(".toast >> text=També s'han mogut 1 fase següent").waitFor();
ok(true, "avisa de quantes fases s'han mogut de més");
await roc.goto(roc.url().split("?")[0] + "?pestanya=historial");
ok(await roc.isVisible("tr:has-text('Presentació') >> text=en cascada (Informe)"), "la fase següent s'ha mogut, amb historial");

// el meu calendari
await roc.goto(B + "/");
ok(await roc.isVisible("nav[aria-label=principal] a[href='/calendari']"), "el menú té el meu calendari");
const cel = (d) => roc.locator(`.graella-calendari button[data-data='${d}']`);
// dos dies seguits del mateix mes (per no dependre del dia en què corre la prova)
let n = 8;
while (dia(n).slice(0, 7) !== dia(n + 1).slice(0, 7)) n++;
const [d1, d2] = [dia(n), dia(n + 1)];
await roc.goto(B + "/calendari?mes=" + d1.slice(0, 7));
// teletreball dos dies seguits (clic i Maj+clic)
await cel(d1).click();
await cel(d2).click({ modifiers: ["Shift"] });
ok(await roc.isVisible("text=2 dies triats"), "Maj+clic tria un interval");
await roc.click(".barra-dies button:has-text('teletreball')");
await cel(d1).locator(".marca-dia.meva >> text=teletreball").waitFor();
ok(await cel(d2).locator(".marca-dia.meva >> text=teletreball").isVisible(), "marca els dies triats");
// treure
await cel(d1).click();
await roc.click(".barra-dies button:has-text('treure')");
await roc.waitForTimeout(800);
await roc.reload();
ok(!(await cel(d1).locator(".marca-dia.meva").isVisible()), "treure una marca");
ok(await cel(d2).locator(".marca-dia.meva >> text=teletreball").isVisible(), "treure'n una no toca les altres");
// vacances el dia on ara cau la tasca → avís a l'inici
await roc.goto(B + "/calendari?mes=" + dia(2).slice(0, 7));
await cel(dia(2)).click();
await roc.click(".barra-dies button:has-text('vacances')");
await cel(dia(2)).locator(".marca-dia.meva >> text=vacances").waitFor();
await roc.goto(B + "/");
ok(await col(2).locator(".marca-dia >> text=vacances").isVisible(), "l'inici mostra com és cada dia meu");
ok(await col(2).locator(".cita.en-dia-lliure", { hasText: tasca }).isVisible(), "avisa si una tasca cau en un dia de vacances");
// avís: arrossegar una tasca meva a un dia de vacances (migració 0020)
await roc.goto(B + "/calendari?mes=" + dia(4).slice(0, 7));
await cel(dia(4)).click();
await roc.click(".barra-dies button:has-text('vacances')");
await cel(dia(4)).locator(".marca-dia.meva >> text=vacances").waitFor();
await roc.goto(B + "/");
await arrossega(roc, col(2).locator(".cita", { hasText: tasca }).locator("button.nansa"), col(4));
await roc.locator(".toast-avis >> text=té vacances").waitFor();
ok(true, "avisa si la persona té vacances el dia on es mou la tasca");
await roc.goto(B + "/feina");
ok(await roc.isVisible(".columna header .absencies >> text=vacances"), "feina de l'equip mostra qui no hi serà");

// repetir cada setmana
await roc.goto(B + "/calendari?mes=" + dia(3).slice(0, 7));
await cel(dia(3)).click();
await roc.fill("input[aria-label='repetir cada setmana fins al']", dia(17));
await roc.click(".barra-dies button:has-text('fora')");
await cel(dia(3)).locator(".marca-dia.meva >> text=fora").waitFor();
await roc.goto(B + "/calendari?mes=" + dia(17).slice(0, 7));
ok(await cel(dia(17)).locator(".marca-dia.meva >> text=fora").isVisible(), "«cada setmana fins al» repeteix la marca");
// festiu de tot l'equip
await roc.goto(B + "/calendari?mes=" + dia(5).slice(0, 7));
await cel(dia(5)).click();
await roc.check(".barra-dies input[type=checkbox]");
ok((await roc.locator(".barra-dies button.boto-dia").count()) === 1, "per a l'equip només es poden marcar festius");
await roc.fill(".barra-dies input[aria-label=nota]", "Festa local");
await roc.click(".barra-dies button:has-text('festiu')");
await cel(dia(5)).locator("text=Festa local · equip").waitFor();
ok(true, "festiu de tot l'equip");
await roc.screenshot({ path: SHOTS + "calendari.png", fullPage: true });

// cerca global: també troba dies marcats
await roc.goto(B + "/");
await roc.waitForLoadState("networkidle");
await roc.click(".cerca-global .camp");
await roc.keyboard.type("Festa local");
await roc.locator(".cerca-global >> text=Festa local").first().waitFor();
ok(true, "la cerca troba els dies marcats amb nota");

// l'Aina ho veu: el festiu, i el teletreball/vacances del Roc
const aina = await login("aina@prova.test");
ok(await aina.isVisible(`#setmana [data-desti='${dia(5)}'] >> text=Festa local`), "el festiu de l'equip surt a l'inici dels altres");
await aina.goto(B + "/calendari?mes=" + dia(2).slice(0, 7));
ok(await aina.isVisible(`.graella-calendari button[data-data='${dia(2)}'] .avatar-dia[title^='Roc: vacances']`), "l'equip veu el calendari dels altres");
ok(!(await aina.isVisible(`.graella-calendari button[data-data='${dia(2)}'] .marca-dia.meva`)), "però no com a seu");

// el meu calendari també mostra la meva feina: tasques i, en petit, fases meves
await roc.goto(B + "/calendari?mes=" + dia(2).slice(0, 7));
ok(await roc.isVisible(`.dia-cel:has(button[data-data='${dia(2)}']) .feina-dia >> text=Revisar ponderació`), "les meves tasques surten al meu calendari");
await roc.goto(B + "/calendari");
ok((await roc.locator(".feina-dia .fd-fase-fi").count()) > 0, "les fases que porto surten al meu calendari, en petit");
ok((await roc.locator(".feina-dia .fd-fase-fi[title*='Dades · 2614']").count()) === 0, "la fase d'un extern no em surt a mi");

// pantalla gran: la columna principal de l'inici s'eixampla més enllà dels 1280px
const gran = await login("roc@prova.test", { width: 2400, height: 1200 });
const ampla = await gran.locator(".inici-principal").evaluate((e) => e.getBoundingClientRect().width);
ok(ampla > 1300, `a pantalla gran la columna principal s'eixampla (${Math.round(ampla)}px)`);

// mòbil
const mobil = await login("roc@prova.test", { width: 390, height: 844 });
for (const ruta of ["/", "/calendari"]) {
  await mobil.goto(B + ruta);
  ok((await mobil.evaluate(() => document.documentElement.scrollWidth)) <= 390, `sense scroll horitzontal a mòbil (${ruta})`);
}
await roc.goto(B + "/");
await roc.screenshot({ path: SHOTS + "inici-arrossegar.png", fullPage: true });

ok(errors.length === 0, "cap error de JS " + errors.join(" | "));
await browser.close();
