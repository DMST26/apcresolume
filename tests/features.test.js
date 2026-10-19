// Pruebas de lo que los scripts originales no hacían: OSC libre, interruptores, pads con
// funciones de botón, recarga del mapa, JSON roto, mapa incluido y velocidad por WebSocket.
//
// Uso: node tests/features.test.js
var path = require("path");
var fs = require("fs");
var createRig = require("./chataigne_mock").createRig;

var ROOT = path.join(__dirname, "..");
var BASE = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "default_config.json"), "utf8"));
var FILE = "D:/chataigne/apc_config.json";
var failures = 0, checks = 0;

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function take(rig) { var o = rig.out.slice(); rig.out.length = 0; return o; }
function eq(name, got, want) {
	checks++;
	if (JSON.stringify(got) == JSON.stringify(want)) return;
	failures++;
	console.log("FALLO: " + name + "\n   esperado: " + JSON.stringify(want) + "\n   obtenido: " + JSON.stringify(got));
}
function ok(name, cond, extra) {
	checks++;
	if (cond) return;
	failures++;
	console.log("FALLO: " + name + (extra ? "\n   " + extra : ""));
}

function setup(cfg, opts) {
	opts = opts || {};
	var files = {};
	if (cfg) files[FILE] = JSON.stringify(cfg);
	var rig = createRig({ files: files, withWs: opts.withWs, targets: opts.targets, devices: opts.devices });
	var dir = opts.dir || path.join(ROOT, "src", "scripts");
	var s = {
		apc: rig.load(path.join(dir, "apc_to_resolume.js"), "apc"),
		leds: rig.load(path.join(dir, "resolume_to_apc.js"), "resolume"),
		api: rig.load(path.join(dir, "resolume_api.js"), "resolumeapi")
	};
	(opts.devices || []).forEach(function (id) { s[id] = rig.load(path.join(dir, "apc_to_resolume.js"), id); s[id].init(); });
	(opts.feedback || []).forEach(function (id) { s["fb_" + id] = rig.load(path.join(dir, "destino_a_apc.js"), id); s["fb_" + id].init(); });
	s.apc.init(); s.leds.init(); s.api.init();
	take(rig);
	return { rig: rig, s: s };
}

// ---------- OSC libre en pads y botones ----------
var c = clone(BASE);
c.pads[3] = { type: "osc", address: "/composition/layers/1/clips/1/video/effects/strobe/effect/frequency", value: 0.8, mode: "pulse", color: 13, led: { empty: 0, loaded: 3, active: 7 } };
c.pads[5] = { type: "osc", address: "/composition/layers/3/bypassed", value: 1, mode: "toggle", color: 5, led: { empty: 0, loaded: 1, active: 15 } };
c.side[6] = { type: "osc", address: "/composition/tempocontroller/resync", value: 1, mode: "hold", led: { idle: 0, active: 1 } };
var t = setup(c);
t.s.apc.noteOnEvent(1, 3, 127); t.s.apc.noteOffEvent(1, 3, 0);
eq("pad OSC pulso", take(t.rig), ["osc /composition/layers/1/clips/1/video/effects/strobe/effect/frequency 0.8",
	"osc /composition/layers/1/clips/1/video/effects/strobe/effect/frequency 0", "midi 7 3 13", "midi 3 3 13"]);
t.s.apc.noteOnEvent(1, 5, 127); t.s.apc.noteOffEvent(1, 5, 0);
eq("pad OSC interruptor (on)", take(t.rig), ["osc /composition/layers/3/bypassed 1", "midi 15 5 5"]);
t.s.apc.noteOnEvent(1, 5, 127); t.s.apc.noteOffEvent(1, 5, 0);
eq("pad OSC interruptor (off)", take(t.rig), ["osc /composition/layers/3/bypassed 0", "midi 1 5 5"]);
t.s.apc.noteOnEvent(1, 118, 127);
eq("botón OSC mantener (pulsar)", take(t.rig), ["osc /composition/tempocontroller/resync 1", "midi 1 118 1"]);
t.s.apc.noteOffEvent(1, 118, 0);
eq("botón OSC mantener (soltar)", take(t.rig), ["osc /composition/tempocontroller/resync 0", "midi 1 118 0"]);

