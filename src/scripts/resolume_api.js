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
var EMBEDDED_CONFIG = null; // @@CONFIG@@

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
