// Generador compartido por configurador.html (navegador) y build.js (Node):
// normaliza y valida el mapa, genera los scripts de Chataigne, el .noisette y el ZIP.
(function (G) {
	"use strict";

	G.PAD_TYPES = ["none", "clip", "dual", "osc", "midi", "rgb", "tap", "resync", "bypass", "blackout", "clear", "clearAll", "prev", "next", "refresh"];
	G.BUTTON_TYPES = ["none", "bypass", "clear", "blackout", "clearAll", "prev", "next", "refresh", "tap", "resync", "osc", "midi"];
	G.FADER_TYPES = ["none", "layerOpacity", "layerMaster", "compMaster", "compOpacity", "osc", "midiCC", "clipSpeed"];
	G.MAX_EXTRA = 4;
	// nombres de módulo que ya usa el puente y no pueden ser destinos nuevos
	G.RESERVED_TARGETS = ["apc", "resolume", "resolumeapi", "resolumews"];
	G.MAX_DEVICES = 4; // APC en total (el principal + 3)
	G.CONFIG_MARKER = "var EMBEDDED_CONFIG = null; // @@CONFIG@@";
	G.SCRIPT_NAMES = ["apc_to_resolume.js", "resolume_to_apc.js", "resolume_api.js", "destino_a_apc.js"];

	function int(v, def, min, max) {
		var n = parseInt(v, 10);
		if (isNaN(n)) n = def;
		if (min !== undefined && n < min) n = min;
		if (max !== undefined && n > max) n = max;
		return n;
	}
	function num(v, def) {
		var n = parseFloat(v);
		return isNaN(n) ? def : n;
	}
	function layerList(v, fallback) {
		var arr = Array.isArray(v) ? v : String(v === undefined ? "" : v).split(",");
		var out = [];
		arr.forEach(function (x) { var n = parseInt(x, 10); if (n > 0 && out.indexOf(n) < 0) out.push(n); });
		if (!out.length && fallback) out.push(fallback);
		return out;
	}
	G.layerList = layerList;

	function normPadLed(led) {
		led = led || {};
		return { empty: int(led.empty, 0, 0, 16), loaded: int(led.loaded, 0, 0, 16), active: int(led.active, 0, 0, 16) };
	}
	function normButtonLed(led) {
		led = led || {};
		return { idle: int(led.idle, 0, 0, 2), active: int(led.active, 1, 0, 2) };
	}

	// Deja cada control con todos los campos que leen los scripts (y solo esos).
	function normControl(d, isPad) {
		d = d || {};
		var types = isPad ? G.PAD_TYPES : G.BUTTON_TYPES;
		var t = types.indexOf(d.type) >= 0 ? d.type : "none";
		var o = { type: t, label: String(d.label || "") };
		if (t == "clip" || t == "dual") {
			o.layer = int(d.layer, 1, 1); o.clip = int(d.clip, 1, 1); o.name = String(d.name || "");
		}
		if (t == "dual") {
			o.layer2 = int(d.layer2, 1, 1); o.clip2 = int(d.clip2, 1, 1); o.name2 = String(d.name2 || "");
		}
		if (t == "rgb") o.rgb = ["r", "g", "b"].indexOf(d.rgb) >= 0 ? d.rgb : "r";
		if (t == "osc" || t == "midi") copyAction(o, d, t);
		if (d.extra && d.extra.length) {
			o.extra = [];
			d.extra.slice(0, G.MAX_EXTRA).forEach(function (a) {
				var x = { type: a.type == "midi" ? "midi" : "osc" };
				copyAction(x, a, x.type);
				o.extra.push(x);
			});
		}
		if (t == "bypass" || t == "clear") o.layers = layerList(d.layers, 1);
		if (t == "prev" || t == "next") o.layer = int(d.layer, 1, 1);
		if (isPad) {
			o.color = int(d.color, 0, 0, 127);
			o.led = normPadLed(d.led);
		} else {
			o.led = normButtonLed(d.led);
		}
		return o;
	}

	// Campos de una acción OSC o MIDI (la principal de un control o una extra).
	function copyAction(o, d, t) {
		o.target = String(d.target || (t == "osc" ? "resolume" : ""));
		o.mode = ["pulse", "hold", "toggle"].indexOf(d.mode) >= 0 ? d.mode : "pulse";
		if (t == "osc") {
			o.address = String(d.address || "/");
			o.value = num(d.value, 1);
		} else {
			o.msg = ["note", "cc", "pc"].indexOf(d.msg) >= 0 ? d.msg : "note";
			o.channel = int(d.channel, 1, 1, 16);
			o.number = int(d.number, 0, 0, 127);
			o.value = int(d.value, 127, 0, 127);
			// el LED del control sigue lo que devuelve el programa por esa misma nota o CC
			if (d.feedback) o.feedback = true;
		}
	}

	function cleanId(s) {
		return String(s || "").toLowerCase().split("").filter(function (ch) { return /[a-z0-9]/.test(ch); }).join("");
	}

	// Mapa de un APC (pads, botones, shift y faders) dentro de `out`
	function normDevice(c, out) {
		var i;
		out.pads = []; out.bottom = []; out.side = []; out.faders = [];
		for (i = 0; i < 64; i++) out.pads.push(normControl(c.pads && c.pads[i], true));
		for (i = 0; i < 8; i++) out.bottom.push(normControl(c.bottom && c.bottom[i], false));
		for (i = 0; i < 8; i++) out.side.push(normControl(c.side && c.side[i], false));
		out.shift = normControl(c.shift, false);
		for (i = 0; i < 9; i++) out.faders.push(normFader(c.faders && c.faders[i]));
		return out;
	}

	// Enlace: mientras suene algún clip de la capa (clips from..to), se mandan sus acciones;
	// al dejar de sonar, se mandan "apagadas" (0, note off...).
	function normLink(l) {
		l = l || {};
		var o = {
			label: String(l.label || ""),
			enabled: l.enabled !== false,
			layer: int(l.layer, 1, 1),
			from: int(l.from, 1, 1),
			to: int(l.to, 1, 1),
			actions: []
		};
		if (o.to < o.from) o.to = o.from;
		(l.actions || []).slice(0, G.MAX_EXTRA).forEach(function (a) {
			var x = { type: a && a.type == "osc" ? "osc" : "midi" };
			copyAction(x, a || {}, x.type);
			delete x.mode;
			delete x.feedback;
			o.actions.push(x);
		});
		return o;
	}

	function normTarget(t) {
		t = t || {};
		var o = {
			id: String(t.id || "").toLowerCase().split("").filter(function (ch) { return /[a-z0-9]/.test(ch); }).join(""),
			type: t.type == "osc" ? "osc" : "midi",
			label: String(t.label || "")
		};
		if (o.type == "osc") { o.host = String(t.host || "127.0.0.1"); o.port = int(t.port, 8000, 1, 65535); }
		else o.device = String(t.device || "");
		return o;
	}

	function normFader(f) {
		f = f || {};
		var t = G.FADER_TYPES.indexOf(f.type) >= 0 ? f.type : "none";
		var o = { type: t, label: String(f.label || "") };
		if (t == "layerOpacity" || t == "layerMaster" || t == "clipSpeed") o.layer = int(f.layer, 1, 1);
		if (t == "clipSpeed") {
			o.clip = int(f.clip, 1, 1);
			o.min = num(f.min, 0.25); o.max = num(f.max, 4);
			if (o.min <= 0) o.min = 0.25;
			if (o.max <= 0) o.max = 4;
			o.name = String(f.name || "");
		}
		if (t == "osc") { o.target = String(f.target || "resolume"); o.address = String(f.address || "/"); o.min = num(f.min, 0); o.max = num(f.max, 1); }
		if (t == "midiCC") {
			o.target = String(f.target || ""); o.channel = int(f.channel, 1, 1, 16); o.number = int(f.number, 0, 0, 127);
			o.min = int(f.min, 0, 0, 127); o.max = int(f.max, 127, 0, 127);
		}
		return o;
	}

	G.normalizeConfig = function (c) {
		c = c || {};
		var i, out = {
			format: "apc-resolume",
			version: 1,
			name: String(c.name || "Sin nombre"),
			resolume: {
				host: String((c.resolume && c.resolume.host) || "127.0.0.1"),
				apiPort: int(c.resolume && c.resolume.apiPort, 8080, 1, 65535)
			},
			layers: {},
			targets: [],
			pads: [], bottom: [], side: [],
			shift: null, faders: [],
			devices: [],
			links: [],
			options: {}
		};
		var L = c.layers || {};
		Object.keys(L).forEach(function (k) { if (parseInt(k, 10) > 0 && L[k]) out.layers[String(parseInt(k, 10))] = String(L[k]); });
		(c.targets || []).forEach(function (t) {
			var n = normTarget(t);
			if (n.id && G.RESERVED_TARGETS.indexOf(n.id) < 0 && !out.targets.some(function (x) { return x.id == n.id; })) out.targets.push(n);
		});
		normDevice(c, out);
		// APC adicionales: mismo formato, con su nombre de módulo en Chataigne (apc2, apc3...)
		var used = ["apc"].concat(G.RESERVED_TARGETS, out.targets.map(function (t) { return t.id; }));
		(c.devices || []).forEach(function (d) {
			if (out.devices.length >= G.MAX_DEVICES - 1) return;
			var id = cleanId(d && d.id);
			if (!id || used.indexOf(id) >= 0) { var n = 2; while (used.indexOf("apc" + n) >= 0) n++; id = "apc" + n; }
			used.push(id);
			out.devices.push(normDevice(d || {}, { id: id, label: String((d && d.label) || "") }));
		});
		(c.links || []).forEach(function (l) { out.links.push(normLink(l)); });
		var op = c.options || {};
		out.options = {
			tempoSync: op.tempoSync !== false,
			pollHz: num(op.pollHz, 1),
			repaintEvery: int(op.repaintEvery, 5, 1),
			rgbHz: num(op.rgbHz, 5),
			speedMethod: op.speedMethod == "websocket" ? "websocket" : "put",
			autoReload: op.autoReload !== false,
			debug: !!op.debug
		};
		if (out.options.pollHz <= 0) out.options.pollHz = 1;
		if (out.options.rgbHz <= 0) out.options.rgbHz = 5;
		return out;
	};

	// Avisos para el usuario: [{level: "error"|"aviso", msg, ref}]
	G.validateConfig = function (c, composition) {
		var res = [];
		function add(level, msg, ref) { res.push({ level: level, msg: msg, ref: ref }); }
		function oscOk(a) { return typeof a == "string" && a.charAt(0) == "/" && a.length > 1 && a.indexOf(" ") < 0; }
		var ids = ["resolume"].concat(c.targets.map(function (t) { return t.id; }));
		function checkAction(a, where, ref) {
			if (!a || (a.type != "osc" && a.type != "midi")) return;
			if (a.type == "osc" && !oscOk(a.address)) add("error", where + ": la dirección OSC tiene que empezar por / y no llevar espacios", ref);
			if (a.type == "midi" && !a.target) add("error", where + ": falta elegir el destino MIDI", ref);
			else if (ids.indexOf(a.target) < 0) add("error", where + ": el destino «" + a.target + "» no existe (pestaña Destinos)", ref);
			else if (a.type == "midi" && targetType(a.target) != "midi") add("error", where + ": «" + a.target + "» es un destino OSC, no MIDI", ref);
			else if (a.type == "osc" && a.target != "resolume" && targetType(a.target) != "osc") add("error", where + ": «" + a.target + "» es un destino MIDI, no OSC", ref);
		}
		function targetType(id) { for (var i = 0; i < c.targets.length; i++) if (c.targets[i].id == id) return c.targets[i].type; return id == "resolume" ? "osc" : ""; }
		function checkControl(d, where, ref) {
			checkAction(d, where, ref);
			(d.extra || []).forEach(function (a, k) { checkAction(a, where + " (extra " + (k + 1) + ")", ref); });
		}
		G.allDevices(c).forEach(function (dv, di) {
			var pre = di ? (dv.label || dv.id) + " · " : "";
			function ref(r) { r.device = di; return r; }
			dv.pads.forEach(function (d, i) { checkControl(d, pre + G.padName(i), ref({ pad: i })); });
			[["bottom", "Botón de abajo "], ["side", "Botón lateral "]].forEach(function (g) {
				dv[g[0]].forEach(function (d, i) { checkControl(d, pre + g[1] + (i + 1), ref({ group: g[0], index: i })); });
			});
			checkControl(dv.shift, pre + "Shift", ref({ group: "shift", index: 0 }));
			dv.faders.forEach(function (f, i) {
				if (f.type == "osc" || f.type == "midiCC") checkAction({ type: f.type == "osc" ? "osc" : "midi", target: f.target, address: f.address }, pre + "Fader " + (i + 1), ref({ fader: i }));
			});
		});
		(c.links || []).forEach(function (l, i) {
			var where = "Enlace " + (i + 1) + (l.label ? " («" + l.label + "»)" : "");
			if (!l.actions.length) add("aviso", where + ": no hace nada todavía (añade una acción)", { link: i });
			l.actions.forEach(function (a) { checkAction(a, where, { link: i }); });
		});
		var seen = {};
		c.pads.forEach(function (d, i) {
			var where = G.padName(i);
			if ((d.type == "clip" || d.type == "dual")) {
				var k = d.layer + "/" + d.clip;
				if (seen[k] !== undefined) add("aviso", where + " lanza el mismo clip que " + G.padName(seen[k]) + " (capa " + d.layer + ", clip " + d.clip + ")", { pad: i });
				else seen[k] = i;
			}
		});
		c.faders.forEach(function (f, i) {
			if (f.type == "clipSpeed" && f.min >= f.max) add("error", "Fader " + (i + 1) + ": la velocidad mínima tiene que ser menor que la máxima", { fader: i });
		});
		if (composition) G.checkNames(c, composition).forEach(function (r) { res.push(r); });
		return res;
	};

	// El APC principal (los campos de arriba del mapa) y los adicionales, con su módulo de Chataigne
	G.allDevices = function (c) {
		return [{ id: "apc", label: "APC 1", pads: c.pads, bottom: c.bottom, side: c.side, shift: c.shift, faders: c.faders }].concat(c.devices || []);
	};

	G.padName = function (i) { return "Pad fila " + (Math.floor(i / 8) + 1) + " · " + ((i % 8) + 1); };

	// ---------- composición de Resolume ----------

	// Convierte la respuesta de /api/v1/composition en {layers: [{name, clips: [{name, empty}]}], name}
	G.parseComposition = function (json) {
		if (!json || !Array.isArray(json.layers)) throw new Error("No parece una composición de Resolume (falta \"layers\")");
		function val(x) { return x && typeof x == "object" ? (x.value !== undefined ? x.value : "") : (x || ""); }
		return {
			name: String(val(json.name)),
			layers: json.layers.map(function (l) {
				return {
					name: String(val(l.name)),
					clips: (l.clips || []).map(function (cl) {
						var conn = String(val(cl.connected));
						var empty = conn == "Empty" || (!cl.video && !cl.audio && conn === "");
						return { name: empty ? "" : String(val(cl.name)), empty: empty };
					})
				};
			})
		};
	};

	G.clipInfo = function (comp, layer, clip) {
		var l = comp && comp.layers[layer - 1];
		if (!l) return null;
		var cl = l.clips[clip - 1];
		return cl ? { layerName: l.name, name: cl.name, empty: cl.empty } : { layerName: l.name, missing: true };
	};

	// Busca el clip por nombre en la capa: devuelve su número o 0.
	G.findClip = function (comp, layer, name) {
		var l = comp && comp.layers[layer - 1];
		if (!l || !name) return 0;
		for (var i = 0; i < l.clips.length; i++) if (l.clips[i].name == name) return i + 1;
		return 0;
	};

	// Compara los nombres guardados en el mapa con los de la composición.
	G.checkNames = function (c, comp) {
		var res = [];
		function one(where, ref, layer, clip, saved, which) {
			var info = G.clipInfo(comp, layer, clip);
			if (!info) { res.push({ level: "error", msg: where + ": la capa " + layer + " no existe en la composición", ref: ref, kind: "layer" }); return; }
			if (info.missing) { res.push({ level: "error", msg: where + ": la capa " + layer + " no tiene clip " + clip, ref: ref, kind: "clip" }); return; }
			if (!saved) {
				if (info.empty) res.push({ level: "aviso", msg: where + ": el clip " + clip + " de la capa " + layer + " está vacío", ref: ref, kind: "empty" });
				return;
			}
			if (info.name == saved) return;
			var found = G.findClip(comp, layer, saved);
			res.push({
				level: "error",
				msg: where + ": esperaba «" + saved + "» en capa " + layer + " clip " + clip + ", pero ahí está " + (info.empty ? "un clip vacío" : "«" + info.name + "»") +
					(found ? ". Ahora está en el clip " + found : ". No está en esa capa"),
				ref: ref, kind: "name", which: which, moveTo: found
			});
		}
		G.allDevices(c).forEach(function (dv, di) {
			var pre = di ? (dv.label || dv.id) + " · " : "";
			dv.pads.forEach(function (d, i) {
				if (d.type != "clip" && d.type != "dual") return;
				one(pre + G.padName(i), { pad: i, device: di }, d.layer, d.clip, d.name, 1);
				if (d.type == "dual") one(pre + G.padName(i) + " (2.º clip)", { pad: i, device: di }, d.layer2, d.clip2, d.name2, 2);
			});
			dv.faders.forEach(function (f, i) {
				if (f.type == "clipSpeed") one(pre + "Fader " + (i + 1), { fader: i, device: di }, f.layer, f.clip, f.name, 1);
			});
		});
		return res;
	};

	// ---------- exportar ----------

	G.configJSON = function (c) { return JSON.stringify(c, null, 1) + "\n"; };

	G.buildScript = function (template, c) {
		if (template.indexOf(G.CONFIG_MARKER) < 0) throw new Error("La plantilla del script no tiene la marca del mapa");
		var json = JSON.stringify(c);
		return template.replace(G.CONFIG_MARKER, function () {
			return "var EMBEDDED_CONFIG = " + json + "; // mapa incluido: \"" + c.name.split("\"").join("'") + "\"";
		});
	};

	// .noisette a partir del que ya funciona: cambia la ruta de los scripts y añade el módulo
	// WebSocket "resolumews" si no está. Todo lo demás se deja tal cual.
	G.buildNoisette = function (template, folder, targets, devices) {
		var n = JSON.parse(JSON.stringify(template));
		folder = String(folder || "").split("\\").join("/").replace(/\/+$/, "");
		var SCRIPT_OF = { apc: "apc_to_resolume", resolume: "resolume_to_apc", resolumeapi: "resolume_api" };
		var hasWs = false;
		n.modules.items.forEach(function (m) {
			if (m.niceName == "resolumews") hasWs = true;
			var s = SCRIPT_OF[m.niceName];
			if (!s || !m.scripts || !m.scripts.items) return;
			m.scripts.items.forEach(function (it) {
				if (it.niceName != s) return;
				it.parameters.forEach(function (p) { if (p.controlAddress == "/filePath") p.value = folder + "/" + s + ".js"; });
			});
		});
		if (!hasWs) n.modules.items.push(G.WS_MODULE());
		// APC adicionales: módulo MIDI con el mismo script que el principal
		(devices || []).forEach(function (d) {
			if (n.modules.items.some(function (m) { return m.niceName == d.id; })) return;
			n.modules.items.push(G.APC_MODULE(d.id, folder));
		});
		(targets || []).forEach(function (t, i) {
			if (n.modules.items.some(function (m) { return m.niceName == t.id; })) return;
			var m = t.type == "osc" ? G.OSC_TARGET_MODULE(t, 9100 + i) : G.MIDI_TARGET_MODULE(t);
			// lo que devuelve el programa enciende los LEDs de los controles con «LED según el programa»
			m.scripts = { items: [G.SCRIPT_ITEM(folder, "destino_a_apc")], viewOffset: [0, 0], viewZoom: 1.0 };
			n.modules.items.push(m);
		});
		return JSON.stringify(n);
	};

	G.SCRIPT_ITEM = function (folder, name) {
		return { parameters: [{ value: folder + "/" + name + ".js", controlAddress: "/filePath" }], niceName: name, type: "BaseItem", scriptParams: {} };
	};

	// Módulo MIDI de un APC adicional (apc2...). El puerto ("2- APC mini mk2"...) se elige en Chataigne.
	G.APC_MODULE = function (id, folder) {
		return {
			parameters: [{ value: true, controlAddress: "/enabled" }],
			niceName: id,
			type: "MIDI",
			scripts: { items: [G.SCRIPT_ITEM(folder, "apc_to_resolume")], viewOffset: [0, 0], viewZoom: 1.0 },
			params: {
				parameters: [
					{ value: false, controlAddress: "/autoAdd" },
					{ value: false, controlAddress: "/useHierarchy" },
					{ value: false, controlAddress: "/usePitchForNoteNames" }
				],
				containers: { pass_through: {} }
			},
			templates: { viewOffset: [0, 0], viewZoom: 1.0 },
			values: {}
		};
	};

	// Módulo MIDI de un destino. El puerto se elige en Chataigne (los ids de Windows no se pueden adivinar).
	// Auto Add activado: lo que mande el programa (p. ej. Sunlite) aparece como valores, y el remote
	// de Chataigne lo puede mostrar.
	G.MIDI_TARGET_MODULE = function (t) {
		return {
			parameters: [{ value: true, controlAddress: "/enabled" }],
			niceName: t.id,
			type: "MIDI",
			params: { parameters: [{ value: true, controlAddress: "/autoAdd" }], containers: { pass_through: {} } },
			templates: { viewOffset: [0, 0], viewZoom: 1.0 },
			values: {}
		};
	};

	G.OSC_TARGET_MODULE = function (t, listenPort) {
		return {
			parameters: [{ value: true, controlAddress: "/enabled" }],
			niceName: t.id,
			type: "OSC",
			params: {
				parameters: [{ value: "Auto", controlAddress: "/networkInterface" }],
				containers: {
					oscInput: { parameters: [{ value: listenPort, hexMode: false, controlAddress: "/localPort" }] },
					oscOutputs: {
						items: [{
							parameters: [
								{ value: t.host, controlAddress: "/remoteHost" },
								{ value: t.port, hexMode: false, controlAddress: "/remotePort" }
							],
							niceName: "OSC Output", type: "BaseItem"
						}],
						viewOffset: [0, 0], viewZoom: 1.0
					},
					pass_through: {}
				}
			},
			templates: { viewOffset: [0, 0], viewZoom: 1.0 },
			values: {}
		};
	};

	G.WS_MODULE = function () {
		return {
			parameters: [{ value: true, controlAddress: "/enabled" }],
			niceName: "resolumews",
			type: "WebSocket Client",
			params: {
				parameters: [
					{ value: "Direct", controlAddress: "/protocol" },
					{ value: false, controlAddress: "/autoAdd" },
					{ value: "127.0.0.1:8080/api/v1", controlAddress: "/serverPath" }
				]
			},
			templates: { viewOffset: [0, 0], viewZoom: 1.0 },
			values: {}
		};
	};

	// Todos los archivos que van a la carpeta de Chataigne: [{name, text}]
	G.buildFiles = function (c, templates, noisetteTemplate, opts) {
		opts = opts || {};
		var files = [{ name: "apc_config.json", text: G.configJSON(c) }];
		if (opts.scripts !== false) G.SCRIPT_NAMES.forEach(function (n) { files.push({ name: n, text: G.buildScript(templates[n], c) }); });
		if (opts.noisette && noisetteTemplate) files.push({ name: "APC_Resolume.noisette", text: G.buildNoisette(noisetteTemplate, opts.folder, c.targets, c.devices) });
		return files;
	};

	// ZIP sin compresión (suficiente para unos pocos archivos de texto)
	var CRC_TABLE = null;
	function crc32(bytes) {
		if (!CRC_TABLE) {
			CRC_TABLE = [];
			for (var n = 0; n < 256; n++) {
				var c = n;
				for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
				CRC_TABLE[n] = c >>> 0;
			}
		}
		var crc = 0xFFFFFFFF;
		for (var i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
		return (crc ^ 0xFFFFFFFF) >>> 0;
	}
	function utf8(s) {
		if (typeof TextEncoder != "undefined") return new TextEncoder().encode(s);
		return new Uint8Array(Buffer.from(s, "utf8"));
	}
	G.makeZip = function (files) {
		var parts = [], central = [], offset = 0;
		var d = new Date();
		var time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
		var date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
		function hdr(size) { return { b: new Uint8Array(size), v: null }; }
		files.forEach(function (f) {
			var name = utf8(f.name), data = utf8(f.text), crc = crc32(data);
			var h = hdr(30 + name.length), v = new DataView(h.b.buffer);
			v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x0800, true);
			v.setUint16(8, 0, true); v.setUint16(10, time, true); v.setUint16(12, date, true);
			v.setUint32(14, crc, true); v.setUint32(18, data.length, true); v.setUint32(22, data.length, true);
			v.setUint16(26, name.length, true); v.setUint16(28, 0, true);
			h.b.set(name, 30);
			var ch = hdr(46 + name.length), cv = new DataView(ch.b.buffer);
			cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
			cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true); cv.setUint16(12, time, true); cv.setUint16(14, date, true);
			cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true);
			cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true);
			ch.b.set(name, 46);
			parts.push(h.b, data); central.push(ch.b);
			offset += h.b.length + data.length;
		});
		var csize = central.reduce(function (a, b) { return a + b.length; }, 0);
		var end = new Uint8Array(22), ev = new DataView(end.buffer);
		ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
		ev.setUint32(12, csize, true); ev.setUint32(16, offset, true);
		var all = parts.concat(central, [end]);
		var total = all.reduce(function (a, b) { return a + b.length; }, 0);
		var out = new Uint8Array(total), pos = 0;
		all.forEach(function (b) { out.set(b, pos); pos += b.length; });
		return out;
	};

})(typeof module != "undefined" && module.exports ? module.exports : (window.APCGen = {}));
