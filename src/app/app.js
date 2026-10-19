// Configurador APC mini mk2 <-> Resolume (vía Chataigne). Interfaz del navegador.
// Todo el estado está en `cfg` (el mapa); cada cambio pasa por commit() para poder deshacer.
(function () {
	"use strict";

	const G = window.APCGen;
	const DATA = window.APP_DATA;

	// ---------- constantes del APC mini mk2 ----------

	// Paleta de 128 colores del APC mini mk2 (velocity -> color). Los LEDs reales se ven algo distintos.
	const PALETTE = [
		"#000000", "#1E1E1E", "#7F7F7F", "#FFFFFF", "#FF4C4C", "#FF0000", "#590000", "#190000",
		"#FFBD6C", "#FF5400", "#591D00", "#271B00", "#FFFF4C", "#FFFF00", "#595900", "#191900",
		"#88FF4C", "#54FF00", "#1D5900", "#142B00", "#4CFF4C", "#00FF00", "#005900", "#001900",
		"#4CFF5E", "#00FF19", "#00590D", "#001902", "#4CFF88", "#00FF55", "#00591D", "#001F12",
		"#4CFFB7", "#00FF99", "#005935", "#001912", "#4CC3FF", "#00A9FF", "#004152", "#001019",
		"#4C88FF", "#0055FF", "#001D59", "#000819", "#4C4CFF", "#0000FF", "#000059", "#000019",
		"#874CFF", "#5400FF", "#190064", "#0F0030", "#FF4CFF", "#FF00FF", "#590059", "#190019",
		"#FF4C87", "#FF0054", "#59001D", "#220013", "#FF1500", "#993500", "#795100", "#436400",
		"#033900", "#005735", "#00547F", "#0000FF", "#00454F", "#2500CC", "#7F7F7F", "#202020",
		"#FF0000", "#BDFF2D", "#AFED06", "#64FF09", "#108B00", "#00FF87", "#00A9FF", "#002AFF",
		"#3F00FF", "#7A00FF", "#B21A7D", "#402100", "#FF4A00", "#88E106", "#72FF15", "#00FF00",
		"#3BFF26", "#59FF71", "#38FFCC", "#5B8AFF", "#3151C6", "#877FE9", "#D31DFF", "#FF005D",
		"#FF7F00", "#B9B000", "#90FF00", "#835D07", "#392B00", "#144C10", "#0D5038", "#15152A",
		"#16205A", "#693C1C", "#A8000A", "#DE513D", "#D86A1C", "#FFE126", "#9EE12F", "#67B50F",
		"#1E1E30", "#DCFF6B", "#80FFBD", "#9A99FF", "#8E66FF", "#404040", "#757575", "#E0FFFF",
		"#A00000", "#350000", "#1AD000", "#074200", "#B9B000", "#3F3100", "#B35F00", "#4B1502"
	];
	const TESTED = [[3, "blanco"], [5, "rojo"], [9, "naranja"], [13, "amarillo"], [21, "verde"], [37, "cian"], [45, "azul"], [53, "magenta"], [57, "rosa"]];
	const RAINBOW = [3, 5, 9, 13, 21, 37, 45, 53];

	// Canal MIDI del LED = brillo o animación
	const LED_OPTIONS = [
		[0, "Apagado"],
		[1, "Fijo 10 %"], [2, "Fijo 25 %"], [3, "Fijo 50 %"], [4, "Fijo 65 %"], [5, "Fijo 75 %"], [6, "Fijo 90 %"], [7, "Fijo 100 %"],
		[8, "Pulso 1/16"], [9, "Pulso 1/8"], [10, "Pulso 1/4"], [11, "Pulso 1/2"],
		[12, "Parpadeo 1/24"], [13, "Parpadeo 1/16"], [14, "Parpadeo 1/8"], [15, "Parpadeo 1/4"], [16, "Parpadeo 1/2"]
	];
	const LEVELS = [0, 0.18, 0.3, 0.5, 0.65, 0.75, 0.9, 1];
	const PULSE_FRAC = { 8: 1 / 16, 9: 1 / 8, 10: 1 / 4, 11: 1 / 2 };
	const BLINK_FRAC = { 12: 1 / 24, 13: 1 / 16, 14: 1 / 8, 15: 1 / 4, 16: 1 / 2 };
	const BTN_LED = [[0, "Apagado"], [1, "Encendido"], [2, "Parpadeo"]];
	const BOTTOM_COLOR = "#ff3b2b", SIDE_COLOR = "#38ff5c";

	const PAD_TYPES = [
		["Resolume · clips", [["clip", "Lanzar un clip"], ["dual", "Lanzar dos clips a la vez"]]],
		["Resolume · funciones", [["rgb", "R/G/B del clip seleccionado"], ["tap", "Tap tempo"], ["resync", "Resync"],
			["bypass", "Bypass de capa"], ["blackout", "Blackout"], ["clear", "Vaciar capa(s)"], ["clearAll", "Limpiar todo"],
			["prev", "Clip anterior"], ["next", "Clip siguiente"], ["refresh", "Refrescar LEDs"]]],
		["Mensajes libres", [["osc", "Mensaje OSC"], ["midi", "Mensaje MIDI (Sunlite, etc.)"]]],
		["", [["none", "Nada"]]]
	];
	const BUTTON_TYPES = [
		["Resolume", [["bypass", "Bypass de capa"], ["clear", "Vaciar capa(s)"], ["blackout", "Blackout"], ["clearAll", "Limpiar todo"],
			["prev", "Clip anterior"], ["next", "Clip siguiente"], ["tap", "Tap tempo"], ["resync", "Resync"], ["refresh", "Refrescar LEDs"]]],
		["Mensajes libres", [["osc", "Mensaje OSC"], ["midi", "Mensaje MIDI (Sunlite, etc.)"]]],
		["", [["none", "Nada"]]]
	];
	const FADER_TYPES = [
		["Resolume", [["layerOpacity", "Opacidad de capa"], ["layerMaster", "Master de capa"], ["compMaster", "Master de la composición"],
			["compOpacity", "Opacidad de la composición (video/opacity)"], ["clipSpeed", "Velocidad de un clip"]]],
		["Mensajes libres", [["osc", "Parámetro OSC"], ["midiCC", "MIDI CC (Sunlite, etc.)"]]],
		["", [["none", "Nada"]]]
	];
	const ICONS = {
		rgb: "", tap: "TAP", resync: "SYNC", bypass: "BYP", blackout: "BLK", clear: "CLR", clearAll: "ALL",
		prev: "◀", next: "▶", refresh: "↻", osc: "OSC", midi: "MIDI"
	};
	const OSC_SUGGESTIONS = [
		"/composition/layers/1/clips/1/connect", "/composition/layers/1/clear", "/composition/layers/1/bypassed",
		"/composition/layers/1/video/opacity", "/composition/layers/1/master", "/composition/master", "/composition/bypassed",
		"/composition/disconnectall", "/composition/tempocontroller/tempotap", "/composition/tempocontroller/resync",
		"/composition/selectedclip/video/rscale", "/composition/layers/1/clips/1/video/effects/strobe/effect/frequency"
	];
	const LED_PRESETS = {
		normal: { name: "Clips normales: vacío apagado, cargado fijo, sonando parpadea", led: { empty: 0, loaded: 7, active: 15 } },
		strobe: { name: "Strobos: siempre con luz, pulso en reposo, fijo al sonar", led: { empty: 10, loaded: 10, active: 7 } },
		blind: { name: "Cegados: media luz, fijo al sonar", led: { empty: 3, loaded: 3, active: 7 } },
		custom: { name: "Personalizado", led: null }
	};

	// ---------- estado ----------

	const store = {
		get(k, def) { try { const v = localStorage.getItem("apcres." + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
		set(k, v) { try { localStorage.setItem("apcres." + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento: no pasa nada */ } }
	};

	let cfg = G.normalizeConfig(store.get("current", null) || DATA.defaultConfig);
	let sel = { kind: "pad", idx: [] };       // kind: pad | bottom | side | shift | fader
	let comp = store.get("composition", null); // composición de Resolume (solo nombres)
	let previewMode = store.get("preview", "mixed");
	let bpm = store.get("bpm", 128);
	let folder = store.get("folder", "D:/VISUALES/Jungle Tribal/chataigne");
	let exportOpts = store.get("exportOpts", { scripts: true, noisette: false });
	let history = [], future = [];
	let clipboard = null;
	let dirHandle = null;
	let showState = {};
	let devIdx = Math.min(store.get("device", 0), (cfg.devices || []).length); // 0 = APC 1, 1 = cfg.devices[0]...

	const $ = (id) => document.getElementById(id);
	// Mapa del APC que se está editando (el principal está en la raíz del mapa)
	function D() { return devIdx > 0 && cfg.devices[devIdx - 1] ? cfg.devices[devIdx - 1] : cfg; }
	const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
	const clone = (o) => JSON.parse(JSON.stringify(o));

	function commit(fn) {
		history.push(JSON.stringify(cfg));
		if (history.length > 200) history.shift();
		future = [];
		fn();
		cfg = G.normalizeConfig(cfg);
		store.set("current", cfg);
		renderAll();
	}
	function undo() {
		if (!history.length) return;
		future.push(JSON.stringify(cfg));
		cfg = JSON.parse(history.pop());
		store.set("current", cfg);
		renderAll();
	}
	function redo() {
		if (!future.length) return;
		history.push(JSON.stringify(cfg));
		cfg = JSON.parse(future.pop());
		store.set("current", cfg);
		renderAll();
	}

	function toast(msg, isErr) {
		const t = document.createElement("div");
		t.className = "toast" + (isErr ? " err" : "");
		t.textContent = msg;
		document.body.appendChild(t);
		setTimeout(() => t.remove(), isErr ? 7000 : 3500);
	}

	// ---------- utilidades del mapa ----------

	function layerName(n) {
		const l = comp && comp.layers[n - 1];
		return (l && l.name) || cfg.layers[String(n)] || "";
	}
	function layerLabel(n) { const nm = layerName(n); return "Capa " + n + (nm ? " · " + nm : ""); }
	function clipName(layer, clip) {
		const i = comp && G.clipInfo(comp, layer, clip);
		return i && !i.missing ? i.name : "";
	}
	function ctlAt(kind, i) {
		if (kind == "pad") return D().pads[i];
		if (kind == "bottom") return D().bottom[i];
		if (kind == "side") return D().side[i];
		if (kind == "shift") return D().shift;
		return D().faders[i];
	}
	function selected() { return sel.idx.map((i) => ctlAt(sel.kind, i)); }
	function isToggle(d) { return d.type == "bypass" || d.type == "blackout" || ((d.type == "osc" || d.type == "midi") && d.mode == "toggle"); }
	function autoLabel(d) {
		if (d.label) return d.label;
		if (d.type == "clip") return clipName(d.layer, d.clip) || (layerName(d.layer) || "Capa " + d.layer) + " " + d.clip;
		if (d.type == "dual") return clipName(d.layer, d.clip) || "L" + d.layer + "+L" + d.layer2;
		if (d.type == "rgb") return d.rgb.toUpperCase();
		return "";
	}
	function noteOf(kind, i) {
		if (kind == "pad") return i;
		if (kind == "bottom") return 100 + i;
		if (kind == "side") return 112 + i;
		if (kind == "shift") return 122;
		return "CC " + (48 + i);
	}
	function ctlTitle(kind, i) {
		if (kind == "pad") return "Pad fila " + (Math.floor(i / 8) + 1) + " · columna " + ((i % 8) + 1);
		if (kind == "bottom") return "Botón de abajo " + (i + 1);
		if (kind == "side") return "Botón lateral " + (i + 1) + (i == 0 ? " (arriba)" : "");
		if (kind == "shift") return "Shift";
		return "Fader " + (i + 1) + (i == 8 ? " (master)" : "");
	}

	// LEDs por tipo: qué estados tiene sentido configurar
	function padStates(d) {
		const t = d.type;
		if (t == "clip" || t == "dual") return [["empty", "Vacío"], ["loaded", "Cargado"], ["active", "Sonando"]];
		if (t == "rgb") return [["empty", "Sin clip seleccionado"], ["loaded", "Canal quitado"], ["active", "Canal activo"]];
		if (t == "tap") return [["loaded", "Siempre (va a tempo)"]];
		if (t == "none") return [];
		if (isToggle(d)) return [["loaded", "Desactivado"], ["active", "Activado"]];
		return [["loaded", "En reposo"], ["active", "Al pulsar"]];
	}
	function buttonStates(d) {
		if (d.type == "none") return [];
		return isToggle(d) ? [["idle", "Desactivado"], ["active", "Activado"]] : [["idle", "En reposo"], ["active", "Al pulsar"]];
	}

	// Valores por defecto al cambiar la función de un control
	function padDefaults(t) {
		const led = {
			clip: [0, 7, 15], dual: [0, 7, 15], rgb: [1, 14, 7], tap: [0, 15, 15], resync: [0, 7, 7],
			osc: [0, 3, 7], midi: [0, 3, 7], bypass: [0, 3, 15], blackout: [0, 3, 15], none: [0, 0, 0]
		}[t] || [0, 3, 7];
		return { empty: led[0], loaded: led[1], active: led[2] };
	}
	function setType(d, t, isPad) {
		const old = d.type;
		if (old == t) return;
		d.type = t;
		const firstMidi = cfg.targets.filter((x) => x.type == "midi")[0];
		if (t == "clip" || t == "dual") { d.layer = d.layer || 1; d.clip = d.clip || 1; d.name = ""; }
		if (t == "dual") { d.layer2 = d.layer2 || 2; d.clip2 = d.clip2 || 1; d.name2 = ""; }
		if (t == "osc") { d.target = "resolume"; d.address = d.address || "/composition/"; d.value = 1; d.mode = "pulse"; }
		if (t == "midi") { d.target = firstMidi ? firstMidi.id : ""; d.msg = "note"; d.channel = 1; d.number = 36; d.value = 127; d.mode = "pulse"; }
		if (t == "bypass" || t == "clear") d.layers = d.layers || [1];
		if (isPad) {
			if (!(old == "clip" && t == "dual") && !(old == "dual" && t == "clip")) d.led = padDefaults(t);
			if (!d.color && t != "none") d.color = 3;
		} else {
			d.led = { idle: 0, active: t == "none" ? 0 : (t == "bypass" || t == "blackout" ? 2 : 1) };
		}
	}

	// ---------- vista previa de LEDs ----------

	function beat() { return 60 / Math.max(20, bpm || 120); }
	function ledHtml(ch, hex) {
		if (!ch) return "";
		let style = "background:" + hex + ";";
		let cls = "led";
		let dur = 0;
		if (ch <= 7) style += "opacity:" + LEVELS[ch] + ";box-shadow:0 0 " + Math.round(LEVELS[ch] * 12) + "px " + hex + ";";
		else if (PULSE_FRAC[ch]) { cls += " pulse"; dur = beat() * 4 * PULSE_FRAC[ch]; }
		else { cls += " blink"; dur = beat() * 4 * BLINK_FRAC[ch]; }
		if (dur) style += "animation-duration:" + dur.toFixed(3) + "s;animation-delay:-" + ((performance.now() / 1000) % dur).toFixed(3) + "s;";
		return '<div class="' + cls + '" style="' + style + '"></div>';
	}
	function buttonLedHtml(v, hex) {
		if (!v) return "";
		if (v == 1) return ledHtml(7, hex);
		const dur = beat();
		return '<div class="led blink" style="background:' + hex + ";animation-duration:" + dur.toFixed(3) + "s;animation-delay:-" + ((performance.now() / 1000) % dur).toFixed(3) + 's"></div>';
	}
	function previewPadState(i) {
		const d = D().pads[i];
		const t = d.type;
		if (t == "none") return null;
		if (t == "clip" || t == "dual") {
			if (previewMode == "empty" || previewMode == "loaded" || previewMode == "active") return previewMode;
			const info = comp && G.clipInfo(comp, d.layer, d.clip);
			if (info && (info.missing || info.empty)) return "empty";
			if (previewMode == "show") return showState[i] || "loaded";
			const row = Math.floor(i / 8), col = i % 8;
			return col == row % 8 ? "active" : "loaded";
		}
		if (t == "rgb") return previewMode == "empty" ? "empty" : (previewMode == "loaded" ? "loaded" : "active");
		return previewMode == "active" ? "active" : "loaded";
	}
	function padLed(i) {
		const d = D().pads[i];
		const st = previewPadState(i);
		if (!st) return "";
		return ledHtml(d.led[st], PALETTE[d.color]);
	}

	// Simulación de show: cada dos tiempos suena un clip distinto en cada capa
	let showTimer = null;
	function updateShowTimer() {
		if (showTimer) { clearInterval(showTimer); showTimer = null; }
		if (previewMode != "show") return;
		const tick = () => {
			const byLayer = {};
			D().pads.forEach((d, i) => {
				if (d.type != "clip" && d.type != "dual") return;
				(byLayer[d.layer] = byLayer[d.layer] || []).push(i);
			});
			showState = {};
			Object.keys(byLayer).forEach((l) => {
				const pads = byLayer[l];
				pads.forEach((p) => { showState[p] = "loaded"; });
				if (Math.random() < 0.8) showState[pads[Math.floor(Math.random() * pads.length)]] = "active";
			});
			renderDevice();
		};
		tick();
		showTimer = setInterval(tick, beat() * 2000);
	}

	// ---------- dibujo del aparato ----------

	function issuesByPad() {
		const m = {};
		G.validateConfig(cfg, comp).forEach((w) => {
			if (!w.ref || w.ref.pad === undefined || (w.ref.device || 0) != devIdx) return;
			if (w.level == "error" || !m[w.ref.pad]) m[w.ref.pad] = w.level;
		});
		return m;
	}

	function renderDevice() {
		const issues = issuesByPad();
		const isSel = (kind, i) => sel.kind == kind && sel.idx.indexOf(i) >= 0;
		const devName = devIdx ? (D().label || "APC " + (devIdx + 1)) + " (" + D().id + ")" : "APC 1 (apc)";
		let h = '<div class="brand" style="grid-row:1"><span>AKAI · APC MINI MK2</span><span>' + esc(devName) + "</span></div>";

		h += '<div class="rowlabels" style="grid-row:2;grid-column:1">';
		for (let r = 8; r >= 1; r--) h += '<div><span>F' + r + '</span><button class="small" data-tpl="' + (r - 1) + '" title="Plantilla para la fila ' + r + '">▦</button></div>';
		h += "</div>";

		h += '<div class="grid" style="grid-row:2;grid-column:2">';
		for (let row = 7; row >= 0; row--) {
			for (let col = 0; col < 8; col++) {
				const i = row * 8 + col, d = D().pads[i];
				let ico = d.type == "clip" ? d.layer + "·" + d.clip : d.type == "dual" ? d.layer + "+" + d.layer2 : (ICONS[d.type] || "");
				if (d.extra && d.extra.length) ico += " +";
				const badge = issues[i] ? '<span class="badge ' + (issues[i] == "error" ? "err" : "warn") + '">' + (issues[i] == "error" ? "✖" : "⚠") + "</span>" : "";
				h += '<div class="pad' + (isSel("pad", i) ? " sel" : "") + '" data-kind="pad" data-i="' + i + '" title="' + esc(ctlTitle("pad", i) + " · nota " + i + (autoLabel(d) ? " · " + autoLabel(d) : "")) + '">' +
					padLed(i) + '<span class="ico">' + esc(ico) + "</span>" + badge + '<span class="lbl">' + esc(autoLabel(d)) + "</span></div>";
			}
		}
		h += "</div>";

		const btnPreview = (d) => previewMode == "active" ? d.led.active : d.led.idle;
		h += '<div class="side" style="grid-row:2;grid-column:3">';
		for (let i = 0; i < 8; i++) {
			const d = D().side[i];
			h += '<div class="btn' + (isSel("side", i) ? " sel" : "") + '" data-kind="side" data-i="' + i + '" title="' + esc(ctlTitle("side", i) + " · nota " + (112 + i)) + '">' +
				buttonLedHtml(btnPreview(d), SIDE_COLOR) + '<span class="blbl">' + esc(d.label || (d.type == "none" ? "—" : "")) + "</span></div>";
		}
		h += "</div>";

		h += '<div class="bottomrow" style="grid-row:3;grid-column:2">';
		for (let i = 0; i < 8; i++) {
			const d = D().bottom[i];
			h += '<div class="btn' + (isSel("bottom", i) ? " sel" : "") + '" data-kind="bottom" data-i="' + i + '" title="' + esc(ctlTitle("bottom", i) + " · nota " + (100 + i) + (d.label ? " · " + d.label : "")) + '">' +
				buttonLedHtml(btnPreview(D().bottom[i]), BOTTOM_COLOR) + '<span class="blbl">' + esc(d.label || "") + "</span></div>";
		}
		h += "</div>";

		h += '<div class="shiftbox" style="grid-row:3;grid-column:3"><div class="btn' + (isSel("shift", 0) ? " sel" : "") + '" data-kind="shift" data-i="0" title="Shift · nota 122"><span class="blbl">SHIFT</span></div></div>';

		h += '<div class="faders" style="grid-row:4">';
		for (let i = 0; i < 9; i++) {
			const f = D().faders[i];
			h += '<div class="fader' + (f.type == "none" ? " none" : "") + (isSel("fader", i) ? " sel" : "") + '" data-kind="fader" data-i="' + i + '" title="' + esc(ctlTitle("fader", i) + " · CC " + (48 + i)) + '">' +
				'<div class="track"><div class="knob"></div></div><span class="fnum">' + (i + 1) + '</span><span class="flbl">' + esc(faderLabel(f)) + "</span></div>";
		}
		h += "</div>";
		$("device").innerHTML = h;
	}

	function faderLabel(f) {
		if (f.label) return f.label;
		if (f.type == "layerOpacity" || f.type == "layerMaster") return (layerName(f.layer) || "Capa " + f.layer) + (f.type == "layerMaster" ? " master" : "");
		if (f.type == "compMaster") return "Master";
		if (f.type == "clipSpeed") return "Velocidad";
		if (f.type == "osc") return "OSC";
		if (f.type == "midiCC") return "CC " + f.number;
		if (f.type == "compOpacity") return "Opacidad comp.";
		return "—";
	}

	// ---------- inspector ----------

	function opts(list, value) {
		return list.map((o) => '<option value="' + esc(o[0]) + '"' + (String(o[0]) == String(value) ? " selected" : "") + ">" + esc(o[1]) + "</option>").join("");
	}
	function groupedOpts(groups, value) {
		return groups.map((g) => g[0] ? '<optgroup label="' + esc(g[0]) + '">' + opts(g[1], value) + "</optgroup>" : opts(g[1], value)).join("");
	}
	function field(label, inner, hint) {
		return '<div class="field"><label>' + label + "</label>" + inner + (hint ? '<div class="hint">' + hint + "</div>" : "") + "</div>";
	}
	function input(k, value, t, extra) {
		const type = t == "int" || t == "num" ? "number" : "text";
		return '<input type="' + type + '" data-k="' + k + '" data-t="' + (t || "str") + '" value="' + esc(value) + '" ' + (extra || "") + ">";
	}
	function select(k, value, optionsHtml, t) {
		return '<select data-k="' + k + '" data-t="' + (t || "str") + '">' + optionsHtml + "</select>";
	}
	function layerInput(k, value) {
		if (comp && comp.layers.length) {
			const list = comp.layers.map((l, i) => [i + 1, (i + 1) + " · " + (l.name || "sin nombre")]);
			if (value > comp.layers.length) list.push([value, value + " · (no existe en Resolume)"]);
			return select(k, value, opts(list, value), "int");
		}
		return '<div class="row"><span class="fixed">' + input(k, value, "int", 'min="1"') + '</span><span class="dim">' + esc(layerName(value)) + "</span></div>";
	}
	function clipInput(k, layer, value) {
		const l = comp && comp.layers[layer - 1];
		if (l) {
			const list = l.clips.map((c, i) => [i + 1, (i + 1) + " · " + (c.empty ? "(vacío)" : c.name || "sin nombre")]);
			if (value > l.clips.length) list.push([value, value + " · (no existe)"]);
			return select(k, value, opts(list, value), "int");
		}
		return input(k, value, "int", 'min="1"');
	}
	function nameCheck(k, layer, clip, saved) {
		if (!comp) {
			return field("Nombre del clip (para avisar si cambia)", input(k, saved, "str", 'placeholder="Opcional"'),
				"Lee la composición en la pestaña Resolume para rellenarlo solo.");
		}
		const info = G.clipInfo(comp, layer, clip);
		const actual = info && !info.missing ? info.name : "";
		let st;
		if (!info || info.missing) st = '<span class="err">✖ Ese clip no existe en la composición</span>';
		else if (!saved) st = '<span class="warn">Sin nombre guardado.</span> En Resolume: «' + esc(actual || "vacío") + "»";
		else if (saved == actual) st = '<span class="ok">✔ Coincide: «' + esc(saved) + "»</span>";
		else {
			const found = G.findClip(comp, layer, saved);
			st = '<span class="err">✖ Esperaba «' + esc(saved) + "» y hay «" + esc(actual || "vacío") + "»</span>" +
				(found ? ' <button class="small" data-act="moveclip" data-k="' + k + '" data-to="' + found + '">Mover al clip ' + found + "</button>" : "");
		}
		const take = actual && actual != saved ? ' <button class="small" data-act="takename" data-k="' + k + '" data-name="' + esc(actual) + '">Guardar «' + esc(actual) + "»</button>" : "";
		return '<div class="namecheck">' + st + take + "</div>";
	}
	function targetOptions(kind, value) {
		const list = kind == "osc" ? [["resolume", "resolume (Resolume)"]] : [];
		cfg.targets.filter((t) => t.type == kind).forEach((t) => list.push([t.id, t.id + (t.label ? " (" + t.label + ")" : "")]));
		if (value && !list.some((o) => o[0] == value)) list.push([value, value + " (no existe)"]);
		if (!list.length) list.push(["", "— crea un destino MIDI en la pestaña Destinos —"]);
		return opts(list, value);
	}
	function actionFields(prefix, a, isMain) {
		let h = "";
		const p = prefix ? prefix + "." : "";
		if (a.type == "osc") {
			h += field("Destino", select(p + "target", a.target, targetOptions("osc", a.target)));
			h += field("Dirección OSC", input(p + "address", a.address, "str", 'list="oscList" spellcheck="false"'));
			h += '<div class="row">' + field("Valor", input(p + "value", a.value, "num", 'step="any"')) + field("Modo", select(p + "mode", a.mode, opts(modeOptions("osc"), a.mode))) + "</div>";
		} else {
			h += field("Destino", select(p + "target", a.target, targetOptions("midi", a.target)));
			h += '<div class="row">' + field("Mensaje", select(p + "msg", a.msg, opts([["note", "Nota"], ["cc", "CC"], ["pc", "Program change"]], a.msg))) +
				field("Canal", input(p + "channel", a.channel, "int", 'min="1" max="16"')) + "</div>";
			h += '<div class="row">' + field(a.msg == "cc" ? "Número de CC" : a.msg == "pc" ? "Programa" : "Nota", input(p + "number", a.number, "int", 'min="0" max="127"')) +
				(a.msg == "pc" ? "" : field(a.msg == "cc" ? "Valor" : "Velocity", input(p + "value", a.value, "int", 'min="0" max="127"'))) + "</div>";
			if (a.msg != "pc") h += field("Modo", select(p + "mode", a.mode, opts(modeOptions("midi"), a.mode)));
		}
		if (isMain && a.target && a.target != "resolume") {
			h += '<label class="check"><input type="checkbox" data-k="feedback" data-t="bool"' + (a.feedback ? " checked" : "") + "> LED según lo que devuelva el programa</label>" +
				'<div class="hint">El LED se enciende cuando ' + esc(a.target) + " devuelve esta misma " + (a.type == "osc" ? "dirección OSC" : a.msg == "cc" ? "CC" : "nota") +
				" (p. ej. la escena está activa en Sunlite). Para Sunlite suele ir mejor el modo «Pulso». Necesita el script destino_a_apc.js en el módulo «" + esc(a.target) + "».</div>";
		}
		return h;
	}
	function modeOptions(kind) {
		return kind == "osc"
			? [["pulse", "Pulso: manda el valor y luego 0"], ["hold", "Mantener: el valor al pulsar, 0 al soltar"], ["toggle", "Interruptor: un toque on, otro off"]]
			: [["pulse", "Pulso: on y off seguidos"], ["hold", "Mantener: on al pulsar, off al soltar"], ["toggle", "Interruptor: un toque on, otro off"]];
	}

	function ledSection(d, isPad) {
		let h = "";
		if (isPad) {
			const states = padStates(d);
			if (!states.length) return "";
			h += "<h3>Color</h3><div class=\"quick\">" + TESTED.map((c) => '<div data-color="' + c[0] + '" class="' + (d.color == c[0] ? "on" : "") + '" style="background:' + PALETTE[c[0]] + '" title="' + c[1] + " (" + c[0] + ', comprobado)"><span>' + c[0] + "</span></div>").join("") + "</div>";
			h += '<details' + (TESTED.some((c) => c[0] == d.color) ? "" : " open") + '><summary class="dim">Paleta completa (128 colores) · ahora: ' + d.color + "</summary><div class=\"palette\" style=\"margin-top:6px\">" +
				PALETTE.map((hex, i) => '<div data-color="' + i + '" class="' + (d.color == i ? "on" : "") + '" style="background:' + hex + '" title="' + i + '"></div>').join("") + "</div></details>";
			h += "<h3>LED</h3>";
			states.forEach((s) => {
				h += '<div class="ledstate"><span>' + s[1] + "</span>" + select("led." + s[0], d.led[s[0]], opts(LED_OPTIONS, d.led[s[0]]), "int") +
					'<div class="sw">' + ledHtml(d.led[s[0]], PALETTE[d.color]) + "</div></div>";
			});
			if (d.type == "tap") h += '<div class="hint">El parpadeo va al BPM de Resolume (Chataigne manda reloj MIDI al APC).</div>';
		} else {
			const states = buttonStates(d);
			if (!states.length) return "";
			h += "<h3>LED</h3>";
			states.forEach((s) => {
				h += '<div class="ledstate"><span>' + s[1] + "</span>" + select("led." + s[0], d.led[s[0]], opts(BTN_LED, d.led[s[0]]), "int") +
					'<div class="sw">' + buttonLedHtml(d.led[s[0]], sel.kind == "side" ? SIDE_COLOR : BOTTOM_COLOR) + "</div></div>";
			});
			h += '<div class="hint">Estos botones son de un solo color: ' + (sel.kind == "side" ? "verde" : "rojo") + ".</div>";
		}
		return h;
	}

	function extrasSection(d) {
		if (d.type == "none") return "";
		const ex = d.extra || [];
		let h = "<h3>Además, enviar…</h3>";
		if (!ex.length) h += '<p class="dim">Por ejemplo: lanzar el clip en Resolume y a la vez una escena de Sunlite.</p>';
		ex.forEach((a, k) => {
			h += '<div class="box"><div class="row" style="margin-bottom:8px"><strong>' + (a.type == "midi" ? "MIDI" : "OSC") + " " + (k + 1) +
				'</strong><span class="fixed"><button class="small" data-act="delextra" data-n="' + k + '">Quitar</button></span></div>' + actionFields("extra." + k, a) + "</div>";
		});
		if (ex.length < G.MAX_EXTRA) h += '<div class="row"><button data-act="addextra" data-type="midi">+ MIDI</button><button data-act="addextra" data-type="osc">+ OSC</button></div>';
		return h;
	}

	function renderInspector() {
		const el = $("tab-ctl");
		if (!sel.idx.length) {
			el.innerHTML = '<h2>Elige un control</h2><p class="dim">Haz clic en un pad, un botón, un fader o el Shift del dibujo.</p>' +
				'<p class="dim">Con Ctrl o Mayús + clic eliges varios a la vez: lo que cambies se aplica a todos.</p>' +
				'<p class="dim">El botón <strong>▦</strong> de cada fila rellena la fila entera con una plantilla.</p>';
			return;
		}
		const k = sel.kind, list = selected(), d = list[0], multi = list.length > 1;
		const title = multi ? list.length + " controles seleccionados" : ctlTitle(k, sel.idx[0]);
		let h = "<h2>" + esc(title) + "</h2>";
		if (!multi) h += '<p class="dim" style="margin-top:-6px">' + (k == "fader" ? "CC " + (48 + sel.idx[0]) : "Nota " + noteOf(k, sel.idx[0])) + "</p>";
		if (multi && list.some((x) => x.type != d.type)) h += '<p class="warn">Tienen funciones distintas: se muestran los datos del primero.</p>';

		h += field("Etiqueta", input("label", d.label, "str", 'placeholder="' + esc(k == "fader" ? faderLabel(Object.assign({}, d, { label: "" })) : autoLabel(Object.assign({}, d, { label: "" }))) + '"'));

		if (k == "fader") {
			h += field("Función", select("type", d.type, groupedOpts(FADER_TYPES, d.type)));
			if (d.type == "layerOpacity" || d.type == "layerMaster" || d.type == "clipSpeed") h += field("Capa", layerInput("layer", d.layer));
			if (d.type == "clipSpeed") {
				h += field("Clip", clipInput("clip", d.layer, d.clip));
				h += nameCheck("name", d.layer, d.clip, d.name);
				h += '<div class="row">' + field("Abajo (×)", input("min", d.min, "num", 'step="any" min="0.01"')) + field("Arriba (×)", input("max", d.max, "num", 'step="any"')) + "</div>";
				h += '<div class="hint">Curva exponencial: con 0,25 y 4 queda 0,25× abajo, 1× en el centro y 4× arriba. Se manda por la API web (' + (cfg.options.speedMethod == "put" ? "PUT" : "WebSocket") + ", ver Opciones).</div>";
			}
			if (d.type == "osc") {
				h += field("Destino", select("target", d.target, targetOptions("osc", d.target)));
				h += field("Dirección OSC", input("address", d.address, "str", 'list="oscList" spellcheck="false"'));
				h += '<div class="row">' + field("Valor abajo", input("min", d.min, "num", 'step="any"')) + field("Valor arriba", input("max", d.max, "num", 'step="any"')) + "</div>";
			}
			if (d.type == "midiCC") {
				h += field("Destino", select("target", d.target, targetOptions("midi", d.target)));
				h += '<div class="row">' + field("Canal", input("channel", d.channel, "int", 'min="1" max="16"')) + field("CC", input("number", d.number, "int", 'min="0" max="127"')) + "</div>";
				h += '<div class="row">' + field("Valor abajo", input("min", d.min, "int", 'min="0" max="127"')) + field("Valor arriba", input("max", d.max, "int", 'min="0" max="127"')) + "</div>";
			}
			if (d.type == "compOpacity") h += '<p class="hint">Ojo: esto es <code>/composition/video/opacity</code>, no el fader Master (<code>/composition/master</code>).</p>';
		} else {
			const isPad = k == "pad";
			h += field("Función", select("type", d.type, groupedOpts(isPad ? PAD_TYPES : BUTTON_TYPES, d.type)));
			if (d.type == "clip" || d.type == "dual") {
				h += '<div class="box"><div class="row">' + field(d.type == "dual" ? "Capa (1.º clip)" : "Capa", layerInput("layer", d.layer)) + field("Clip", clipInput("clip", d.layer, d.clip)) + "</div>" +
					nameCheck("name", d.layer, d.clip, d.name) + "</div>";
				if (d.type == "dual") {
					h += '<div class="box"><div class="row">' + field("Capa (2.º clip)", layerInput("layer2", d.layer2)) + field("Clip", clipInput("clip2", d.layer2, d.clip2)) + "</div>" +
						nameCheck("name2", d.layer2, d.clip2, d.name2) + '<div class="hint">El LED sigue el estado del 1.er clip.</div></div>';
				}
			}
			if (d.type == "rgb") h += field("Canal", select("rgb", d.rgb, opts([["r", "R (rojo)"], ["g", "G (verde)"], ["b", "B (azul)"]], d.rgb)), "Quita o pone ese canal de color del clip seleccionado en Resolume.");
			if (d.type == "bypass" || d.type == "clear") {
				h += field("Capas", input("layers", (d.layers || []).join(", "), "layers", 'placeholder="1, 3"'),
					(d.layers || []).map((n) => esc(layerLabel(n))).join(" · ") + (d.type == "bypass" ? "<br>El LED sigue a la primera capa." : ""));
			}
			if (d.type == "prev" || d.type == "next") h += field("Capa", layerInput("layer", d.layer), "Salta al clip " + (d.type == "prev" ? "anterior" : "siguiente") + " que tenga contenido (no da la vuelta).");
			if (d.type == "osc" || d.type == "midi") h += actionFields("", d, true);
			if (k == "shift" && d.type != "none") h += '<p class="hint">El Shift no tiene LED.</p>';
			if (k != "shift") h += ledSection(d, isPad);
			h += extrasSection(d);
		}

		h += '<h3>Herramientas</h3><div class="row"><button data-act="copy">Copiar ajustes</button><button data-act="paste"' + (clipboard && clipboard.kind == (k == "pad" ? "pad" : k == "fader" ? "fader" : "button") ? "" : " disabled") + ">Pegar</button>" +
			'<button data-act="reset">Dejar en «Nada»</button></div>';
		el.innerHTML = h;
	}

	// ---------- cambios desde el inspector ----------

	function setPath(o, path, value) {
		const parts = path.split(".");
		let cur = o;
		for (let i = 0; i < parts.length - 1; i++) {
			const p = parts[i];
			if (cur[p] == null) cur[p] = /^\d+$/.test(parts[i + 1]) ? [] : {};
			cur = cur[p];
		}
		cur[parts[parts.length - 1]] = value;
	}
	function parseVal(el) {
		const t = el.dataset.t;
		if (t == "int") return parseInt(el.value, 10) || 0;
		if (t == "num") { const n = parseFloat(String(el.value).replace(",", ".")); return isNaN(n) ? 0 : n; }
		if (t == "layers") return G.layerList(el.value);
		if (t == "bool") return el.checked;
		return el.value;
	}

	function onInspectorChange(e) {
		const el = e.target.closest("[data-k]");
		if (!el || !el.closest("#tab-ctl")) return;
		const k = el.dataset.k, v = parseVal(el);
		const isPad = sel.kind == "pad";
		commit(() => {
			selected().forEach((d) => {
				if (k == "type") { setType(d, v, isPad); return; }
				setPath(d, k, v);
				// al elegir otro clip con la composición cargada, se guarda su nombre
				if (comp && (k == "clip" || k == "layer")) d.name = clipName(d.layer, d.clip);
				if (comp && (k == "clip2" || k == "layer2")) d.name2 = clipName(d.layer2, d.clip2);
			});
		});
	}

	function onInspectorClick(e) {
		const c = e.target.closest("[data-color]");
		if (c && c.closest("#tab-ctl")) {
			const v = parseInt(c.dataset.color, 10);
			commit(() => selected().forEach((d) => { d.color = v; }));
			return;
		}
		const b = e.target.closest("[data-act]");
		if (!b || !b.closest("#tab-ctl")) return;
		const act = b.dataset.act;
		if (act == "addextra") {
			commit(() => selected().forEach((d) => {
				d.extra = d.extra || [];
				if (d.extra.length >= G.MAX_EXTRA) return;
				const firstMidi = cfg.targets.filter((t) => t.type == "midi")[0];
				d.extra.push(b.dataset.type == "midi"
					? { type: "midi", target: firstMidi ? firstMidi.id : "", msg: "note", channel: 1, number: 36, value: 127, mode: "pulse" }
					: { type: "osc", target: "resolume", address: "/composition/", value: 1, mode: "pulse" });
			}));
		}
		else if (act == "delextra") commit(() => selected().forEach((d) => { if (d.extra) d.extra.splice(parseInt(b.dataset.n, 10), 1); }));
		else if (act == "takename") commit(() => selected().forEach((d) => { d[b.dataset.k] = b.dataset.name; }));
		else if (act == "moveclip") {
			const to = parseInt(b.dataset.to, 10);
			commit(() => selected().forEach((d) => { if (b.dataset.k == "name2") d.clip2 = to; else d.clip = to; }));
		}
		else if (act == "copy") {
			clipboard = { kind: sel.kind == "pad" ? "pad" : sel.kind == "fader" ? "fader" : "button", data: clone(selected()[0]) };
			toast("Ajustes copiados. Elige otro control y pulsa Pegar.");
			renderInspector();
		}
		else if (act == "paste" && clipboard) commit(() => sel.idx.forEach((i) => replaceCtl(sel.kind, i, clone(clipboard.data))));
		else if (act == "reset") commit(() => sel.idx.forEach((i) => replaceCtl(sel.kind, i, { type: "none" })));
	}
	function replaceCtl(kind, i, d) {
		if (kind == "pad") D().pads[i] = d;
		else if (kind == "bottom") D().bottom[i] = d;
		else if (kind == "side") D().side[i] = d;
		else if (kind == "shift") D().shift = d;
		else D().faders[i] = d;
	}

	// ---------- selección ----------

	function onDeviceClick(e) {
		const tpl = e.target.closest("[data-tpl]");
		if (tpl) { openTemplate(parseInt(tpl.dataset.tpl, 10)); return; }
		const el = e.target.closest("[data-kind]");
		if (!el) return;
		const kind = el.dataset.kind, i = parseInt(el.dataset.i, 10);
		if ((e.ctrlKey || e.metaKey || e.shiftKey) && sel.kind == kind) {
			const p = sel.idx.indexOf(i);
			if (p >= 0) sel.idx.splice(p, 1); else sel.idx.push(i);
		} else sel = { kind: kind, idx: [i] };
		showTab("ctl");
		renderDevice();
		renderInspector();
	}
	function selectRef(ref) {
		if (!ref) return;
		if (ref.link !== undefined) { showTab("lnk"); return; }
		if ((ref.device || 0) != devIdx) { devIdx = ref.device || 0; store.set("device", devIdx); renderAll(); }
		if (ref.pad !== undefined) sel = { kind: "pad", idx: [ref.pad] };
		else if (ref.fader !== undefined) sel = { kind: "fader", idx: [ref.fader] };
		else if (ref.group) sel = { kind: ref.group, idx: [ref.index || 0] };
		showTab("ctl");
		renderDevice();
		renderInspector();
	}

	// ---------- plantilla de fila ----------

	function openTemplate(row) {
		const dlg = $("tplDialog");
		const cur = D().pads[row * 8];
		const layerField = (id, v) => comp && comp.layers.length
			? '<select id="' + id + '">' + opts(comp.layers.map((l, i) => [i + 1, (i + 1) + " · " + (l.name || "sin nombre")]), v) + "</select>"
			: '<input type="number" id="' + id + '" min="1" value="' + v + '">';
		dlg.innerHTML = "<h2>Plantilla para la fila " + (row + 1) + "</h2>" +
			field("Qué hace", '<select id="tplKind">' + opts([["clip", "Lanzar clips de una capa"], ["dual", "Lanzar clips de dos capas a la vez"], ["none", "Vaciar la fila (nada)"]], "clip") + "</select>") +
			'<div id="tplClip"><div class="row">' + field("Capa", layerField("tplLayer", cur.layer || 1)) + field("Primer clip", '<input type="number" id="tplFirst" min="1" value="' + (cur.clip || 1) + '">') + "</div>" +
			'<div class="row" id="tplDualRow" style="display:none">' + field("2.ª capa", layerField("tplLayer2", cur.layer2 || 2)) + field("Primer clip", '<input type="number" id="tplFirst2" min="1" value="1">') + "</div>" +
			'<p class="hint">Los 8 pads lanzan los clips seguidos: primer clip, +1, +2… Luego puedes cambiar pads sueltos.</p></div>' +
			'<div id="tplLook">' + field("Color", '<select id="tplColorMode">' + opts([["one", "Un color para toda la fila"], ["rainbow", "Arcoíris: blanco, rojo, naranja, amarillo, verde, cian, azul, magenta"], ["keep", "Dejar los colores que tiene"]], "one") + "</select>") +
			'<div class="quick" id="tplColors">' + TESTED.map((c) => '<div data-tplcolor="' + c[0] + '" class="' + (c[0] == (cur.color || 21) ? "on" : "") + '" style="background:' + PALETTE[c[0]] + '" title="' + c[1] + '"></div>').join("") + "</div>" +
			field("LED", '<select id="tplLed">' + opts(Object.keys(LED_PRESETS).map((k) => [k, LED_PRESETS[k].name]), "normal") + "</select>") +
			'<div id="tplCustom" style="display:none">' + ["empty", "loaded", "active"].map((s, n) => '<div class="ledstate"><span>' + ["Vacío", "Cargado", "Sonando"][n] + '</span><select id="tplLed_' + s + '">' + opts(LED_OPTIONS, padDefaults("clip")[s]) + "</select><span></span></div>").join("") + "</div>" +
			'<label class="check"><input type="checkbox" id="tplLabels" checked> Poner etiquetas con el nombre del clip</label></div>' +
			'<div class="row" style="margin-top:16px"><button id="tplCancel">Cancelar</button><button class="primary" id="tplApply">Aplicar a la fila ' + (row + 1) + "</button></div>";
		let color = cur.color || 21;
		const sync = () => {
			const kind = $("tplKind").value;
			$("tplClip").style.display = kind == "none" ? "none" : "";
			$("tplLook").style.display = kind == "none" ? "none" : "";
			$("tplDualRow").style.display = kind == "dual" ? "" : "none";
			$("tplColors").style.display = $("tplColorMode").value == "one" ? "" : "none";
			$("tplCustom").style.display = $("tplLed").value == "custom" ? "" : "none";
		};
		dlg.onchange = sync;
		dlg.onclick = (e) => {
			const c = e.target.closest("[data-tplcolor]");
			if (c) {
				color = parseInt(c.dataset.tplcolor, 10);
				dlg.querySelectorAll("[data-tplcolor]").forEach((x) => x.classList.toggle("on", x == c));
			}
		};
		$("tplCancel").onclick = () => dlg.close();
		$("tplApply").onclick = () => {
			const kind = $("tplKind").value;
			const L = parseInt($("tplLayer").value, 10) || 1, first = parseInt($("tplFirst").value, 10) || 1;
			const L2 = parseInt($("tplLayer2").value, 10) || 1, first2 = parseInt($("tplFirst2").value, 10) || 1;
			const preset = $("tplLed").value;
			const led = preset == "custom"
				? { empty: +$("tplLed_empty").value, loaded: +$("tplLed_loaded").value, active: +$("tplLed_active").value }
				: LED_PRESETS[preset].led;
			const colorMode = $("tplColorMode").value, labels = $("tplLabels").checked;
			commit(() => {
				for (let c = 0; c < 8; c++) {
					const i = row * 8 + c, old = D().pads[i];
					if (kind == "none") { D().pads[i] = { type: "none" }; continue; }
					const d = { type: kind, layer: L, clip: first + c, name: clipName(L, first + c), led: clone(led), extra: old.extra };
					if (kind == "dual") { d.layer2 = L2; d.clip2 = first2 + c; d.name2 = clipName(L2, first2 + c); }
					d.color = colorMode == "rainbow" ? RAINBOW[c] : colorMode == "keep" ? (old.color || color) : color;
					d.label = labels ? (d.name || "") : "";
					D().pads[i] = d;
				}
			});
			dlg.close();
			toast("Fila " + (row + 1) + " actualizada. Ctrl+Z para deshacer.");
		};
		sync();
		dlg.showModal();
	}

	// ---------- pestaña Resolume ----------

	function renderResolume() {
		const el = $("tab-res");
		let h = "<h2>Composición de Resolume</h2>" +
			'<p class="dim">Sirve para elegir capas y clips por su nombre y para avisar si cambias el orden de los clips en Resolume. Solo lee: no cambia nada en Resolume.</p>' +
			'<div class="row">' + field("IP del ordenador de Resolume", '<input type="text" id="resHost" value="' + esc(cfg.resolume.host) + '">') +
			'<div class="field fixed"><label>Puerto web</label><input type="number" id="resPort" value="' + cfg.resolume.apiPort + '"></div></div>' +
			'<div class="row"><button class="primary" id="btnReadComp">Leer composición</button><button id="btnLoadComp">Cargar desde archivo…</button></div>' +
			'<p class="hint">Si «Leer» falla, abre <code>http://' + esc(cfg.resolume.host) + ":" + cfg.resolume.apiPort +
			"/api/v1/composition</code> en otra pestaña, guárdalo con Ctrl+S como <code>composicion.json</code> y cárgalo con el segundo botón.</p>";
		if (comp) {
			h += '<div class="box"><strong>' + esc(comp.name || "Composición") + "</strong> · " + comp.layers.length + ' capas <button class="small" id="btnForgetComp" style="float:right">Olvidar</button></div>';
			const issues = G.checkNames(cfg, comp);
			const named = G.allDevices(cfg).reduce((n, dv) => n + dv.pads.filter((d) => (d.type == "clip" || d.type == "dual") && d.name).length, 0);
			h += "<h3>Comprobación de nombres</h3>";
			if (!issues.length) h += '<p class="ok">✔ Todo coincide con la composición.</p>';
			issues.forEach((w, n) => {
				h += '<div class="box"><div class="' + (w.level == "error" ? "err" : "warn") + '">' + esc(w.msg) + '</div><div class="row" style="margin-top:6px">' +
					'<button class="small fixed" data-goto="' + n + '">Ir</button>' +
					(w.moveTo ? '<button class="small fixed" data-fix="move" data-n="' + n + '">Mover al clip ' + w.moveTo + "</button>" : "") +
					(w.kind == "name" ? '<button class="small fixed" data-fix="accept" data-n="' + n + '">Usar el clip que hay ahora</button>' : "") + "</div></div>";
			});
			h += '<div class="row" style="margin-top:8px"><button id="btnFixAll"' + (issues.some((w) => w.moveTo) ? "" : " disabled") + '>Mover todos los que se han movido</button>' +
				'<button id="btnSaveNames">Guardar los nombres actuales</button></div>' +
				'<p class="hint">' + named + " pads tienen nombre guardado. «Guardar los nombres actuales» apunta el nombre que tiene ahora cada clip; hazlo cuando la composición esté bien.</p>";
			h += "<h3>Capas</h3><table style=\"width:100%;border-collapse:collapse\">" + comp.layers.map((l, i) => '<tr><td class="dim" style="width:30px">' + (i + 1) + "</td><td>" + esc(l.name) + '</td><td class="dim">' + l.clips.filter((c) => !c.empty).length + " clips</td></tr>").join("") + "</table>" +
				'<button id="btnLayerNames" style="margin-top:8px">Copiar estos nombres al mapa</button>';
		} else {
			h += "<h3>Nombres de capa del mapa</h3>" + '<p class="hint">Sin composición cargada, se usan estos nombres en la interfaz.</p>';
			for (let i = 1; i <= Math.max(5, ...Object.keys(cfg.layers).map(Number)); i++) {
				h += '<div class="row" style="margin-bottom:4px"><span class="fixed dim" style="width:60px">Capa ' + i + '</span><input type="text" data-layername="' + i + '" value="' + esc(cfg.layers[i] || "") + '"></div>';
			}
		}
		el.innerHTML = h;
		$("resHost").onchange = (e) => commit(() => { cfg.resolume.host = e.target.value.trim(); });
		$("resPort").onchange = (e) => commit(() => { cfg.resolume.apiPort = parseInt(e.target.value, 10); });
		$("btnReadComp").onclick = readComposition;
		$("btnLoadComp").onclick = () => $("fileComp").click();
		el.querySelectorAll("[data-layername]").forEach((inp) => {
			inp.onchange = () => commit(() => { if (inp.value.trim()) cfg.layers[inp.dataset.layername] = inp.value.trim(); else delete cfg.layers[inp.dataset.layername]; });
		});
		if (!comp) return;
		const issues = G.checkNames(cfg, comp);
		$("btnForgetComp").onclick = () => { comp = null; store.set("composition", null); renderAll(); };
		$("btnLayerNames").onclick = () => commit(() => { comp.layers.forEach((l, i) => { if (l.name) cfg.layers[i + 1] = l.name; }); });
		$("btnSaveNames").onclick = () => {
			if (!confirm("¿Guardar en el mapa el nombre que tiene ahora cada clip en Resolume?")) return;
			commit(() => {
				G.allDevices(cfg).forEach((dv, di) => {
					const real = di ? cfg.devices[di - 1] : cfg;
					real.pads.forEach((d) => {
						if (d.type == "clip" || d.type == "dual") d.name = clipName(d.layer, d.clip);
						if (d.type == "dual") d.name2 = clipName(d.layer2, d.clip2);
					});
					real.faders.forEach((f) => { if (f.type == "clipSpeed") f.name = clipName(f.layer, f.clip); });
				});
			});
		};
		$("btnFixAll").onclick = () => commit(() => issues.forEach((w) => applyFix(w, "move")));
		el.querySelectorAll("[data-goto]").forEach((b) => { b.onclick = () => selectRef(issues[+b.dataset.goto].ref); });
		el.querySelectorAll("[data-fix]").forEach((b) => { b.onclick = () => commit(() => applyFix(issues[+b.dataset.n], b.dataset.fix)); });
	}
	function applyFix(w, how) {
		if (w.kind != "name") return;
		const dv = w.ref.device ? cfg.devices[w.ref.device - 1] : cfg;
		const d = w.ref.pad !== undefined ? dv.pads[w.ref.pad] : dv.faders[w.ref.fader];
		const second = w.which == 2;
		if (how == "move" && w.moveTo) { if (second) d.clip2 = w.moveTo; else d.clip = w.moveTo; }
		if (how == "accept") { if (second) d.name2 = clipName(d.layer2, d.clip2); else d.name = clipName(d.layer, d.clip); }
	}

	// Primero por WebSocket (funciona aunque el configurador se abra como archivo local) y si no, por HTTP.
	async function readComposition() {
		const host = cfg.resolume.host + ":" + cfg.resolume.apiPort;
		const url = "http://" + host + "/api/v1/composition";
		try {
			setComposition(await window.RemoteRuntime.fetchComposition(host, 5000));
			return;
		} catch (e) { /* se prueba por HTTP */ }
		try {
			const r = await fetch(url, { cache: "no-store" });
			if (!r.ok) throw new Error("Resolume respondió " + r.status);
			setComposition(await r.json());
		} catch (e) {
			toast("No se pudo leer la composición de " + host + ". Comprueba que Resolume está abierto con el Webserver activado, o guárdala en un archivo y cárgala (ver la explicación).", true);
		}
	}
	function setComposition(json) {
		try {
			comp = G.parseComposition(json);
			store.set("composition", comp);
			// el constructor de remotes usa la composición completa
			window.dispatchEvent(new CustomEvent("apc:composition", { detail: json }));
			toast("Composición leída: " + comp.layers.length + " capas.");
			renderAll();
		} catch (e) { toast(e.message, true); }
	}

	// ---------- pestaña Destinos ----------

	function renderTargets() {
		const el = $("tab-dst");
		let h = "<h2>Destinos</h2>" +
			'<p class="dim">Además de Resolume, cualquier pad, botón o fader puede mandar mensajes a otros programas a través de Chataigne: luces (Sunlite, etc.), otro Resolume, un sampler…</p>' +
			'<p class="dim">Cada destino es un <strong>módulo de Chataigne</strong> con ese mismo nombre. El .noisette exportado los incluye; si no lo usas, créalos a mano en Chataigne.</p>';
		cfg.targets.forEach((t, i) => {
			const uses = countUses(t.id);
			h += '<div class="box"><div class="row" style="margin-bottom:8px"><strong>' + (t.type == "midi" ? "MIDI" : "OSC") + '</strong><span class="dim">' + uses + " usos</span>" +
				'<span class="fixed"><button class="small" data-deltarget="' + i + '">Quitar</button></span></div>' +
				'<div class="row">' + field("Nombre del módulo", '<input type="text" data-target="' + i + '" data-f="id" value="' + esc(t.id) + '" spellcheck="false">', "Minúsculas y números, sin espacios.") +
				field("Descripción", '<input type="text" data-target="' + i + '" data-f="label" value="' + esc(t.label) + '">') + "</div>" +
				(t.type == "osc"
					? '<div class="row">' + field("IP", '<input type="text" data-target="' + i + '" data-f="host" value="' + esc(t.host) + '">') + '<div class="field fixed"><label>Puerto</label><input type="number" data-target="' + i + '" data-f="port" value="' + t.port + '"></div></div>'
					: field("Puerto MIDI (nota para ti)", '<input type="text" data-target="' + i + '" data-f="device" value="' + esc(t.device) + '" placeholder="loopMIDI Port">', "El puerto se elige en Chataigne, en el módulo «" + esc(t.id) + "».")) +
				"</div>";
		});
		h += '<div class="row"><button data-addtarget="sunlite">+ Sunlite (MIDI)</button><button data-addtarget="midi">+ Destino MIDI</button><button data-addtarget="osc">+ Destino OSC</button></div>' +
			'<h3>Sunlite paso a paso</h3><ol class="hint" style="padding-left:18px">' +
			"<li>Instala <strong>loopMIDI</strong> (gratis) y crea un puerto, por ejemplo «loopMIDI Port».</li>" +
			"<li>Aquí: «+ Sunlite (MIDI)». En los pads elige «Mensaje MIDI» o «Además, enviar… + MIDI» con destino <code>sunlite</code>.</li>" +
			"<li>En Chataigne, en el módulo <code>sunlite</code>, elige como salida el puerto de loopMIDI.</li>" +
			"<li>En Sunlite, activa la entrada MIDI con ese mismo puerto y asigna cada nota o CC a su escena, botón o fader (aprendizaje MIDI).</li></ol>";
		el.innerHTML = h;
		el.querySelectorAll("[data-target]").forEach((inp) => {
			inp.onchange = () => {
				const i = +inp.dataset.target, f = inp.dataset.f;
				commit(() => {
					const t = cfg.targets[i];
					if (f == "id") {
						const old = t.id, nu = inp.value.toLowerCase().replace(/[^a-z0-9]/g, "");
						if (!nu || G.RESERVED_TARGETS.indexOf(nu) >= 0 || cfg.targets.some((x, k) => k != i && x.id == nu)) { toast("Ese nombre no vale o ya existe.", true); return; }
						t.id = nu;
						renameTargetUses(old, nu);
					} else t[f] = f == "port" ? parseInt(inp.value, 10) : inp.value;
				});
			};
		});
		el.querySelectorAll("[data-deltarget]").forEach((b) => {
			b.onclick = () => {
				const t = cfg.targets[+b.dataset.deltarget];
				if (countUses(t.id) && !confirm("«" + t.id + "» se usa en " + countUses(t.id) + " sitios. ¿Quitarlo igualmente? (esos controles darán error)")) return;
				commit(() => cfg.targets.splice(+b.dataset.deltarget, 1));
			};
		});
		el.querySelectorAll("[data-addtarget]").forEach((b) => {
			b.onclick = () => commit(() => {
				const kind = b.dataset.addtarget;
				const base = kind == "sunlite" ? "sunlite" : kind == "midi" ? "midi" : "osc";
				let id = base, n = 2;
				while (cfg.targets.some((x) => x.id == id)) id = base + n++;
				cfg.targets.push(kind == "osc" ? { id: id, type: "osc", label: "", host: "127.0.0.1", port: 8000 }
					: { id: id, type: "midi", label: kind == "sunlite" ? "Sunlite Suite" : "", device: kind == "sunlite" ? "loopMIDI Port" : "" });
			});
		});
	}
	function eachAction(fn) {
		const ctl = (d) => { if (d.type == "osc" || d.type == "midi") fn(d); (d.extra || []).forEach(fn); };
		[cfg].concat(cfg.devices || []).forEach((dv) => {
			dv.pads.forEach(ctl); dv.bottom.forEach(ctl); dv.side.forEach(ctl); ctl(dv.shift);
			dv.faders.forEach((f) => { if (f.type == "osc" || f.type == "midiCC") fn(f); });
		});
		(cfg.links || []).forEach((l) => l.actions.forEach(fn));
	}
	function countUses(id) { let n = 0; eachAction((a) => { if (a.target == id) n++; }); return n; }
	function renameTargetUses(old, nu) { eachAction((a) => { if (a.target == old) a.target = nu; }); }

	// ---------- varios APC ----------

	function renderDevBar() {
		const list = [{ label: "APC 1", id: "apc" }].concat(cfg.devices.map((d, i) => ({ label: d.label || "APC " + (i + 2), id: d.id })));
		let h = '<span class="dim">APC:</span><div class="seg">' + list.map((d, i) => '<button data-dev="' + i + '" class="' + (i == devIdx ? "on" : "") + '">' + esc(d.label) + "<small>" + esc(d.id) + "</small></button>").join("") + "</div>";
		if (list.length < G.MAX_DEVICES) h += '<button class="small" id="devAdd" title="Otro APC mini mk2 (por ejemplo para Sunlite)">+ Añadir APC</button>';
		if (devIdx > 0) {
			h += '<input type="text" id="devLabel" style="width:160px" value="' + esc(D().label) + '" placeholder="Nombre (p. ej. APC Sunlite)">' +
				'<button class="small" id="devDel">Quitar este APC</button>';
		}
		h += '<span class="dim" style="font-size:12px">' + (devIdx ? "En Chataigne: módulo MIDI «" + esc(D().id) + "» con el script apc_to_resolume.js." : list.length > 1 ? "Cada APC es un módulo MIDI de Chataigne con el mismo script." : "") + "</span>";
		$("devBar").innerHTML = h;
		$("devBar").querySelectorAll("[data-dev]").forEach((b) => { b.onclick = () => { devIdx = +b.dataset.dev; store.set("device", devIdx); sel = { kind: "pad", idx: [] }; renderAll(); }; });
		if ($("devAdd")) $("devAdd").onclick = () => {
			const copy = confirm("¿Empezar el APC nuevo con una copia del mapa de este?\nAceptar = copia · Cancelar = vacío");
			commit(() => {
				const src = D();
				const nd = copy ? clone({ pads: src.pads, bottom: src.bottom, side: src.side, shift: src.shift, faders: src.faders }) : {};
				nd.id = ""; // el generador le da apc2, apc3...
				nd.label = "";
				cfg.devices.push(nd);
			});
			devIdx = cfg.devices.length;
			store.set("device", devIdx);
			renderAll();
			toast("APC añadido: en Chataigne crea un módulo MIDI llamado «" + D().id + "» (o usa el .noisette exportado) con el script apc_to_resolume.js.");
		};
		if ($("devLabel")) $("devLabel").onchange = (e) => commit(() => { D().label = e.target.value.trim(); });
		if ($("devDel")) $("devDel").onclick = () => {
			if (!confirm("¿Quitar «" + (D().label || D().id) + "» y su mapa? (Ctrl+Z para deshacer)")) return;
			commit(() => { cfg.devices.splice(devIdx - 1, 1); });
			devIdx = 0;
			store.set("device", 0);
			renderAll();
		};
	}

	// ---------- enlaces ----------

	function renderLinks() {
		const el = $("tab-lnk");
		const links = cfg.links || [];
		const midi = cfg.targets.filter((t) => t.type == "midi");
		let h = "<h2>Enlaces automáticos</h2>" +
			'<p class="dim">Mientras suene algún clip de una capa, se manda algo a otro programa; cuando deja de sonar, se apaga. Siguen el estado real de Resolume, aunque el clip se lance desde Resolume o desde la tablet.</p>' +
			'<p class="dim">Ejemplo: mientras suena un <strong>cegado</strong>, <strong>blackout</strong> de la iluminación en Sunlite.</p>' +
			'<div class="row" style="margin-bottom:12px"><button class="primary" id="lnkPreset">+ Cegados → blackout de Sunlite</button><button id="lnkAdd">+ Enlace vacío</button></div>';
		links.forEach((l, i) => {
			h += '<div class="box"><div class="lnk-head"><label class="check fixed"><input type="checkbox" data-l="' + i + '" data-f="enabled"' + (l.enabled ? " checked" : "") + '></label>' +
				'<input type="text" data-l="' + i + '" data-f="label" value="' + esc(l.label) + '" placeholder="Nombre del enlace"><button class="small fixed" data-ldel="' + i + '">Quitar</button></div>' +
				'<div class="row"><div class="field"><label>Mientras suene… capa</label>' + linkLayerInput(i, l.layer) + "</div>" +
				'<div class="field fixed"><label>clips del</label><input type="number" min="1" data-l="' + i + '" data-f="from" value="' + l.from + '"></div>' +
				'<div class="field fixed"><label>al</label><input type="number" min="1" data-l="' + i + '" data-f="to" value="' + l.to + '"></div></div>' +
				'<div class="hint">' + esc(linkClipsText(l)) + "</div>";
			l.actions.forEach((a, k) => {
				h += '<div class="box" style="background:#0f1012;margin-top:8px"><div class="row" style="margin-bottom:6px"><strong>' + (a.type == "midi" ? "MIDI" : "OSC") +
					'</strong><span class="fixed"><button class="small" data-adel="' + i + ":" + k + '">Quitar</button></span></div>' + linkActionFields(i, k, a) + "</div>";
			});
			if (l.actions.length < G.MAX_EXTRA) h += '<div class="row" style="margin-top:8px"><button class="small" data-aadd="' + i + ':midi">+ MIDI</button><button class="small" data-aadd="' + i + ':osc">+ OSC</button></div>';
			h += "</div>";
		});
		if (!links.length) h += '<p class="dim">Todavía no hay enlaces.</p>';
		if (!midi.length) h += '<p class="hint">Para mandar a Sunlite necesitas un destino MIDI (pestaña Destinos); la plantilla lo crea si no existe.</p>';
		el.innerHTML = h;

		$("lnkPreset").onclick = () => commit(() => {
			if (!cfg.targets.some((t) => t.id == "sunlite")) cfg.targets.push({ id: "sunlite", type: "midi", label: "Sunlite Suite", device: "loopMIDI Port" });
			const blind = guessBlindRange();
			cfg.links.push({ label: "Cegado = blackout de luces", layer: blind.layer, from: blind.from, to: blind.to,
				actions: [{ type: "midi", target: "sunlite", msg: "note", channel: 1, number: 50, value: 127 }] });
			toast("Enlace creado. En Sunlite asigna la nota 50 (canal 1) al blackout con el aprendizaje MIDI, o cambia la nota aquí.");
		});
		$("lnkAdd").onclick = () => commit(() => { cfg.links.push({ layer: 1, from: 1, to: 8, actions: [] }); });
		el.querySelectorAll("[data-l]").forEach((inp) => {
			inp.onchange = () => commit(() => {
				const l = cfg.links[+inp.dataset.l], f = inp.dataset.f;
				l[f] = f == "enabled" ? inp.checked : f == "label" ? inp.value : parseInt(inp.value, 10) || 1;
			});
		});
		el.querySelectorAll("[data-la]").forEach((inp) => {
			inp.onchange = () => commit(() => {
				const parts = inp.dataset.la.split(":"), a = cfg.links[+parts[0]].actions[+parts[1]], f = parts[2];
				a[f] = inp.dataset.t == "int" ? parseInt(inp.value, 10) || 0 : inp.dataset.t == "num" ? parseFloat(inp.value) : inp.value;
			});
		});
		el.querySelectorAll("[data-ldel]").forEach((b) => { b.onclick = () => commit(() => { cfg.links.splice(+b.dataset.ldel, 1); }); });
		el.querySelectorAll("[data-adel]").forEach((b) => { b.onclick = () => { const x = b.dataset.adel.split(":"); commit(() => { cfg.links[+x[0]].actions.splice(+x[1], 1); }); }; });
		el.querySelectorAll("[data-aadd]").forEach((b) => {
			b.onclick = () => {
				const x = b.dataset.aadd.split(":"), m = cfg.targets.filter((t) => t.type == "midi")[0];
				commit(() => {
					cfg.links[+x[0]].actions.push(x[1] == "midi"
						? { type: "midi", target: m ? m.id : "", msg: "note", channel: 1, number: 50, value: 127 }
						: { type: "osc", target: "resolume", address: "/composition/bypassed", value: 1 });
				});
			};
		});
	}
	function linkLayerInput(i, v) {
		if (comp && comp.layers.length) return '<select data-l="' + i + '" data-f="layer">' + opts(comp.layers.map((l, k) => [k + 1, (k + 1) + " · " + (l.name || "sin nombre")]), v) + "</select>";
		return '<input type="number" min="1" data-l="' + i + '" data-f="layer" value="' + v + '">';
	}
	function linkClipsText(l) {
		const names = [];
		for (let c = l.from; c <= l.to && names.length < 4; c++) { const n = clipName(l.layer, c); if (n) names.push(n); }
		return layerLabel(l.layer) + ", clips " + l.from + "–" + l.to + (names.length ? " (" + names.join(", ") + (l.to - l.from + 1 > names.length ? "…" : "") + ")" : "");
	}
	function linkActionFields(i, k, a) {
		const key = (f) => 'data-la="' + i + ":" + k + ":" + f + '"';
		const tsel = (kind) => "<select " + key("target") + ">" + targetOptions(kind, a.target) + "</select>";
		if (a.type == "osc") {
			return field("Destino", tsel("osc")) + field("Dirección OSC", "<input type=\"text\" " + key("address") + ' value="' + esc(a.address) + '" list="oscList">') +
				field("Valor mientras suena", "<input type=\"number\" step=\"any\" " + key("value") + ' data-t="num" value="' + a.value + '">', "Al dejar de sonar se manda 0.");
		}
		return field("Destino", tsel("midi")) +
			'<div class="row">' + field("Mensaje", "<select " + key("msg") + ">" + opts([["note", "Nota (on / off)"], ["cc", "CC (valor / 0)"], ["pc", "Program change"]], a.msg) + "</select>") +
			field("Canal", "<input type=\"number\" min=\"1\" max=\"16\" " + key("channel") + ' data-t="int" value="' + a.channel + '">') + "</div>" +
			'<div class="row">' + field(a.msg == "cc" ? "CC" : a.msg == "pc" ? "Programa" : "Nota", "<input type=\"number\" min=\"0\" max=\"127\" " + key("number") + ' data-t="int" value="' + a.number + '">') +
			(a.msg == "pc" ? "" : field(a.msg == "cc" ? "Valor" : "Velocity", "<input type=\"number\" min=\"0\" max=\"127\" " + key("value") + ' data-t="int" value="' + a.value + '">')) + "</div>";
	}
	// Rango de los cegados: los pads con «cegado» en la etiqueta, o capa 2 clips 9–16 (mapa de Deseo54)
	function guessBlindRange() {
		const found = [];
		G.allDevices(cfg).forEach((dv) => dv.pads.forEach((d) => { if (d.type == "clip" && /cegad/i.test(d.label || "")) found.push(d); }));
		if (!found.length) return { layer: 2, from: 9, to: 16 };
		const layer = found[0].layer, clips = found.filter((d) => d.layer == layer).map((d) => d.clip);
		return { layer: layer, from: Math.min.apply(null, clips), to: Math.max.apply(null, clips) };
	}

	// ---------- pestaña Opciones ----------

	function renderOptions() {
		const o = cfg.options;
		$("tab-opt").innerHTML = "<h2>Opciones de los scripts</h2>" +
			'<div class="box"><label class="check"><input type="checkbox" data-opt="tempoSync"' + (o.tempoSync ? " checked" : "") + "> Parpadeos y pulsos al BPM de Resolume</label>" +
			'<div class="hint">Chataigne lee el tempo de Resolume y manda reloj MIDI al APC.</div></div>' +
			'<div class="box"><div class="row">' + field("Sondeo de estados (veces/s)", '<input type="number" data-opt="pollHz" data-t="num" step="0.5" min="0.5" value="' + o.pollHz + '">') +
			field("Repintar todo cada (sondeos)", '<input type="number" data-opt="repaintEvery" data-t="int" min="1" value="' + o.repaintEvery + '">') + "</div>" +
			'<div class="hint">Por si se pierde algún mensaje: cada segundo se pregunta el estado de los clips y cada 5 se repinta todo.</div></div>' +
			'<div class="box">' + field("Consulta de R/G/B (veces/s)", '<input type="number" data-opt="rgbHz" data-t="num" step="1" min="1" value="' + o.rgbHz + '">') + "</div>" +
			'<div class="box">' + field("Velocidad de clip (faders «Velocidad»)", '<select data-opt="speedMethod">' + opts([["put", "PUT por la API web (recomendado, sin ids)"], ["websocket", "WebSocket con el id del parámetro (método antiguo)"]], o.speedMethod) + "</select>",
				"PUT necesita solo el módulo HTTP. WebSocket necesita además el módulo <code>resolumews</code>.") + "</div>" +
			'<div class="box"><label class="check"><input type="checkbox" data-opt="autoReload"' + (o.autoReload ? " checked" : "") + "> Recargar el mapa solo al cambiar apc_config.json</label>" +
			'<div class="hint">Los scripts miran el archivo cada 2 s. Si lo desactivas, usa el botón «Recargar mapa» del script en Chataigne.</div></div>' +
			'<div class="box"><label class="check"><input type="checkbox" data-opt="debug"' + (o.debug ? " checked" : "") + "> Mensajes de depuración en el Logger de Chataigne</label></div>";
		$("tab-opt").querySelectorAll("[data-opt]").forEach((inp) => {
			inp.onchange = () => commit(() => {
				const k = inp.dataset.opt;
				cfg.options[k] = inp.type == "checkbox" ? inp.checked : inp.dataset.t == "num" ? parseFloat(inp.value) : inp.dataset.t == "int" ? parseInt(inp.value, 10) : inp.value;
			});
		});
	}

	// ---------- pestaña Exportar ----------

	function renderExport() {
		const errs = G.validateConfig(cfg, comp).filter((w) => w.level == "error");
		const lib = store.get("library", {});
		const names = Object.keys(lib).sort();
		$("tab-exp").innerHTML = "<h2>Exportar para Chataigne</h2>" +
			(errs.length ? '<p class="err">Hay ' + errs.length + " errores en el mapa (lista bajo el APC). Puedes exportar, pero revísalos.</p>" : '<p class="ok">✔ El mapa no tiene errores.</p>') +
			'<div class="box"><label class="check"><input type="checkbox" checked disabled> <span><code>apc_config.json</code> · el mapa</span></label>' +
			'<label class="check"><input type="checkbox" id="expScripts"' + (exportOpts.scripts ? " checked" : "") + "> <span>Los 3 scripts <code>.js</code></span></label>" +
			'<label class="check"><input type="checkbox" id="expNoisette"' + (exportOpts.noisette ? " checked" : "") + "> <span><code>APC_Resolume.noisette</code> (proyecto de Chataigne)</span></label>" +
			'<div id="noiFolder" style="margin-top:8px;' + (exportOpts.noisette ? "" : "display:none") + '">' + field("Carpeta de los scripts en tu PC", '<input type="text" id="expFolder" value="' + esc(folder) + '">', "El .noisette guarda la ruta completa de cada script.") + "</div>" +
			'<p class="hint">Los scripts solo hacen falta la primera vez (o al actualizar el configurador). Después, para cambiar el mapa basta con <code>apc_config.json</code>: Chataigne lo recarga solo en 2 segundos.</p></div>' +
			'<div class="row"><button class="primary" id="btnToFolder">Guardar en la carpeta…</button><button id="btnZip">Descargar ZIP</button></div>' +
			'<div class="row" style="margin-top:8px"><button id="btnJsonOnly">Descargar solo apc_config.json</button></div>' +
			(dirHandle ? '<p class="hint">Carpeta elegida: <strong>' + esc(dirHandle.name) + "</strong>. Ctrl+S vuelve a guardar ahí.</p>" : "") +
			'<p class="hint">«Guardar en la carpeta» funciona en Chrome y Edge. Si ya hay archivos tuyos, se guarda una copia <code>.bak</code> antes de reemplazarlos.</p>' +
			"<h3>Mapas guardados en este navegador</h3>" +
			'<div class="row"><select id="libSel">' + (names.length ? opts(names.map((n) => [n, n]), cfg.name) : '<option value="">(ninguno)</option>') + "</select></div>" +
			'<div class="row" style="margin-top:6px"><button id="libSave">Guardar «' + esc(cfg.name) + '»</button><button id="libLoad"' + (names.length ? "" : " disabled") + '>Cargar</button><button id="libDel"' + (names.length ? "" : " disabled") + ">Borrar</button></div>" +
			'<p class="hint">Útil para tener un mapa por club o evento. Para pasarlos a otro PC usa «Guardar mapa» (archivo .json).</p>' +
			'<h3>Empezar de cero</h3><div class="row"><button id="btnDefault">Cargar el mapa de Deseo54</button><button id="btnBlank">Mapa vacío</button></div>';
		$("expScripts").onchange = (e) => { exportOpts.scripts = e.target.checked; store.set("exportOpts", exportOpts); };
		$("expNoisette").onchange = (e) => { exportOpts.noisette = e.target.checked; store.set("exportOpts", exportOpts); $("noiFolder").style.display = e.target.checked ? "" : "none"; };
		$("expFolder").onchange = (e) => { folder = e.target.value.trim(); store.set("folder", folder); };
		$("btnToFolder").onclick = exportToFolder;
		$("btnZip").onclick = () => {
			const files = buildFiles();
			download(slug(cfg.name) + "-chataigne.zip", new Blob([G.makeZip(files)], { type: "application/zip" }));
		};
		$("btnJsonOnly").onclick = () => download("apc_config.json", new Blob([G.configJSON(cfg)], { type: "application/json" }));
		$("libSave").onclick = () => { const l = store.get("library", {}); l[cfg.name] = cfg; store.set("library", l); toast("Guardado en el navegador: " + cfg.name); renderExport(); };
		$("libLoad").onclick = () => { const n = $("libSel").value; if (n && lib[n]) { commit(() => { cfg = clone(lib[n]); }); toast("Cargado: " + n); } };
		$("libDel").onclick = () => { const n = $("libSel").value; if (n && confirm("¿Borrar «" + n + "» del navegador?")) { const l = store.get("library", {}); delete l[n]; store.set("library", l); renderExport(); } };
		$("btnDefault").onclick = () => { if (confirm("¿Reemplazar el mapa actual por el de Deseo54? (Ctrl+Z para deshacer)")) commit(() => { cfg = clone(DATA.defaultConfig); }); };
		$("btnBlank").onclick = () => { if (confirm("¿Empezar con un mapa vacío? (Ctrl+Z para deshacer)")) commit(() => { cfg = { name: "Mapa nuevo", layers: clone(cfg.layers) }; }); };
	}

	function buildFiles() {
		return G.buildFiles(cfg, DATA.scripts, DATA.noisette, { scripts: exportOpts.scripts, noisette: exportOpts.noisette, folder: folder });
	}
	function slug(s) { return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "mapa"; }
	function download(name, blob) {
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = name;
		document.body.appendChild(a);
		a.click();
		setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
	}

	async function exportToFolder(again) {
		if (!window.showDirectoryPicker) { toast("Este navegador no puede guardar en carpetas. Usa «Descargar ZIP» o abre el configurador con Chrome o Edge.", true); return; }
		try {
			if (!dirHandle || again !== true) dirHandle = await window.showDirectoryPicker({ id: "chataigne", mode: "readwrite" });
			const files = buildFiles();
			const backups = [];
			for (const f of files) {
				let old = null;
				try { old = await (await (await dirHandle.getFileHandle(f.name)).getFile()).text(); } catch (e) { /* no existe */ }
				// copia de seguridad de lo que no generó el configurador (o del .noisette, que puede tener cambios hechos a mano)
				if (old != null && old != f.text && (f.name.endsWith(".noisette") || (f.name.endsWith(".js") && old.indexOf("Generado por el configurador") < 0))) {
					await writeFile(f.name + ".bak", old);
					backups.push(f.name + ".bak");
				}
				await writeFile(f.name, f.text);
			}
			toast("Guardado en «" + dirHandle.name + "»: " + files.map((f) => f.name).join(", ") + (backups.length ? ". Copias: " + backups.join(", ") : ""));
			renderExport();
		} catch (e) {
			if (e && e.name == "AbortError") return;
			toast("No se pudo guardar: " + (e && e.message), true);
		}
	}
	async function writeFile(name, text) {
		const fh = await dirHandle.getFileHandle(name, { create: true });
		const w = await fh.createWritable();
		await w.write(text);
		await w.close();
	}

	// ---------- avisos y ayuda ----------

	function renderWarnings() {
		const list = G.validateConfig(cfg, comp);
		const el = $("warnings");
		if (!list.length) { el.innerHTML = '<p class="ok">✔ Sin errores en el mapa' + (comp ? " y todo coincide con la composición de Resolume." : ".") + "</p>"; return; }
		el.innerHTML = "<h3>Revisar (" + list.length + ")</h3>" + list.map((w, n) =>
			'<div class="item"><span class="' + (w.level == "error" ? "err" : "warn") + '">' + (w.level == "error" ? "✖" : "⚠") + '</span><span class="msg">' + esc(w.msg) + '</span><button class="small" data-warn="' + n + '">Ir</button></div>').join("");
		el.querySelectorAll("[data-warn]").forEach((b) => { b.onclick = () => selectRef(list[+b.dataset.warn].ref); });
	}

	function renderHelp() {
		$("tab-help").innerHTML = "<h2>Cómo funciona</h2>" +
			'<p>El APC no habla con Resolume: habla con <strong>Chataigne</strong>, que pasa el MIDI a OSC y enciende los LEDs según lo que contesta Resolume. Este configurador genera el mapa (<code>apc_config.json</code>) y los scripts que lo leen.</p>' +
			"<h3>Primera vez</h3><ol>" +
			"<li>Exportar → marca los 3 scripts → «Guardar en la carpeta…» → elige la carpeta donde Chataigne tiene los scripts.</li>" +
			"<li>En Chataigne, en cada módulo (<code>apc</code>, <code>resolume</code>, <code>resolumeapi</code>), pulsa <strong>Reload</strong> en su script.</li>" +
			"<li>En el Logger de Chataigne debe salir «Mapa cargado».</li></ol>" +
			"<h3>Cambiar el mapa</h3><ol><li>Edita aquí.</li><li>Exportar → «Guardar en la carpeta» (o Ctrl+S). Basta con <code>apc_config.json</code>.</li><li>Chataigne lo recarga solo en 2 s.</li></ol>" +
			"<h3>Atajos</h3><ul><li>Ctrl+Z / Ctrl+Y: deshacer / rehacer</li><li>Ctrl+S: guardar otra vez en la carpeta elegida</li><li>Ctrl/Mayús + clic: elegir varios controles</li><li>Esc: quitar la selección</li></ul>" +
			"<h3>Resolume</h3><ul><li>Entrada OSC en el puerto 7000, salida OSC a 127.0.0.1:7001.</li><li>Webserver activado en el puerto 8080.</li>" +
			"<li>El APC desactivado en Preferencias → MIDI (ni entrada, ni salida, ni superficie de control).</li></ul>" +
			'<p class="dim">Más detalles en el README del repositorio.</p>';
	}

	// ---------- general ----------

	function showTab(name) {
		document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab == name));
		document.querySelectorAll(".tabpane").forEach((p) => p.classList.toggle("on", p.id == "tab-" + name));
	}

	function renderAll() {
		$("mapName").value = cfg.name;
		if (document.body.dataset.mode != "remote") {
			$("btnUndo").disabled = !history.length;
			$("btnRedo").disabled = !future.length;
		}
		document.querySelectorAll("#previewSeg button").forEach((b) => b.classList.toggle("on", b.dataset.mode == previewMode));
		sel.idx = sel.idx.filter((i) => sel.kind == "shift" ? i == 0 : i < (sel.kind == "pad" ? 64 : sel.kind == "fader" ? 9 : 8));
		renderDevice();
		renderInspector();
		renderResolume();
		renderTargets();
		renderLinks();
		renderDevBar();
		renderOptions();
		renderExport();
		renderWarnings();
	}

	function openMapFile(file) {
		const r = new FileReader();
		r.onload = () => {
			try {
				const j = JSON.parse(r.result);
				if (j.layers && !j.pads && Array.isArray(j.layers)) { setComposition(j); return; }
				if (!j.pads) throw new Error("Ese archivo no es un mapa del configurador");
				commit(() => { cfg = j; });
				toast("Mapa abierto: " + cfg.name);
			} catch (e) { toast("No se pudo abrir: " + e.message, true); }
		};
		r.readAsText(file);
	}

	function init() {
		// lista de direcciones OSC típicas para los campos de dirección
		const dl = document.createElement("datalist");
		dl.id = "oscList";
		dl.innerHTML = OSC_SUGGESTIONS.map((a) => '<option value="' + a + '">').join("");
		document.body.appendChild(dl);

		// pestaña Destinos (entre Resolume y Opciones)
		const tabBtn = document.createElement("button");
		tabBtn.dataset.tab = "dst";
		tabBtn.textContent = "Destinos";
		$("tabs").insertBefore(tabBtn, $("tabs").querySelector('[data-tab="opt"]'));
		const pane = document.createElement("div");
		pane.className = "tabpane";
		pane.id = "tab-dst";
		$("tab-opt").parentNode.insertBefore(pane, $("tab-opt"));

		$("bpm").value = bpm;
		$("bpm").onchange = (e) => { bpm = parseFloat(e.target.value) || 128; store.set("bpm", bpm); updateShowTimer(); renderDevice(); renderInspector(); };
		$("previewSeg").onclick = (e) => {
			const b = e.target.closest("[data-mode]");
			if (!b) return;
			previewMode = b.dataset.mode;
			store.set("preview", previewMode);
			document.querySelectorAll("#previewSeg button").forEach((x) => x.classList.toggle("on", x == b));
			updateShowTimer();
			renderDevice();
		};
		$("tabs").onclick = (e) => { const b = e.target.closest("[data-tab]"); if (b) showTab(b.dataset.tab); };
		$("device").onclick = onDeviceClick;
		$("tab-ctl").addEventListener("change", onInspectorChange);
		$("tab-ctl").addEventListener("click", onInspectorClick);
		$("mapName").onchange = (e) => commit(() => { cfg.name = e.target.value.trim() || "Sin nombre"; });
		$("btnOpen").onclick = () => $("fileOpen").click();
		$("fileOpen").onchange = (e) => { if (e.target.files[0]) openMapFile(e.target.files[0]); e.target.value = ""; };
		$("fileComp").onchange = (e) => {
			const f = e.target.files[0];
			if (!f) return;
			const r = new FileReader();
			r.onload = () => { try { setComposition(JSON.parse(r.result)); } catch (err) { toast("Ese archivo no es JSON: " + err.message, true); } };
			r.readAsText(f);
			e.target.value = "";
		};
		$("btnSave").onclick = () => download(slug(cfg.name) + ".json", new Blob([G.configJSON(cfg)], { type: "application/json" }));
		$("btnUndo").onclick = undo;
		$("btnRedo").onclick = redo;
		$("btnExport").onclick = () => showTab("exp");
		document.addEventListener("keydown", (e) => {
			if (document.body.dataset.mode == "remote") return;
			const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName);
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() == "z" && !typing) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
			else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() == "y" && !typing) { e.preventDefault(); redo(); }
			else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() == "s") {
				e.preventDefault();
				if (dirHandle) exportToFolder(true); else download(slug(cfg.name) + ".json", new Blob([G.configJSON(cfg)], { type: "application/json" }));
			}
			else if (e.key == "Escape" && !typing && !$("tplDialog").open) { sel.idx = []; renderDevice(); renderInspector(); }
		});
		renderHelp();
		renderAll();
		updateShowTimer();
		setupModes();
	}

	// ---------- modo APC / Resolume Remote ----------

	let appMode = "apc";
	function setupModes() {
		window.APCApp = {
			getConfig: () => cfg,
			getComposition: () => comp,
			setComposition: setComposition,
			openCompositionFile: () => $("fileComp").click(),
			toast: toast,
			download: download,
			setRemoteToolbar: (st) => {
				if (appMode != "remote") return;
				$("btnUndo").disabled = !st.undo;
				$("btnRedo").disabled = !st.redo;
			}
		};
		window.RemoteBuilder.init();
		$("modeSeg").onclick = (e) => { const b = e.target.closest("[data-mode]"); if (b) setAppMode(b.dataset.mode); };
		$("btnUndo").onclick = () => (appMode == "remote" ? window.RemoteBuilder.undo() : undo());
		$("btnRedo").onclick = () => (appMode == "remote" ? window.RemoteBuilder.redo() : redo());
		$("btnExport").onclick = () => (appMode == "remote" ? window.RemoteBuilder.exportDialog() : showTab("exp"));
		setAppMode(store.get("appMode", "apc"));
	}
	function setAppMode(m) {
		appMode = m == "remote" ? "remote" : "apc";
		store.set("appMode", appMode);
		document.body.dataset.mode = appMode;
		document.querySelectorAll("#modeSeg button").forEach((b) => b.classList.toggle("on", b.dataset.mode == appMode));
		$("apcMain").hidden = appMode != "apc";
		$("remoteMode").hidden = appMode != "remote";
		document.querySelectorAll(".apc-only").forEach((x) => { x.hidden = appMode != "apc"; });
		$("btnExport").textContent = appMode == "remote" ? "Exportar remote" : "Exportar para Chataigne";
		if (appMode == "remote") window.RemoteBuilder.show();
		else { window.RemoteBuilder.hide(); renderAll(); }
	}

	init();
})();
