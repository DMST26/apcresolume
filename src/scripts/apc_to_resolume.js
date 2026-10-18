// APC mini mk2 -> Resolume (OSC)
// Script del módulo MIDI "apc". Lo que pulsas en el APC sale por OSC al módulo "resolume".
//
// Este script NO lleva el mapa dentro: lo lee de apc_config.json, en la misma carpeta que
// el script. El mapa se edita con configurador.html. Si no encuentra el archivo, usa el mapa
// que el configurador dejó incluido al exportar (EMBEDDED_CONFIG).
//
// Además de Resolume, cualquier control puede mandar OSC o MIDI a otros módulos de Chataigne
// ("destinos" del mapa, por ejemplo un módulo MIDI "sunlite" con un puerto loopMIDI).
//
// Notas del APC: pads 0-63 (0 = abajo a la izquierda), botones de abajo 100-107,
// laterales 112-119 (112 = arriba), shift 122, faders CC 48-56.
//
// Generado por el configurador APC mini mk2 <-> Resolume. Motor JS de Chataigne: sin let,
// sin funciones flecha, sin expresiones regulares.

var CONFIG_FILE = "apc_config.json";
var EMBEDDED_CONFIG = null; // @@CONFIG@@

var cfg = null;
var cfgText = "";
var reloadTime = 0;

var TRACK_FIRST = 100; // botones de abajo 100-107
var SCENE_FIRST = 112; // botones laterales 112-119 (112 = arriba)
var SHIFT = 122;
var FADER_FIRST = 48;  // CC 48-55 faders, 56 master

var COLORS8 = [3, 5, 9, 13, 21, 37, 45, 53]; // para "Test LEDs"

var bypassed = [];     // por capa: 1 = bypass puesto desde el APC
for (var q = 0; q < 100; q++) bypassed.push(0);
var blackout = 0;
var oscToggle = [];    // por nota: estado de los controles OSC/MIDI en modo interruptor
for (var q2 = 0; q2 < 128; q2++) oscToggle.push(0);
var extraToggle = [];  // nota * 4 + n: estado de las acciones extra en modo interruptor
for (var q3 = 0; q3 < 512; q3++) extraToggle.push(0);
var MAX_EXTRA = 4;
var warnedTargets = [];
var pendingSpeed = [-1, -1, -1, -1, -1, -1, -1, -1, -1]; // fader -> velocidad por enviar
var lastSpeed = [-1, -1, -1, -1, -1, -1, -1, -1, -1];

var testLeds = script.addTrigger("Test LEDs", "Enciende todos los pads para comprobar que llega el MIDI al APC");
var clearLeds = script.addTrigger("Refresh LEDs", "Apaga y pide el estado a Resolume");
var reloadMap = script.addTrigger("Recargar mapa", "Vuelve a leer apc_config.json");

function resolume() { return root.modules.resolume; }
function api() { return root.modules.resolumeapi; }

// Módulo de Chataigne al que va una acción OSC o MIDI. Sin destino = "resolume".
function target(id) {
	if (!id || id == "resolume") return root.modules.resolume;
	var m = root.modules[id];
	if (!m) {
		for (var i = 0; i < warnedTargets.length; i++) if (warnedTargets[i] == id) return m;
		warnedTargets.push(id);
		script.logError("No existe el módulo \"" + id + "\" en Chataigne. Créalo con ese nombre (lo usa el mapa como destino).");
	}
	return m;
}

// Manda una acción OSC o MIDI: on = 1 al activar, 0 al desactivar.
//   OSC: valor o 0. Nota: note on con su velocity o note off. CC: valor o 0. Program change: solo al activar.
function sendOut(a, on) {
	var m = target(a.target);
	if (!m) return;
	if (a.type == "osc") { m.send(a.address, on ? a.value : 0); return; }
	if (a.msg == "cc") m.sendCC(a.channel, a.number, on ? a.value : 0);
	else if (a.msg == "pc") { if (on) m.sendProgramChange(a.channel, a.number); }
	else if (on) m.sendNoteOn(a.channel, a.number, a.value);
	else m.sendNoteOff(a.channel, a.number);
}

