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
var EMBEDDED_CONFIG = {"format":"apc-resolume","version":1,"name":"Deseo54 - DMST DESEO 54 PLANTILLAS","resolume":{"host":"127.0.0.1","apiPort":8080},"layers":{"1":"Visuales","2":"Strobos","3":"Outline","4":"pxel","5":"madrix"},"targets":[],"pads":[{"type":"rgb","label":"Rojo (R) del clip seleccionado","rgb":"r","color":5,"led":{"empty":1,"loaded":14,"active":7}},{"type":"rgb","label":"Verde (G) del clip seleccionado","rgb":"g","color":21,"led":{"empty":1,"loaded":14,"active":7}},{"type":"rgb","label":"Azul (B) del clip seleccionado","rgb":"b","color":45,"led":{"empty":1,"loaded":14,"active":7}},{"type":"none","label":"","color":0,"led":{"empty":0,"loaded":0,"active":0}},{"type":"clip","label":"Strobe negro","layer":2,"clip":17,"name":"","color":3,"led":{"empty":0,"loaded":3,"active":13}},{"type":"none","label":"","color":0,"led":{"empty":0,"loaded":0,"active":0}},{"type":"resync","label":"Resync","color":5,"led":{"empty":0,"loaded":7,"active":7}},{"type":"tap","label":"Tap tempo","color":9,"led":{"empty":0,"loaded":15,"active":15}},{"type":"clip","label":"Outline 9","layer":3,"clip":9,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 10","layer":3,"clip":10,"name":"","color":3,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 11","layer":3,"clip":11,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 12","layer":3,"clip":12,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 13","layer":3,"clip":13,"name":"","color":3,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 14","layer":3,"clip":14,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 15","layer":3,"clip":15,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 16","layer":3,"clip":16,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 1","layer":3,"clip":1,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 2","layer":3,"clip":2,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 3","layer":3,"clip":3,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 4","layer":3,"clip":4,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 5","layer":3,"clip":5,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 6","layer":3,"clip":6,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 7","layer":3,"clip":7,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 8","layer":3,"clip":8,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"dual","label":"B07 barrido lento","layer":4,"clip":9,"name":"","layer2":5,"clip2":8,"name2":"","color":37,"led":{"empty":0,"loaded":7,"active":15}},{"type":"dual","label":"B11 anillos","layer":4,"clip":13,"name":"","layer2":5,"clip2":12,"name2":"","color":37,"led":{"empty":0,"loaded":7,"active":15}},{"type":"dual","label":"B08 barrido rápido","layer":4,"clip":10,"name":"","layer2":5,"clip2":9,"name2":"","color":37,"led":{"empty":0,"loaded":7,"active":15}},{"type":"dual","label":"B13 destellos","layer":4,"clip":11,"name":"","layer2":5,"clip2":14,"name2":"","color":37,"led":{"empty":0,"loaded":7,"active":15}},{"type":"dual","label":"B01 negras (completo)","layer":4,"clip":3,"name":"","layer2":5,"clip2":2,"name2":"","color":13,"led":{"empty":0,"loaded":7,"active":15}},{"type":"dual","label":"B06 alterno","layer":4,"clip":8,"name":"","layer2":5,"clip2":7,"name2":"","color":5,"led":{"empty":0,"loaded":7,"active":15}},{"type":"dual","label":"B04 random","layer":4,"clip":6,"name":"","layer2":5,"clip2":5,"name2":"","color":13,"led":{"empty":0,"loaded":7,"active":15}},{"type":"dual","label":"B05 random rápido","layer":4,"clip":7,"name":"","layer2":5,"clip2":6,"name2":"","color":13,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 9","layer":1,"clip":9,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 10","layer":1,"clip":10,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 11","layer":1,"clip":11,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 12","layer":1,"clip":12,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 13","layer":1,"clip":13,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 14","layer":1,"clip":14,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 15","layer":1,"clip":15,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 16","layer":1,"clip":16,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 1","layer":1,"clip":1,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 2","layer":1,"clip":2,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 3","layer":1,"clip":3,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 4","layer":1,"clip":4,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 5","layer":1,"clip":5,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 6","layer":1,"clip":6,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 7","layer":1,"clip":7,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 8","layer":1,"clip":8,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Cegado blanco","layer":2,"clip":9,"name":"","color":3,"led":{"empty":3,"loaded":3,"active":7}},{"type":"clip","label":"Cegado rojo","layer":2,"clip":10,"name":"","color":5,"led":{"empty":3,"loaded":3,"active":7}},{"type":"clip","label":"Cegado naranja","layer":2,"clip":11,"name":"","color":9,"led":{"empty":3,"loaded":3,"active":7}},{"type":"clip","label":"Cegado amarillo","layer":2,"clip":12,"name":"","color":13,"led":{"empty":3,"loaded":3,"active":7}},{"type":"clip","label":"Cegado verde","layer":2,"clip":13,"name":"","color":21,"led":{"empty":3,"loaded":3,"active":7}},{"type":"clip","label":"Cegado cian","layer":2,"clip":14,"name":"","color":37,"led":{"empty":3,"loaded":3,"active":7}},{"type":"clip","label":"Cegado azul","layer":2,"clip":15,"name":"","color":45,"led":{"empty":3,"loaded":3,"active":7}},{"type":"clip","label":"Cegado magenta","layer":2,"clip":16,"name":"","color":53,"led":{"empty":3,"loaded":3,"active":7}},{"type":"clip","label":"Strobo blanco","layer":2,"clip":1,"name":"","color":3,"led":{"empty":10,"loaded":10,"active":7}},{"type":"clip","label":"Strobo rojo","layer":2,"clip":2,"name":"","color":5,"led":{"empty":10,"loaded":10,"active":7}},{"type":"clip","label":"Strobo naranja","layer":2,"clip":3,"name":"","color":9,"led":{"empty":10,"loaded":10,"active":7}},{"type":"clip","label":"Strobo amarillo","layer":2,"clip":4,"name":"","color":13,"led":{"empty":10,"loaded":10,"active":7}},{"type":"clip","label":"Strobo verde","layer":2,"clip":5,"name":"","color":21,"led":{"empty":10,"loaded":10,"active":7}},{"type":"clip","label":"Strobo cian","layer":2,"clip":6,"name":"","color":37,"led":{"empty":10,"loaded":10,"active":7}},{"type":"clip","label":"Strobo azul","layer":2,"clip":7,"name":"","color":45,"led":{"empty":10,"loaded":10,"active":7}},{"type":"clip","label":"Strobo magenta","layer":2,"clip":8,"name":"","color":53,"led":{"empty":10,"loaded":10,"active":7}}],"bottom":[{"type":"bypass","label":"Bypass Visuales","layers":[1],"led":{"idle":0,"active":2}},{"type":"bypass","label":"Bypass Outline","layers":[3],"led":{"idle":0,"active":2}},{"type":"bypass","label":"Bypass Strobos","layers":[2],"led":{"idle":0,"active":2}},{"type":"bypass","label":"Bypass Pixel","layers":[4],"led":{"idle":0,"active":2}},{"type":"bypass","label":"Bypass Madrix","layers":[5],"led":{"idle":0,"active":2}},{"type":"none","label":"","led":{"idle":0,"active":0}},{"type":"prev","label":"Clip anterior de Visuales","layer":1,"led":{"idle":0,"active":1}},{"type":"next","label":"Clip siguiente de Visuales","layer":1,"led":{"idle":0,"active":1}}],"side":[{"type":"clearAll","label":"Limpiar todo","led":{"idle":0,"active":1}},{"type":"clear","label":"Limpiar Strobos","layers":[2],"led":{"idle":0,"active":1}},{"type":"blackout","label":"Blackout","led":{"idle":0,"active":2}},{"type":"clear","label":"Limpiar Visuales","layers":[1],"led":{"idle":0,"active":1}},{"type":"clear","label":"Limpiar Outline","layers":[3],"led":{"idle":0,"active":1}},{"type":"clear","label":"Limpiar Pixel + Madrix","layers":[4,5],"led":{"idle":0,"active":1}},{"type":"none","label":"","led":{"idle":0,"active":0}},{"type":"refresh","label":"Refrescar LEDs","led":{"idle":0,"active":1}}],"shift":{"type":"refresh","label":"Refrescar LEDs","led":{"idle":0,"active":0}},"faders":[{"type":"layerOpacity","label":"Visuales","layer":1},{"type":"layerOpacity","label":"Outline","layer":3},{"type":"layerOpacity","label":"Pixel","layer":4},{"type":"layerOpacity","label":"Madrix","layer":5},{"type":"none","label":""},{"type":"none","label":""},{"type":"clipSpeed","label":"Velocidad Outline clip 10","layer":3,"clip":10,"min":0.25,"max":4,"name":""},{"type":"layerMaster","label":"Master Strobos","layer":2},{"type":"compMaster","label":"Master composición"}],"devices":[],"links":[],"options":{"tempoSync":true,"pollHz":1,"repaintEvery":5,"rgbHz":5,"speedMethod":"put","autoReload":true,"debug":false}}; // mapa incluido: "Deseo54 - DMST DESEO 54 PLANTILLAS"

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
