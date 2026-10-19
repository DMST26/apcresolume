// Catálogo de parámetros de Resolume para el constructor de remotes.
//
// La composición de Resolume (GET /api/v1/composition o el primer mensaje del WebSocket) es un
// árbol donde cada parámetro es un objeto {id, valuetype, value, ...}. Aquí se recorre ese árbol
// y se da a cada parámetro una RUTA ESTABLE, que es lo que guarda el remote:
//
//   /composition/master
//   /composition/layers/2/video/opacity
//   /composition/layers/1/clips/3/transport/controls/speed
//   /composition/layers/1/video/effects/blur/params/amount      (efectos por nombre, no por posición)
//
// Los ids cambian cada vez que se abre Resolume, así que el remote vuelve a buscar el id de cada
// ruta al conectarse (resolve). Además de parámetros hay ACCIONES (lanzar clip, columna, vaciar
// capa...), que se mandan con "trigger" sobre /composition/<cosa>/by-id/<id>/<acción>.
//
// Se usa en el navegador (window.RemoteCatalog) y en Node (pruebas).
(function (C) {
	"use strict";

	// ---------- nombres en español ----------

	C.LABELS = {
		master: "Master", opacity: "Opacidad", bypassed: "Bypass", solo: "Solo", speed: "Velocidad",
		volume: "Volumen", pan: "Panorama", tempo: "BPM", tempo_tap: "Tap tempo", resync: "Resync",
		tempo_pull: "Tempo −", tempo_push: "Tempo +", play_state: "Reproducción", phase: "Crossfader",
		behaviour: "Comportamiento", curve: "Curva", sidea: "Lado A", sideb: "Lado B", selected: "Seleccionado",
		connected: "Estado", name: "Nombre", description: "Descripción", colorid: "Color de etiqueta",
		crossfadergroup: "Grupo del crossfader", maskmode: "Modo máscara", ignorecolumntrigger: "Ignorar columnas",
		faderstart: "Fader start", duration: "Duración", blend_mode: "Mezcla de la transición", target: "Destino",
		triggerstyle: "Estilo de disparo", beatsnap: "Beat snap", transporttype: "Tipo de transporte",
		position: "Posición", playdirection: "Dirección", playmode: "Modo de reproducción",
		playmodeaway: "Al salir", r: "Canal R", g: "Canal G", b: "Canal B", a: "Canal alfa", width: "Ancho",
		height: "Alto", autosize: "Autoajuste", resize: "Ajuste", framerate: "Fotogramas por segundo",
		highdetail: "16 bits", cliptarget: "Destino de clips", cliptriggerstyle: "Estilo de disparo de clips",
		clipbeatsnap: "Beat snap de clips", loop: "Bucle", beats: "Beats", seconds: "Segundos",
		loop_count: "Repeticiones", random_type: "Aleatorio", compensate_transition: "Compensar transición",
		duration_type: "Tipo de duración", layer_determined: "Transición de la capa", scrollx: "Scroll",
		clipconnected: "Clips conectados", closed: "Cerrado", mixer: "Mezcla", "Blend Mode": "Modo de fusión"
	};
	// Explicaciones cortas para el asistente
	C.HELP = {
		master: "Fader master: escala la opacidad de todo lo que hay debajo.",
		opacity: "Opacidad de 0 a 1.",
		bypassed: "Apaga la capa o la composición sin perder lo que suena.",
		solo: "Solo esta capa: las demás se ocultan.",
		speed: "Velocidad de reproducción (1 = normal).",
		tempo: "Tempo de la composición en BPM.",
		tempo_tap: "Toca al ritmo para fijar el BPM.",
		resync: "Vuelve a poner el tiempo 1 del compás ahora.",
		phase: "Posición del crossfader entre el lado A y el B.",
		connected: "Estado del clip: vacío, desconectado, en preview o sonando.",
		position: "Posición de reproducción del clip.",
		playdirection: "Hacia delante, hacia atrás, pausa…",
		blend_mode: "Cómo se mezcla con lo de debajo.",
		duration: "Duración de la transición entre clips."
	};
	// Parámetros que casi nunca se quieren en un remote (se ven con «mostrar avanzados»)
	C.ADVANCED = ["name", "description", "colorid", "scrollx", "width", "height", "framerate", "highdetail",
		"autosize", "resize", "selected", "closed", "faderstart", "ignorecolumntrigger", "target", "triggerstyle",
		"cliptarget", "cliptriggerstyle", "transporttype", "layer_determined"];

	C.label = function (key) {
		if (C.LABELS[key]) return C.LABELS[key];
		var s = String(key).replace(/_/g, " ");
		return s.charAt(0).toUpperCase() + s.slice(1);
	};

	function isParam(o) { return o && typeof o == "object" && typeof o.valuetype == "string" && o.id !== undefined; }
	function val(p) { return p && typeof p == "object" && "value" in p ? p.value : p; }
	// en la ruta solo hace falta escapar "/" y "%" (los nombres de parámetros pueden llevar espacios, #…)
	function seg(s) { return String(s).replace(/%/g, "%25").replace(/\//g, "%2F"); }
	function unseg(s) { return String(s).replace(/%2F/gi, "/").replace(/%25/g, "%"); }

	// Nombre de un efecto dentro de la ruta: su nombre interno o, si hay dos iguales, nombre#2
	function effectKeys(effects) {
		var seen = {};
		return (effects || []).map(function (e) {
			var base = String(e.name || e.display_name || "efecto").toLowerCase();
			seen[base] = (seen[base] || 0) + 1;
			return seen[base] > 1 ? base + "#" + seen[base] : base;
		});
	}

	// ---------- recorrer la composición ----------

	// Devuelve una lista plana de entradas:
	//   {path, key, label, group, valuetype, min, max, options, advanced, kind: "param"|"action", action}
	C.walk = function (comp) {
		var out = [];
		if (!comp) return out;

		function addParam(p, path, key, group) {
			var e = {
				kind: "param", path: path, key: key, label: C.label(key), group: group, valuetype: p.valuetype,
				advanced: C.ADVANCED.indexOf(key) >= 0
			};
			if (p.min !== undefined) e.min = p.min;
			if (p.max !== undefined) e.max = p.max;
			if (Array.isArray(p.options)) e.options = p.options.slice();
			if (p.view && p.view.display_units) e.units = p.view.display_units;
			out.push(e);
		}
		function addAction(path, label, group, action) {
			out.push({ kind: "action", path: path, label: label, group: group, valuetype: "Action", action: action });
		}

		// recorre un objeto con parámetros; `skip` = claves que se tratan aparte
		function scan(obj, path, group, skip) {
			if (!obj || typeof obj != "object") return;
			Object.keys(obj).forEach(function (k) {
				if (skip && skip.indexOf(k) >= 0) return;
				var v = obj[k], p = path + "/" + seg(k);
				if (isParam(v)) { addParam(v, p, k, group); return; }
				if (k == "effects" && Array.isArray(v)) { scanEffects(v, p, group); return; }
				if (Array.isArray(v) || !v || typeof v != "object") return;
				if (k == "thumbnail" || k == "fileinfo" || k == "view") return;
				var sub = group;
				if (k == "audio") sub = group + " › Audio";
				if (k == "transition") sub = group + " › Transición";
				if (k == "autopilot") sub = group + " › Autopilot";
				if (k == "transport") sub = group + " › Transporte";
				if (k == "dashboard") sub = group + " › Dashboard";
				scan(v, p, sub);
			});
		}
		function scanEffects(effects, path, group) {
			var keys = effectKeys(effects);
			effects.forEach(function (fx, i) {
				var g = group + " › Efecto " + (fx.display_name || fx.name || i + 1);
				var p = path + "/" + seg(keys[i]);
				if (isParam(fx.bypassed)) addParam(fx.bypassed, p + "/bypassed", "bypassed", g);
				if (fx.params) scan(fx.params, p + "/params", g);
				if (fx.mixer) scan(fx.mixer, p + "/mixer", g);
			});
		}

		var top = "/composition";
		scan(comp, top, "Composición", ["layers", "columns", "decks", "layergroups", "tempocontroller", "crossfader", "audio", "video"]);
		addAction(top + "/disconnect-all", "Limpiar todo (desconectar todo)", "Composición", "disconnect-all");
		if (comp.video) scan(comp.video, top + "/video", "Composición › Vídeo");
		if (comp.audio) scan(comp.audio, top + "/audio", "Composición › Audio");
		if (comp.tempocontroller) scan(comp.tempocontroller, top + "/tempocontroller", "Tempo");
		if (comp.crossfader) scan(comp.crossfader, top + "/crossfader", "Crossfader");

		(comp.decks || []).forEach(function (d, i) {
			var g = "Deck " + (i + 1) + (val(d.name) ? " · " + val(d.name) : "");
			addAction(top + "/decks/" + (i + 1) + "/select", "Abrir este deck", g, "select");
		});
		(comp.columns || []).forEach(function (c, i) {
			var g = "Columna " + (i + 1) + (val(c.name) ? " · " + val(c.name) : "");
			addAction(top + "/columns/" + (i + 1) + "/connect", "Lanzar columna", g, "connect");
			scan(c, top + "/columns/" + (i + 1), g);
		});
		(comp.layergroups || []).forEach(function (lg, i) {
			var g = "Grupo " + (i + 1) + (val(lg.name) ? " · " + val(lg.name) : "");
			addAction(top + "/layergroups/" + (i + 1) + "/clear", "Vaciar grupo", g, "clear");
			scan(lg, top + "/layergroups/" + (i + 1), g, ["layers", "columns"]);
		});
		(comp.layers || []).forEach(function (l, i) {
			var lp = top + "/layers/" + (i + 1);
			var g = "Capa " + (i + 1) + (val(l.name) ? " · " + val(l.name) : "");
			addAction(lp + "/clear", "Vaciar capa", g, "clear");
			addAction(lp + "/select", "Seleccionar capa", g, "select");
			scan(l, lp, g, ["clips", "active_clip"]);
			(l.clips || []).forEach(function (cl, j) {
				var empty = val(cl.connected) == "Empty";
				var cg = g + " › Clip " + (j + 1) + (empty ? " (vacío)" : val(cl.name) ? " · " + val(cl.name) : "");
				var cp = lp + "/clips/" + (j + 1);
				addAction(cp + "/connect", "Lanzar clip", cg, "connect");
				addAction(cp + "/select", "Seleccionar clip", cg, "select");
				if (!empty) scan(cl, cp, cg);
				else if (isParam(cl.connected)) addParam(cl.connected, cp + "/connected", "connected", cg);
			});
		});
		return out;
	};

	// ---------- de ruta a parámetro ----------

	// Busca en la composición lo que nombra una ruta. Devuelve:
	//   {kind: "param", param}                    para parámetros
	//   {kind: "action", trigger: "/composition/clips/by-id/123/connect", target: objeto}  para acciones
	//   null si ya no existe (por ejemplo, se borró la capa)
	C.resolve = function (comp, path) {
		if (!comp || !path) return null;
		var parts = String(path).split("/").filter(Boolean).map(unseg);
		if (parts[0] != "composition") return null;
		var node = comp, i = 1, owner = null, ownerKind = "";
		var LISTS = { layers: "layers", clips: "clips", columns: "columns", decks: "decks", layergroups: "layergroups" };
		var ACTIONS = ["connect", "select", "clear", "disconnect-all"];
		for (; i < parts.length; i++) {
			var k = parts[i];
			if (i == parts.length - 1 && ACTIONS.indexOf(k) >= 0 && (k != "connect" || !isParam(node[k]))) {
				if (k == "disconnect-all") return { kind: "action", trigger: "/composition/disconnect-all", target: comp };
				if (!owner || owner.id === undefined) return null;
				return { kind: "action", trigger: "/composition/" + ownerKind + "/by-id/" + owner.id + "/" + k, target: owner };
			}
			if (LISTS[k] && Array.isArray(node[k])) {
				var n = parseInt(parts[i + 1], 10);
				var item = node[k][n - 1];
				if (!item) return null;
				owner = item; ownerKind = k;
				node = item; i++;
				continue;
			}
			if (k == "effects" && Array.isArray(node[k])) {
				var keys = effectKeys(node[k]), want = String(parts[i + 1]).toLowerCase(), idx = keys.indexOf(want);
				if (idx < 0 && /^\d+$/.test(want)) idx = parseInt(want, 10) - 1;
				if (idx < 0 || !node[k][idx]) return null;
				node = node[k][idx]; i++;
				continue;
			}
			if (!node || typeof node != "object" || !(k in node)) return null;
			node = node[k];
		}
		return isParam(node) ? { kind: "param", param: node } : null;
	};

	// Entrada del catálogo para una ruta (o null)
	C.find = function (entries, path) {
		for (var i = 0; i < entries.length; i++) if (entries[i].path == path) return entries[i];
		return null;
	};

	// ---------- composición de ejemplo (sin Resolume) ----------

	// Composición con la estructura de Resolume y valores típicos, para diseñar el remote sin
	// tener Resolume delante. layers = [{name, clips: ["nombre", "", ...]}]
	C.skeleton = function (opts) {
		opts = opts || {};
		var id = 1000;
		function P(type, value, extra) {
			var p = { id: ++id, valuetype: type, value: value };
			for (var k in extra || {}) p[k] = extra[k];
			return p;
		}
		function R(v, min, max) { return P("ParamRange", v, { min: min, max: max }); }
		function B(v) { return P("ParamBoolean", !!v); }
		function E() { return { id: ++id, valuetype: "ParamEvent" }; }
		function CH(options, i) { return P("ParamChoice", options[i || 0], { index: i || 0, options: options }); }
		function S(v) { return P("ParamString", v); }
		var CONN = ["Empty", "Disconnected", "Previewing", "Connected", "Connected & previewing"];
		var BLEND = ["Add", "Alpha", "Difference", "Lighten", "Multiply", "Screen"];
		var nCols = opts.columns || 0;
		var layers = (opts.layers || [{ name: "Capa 1", clips: [] }]).map(function (L) {
			var clips = (L.clips || []).map(function (name) {
				var empty = !name;
				var c = { id: ++id, name: S(name || ""), selected: B(false), connected: CH(CONN, empty ? 0 : 1) };
				if (!empty) {
					c.video = { opacity: R(1, 0, 1), r: B(true), g: B(true), b: B(true), a: B(true), effects: [] };
					c.transport = {
						position: R(0, 0, 1),
						controls: { playdirection: CH(["<", "||", ">"], 2), playmode: CH(["Loop", "Bounce", "Random", "Play once"], 0), speed: R(1, 0, 10) }
					};
					c.beatsnap = CH(["None", "8 Bars", "4 Bars", "2 Bars", "1 Bar", "1/2 Bar", "1/4 Bar"], 0);
				}
				nCols = Math.max(nCols, (L.clips || []).length);
				return c;
			});
			return {
				id: ++id, name: S(L.name || ""), selected: B(false), bypassed: B(false), solo: B(false), master: R(1, 0, 1),
				crossfadergroup: CH(["None", "A", "B"], 0),
				video: { opacity: R(1, 0, 1), effects: [], mixer: { "Blend Mode": CH(BLEND, 1) } },
				audio: { volume: R(0, -60, 6), pan: R(0, -1, 1) },
				transition: { duration: R(0, 0, 10), blend_mode: CH(BLEND, 1) },
				clips: clips
			};
		});
		var columns = [];
		for (var c = 0; c < nCols; c++) columns.push({ id: ++id, name: S("Column " + (c + 1)), connected: CH(["Empty", "Disconnected", "Previewing", "Connected"], 1) });
		return {
			name: S(opts.name || "Composición de ejemplo"),
			master: R(1, 0, 1), speed: R(1, 0, 10), bypassed: B(false),
			video: { opacity: R(1, 0, 1), effects: [] },
			audio: { volume: R(0, -60, 6), pan: R(0, -1, 1) },
			tempocontroller: { tempo: R(128, 20, 500), tempo_tap: E(), resync: E(), tempo_pull: E(), tempo_push: E() },
			crossfader: { id: ++id, phase: R(0, -1, 1), sidea: E(), sideb: E(), curve: CH(["Linear", "S-curve"], 0) },
			decks: [{ id: ++id, name: S("Deck 1"), selected: B(true) }],
			columns: columns,
			layers: layers,
			layergroups: []
		};
	};

})(typeof module != "undefined" && module.exports ? module.exports : (window.RemoteCatalog = {}));
