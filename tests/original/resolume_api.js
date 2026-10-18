// Funciones que necesitan leer el estado de Resolume por su API web
// Script del módulo HTTP "resolumeapi" (Base Address http://127.0.0.1:8080/api/v1/).
//
// - R G B del clip seleccionado en los pads 1-3 de la fila de abajo:
//   se consulta el clip seleccionado varias veces por segundo; fijo a tope =
//   canal normal, parpadeando = canal quitado. Al pulsar, apc_to_resolume.js pide el clip
//   con "?toggle=r" (g, b) y aquí se manda por OSC el valor contrario.
// - Velocidad del clip 10 de Outline (fader 7), ver setSpeed.
// - Clip anterior / siguiente de Visuales (botones de abajo 7 y 8):
//   apc_to_resolume.js pide la capa con "?step=prev" o "?step=next" y aquí se busca
//   el clip activo y se conecta el anterior o siguiente que tenga contenido.

var RGB_PADS = [0, 1, 2];        // fila de abajo, pads 1-3
var RGB_COLORS = [5, 21, 45];    // rojo, verde, azul
var CH = ["r", "g", "b"];
var CH_REMOVED = 14; // canal quitado: parpadeo 1/8

function apc() { return root.modules.apc; }
function osc() { return root.modules.resolume; }

function init() {
	script.setUpdateRate(5);
}

function update(deltaTime) {
	local.sendGET("composition/clips/selected", "json");
}

function dataEvent(data, url) {
	if (url.indexOf("speed=") >= 0) setSpeed(data, url);
	else if (url.indexOf("step=") >= 0) stepClip(data, url);
	else if (url.indexOf("clips/selected") >= 0) rgb(data, url);
}

function rgb(data, url) {
	// sin clip cargado en la selección: los tres a brillo bajo y no se cambia nada
	if (!data.video || (data.connected && data.connected.value == "Empty")) {
		for (var e = 0; e < 3; e++) apc().sendNoteOn(1, RGB_PADS[e], RGB_COLORS[e]);
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

	for (var j = 0; j < 3; j++) apc().sendNoteOn(vals[j] ? 7 : CH_REMOVED, RGB_PADS[j], RGB_COLORS[j]);
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

// Velocidad de un clip (fader 7): por OSC Resolume no deja cambiarla, así que se manda por
// el módulo WebSocket "resolumews" usando el id del parámetro, que se lee del clip pedido.
function setSpeed(data, url) {
	script.log("velocidad: respuesta de " + url);
	if (!data.transport || !data.transport.controls || !data.transport.controls.speed) {
		script.log("velocidad: el clip no tiene transport/speed");
		return;
	}
	var id = data.transport.controls.speed.id;
	var value = parseFloat(url.substring(url.indexOf("speed=") + 6));
	var msg = '{"action":"set","parameter":"/parameter/by-id/' + id + '","value":' + value + '}';
	script.log("velocidad: envío " + msg);
	root.modules.resolumews.send(msg);
}
