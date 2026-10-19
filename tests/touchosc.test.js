// Pruebas de TouchOSC: direcciones, el .tosc generado, el script touchosc.js de Chataigne y el
// reenvío del estado de Resolume a la tablet.
// Uso: node tests/touchosc.test.js
"use strict";
const path = require("path");
const fs = require("fs");
const zlib = require("zlib");
const T = require("../src/remote/touchosc");
const RL = require("../src/remote/layout");
const RC = require("../src/remote/catalog");
const CS = require("../src/remote/chataigne");
const createRig = require("./chataigne_mock").createRig;

let failures = 0, checks = 0;
function ok(name, cond, extra) {
	checks++;
	if (cond) return;
	failures++;
	console.log("FALLO: " + name + (extra ? "\n   " + extra : ""));
}
function eq(name, got, want) { ok(name, JSON.stringify(got) == JSON.stringify(want), "esperado " + JSON.stringify(want) + "\n   obtenido " + JSON.stringify(got)); }

// ---------- direcciones OSC de Resolume ----------
eq("osc: opacidad de capa", T.resolumeOsc("/composition/layers/2/video/opacity"), "/composition/layers/2/video/opacity");
eq("osc: tap (sin guion bajo)", T.resolumeOsc("/composition/tempocontroller/tempo_tap"), "/composition/tempocontroller/tempotap");
eq("osc: limpiar todo", T.resolumeOsc("/composition/disconnect-all"), "/composition/disconnectall");
eq("osc: lanzar clip", T.resolumeOsc("/composition/layers/1/clips/3/connect"), "/composition/layers/1/clips/3/connect");
eq("osc: efecto añadido (con /effect/)", T.resolumeOsc("/composition/layers/1/video/effects/blur/params/Amount"), "/composition/layers/1/video/effects/blur/effect/amount");
eq("osc: segundo efecto igual", T.resolumeOsc("/composition/layers/1/video/effects/blur#2/params/Amount"), "/composition/layers/1/video/effects/blur2/effect/amount");
eq("osc: transform de serie (sin /effect/)", T.resolumeOsc("/composition/layers/1/clips/1/video/effects/transform/params/Position X"), "/composition/layers/1/clips/1/video/effects/transform/positionx");
eq("osc: modo de fusión de la capa", T.resolumeOsc("/composition/layers/1/video/mixer/Blend Mode"), "/composition/layers/1/video/mixer/blendmode");
eq("osc: Chataigne", T.address("chataigne:/customVariables/show/variables/intensidad"), "/chataigne/customVariables/show/variables/intensidad");

