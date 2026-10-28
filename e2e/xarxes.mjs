// Xarxes socials (migració 0019): funció activada per persona, comptes,
// redacció amb comptador per xarxa, revisió per una altra persona, publicada
// amb enllaç i lligam amb el projecte. Necessita dades-prova.sql. Ús: node xarxes.mjs
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
const enllacXarxes = (p) => p.locator("nav[aria-label=principal] a[href='/xarxes']");

const roc = await login("roc@prova.test");
ok((await enllacXarxes(roc).count()) === 0, "sense la funció, el menú no té xarxes");
await roc.goto(B + "/xarxes");
ok(await roc.isVisible("text=Encara no la té ningú"), "sense la funció, /xarxes explica com activar-la");

// activar-la: primer un mateix (ningú no la tenia), després a l'Aina
await roc.goto(B + "/equip");
await roc.locator("tr", { hasText: "roc@prova.test" }).locator("button:has-text('activar xarxes')").click();
await roc.locator("tr", { hasText: "roc@prova.test" }).locator("button:has-text('xarxes activades')").waitFor();
await roc.locator("tr", { hasText: "aina@prova.test" }).locator("button:has-text('activar xarxes')").click();
await roc.locator("tr", { hasText: "aina@prova.test" }).locator("button:has-text('xarxes activades')").waitFor();
ok((await enllacXarxes(roc).count()) === 1, "amb la funció, el menú té xarxes");

// comptes
await roc.goto(B + "/xarxes/comptes");
const alta = roc.locator("form", { has: roc.locator("button:has-text('afegir compte')") });
await alta.locator("select[name=plataforma]").selectOption("x");
await alta.locator("input[name=nom]").fill("@gesop_prova");
await alta.locator("button:has-text('afegir compte')").click();
await roc.waitForSelector("input[name=nom][value='@gesop_prova']");
await alta.locator("select[name=plataforma]").selectOption("linkedin");
await alta.locator("input[name=nom]").fill("GESOP LinkedIn");
await alta.locator("input[name=cadencia_setmanal]").fill("3");
await alta.locator("button:has-text('afegir compte')").click();
await roc.waitForSelector("input[name=nom][value='GESOP LinkedIn']");
ok(await roc.isVisible("text=Diada Nacional de Catalunya"), "hi ha les dates clau inicials");

// cal atenció: cadència i oportunitat des d'un projecte
await roc.goto(B + "/xarxes");
ok(await roc.isVisible("#atencio >> text=0 de 3 aquesta setmana"), "avisa si un compte no arriba a l'objectiu setmanal");
ok(await roc.isVisible("#atencio >> text=Enquesta de serveis"), "proposa difondre un projecte amb la presentació a prop");

// nova publicació lligada al projecte
await roc.click("#atencio >> a:has-text('Enquesta de serveis')");
await roc.waitForURL(/\/xarxes\/nova\?projecte=/);
await roc.fill("input[name=titol]", "Resultats de l'enquesta de serveis");
await roc.locator("label.check", { hasText: "@gesop_prova" }).locator("input").check();
await roc.locator("label.check", { hasText: "GESOP LinkedIn" }).locator("input").check();
const llarg = "Presentem els resultats de l'enquesta de serveis municipals. ".repeat(6);
await roc.fill("textarea[name=text]", llarg);
await roc.click("button:has-text('crear i redactar')");
await roc.waitForURL(/\/xarxes\/[0-9a-f-]{36}$/);
const urlPub = roc.url();
const canalX = roc.locator(".canal[data-xarxa=x]");
ok(await canalX.locator(".comptador-car.passat").isVisible(), "el comptador marca que a X sobren caràcters");
ok(await canalX.locator("text=caràcters de més").isVisible(), "avís de caràcters de més a X");
ok(!(await roc.locator(".canal[data-xarxa=linkedin] .comptador-car.passat").isVisible()), "a LinkedIn hi cap");
await canalX.locator("button:has-text('adaptar per a X')").click();
await canalX.locator("textarea").fill("Resultats de l'enquesta de serveis: https://example.org/un-enllac-molt-llarg-que-a-x-compta-com-23-caracters");
ok(!(await canalX.locator(".comptador-car.passat").isVisible()), "amb el text adaptat ja hi cap (l'enllaç compta 23)");
await roc.click("form.editor-pub button:has-text('desar')");
await roc.waitForSelector("form.editor-pub >> text=desat");
await roc.reload();
ok((await roc.locator(".canal[data-xarxa=x] textarea").inputValue()).startsWith("Resultats de l'enquesta"), "el text adaptat es desa");

