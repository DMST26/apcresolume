// Exportar un remote del constructor a TouchOSC (.tosc).
//
// Un .tosc es XML comprimido con zlib. Cada control es un <node> con sus propiedades (frame, color...),
// sus valores (x, y, text...) y sus mensajes OSC. Las propiedades por defecto de cada tipo están
// copiadas de archivos guardados por TouchOSC.
//
// TouchOSC habla con CHATAIGNE (un módulo OSC "touchosc" con el script touchosc.js), no directamente
// con Resolume, para que también pueda controlar Sunlite, variables... y recibir el estado:
//   /composition/...       -> Chataigne lo reenvía a Resolume (direcciones OSC de Resolume)
//   /chataigne/<ruta>      -> Chataigne cambia ese parámetro suyo (variables, módulos, secuencias...)
// y Chataigne devuelve a la tablet el estado (clips sonando, valores) por las mismas direcciones.
//
// Se usa en el navegador (window.TouchOSCExport) y en Node (pruebas). Necesita RemoteCatalog y ChataigneSource.
(function (T, C, CS) {
	"use strict";

	T.CHATAIGNE_PREFIX = "/chataigne";

	// ---------- direcciones ----------

	// Ruta del remote (como la API web de Resolume) -> dirección OSC de Resolume.
	// OSC de Resolume: todo en minúsculas, sin espacios ni guiones bajos; los efectos añadidos llevan
	// ".../effects/<efecto>/effect/<parámetro>" y el Transform de serie ".../effects/transform/<parámetro>".
	T.resolumeOsc = function (path) {
		var parts = String(path).split("/").filter(Boolean).map(function (s) {
			return s.replace(/%2F/gi, "/").replace(/%25/g, "%");
		});
		if (parts.length == 2 && parts[1] == "disconnect-all") return "/composition/disconnectall";
		var out = [];
		for (var i = 0; i < parts.length; i++) {
			var p = parts[i];
			if (parts[i - 1] == "effects") {
				var name = p.split("#")[0], n = p.indexOf("#") > 0 ? p.split("#")[1] : "";
				out.push(clean(name) + n);
				// parámetros del efecto: transform de serie sin "/effect", el resto con "/effect"
				if (parts[i + 1] == "params") { if (name != "transform") out.push("effect"); i++; }
				else if (parts[i + 1] == "mixer") { out.push("mixer"); i++; }
				continue;
			}
			out.push(clean(p));
		}
		return "/" + out.join("/");
	};
	function clean(s) { return String(s).toLowerCase().replace(/[\s_]+/g, ""); }

	T.address = function (path) {
		if (CS.isPath(path)) return T.CHATAIGNE_PREFIX + CS.address(path);
		return T.resolumeOsc(path);
	};

	// ---------- XML ----------

	function cdata(s) { return "<![CDATA[" + String(s).split("]]>").join("]]]]><![CDATA[>") + "]]>"; }
	function uuid() {
		var h = "0123456789abcdef", s = "";
		for (var i = 0; i < 32; i++) s += h[Math.floor(Math.random() * 16)];
		return s.slice(0, 8) + "-" + s.slice(8, 12) + "-4" + s.slice(13, 16) + "-a" + s.slice(17, 20) + "-" + s.slice(20, 32);
	}
	function rgba(hex, a) {
		var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || "") || [0, "ff", "b0", "00"];
		return { r: parseInt(m[1], 16) / 255, g: parseInt(m[2], 16) / 255, b: parseInt(m[3], 16) / 255, a: a == null ? 1 : a };
	}
	function num(v) { return String(Math.round(v * 1000) / 1000); }
	function prop(type, key, value) {
		var v;
		if (type == "s") v = cdata(value);
		else if (type == "c") v = "<r>" + num(value.r) + "</r><g>" + num(value.g) + "</g><b>" + num(value.b) + "</b><a>" + num(value.a) + "</a>";
		else if (type == "r") v = "<x>" + Math.round(value.x) + "</x><y>" + Math.round(value.y) + "</y><w>" + Math.round(value.w) + "</w><h>" + Math.round(value.h) + "</h>";
		else v = String(typeof value == "boolean" ? (value ? 1 : 0) : value);
		return "<property type='" + type + "'><key>" + cdata(key) + "</key><value>" + v + "</value></property>";
	}
	function valueXml(key, def) {
		return "<value><key>" + cdata(key) + "</key><locked>0</locked><lockedDefaultCurrent>0</lockedDefaultCurrent><default>" + cdata(def) + "</default><defaultPull>0</defaultPull></value>";
	}

	// Propiedades por defecto de cada tipo (de archivos guardados por TouchOSC)
	var BASE = { background: ["b", 1], cornerRadius: ["f", 1], grabFocus: ["b", 1], interactive: ["b", 1], locked: ["b", 0], orientation: ["i", 0], outline: ["b", 1], outlineStyle: ["i", 1], pointerPriority: ["i", 0], shape: ["i", 1], visible: ["b", 1] };
	var EXTRA = {
		GROUP: { grabFocus: ["b", 0], interactive: ["b", 0], outlineStyle: ["i", 0] },
		BOX: { interactive: ["b", 0] },
		BUTTON: { buttonType: ["i", 0], press: ["b", 1], release: ["b", 1], valuePosition: ["b", 0] },
		LABEL: { interactive: ["b", 0], font: ["i", 0], textAlignH: ["i", 2], textAlignV: ["i", 2], textClip: ["b", 1], textLength: ["i", 0], textSize: ["i", 14] },
		FADER: { bar: ["b", 1], barDisplay: ["i", 0], cursor: ["b", 1], cursorDisplay: ["i", 0], grid: ["b", 0], gridSteps: ["i", 10], response: ["i", 0], responseFactor: ["i", 100] },
		RADIAL: { centered: ["b", 0], grid: ["b", 0], gridSteps: ["i", 20], inverted: ["b", 0], outlineStyle: ["i", 0], response: ["i", 0], responseFactor: ["i", 100], shape: ["i", 2] },
		XY: { cursor: ["b", 1], cursorDisplay: ["i", 0], gridStepsX: ["i", 10], gridStepsY: ["i", 10], gridX: ["b", 1], gridY: ["b", 1], lines: ["b", 1], linesDisplay: ["i", 0], lockX: ["b", 0], lockY: ["b", 0], response: ["i", 0], responseFactor: ["i", 100] },
		RADIO: { orientation: ["i", 1], radioType: ["i", 0], steps: ["i", 3] },
		PAGER: { grabFocus: ["b", 0], outlineStyle: ["i", 0], tabLabels: ["b", 1], tabbar: ["b", 1], tabbarDoubleTap: ["b", 0], tabbarSize: ["i", 40], textSizeOff: ["i", 14], textSizeOn: ["i", 14] }
	};
	var VALUES = {
		GROUP: [["touch", "false"]], BOX: [["touch", "false"]], BUTTON: [["touch", "false"], ["x", "0"]],
		LABEL: [["text", "Label"], ["touch", "false"]], FADER: [["touch", "false"], ["x", "0"]], RADIAL: [["touch", "false"], ["x", "0"]],
		XY: [["touch", "false"], ["x", "0.5"], ["y", "0.5"]], RADIO: [["touch", "false"], ["x", "0"]], PAGER: [["page", "0"], ["touch", "false"]]
	};

	// node(tipo, {name, frame, color, props: {clave: [tipo, valor]}, values: {clave: valor}, messages: [xml], children: [xml]})
	function node(type, o) {
		var props = {}, k;
		for (k in BASE) props[k] = BASE[k];
		for (k in EXTRA[type] || {}) props[k] = EXTRA[type][k];
		props.name = ["s", o.name || type.toLowerCase()];
		props.frame = ["r", o.frame];
		props.color = ["c", o.color || rgba("#ffb000")];
		for (k in o.props || {}) props[k] = o.props[k];
		var keys = Object.keys(props).sort();
		var xml = "<node ID='" + uuid() + "' type='" + type + "'><properties>" + keys.map(function (key) { return prop(props[key][0], key, props[key][1]); }).join("") + "</properties>";
		xml += "<values>" + (VALUES[type] || [["touch", "false"]]).map(function (v) {
			return valueXml(v[0], o.values && o.values[v[0]] != null ? o.values[v[0]] : v[1]);
		}).join("") + "</values>";
		if (o.messages && o.messages.length) xml += "<messages>" + o.messages.join("") + "</messages>";
		if (o.children && o.children.length) xml += "<children>" + o.children.join("") + "</children>";
		return xml + "</node>";
	}
	T.node = node;

	// Mensaje OSC. args: [{type: "VALUE"|"CONSTANT", value: "x"|número, conversion: "FLOAT"|"INTEGER"|"STRING", min, max}]
	function osc(path, trigger, args, send, receive) {
		return "<osc><enabled>1</enabled><send>" + (send === false ? 0 : 1) + "</send><receive>" + (receive === false ? 0 : 1) + "</receive><feedback>0</feedback><connections>00001</connections>" +
			"<triggers><trigger><var>" + cdata(trigger || "x") + "</var><condition>ANY</condition></trigger></triggers>" +
			"<path><partial><type>CONSTANT</type><conversion>STRING</conversion><value>" + cdata(path) + "</value><scaleMin>0</scaleMin><scaleMax>1</scaleMax></partial></path>" +
			"<arguments>" + args.map(function (a) {
				return "<partial><type>" + a.type + "</type><conversion>" + (a.conversion || "FLOAT") + "</conversion><value>" + cdata(a.value) + "</value><scaleMin>" + num(a.min || 0) + "</scaleMin><scaleMax>" + num(a.max == null ? 1 : a.max) + "</scaleMax></partial>";
			}).join("") + "</arguments></osc>";
	}
	T.osc = osc;

	// ---------- remote -> .tosc ----------

	// Devuelve {xml, map: {chataigne: [{address, options, type}], polls: [rutas OSC "?"]}, warnings: []}
	T.build = function (layout, comp, tree, devices) {
		var dev = (devices || {})[layout.device] || { w: 1024, h: 700 };
		var W = dev.w, H = dev.h;
		var multi = layout.pages.length > 1, TAB = multi ? 50 : 0;
		var accent = rgba(layout.accent);
		var dim = { r: 0.17, g: 0.18, b: 0.2, a: 1 };
		var map = { chataigne: [], polls: [] }, warnings = [];
		var count = 0;
		function name(base) { count++; return String(base || "control").replace(/[^A-Za-z0-9_]/g, "_").slice(0, 24) + "_" + count; }

		function entry(path) {
			if (!path) return null;
			if (CS.isPath(path)) {
				var r = tree ? CS.resolve(tree, path) : null;
				var addr = CS.address(path);
				var p = r ? r.param : null;
				if (!p) warnings.push("«" + addr + "» no está en el Chataigne leído: se exporta igual.");
				var e = { source: "chataigne", address: T.CHATAIGNE_PREFIX + addr, valuetype: p ? p.valuetype : "ParamRange", min: p && p.min != null ? p.min : 0, max: p && p.max != null ? p.max : 1, options: p && p.options };
				if (!map.chataigne.some(function (x) { return x.address == addr; })) map.chataigne.push({ address: addr, options: e.options || null, type: e.valuetype });
				return e;
			}
			var res = comp ? C.resolve(comp, path) : null;
			var vt = res ? (res.kind == "action" ? "Action" : res.param.valuetype) : (/\/(connect|select|clear|disconnect-all)$/.test(path) ? "Action" : "ParamRange");
			if (/\/effects\//.test(path)) warnings.push("Efecto «" + path.split("/effects/")[1] + "»: la dirección OSC de efectos es la de la documentación de Resolume; si no responde, cópiala en el editor de TouchOSC desde «Edit OSC» de Resolume.");
			var o = { source: "resolume", address: T.resolumeOsc(path), valuetype: vt, min: 0, max: 1, options: res && res.param && res.param.options };
			// estado de los clips: Chataigne lo pregunta y lo devuelve a la tablet como 1/0 en la misma dirección
			if (/\/clips\/\d+\/connect$/.test(path)) {
				var poll = o.address.replace(/\/connect$/, "/connected");
				if (map.polls.indexOf(poll) < 0) map.polls.push(poll);
			}
			return o;
		}
		// argumentos: Resolume va normalizado 0-1 por OSC; Chataigne con su rango real
		function rangeArg(e) {
			if (e.source == "resolume") return { type: "VALUE", value: "x", conversion: "FLOAT", min: 0, max: 1 };
			return { type: "VALUE", value: "x", conversion: e.valuetype == "ParamInteger" ? "INTEGER" : "FLOAT", min: e.min, max: e.max };
		}

		function frameOf(w, page) {
			var cw = W / layout.cols, ch = (H - TAB) / layout.rows, g = 3;
			return { x: w.x * cw + g, y: w.y * ch + g, w: w.w * cw - 2 * g, h: w.h * ch - 2 * g };
		}
		function sub(f, x, y, w, h) { return { x: f.x + x, y: f.y + y, w: w, h: h }; }
		function label(text, f, opts) {
			opts = opts || {};
			return node("LABEL", {
				name: name("label"), frame: f, color: { r: 0, g: 0, b: 0, a: 0 },
				props: { background: ["b", 0], outline: ["b", 0], textSize: ["i", opts.size || 14], textAlignH: ["i", opts.align || 2], textColor: ["c", opts.color || { r: 1, g: 1, b: 1, a: 1 }] },
				values: { text: text }, messages: opts.messages
			});
		}
		function color(w) { return w.color ? rgba(w.color) : accent; }

		function button(w, f, path, text) {
			var e = entry(path), o = w.opts || {}, out = [];
			var bt = 0, args, msgs = [];
			if (!e) {
				out.push(node("BUTTON", { name: name(text), frame: f, color: color(w) }));
			} else {
				if (e.valuetype == "ParamBoolean" && o.mode != "momentary") bt = 2;
				if (e.valuetype == "ParamRange" || e.valuetype == "ParamInteger" || e.valuetype == "ParamNumber") {
					var v = o.value != null ? Number(o.value) : 1;
					if (e.source == "resolume" && comp) {
						var r = C.resolve(comp, path);
						if (r && r.param && r.param.max != r.param.min) v = (v - r.param.min) / (r.param.max - r.param.min);
					}
					args = [{ type: "CONSTANT", value: num(v), conversion: "FLOAT" }];
					msgs.push(osc(e.address, "x", args, true, false));
				} else if (e.valuetype == "ParamChoice") {
					args = [{ type: "CONSTANT", value: String(o.index || 0), conversion: "INTEGER" }];
					msgs.push(osc(e.address, "x", args, true, false));
				} else {
					msgs.push(osc(e.address, "x", [{ type: "VALUE", value: "x", conversion: "FLOAT", min: 0, max: 1 }]));
				}
				out.push(node("BUTTON", { name: name(text), frame: f, color: color(w), props: { buttonType: ["i", bt] }, messages: msgs }));
			}
			if (text) out.push(label(text, sub(f, 4, f.h - 22, f.w - 8, 20), { size: 12, align: 0 }));
			return out;
		}
		function fader(w, f, path, text, horiz, readonly) {
			var e = entry(path), out = [];
			var msgs = e ? [osc(e.address, "x", [rangeArg(e)], !readonly, true)] : [];
			var lab = text ? 18 : 0;
			out.push(node("FADER", {
				name: name(text), frame: sub(f, 0, lab, f.w, f.h - lab), color: color(w),
				props: { orientation: ["i", horiz ? 1 : 0], interactive: ["b", !readonly] }, messages: msgs
			}));
			if (text) out.push(label(text, sub(f, 0, 0, f.w, 16), { size: 11 }));
			return out;
		}

		function widget(w) {
			var f = frameOf(w), o = w.opts || {}, i, out = [];
			var text = w.label || (w.bind ? (CS.isPath(w.bind) ? CS.address(w.bind).split("/").pop() : w.bind.split("/").pop()) : "");
			switch (w.type) {
				case "label":
					return [label(w.label || "Texto", f, { size: o.size ? parseInt(o.size, 10) : 16, align: o.align == "center" ? 2 : o.align == "right" ? 1 : 0 })];
				case "value": {
					var e = entry(w.bind);
					out.push(node("BOX", { name: name("box"), frame: f, color: dim, props: { outline: ["b", 0] } }));
					out.push(label(text, sub(f, 6, 2, f.w - 12, 16), { size: 11, align: 0, color: { r: 0.7, g: 0.72, b: 0.75, a: 1 } }));
					var am = e ? [osc(e.address, "x", [{ type: "VALUE", value: "text", conversion: "STRING" }], false, true)] : [];
					out.push(label("—", sub(f, 6, 18, f.w - 12, f.h - 20), { size: 20, align: 0, color: color(w), messages: am }));
					return out;
				}
				case "button":
					return button(w, f, w.bind, text);
				case "lamp": {
					var el = entry(w.bind);
					out.push(node("BUTTON", { name: name(text), frame: sub(f, 4, f.h / 2 - 11, 22, 22), color: color(w), props: { interactive: ["b", 0], shape: ["i", 2] }, messages: el ? [osc(el.address, "x", [{ type: "VALUE", value: "x", conversion: "FLOAT", min: 0, max: 1 }], false, true)] : [] }));
					out.push(label(text, sub(f, 32, 0, f.w - 34, f.h), { size: 12, align: 0 }));
					return out;
				}
				case "fader":
					return fader(w, f, w.bind, text, o.orientation == "h", false);
				case "meter":
					return fader(w, f, w.bind, text, o.orientation != "v", true);
				case "knob": {
					var ek = entry(w.bind);
					out.push(node("RADIAL", { name: name(text), frame: sub(f, 0, 0, f.w, f.h - 16), color: color(w), messages: ek ? [osc(ek.address, "x", [rangeArg(ek)])] : [] }));
					out.push(label(text, sub(f, 0, f.h - 16, f.w, 16), { size: 11 }));
					return out;
				}
				case "xy": {
					var ex = entry(w.bind), ey = entry(w.bind2), m = [];
					if (ex) m.push(osc(ex.address, "x", [rangeArg(ex)]));
					if (ey) m.push(osc(ey.address, "y", [Object.assign(rangeArg(ey), { value: "y" })]));
					return [node("XY", { name: name(text), frame: f, color: color(w), messages: m })];
				}
				case "choice": {
					var ec = entry(w.bind);
					var opts = (ec && ec.options) || ["A", "B", "C"];
					out.push(node("RADIO", {
						name: name(text), frame: sub(f, 0, 16, f.w, f.h - 16), color: color(w),
						props: { steps: ["i", opts.length], orientation: ["i", 1] },
						messages: ec ? [osc(ec.address, "x", [{ type: "VALUE", value: "x", conversion: "INTEGER", min: 0, max: opts.length - 1 }])] : []
					}));
					out.push(label(text, sub(f, 0, 0, f.w, 16), { size: 11, align: 0 }));
					var sw = f.w / opts.length;
					opts.forEach(function (op, k) { out.push(label(op, sub(f, k * sw, 16, sw, f.h - 16), { size: 11 })); });
					return out;
				}
				case "clipgrid":
				case "columns": {
					var cols = Math.max(1, o.cols || 8), n = Math.max(1, o.count || 8), rows = Math.ceil(n / cols), first = o.first || 1;
					var cw = f.w / cols, chh = f.h / rows;
					for (i = 0; i < n; i++) {
						var cf = sub(f, (i % cols) * cw + 2, Math.floor(i / cols) * chh + 2, cw - 4, chh - 4);
						var path = w.type == "clipgrid" ? "/composition/layers/" + (o.layer || 1) + "/clips/" + (first + i) + "/connect" : "/composition/columns/" + (first + i) + "/connect";
						var nm = "";
						var rr = comp ? C.resolve(comp, path) : null;
						if (rr && rr.target && rr.target.name) nm = rr.target.name.value || "";
						if (!nm) nm = w.type == "clipgrid" ? (o.layer || 1) + "·" + (first + i) : "Col " + (first + i);
						out = out.concat(button({ color: w.color }, cf, path, nm));
					}
					return out;
				}
				case "layer": {
					var L = "/composition/layers/" + (o.layer || 1);
					var ln = comp && comp.layers && comp.layers[(o.layer || 1) - 1];
					var lname = w.label || (ln && ln.name && ln.name.value) || "Capa " + (o.layer || 1);
					var bh = Math.min(40, f.h / 8);
					out.push(label(lname, sub(f, 0, 0, f.w, 18), { size: 13, color: color(w) }));
					out = out.concat(fader(w, sub(f, 0, 20, f.w, f.h - 20 - 3 * (bh + 3)), L + (o.fader == "master" ? "/master" : "/video/opacity"), "", false, false));
					[["/bypassed", "BYP"], ["/solo", "SOLO"], ["/clear", "CLR"]].forEach(function (b, k) {
						out = out.concat(button(w, sub(f, 0, f.h - (3 - k) * (bh + 3), f.w, bh), L + b[0], b[1]));
					});
					return out;
				}
				case "tempo": {
					var T2 = "/composition/tempocontroller/";
					out.push(label(w.label || "TEMPO", sub(f, 0, 0, f.w, 20), { size: 13, align: 0, color: color(w) }));
					var bw = f.w / 4;
					[["tempo_tap", "TAP"], ["resync", "RESYNC"], ["tempo_pull", "−"], ["tempo_push", "+"]].forEach(function (b, k) {
						out = out.concat(button(w, sub(f, k * bw + 2, 22, bw - 4, f.h - 24), T2 + b[0], b[1]));
					});
					return out;
				}
			}
			return out;
		}

		var pages = layout.pages.map(function (p) {
			var kids = [];
			p.widgets.forEach(function (w) { kids = kids.concat(widget(w)); });
			return node("GROUP", {
				name: p.name, frame: { x: 0, y: TAB, w: W, h: H - TAB }, color: { r: 0.07, g: 0.07, b: 0.08, a: 1 },
				props: { outline: ["b", 0] }, children: kids
			});
		});
		var content = multi
			? [node("PAGER", { name: "paginas", frame: { x: 0, y: 0, w: W, h: H }, color: { r: 0.15, g: 0.16, b: 0.18, a: 1 }, props: { tabbarSize: ["i", TAB] }, children: pages })]
			: pages;
		var root = node("GROUP", { name: layout.name, frame: { x: 0, y: 0, w: W, h: H }, color: { r: 0, g: 0, b: 0, a: 1 }, props: { outline: ["b", 0] }, children: content });
		return {
			xml: "<?xml version='1.0' encoding='UTF-8'?><lexml version='3'>" + root + "</lexml>",
			map: map,
			warnings: warnings.filter(function (x, i, a) { return a.indexOf(x) == i; })
		};
	};

	// Datos para el script touchosc.js de Chataigne
	T.mapJSON = function (built, layout) {
		return JSON.stringify({ format: "touchosc-map", version: 1, name: layout.name, chataigne: built.map.chataigne, polls: built.map.polls }, null, 1) + "\n";
	};

})(typeof module != "undefined" && module.exports ? module.exports : (window.TouchOSCExport = {}),
	typeof module != "undefined" && module.exports ? require("./catalog") : window.RemoteCatalog,
	typeof module != "undefined" && module.exports ? require("./chataigne") : window.ChataigneSource);
