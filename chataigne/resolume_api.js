// Funciones que necesitan leer el estado de Resolume por su API web
// Script del módulo HTTP "resolumeapi" (Base Address http://127.0.0.1:8080/api/v1/).
//
// El mapa se lee de apc_config.json (misma carpeta que el script), igual que apc_to_resolume.js.
//
// - Pads R/G/B del clip seleccionado (pads de tipo "rgb"): se consulta el clip seleccionado
//   varias veces por segundo. Activo = led.active, canal quitado = led.loaded,
//   clip vacío = led.empty. Al pulsar, apc_to_resolume.js pide el clip con "?toggle=r"
//   (g, b) y aquí se manda por OSC el valor contrario.
// - Clip anterior / siguiente: apc_to_resolume.js pide la capa con "?step=prev" o
//   "?step=next" y aquí se busca el clip activo y se conecta el anterior o siguiente que
//   tenga contenido.
// - Velocidad de clip con speedMethod = "websocket": apc_to_resolume.js pide el clip con
//   "?speed=X", aquí se lee el id del parámetro y se manda por el módulo "resolumews".
//   Con speedMethod = "put" (por defecto) apc_to_resolume.js lo hace solo y aquí no llega nada.
//
// Generado por el configurador APC mini mk2 <-> Resolume.

