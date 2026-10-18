// APC mini mk2 -> Resolume (OSC)
// Script del módulo MIDI "apc". Lo que pulsas en el APC sale por OSC al módulo "resolume".
//
// PADS (fila 0 = abajo, fila 7 = arriba). Cada fila lanza los clips
// ROW_OFFSET+1 .. ROW_OFFSET+8 de la capa ROW_LAYER.
//   fila 7 (arriba)  = capa 2 Strobos, clips 1-8
//   fila 6           = capa 2 Strobos, clips 9-16 (cegados)
//   filas 5, 4       = capa 1 Visuales, clips 1-8, 9-16
//   fila 3           = capa 4 pixel (PIX_CLIPS) y a la vez su pareja en capa 5 madrix (TUB_CLIPS)
//   filas 2, 1       = capa 3 Outline,  clips 1-8, 9-16
//   fila 0 (abajo)   = pads 1-3: R, G, B del clip seleccionado (resolume_api.js);
//                      pad 5: STROBE NEGRO (capa 2 clip 17); pad 7: RESYNC (rojo);
//                      pad 8: TAP TEMPO (naranja parpadeando a tempo); 4 y 6 libres
//
// BOTONES DE ABAJO (rojos)
//   1-5 = bypass on/off: Visuales, Outline, Strobos, Pixel, Madrix (parpadea = capa apagada)
//   6   = libre
//   7-8 = clip anterior / siguiente de Visuales (resolume_api.js)
//
// BOTONES LATERALES (verdes, de arriba a abajo)
//   1 = limpiar todo (disconnectall)   5 = limpiar Outline
//   2 = limpiar Strobos                6 = limpiar Pixel/Madrix
//   3 = BLACKOUT on/off (parpadea)     7 = libre
//   4 = limpiar Visuales               8 = refrescar LEDs
//
// Los parpadeos y pulsos del APC van al BPM de Resolume: resolume_to_apc.js lee el tempo
// y este módulo manda reloj MIDI al APC.
//
// FADERS: 1 Visuales, 2 Outline, 3 Pixel, 4 Madrix, 5-6 libres,
//         7 velocidad del clip 10 de Outline (0,25x abajo, 1x en el centro, 4x arriba;
//           va por resolume_api.js + WebSocket porque por OSC Resolume no la deja tocar),
//         8 master de la capa Strobos, 9 master de la composición
// SHIFT  = refrescar LEDs
//
// IMPORTANTE: ROW_LAYER y ROW_OFFSET tienen que ser iguales en resolume_to_apc.js

var ROW_LAYER  = [0, 3, 3, 4, 1, 1, 2, 2]; // 0 = fila de controles
var ROW_OFFSET = [0, 8, 0, 0, 8, 0, 8, 0];
var FADER_LAYERS = [1, 3, 4, 5, 0, 0, 0, 0];
var STROBE_FADER = 7;                                // fader 8
var SPEED_FADER = 6;                                 // fader 7
var SPEED_LAYER = 3, SPEED_CLIP = 10;                // Outline, clip 10
var BYPASS_LAYERS = [1, 3, 2, 4, 5, 0, 0, 0];

// Fila de pixel (capa 4) y madrix (capa 5) a la vez, emparejados por nombre
// (madrix no tiene el caleido, va un clip por detrás).
// pads 1-4 normales: B07 barrido lento (lento), B11 anillos (medio), B08 barrido rápido, B13 destellos
// pads 5-8 strobos:  B01 negras (completo), B06 alterno, B04 random, B05 random rápido (por partes)
// IMPORTANTE: PIX_CLIPS igual en resolume_to_apc.js
var PIX_ROW = 3;
var PIXEL = 4;
var MADRIX = 5;
var PIX_CLIPS = [9, 13, 10, 11, 3, 8, 6, 7];
var TUB_CLIPS = [8, 12, 9, 14, 2, 7, 5, 6];
var bypassed = [0, 0, 0, 0, 0, 0, 0, 0];

