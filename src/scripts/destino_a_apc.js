// Destino (Sunlite, otro programa) -> LEDs de los APC
// Script de un módulo de destino (p. ej. el módulo MIDI "sunlite"). Cuando el programa devuelve
// una nota, un CC o un mensaje OSC, enciende o apaga el LED de los controles del APC que mandan eso
// mismo y tienen marcado «LED según el programa» (feedback).
//
// Así un pad de Sunlite se ve encendido si la escena está activa en Sunlite, aunque se active
// desde el propio Sunlite. Para eso Sunlite tiene que mandar MIDI de vuelta por el mismo puerto.
//
// El mapa se lee de apc_config.json (misma carpeta que el script), igual que los otros scripts.
//
// Generado por el configurador APC mini mk2 <-> Resolume.

var CONFIG_FILE = "apc_config.json";
var EMBEDDED_CONFIG = null; // @@CONFIG@@

var cfg = null;
var cfgText = "";
var reloadTime = 0;

var TRACK_FIRST = 100;
var SCENE_FIRST = 112;

var devices = []; // [{id, d: mapa del APC, fb: [128] estado de cada nota (0/1)}]

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
			prepare();
			return true;
		}
		script.logWarning("No se pudo leer " + p + " (¿JSON roto?). Sigo con el mapa anterior.");
	}
	if (!cfg && EMBEDDED_CONFIG) {
		cfg = EMBEDDED_CONFIG;
		script.log("No hay " + CONFIG_FILE + ": uso el mapa incluido en el script (" + cfg.name + ")");
		prepare();
		return true;
	}
	if (!cfg) script.logError("No hay mapa: falta " + p);
	return false;
}

function prepare() {
	devices = [];
	var list = [{ id: "apc", d: cfg }];
	if (cfg.devices) for (var i = 0; i < cfg.devices.length; i++) list.push({ id: cfg.devices[i].id, d: cfg.devices[i] });
	for (var j = 0; j < list.length; j++) {
		var fb = [];
		for (var n = 0; n < 128; n++) fb.push(0);
		devices.push({ id: list[j].id, d: list[j].d, fb: fb });
	}
}

function defFor(d, note) {
	if (note >= 0 && note <= 63) return d.pads[note];
	if (note >= TRACK_FIRST && note < TRACK_FIRST + 8) return d.bottom[note - TRACK_FIRST];
	if (note >= SCENE_FIRST && note < SCENE_FIRST + 8) return d.side[note - SCENE_FIRST];
	return null;
}

// Notas con LED: 0-63, 100-107, 112-119
function noteAt(k) {
	if (k < 64) return k;
	if (k < 72) return TRACK_FIRST + k - 64;
	return SCENE_FIRST + k - 72;
}

// ¿Este control sigue lo que devuelve ESTE módulo?
function mine(d) {
	return d && d.feedback && (d.type == "midi" || d.type == "osc") && d.target == local.name;
}

function paint(dv, note, d, on) {
	var m = root.modules[dv.id];
	if (!m) return;
	if (note <= 63) {
		var ch = on ? d.led.active : d.led.loaded;
		if (!ch) m.sendNoteOn(1, note, 0);
		else m.sendNoteOn(ch, note, d.color);
	}
	else m.sendNoteOn(1, note, on ? d.led.active : d.led.idle);
}

function paintAll() {
	for (var i = 0; i < devices.length; i++) {
		for (var k = 0; k < 80; k++) {
			var n = noteAt(k), d = defFor(devices[i].d, n);
			if (mine(d)) paint(devices[i], n, d, devices[i].fb[n]);
		}
	}
}

// Llega algo del programa: kind "note" | "cc" | "osc"
function received(kind, channel, number, address, on) {
	if (!cfg) return;
	for (var i = 0; i < devices.length; i++) {
		var dv = devices[i];
		for (var k = 0; k < 80; k++) {
			var n = noteAt(k), d = defFor(dv.d, n);
			if (!mine(d)) continue;
			if (kind == "osc") { if (d.type != "osc" || d.address != address) continue; }
			else if (d.type != "midi" || d.msg != kind || d.channel != channel || d.number != number) continue;
			if (dv.fb[n] == on) continue;
			dv.fb[n] = on;
			paint(dv, n, d, on);
		}
	}
}

// ---------- callbacks de Chataigne ----------

function init() {
	loadConfig();
	paintAll();
	script.setUpdateRate(1);
}

// cada 5 s se repinta por si el APC se ha refrescado; cada 2 s se mira si ha cambiado el mapa
function update(deltaTime) {
	reloadTime += deltaTime;
	if (reloadTime < 5) return;
	reloadTime = 0;
	if (loadConfig()) script.log("Mapa recargado");
	paintAll();
}

function noteOnEvent(channel, pitch, velocity) { received("note", channel, pitch, "", velocity > 0 ? 1 : 0); }
function noteOffEvent(channel, pitch, velocity) { received("note", channel, pitch, "", 0); }
function ccEvent(channel, number, value) { received("cc", channel, number, "", value > 0 ? 1 : 0); }
function oscEvent(address, args) {
	var v = args.length ? args[0] : 1;
	received("osc", 0, 0, address, (v === true || parseFloat(v) > 0) ? 1 : 0);
}
