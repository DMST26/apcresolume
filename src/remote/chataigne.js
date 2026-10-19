// Chataigne como fuente del remote, por su servidor OSCQuery (Preferencias → OSC Remote Control,
// puerto 42000 por defecto):
//   GET http://ip:42000/                      árbol de todo el proyecto (JSON OSCQuery)
//   ws://ip:42000/  {"COMMAND":"LISTEN","DATA":["/modules/x/values/y", true]}   avisar de cambios
//                   {"/modules/x/values/y": 0.5}                                cambiar un valor
//   las respuestas llegan como mensajes OSC binarios
//
// En el remote, las rutas de Chataigne llevan el prefijo "chataigne:" ("chataigne:/modules/sunlite/values/cc1").
// Se usa en el navegador (window.ChataigneSource) y en Node (pruebas).
(function (S) {
	"use strict";

	S.PREFIX = "chataigne:";
	S.isPath = function (p) { return typeof p == "string" && p.indexOf(S.PREFIX) == 0; };
	S.address = function (p) { return S.isPath(p) ? p.substring(S.PREFIX.length) : p; };

	// Nombres de las partes de Chataigne que más se usan
	var GROUPS = { modules: "Módulos", customVariables: "Variables", states: "Estados", sequences: "Secuencias", values: "Valores", parameters: "Ajustes", scripts: "Scripts", params: "Parámetros" };
	// Contenedores que casi nunca se quieren en un remote
	var ADVANCED = ["parameters", "commandTester", "templates", "pass_through", "outliner", "dashboardManager", "parrots", "layout", "projectSettings", "routers", "infos", "mtc", "oscInput", "oscOutputs", "authentication"];

	// Tipo de parámetro del remote a partir del nodo OSCQuery de Chataigne
	S.valuetype = function (node) {
		var t = node.TYPE, ext = (node.EXTENDED_TYPE && node.EXTENDED_TYPE[0]) || "";
		var r = node.RANGE && node.RANGE[0];
		if (t == "N") return "ParamEvent";
		if (t == "T" || t == "F") return "ParamBoolean";
		if (t == "f") return r && r.MIN !== undefined && r.MAX !== undefined ? "ParamRange" : "ParamNumber";
		if (t == "i") return r && r.MIN !== undefined && r.MAX !== undefined ? "ParamInteger" : "ParamNumber";
		if (t == "s" && (ext == "Enum" || (r && r.VALS))) return "ParamChoice";
		if (t == "s") return "ParamString";
		if (t == "r") return "ParamColor";
		return null;
	};

	// Parámetro (con el formato que usan los controles) a partir de un nodo
	S.param = function (node) {
		var vt = S.valuetype(node);
		if (!vt) return null;
		var r = node.RANGE && node.RANGE[0];
		var v = node.VALUE && node.VALUE.length ? node.VALUE[0] : undefined;
		var p = { id: S.PREFIX + node.FULL_PATH, valuetype: vt, readonly: node.ACCESS == 1 };
		if (r && r.MIN !== undefined) { p.min = r.MIN; p.max = r.MAX; }
		if (vt == "ParamChoice") { p.options = (r && r.VALS) || []; p.index = Math.max(0, p.options.indexOf(v)); p.value = v; }
		else if (vt == "ParamBoolean") p.value = v === true || v === 1 || v === "true";
		else if (vt != "ParamEvent") p.value = v;
		return p;
	};

	// Lista plana para el panel de parámetros (mismo formato que RemoteCatalog.walk)
	S.walk = function (tree) {
		var out = [];
		if (!tree) return out;
		function visit(node, group, adv, depth) {
			if (!node || typeof node != "object" || depth > 12) return;
			if (node.CONTENTS) {
				Object.keys(node.CONTENTS).forEach(function (k) {
					var child = node.CONTENTS[k];
					if (!child || typeof child != "object") return;
					var isContainer = !!child.CONTENTS;
					var name = child.DESCRIPTION || k;
					var g = group;
					if (isContainer) g = group ? group + " › " + (GROUPS[k] || name) : (GROUPS[k] || name);
					visit(child, g, adv || ADVANCED.indexOf(k) >= 0, depth + 1);
				});
				return;
			}
			var p = S.param(node);
			if (!p) return;
			out.push({
				kind: "param", source: "chataigne", path: p.id, key: node.FULL_PATH.split("/").pop(),
				label: node.DESCRIPTION || node.FULL_PATH.split("/").pop(), group: "Chataigne › " + (group || "Proyecto"),
				valuetype: p.valuetype, min: p.min, max: p.max, options: p.options, readonly: p.readonly, advanced: adv
			});
		}
		visit(tree, "", false, 0);
		return out;
	};

	// Nodo del árbol para una dirección
	S.node = function (tree, address) {
		if (!tree) return null;
		var parts = String(address).split("/").filter(Boolean), node = tree;
		for (var i = 0; i < parts.length; i++) {
			if (!node.CONTENTS || !node.CONTENTS[parts[i]]) return null;
			node = node.CONTENTS[parts[i]];
		}
		return node;
	};
	S.resolve = function (tree, path) {
		var n = S.node(tree, S.address(path));
		var p = n && !n.CONTENTS ? S.param(n) : null;
		return p ? { kind: "param", param: p } : null;
	};

	// ---------- OSC binario ----------

	function pad4(n) { return (n + 3) & ~3; }
	function readString(view, bytes, off) {
		var end = off;
		while (end < bytes.length && bytes[end] !== 0) end++;
		var s = "";
		for (var i = off; i < end; i++) s += String.fromCharCode(bytes[i]);
		try { s = decodeURIComponent(escape(s)); } catch (e) { /* no era UTF-8 */ }
		return { value: s, next: pad4(end + 1) };
	}
	// ArrayBuffer -> {address, args: [...]} (null si no es un mensaje OSC)
	S.decodeOSC = function (buffer) {
		var bytes = new Uint8Array(buffer), view = new DataView(buffer);
		if (!bytes.length || bytes[0] !== 47) return null; // "/"
		var a = readString(view, bytes, 0), off = a.next;
		var tags = off < bytes.length ? readString(view, bytes, off) : { value: ",", next: off };
		off = tags.next;
		var args = [];
		for (var i = 1; i < tags.value.length; i++) {
			var t = tags.value[i];
			if (t == "i") { args.push(view.getInt32(off)); off += 4; }
			else if (t == "f") { args.push(view.getFloat32(off)); off += 4; }
			else if (t == "d") { args.push(view.getFloat64(off)); off += 8; }
			else if (t == "h") { args.push(Number(view.getBigInt64 ? view.getBigInt64(off) : 0)); off += 8; }
			else if (t == "s") { var s = readString(view, bytes, off); args.push(s.value); off = s.next; }
			else if (t == "T") args.push(true);
			else if (t == "F") args.push(false);
			else if (t == "N") args.push(null);
			else if (t == "r") { args.push("#" + ("00000000" + view.getUint32(off).toString(16)).slice(-8)); off += 4; }
			else return { address: a.value, args: args };
		}
		return { address: a.value, args: args };
	};
	// Para las pruebas y el simulador: {address, args} -> ArrayBuffer
	S.encodeOSC = function (address, args) {
		function str(s) { var b = []; for (var i = 0; i < s.length; i++) b.push(s.charCodeAt(i) & 0xff); b.push(0); while (b.length % 4) b.push(0); return b; }
		var tags = ",", data = [];
		(args || []).forEach(function (v) {
			var tmp = new DataView(new ArrayBuffer(4));
			if (typeof v == "boolean") { tags += "i"; tmp.setInt32(0, v ? 1 : 0); data = data.concat(Array.from(new Uint8Array(tmp.buffer))); }
			else if (typeof v == "number" && Number.isInteger(v)) { tags += "i"; tmp.setInt32(0, v); data = data.concat(Array.from(new Uint8Array(tmp.buffer))); }
			else if (typeof v == "number") { tags += "f"; tmp.setFloat32(0, v); data = data.concat(Array.from(new Uint8Array(tmp.buffer))); }
			else { tags += "s"; data = data.concat(str(String(v))); }
		});
		var all = str(address).concat(str(tags), data);
		return new Uint8Array(all).buffer;
	};

	// Valor de un mensaje de vuelta para un parámetro
	S.valueFromArgs = function (p, args) {
		if (!args.length) return undefined;
		var v = args[0];
		if (p.valuetype == "ParamBoolean") return v === true || v === 1 || v > 0.5;
		return v;
	};
	// Valor que se manda a Chataigne desde un control
	S.outgoing = function (p, v) {
		if (p.valuetype == "ParamChoice") return typeof v == "number" ? p.options[v] : v;
		if (p.valuetype == "ParamEvent") return 1;
		if (p.valuetype == "ParamInteger") return Math.round(v);
		return v;
	};

	// ---------- Chataigne simulado ----------

	// Árbol de ejemplo con los módulos del puente (para diseñar sin Chataigne delante)
	S.exampleTree = function (cfg) {
		function P(path, type, value, range, desc, ext) {
			var n = { DESCRIPTION: desc || path.split("/").pop(), FULL_PATH: path, ACCESS: 3, TYPE: type, VALUE: value === undefined ? undefined : [value] };
			if (range) n.RANGE = [range];
			if (ext) n.EXTENDED_TYPE = [ext];
			if (type == "N") delete n.VALUE;
			return n;
		}
		function C(path, desc, contents) {
			var c = { DESCRIPTION: desc, FULL_PATH: path, ACCESS: 0, TYPE: "Container", CONTENTS: {} };
			(contents || []).forEach(function (x) { c.CONTENTS[x.FULL_PATH.split("/").pop()] = x; });
			return c;
		}
		var mods = [
			C("/modules/apc", "apc", [
				C("/modules/apc/values", "Values", [C("/modules/apc/values/tempo", "Tempo", [
					P("/modules/apc/values/tempo/bpm", "f", 128, { MIN: 1, MAX: 999 }, "BPM", "Float"),
					P("/modules/apc/values/tempo/sendClock", "T", true, null, "Send Clock", "Boolean")])]),
				C("/modules/apc/scripts", "Scripts", [C("/modules/apc/scripts/apc_to_resolume", "apc_to_resolume", [
					C("/modules/apc/scripts/apc_to_resolume/params", "Params", [
						P("/modules/apc/scripts/apc_to_resolume/params/testLEDs", "N", undefined, null, "Test LEDs", "Trigger"),
						P("/modules/apc/scripts/apc_to_resolume/params/refreshLEDs", "N", undefined, null, "Refresh LEDs", "Trigger"),
						P("/modules/apc/scripts/apc_to_resolume/params/recargarMapa", "N", undefined, null, "Recargar mapa", "Trigger")])])])
			]),
			C("/modules/resolume", "resolume", [C("/modules/resolume/values", "Values", [
				P("/modules/resolume/values/composition_master", "f", 1, { MIN: 0, MAX: 1 }, "/composition/master", "Float"),
				P("/modules/resolume/values/composition_bypassed", "i", 0, null, "/composition/bypassed", "Integer")])])
		];
		((cfg && cfg.targets) || []).forEach(function (t) {
			var base = "/modules/" + t.id;
			mods.push(C(base, t.id, [C(base + "/values", "Values", t.type == "midi" ? [
				P(base + "/values/cc1", "f", 0, { MIN: 0, MAX: 127 }, "CC 1 (canal 1)", "Float"),
				P(base + "/values/note36", "f", 0, { MIN: 0, MAX: 127 }, "Nota 36 (canal 1)", "Float")
			] : [P(base + "/values/estado", "s", "", null, "/estado", "String")])]));
		});
		return C("", "Chataigne", [
			C("/modules", "Modules", mods),
			C("/customVariables", "Custom Variables", [C("/customVariables/show", "Show", [C("/customVariables/show/variables", "Variables", [
				P("/customVariables/show/variables/intensidad", "f", 0.8, { MIN: 0, MAX: 1 }, "Intensidad", "Float"),
				P("/customVariables/show/variables/modo", "s", "Normal", { VALS: ["Normal", "Drop", "Ambient"] }, "Modo", "Enum"),
				P("/customVariables/show/variables/strobeAuto", "T", false, null, "Strobe automático", "Boolean")])])]),
			C("/states", "States", [C("/states/intro", "Intro", [P("/states/intro/active", "T", true, null, "Active", "Boolean")])]),
			C("/sequences", "Sequences", [C("/sequences/show", "Show", [
				P("/sequences/show/playSequence", "N", undefined, null, "Play", "Trigger"),
				P("/sequences/show/stopSequence", "N", undefined, null, "Stop", "Trigger"),
				P("/sequences/show/currentTime", "f", 0, { MIN: 0, MAX: 60 }, "Current Time", "Float")])])
		]);
	};

	// Simulador del servidor OSCQuery: send(msg) recibe {address, args} (o JSON de texto)
	S.sim = function (tree) {
		var clients = [];
		function each(node, fn) { if (!node) return; if (node.CONTENTS) Object.keys(node.CONTENTS).forEach(function (k) { each(node.CONTENTS[k], fn); }); else fn(node); }
		return {
			tree: function () { return tree; },
			connect: function (send) {
				var c = { send: send, listen: {} };
				clients.push(c);
				return {
					receive: function (m) {
						if (typeof m == "string") { try { m = JSON.parse(m); } catch (e) { return; } }
						if (m.COMMAND == "LISTEN" || m.COMMAND == "IGNORE") {
							var addr = Array.isArray(m.DATA) ? m.DATA[0] : m.DATA;
							var n = S.node(tree, addr);
							if (!n) return;
							if (m.COMMAND == "IGNORE") { delete c.listen[addr]; return; }
							c.listen[addr] = true;
							if (Array.isArray(m.DATA) && m.DATA[1] && n.VALUE) send({ address: addr, args: [n.VALUE[0]] });
							return;
						}
						if (m.COMMAND) return;
						Object.keys(m).forEach(function (addr) {
							var n = S.node(tree, addr);
							if (!n || n.CONTENTS || n.TYPE == "N") return;
							var v = m[addr];
							if (n.RANGE && n.RANGE[0] && n.RANGE[0].MIN !== undefined) v = Math.max(n.RANGE[0].MIN, Math.min(n.RANGE[0].MAX, v));
							n.VALUE = [v];
							clients.forEach(function (cl) { if (cl.listen[addr]) cl.send({ address: addr, args: [v] }); });
						});
					},
					close: function () { clients.splice(clients.indexOf(c), 1); }
				};
			},
			// cambiar un valor "desde Chataigne" (pruebas)
			set: function (addr, v) {
				var n = S.node(tree, addr);
				if (!n) return;
				n.VALUE = [v];
				clients.forEach(function (cl) { if (cl.listen[addr]) cl.send({ address: addr, args: [v] }); });
			},
			each: function (fn) { each(tree, fn); }
		};
	};

})(typeof module != "undefined" && module.exports ? module.exports : (window.ChataigneSource = {}));