var RGB_PADS = ["r", "g", "b", "", "", "", "", ""]; // fila de abajo
var TAP_PAD = 7;       // fila de abajo, pad 8
var TAP_COLOR = 9;     // naranja
var TAP_CH = 15;       // parpadeo 1/4 (una vez por tiempo)
var RESYNC_PAD = 6;    // fila de abajo, pad 7
var BLACK_PAD = 4;     // fila de abajo, pad 5: strobe negro
var BLACK_LAYER = 2;
var BLACK_CLIP = 17;
var RESYNC_COLOR = 5;  // rojo
var VISUALES = 1;

// LED en reposo de cada fila al refrescar
var COLORS8 = [3, 5, 9, 13, 21, 37, 45, 53]; // blanco rojo naranja amarillo verde cian azul magenta
var IDLE_CH = [0, 0, 0, 0, 0, 0, 3, 10];     // 3 = media luz fija, 10 = pulso; 0 = apagado

var TRACK_FIRST = 100; // botones de abajo 100-107
var SCENE_FIRST = 112; // botones laterales 112-119 (112 = arriba)
var SHIFT = 122;
var FADER_FIRST = 48;  // CC 48-55 faders, 56 master

var blackout = 0;

function resolume() { return root.modules.resolume; }
function api() { return root.modules.resolumeapi; }

var testLeds = script.addTrigger("Test LEDs", "Enciende todos los pads para comprobar que llega el MIDI al APC");
var clearLeds = script.addTrigger("Refresh LEDs", "Apaga y pide el estado a Resolume");

function init() {
	refresh();
}

function scriptParameterChanged(param) {
	if (param.is(testLeds)) {
		for (var p = 0; p < 64; p++) local.sendNoteOn(7, p, COLORS8[Math.floor(p / 8)]);
		for (var b = 0; b < 8; b++) {
			local.sendNoteOn(1, TRACK_FIRST + b, 1);
			local.sendNoteOn(1, SCENE_FIRST + b, 1);
		}
		script.log("Test LEDs enviado");
	}
	else if (param.is(clearLeds)) refresh();
}

function clearLayer(layer) {
	resolume().send("/composition/layers/" + layer + "/clear", 1);
}

function noteOnEvent(channel, pitch, velocity) {
	if (velocity == 0) return;

	if (pitch >= 0 && pitch <= 63) {
		var row = Math.floor(pitch / 8);
		var col = pitch % 8;
		if (ROW_LAYER[row] == 0) {
			if (col == BLACK_PAD) {
				resolume().send("/composition/layers/" + BLACK_LAYER + "/clips/" + BLACK_CLIP + "/connect", 1);
				return;
			}
			if (col == RESYNC_PAD) {
				resolume().send("/composition/tempocontroller/resync", 1);
				resolume().send("/composition/tempocontroller/resync", 0);
				return;
			}
			if (col == TAP_PAD) {
				resolume().send("/composition/tempocontroller/tempotap", 1);
				resolume().send("/composition/tempocontroller/tempotap", 0);
				return;
			}
			if (RGB_PADS[col] != "") api().sendGET("composition/clips/selected?toggle=" + RGB_PADS[col], "json");
			return;
		}
		if (row == PIX_ROW) {
			resolume().send("/composition/layers/" + PIXEL + "/clips/" + PIX_CLIPS[col] + "/connect", 1);
			resolume().send("/composition/layers/" + MADRIX + "/clips/" + TUB_CLIPS[col] + "/connect", 1);
			return;
		}
		resolume().send("/composition/layers/" + ROW_LAYER[row] + "/clips/" + (col + 1 + ROW_OFFSET[row]) + "/connect", 1);
	}
	else if (pitch >= TRACK_FIRST && pitch < TRACK_FIRST + 8) {
		var b = pitch - TRACK_FIRST;
		if (b == 6 || b == 7) {
			api().sendGET("composition/layers/" + VISUALES + "?step=" + (b == 6 ? "prev" : "next"), "json");
			local.sendNoteOn(1, pitch, 1);
			return;
		}
		if (BYPASS_LAYERS[b] == 0) return;
		bypassed[b] = bypassed[b] ? 0 : 1;
		resolume().send("/composition/layers/" + BYPASS_LAYERS[b] + "/bypassed", bypassed[b]);
		local.sendNoteOn(1, pitch, bypassed[b] ? 2 : 0); // 2 = parpadeo
	}
	else if (pitch >= SCENE_FIRST && pitch < SCENE_FIRST + 8) {
		var s = pitch - SCENE_FIRST; // 0 = arriba
		if (s == 0) {
			resolume().send("/composition/disconnectall", 1);
			resolume().send("/composition/disconnectall", 0);
		}
		else if (s == 1) clearLayer(2);
		else if (s == 2) {
			blackout = blackout ? 0 : 1;
			resolume().send("/composition/bypassed", blackout);
			local.sendNoteOn(1, pitch, blackout ? 2 : 0);
			return;
		}
		else if (s == 3) clearLayer(1);
		else if (s == 4) clearLayer(3);
		else if (s == 5) { clearLayer(4); clearLayer(MADRIX); }
		else if (s == 7) refresh();
		local.sendNoteOn(1, pitch, 1);
	}
	else if (pitch == SHIFT) {
		refresh();
	}
}