// Acciones extra de un control ("además, enviar..."): pressed = true al pulsar, false al soltar.
function runExtras(note, d, pressed) {
	if (!d.extra) return;
	for (var i = 0; i < d.extra.length && i < MAX_EXTRA; i++) {
		var a = d.extra[i];
		var k = note * MAX_EXTRA + i;
		if (a.mode == "toggle") {
			if (!pressed) continue;
			extraToggle[k] = extraToggle[k] ? 0 : 1;
			sendOut(a, extraToggle[k]);
		}
		else if (a.mode == "hold") sendOut(a, pressed ? 1 : 0);
		else if (pressed) { sendOut(a, 1); sendOut(a, 0); }
	}
}

// ---------- mapa ----------

function configPath() { return script.getScriptDirectory() + "/" + CONFIG_FILE; }

// Devuelve true si el mapa ha cambiado.
function loadConfig() {
	var p = configPath();
	if (util.fileExists(p)) {
		var text = util.readFile(p);
		if (cfg && text == cfgText) return false;
		cfgText = text;
		var c = util.readFile(p, true);
		if (c && c.pads && c.pads.length == 64) {
			cfg = c;
			script.log("Mapa cargado: " + p + " (" + cfg.name + ")");
			return true;
		}
		script.logWarning("No se pudo leer " + p + " (¿JSON roto?). Sigo con el mapa anterior.");
	}
	if (!cfg && EMBEDDED_CONFIG) {
		cfg = EMBEDDED_CONFIG;
		script.log("No hay " + CONFIG_FILE + ": uso el mapa incluido en el script (" + cfg.name + ")");
		return true;
	}
	if (!cfg) script.logError("No hay mapa: falta " + p);
	return false;
}

function opt(name, def) {
	if (cfg && cfg.options && cfg.options[name] != undefined) return cfg.options[name];
	return def;
}

// Definición del control de una nota (pad, botón o shift).
function defFor(note) {
	if (!cfg) return null;
	if (note >= 0 && note <= 63) return cfg.pads[note];
	if (note >= TRACK_FIRST && note < TRACK_FIRST + 8) return cfg.bottom[note - TRACK_FIRST];
	if (note >= SCENE_FIRST && note < SCENE_FIRST + 8) return cfg.side[note - SCENE_FIRST];
	if (note == SHIFT) return cfg.shift;
	return null;
}

// LED de un control en reposo ("idle") o activado ("active").
// Pads: canal = brillo/animación, velocity = color. Botones: canal 1, 0 apagado, 1 fijo, 2 parpadeo.
function ctlLed(note, d, on) {
	if (note <= 63) {
		var ch = on ? d.led.active : d.led.loaded;
		if (!ch) local.sendNoteOn(1, note, 0);
		else local.sendNoteOn(ch, note, d.color);
		return;
	}
	if (note == SHIFT) return; // el shift no tiene LED
	local.sendNoteOn(1, note, on ? d.led.active : d.led.idle);
}

// ---------- acciones ----------

function pulse(address) {
	resolume().send(address, 1);
	resolume().send(address, 0);
}

function connectClip(layer, clip) {
	resolume().send("/composition/layers/" + layer + "/clips/" + clip + "/connect", 1);
}

function clearLayer(layer) {
	resolume().send("/composition/layers/" + layer + "/clear", 1);
}

function press(note, d) {
	pressMain(note, d);
	runExtras(note, d, true);
}

