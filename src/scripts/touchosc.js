// TouchOSC (tablet) <-> Chataigne
// Script de un módulo OSC "touchosc" (escucha en el puerto al que manda TouchOSC y envía a la IP y
// puerto de la tablet). El diseño de la tablet se exporta desde el configurador (Resolume Remote ->
// Exportar -> TouchOSC), junto con touchosc.json, que va en esta misma carpeta.
//
//   /composition/...      lo reenvía a Resolume (módulo "resolume"). Lanzar clip, columna, vaciar
//                         y seleccionar solo cuentan al pulsar.
//   /chataigne/<ruta>     cambia ese parámetro de Chataigne (variables, módulos, secuencias...).
//
// Hacia la tablet: los parámetros de Chataigne de touchosc.json que cambian, y el estado de los
// clips (lo pregunta aquí cada segundo y lo devuelve resolume_to_apc.js como 1 = sonando, 0 = no).
//
// Generado por el configurador APC mini mk2 <-> Resolume.

var MAP_FILE = "touchosc.json";
var map = null;
var mapText = "";
var last = [];      // último valor mandado a la tablet de cada parámetro de Chataigne
var pollTime = 0;
var reloadTime = 0;
var PREFIX = "/chataigne";

function mapPath() { return script.getScriptDirectory() + "/" + MAP_FILE; }

function loadMap() {
	var p = mapPath();
	if (!util.fileExists(p)) {
		if (!map) script.logWarning("Falta " + MAP_FILE + " junto al script: sin él solo se reenvía a Resolume.");
		return;
	}
	var text = util.readFile(p);
	if (map && text == mapText) return;
	mapText = text;
	var m = util.readFile(p, true);
	if (!m || !m.chataigne) { script.logWarning("No se pudo leer " + MAP_FILE); return; }
	map = m;
	last = [];
	for (var i = 0; i < map.chataigne.length; i++) last.push(null);
	script.log("Mapa de TouchOSC cargado: " + map.name + " (" + map.chataigne.length + " parámetros de Chataigne)");
}

function resolume() { return root.modules.resolume; }

// Objeto de Chataigne para una dirección ("/customVariables/show/variables/intensidad")
function find(address) {
	var parts = address.split("/");
	var o = root;
	for (var i = 0; i < parts.length; i++) {
		if (parts[i] == "") continue;
		o = o[parts[i]];
		if (!o) return null;
	}
	return o;
}

function entryFor(address) {
	if (!map) return null;
	for (var i = 0; i < map.chataigne.length; i++) if (map.chataigne[i].address == address) return map.chataigne[i];
	return null;
}

function isTrigger(address) {
	if (address == "/composition/disconnectall") return true;
	var parts = address.split("/");
	var tail = parts[parts.length - 1];
	return tail == "connect" || tail == "select" || tail == "clear";
}

// ---------- callbacks ----------

function init() {
	loadMap();
	script.setUpdateRate(5);
}

function oscEvent(address, args) {
	var v = args.length ? args[0] : 1;
	if (address.indexOf(PREFIX + "/") == 0) { toChataigne(address.substring(PREFIX.length), v); return; }
	if (address.indexOf("/composition") != 0) return;
	if (isTrigger(address)) {
		if (v > 0) resolume().send(address, 1);
		return;
	}
	resolume().send(address, v);
}

function toChataigne(address, v) {
	var o = find(address);
	if (!o) { script.logWarning("TouchOSC: no existe " + address + " en Chataigne"); return; }
	var e = entryFor(address);
	if (e && e.type == "ParamEvent") { if (v > 0) o.trigger(); return; }
	if (e && e.type == "ParamChoice" && e.options) {
		var k = Math.round(v);
		if (k >= 0 && k < e.options.length) o.set(e.options[k]);
		return;
	}
	if (e && e.type == "ParamBoolean") { o.set(v > 0.5); return; }
	o.set(v);
}

// Valor que se manda a la tablet
function outValue(e, v) {
	if (e.type == "ParamChoice" && e.options) {
		for (var i = 0; i < e.options.length; i++) if (e.options[i] == v) return i;
		return 0;
	}
	if (e.type == "ParamBoolean") return v ? 1 : 0;
	return v;
}

function update(deltaTime) {
	reloadTime += deltaTime;
	if (reloadTime >= 2) { reloadTime = 0; loadMap(); }
	if (!map) return;

	// Chataigne -> tablet: solo lo que cambia
	for (var i = 0; i < map.chataigne.length; i++) {
		var e = map.chataigne[i];
		if (e.type == "ParamEvent") continue;
		var o = find(e.address);
		if (!o || !o.get) continue;
		var v = outValue(e, o.get());
		if (v == last[i]) continue;
		last[i] = v;
		local.send(PREFIX + e.address, v);
	}

	// estado de los clips de la tablet: se pregunta a Resolume cada segundo
	pollTime += deltaTime;
	if (pollTime < 1) return;
	pollTime = 0;
	for (var k = 0; k < map.polls.length; k++) resolume().send(map.polls[k], "?");
}