var CONFIG_FILE = "apc_config.json";
var EMBEDDED_CONFIG = {"format":"apc-resolume","version":1,"name":"Deseo54 - DMST DESEO 54 PLANTILLAS","resolume":{"host":"127.0.0.1","apiPort":8080},"layers":{"1":"Visuales","2":"Strobos","3":"Outline","4":"pxel","5":"madrix"},"targets":[],"pads":[{"type":"rgb","label":"Rojo (R) del clip seleccionado","rgb":"r","color":5,"led":{"empty":1,"loaded":14,"active":7}},{"type":"rgb","label":"Verde (G) del clip seleccionado","rgb":"g","color":21,"led":{"empty":1,"loaded":14,"active":7}},{"type":"rgb","label":"Azul (B) del clip seleccionado","rgb":"b","color":45,"led":{"empty":1,"loaded":14,"active":7}},{"type":"none","label":"","color":0,"led":{"empty":0,"loaded":0,"active":0}},{"type":"clip","label":"Strobe negro","layer":2,"clip":17,"name":"","color":3,"led":{"empty":0,"loaded":3,"active":13}},{"type":"none","label":"","color":0,"led":{"empty":0,"loaded":0,"active":0}},{"type":"resync","label":"Resync","color":5,"led":{"empty":0,"loaded":7,"active":7}},{"type":"tap","label":"Tap tempo","color":9,"led":{"empty":0,"loaded":15,"active":15}},{"type":"clip","label":"Outline 9","layer":3,"clip":9,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 10","layer":3,"clip":10,"name":"","color":3,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 11","layer":3,"clip":11,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 12","layer":3,"clip":12,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 13","layer":3,"clip":13,"name":"","color":3,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 14","layer":3,"clip":14,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 15","layer":3,"clip":15,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 16","layer":3,"clip":16,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 1","layer":3,"clip":1,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 2","layer":3,"clip":2,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 3","layer":3,"clip":3,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 4","layer":3,"clip":4,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 5","layer":3,"clip":5,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 6","layer":3,"clip":6,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 7","layer":3,"clip":7,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Outline 8","layer":3,"clip":8,"name":"","color":57,"led":{"empty":0,"loaded":7,"active":15}},{"type":"dual","label":"B07 barrido lento","layer":4,"clip":9,"name":"","layer2":5,"clip2":8,"name2":"","color":37,"led":{"empty":0,"loaded":7,"active":15}},{"type":"dual","label":"B11 anillos","layer":4,"clip":13,"name":"","layer2":5,"clip2":12,"name2":"","color":37,"led":{"empty":0,"loaded":7,"active":15}},{"type":"dual","label":"B08 barrido rápido","layer":4,"clip":10,"name":"","layer2":5,"clip2":9,"name2":"","color":37,"led":{"empty":0,"loaded":7,"active":15}},{"type":"dual","label":"B13 destellos","layer":4,"clip":11,"name":"","layer2":5,"clip2":14,"name2":"","color":37,"led":{"empty":0,"loaded":7,"active":15}},{"type":"dual","label":"B01 negras (completo)","layer":4,"clip":3,"name":"","layer2":5,"clip2":2,"name2":"","color":13,"led":{"empty":0,"loaded":7,"active":15}},{"type":"dual","label":"B06 alterno","layer":4,"clip":8,"name":"","layer2":5,"clip2":7,"name2":"","color":5,"led":{"empty":0,"loaded":7,"active":15}},{"type":"dual","label":"B04 random","layer":4,"clip":6,"name":"","layer2":5,"clip2":5,"name2":"","color":13,"led":{"empty":0,"loaded":7,"active":15}},{"type":"dual","label":"B05 random rápido","layer":4,"clip":7,"name":"","layer2":5,"clip2":6,"name2":"","color":13,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 9","layer":1,"clip":9,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 10","layer":1,"clip":10,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 11","layer":1,"clip":11,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 12","layer":1,"clip":12,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 13","layer":1,"clip":13,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 14","layer":1,"clip":14,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 15","layer":1,"clip":15,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 16","layer":1,"clip":16,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 1","layer":1,"clip":1,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 2","layer":1,"clip":2,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 3","layer":1,"clip":3,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 4","layer":1,"clip":4,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 5","layer":1,"clip":5,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 6","layer":1,"clip":6,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 7","layer":1,"clip":7,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Visuales 8","layer":1,"clip":8,"name":"","color":21,"led":{"empty":0,"loaded":7,"active":15}},{"type":"clip","label":"Cegado blanco","layer":2,"clip":9,"name":"","color":3,"led":{"empty":3,"loaded":3,"active":7}},{"type":"clip","label":"Cegado rojo","layer":2,"clip":10,"name":"","color":5,"led":{"empty":3,"loaded":3,"active":7}},{"type":"clip","label":"Cegado naranja","layer":2,"clip":11,"name":"","color":9,"led":{"empty":3,"loaded":3,"active":7}},{"type":"clip","label":"Cegado amarillo","layer":2,"clip":12,"name":"","color":13,"led":{"empty":3,"loaded":3,"active":7}},{"type":"clip","label":"Cegado verde","layer":2,"clip":13,"name":"","color":21,"led":{"empty":3,"loaded":3,"active":7}},{"type":"clip","label":"Cegado cian","layer":2,"clip":14,"name":"","color":37,"led":{"empty":3,"loaded":3,"active":7}},{"type":"clip","label":"Cegado azul","layer":2,"clip":15,"name":"","color":45,"led":{"empty":3,"loaded":3,"active":7}},{"type":"clip","label":"Cegado magenta","layer":2,"clip":16,"name":"","color":53,"led":{"empty":3,"loaded":3,"active":7}},{"type":"clip","label":"Strobo blanco","layer":2,"clip":1,"name":"","color":3,"led":{"empty":10,"loaded":10,"active":7}},{"type":"clip","label":"Strobo rojo","layer":2,"clip":2,"name":"","color":5,"led":{"empty":10,"loaded":10,"active":7}},{"type":"clip","label":"Strobo naranja","layer":2,"clip":3,"name":"","color":9,"led":{"empty":10,"loaded":10,"active":7}},{"type":"clip","label":"Strobo amarillo","layer":2,"clip":4,"name":"","color":13,"led":{"empty":10,"loaded":10,"active":7}},{"type":"clip","label":"Strobo verde","layer":2,"clip":5,"name":"","color":21,"led":{"empty":10,"loaded":10,"active":7}},{"type":"clip","label":"Strobo cian","layer":2,"clip":6,"name":"","color":37,"led":{"empty":10,"loaded":10,"active":7}},{"type":"clip","label":"Strobo azul","layer":2,"clip":7,"name":"","color":45,"led":{"empty":10,"loaded":10,"active":7}},{"type":"clip","label":"Strobo magenta","layer":2,"clip":8,"name":"","color":53,"led":{"empty":10,"loaded":10,"active":7}}],"bottom":[{"type":"bypass","label":"Bypass Visuales","layers":[1],"led":{"idle":0,"active":2}},{"type":"bypass","label":"Bypass Outline","layers":[3],"led":{"idle":0,"active":2}},{"type":"bypass","label":"Bypass Strobos","layers":[2],"led":{"idle":0,"active":2}},{"type":"bypass","label":"Bypass Pixel","layers":[4],"led":{"idle":0,"active":2}},{"type":"bypass","label":"Bypass Madrix","layers":[5],"led":{"idle":0,"active":2}},{"type":"none","label":"","led":{"idle":0,"active":0}},{"type":"prev","label":"Clip anterior de Visuales","layer":1,"led":{"idle":0,"active":1}},{"type":"next","label":"Clip siguiente de Visuales","layer":1,"led":{"idle":0,"active":1}}],"side":[{"type":"clearAll","label":"Limpiar todo","led":{"idle":0,"active":1}},{"type":"clear","label":"Limpiar Strobos","layers":[2],"led":{"idle":0,"active":1}},{"type":"blackout","label":"Blackout","led":{"idle":0,"active":2}},{"type":"clear","label":"Limpiar Visuales","layers":[1],"led":{"idle":0,"active":1}},{"type":"clear","label":"Limpiar Outline","layers":[3],"led":{"idle":0,"active":1}},{"type":"clear","label":"Limpiar Pixel + Madrix","layers":[4,5],"led":{"idle":0,"active":1}},{"type":"none","label":"","led":{"idle":0,"active":0}},{"type":"refresh","label":"Refrescar LEDs","led":{"idle":0,"active":1}}],"shift":{"type":"refresh","label":"Refrescar LEDs","led":{"idle":0,"active":0}},"faders":[{"type":"layerOpacity","label":"Visuales","layer":1},{"type":"layerOpacity","label":"Outline","layer":3},{"type":"layerOpacity","label":"Pixel","layer":4},{"type":"layerOpacity","label":"Madrix","layer":5},{"type":"none","label":""},{"type":"none","label":""},{"type":"clipSpeed","label":"Velocidad Outline clip 10","layer":3,"clip":10,"min":0.25,"max":4,"name":""},{"type":"layerMaster","label":"Master Strobos","layer":2},{"type":"compMaster","label":"Master composición"}],"options":{"tempoSync":true,"pollHz":1,"repaintEvery":5,"rgbHz":5,"speedMethod":"put","autoReload":true,"debug":false}}; // mapa incluido: "Deseo54 - DMST DESEO 54 PLANTILLAS"

var cfg = null;
var cfgText = "";
var reloadTime = 0;

var CH = ["r", "g", "b"];

function apc() { return root.modules.apc; }
function osc() { return root.modules.resolume; }

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

function hasRgbPads() {
	if (!cfg) return false;
	for (var p = 0; p < 64; p++) if (cfg.pads[p].type == "rgb") return true;
	return false;
}

// ---------- callbacks ----------

function init() {
	loadConfig();
	script.setUpdateRate(opt("rgbHz", 5));
}

function update(deltaTime) {
	if (opt("autoReload", true)) {
		reloadTime += deltaTime;
		if (reloadTime >= 2) {
			reloadTime = 0;
			loadConfig();
		}
	}
	if (hasRgbPads()) local.sendGET("composition/clips/selected", "json");
}

function dataEvent(data, url) {
	if (!cfg) return;
	if (url.indexOf("speed=") >= 0) setSpeed(data, url);
	else if (url.indexOf("step=") >= 0) stepClip(data, url);
	else if (url.indexOf("clips/selected") >= 0) rgb(data, url);
	// las respuestas a los PUT de velocidad llegan vacías: no hay nada que hacer
}

function rgb(data, url) {
	var p, d;
	// sin clip cargado en la selección: brillo de "vacío" y no se cambia nada
	if (!data.video || (data.connected && data.connected.value == "Empty")) {
		for (p = 0; p < 64; p++) {
			d = cfg.pads[p];
			if (d.type != "rgb") continue;
			if (!d.led.empty) apc().sendNoteOn(1, p, 0);
			else apc().sendNoteOn(d.led.empty, p, d.color);
		}
		return;
	}
	var v = data.video;
	var vals = [v.r.value, v.g.value, v.b.value];

	var t = url.indexOf("toggle=");
	if (t >= 0) {
		var ch = url.substring(t + 7, t + 8);
		for (var i = 0; i < 3; i++) {
			if (CH[i] != ch) continue;
			vals[i] = vals[i] ? false : true;
			osc().send("/composition/selectedclip/video/" + ch + "scale", vals[i] ? 1 : 0);
		}
	}

	for (p = 0; p < 64; p++) {
		d = cfg.pads[p];
		if (d.type != "rgb") continue;
		for (var j = 0; j < 3; j++) {
			if (CH[j] != d.rgb) continue;
			var c = vals[j] ? d.led.active : d.led.loaded;
			if (!c) apc().sendNoteOn(1, p, 0);
			else apc().sendNoteOn(c, p, d.color);
		}
	}
}

function stepClip(data, url) {
	if (!data.clips) return;
	var clips = data.clips;
	var n = clips.length;
	var dir = url.indexOf("step=prev") >= 0 ? -1 : 1;

	var current = -1;
	for (var i = 0; i < n; i++)
		if (clips[i].connected.value.indexOf("Connected") == 0) current = i;

	var start = current < 0 ? (dir > 0 ? -1 : n) : current;
	for (var k = 1; k <= n; k++) {
		var idx = start + dir * k;
		if (idx < 0 || idx >= n) return; // no da la vuelta
		if (clips[idx].connected.value != "Empty") {
			var layer = url.substring(url.indexOf("layers/") + 7, url.indexOf("?"));
			osc().send("/composition/layers/" + layer + "/clips/" + (idx + 1) + "/connect", 1);
			return;
		}
	}
}

// Velocidad de un clip por WebSocket (speedMethod = "websocket"): por OSC Resolume no deja
// cambiarla, así que se manda por el módulo "resolumews" usando el id del parámetro, que se
// lee del clip pedido. Los ids cambian cada vez que se abre Resolume: por eso se leen siempre.
function setSpeed(data, url) {
	var ws = root.modules.resolumews;
	if (!ws) {
		script.logError("velocidad: no existe el módulo WebSocket \"resolumews\". Créalo en Chataigne (WebSocket Client, Server Path 127.0.0.1:8080/api/v1) o usa speedMethod = put");
		return;
	}
	if (!data.transport || !data.transport.controls || !data.transport.controls.speed) {
		script.logWarning("velocidad: el clip no tiene transport/speed (" + url + ")");
		return;
	}
	var id = data.transport.controls.speed.id;
	var value = parseFloat(url.substring(url.indexOf("speed=") + 6));
	var msg = '{"action":"set","parameter":"/parameter/by-id/' + id + '","value":' + value + '}';
	if (opt("debug", false)) script.log("velocidad: envío " + msg);
	ws.send(msg);
}
