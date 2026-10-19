// Resolume (OSC) -> LEDs de los APC mini mk2, y enlaces automáticos
// Script del módulo OSC "resolume". Escucha el estado de los clips y pinta los pads de todos los APC
// del mapa (el principal "apc" y los adicionales "apc2"...).
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
// ENLACES (cfg.links): mientras suene algún clip de una capa (clips from..to) se mandan sus acciones
// a otros programas (p. ej. blackout de Sunlite mientras suena un cegado) y al dejar de sonar se
// mandan "apagadas" (0, note off).
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

var devices = [];   // [{id, d: mapa del APC, state: [64]}]
var pollList = [];  // "L/C" de los clips que hay que preguntar a Resolume
var linkVals = [];  // por enlace: estado de cada clip de su rango (-1 = aún sin estado)
var linkOn = [];    // por enlace: 1 = sus acciones están mandadas
var warnedTargets = [];
var ticks = 0;
var lastBpm = 0;

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

function opt(name, def) {
	if (cfg && cfg.options && cfg.options[name] != undefined) return cfg.options[name];
	return def;
}

function addPoll(layer, clip) {
	var k = layer + "/" + clip;
	for (var i = 0; i < pollList.length; i++) if (pollList[i] == k) return;
	pollList.push(k);
}

// Lista de APC, clips a sondear y estado de los enlaces a partir del mapa
function prepare() {
	var i, j, p, d, st;
	devices = [];
	var list = [{ id: "apc", d: cfg }];
	if (cfg.devices) for (i = 0; i < cfg.devices.length; i++) list.push({ id: cfg.devices[i].id, d: cfg.devices[i] });
	pollList = [];
	for (i = 0; i < list.length; i++) {
		st = [];
		for (p = 0; p < 64; p++) st.push(-1);
		devices.push({ id: list[i].id, d: list[i].d, state: st });
		for (p = 0; p < 64; p++) {
			d = list[i].d.pads[p];
			if (d.type == "clip" || d.type == "dual") addPoll(d.layer, d.clip);
		}
	}
	linkVals = [];
	linkOn = [];
	var links = cfg.links || [];
	for (i = 0; i < links.length; i++) {
		var vals = [];
		for (j = links[i].from; j <= links[i].to; j++) { vals.push(-1); addPoll(links[i].layer, j); }
		linkVals.push(vals);
		linkOn.push(0);
	}
}

function module(id) { return root.modules[id]; }

function defFor(dv, note) {
	var d = dv.d;
	if (note >= 0 && note <= 63) return d.pads[note];
	if (note >= TRACK_FIRST && note < TRACK_FIRST + 8) return d.bottom[note - TRACK_FIRST];
	if (note >= SCENE_FIRST && note < SCENE_FIRST + 8) return d.side[note - SCENE_FIRST];
	if (note == SHIFT) return d.shift;
	return null;
}

// Recorre todas las notas con control: 0-63, 100-107, 112-119, 122.
function noteAt(k) {
	if (k < 64) return k;
	if (k < 72) return TRACK_FIRST + k - 64;
	if (k < 80) return SCENE_FIRST + k - 72;
	return SHIFT;
}

function ctlLed(dv, note, d, on) {
	var m = module(dv.id);
	if (!m || d.feedback) return;
	if (note <= 63) {
		var ch = on ? d.led.active : d.led.loaded;
		if (!ch) m.sendNoteOn(1, note, 0);
		else m.sendNoteOn(ch, note, d.color);
		return;
	}
	if (note == SHIFT) return;
	m.sendNoteOn(1, note, on ? d.led.active : d.led.idle);
}

// ---------- acciones de los enlaces ----------

function target(id) {
	if (!id || id == "resolume") return local;
	var m = root.modules[id];
	if (!m) {
		for (var i = 0; i < warnedTargets.length; i++) if (warnedTargets[i] == id) return m;
		warnedTargets.push(id);
		script.logError("No existe el módulo \"" + id + "\" en Chataigne (lo usa un enlace del mapa).");
	}
	return m;
}

function sendOut(a, on) {
	var m = target(a.target);
	if (!m) return;
	if (a.type == "osc") { m.send(a.address, on ? a.value : 0); return; }
	if (a.msg == "cc") m.sendCC(a.channel, a.number, on ? a.value : 0);
	else if (a.msg == "pc") { if (on) m.sendProgramChange(a.channel, a.number); }
	else if (on) m.sendNoteOn(a.channel, a.number, a.value);
	else m.sendNoteOff(a.channel, a.number);
}

