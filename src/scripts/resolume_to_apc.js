// Resolume (OSC) -> LEDs del APC mini mk2
// Script del módulo OSC "resolume". Escucha el estado de los clips y pinta los pads.
//
// El mapa se lee de apc_config.json (misma carpeta que el script), igual que apc_to_resolume.js.
//
// Estado "connected" que manda Resolume por clip:
//   0 vacío  1 cargado  2 cargado+preview  3 conectado  4 conectado+preview
// En el mapa: vacío = led.empty, cargado (1-2) = led.loaded, activo (3-4) = led.active.
//
// En el mk2 el canal MIDI es el brillo: 1=10% 2=25% 3=50% 4=65% 5=75% 6=90% 7=100%
// 8-11 = pulso (1/16, 1/8, 1/4, 1/2), 12-16 = parpadeo (1/24, 1/16, 1/8, 1/4, 1/2). 0 = apagado.
//
// Generado por el configurador APC mini mk2 <-> Resolume.

var CONFIG_FILE = "apc_config.json";
var EMBEDDED_CONFIG = null; // @@CONFIG@@

var cfg = null;
var cfgText = "";
var reloadTime = 0;

var TRACK_FIRST = 100;
var SCENE_FIRST = 112;
var SHIFT = 122;

var state = [];
for (var i = 0; i < 64; i++) state.push(-1); // -1 = aún sin estado
var ticks = 0;
var lastBpm = 0;

function apc() { return root.modules.apc; }

// ---------- mapa ----------

function configPath() { return script.getScriptDirectory() + "/" + CONFIG_FILE; }

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

function defFor(note) {
	if (!cfg) return null;
	if (note >= 0 && note <= 63) return cfg.pads[note];
	if (note >= TRACK_FIRST && note < TRACK_FIRST + 8) return cfg.bottom[note - TRACK_FIRST];
	if (note >= SCENE_FIRST && note < SCENE_FIRST + 8) return cfg.side[note - SCENE_FIRST];
	if (note == SHIFT) return cfg.shift;
	return null;
}

// Recorre todas las notas con control: 0-63, 100-107, 112-119, 122.
function noteAt(k) {
	if (k < 64) return k;
	if (k < 72) return TRACK_FIRST + k - 64;
	if (k < 80) return SCENE_FIRST + k - 72;
	return SHIFT;
}

function ctlLed(note, d, on) {
	if (note <= 63) {
		var ch = on ? d.led.active : d.led.loaded;
		if (!ch) apc().sendNoteOn(1, note, 0);
		else apc().sendNoteOn(ch, note, d.color);
		return;
	}
	if (note == SHIFT) return;
	apc().sendNoteOn(1, note, on ? d.led.active : d.led.idle);
}

// ---------- callbacks ----------

function init() {
	loadConfig();
	paintInitial();
	script.setUpdateRate(opt("pollHz", 1));
}

// Al arrancar, los pads de clip que tienen luz aunque estén vacíos (strobos, cegados)
// se encienden ya, sin esperar a Resolume.
function paintInitial() {
	if (!cfg) return;
	for (var p = 0; p < 64; p++) {
		state[p] = -1;
		var d = cfg.pads[p];
		if ((d.type == "clip" || d.type == "dual") && d.led.empty) drawPad(p, 0);
	}
}

function update(deltaTime) {
	if (!cfg) { loadConfig(); return; }

	if (opt("autoReload", true)) {
		reloadTime += deltaTime;
		if (reloadTime >= 2) {
			reloadTime = 0;
			if (loadConfig()) paintInitial();
		}
	}

	// Tempo: se pregunta a Resolume y se pasa al módulo MIDI del APC, que le manda reloj
	// MIDI; así los parpadeos y pulsos del APC van al BPM.
	if (opt("tempoSync", true)) local.send("/composition/tempocontroller/tempo", "?");

	// cada N sondeos se olvida el estado para repintar todos los pads con la siguiente respuesta
	ticks++;
	if (ticks >= opt("repaintEvery", 5)) {
		ticks = 0;
		for (var s = 0; s < 64; s++) state[s] = -1;
	}

	// se vuelve a pedir el estado de todos los clips del APC por si se pierde algún cambio
	for (var p = 0; p < 64; p++) {
		var d = cfg.pads[p];
		if (d.type == "clip" || d.type == "dual")
			local.send("/composition/layers/" + d.layer + "/clips/" + d.clip + "/connected", "?");
	}
}

function setTempo(value) {
	var bpm = value <= 1 ? 20 + value * 480 : value; // Resolume lo manda normalizado 20-500
	if (Math.abs(bpm - lastBpm) < 0.05) return;
	lastBpm = bpm;
	var t = apc().values.tempo;
	t.bpm.set(bpm);
	if (!t.sendClock.get()) t.sendClock.set(true);
}

function oscEvent(address, args) {
	if (!cfg) return;
	var k, n, d, b;

	if (address == "/composition/tempocontroller/tempo" && args.length > 0) {
		if (opt("tempoSync", true)) setTempo(parseFloat(args[0]));
		return;
	}

	// /composition/bypassed -> LED de los controles de blackout
	if (address == "/composition/bypassed" && args.length > 0) {
		var bo = parseInt(args[0]) ? 1 : 0;
		for (k = 0; k < 81; k++) {
			n = noteAt(k);
			d = defFor(n);
			if (d.type == "blackout") ctlLed(n, d, bo);
		}
		return;
	}

	var parts = address.split("/");

	// /composition/layers/L/bypassed -> LED de los controles de bypass de esa capa
	if (parts.length == 5 && parts[2] == "layers" && parts[4] == "bypassed" && args.length > 0) {
		var bl = parseInt(parts[3]);
		var on = parseInt(args[0]) ? 1 : 0;
		for (k = 0; k < 81; k++) {
			n = noteAt(k);
			d = defFor(n);
			if (d.type == "bypass" && d.layers[0] == bl) ctlLed(n, d, on);
		}
		return;
	}

	// /composition/layers/L/clips/C/connected
	// (no /connect: ese es el disparo y vale 1 aunque el clip suene)
	if (parts.length != 7 || parts[2] != "layers" || parts[4] != "clips" || parts[6] != "connected") return;
	if (args.length < 1) return;

	var layer = parseInt(parts[3]);
	var clip = parseInt(parts[5]);
	var v = parseInt(args[0]);

	for (var p = 0; p < 64; p++) {
		d = cfg.pads[p];
		if (d.type != "clip" && d.type != "dual") continue;
		if (d.layer != layer || d.clip != clip) continue;
		if (state[p] == v) continue; // sin cambios (llega cada segundo por el sondeo)
		state[p] = v;
		drawPad(p, v);
	}
}

function drawPad(pad, v) {
	var d = cfg.pads[pad];
	var ch = v <= 0 ? d.led.empty : (v <= 2 ? d.led.loaded : d.led.active);
	if (!ch) apc().sendNoteOn(1, pad, 0);
	else apc().sendNoteOn(ch, pad, d.color);
}