// ---------- .tosc ----------
const comp = RC.skeleton({ layers: [{ name: "Visuales", clips: ["tunel", "lluvia", "", ""] }, { name: "Strobos", clips: ["blanco", "rojo"] }] });
const tree = CS.exampleTree({ targets: [{ id: "sunlite", type: "midi" }] });
const lay = RL.generate(comp, { clipLayers: [1, 2], mixLayers: [1, 2], tempo: true, master: true, chataignePaths: CS.walk(tree).filter((e) => !e.advanced).map((e) => e.path) }, "tablet-h", "Prueba", tree);
const b = T.build(lay, comp, tree, RL.DEVICES);
const xml = zlib.inflateSync(zlib.deflateSync(Buffer.from(b.xml))).toString();
ok("tosc: cabecera lexml 3", xml.indexOf("<?xml version='1.0' encoding='UTF-8'?><lexml version='3'><node ID='") == 0);
// XML bien formado: etiquetas abiertas y cerradas en orden (los CDATA no cuentan)
(function () {
	const s = xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "").replace(/<\?xml[^>]*\?>/, "");
	const stack = [];
	const re = /<(\/?)([a-zA-Z0-9]+)[^>]*?(\/?)>/g;
	let m, bad = null;
	while ((m = re.exec(s))) {
		if (m[3]) continue;
		if (!m[1]) stack.push(m[2]);
		else if (stack.pop() != m[2]) { bad = m[2]; break; }
	}
	ok("tosc: XML bien formado", !bad && stack.length == 0, bad || stack.join(","));
})();
const count = (t) => (xml.match(new RegExp("type='" + t + "'", "g")) || []).length;
ok("tosc: una página por página del remote dentro de un PAGER", count("PAGER") == 1 && count("GROUP") == lay.pages.length + 1);
ok("tosc: botones de clips con su nombre", count("BUTTON") >= 6 && xml.indexOf("<![CDATA[tunel]]>") > 0);
ok("tosc: faders", count("FADER") >= 3);
ok("tosc: lanzar clip manda a /connect", xml.indexOf("<![CDATA[/composition/layers/1/clips/1/connect]]>") > 0);
ok("tosc: Chataigne con su rango real", /\/chataigne\/customVariables\/show\/variables\/intensidad\]\]><\/value><scaleMin>0<\/scaleMin><scaleMax>1<\/scaleMax><\/partial><\/path><arguments><partial><type>VALUE<\/type><conversion>FLOAT<\/conversion><value><!\[CDATA\[x\]\]><\/value><scaleMin>0<\/scaleMin><scaleMax>1<\/scaleMax>/.test(xml));
ok("tosc: selector con tantas opciones como el enum", /<property type='i'><key><!\[CDATA\[steps\]\]><\/key><value>3<\/value>/.test(xml));
ok("tosc: ids únicos", (function () { const ids = xml.match(/ID='[^']+'/g); return ids.length == new Set(ids).size; })());
eq("mapa: clips a preguntar", b.map.polls.slice(0, 2), ["/composition/layers/1/clips/1/connected", "/composition/layers/1/clips/2/connected"]);
ok("mapa: parámetros de Chataigne con tipo y opciones", b.map.chataigne.some((e) => e.address == "/customVariables/show/variables/modo" && e.type == "ParamChoice" && e.options.length == 3));
const fx = T.build(RL.normalize({ pages: [{ widgets: [{ type: "knob", x: 0, y: 0, w: 2, h: 2, bind: "/composition/layers/1/video/effects/blur/params/Amount" }] }] }), comp, tree, RL.DEVICES);
ok("tosc: avisa de que las direcciones de efectos están sin comprobar", fx.warnings.some((w) => /Efecto/.test(w)));

// ---------- script touchosc.js en Chataigne ----------
function param(v, extra) { const p = { _v: v, get: () => p._v, set: (x) => { p._v = x; } }; return Object.assign(p, extra || {}); }
let triggered = 0;
const cv = { show: { variables: { intensidad: param(0.8), modo: param("Normal"), strobeAuto: param(false) } } };
const seq = { show: { playSequence: { trigger: () => { triggered++; } } } };
const files = { "D:/chataigne/touchosc.json": T.mapJSON(b, lay) };
const rig = createRig({ files: files, targets: { touchosc: "osc" }, root: { customVariables: cv, sequences: seq } });
const t = rig.load(path.join(__dirname, "..", "src", "scripts", "touchosc.js"), "touchosc");
t.init();
const take = () => { const o = rig.out.slice(); rig.out.length = 0; return o; };
take();
t.oscEvent("/composition/layers/1/clips/2/connect", [1]);
t.oscEvent("/composition/layers/1/clips/2/connect", [0]);
eq("touchosc: lanzar clip solo al pulsar", take(), ["osc /composition/layers/1/clips/2/connect 1"]);
t.oscEvent("/composition/layers/2/video/opacity", [0.4]);
t.oscEvent("/composition/tempocontroller/tempotap", [1]);
t.oscEvent("/composition/tempocontroller/tempotap", [0]);
eq("touchosc: faders y tap pasan tal cual a Resolume", take(), ["osc /composition/layers/2/video/opacity 0.4", "osc /composition/tempocontroller/tempotap 1", "osc /composition/tempocontroller/tempotap 0"]);
t.oscEvent("/chataigne/customVariables/show/variables/intensidad", [0.3]);
ok("touchosc: cambia una variable de Chataigne", cv.show.variables.intensidad._v == 0.3);
t.oscEvent("/chataigne/customVariables/show/variables/modo", [2]);
ok("touchosc: selector -> opción por nombre", cv.show.variables.modo._v == "Ambient", cv.show.variables.modo._v);
t.oscEvent("/chataigne/customVariables/show/variables/strobeAuto", [1]);
ok("touchosc: sí/no", cv.show.variables.strobeAuto._v === true);
t.oscEvent("/chataigne/sequences/show/playSequence", [1]);
t.oscEvent("/chataigne/sequences/show/playSequence", [0]);
ok("touchosc: pulsador de Chataigne una vez", triggered == 1, triggered);
t.oscEvent("/chataigne/modules/nada/x", [1]);
ok("touchosc: lo que no existe avisa", rig.logs.join("\n").indexOf("no existe /modules/nada/x") >= 0);
take();
t.update(0.2);
let out = take();
ok("touchosc: manda a la tablet los valores de Chataigne", out.indexOf("touchosc osc /chataigne/customVariables/show/variables/intensidad 0.3") >= 0 && out.indexOf("touchosc osc /chataigne/customVariables/show/variables/modo 2") >= 0 && out.indexOf("touchosc osc /chataigne/customVariables/show/variables/strobeAuto 1") >= 0, JSON.stringify(out));
t.update(0.2);
out = take();
ok("touchosc: sin cambios no repite", !out.some((x) => /chataigne/.test(x)), JSON.stringify(out));
cv.show.variables.intensidad._v = 0.9;
t.update(0.7);
out = take();
ok("touchosc: cambio desde Chataigne llega a la tablet y se preguntan los clips", out.indexOf("touchosc osc /chataigne/customVariables/show/variables/intensidad 0.9") >= 0 && out.indexOf('osc /composition/layers/1/clips/1/connected "?"') >= 0, JSON.stringify(out));

// ---------- resolume_to_apc.js reenvía a la tablet ----------
const cfgText = fs.readFileSync(path.join(__dirname, "..", "src", "default_config.json"), "utf8");
const rig2 = createRig({ files: { "D:/chataigne/apc_config.json": cfgText }, targets: { touchosc: "osc" } });
const leds = rig2.load(path.join(__dirname, "..", "src", "scripts", "resolume_to_apc.js"), "resolume");
leds.init();
rig2.out.length = 0;
leds.oscEvent("/composition/layers/1/clips/2/connected", [3]);
leds.oscEvent("/composition/layers/1/clips/2/connect", [1]);
leds.oscEvent("/composition/layers/2/video/opacity", [0.5]);
const fw = rig2.out.filter((x) => x.indexOf("touchosc") == 0);
eq("reenvío: estado de clip como 1/0 en /connect, sin el eco, y valores tal cual", fw, ["touchosc osc /composition/layers/1/clips/2/connect 1", "touchosc osc /composition/layers/2/video/opacity 0.5"]);
const rig3 = createRig({ files: { "D:/chataigne/apc_config.json": cfgText } });
const leds3 = rig3.load(path.join(__dirname, "..", "src", "scripts", "resolume_to_apc.js"), "resolume");
leds3.init();
leds3.oscEvent("/composition/layers/1/clips/2/connected", [3]);
ok("reenvío: sin módulo touchosc no pasa nada", rig3.logs.join("").indexOf("ERROR") < 0);

console.log("\nComprobaciones: " + checks + ", fallos: " + failures);
process.exit(failures ? 1 : 0);