function noteOffEvent(channel, pitch, velocity) {
	// botones momentáneos: se apagan al soltar (blackout y bypass se quedan)
	if (pitch == TRACK_FIRST + 6 || pitch == TRACK_FIRST + 7) local.sendNoteOn(1, pitch, 0);
	if (pitch >= SCENE_FIRST && pitch < SCENE_FIRST + 8 && pitch != SCENE_FIRST + 2) local.sendNoteOn(1, pitch, 0);
}

function ccEvent(channel, number, value) {
	var i = number - FADER_FIRST;
	if (i == SPEED_FADER) {
		var speed = Math.pow(4, (value / 127.0) * 2 - 1); // 0,25x .. 1x .. 4x
		script.log("fader 7 -> velocidad " + speed);
		api().sendGET("composition/layers/" + SPEED_LAYER + "/clips/" + SPEED_CLIP + "?speed=" + speed, "json");
	}
	else if (i == STROBE_FADER) {
		resolume().send("/composition/layers/2/master", value / 127.0); // master de la capa Strobos
	}
	else if (i >= 0 && i < 8 && FADER_LAYERS[i] > 0) {
		resolume().send("/composition/layers/" + FADER_LAYERS[i] + "/video/opacity", value / 127.0);
	}
	else if (i == 8) {
		resolume().send("/composition/master", value / 127.0); // fader Master de Resolume
	}
}

// Pide a Resolume el estado de cada clip; las respuestas llegan a resolume_to_apc.js,
// que es quien pinta los pads de clips (strobos y cegados incluidos).
function refresh() {
	local.sendNoteOn(1, 3, 0); // pads libres de la fila de abajo apagados
	local.sendNoteOn(1, 5, 0);
	local.sendNoteOn(TAP_CH, TAP_PAD, TAP_COLOR);
	local.sendNoteOn(7, RESYNC_PAD, RESYNC_COLOR);
	for (var b = 0; b < 8; b++) {
		local.sendNoteOn(1, TRACK_FIRST + b, 0);
		local.sendNoteOn(1, SCENE_FIRST + b, 0);
	}
	resolume().send("/composition/bypassed", "?");
	for (var k = 0; k < 8; k++)
		if (BYPASS_LAYERS[k] > 0) resolume().send("/composition/layers/" + BYPASS_LAYERS[k] + "/bypassed", "?");
	for (var r = 0; r < 8; r++) {
		if (ROW_LAYER[r] == 0) continue;
		for (var c = 1; c <= 8; c++) {
			resolume().send("/composition/layers/" + ROW_LAYER[r] + "/clips/" + (r == PIX_ROW ? PIX_CLIPS[c - 1] : c + ROW_OFFSET[r]) + "/connected", "?");
		}
	}
}
