// Genera los archivos que se usan en el PC del show a partir de src/:
//   configurador.html        la aplicación (un solo archivo, se abre con doble clic)
//   chataigne/               los scripts, el mapa por defecto y el .noisette, listos para copiar
//
// Uso: node build.js
"use strict";
const fs = require("fs");
const path = require("path");
const G = require("./src/generator");

const ROOT = __dirname;
const SRC = path.join(ROOT, "src");
const read = (...p) => fs.readFileSync(path.join(...p), "utf8");

const config = G.normalizeConfig(JSON.parse(read(SRC, "default_config.json")));
const scripts = {};
G.SCRIPT_NAMES.forEach((n) => { scripts[n] = read(SRC, "scripts", n); });
const noisette = JSON.parse(read(SRC, "noisette_template.json"));

// ---------- configurador.html ----------

// dentro de <script> no puede aparecer "</script"
const inline = (code, what) => {
	if (/<\/script/i.test(code)) throw new Error(what + " contiene </script>");
	return code;
};
const data = JSON.stringify({ defaultConfig: config, scripts: scripts, noisette: noisette }).replace(/<\//g, "<\\/");

let html = read(SRC, "app", "configurador.html");
const parts = {
	"/*@@GENERATOR@@*/": inline(read(SRC, "generator.js"), "generator.js"),
	"/*@@DATA@@*/null": data,
	"/*@@APP@@*/": inline(read(SRC, "app", "app.js"), "app.js")
};
Object.keys(parts).forEach((k) => {
	if (html.indexOf(k) < 0) throw new Error("Falta la marca " + k + " en configurador.html");
	html = html.split(k).join(parts[k]);
});
fs.writeFileSync(path.join(ROOT, "configurador.html"), html);

// ---------- chataigne/ ----------

const out = path.join(ROOT, "chataigne");
fs.mkdirSync(out, { recursive: true });
const files = G.buildFiles(config, scripts, noisette, { noisette: true, folder: "D:/VISUALES/Jungle Tribal/chataigne" });
files.forEach((f) => fs.writeFileSync(path.join(out, f.name), f.text));

console.log("configurador.html (" + Math.round(html.length / 1024) + " KB)");
files.forEach((f) => console.log("chataigne/" + f.name));
