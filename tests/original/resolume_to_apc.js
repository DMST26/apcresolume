// Resolume (OSC) -> LEDs del APC mini mk2
// Script del módulo OSC "resolume". Escucha el estado de los clips y pinta los pads.
//
// Estado "connected" que manda Resolume por clip:
//   0 vacío  1 cargado  2 cargado+preview  3 conectado  4 conectado+preview
//
// IMPORTANTE: ROW_LAYER, ROW_OFFSET y los colores tienen que ser iguales en apc_to_resolume.js

// fila 0 = abajo, fila 7 = arriba
var ROW_LAYER  = [0, 3, 3, 4, 1, 1, 2, 2]; // 0 = fila de controles (la pinta resolume_api.js); 4 = pixel
var ROW_OFFSET = [0, 8, 0, 0, 8, 0, 8, 0];
var BYPASS_LAYERS = [1, 3, 2, 4, 5, 0, 0, 0]; // botones de abajo
var TRACK_FIRST = 100;

// En el mk2 el canal MIDI es el brillo: 1=10% 2=25% 3=50% 4=65% 5=75% 6=90% 7=100%
// 8-11 = pulso (1/16, 1/8, 1/4, 1/2), 12-16 = parpadeo (1/24, 1/16, 1/8, 1/4, 1/2)

// Filas de color fijo por pad (strobos y cegados)
var COLORS8 = [3, 5, 9, 13, 21, 37, 45, 53]; // blanco rojo naranja amarillo verde cian azul magenta
//                 fila: 0  1  2  3  4  5  6   7
var COLOR_ROW =        [0, 0, 0, 0, 0, 0, 1,  1];  // 1 = usa COLORS8 por pad y siempre encendido
var CH_COLOR_IDLE =    [0, 0, 0, 0, 0, 0, 3,  10]; // cegados: media luz fija; strobos: pulso con fade
var CH_COLOR_ACTIVE =  [0, 0, 0, 0, 0, 0, 7,  7];  // activo: brillo máximo fijo

// Resto de filas: un color por fila (Outline rosa, Visuales verde, Pixel/Madrix cian)
var COLORS = [0, 57, 57, 37, 21, 21, 0, 0];
var CH_LOADED = 7;     // cargado: brillo alto fijo
var CH_CONNECTED = 15; // activo: parpadeo a 1/4

// Pads con color propio para marcarlos (fila*8 + columna): fila 1 pads 2 y 5 = strobos de Outline
var PAD_COLOR = [];
for (var q = 0; q < 64; q++) PAD_COLOR.push(-1);
PAD_COLOR[1 * 8 + 1] = 3; // blanco (Outline clip 10)
PAD_COLOR[1 * 8 + 4] = 3; // blanco (Outline clip 13, outline_strobo)
for (var k = 4; k <= 7; k++) PAD_COLOR[3 * 8 + k] = 13; // amarillo: pads 5-8 = strobos de Pixel/Madrix
PAD_COLOR[3 * 8 + 5] = 5; // pad 6 (alterno) en rojo

// Fila de pixel: clip de la capa 4 de cada pad (igual que PIX_CLIPS en apc_to_resolume.js)
var PIX_ROW = 3;
var PIX_CLIPS = [9, 13, 10, 11, 3, 8, 6, 7];

function padCol(r, clip) {
	if (r == PIX_ROW) {
		for (var c = 0; c < 8; c++) if (PIX_CLIPS[c] == clip) return c;
		return -1;
	}
	return clip - 1 - ROW_OFFSET[r];
}

// Strobe negro: capa 2 clip 17 en la fila de abajo, pad 5 (blanco; activo parpadeando rápido)
var BLACK_PAD = 4, BLACK_LAYER = 2, BLACK_CLIP = 17, BLACK_COLOR = 3;
var blackState = -1;

var SCENE_FIRST = 112;

var state = [];
for (var i = 0; i < 64; i++) state.push(-1); // -1 = aún sin estado

function apc() { return root.modules.apc; }