// ---------- funciones de botón en pads ----------
c = clone(BASE);
c.pads[3] = { type: "blackout", color: 5, led: { empty: 0, loaded: 3, active: 15 } };
c.pads[5] = { type: "clear", layers: [2, 3], color: 9, led: { empty: 0, loaded: 1, active: 7 } };
t = setup(c);
t.s.apc.noteOnEvent(1, 3, 127);
eq("pad blackout", take(t.rig), ["osc /composition/bypassed 1", "midi 15 3 5"]);
t.s.leds.oscEvent("/composition/bypassed", [0]);
var leds = take(t.rig);
ok("respuesta de blackout pinta el pad y el botón lateral", leds.indexOf("midi 3 3 5") >= 0 && leds.indexOf("midi 1 114 0") >= 0, JSON.stringify(leds));
t.s.apc.noteOnEvent(1, 5, 127); t.s.apc.noteOffEvent(1, 5, 0);
eq("pad vaciar capas", take(t.rig), ["osc /composition/layers/2/clear 1", "osc /composition/layers/3/clear 1", "midi 7 5 9", "midi 1 5 9"]);

// ---------- faders ----------
c = clone(BASE);
c.faders[4] = { type: "osc", address: "/composition/layers/1/video/effects/blur/effect/amount", min: 0.2, max: 0.6 };
c.faders[5] = { type: "compOpacity" };
t = setup(c);
t.s.apc.ccEvent(1, 52, 127); t.s.apc.ccEvent(1, 52, 0); t.s.apc.ccEvent(1, 53, 127);
eq("faders OSC con rango y opacidad de composición", take(t.rig), [
	"osc /composition/layers/1/video/effects/blur/effect/amount 0.6",
	"osc /composition/layers/1/video/effects/blur/effect/amount 0.2",
	"osc /composition/video/opacity 1"]);

// ---------- velocidad de clip ----------
t = setup(BASE);
for (var v = 0; v <= 127; v++) t.s.apc.ccEvent(1, 54, v);
t.s.apc.update(0.05);
var sp = take(t.rig);
eq("velocidad: un solo PUT por update con el último valor", sp, [
	'put composition/layers/3/clips/10 {"transport":{"controls":{"speed":{"value":4}}}} Content-Type: application/json']);
t.s.apc.ccEvent(1, 54, 0); t.s.apc.update(0.05);
ok("velocidad abajo = 0,25x", take(t.rig)[0].indexOf('"value":0.25') > 0);
t.s.apc.update(0.05);
eq("velocidad: nada que enviar si el fader no se mueve", take(t.rig), []);

c = clone(BASE); c.options.speedMethod = "websocket";
t = setup(c);
t.s.apc.ccEvent(1, 54, 64); t.s.apc.update(0.05);
var g = take(t.rig);
ok("velocidad por WebSocket: pide el clip", g.length == 1 && g[0].indexOf("get composition/layers/3/clips/10?speed=") == 0, JSON.stringify(g));
t.s.api.dataEvent({ transport: { controls: { speed: { id: 1234, value: 1 } } } }, g[0].substring(4));
var w = take(t.rig);
ok("velocidad por WebSocket: manda el set con el id", w.length == 1 && w[0].indexOf('ws {"action":"set","parameter":"/parameter/by-id/1234","value":1.0') == 0, JSON.stringify(w));

t = setup(c, { withWs: false });
t.s.api.dataEvent({ transport: { controls: { speed: { id: 1, value: 1 } } } }, "composition/layers/3/clips/10?speed=1");
ok("sin módulo resolumews: avisa en el log en vez de fallar", t.rig.logs.join("\n").indexOf("no existe el módulo WebSocket") >= 0);
t.s.api.dataEvent("", "composition/layers/3/clips/10");
eq("respuesta vacía de un PUT: no hace nada", take(t.rig), []);

