// Genera los archivos que se usan en el PC del show a partir de src/:
//   configurador.html        la aplicación (un solo archivo, se abre con doble clic)
//   chataigne/               los scripts, el mapa por defecto y el .noisette, listos para copiar
//   remote-ejemplo.html      un Resolume Remote de ejemplo hecho con el asistente
//
// Uso: node build.js
"use strict";
const fs = require("fs");
const path = require("path");
const G = require("./src/generator");
const RC = require("./src/remote/catalog");
const RL = require("./src/remote/layout");

const ROOT = __dirname;
const SRC = path.join(ROOT, "src");
const read = (...p) => fs.readFileSync(path.join(...p), "utf8");

// dentro de <script> no puede aparecer "</script"
const inline = (code, what) => {
	if (/<\/script/i.test(code)) throw new Error(what + " contiene </script>");
	return code;
};
const json = (o) => JSON.stringify(o).replace(/<\//g, "<\\/");
function fill(html, parts, what) {
	Object.keys(parts).forEach((k) => {
		if (html.indexOf(k) < 0) throw new Error("Falta la marca " + k + " en " + what);
		html = html.split(k).join(parts[k]);
	});
	return html;
}

const config = G.normalizeConfig(JSON.parse(read(SRC, "default_config.json")));
const scripts = {};
G.SCRIPT_NAMES.forEach((n) => { scripts[n] = read(SRC, "scripts", n); });
const noisette = JSON.parse(read(SRC, "noisette_template.json"));

// ---------- plantilla del remote (todo menos el diseño) ----------

const catalogJs = inline(read(SRC, "remote", "catalog.js"), "catalog.js");
const runtimeJs = inline(read(SRC, "remote", "runtime.js"), "runtime.js");
const chataigneJs = inline(read(SRC, "remote", "chataigne.js"), "chataigne.js");
// el CSS de los controles está en runtime.js (R.CSS); se copia también al <style> para que se vea
// antes de que cargue el script
const runtimeCss = /R\.CSS = `([\s\S]*?)`;/.exec(runtimeJs)[1];
const remoteTemplate = fill(read(SRC, "remote", "remote.html"), {
	"/*@@CSS@@*/": runtimeCss,
	"/*@@CATALOG@@*/": catalogJs,
	"/*@@CHATAIGNE@@*/": chataigneJs,
	"/*@@RUNTIME@@*/": runtimeJs,
	"/*@@APP@@*/": inline(read(SRC, "remote", "remote_app.js"), "remote_app.js")
}, "remote.html");
if (remoteTemplate.indexOf("/*@@LAYOUT@@*/null") < 0) throw new Error("Falta la marca del diseño en remote.html");

// ---------- configurador.html ----------

// los datos van los últimos: contienen la plantilla del remote, que tiene sus propias marcas
let html = fill(read(SRC, "app", "configurador.html"), {
	"/*@@GENERATOR@@*/": inline(read(SRC, "generator.js"), "generator.js"),
	"/*@@CATALOG@@*/": catalogJs,
	"/*@@CHATAIGNE@@*/": chataigneJs,
	"/*@@SIM@@*/": inline(read(SRC, "remote", "sim.js"), "sim.js"),
	"/*@@LAYOUTJS@@*/": inline(read(SRC, "remote", "layout.js"), "layout.js"),
	"/*@@TOUCHOSC@@*/": inline(read(SRC, "remote", "touchosc.js"), "touchosc.js"),
	"/*@@RUNTIME@@*/": runtimeJs,
	"/*@@BUILDER@@*/": inline(read(SRC, "app", "remote_builder.js"), "remote_builder.js"),
	"/*@@APP@@*/": inline(read(SRC, "app", "app.js"), "app.js")
}, "configurador.html");
html = fill(html, { "/*@@DATA@@*/null": json({ defaultConfig: config, scripts: scripts, noisette: noisette, remoteTemplate: remoteTemplate, touchoscScript: read(SRC, "scripts", "touchosc.js") }) }, "configurador.html");
fs.writeFileSync(path.join(ROOT, "configurador.html"), html);

// ---------- chataigne/ ----------

const out = path.join(ROOT, "chataigne");
fs.mkdirSync(out, { recursive: true });
const files = G.buildFiles(config, scripts, noisette, { noisette: true, folder: "D:/VISUALES/Jungle Tribal/chataigne" });
files.forEach((f) => fs.writeFileSync(path.join(out, f.name), f.text));
// script de TouchOSC (no lleva mapa dentro: lee touchosc.json, que se exporta con cada diseño)
fs.writeFileSync(path.join(out, "touchosc.js"), read(SRC, "scripts", "touchosc.js"));

// ---------- remote de ejemplo ----------

function exampleComposition() {
	const layers = [];
	for (let i = 1; i <= 5; i++) {
		layers.push({ name: config.layers[i] || "Capa " + i, clips: Array.from({ length: i == 2 ? 17 : 16 }, (_, j) => (config.layers[i] || "Clip") + " " + (j + 1)) });
	}
	return RC.skeleton({ name: "DMST DESEO 54 PLANTILLAS", layers: layers });
}
const example = RL.generate(exampleComposition(), {
	clipLayers: [1, 2, 3], clipsPerLayer: 8, columns: false, mixLayers: [1, 2, 3, 4, 5], tempo: true, master: true
}, "tablet-h", "Remote Deseo54 (ejemplo)");
fs.writeFileSync(path.join(ROOT, "remote-ejemplo.html"), remoteTemplate.split("/*@@LAYOUT@@*/null").join(json(example)));

console.log("configurador.html (" + Math.round(html.length / 1024) + " KB)");
console.log("remote-ejemplo.html (" + example.pages.map((p) => p.name + ": " + p.widgets.length).join(", ") + ")");
files.forEach((f) => console.log("chataigne/" + f.name));
