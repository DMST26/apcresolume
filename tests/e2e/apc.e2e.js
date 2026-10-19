// Prueba en Chromium del configurador del APC: varios APC, destino con LED según el programa,
// enlace «cegados → blackout de Sunlite» y exportación.
// Necesita Playwright (npm i -D playwright). Uso: node tests/e2e/apc.e2e.js
"use strict";
const path = require("path");
const fs = require("fs");
const os = require("os");
const { chromium } = require("playwright");
const G = require("../../src/generator");

const ROOT = path.join(__dirname, "..", "..");
let failures = 0, checks = 0;
function ok(name, cond, extra) {
	checks++;
	if (cond) { console.log("ok   " + name); return; }
	failures++;
	console.log("FALLO " + name + (extra ? "\n     " + extra : ""));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
	const exe = fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined;
	const b = await chromium.launch({ executablePath: exe });
	try {
		const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
		const errors = [];
		p.on("pageerror", (e) => errors.push(e.message));
		p.on("dialog", (d) => d.dismiss()); // «¿copiar el mapa?» -> no: APC vacío
		await p.goto("file://" + path.join(ROOT, "configurador.html"));
		const saved = () => p.evaluate(() => JSON.parse(localStorage.getItem("apcres.current")));

		await p.click("#devAdd");
		await sleep(150);
		let cfg = await saved();
		ok("añadir APC: se llama apc2 y empieza vacío", cfg.devices.length == 1 && cfg.devices[0].id == "apc2" && cfg.devices[0].pads.every((d) => d.type == "none"));

		await p.click('[data-tab="dst"]');
		await p.click('[data-addtarget="sunlite"]');
		await p.click('[data-kind="pad"][data-i="56"]');
		await p.selectOption('#tab-ctl select[data-k="type"]', "midi");
		await sleep(100);
		await p.check('#tab-ctl input[data-k="feedback"]');
		await sleep(100);
		cfg = await saved();
		const pad = cfg.devices[0].pads[56];
		ok("APC 2: pad a Sunlite con LED según Sunlite", pad.type == "midi" && pad.target == "sunlite" && pad.feedback === true, JSON.stringify(pad));
		ok("APC 1 no cambia", cfg.pads[56].type == "clip");

		await p.click('[data-tab="lnk"]');
		await p.click("#lnkPreset");
		await sleep(150);
		cfg = await saved();
		ok("plantilla de enlace: cegados (capa 2, clips 9-16) -> nota a Sunlite", cfg.links.length == 1 && cfg.links[0].layer == 2 && cfg.links[0].from == 9 && cfg.links[0].to == 16 && cfg.links[0].actions[0].target == "sunlite");
		await p.fill('[data-la="0:0:number"]', "64");
		await p.dispatchEvent('[data-la="0:0:number"]', "change");
		await sleep(100);
		cfg = await saved();
		ok("enlace: cambiar la nota", cfg.links[0].actions[0].number == 64);
		ok("el mapa no tiene errores", G.validateConfig(G.normalizeConfig(cfg)).filter((w) => w.level == "error").length == 0);

		await p.click('#devBar [data-dev="0"]');
		await sleep(100);
		ok("volver al APC 1", /Strobo blanco/.test(await p.textContent('[data-kind="pad"][data-i="56"] .lbl')));

		await p.click('[data-tab="exp"]');
		await p.check("#expNoisette");
		const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#btnZip")]);
		const zipPath = path.join(os.tmpdir(), "apc-multi-" + Date.now() + ".zip");
		await dl.saveAs(zipPath);
		const zip = fs.readFileSync(zipPath).toString("latin1");
		ok("ZIP: incluye destino_a_apc.js y el .noisette con apc2", zip.indexOf("destino_a_apc.js") >= 0 && zip.indexOf('"niceName":"apc2"') >= 0);
		fs.unlinkSync(zipPath);
		ok("sin errores de JavaScript", errors.length == 0, errors.join(" | "));
	} finally {
		await b.close();
	}
	console.log("\nComprobaciones: " + checks + ", fallos: " + failures);
	process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