function init() {
	for (var r = 0; r < 8; r++)
		if (COLOR_ROW[r]) for (var c = 0; c < 8; c++) drawPad(r, c, 0);
	script.setUpdateRate(1);
}

// Tempo: se pregunta a Resolume cada segundo y se pasa al módulo MIDI del APC, que
// le manda reloj MIDI; así los parpadeos y pulsos del APC van al BPM.
var lastBpm = 0;

var ticks = 0;

function update(deltaTime) {
	local.send("/composition/tempocontroller/tempo", "?");
	// cada 5 s se olvida el estado para repintar todos los pads con la siguiente respuesta
	ticks++;
	if (ticks >= 5) {
		ticks = 0;
		for (var s = 0; s < 64; s++) state[s] = -1;
		blackState = -1;
	}
	local.send("/composition/layers/" + BLACK_LAYER + "/clips/" + BLACK_CLIP + "/connected", "?");
	// se vuelve a pedir el estado de todos los clips del APC por si se pierde algún cambio
	for (var r = 0; r < 8; r++) {
		if (ROW_LAYER[r] == 0) continue;
		for (var c = 1; c <= 8; c++)
			local.send("/composition/layers/" + ROW_LAYER[r] + "/clips/" + (r == PIX_ROW ? PIX_CLIPS[c - 1] : c + ROW_OFFSET[r]) + "/connected", "?");
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
	if (address == "/composition/tempocontroller/tempo" && args.length > 0) {
		setTempo(parseFloat(args[0]));
		return;
	}

	var parts = address.split("/");

	// /composition/bypassed -> LED del botón lateral 3 (blackout)
	if (address == "/composition/bypassed" && args.length > 0) {
		apc().sendNoteOn(1, SCENE_FIRST + 2, parseInt(args[0]) ? 2 : 0); // 2 = parpadeo
		return;
	}

	// /composition/layers/L/bypassed -> LED del botón de abajo
	if (parts.length == 5 && parts[2] == "layers" && parts[4] == "bypassed" && args.length > 0) {
		for (var b = 0; b < 8; b++)
			if (BYPASS_LAYERS[b] == parseInt(parts[3])) apc().sendNoteOn(1, TRACK_FIRST + b, parseInt(args[0]) ? 2 : 0);
		return;
	}

	// /composition/layers/L/clips/C/connected (no /connect: ese es el disparo y vale 1 aunque el clip suene)
	if (parts.length != 7 || parts[2] != "layers" || parts[4] != "clips" || parts[6] != "connected") return;
	if (args.length < 1) return;

	var layer = parseInt(parts[3]);
	var clip = parseInt(parts[5]);
	var v = parseInt(args[0]);

	if (layer == BLACK_LAYER && clip == BLACK_CLIP) {
		if (v == blackState) return;
		blackState = v;
		if (v <= 0) apc().sendNoteOn(1, BLACK_PAD, 0);
		else apc().sendNoteOn(v >= 3 ? 13 : 3, BLACK_PAD, BLACK_COLOR); // 13 = parpadeo 1/16, 3 = media luz
		return;
	}

	for (var r = 0; r < 8; r++) {
		if (ROW_LAYER[r] != layer) continue;
		var col = padCol(r, clip);
		if (col < 0 || col > 7) continue;
		if (state[r * 8 + col] == v) continue; // sin cambios (llega cada segundo por el sondeo)
		state[r * 8 + col] = v;
		drawPad(r, col, v);
	}
}

function drawPad(row, col, v) {
	var pad = row * 8 + col;
	if (COLOR_ROW[row]) {
		var ch = v >= 3 ? CH_COLOR_ACTIVE[row] : CH_COLOR_IDLE[row];
		apc().sendNoteOn(ch, pad, COLORS8[col]);
		return;
	}
	var color = PAD_COLOR[pad] >= 0 ? PAD_COLOR[pad] : COLORS[row];
	if (v <= 0) apc().sendNoteOn(1, pad, 0);
	else if (v <= 2) apc().sendNoteOn(CH_LOADED, pad, color);
	else apc().sendNoteOn(CH_CONNECTED, pad, color);
}