// Acción principal de un control.
function pressMain(note, d) {
	var t = d.type;
	var i;
	if (!t || t == "none") return false;

	if (t == "clip") { connectClip(d.layer, d.clip); return false; }
	if (t == "dual") { connectClip(d.layer, d.clip); connectClip(d.layer2, d.clip2); return false; }
	if (t == "rgb") { api().sendGET("composition/clips/selected?toggle=" + d.rgb, "json"); return false; }

	if (t == "bypass") {
		var on = bypassed[d.layers[0]] ? 0 : 1;
		for (i = 0; i < d.layers.length; i++) {
			bypassed[d.layers[i]] = on;
			resolume().send("/composition/layers/" + d.layers[i] + "/bypassed", on);
		}
		ctlLed(note, d, on);
		return false;
	}
	if (t == "blackout") {
		blackout = blackout ? 0 : 1;
		resolume().send("/composition/bypassed", blackout);
		ctlLed(note, d, blackout);
		return false;
	}
	if (t == "osc" || t == "midi") {
		if (d.mode == "toggle") {
			oscToggle[note] = oscToggle[note] ? 0 : 1;
			sendOut(d, oscToggle[note]);
			ctlLed(note, d, oscToggle[note]);
			return false;
		}
		sendOut(d, 1);
		if (d.mode != "hold") sendOut(d, 0);
		ctlLed(note, d, 1);
		return true;
	}

	// momentáneos
	if (t == "tap") pulse("/composition/tempocontroller/tempotap");
	else if (t == "resync") pulse("/composition/tempocontroller/resync");
	else if (t == "clearAll") pulse("/composition/disconnectall");
	else if (t == "clear") { for (i = 0; i < d.layers.length; i++) clearLayer(d.layers[i]); }
	else if (t == "prev" || t == "next") api().sendGET("composition/layers/" + d.layer + "?step=" + t, "json");
	else if (t == "refresh") refresh();
	else return false;

	// tap y resync en un pad: el LED no cambia al pulsar (el de tap parpadea a tempo)
	if (note <= 63 && (t == "tap" || t == "resync")) return false;
	ctlLed(note, d, 1);
	return true;
}

function release(note, d) {
	var t = d.type;
	if ((t == "osc" || t == "midi") && d.mode == "hold") sendOut(d, 0);
	if (isMomentary(note, d)) ctlLed(note, d, 0);
	runExtras(note, d, false);
}

function isMomentary(note, d) {
	var t = d.type;
	if (t == "osc" || t == "midi") return d.mode != "toggle";
	if (t == "tap" || t == "resync") return note > 63;
	return t == "clearAll" || t == "clear" || t == "prev" || t == "next" || t == "refresh";
}

// ---------- callbacks de Chataigne ----------

function init() {
	loadConfig();
	script.setUpdateRate(20);
	refresh();
}

function update(deltaTime) {
	// velocidad de clip: como mucho 20 envíos por segundo aunque el fader mande más
	for (var i = 0; i < 9; i++) {
		if (pendingSpeed[i] < 0) continue;
		sendSpeed(cfg.faders[i], pendingSpeed[i]);
		pendingSpeed[i] = -1;
	}
	if (!opt("autoReload", true)) return;
	reloadTime += deltaTime;
	if (reloadTime < 2) return;
	reloadTime = 0;
	if (loadConfig()) refresh();
}

function scriptParameterChanged(param) {
	if (param.is(testLeds)) {
		for (var p = 0; p < 64; p++) local.sendNoteOn(7, p, COLORS8[Math.floor(p / 8)]);
		for (var b = 0; b < 8; b++) {
			local.sendNoteOn(1, TRACK_FIRST + b, 1);
			local.sendNoteOn(1, SCENE_FIRST + b, 1);
		}
		script.log("Test LEDs enviado");
	}
	else if (param.is(clearLeds)) refresh();
	else if (param.is(reloadMap)) {
		cfgText = "";
		loadConfig();
		refresh();
	}
}

function noteOnEvent(channel, pitch, velocity) {
	if (velocity == 0) { noteOffEvent(channel, pitch, velocity); return; }
	var d = defFor(pitch);
	if (d) press(pitch, d);
}

function noteOffEvent(channel, pitch, velocity) {
	var d = defFor(pitch);
	if (d) release(pitch, d);
}