// ---------- destinos: Sunlite por MIDI y otro programa por OSC ----------
var G = require("../src/generator");
c = clone(BASE);
c.targets = [{ id: "sunlite", type: "midi", label: "Sunlite" }, { id: "luces", type: "osc", host: "192.168.1.20", port: 9000 }];
c.pads[3] = { type: "midi", target: "sunlite", msg: "note", channel: 2, number: 36, value: 127, mode: "pulse", color: 13, led: { loaded: 3, active: 7 } };
c.pads[5] = { type: "midi", target: "sunlite", msg: "cc", channel: 1, number: 20, value: 100, mode: "toggle", color: 9, led: { loaded: 1, active: 15 } };
c.side[6] = { type: "midi", target: "sunlite", msg: "pc", channel: 1, number: 7, mode: "pulse", led: { idle: 0, active: 1 } };
// pad de strobo: lanza el clip en Resolume y además una escena de Sunlite y un mensaje OSC
c.pads[56].extra = [
	{ type: "midi", target: "sunlite", msg: "note", channel: 1, number: 60, value: 127, mode: "hold" },
	{ type: "osc", target: "luces", address: "/escena/strobo", value: 1, mode: "toggle" }
];
c.faders[4] = { type: "midiCC", target: "sunlite", channel: 1, number: 7, min: 0, max: 127 };
c.faders[5] = { type: "osc", target: "luces", address: "/master", min: 0, max: 1 };
c = G.normalizeConfig(c);
eq("destinos: el mapa es válido", G.validateConfig(c), []);
t = setup(c, { targets: { sunlite: "midi", luces: "osc" } });
t.s.apc.noteOnEvent(1, 3, 127); t.s.apc.noteOffEvent(1, 3, 0);
eq("pad MIDI nota (pulso)", take(t.rig), ["sunlite on 2 36 127", "sunlite off 2 36", "midi 7 3 13", "midi 3 3 13"]);
t.s.apc.noteOnEvent(1, 5, 127); t.s.apc.noteOffEvent(1, 5, 0);
t.s.apc.noteOnEvent(1, 5, 127); t.s.apc.noteOffEvent(1, 5, 0);
eq("pad MIDI CC (interruptor)", take(t.rig), ["sunlite cc 1 20 100", "midi 15 5 9", "sunlite cc 1 20 0", "midi 1 5 9"]);
t.s.apc.noteOnEvent(1, 118, 127); t.s.apc.noteOffEvent(1, 118, 0);
eq("botón program change", take(t.rig), ["sunlite pc 1 7", "midi 1 118 1", "midi 1 118 0"]);
t.s.apc.noteOnEvent(1, 56, 127);
eq("pad con extras (pulsar)", take(t.rig), ["osc /composition/layers/2/clips/1/connect 1", "sunlite on 1 60 127", "luces osc /escena/strobo 1"]);
t.s.apc.noteOffEvent(1, 56, 0);
eq("pad con extras (soltar)", take(t.rig), ["sunlite off 1 60"]);
t.s.apc.noteOnEvent(1, 56, 127); t.s.apc.noteOffEvent(1, 56, 0);
eq("pad con extras (segunda vez: el interruptor se apaga)", take(t.rig), ["osc /composition/layers/2/clips/1/connect 1", "sunlite on 1 60 127", "luces osc /escena/strobo 0", "sunlite off 1 60"]);
t.s.apc.ccEvent(1, 52, 64); t.s.apc.ccEvent(1, 53, 127);
eq("faders a destinos", take(t.rig), ["sunlite cc 1 7 64", "luces osc /master 1"]);

t = setup(c, { targets: {} });
t.s.apc.noteOnEvent(1, 3, 127); t.s.apc.noteOnEvent(1, 3, 127);
ok("destino que no existe en Chataigne: avisa una sola vez", t.rig.logs.filter(function (l) { return l.indexOf("No existe el módulo \"sunlite\"") >= 0; }).length == 1, t.rig.logs.join("\n"));

var bad = clone(c);
bad.pads[3].target = "nada"; bad.pads[5].target = "luces";
var errs = G.validateConfig(G.normalizeConfig(bad)).map(function (e) { return e.msg; });
ok("validación: destino inexistente", errs.join("|").indexOf("«nada» no existe") >= 0, errs.join("|"));
ok("validación: MIDI a un destino OSC", errs.join("|").indexOf("«luces» es un destino OSC, no MIDI") >= 0 && errs.length == 2, errs.join("|"));

