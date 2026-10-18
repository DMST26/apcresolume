// Genera src/default_config.json: el mapa actual de Deseo54 (punto 4 del brief).
// Solo hace falta volver a ejecutarlo si se quiere rehacer el mapa por defecto desde cero.
var fs = require("fs");
var path = require("path");

var COLORS8 = [3, 5, 9, 13, 21, 37, 45, 53];
var NAMES8 = ["blanco", "rojo", "naranja", "amarillo", "verde", "cian", "azul", "magenta"];
var pads = [];
for (var i = 0; i < 64; i++) pads.push({ type: "none", color: 0, led: { empty: 0, loaded: 0, active: 0 }, label: "" });

function set(row, col, p) { pads[row * 8 + col] = p; }
function clip(layer, c, color, led, label) {
	return { type: "clip", layer: layer, clip: c, name: "", color: color, led: led, label: label || "" };
}

for (var c = 0; c < 8; c++) {
	set(7, c, clip(2, c + 1, COLORS8[c], { empty: 10, loaded: 10, active: 7 }, "Strobo " + NAMES8[c]));
	set(6, c, clip(2, c + 9, COLORS8[c], { empty: 3, loaded: 3, active: 7 }, "Cegado " + NAMES8[c]));
	set(5, c, clip(1, c + 1, 21, { empty: 0, loaded: 7, active: 15 }, "Visuales " + (c + 1)));
	set(4, c, clip(1, c + 9, 21, { empty: 0, loaded: 7, active: 15 }, "Visuales " + (c + 9)));
	set(2, c, clip(3, c + 1, 57, { empty: 0, loaded: 7, active: 15 }, "Outline " + (c + 1)));
	set(1, c, clip(3, c + 9, (c == 1 || c == 4) ? 3 : 57, { empty: 0, loaded: 7, active: 15 }, "Outline " + (c + 9)));
}

var PIX = [9, 13, 10, 11, 3, 8, 6, 7];
var TUB = [8, 12, 9, 14, 2, 7, 5, 6];
var PIX_LABELS = ["B07 barrido lento", "B11 anillos", "B08 barrido rápido", "B13 destellos",
	"B01 negras (completo)", "B06 alterno", "B04 random", "B05 random rápido"];
for (var c = 0; c < 8; c++) {
	set(3, c, {
		type: "dual", layer: 4, clip: PIX[c], name: "", layer2: 5, clip2: TUB[c], name2: "",
		color: c < 4 ? 37 : (c == 5 ? 5 : 13), led: { empty: 0, loaded: 7, active: 15 }, label: PIX_LABELS[c]
	});
}

var RGB = ["r", "g", "b"], RGB_COLORS = [5, 21, 45], RGB_NAMES = ["Rojo (R)", "Verde (G)", "Azul (B)"];
for (var c = 0; c < 3; c++)
	set(0, c, { type: "rgb", rgb: RGB[c], color: RGB_COLORS[c], led: { empty: 1, loaded: 14, active: 7 }, label: RGB_NAMES[c] + " del clip seleccionado" });
set(0, 4, clip(2, 17, 3, { empty: 0, loaded: 3, active: 13 }, "Strobe negro"));
set(0, 6, { type: "resync", color: 5, led: { empty: 0, loaded: 7, active: 7 }, label: "Resync" });
set(0, 7, { type: "tap", color: 9, led: { empty: 0, loaded: 15, active: 15 }, label: "Tap tempo" });

function btn(type, extra, label, active) {
	var b = { type: type, led: { idle: 0, active: active === undefined ? 1 : active }, label: label };
	for (var k in extra) b[k] = extra[k];
	return b;
}
var NONE = function () { return btn("none", {}, "", 0); };

var config = {
	format: "apc-resolume",
	version: 1,
	name: "Deseo54 - DMST DESEO 54 PLANTILLAS",
	resolume: { host: "127.0.0.1", apiPort: 8080 },
	layers: { "1": "Visuales", "2": "Strobos", "3": "Outline", "4": "pxel", "5": "madrix" },
	pads: pads,
	bottom: [
		btn("bypass", { layers: [1] }, "Bypass Visuales", 2),
		btn("bypass", { layers: [3] }, "Bypass Outline", 2),
		btn("bypass", { layers: [2] }, "Bypass Strobos", 2),
		btn("bypass", { layers: [4] }, "Bypass Pixel", 2),
		btn("bypass", { layers: [5] }, "Bypass Madrix", 2),
		NONE(),
		btn("prev", { layer: 1 }, "Clip anterior de Visuales"),
		btn("next", { layer: 1 }, "Clip siguiente de Visuales")
	],
	side: [
		btn("clearAll", {}, "Limpiar todo"),
		btn("clear", { layers: [2] }, "Limpiar Strobos"),
		btn("blackout", {}, "Blackout", 2),
		btn("clear", { layers: [1] }, "Limpiar Visuales"),
		btn("clear", { layers: [3] }, "Limpiar Outline"),
		btn("clear", { layers: [4, 5] }, "Limpiar Pixel + Madrix"),
		NONE(),
		btn("refresh", {}, "Refrescar LEDs")
	],
	shift: btn("refresh", {}, "Refrescar LEDs", 0),
	faders: [
		{ type: "layerOpacity", layer: 1, label: "Visuales" },
		{ type: "layerOpacity", layer: 3, label: "Outline" },
		{ type: "layerOpacity", layer: 4, label: "Pixel" },
		{ type: "layerOpacity", layer: 5, label: "Madrix" },
		{ type: "none", label: "" },
		{ type: "none", label: "" },
		{ type: "clipSpeed", layer: 3, clip: 10, min: 0.25, max: 4, label: "Velocidad Outline clip 10" },
		{ type: "layerMaster", layer: 2, label: "Master Strobos" },
		{ type: "compMaster", label: "Master composición" }
	],
	options: {
		tempoSync: true,
		pollHz: 1,
		repaintEvery: 5,
		rgbHz: 5,
		speedMethod: "put",
		autoReload: true
	}
};

fs.writeFileSync(path.join(__dirname, "default_config.json"), JSON.stringify(config, null, 1) + "\n");
console.log("default_config.json escrito");
