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
var EMBEDDED_CONFIG = {"format":"apc-resolume","version":1,"name":"Deseo54 - DMST DESEO 54 PLANTILLAS","resolume":{"host":"127.0.0.1","apiPort":8080},"layers":{"1":"Visuales","2":"Strobos","3":"Outline","4":"pxel","5":"madrix"},"targets":[],"pads":[{"type":"rgb","label":"Rojo (R) del clip seleccionado","rgb":"r","color":5,"led":{"empty":1,"loaded":14,"active":7}},{"type":"rgb","label":"Verde (G) del clip seleccionado","rgb":"g","color":21,"led":{"empty":1,"loaded":14,"active":7}},{"type":"rgb","label":"Azul (B) del clip seleccionado","rgb":"b","color":45,"led":{"empty":1,"loaded":14,"active":7}},{"type":"none","label":"","color":0,"led":{"empty":0,"loaded":0,"active":0}},{"type":"clip","label":"Strobe negro","layer":2,"clip":17,"name":"","color":3,"led":{"empty":0,"loaded":3,"active":13}},{"type":"none","label":"","color":0,"led":{"empty":0,"loaded":0,"active":0}},{"type":"resync","label":"Resync","color":5,"led":{"empty":0,"loaded":7,"active":7}},{"type":"tap","label":"Tap tempo","color":9,"led":{"empty":0,"loaded":15,"active":15}},{"type":"clip","label":"Outline 9","layer":3,"clip":9,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 10","layer":3,"clip":10,"name":"","color":3,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 11","layer":3,"clip":11,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 12","layer":3,"clip":12,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 13","layer":3,"clip":13,"name":"","color":3,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 14","layer":3,"clip":14,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 15","layer":3,"clip":15,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 16","layer":3,"clip":16,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 1","layer":3,"clip":1,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 2","layer":3,"clip":2,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 3","layer":3,"clip":3,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 4","layer":3,"clip":4,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 5","layer":3,"clip":5,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 6","layer":3,"clip":6,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 7","layer":3,"clip":7,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 8","layer":3,"clip":8,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"dual","label":"B07 barrido lento","layer":4,"clip":9,"name":"","layer2":5,"clip2":8,"name2":"","color":37,"led":{"empty":0,"loaded":7,"active":15}},{"type":"dual","label":"B11 anillos","layer":4,"clip":13,"name":"","layer2":5,"clip2":12,"name2":"","color":37,"led":{"empty":0,"loaded":7,"active":15}},{"type":"dual","label":"B08 barrido rápido","layer":4,"clip":10,"name":"","layer2":5,"clip2":9,"name2":"","color":37,"led":{"empty":0,"loaded":7,"active":15}},{"type":"dual","label":"B13 destellos","layer":4,"clip":11,"name":"","layer2":5,"clip2":14,"name2":"","color":37,"led":{"empty":0,"loaded":7,"active":15}},{"type":"dual","label":"B01 negras (completo)","layer":4,"clip":3,"name":"","layer2":5,"clip2":2,"name2":"","color":13,"led":{"empty":0,"loaded":7,"active":15}},{"type":"dual","label":"B06 alterno","layer":4,"clip":8,"name":"","layer2":5,"clip2":7,"name2":"","color":5,"led":{"empty":0,"loaded":7,"active":15}},{"type":"dual","label":"B04 random","layer":4,"clip":6,"name":"","layer2":5,"clip2":5,"name2":"","color":13,"led":{"empty":0,"loaded":7,"active":15}},{"type":"dual","label":"B05 random rápido","layer":4,"clip":7,"name":"","layer2":5,"clip2":6,"name2":"","color":13,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 9","layer":1,"clip":9,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 10","layer":1,"clip":10,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 11","layer":1,"clip":11,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 12","layer":1,"clip":12,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 13","layer":1,"clip":13,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 14","layer":1,"clip":14,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 15","layer":1,"clip":15,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 16","layer":1,"clip":16,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 1","layer":1,"clip":1,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 2","layer":1,"clip":2,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 3","layer":1,"clip":3,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 4","layer":1,"clip":4,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 5","layer":1,"clip":5,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 6","layer":1,"clip":6,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 7","layer":1,"clip":7,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 8","layer":1,"clip":8,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Cegado blanco","layer":2,"clip":9,"name":"","color":3,"led":{"empty":3,"loaded":3,"active":7}},{"type":"clip","label":"Cegado rojo","layer":2,"clip":10,"name":"","color":5,"led":{"empty":3,"loaded":3,"active":7}},{"type":"clip","label":"Cegado naranja","layer":2,"clip":11,"name":"","color":9,"led":{"empty":3,"loaded":3,"active":7}},{"type":"clip","label":"Cegado amarillo","layer":2,"clip":12,"name":"","color":13,"led":{"empty":3,"loaded":3,"active":7}},{"type":"clip","label":"Cegado verde","layer":2,"clip":13,"name":"","color":21,"led":{"empty":3,"loaded":3,"active":7}},{"type":"clip","label":"Cegado cian","layer":2,"clip":14,"name":"","color":37,"led":{"empty":3,"loaded":3,"active":7}},{"type":"clip","label":"Cegado azul","layer":2,"clip":15,"name":"","color":45,"led":{"empty":3,"loaded":3,"active":7}},{"type":"clip","label":"Cegado magenta","layer":2,"clip":16,"name":"","color":53,"led":{"empty":3,"loaded":3,"active":7}},{"type":"clip","label":"Strobo blanco","layer":2,"clip":1,"name":"","color":3,"led":{"empty":10,"loaded":10,"active":7}},{"type":"clip","label":"Strobo rojo","layer":2,"clip":2,"name":"","color":5,"led":{"empty":10,"loaded":10,"active":7}},{"type":"clip","label":"Strobo naranja","layer":2,"clip":3,"name":"","color":9,"led":{"empty":10,"loaded":10,"active":7}},{"type":"clip","label":"Strobo amarillo","layer":2,"clip":4,"name":"","color":13,"led":{"empty":10,"loaded":10,"active":7}},{"type":"clip","label":"Strobo verde","layer":2,"clip":5,"name":"","color":21,"led":{"empty":10,"loaded":10,"active":7}},{"type":"clip","label":"Strobo cian","layer":2,"clip":6,"name":"","color":37,"led":{"empty":10,"loaded":10,"active":7}},{"type":"clip","label":"Strobo azul","layer":2,"clip":7,"name":"","color":45,"led":{"empty":10,"loaded":10,"active":7}},{"type":"clip","label":"Strobo magenta","layer":2,"clip":8,"name":"","color":53,"led":{"empty":10,"loaded":10,"active":7}}],"bottom":[{"type":"bypass","label":"Bypass Visuales","layers":[1],"led":{"idle":0,"active":2}},{"type":"bypass","label":"Bypass Outline","layers":[3],"led":{"idle":0,"active":2}},{"type":"bypass","label":"Bypass Strobos","layers":[2],"led":{"idle":0,"active":2}},{"type":"bypass","label":"Bypass Pixel","layers":[4],"led":{"idle":0,"active":2}},{"type":"bypass","label":"Bypass Madrix","layers":[5],"led":{"idle":0,"active":2}},{"type":"none","label":"","led":{"idle":0,"active":0}},{"type":"prev","label":"Clip anterior de Visuales","layer":1,"led":{"idle":0,"active":1}},{"type":"next","label":"Clip siguiente de Visuales","layer":1,"led":{"idle":0,"active":1}}],"side":[{"type":"clearAll","label":"Limpiar todo","led":{"idle":0,"active":1}},{"type":"clear","label":"Limpiar Strobos","layers":[2],"led":{"idle":0,"active":1}},{"type":"blackout","label":"Blackout","led":{"idle":0,"active":2}},{"type":"clear","label":"Limpiar Visuales","layers":[1],"led":{"idle":0,"active":1}},{"type":"clear","label":"Limpiar Outline","layers":[3],"led":{"idle":0,"active":1}},{"type":"clear","label":"Limpiar Pixel + Madrix","layers":[4,5],"led":{"idle":0,"active":1}},{"type":"none","label":"","led":{"idle":0,"active":0}},{"type":"refresh","label":"Refrescar LEDs","led":{"idle":0,"active":1}}],"shift":{"type":"refresh","label":"Refrescar LEDs","led":{"idle":0,"active":0}},"faders":[{"type":"layerOpacity","label":"Visuales","layer":1},{"type":"layerOpacity","label":"Outline","layer":3},{"type":"layerOpacity","label":"Pixel","layer":4},{"type":"layerOpacity","label":"Madrix","layer":5},{"type":"none","label":""},{"type":"none","label":""},{"type":"clipSpeed","label":"Velocidad Outline clip 10","layer":3,"clip":10,"min":0.25,"max":4,"name":""},{"type":"layerMaster","label":"Master Strobos","layer":2},{"type":"compMaster","label":"Master composición"}],"options":{"tempoSync":true,"pollHz":1,"repaintEvery":5,"rgbHz":5,"speedMethod":"put","autoReload":true,"debug":false}}; // mapa incluido: "Deseo54 - DMST DESEO 54 PLANTILLAS"

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