function ccEvent(channel, number, value) {
	if (!cfg) return;
	var i = number - FADER_FIRST;
	if (i < 0 || i > 8) return;
	var f = cfg.faders[i];
	var x = value / 127.0;
	var t = f.type;
	if (t == "layerOpacity") resolume().send("/composition/layers/" + f.layer + "/video/opacity", x);
	else if (t == "layerMaster") resolume().send("/composition/layers/" + f.layer + "/master", x);
	else if (t == "compMaster") resolume().send("/composition/master", x);
	else if (t == "compOpacity") resolume().send("/composition/video/opacity", x);
	else if (t == "osc") {
		var mn = f.min == undefined ? 0 : f.min;
		var mx = f.max == undefined ? 1 : f.max;
		var m = target(f.target);
		if (m) m.send(f.address, mn + (mx - mn) * x);
	}
	else if (t == "midiCC") {
		var mc = target(f.target);
		if (mc) mc.sendCC(f.channel, f.number, Math.round(f.min + (f.max - f.min) * x));
	}
	else if (t == "clipSpeed") {
		// curva exponencial: con 0,25 y 4 queda 0,25x abajo, 1x en el centro y 4x arriba
		var speed = f.min * Math.pow(f.max / f.min, x);
		if (Math.abs(speed - lastSpeed[i]) < 0.0001) return;
		lastSpeed[i] = speed;
		pendingSpeed[i] = speed;
	}
}

// Velocidad de un clip. Por OSC Resolume la ignora, así que va por la API web:
//  "put"       = PUT del clip por su número de capa y clip (no necesita ids)
//  "websocket" = como antes: resolume_api.js lee el id y lo manda por el módulo "resolumews"
function sendSpeed(f, speed) {
	var path = "composition/layers/" + f.layer + "/clips/" + f.clip;
	if (opt("debug", false)) script.log("velocidad " + path + " -> " + speed + " (" + opt("speedMethod", "put") + ")");
	if (opt("speedMethod", "put") == "websocket") {
		api().sendGET(path + "?speed=" + speed, "json");
		return;
	}
	api().sendPUT(path, {
		payload: { transport: { controls: { speed: { value: speed } } } },
		extraHeaders: "Content-Type: application/json",
		dataType: "raw"
	});
}

// Pinta los controles que no dependen de Resolume y pide a Resolume el estado de lo demás.
// Los pads de clips los pinta resolume_to_apc.js y los R/G/B resolume_api.js: aquí no se
// tocan para no pisarse.
function refresh() {
	if (!cfg) return;
	var p, d, t, k, n;
	var askBlackout = false;

	for (p = 0; p < 64; p++) {
		d = cfg.pads[p];
		t = d.type;
		if (t == "clip" || t == "dual" || t == "rgb") continue;
		if (t == "bypass" || t == "blackout") ctlLed(p, d, 0);
		else if ((t == "osc" || t == "midi") && d.mode == "toggle") ctlLed(p, d, oscToggle[p]);
		else if (!t || t == "none") local.sendNoteOn(1, p, 0);
		else ctlLed(p, d, 0);
	}
	for (k = 0; k < 16; k++) {
		n = k < 8 ? TRACK_FIRST + k : SCENE_FIRST + k - 8;
		d = defFor(n);
		if ((d.type == "osc" || d.type == "midi") && d.mode == "toggle") ctlLed(n, d, oscToggle[n]);
		else if (!d.type || d.type == "none") local.sendNoteOn(1, n, 0);
		else ctlLed(n, d, 0);
	}

	// estado de blackout y bypass: lo devuelve Resolume y lo pinta resolume_to_apc.js
	for (k = 0; k < 81; k++) {
		n = k < 64 ? k : (k < 72 ? TRACK_FIRST + k - 64 : (k < 80 ? SCENE_FIRST + k - 72 : SHIFT));
		d = defFor(n);
		if (d.type == "blackout") askBlackout = true;
		if (d.type == "bypass")
			for (var b = 0; b < d.layers.length; b++) resolume().send("/composition/layers/" + d.layers[b] + "/bypassed", "?");
	}
	if (askBlackout) resolume().send("/composition/bypassed", "?");

	for (p = 0; p < 64; p++) {
		d = cfg.pads[p];
		if (d.type == "clip" || d.type == "dual")
			resolume().send("/composition/layers/" + d.layer + "/clips/" + d.clip + "/connected", "?");
	}
}