function updateLinks(layer, clip, v) {
	var links = cfg.links || [];
	for (var i = 0; i < links.length; i++) {
		var l = links[i];
		if (l.layer != layer || clip < l.from || clip > l.to) continue;
		linkVals[i][clip - l.from] = v;
		var active = 0;
		for (var j = 0; j < linkVals[i].length; j++) if (linkVals[i][j] >= 3) active = 1;
		if (active == linkOn[i]) continue;
		linkOn[i] = active;
		if (l.enabled === false) continue;
		if (opt("debug", false)) script.log("enlace " + (i + 1) + (active ? " activado" : " desactivado"));
		for (var k = 0; k < l.actions.length; k++) sendOut(l.actions[k], active);
	}
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
	for (var i = 0; i < devices.length; i++) {
		for (var p = 0; p < 64; p++) {
			devices[i].state[p] = -1;
			var d = devices[i].d.pads[p];
			if ((d.type == "clip" || d.type == "dual") && d.led.empty) drawPad(devices[i], p, 0);
		}
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

	// Tempo: se pregunta a Resolume y se pasa a los módulos MIDI de los APC, que les mandan reloj
	// MIDI; así los parpadeos y pulsos del APC van al BPM.
	if (opt("tempoSync", true)) local.send("/composition/tempocontroller/tempo", "?");

	// cada N sondeos se olvida el estado para repintar todos los pads con la siguiente respuesta
	ticks++;
	if (ticks >= opt("repaintEvery", 5)) {
		ticks = 0;
		for (var i = 0; i < devices.length; i++) for (var s = 0; s < 64; s++) devices[i].state[s] = -1;
	}

	// se vuelve a pedir el estado de todos los clips del mapa por si se pierde algún cambio
	for (var k = 0; k < pollList.length; k++) {
		var lc = pollList[k].split("/");
		local.send("/composition/layers/" + lc[0] + "/clips/" + lc[1] + "/connected", "?");
	}
}

function setTempo(value) {
	var bpm = value <= 1 ? 20 + value * 480 : value; // Resolume lo manda normalizado 20-500
	if (Math.abs(bpm - lastBpm) < 0.05) return;
	lastBpm = bpm;
	for (var i = 0; i < devices.length; i++) {
		var m = module(devices[i].id);
		if (!m) continue;
		var t = m.values.tempo;
		t.bpm.set(bpm);
		if (!t.sendClock.get()) t.sendClock.set(true);
	}
}

function oscEvent(address, args) {
	if (!cfg) return;
	var i, k, n, d;

	if (address == "/composition/tempocontroller/tempo" && args.length > 0) {
		if (opt("tempoSync", true)) setTempo(parseFloat(args[0]));
		return;
	}

	// /composition/bypassed -> LED de los controles de blackout
	if (address == "/composition/bypassed" && args.length > 0) {
		var bo = parseInt(args[0]) ? 1 : 0;
		for (i = 0; i < devices.length; i++) {
			for (k = 0; k < 81; k++) {
				n = noteAt(k);
				d = defFor(devices[i], n);
				if (d.type == "blackout") ctlLed(devices[i], n, d, bo);
			}
		}
		return;
	}

	var parts = address.split("/");

	// /composition/layers/L/bypassed -> LED de los controles de bypass de esa capa
	if (parts.length == 5 && parts[2] == "layers" && parts[4] == "bypassed" && args.length > 0) {
		var bl = parseInt(parts[3]);
		var on = parseInt(args[0]) ? 1 : 0;
		for (i = 0; i < devices.length; i++) {
			for (k = 0; k < 81; k++) {
				n = noteAt(k);
				d = defFor(devices[i], n);
				if (d.type == "bypass" && d.layers[0] == bl) ctlLed(devices[i], n, d, on);
			}
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

	for (i = 0; i < devices.length; i++) {
		var dv = devices[i];
		for (var p = 0; p < 64; p++) {
			d = dv.d.pads[p];
			if (d.type != "clip" && d.type != "dual") continue;
			if (d.layer != layer || d.clip != clip) continue;
			if (dv.state[p] == v) continue; // sin cambios (llega cada segundo por el sondeo)
			dv.state[p] = v;
			drawPad(dv, p, v);
		}
	}
	updateLinks(layer, clip, v);
}

function drawPad(dv, pad, v) {
	var m = module(dv.id);
	if (!m) return;
	var d = dv.d.pads[pad];
	var ch = v <= 0 ? d.led.empty : (v <= 2 ? d.led.loaded : d.led.active);
	if (!ch) m.sendNoteOn(1, pad, 0);
	else m.sendNoteOn(ch, pad, d.color);
}
