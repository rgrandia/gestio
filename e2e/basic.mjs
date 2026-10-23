// Recorregut bàsic de punta a punta sobre una base de dades buida amb els
// usuaris de prova de scripts/e2e/entorn.sh. Ús: node basic.mjs
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
const B = process.env.E2E_URL ?? "http://127.0.0.1:3000";
const SHOTS = process.env.E2E_CAPTURES ?? new URL("./captures/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const shot = (p, n) => p.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true });
const ok = (c, m) => { if (!c) throw new Error("FALLA: " + m); console.log("✓", m); };
const errors = [];

async function login(email) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(B + "/");
  ok(p.url().endsWith("/login"), "sense sessió → /login");
  await p.fill('input[name=email]', email);
  await p.fill('input[name=password]', "contrasenya-llarga-1");
  await p.click("button:has-text('entrar')");
  await p.waitForLoadState("networkidle");
  return p;
}

// --- intrús: perfil inactiu
const pi = await login("intrus@prova.test");
await pi.waitForURL(/sense-acces/);
ok(pi.url().includes("/sense-acces"), "perfil inactiu → /sense-acces");
await shot(pi, "00-sense-acces");

// --- Roc
const p = await login("roc@prova.test");
ok(p.url() === B + "/", "membre actiu entra a la meva setmana");
ok(!(await p.isVisible(".avis-esquema")), "la base de dades té totes les migracions (sense avís)");
ok(await p.isVisible("text=cap element a revisar"), "safata buida diu 'cap element a revisar'");

// client
await p.goto(B + "/clients/nou");
await p.fill('input[name=nom]', "Ajuntament de Mataró");
await p.selectOption('select[name=tipus]', "municipi");
await p.fill('input[name=territori]', "Maresme");
await p.click("button:has-text('crear client')");
await p.waitForURL(/\/clients\/[0-9a-f-]{36}$/);
const clientUrl = p.url();

// estudi
await p.goto(B + "/projectes/nou");
await p.fill('input[name=titol]', "Baròmetre onada 2");
await p.selectOption('select[name=tipus]', "estudi");
await p.selectOption('select[name=client_id]', { label: "Ajuntament de Mataró" });
await p.click("button:has-text('crear projecte')");
await p.waitForURL(/\/projectes\/[0-9a-f-]{36}$/);
const estudiUrl = p.url();
const nFases = await p.locator("section:has-text('fases') tbody.fase").count();
ok(nFases === 6, `estudi creat amb 6 fases (${nFases})`);

// planificar fase 1 en el passat (primera planificació: sense motiu)
const fila1 = p.locator("tbody tr", { hasText: "Qüestionari" });
await fila1.locator("button:has-text('planificar')").click();
const fa14 = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
await fila1.locator("input[type=date]").fill(fa14);
await fila1.locator("button:has-text('desar')").click();
await p.waitForTimeout(800);
ok(await fila1.locator("text=-14d").isVisible(), "fase planificada fa 14 dies mostra -14d");

// fase 2 en risc (+2)
const fila2 = p.locator("tbody tr", { hasText: "Camp" });
await fila2.locator("button:has-text('planificar')").click();
const en2 = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
await fila2.locator("input[type=date]").fill(en2);
await fila2.locator("button:has-text('desar')").click();
await p.waitForTimeout(800);

// tasca amb data a 3 dies assignada a mi
await p.fill("input[placeholder='nova tasca']", "Revisar literals");
await p.selectOption("form:has(input[placeholder='nova tasca']) select[name=assignada_a]", { label: "Roc" });
const en3 = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
await p.locator("form:has(input[placeholder='nova tasca']) input[name=data_prevista]").fill(en3);
await p.click("form:has(input[placeholder='nova tasca']) button:has-text('afegir tasca')");
await p.waitForTimeout(800);
ok(await p.locator("section.seccio td:has-text('Revisar literals')").first().isVisible(), "tasca creada");
await shot(p, "01-detall-estudi");

// replanificar fase 2 sense motiu: el navegador ho impedeix (required); i amb motiu, va
await fila2.locator("button:has-text('replanificar')").click();
const en9 = new Date(Date.now() + 9 * 864e5).toISOString().slice(0, 10);
await fila2.locator("input[type=date]").fill(en9);
await fila2.locator("input[aria-label=motiu]").fill("el proveïdor de camp endarrereix l'inici");
await fila2.locator("button:has-text('desar')").click();
await p.waitForTimeout(800);
await p.goto(estudiUrl + "?pestanya=historial");
ok(await p.isVisible("text=el proveïdor de camp endarrereix l'inici"), "replanificació a l'historial amb motiu");
ok(await p.isVisible("text=planificació inicial"), "primera planificació a l'historial");
await shot(p, "02-historial");

