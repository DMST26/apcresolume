// Pruebas del generador: composición de Resolume, aviso de clips movidos, normalización y ZIP.
// Uso: node tests/generator.test.js
var path = require("path");
var fs = require("fs");
var zlib = require("zlib");
var G = require("../src/generator");

var failures = 0, checks = 0;
function ok(name, cond, extra) {
	checks++;
	if (cond) return;
	failures++;
	console.log("FALLO: " + name + (extra ? "\n   " + extra : ""));
}

var BASE = G.normalizeConfig(JSON.parse(fs.readFileSync(path.join(__dirname, "..", "src", "default_config.json"), "utf8")));
ok("normalizar dos veces da lo mismo", JSON.stringify(G.normalizeConfig(BASE)) == JSON.stringify(BASE));
ok("el mapa por defecto no tiene avisos", G.validateConfig(BASE).length == 0, JSON.stringify(G.validateConfig(BASE)));

// mapa de cualquier cosa: no revienta y deja todo completo
var junk = G.normalizeConfig({ pads: [{ type: "xx" }, null, { type: "clip", layer: "3", clip: "abc" }], faders: [{ type: "clipSpeed", min: -1 }] });
ok("mapa raro: 64 pads, 8+8 botones, 9 faders", junk.pads.length == 64 && junk.bottom.length == 8 && junk.side.length == 8 && junk.faders.length == 9);
ok("mapa raro: tipo desconocido = nada", junk.pads[0].type == "none");
ok("mapa raro: números de texto", junk.pads[2].layer === 3 && junk.pads[2].clip === 1);
ok("mapa raro: velocidad mínima corregida", junk.faders[0].min == 0.25);

// composición falsa como la que devuelve /api/v1/composition
function clip(name) { return { name: { value: name }, connected: { value: name ? "Disconnected" : "Empty" }, video: name ? {} : null }; }
var compJson = {
	name: { value: "DMST DESEO 54 PLANTILLAS" },
	layers: [
		{ name: { value: "Visuales" }, clips: [clip("tunel"), clip("lluvia"), clip("")] },
		{ name: { value: "Strobos" }, clips: [clip("blanco"), clip("rojo")] }
	]
};
var comp = G.parseComposition(compJson);
ok("composición: capas y clips", comp.layers.length == 2 && comp.layers[0].clips[1].name == "lluvia" && comp.layers[0].clips[2].empty);

var c = G.normalizeConfig({
	pads: [
		{ type: "clip", layer: 1, clip: 1, name: "tunel" },     // bien
		{ type: "clip", layer: 1, clip: 1, name: "lluvia" },    // se ha movido al clip 2
		{ type: "clip", layer: 1, clip: 3, name: "" },          // vacío en Resolume
		{ type: "clip", layer: 7, clip: 1, name: "x" },         // capa que no existe
		{ type: "dual", layer: 2, clip: 2, name: "rojo", layer2: 1, clip2: 2, name2: "otro" }
	]
});
var res = G.checkNames(c, comp);
function find(pad, kind) { return res.filter(function (r) { return r.ref.pad == pad && r.kind == kind; })[0]; }
ok("nombres: el que coincide no avisa", !res.some(function (r) { return r.ref.pad == 0; }));
ok("nombres: clip movido y dónde está ahora", find(1, "name") && find(1, "name").moveTo == 2, JSON.stringify(res));
ok("nombres: clip vacío", !!find(2, "empty"));
ok("nombres: capa que no existe", !!find(3, "layer"));
ok("nombres: el 2.º clip de un pad doble", res.some(function (r) { return r.ref.pad == 4 && r.which == 2 && r.kind == "name" && !r.moveTo; }));
ok("composición rara da error claro", (function () { try { G.parseComposition({ foo: 1 }); return false; } catch (e) { return /layers/.test(e.message); } })());

// el mapa incluido en los scripts se puede leer tal cual
var tpl = fs.readFileSync(path.join(__dirname, "..", "src", "scripts", "resolume_to_apc.js"), "utf8");
var built = G.buildScript(tpl, BASE);
var line = built.split("\n").filter(function (l) { return l.indexOf("var EMBEDDED_CONFIG = ") == 0; })[0];
ok("script con mapa incluido", line && JSON.stringify(eval("(" + line.substring(22, line.lastIndexOf("; //")) + ")")) == JSON.stringify(BASE));
var weird = G.normalizeConfig({ name: 'Club "raro" $& $1' });
ok("nombre con comillas y $ no rompe el script", G.buildScript(tpl, weird).indexOf('Club \\"raro\\" $& $1') > 0);

// ZIP: se puede descomprimir y el CRC es correcto
var files = [{ name: "a.txt", text: "hola ñandú" }, { name: "b.json", text: "{}" }];
var zip = Buffer.from(G.makeZip(files));
var pos = 0, got = [];
while (zip.readUInt32LE(pos) == 0x04034b50) {
	var nlen = zip.readUInt16LE(pos + 26), size = zip.readUInt32LE(pos + 18), crc = zip.readUInt32LE(pos + 14);
	var name = zip.slice(pos + 30, pos + 30 + nlen).toString("utf8");
	var data = zip.slice(pos + 30 + nlen, pos + 30 + nlen + size);
	got.push(name + "=" + data.toString("utf8") + (zlib.crc32 && zlib.crc32(data) != crc ? " (CRC mal)" : ""));
	pos += 30 + nlen + size;
}
ok("ZIP: archivos y contenido", got.join("|") == "a.txt=hola ñandú|b.json={}", got.join("|"));
ok("ZIP: directorio central al final", zip.readUInt32LE(zip.length - 22) == 0x06054b50);

console.log("\nComprobaciones: " + checks + ", fallos: " + failures);
process.exit(failures ? 1 : 0);
