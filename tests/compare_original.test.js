// Compara los scripts originales (tests/original) con los genéricos (src/scripts) usando el mapa
// por defecto. Tienen que mandar exactamente lo mismo por MIDI y OSC, salvo las diferencias
// que se cambiaron a propósito (ver KNOWN_DIFFERENCES).
//
// Uso: node tests/compare_original.test.js
var path = require("path");
var fs = require("fs");
var createRig = require("./chataigne_mock").createRig;

var ROOT = path.join(__dirname, "..");
var CONFIG = fs.readFileSync(path.join(ROOT, "src", "default_config.json"), "utf8");

var KNOWN_DIFFERENCES = [
	"Botón lateral 7 (libre): el original encendía su LED al pulsar aunque no hace nada; el nuevo no.",
	"Fader 7 (velocidad): el nuevo manda un PUT por la API web y como mucho 20 veces por segundo.",
	"Refresco: mismo contenido pero en otro orden (se compara sin orden).",
	"Refresco: también pregunta el estado del strobe negro (capa 2, clip 17); el original esperaba al siguiente sondeo."
];
var IGNORE_EXTRA = ["osc /composition/layers/2/clips/17/connected \"?\""];

var failures = 0, checks = 0;

function rigs() {
	var orig = createRig({});
	var neu = createRig({ files: { "D:/chataigne/apc_config.json": CONFIG } });
	return {
		orig: orig, neu: neu,
		o: {
			apc: orig.load(path.join(__dirname, "original", "apc_to_resolume.js"), "apc"),
			leds: orig.load(path.join(__dirname, "original", "resolume_to_apc.js"), "resolume"),
			api: orig.load(path.join(__dirname, "original", "resolume_api.js"), "resolumeapi")
		},
		n: {
			apc: neu.load(path.join(ROOT, "src", "scripts", "apc_to_resolume.js"), "apc"),
			leds: neu.load(path.join(ROOT, "src", "scripts", "resolume_to_apc.js"), "resolume"),
			api: neu.load(path.join(ROOT, "src", "scripts", "resolume_api.js"), "resolumeapi")
		}
	};
}

function take(rig) { var o = rig.out.slice(); rig.out.length = 0; return o; }

function same(name, a, b, unordered) {
	checks++;
	b = b.filter(function (m, i) { return IGNORE_EXTRA.indexOf(m) < 0 || a.indexOf(m) >= 0; });
	var x = unordered ? a.slice().sort() : a, y = unordered ? b.slice().sort() : b;
	if (JSON.stringify(x) == JSON.stringify(y)) return;
	failures++;
	console.log("FALLO: " + name);
	var extra = b.slice(), missing = [];
	a.forEach(function (m) { var i = extra.indexOf(m); if (i >= 0) extra.splice(i, 1); else missing.push(m); });
	if (!missing.length && !extra.length) console.log("   mismo contenido, distinto orden:\n   original: " + JSON.stringify(a) + "\n   nuevo:    " + JSON.stringify(b));
	if (missing.length) console.log("   falta en el nuevo: " + JSON.stringify(missing));
	if (extra.length) console.log("   sobra en el nuevo: " + JSON.stringify(extra));
}

function both(R, fnO, fnN) {
	fnO(R.o); fnN = fnN || fnO; fnN(R.n);
	return [take(R.orig), take(R.neu)];
}

// ---------- arranque ----------
var R = rigs();
var r = both(R, function (s) { s.apc.init(); s.leds.init(); s.api.init(); });
same("init (los 3 scripts)", r[0], r[1], true);
same("ritmo de sondeo del script de LEDs", [R.o.leds._rate], [R.n.leds._rate]);
same("ritmo de sondeo del script de la API", [R.o.api._rate], [R.n.api._rate]);

// ---------- pads, botones y shift ----------
var notes = [];
for (var p = 0; p < 64; p++) notes.push(p);
for (var b = 0; b < 8; b++) notes.push(100 + b);
for (var s = 0; s < 8; s++) notes.push(112 + s);
notes.push(122);

for (var round = 0; round < 2; round++) {   // dos vueltas: los interruptores cambian de estado
	notes.forEach(function (n) {
		if (n == 118) return; // botón lateral 7, ver KNOWN_DIFFERENCES
		var r = both(R, function (s) { s.apc.noteOnEvent(1, n, 127); s.apc.noteOffEvent(1, n, 0); });
		same("nota " + n + " (vuelta " + (round + 1) + ")", r[0], r[1], n == 119 || n == 122);
	});
}
r = both(R, function (s) { s.apc.noteOnEvent(1, 5, 0); });
same("note on con velocity 0 no hace nada", r[0], r[1]);