// consultoria muda: data d'inici fa 60 dies
await p.goto(B + "/projectes/nou");
await p.fill('input[name=titol]', "Acompanyament comunicació");
await p.selectOption('select[name=tipus]', "consultoria");
await p.selectOption('select[name=client_id]', { label: "Ajuntament de Mataró" });
await p.fill('input[name=data_inici]', new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10));
await p.click("button:has-text('crear projecte')");
await p.waitForURL(/\/projectes\/[0-9a-f-]{36}$/);
ok((await p.locator("section:has-text('fases')").count()) === 0, "consultoria sense fases");
await p.fill("input[placeholder='nou entregable']", "Nota de posicionament");
await p.locator("form:has(input[placeholder='nou entregable']) input[name=data_prevista]").fill(new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10));
await p.click("button:has-text('afegir entregable')");
await p.waitForTimeout(800);
await shot(p, "03-detall-consultoria");

// la meva setmana
await p.goto(B + "/");
await shot(p, "04-la-meva-setmana");
const safata = p.locator("section:has(header:has-text('a revisar')) tbody tr");
const n = await safata.count();
ok(n === 3, `safata amb 3 elements (fase vençuda, entregable vençut, tasca en risc): ${n}`);
ok(await p.isVisible("section:has(header:has-text('projectes muts')) >> text=Acompanyament comunicació"), "consultoria sense contacte en 60 dies surt muda");
ok(await p.isVisible("section:has(header:has-text('aquesta setmana')) >> text=Revisar literals"), "tasca a 'aquesta setmana'");

// marcar fet amb data anterior, sense sortir de la pantalla
const filaQ = safata.filter({ hasText: "Qüestionari" });
await filaQ.locator("button:has-text('fet')").click();
await filaQ.locator("input[type=date]").fill(new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10));
await filaQ.locator("button:has-text('marcar fet')").click();
await p.waitForTimeout(1200);
ok(!(await p.isVisible("section:has(header:has-text('a revisar')) >> text=Qüestionari")), "marcar fet treu la fila de la safata");
ok(p.url() === B + "/", "sense navegar");

// revisat: desapareix
const filaN = safata.filter({ hasText: "Nota de posicionament" });
await filaN.locator("button:has-text('revisat')").click();
await p.waitForTimeout(1200);
ok(!(await p.isVisible("section:has(header:has-text('a revisar')) >> text=Nota de posicionament")), "revisat amaga la fila");

// cancel·lar
const filaT = p.locator("section:has(header:has-text('a revisar')) tbody tr", { hasText: "Revisar literals" });
await filaT.locator("button:has-text('cancel·lar')").click();
await p.waitForTimeout(1200);
ok(await p.isVisible("text=cap element a revisar"), "safata buida després de les accions");

// contacte treu el projecte de muts
await p.goto(B + "/projectes");
await p.click("text=Acompanyament comunicació");
await p.waitForURL(/\/projectes\//);
await p.fill("input[placeholder='resum breu']", "Reunió amb l'alcaldia sobre el pressupost");
await p.click("button:has-text('registrar contacte')");
await p.waitForTimeout(800);
await p.goto(B + "/");
ok((await p.locator("#muts").count()) === 0, "contacte recent treu el projecte de muts");

// idees
await p.goto(B + "/idees");
await p.fill("input[placeholder='nova idea']", "Enquesta flash pressupostos participatius");
await p.selectOption("form:has(input[placeholder='nova idea']) select[name=client_id]", { label: "Ajuntament de Mataró" });
await p.click("button:has-text('proposar')");
await p.waitForTimeout(800);
const filaIdea = p.locator("tr", { hasText: "Enquesta flash" });
await filaIdea.locator("button:has-text('valorada')").click();
await p.waitForTimeout(800);
await p.locator("tr", { hasText: "Enquesta flash" }).locator("button:has-text('assignada')").click();
await p.waitForTimeout(800);
await p.locator("tr", { hasText: "Enquesta flash" }).locator("a:has-text('a projecte')").click();
await p.waitForURL(/projectes\/nou\?idea=/);
ok((await p.inputValue("input[name=titol]")) === "Enquesta flash pressupostos participatius", "conversió a projecte pre-omple el títol");
await p.selectOption('select[name=tipus]', "estudi");
await p.click("button:has-text('crear projecte')");
await p.waitForURL(/\/projectes\/[0-9a-f-]{36}$/);
await p.goto(B + "/idees");
ok(await p.isVisible("a:has-text('→ Enquesta flash')"), "idea enllaçada al projecte creat");
await shot(p, "05-idees");

// fitxa client
await p.goto(clientUrl);
ok(await p.isVisible("dd:has-text('/')") , "fitxa mostra darrer contacte");
await shot(p, "06-fitxa-client");

await p.goto(B + "/projectes");
await shot(p, "07-projectes");

// mòbil
await p.setViewportSize({ width: 390, height: 844 });
await p.goto(B + "/");
const ample = await p.evaluate(() => document.documentElement.scrollWidth);
ok(ample <= 390, `sense scroll horitzontal a mòbil (${ample}px)`);
await shot(p, "08-mobil");

// estils: cap radi, cap ombra
const estils = await p.evaluate(() => [...document.querySelectorAll("*")].filter((e) => {
  const s = getComputedStyle(e); return s.borderRadius !== "0px"; }).length);
ok(estils === 0, "cap element amb border-radius");

ok(errors.length === 0, "cap error de JS a la pàgina " + errors.join(" | "));
await browser.close();