var noi = JSON.parse(G.buildNoisette(JSON.parse(fs.readFileSync(path.join(ROOT, "src", "noisette_template.json"), "utf8")), "D:\\Show\\chataigne\\", c.targets));
var names = noi.modules.items.map(function (m) { return m.niceName + ":" + m.type; });
eq(".noisette: módulos", names, ["apc:MIDI", "resolume:OSC", "resolumeapi:HTTP", "resolumews:WebSocket Client", "sunlite:MIDI", "luces:OSC"]);
eq(".noisette: ruta de los scripts", noi.modules.items[0].scripts.items[0].parameters[0].value, "D:/Show/chataigne/apc_to_resolume.js");

// ---------- dos APC: el segundo para Sunlite ----------
c = clone(BASE);
c.targets = [{ id: "sunlite", type: "midi", label: "Sunlite" }];
var pads2 = [];
for (var q = 0; q < 64; q++) pads2.push({ type: "none" });
pads2[0] = { type: "midi", target: "sunlite", msg: "note", channel: 1, number: 40, value: 127, mode: "pulse", feedback: true, color: 45, led: { loaded: 1, active: 7 } };
pads2[1] = { type: "midi", target: "sunlite", msg: "note", channel: 1, number: 41, value: 127, mode: "toggle", color: 21, led: { loaded: 1, active: 15 } };
pads2[8] = { type: "clip", layer: 2, clip: 9, color: 3, led: { empty: 3, loaded: 3, active: 7 } };
c.devices = [{ id: "apc2", label: "APC Sunlite", pads: pads2, faders: [{ type: "midiCC", target: "sunlite", channel: 1, number: 10, min: 0, max: 127 }] }];
// enlace: mientras suene un cegado (capa 2, clips 9-16), blackout en Sunlite (nota 50)
c.links = [{ label: "Cegado = BO luces", layer: 2, from: 9, to: 16, actions: [{ type: "midi", target: "sunlite", msg: "note", channel: 1, number: 50, value: 127 }] }];
c = G.normalizeConfig(c);
eq("dos APC: el mapa es válido", G.validateConfig(c), []);
t = setup(c, { targets: { sunlite: "midi" }, devices: ["apc2"], feedback: ["sunlite"] });
t.s.apc2.noteOnEvent(1, 1, 127); t.s.apc2.noteOffEvent(1, 1, 0);
eq("APC 2: su propio mapa (pad a Sunlite) y su LED en el APC 2", take(t.rig), ["sunlite on 1 41 127", "apc2:midi 15 1 21"]);
t.s.apc.noteOnEvent(1, 1, 127);
ok("APC 1 sigue con su mapa", take(t.rig).indexOf("osc /composition/selectedclip/video/gscale 1") < 0);
t.s.apc2.ccEvent(1, 48, 127);
eq("APC 2: fader a Sunlite", take(t.rig), ["sunlite cc 1 10 127"]);
t.s.leds.oscEvent("/composition/layers/2/clips/9/connected", [3]);
var both = take(t.rig);
ok("LEDs: el mismo clip se pinta en los dos APC", both.indexOf("midi 7 48 3") >= 0 && both.indexOf("apc2:midi 7 8 3") >= 0, JSON.stringify(both));
ok("enlace: al sonar un cegado, blackout en Sunlite", both.indexOf("sunlite on 1 50 127") >= 0, JSON.stringify(both));
t.s.leds.oscEvent("/composition/layers/2/clips/12/connected", [3]);
t.s.leds.oscEvent("/composition/layers/2/clips/9/connected", [1]);
ok("enlace: si suena otro cegado, sigue el blackout", take(t.rig).indexOf("sunlite off 1 50") < 0);
t.s.leds.oscEvent("/composition/layers/2/clips/12/connected", [1]);
ok("enlace: cuando no suena ninguno, se quita", take(t.rig).indexOf("sunlite off 1 50") >= 0);
t.s.leds.update(1);
ok("enlace: los clips del enlace también se sondean", take(t.rig).indexOf('osc /composition/layers/2/clips/16/connected "?"') >= 0);
t.s.apc2.noteOnEvent(1, 0, 127);
eq("feedback: el pad no pinta su LED al pulsar (lo pinta Sunlite)", take(t.rig), ["sunlite on 1 40 127", "sunlite off 1 40"]);
t.s.fb_sunlite.noteOnEvent(1, 40, 127);
eq("feedback: Sunlite devuelve la nota y se enciende el LED", take(t.rig), ["apc2:midi 7 0 45"]);
t.s.fb_sunlite.noteOnEvent(1, 40, 127);
eq("feedback: sin cambios no repinta", take(t.rig), []);
t.s.fb_sunlite.noteOffEvent(1, 40, 0);
eq("feedback: y se apaga", take(t.rig), ["apc2:midi 1 0 45"]);
t.s.fb_sunlite.noteOnEvent(2, 40, 127);
eq("feedback: otro canal no cuenta", take(t.rig), []);