// ---------- faders ----------
for (var f = 0; f < 9; f++) {
	if (f == 6) continue; // velocidad, ver más abajo
	[0, 1, 64, 100, 127].forEach(function (v) {
		var r = both(R, function (s) { s.apc.ccEvent(1, 48 + f, v); });
		same("fader " + (f + 1) + " = " + v, r[0], r[1]);
	});
}

// fader 7: el original pide por GET; el nuevo manda PUT en el siguiente update
R.n.apc.ccEvent(1, 54, 64);
R.n.apc.ccEvent(1, 54, 127);
R.n.apc.update(0.05);
var put = take(R.neu);
checks++;
if (put.length != 1 || put[0].indexOf("put composition/layers/3/clips/10 {\"transport\":{\"controls\":{\"speed\":{\"value\":4}}}}") != 0) {
	failures++; console.log("FALLO: fader 7 por PUT -> " + JSON.stringify(put));
}
R.o.apc.ccEvent(1, 54, 64); take(R.orig);

// ---------- Resolume -> LEDs ----------
R = rigs();
both(R, function (s) { s.apc.init(); s.leds.init(); s.api.init(); });
for (var L = 1; L <= 6; L++) {
	for (var C = 1; C <= 20; C++) {
		[0, 1, 2, 3, 4, 3, 0].forEach(function (v) {
			var r = both(R, function (s) { s.leds.oscEvent("/composition/layers/" + L + "/clips/" + C + "/connected", [v]); });
			same("LED capa " + L + " clip " + C + " estado " + v, r[0], r[1]);
		});
	}
}
r = both(R, function (s) { s.leds.oscEvent("/composition/layers/2/clips/3/connect", [1]); });
same("se ignora /connect", r[0], r[1]);
[1, 0].forEach(function (v) {
	r = both(R, function (s) { s.leds.oscEvent("/composition/bypassed", [v]); });
	same("blackout = " + v, r[0], r[1]);
	for (var L = 1; L <= 6; L++) {
		r = both(R, function (s) { s.leds.oscEvent("/composition/layers/" + L + "/bypassed", [v]); });
		same("bypass capa " + L + " = " + v, r[0], r[1]);
	}
});
[0.2333, 0.2333, 0.25, 128].forEach(function (v) {
	r = both(R, function (s) { s.leds.oscEvent("/composition/tempocontroller/tempo", [v]); });
	same("tempo " + v, r[0], r[1]);
});
for (var t = 0; t < 7; t++) {
	r = both(R, function (s) { s.leds.update(1); });
	same("sondeo " + (t + 1), r[0], r[1], true);
	r = both(R, function (s) { s.leds.oscEvent("/composition/layers/1/clips/3/connected", [3]); });
	same("tras sondeo " + (t + 1) + ": repintado cada 5 s", r[0], r[1]);
}

// ---------- API web: R/G/B y clip anterior/siguiente ----------
function sel(r, g, b) { return { connected: { value: "Connected" }, video: { r: { value: r }, g: { value: g }, b: { value: b } } }; }
var cases = [
	[{ connected: { value: "Empty" }, video: null }, "composition/clips/selected"],
	[sel(true, true, true), "composition/clips/selected"],
	[sel(true, false, true), "composition/clips/selected"],
	[sel(true, true, true), "composition/clips/selected?toggle=r"],
	[sel(false, true, true), "composition/clips/selected?toggle=g"],
	[sel(true, true, false), "composition/clips/selected?toggle=b"],
	[{ connected: { value: "Empty" }, video: null }, "composition/clips/selected?toggle=r"]
];
cases.forEach(function (c, i) {
	var r = both(R, function (s) { s.api.dataEvent(c[0], c[1]); });
	same("R/G/B caso " + i, r[0], r[1]);
});
function layer(states) { return { clips: states.map(function (s) { return { connected: { value: s } }; }) }; }
[
	[["Empty", "Disconnected", "Connected", "Disconnected", "Empty", "Disconnected"], "next"],
	[["Empty", "Disconnected", "Connected", "Disconnected", "Empty", "Disconnected"], "prev"],
	[["Disconnected", "Disconnected", "Disconnected"], "next"],
	[["Disconnected", "Disconnected", "Disconnected"], "prev"],
	[["Disconnected", "Disconnected", "Connected"], "next"],
	[["Connected", "Empty", "Empty"], "prev"]
].forEach(function (c, i) {
	var r = both(R, function (s) { s.api.dataEvent(layer(c[0]), "composition/layers/1?step=" + c[1]); });
	same("clip " + c[1] + " caso " + i, r[0], r[1]);
});
r = both(R, function (s) { s.api.update(0.2); });
same("sondeo de la API", r[0], r[1]);

console.log("\nComprobaciones: " + checks + ", fallos: " + failures);
console.log("Diferencias a propósito:\n - " + KNOWN_DIFFERENCES.join("\n - "));
process.exit(failures ? 1 : 0);
