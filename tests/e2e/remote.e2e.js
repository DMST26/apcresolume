// Prueba en un navegador real (Chromium + Playwright) del remote exportado y del constructor,
// contra el Resolume de mentira (tests/mock_resolume.js).
//
// Necesita Playwright: npm i -D playwright   (o NODE_PATH apuntando a una instalación)
// Uso: node tests/e2e/remote.e2e.js [carpeta-para-capturas]
"use strict";
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");
const mock = require("../mock_resolume");
const mockCha = require("../mock_chataigne");
const L = require("../../src/remote/layout");

const ROOT = path.join(__dirname, "..", "..");
const SHOTS = process.argv[2] || null;
let failures = 0, checks = 0;
function ok(name, cond, extra) {
	checks++;
	if (cond) { console.log("ok   " + name); return; }
	failures++;
	console.log("FALLO " + name + (extra ? "\n     " + extra : ""));
}
async function shot(page, name) { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + ".png") }); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
	const m = await mock.start({ root: ROOT });
	const exe = fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined;
	const browser = await chromium.launch({ executablePath: exe });
	try {
		// ---------- remote exportado, servido como desde la Root Directory de Resolume ----------
		const page = await browser.newPage({ viewport: { width: 1024, height: 700 }, hasTouch: true });
		const errors = [];
		page.on("pageerror", (e) => errors.push(e.message));
		await page.goto("http://127.0.0.1:" + m.port + "/remote-ejemplo.html");
		await page.waitForSelector("#status i.ok", { timeout: 5000 });
		ok("remote: conecta solo con el Resolume que lo sirve", (await page.textContent("#status")) == "Resolume" && await page.evaluate(() => window.REMOTE.conn.host) == "127.0.0.1:" + m.port);
		await sleep(300);
		await shot(page, "r1_clips");
		const clips = await page.$$(".rw-clipgrid .rw-clip");
		ok("remote: rejillas de clips dibujadas", clips.length == 24, "clips: " + clips.length);
		const nSub = m.log.filter((x) => x.action == "subscribe").length;
		ok("remote: se suscribe a los parámetros", nSub > 20, "subscribe: " + nSub);

		// lanzar el clip 3 de la capa 1
		const comp = m.sim.composition();
		const clipId = comp.layers[0].clips[2].id;
		m.log.length = 0;
		await clips[2].dispatchEvent("pointerdown", { button: 0, pointerId: 1 });
		await clips[2].dispatchEvent("pointerup", { button: 0, pointerId: 1 });
		await sleep(200);
		ok("remote: lanzar clip manda trigger true y false por id", JSON.stringify(m.log.filter((x) => x.action == "trigger").map((x) => [x.parameter, x.value])) ==
			JSON.stringify([["/composition/clips/by-id/" + clipId + "/connect", true], ["/composition/clips/by-id/" + clipId + "/connect", false]]), JSON.stringify(m.log));
		ok("remote: el clip se ilumina con la respuesta de Resolume", await clips[2].evaluate((n) => n.classList.contains("on")));
		ok("remote: clip vacío atenuado", await clips[4].evaluate((n) => n.classList.contains("empty")));

		// página Mezcla
		await page.click("#tabs button:nth-child(2)");
		await sleep(300);
		await shot(page, "r2_mezcla");
		const master = await page.$('.rw-fader:has(.rw-name:text-is("Master")) .rw-track');
		ok("remote: fader master", !!master);
		const box = await master.boundingBox();
		m.log.length = 0;
		await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.75);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.5, { steps: 4 });
		await page.mouse.up();
		await sleep(200);
		const sets = m.log.filter((x) => x.action == "set" && x.parameter == "/parameter/by-id/" + comp.master.id);
		ok("remote: mover el fader manda set por id", sets.length >= 1 && Math.abs(sets[sets.length - 1].value - 0.5) < 0.08, JSON.stringify(sets));
		ok("remote: Resolume (simulado) recibe el valor", Math.abs(m.sim.composition().master.value - 0.5) < 0.08);

		m.log.length = 0;
		const tap = await page.$('.rw-tempo .rw-button:has(.rw-name:text-is("TAP"))');
		await tap.dispatchEvent("pointerdown", { button: 0, pointerId: 2 });
		await tap.dispatchEvent("pointerup", { button: 0, pointerId: 2 });
		await sleep(100);
		ok("remote: tap = set true y false", JSON.stringify(m.log.map((x) => [x.action, x.value])) == JSON.stringify([["set", true], ["set", false]]), JSON.stringify(m.log));

		// el valor cambiado desde «Resolume» llega al remote
		m.sim.connect(() => {}).receive({ action: "set", parameter: "/parameter/by-id/" + comp.tempocontroller.tempo.id, value: 140 });
		await sleep(200);
		ok("remote: cambios de Resolume se ven en el remote", /140/.test(await page.textContent(".rw-bpm .rw-big")));
		ok("remote: sin errores de JavaScript", errors.length == 0, errors.join(" | "));

		// sin Resolume: aviso y reintento
		const p2 = await browser.newPage();
		await p2.goto("file://" + path.join(ROOT, "remote-ejemplo.html") + "?host=127.0.0.1:1");
		await sleep(400);
		ok("remote: sin conexión avisa", await p2.isVisible("#overlay.show"));
		await p2.close();

		// ---------- constructor ----------
		const b = await browser.newPage({ viewport: { width: 1500, height: 900 } });
		const berr = [];
		b.on("pageerror", (e) => berr.push(e.message));
		b.on("dialog", (d) => d.accept());
		await b.goto("file://" + path.join(ROOT, "configurador.html"));
		await b.click('#modeSeg [data-mode="remote"]');
		await sleep(200);
		await shot(b, "b1_vacio");
		ok("constructor: se abre el modo remote", await b.isVisible("#rbFrame"));

		// leer la composición del Resolume de prueba por WebSocket
		await b.click('#modeSeg [data-mode="apc"]');
		await b.click('[data-tab="res"]');
		await b.fill("#resPort", String(m.port));
		await b.dispatchEvent("#resPort", "change");
		await b.click("#btnReadComp");
		await sleep(600);
		ok("constructor: lee la composición por WebSocket", /Composición de prueba/.test(await b.textContent("#tab-res")));
		await b.click('#modeSeg [data-mode="remote"]');

		// arrastrar una pieza al lienzo
		await b.click('#rbTabs [data-lt="pieces"]');
		await b.dragAndDrop('.rb-piece[data-type="fader"]', "#rbFrame", { targetPosition: { x: 60, y: 80 } });
		await sleep(150);
		let lay = await b.evaluate(() => window.RemoteBuilder.layout());
		ok("constructor: arrastrar un fader crea el control", lay.pages[0].widgets.length == 1 && lay.pages[0].widgets[0].type == "fader");
		// arrastrar un parámetro encima: lo conecta
		await b.click('#rbTabs [data-lt="params"]');
		await b.fill("#rbSearch", "Master");
		await sleep(150);
		await b.dragAndDrop('.rb-param[data-path="/composition/master"]', "#rbGrid .rb-ov");
		await sleep(150);
		lay = await b.evaluate(() => window.RemoteBuilder.layout());
		ok("constructor: soltar un parámetro encima lo conecta", lay.pages[0].widgets[0].bind == "/composition/master", JSON.stringify(lay.pages[0].widgets[0]));
		// soltar un parámetro en un hueco: crea el control que le va
		await b.fill("#rbSearch", "Tap");
		await sleep(150);
		await b.dragAndDrop('.rb-param[data-path="/composition/tempocontroller/tempo_tap"]', "#rbFrame", { targetPosition: { x: 400, y: 300 } });
		await sleep(150);
		lay = await b.evaluate(() => window.RemoteBuilder.layout());
		ok("constructor: parámetro en un hueco crea un botón", lay.pages[0].widgets.some((w) => w.type == "button" && w.bind == "/composition/tempocontroller/tempo_tap"));
		await shot(b, "b2_arrastrar");

		// asistente
		await b.click('#rbTabs [data-lt="assist"]');
		await b.click("#rbWizard");
		await b.check('input[name="wzClips"][value="3"]');
		await b.check("#wzFx");
		await b.click("#wzOk");
		await sleep(300);
		lay = await b.evaluate(() => window.RemoteBuilder.layout());
		ok("constructor: el asistente crea páginas", lay.pages.length >= 2, lay.pages.map((p) => p.name).join(", "));
		await shot(b, "b3_asistente");

		// probar con el simulador
		await b.click('#rbMode [data-m="sim"]');
		await sleep(300);
		const simClip = await b.$("#rbGrid .rw-clip");
		await simClip.dispatchEvent("pointerdown", { button: 0, pointerId: 3 });
		await simClip.dispatchEvent("pointerup", { button: 0, pointerId: 3 });
		await sleep(150);
		ok("constructor: probar con el simulador", await simClip.evaluate((n) => n.classList.contains("on")));
		await shot(b, "b4_probar");
		await b.click('#rbMode [data-m="edit"]');

		// exportar
		await b.click("#btnExport");
		const [dl] = await Promise.all([b.waitForEvent("download"), b.click("#exDownload")]);
		const out = path.join(ROOT, "tests", "e2e", "remote-exportado.html");
		await dl.saveAs(out);
		await b.click("#exClose");
		ok("constructor: exportar remote", fs.readFileSync(out, "utf8").indexOf('"format":"resolume-remote"') > 0);
		ok("constructor: sin errores de JavaScript", berr.length == 0, berr.join(" | "));

		// el exportado funciona servido por «Resolume»
		const p3 = await browser.newPage({ viewport: { width: 1024, height: 700 } });
		await p3.goto("http://127.0.0.1:" + m.port + "/tests/e2e/remote-exportado.html");
		await p3.waitForSelector("#status i.ok", { timeout: 5000 });
		await sleep(300);
		ok("exportado: conecta y dibuja", (await p3.$$(".rw")).length > 5);
		await shot(p3, "r3_exportado");
		fs.unlinkSync(out);

		// ---------- remote mixto: Resolume + Chataigne ----------
		const cm = await mockCha.start({});
		try {
			const V = "chataigne:/customVariables/show/variables/";
			const mixed = L.normalize({ name: "Mixto", pages: [{ name: "Show", widgets: [
				{ type: "fader", x: 0, y: 0, w: 1, h: 4, label: "Master", bind: "/composition/master" },
				{ type: "meter", x: 2, y: 0, w: 4, h: 1, label: "Intensidad", bind: V + "intensidad" },
				{ type: "fader", x: 2, y: 1, w: 4, h: 1, label: "Intensidad", bind: V + "intensidad", opts: { orientation: "h" } },
				{ type: "lamp", x: 2, y: 2, w: 2, h: 1, label: "Intro", bind: "chataigne:/states/intro/active" },
				{ type: "button", x: 6, y: 0, w: 2, h: 2, label: "Play", bind: "chataigne:/sequences/show/playSequence" },
				{ type: "choice", x: 2, y: 3, w: 6, h: 1, label: "Modo", bind: V + "modo" },
				{ type: "value", x: 8, y: 0, w: 2, h: 1, label: "CC1 Sunlite", bind: "chataigne:/modules/sunlite/values/cc1" }
			] }] });
			const html = fs.readFileSync(path.join(ROOT, "remote-ejemplo.html"), "utf8").replace(/window\.REMOTE_LAYOUT = .*?;<\/script>/, () => "window.REMOTE_LAYOUT = " + JSON.stringify(mixed) + ";</script>");
			const mixFile = path.join(ROOT, "tests", "e2e", "remote-mixto.html");
			fs.writeFileSync(mixFile, html);
			const p4 = await browser.newPage({ viewport: { width: 1024, height: 700 } });
			const e4 = [];
			p4.on("pageerror", (e) => e4.push(e.message));
			await p4.goto("http://127.0.0.1:" + m.port + "/tests/e2e/remote-mixto.html?chataigne=127.0.0.1:" + cm.port);
			await p4.waitForFunction(() => document.querySelectorAll("#status i.ok").length == 2, null, { timeout: 6000 });
			ok("mixto: conecta con Resolume y con Chataigne", true);
			await sleep(400);
			await shot(p4, "r4_mixto");
			ok("mixto: el medidor muestra el valor de Chataigne", /0\.80/.test(await p4.textContent(".rw-meter .rw-num")));
			ok("mixto: pide avisos (LISTEN) de lo que usa", cm.log.filter((x) => x.COMMAND == "LISTEN").length >= 5);
			cm.log.length = 0;
			const hf = await p4.$(".rw-fader.h .rw-track");
			const hb = await hf.boundingBox();
			await p4.mouse.click(hb.x + hb.width * 0.25, hb.y + hb.height / 2);
			await sleep(250);
			const setI = cm.log.filter((x) => x[V.replace("chataigne:", "") + "intensidad"] !== undefined);
			ok("mixto: fader de Chataigne manda el valor en JSON", setI.length >= 1 && Math.abs(setI[setI.length - 1][V.replace("chataigne:", "") + "intensidad"] - 0.25) < 0.06, JSON.stringify(cm.log));
			ok("mixto: y vuelve al medidor", /0\.2/.test(await p4.textContent(".rw-meter .rw-num")));
			cm.log.length = 0;
			const play = await p4.$('.rw-button:has(.rw-name:text-is("Play"))');
			await play.dispatchEvent("pointerdown", { button: 0, pointerId: 5 });
			await play.dispatchEvent("pointerup", { button: 0, pointerId: 5 });
			await sleep(150);
			ok("mixto: pulsador de Chataigne se manda una vez", JSON.stringify(cm.log) == JSON.stringify([{ "/sequences/show/playSequence": 1 }]), JSON.stringify(cm.log));
			cm.log.length = 0;
			const drop = await p4.$('.rw-opt:text-is("Drop")');
			await drop.dispatchEvent("pointerdown", { button: 0, pointerId: 6 });
			await drop.dispatchEvent("pointerup", { button: 0, pointerId: 6 });
			await sleep(150);
			ok("mixto: selector manda la opción por su nombre", JSON.stringify(cm.log) == JSON.stringify([{ "/customVariables/show/variables/modo": "Drop" }]), JSON.stringify(cm.log));
			ok("mixto: la opción queda marcada", await drop.evaluate((n) => n.classList.contains("on")));
			ok("mixto: indicador encendido", await p4.$eval(".rw-lamp", (n) => n.classList.contains("on")));
			cm.sim.set("/states/intro/active", false);
			cm.sim.set("/modules/sunlite/values/cc1", 64);
			await sleep(200);
			ok("mixto: cambios de Chataigne llegan (indicador y valor de Sunlite)", !(await p4.$eval(".rw-lamp", (n) => n.classList.contains("on"))) && /64/.test(await p4.textContent(".rw-value .rw-big")));
			ok("mixto: sin errores de JavaScript", e4.length == 0, e4.join(" | "));
			fs.unlinkSync(mixFile);

			// constructor leyendo de Chataigne
			const b2 = await browser.newPage({ viewport: { width: 1500, height: 900 } });
			const e5 = [];
			b2.on("pageerror", (e) => e5.push(e.message));
			b2.on("dialog", (d) => d.accept());
			await b2.goto("file://" + path.join(ROOT, "configurador.html"));
			await b2.click('#modeSeg [data-mode="remote"]');
			await b2.click('#rbTabs [data-lt="params"]');
			await b2.click('#rbSrc [data-src="chataigne"]');
			await b2.fill("#rbChaHost", "127.0.0.1:" + cm.port);
			await b2.dispatchEvent("#rbChaHost", "change");
			await b2.click("#rbReadCha");
			await sleep(500);
			ok("constructor: lee Chataigne", /Chataigne: 127\.0\.0\.1/.test(await b2.textContent("#rbParams")) && /Intensidad/.test(await b2.textContent("#rbTree")));
			await b2.fill("#rbSearch", "Intensidad");
			await sleep(150);
			await b2.dragAndDrop('.rb-param[data-path="chataigne:/customVariables/show/variables/intensidad"]', "#rbFrame", { targetPosition: { x: 100, y: 100 } });
			await sleep(150);
			const lay2 = await b2.evaluate(() => window.RemoteBuilder.layout());
			ok("constructor: arrastrar un parámetro de Chataigne", lay2.pages[0].widgets.some((w) => w.bind == "chataigne:/customVariables/show/variables/intensidad"));
			await b2.click('#rbMode [data-m="sim"]');
			await sleep(300);
			await shot(b2, "b5_chataigne");
			ok("constructor: probar con Chataigne simulado", (await b2.$$("#rbGrid .rw")).length >= 1);
			ok("constructor (Chataigne): sin errores de JavaScript", e5.length == 0, e5.join(" | "));
		} finally {
			await cm.close();
		}
	} finally {
		await browser.close();
		await m.close();
	}
	console.log("\nComprobaciones: " + checks + ", fallos: " + failures);
	process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