// data, revisió per l'Aina
await roc.click("button:has-text('posar data')");
await roc.fill("input[aria-label='nova data prevista']", new Date(Date.now() + 86400000).toISOString().slice(0, 10));
await roc.click("button:has-text('desar data')");
await roc.waitForSelector("text=prevista el");
await roc.click("button:has-text('enviar a revisar')");
await roc.selectOption("select[aria-label='qui la revisa']", { label: "Aina" });
await roc.click(".panell-accio button:has-text('enviar')");
await roc.waitForSelector("text=Esperant la revisió de");
ok(true, "enviada a revisar");

const aina = await login("aina@prova.test");
ok(await aina.isVisible("#xarxes >> text=et toca revisar-la"), "a la meva setmana de qui revisa hi surt");
await aina.click("#xarxes >> a:has-text('Resultats de l\\'enquesta de serveis')");
await aina.waitForURL(urlPub);
await aina.click("button:has-text('aprovar')");
await aina.waitForSelector(".etiqueta >> text=aprovada");
ok(true, "qui revisa l'aprova");

// publicada amb enllaç
await roc.reload();
ok(await roc.isVisible("text=aprovada per Aina"), "consta qui l'ha aprovada");
await roc.click("button:has-text('marcar publicada')");
await roc.fill("input[aria-label='enllaç publicat a @gesop_prova']", "https://x.com/gesop_prova/status/1");
await roc.click("button:has-text('desar com a publicada')");
await roc.waitForSelector(".etiqueta >> text=publicada");
ok(await roc.isVisible("a[href='https://x.com/gesop_prova/status/1']"), "es desa l'enllaç de la publicació");
ok(await roc.isVisible("text=planificació inicial"), "l'historial de dates registra la data");

// al calendari i al projecte
await roc.goto(B + "/xarxes");
ok(await roc.isVisible(".graella-mes .dia.avui >> text=Resultats de l'enquesta de serveis"), "surt al calendari el dia que s'ha publicat");
ok(!(await roc.isVisible("#atencio >> text=Enquesta de serveis")), "el projecte ja no surt com a oportunitat");
await roc.goto(B + "/projectes");
await roc.click("a:has-text('Enquesta de serveis')");
await roc.waitForURL(/projectes\/[0-9a-f-]{36}/);
ok(await roc.isVisible("#xarxes >> text=Resultats de l'enquesta de serveis"), "el projecte mostra les seves publicacions");

// tauler: idea ràpida amb data en català
await roc.goto(B + "/xarxes/tauler");
await roc.fill("input[aria-label='idea ràpida per a xarxes']", "Fil sobre participació electoral dijous");
await roc.click("button:has-text('afegir idea')");
await roc.waitForSelector(".columna-tauler[data-estat=idea] >> text=Fil sobre participació electoral");
ok(!(await roc.isVisible(".columna-tauler >> text=participació electoral dijous")), "la data es treu del títol");
await roc.screenshot({ path: SHOTS + "xarxes-tauler.png", fullPage: true });

// desactivar-la a l'Aina: ja no la veu
await roc.goto(B + "/equip");
await roc.locator("tr", { hasText: "aina@prova.test" }).locator("button:has-text('xarxes activades')").click();
await roc.locator("tr", { hasText: "aina@prova.test" }).locator("button:has-text('activar xarxes')").waitFor();
await aina.goto(B + "/xarxes");
ok(await aina.isVisible("text=No la tens activada"), "desactivada, ja no hi entra");
ok((await enllacXarxes(aina).count()) === 0, "desactivada, ja no té l'enllaç al menú");

// mòbil
const mobil = await login("roc@prova.test", { width: 390, height: 844 });
for (const ruta of ["/xarxes", "/xarxes/tauler", urlPub.replace(B, "")]) {
  await mobil.goto(B + ruta);
  const ampla = await mobil.evaluate(() => document.documentElement.scrollWidth);
  ok(ampla <= 390, `sense scroll horitzontal a mòbil (${ruta.slice(0, 20)})`);
}
await roc.goto(B + "/xarxes");
await roc.screenshot({ path: SHOTS + "xarxes-calendari.png", fullPage: true });
await roc.goto(urlPub);
await roc.screenshot({ path: SHOTS + "xarxes-publicacio.png", fullPage: true });

ok(errors.length === 0, "cap error de JS " + errors.join(" | "));
await browser.close();
