// Generador compartido por configurador.html (navegador) y build.js (Node):
// normaliza y valida el mapa, genera los scripts de Chataigne, el .noisette y el ZIP.
(function (G) {
	"use strict";

	G.PAD_TYPES = ["none", "clip", "dual", "osc", "rgb", "tap", "resync", "bypass", "blackout", "clear", "clearAll", "prev", "next", "refresh"];
	G.BUTTON_TYPES = ["none", "bypass", "clear", "blackout", "clearAll", "prev", "next", "refresh", "tap", "resync", "osc"];
	G.FADER_TYPES = ["none", "layerOpacity", "layerMaster", "compMaster", "compOpacity", "osc", "clipSpeed"];
	G.CONFIG_MARKER = "var EMBEDDED_CONFIG = null; // @@CONFIG@@";
	G.SCRIPT_NAMES = ["apc_to_resolume.js", "resolume_to_apc.js", "resolume_api.js"];

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
		if (t == "osc") {
			o.address = String(d.address || "/");
			o.value = num(d.value, 1);
			o.mode = ["pulse", "hold", "toggle"].indexOf(d.mode) >= 0 ? d.mode : "pulse";
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
		if (t == "osc") { o.address = String(f.address || "/"); o.min = num(f.min, 0); o.max = num(f.max, 1); }
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
			pads: [], bottom: [], side: [],
			shift: null, faders: [],
			options: {}
		};
		var L = c.layers || {};
		Object.keys(L).forEach(function (k) { if (parseInt(k, 10) > 0 && L[k]) out.layers[String(parseInt(k, 10))] = String(L[k]); });
		for (i = 0; i < 64; i++) out.pads.push(normControl(c.pads && c.pads[i], true));
		for (i = 0; i < 8; i++) out.bottom.push(normControl(c.bottom && c.bottom[i], false));
		for (i = 0; i < 8; i++) out.side.push(normControl(c.side && c.side[i], false));
		out.shift = normControl(c.shift, false);
		for (i = 0; i < 9; i++) out.faders.push(normFader(c.faders && c.faders[i]));
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
		var seen = {};
		c.pads.forEach(function (d, i) {
			var where = G.padName(i);
			if ((d.type == "clip" || d.type == "dual")) {
				var k = d.layer + "/" + d.clip;
				if (seen[k] !== undefined) add("aviso", where + " lanza el mismo clip que " + G.padName(seen[k]) + " (capa " + d.layer + ", clip " + d.clip + ")", { pad: i });
				else seen[k] = i;
			}
			if (d.type == "osc" && !oscOk(d.address)) add("error", where + ": la dirección OSC tiene que empezar por / y no llevar espacios", { pad: i });
		});
		[["bottom", "Botón de abajo "], ["side", "Botón lateral "]].forEach(function (g) {
			c[g[0]].forEach(function (d, i) {
				if (d.type == "osc" && !oscOk(d.address)) add("error", g[1] + (i + 1) + ": la dirección OSC tiene que empezar por /", { group: g[0], index: i });
			});
		});
		c.faders.forEach(function (f, i) {
			if (f.type == "osc" && !oscOk(f.address)) add("error", "Fader " + (i + 1) + ": la dirección OSC tiene que empezar por /", { fader: i });
			if (f.type == "clipSpeed" && f.min >= f.max) add("error", "Fader " + (i + 1) + ": la velocidad mínima tiene que ser menor que la máxima", { fader: i });
		});
		if (composition) G.checkNames(c, composition).forEach(function (r) { res.push(r); });
		return res;
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
		c.pads.forEach(function (d, i) {
			if (d.type != "clip" && d.type != "dual") return;
			one(G.padName(i), { pad: i }, d.layer, d.clip, d.name, 1);
			if (d.type == "dual") one(G.padName(i) + " (2.º clip)", { pad: i }, d.layer2, d.clip2, d.name2, 2);
		});
		c.faders.forEach(function (f, i) {
			if (f.type == "clipSpeed") one("Fader " + (i + 1), { fader: i }, f.layer, f.clip, f.name, 1);
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
	G.buildNoisette = function (template, folder) {
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
		return JSON.stringify(n);
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
		if (opts.noisette && noisetteTemplate) files.push({ name: "APC_Resolume.noisette", text: G.buildNoisette(noisetteTemplate, opts.folder) });
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