var noi2 = JSON.parse(G.buildNoisette(JSON.parse(fs.readFileSync(path.join(ROOT, "src", "noisette_template.json"), "utf8")), "D:/Show", c.targets, c.devices));
var m2 = noi2.modules.items.filter(function (m) { return m.niceName == "apc2"; })[0];
var ms = noi2.modules.items.filter(function (m) { return m.niceName == "sunlite"; })[0];
ok(".noisette: módulo apc2 con el script del APC", m2 && m2.type == "MIDI" && m2.scripts.items[0].parameters[0].value == "D:/Show/apc_to_resolume.js");
ok(".noisette: Sunlite con destino_a_apc.js y Auto Add", ms && ms.scripts.items[0].parameters[0].value == "D:/Show/destino_a_apc.js" && ms.params.parameters[0].value === true);

var badDev = G.normalizeConfig({ devices: [{ id: "apc" }, { id: "resolume" }, { id: "apc2" }, { id: "x" }, { id: "y" }] });
ok("APC extra: nombres que chocan se cambian y como mucho 4 APC", badDev.devices.map(function (d) { return d.id; }).join(",") == "apc2,apc3,apc4", badDev.devices.map(function (d) { return d.id; }).join(","));

// ---------- recarga del mapa ----------
t = setup(BASE);
c = clone(BASE);
c.pads[63].color = 45;
c.name = "Otro club";
t.rig.files[FILE] = JSON.stringify(c);
t.s.leds.update(1); t.s.leds.update(1);
var rel = take(t.rig);
ok("recarga: repinta el pad con el color nuevo", rel.indexOf("midi 10 63 45") >= 0, JSON.stringify(rel.slice(0, 10)));
t.s.apc.update(1); t.s.apc.update(1);
ok("recarga: el script del APC también se entera", t.rig.logs.join("\n").indexOf("[apc] Mapa cargado") >= 0);
t.rig.files[FILE] = "{ esto no es json";
t.s.leds.update(1); t.s.leds.update(1);
take(t.rig);
t.s.leds.oscEvent("/composition/layers/2/clips/8/connected", [3]);
eq("JSON roto: sigue con el mapa anterior", take(t.rig), ["midi 7 63 45"]);
ok("JSON roto: avisa", t.rig.logs.join("\n").indexOf("WARN No se pudo leer") >= 0);

// ---------- scripts exportados con el mapa incluido ----------
var dist = path.join(ROOT, "chataigne");
if (fs.existsSync(path.join(dist, "apc_to_resolume.js"))) {
	t = setup(null, { dir: dist });
	t.s.leds.oscEvent("/composition/layers/1/clips/1/connected", [3]);
	eq("sin apc_config.json usa el mapa incluido", take(t.rig), ["midi 15 40 21"]);
	ok("sin apc_config.json lo dice en el log", t.rig.logs.join("\n").indexOf("uso el mapa incluido") >= 0);
}

console.log("\nComprobaciones: " + checks + ", fallos: " + failures);
process.exit(failures ? 1 : 0);
