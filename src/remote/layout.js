// Formato del remote, comprobaciones y asistente que lo genera.
// Se usa en el navegador (window.RemoteLayout) y en Node (pruebas). Necesita RemoteCatalog.
//
// Un remote es:
//   { format: "resolume-remote", version: 1, name, host, device, cols, rows, accent,
//     pages: [{ id, name, widgets: [{ id, type, x, y, w, h, label, color, bind, bind2, opts }] }] }
// x, y, w, h van en celdas de una rejilla de cols × rows que ocupa toda la pantalla.
(function (L, C, CS) {
	"use strict";

	L.DEVICES = {
		"phone-v": { name: "Móvil vertical", cols: 6, rows: 10, w: 390, h: 760 },
		"phone-h": { name: "Móvil horizontal", cols: 10, rows: 5, w: 760, h: 350 },
		"tablet-h": { name: "Tablet horizontal", cols: 12, rows: 8, w: 1024, h: 700 },
		"tablet-v": { name: "Tablet vertical", cols: 8, rows: 12, w: 700, h: 1024 },
		"desktop": { name: "Ordenador", cols: 16, rows: 9, w: 1280, h: 720 }
	};
	L.WIDGET_TYPES = ["button", "fader", "knob", "xy", "choice", "clipgrid", "columns", "layer", "tempo", "value", "meter", "lamp", "label"];
	L.MIN_TOUCH = 40; // px: menos que esto cuesta acertar con el dedo

	var nextId = 1;
	function uid() { return "w" + Date.now().toString(36) + (nextId++).toString(36); }
	L.uid = uid;
	function int(v, d, min, max) {
		var n = parseInt(v, 10);
		if (isNaN(n)) n = d;
		if (min !== undefined && n < min) n = min;
		if (max !== undefined && n > max) n = max;
		return n;
	}

	L.normalizeWidget = function (w, cols, rows) {
		w = w || {};
		var o = {
			id: String(w.id || uid()),
			type: L.WIDGET_TYPES.indexOf(w.type) >= 0 ? w.type : "label",
			w: int(w.w, 2, 1, cols), h: int(w.h, 1, 1, rows),
			label: String(w.label || ""),
			color: /^#[0-9a-f]{6}$/i.test(w.color || "") ? w.color : "",
			bind: String(w.bind || ""),
			opts: {}
		};
		o.x = int(w.x, 0, 0, cols - o.w);
		o.y = int(w.y, 0, 0, rows - o.h);
		if (o.type == "xy") o.bind2 = String(w.bind2 || "");
		var src = w.opts || {};
		Object.keys(src).forEach(function (k) {
			var v = src[k];
			if (typeof v == "number" || typeof v == "boolean" || typeof v == "string") o.opts[k] = v;
		});
		return o;
	};

	L.normalize = function (l) {
		l = l || {};
		var dev = L.DEVICES[l.device] ? l.device : "tablet-h";
		var cols = int(l.cols, L.DEVICES[dev].cols, 2, 32), rows = int(l.rows, L.DEVICES[dev].rows, 2, 32);
		var pages = (Array.isArray(l.pages) && l.pages.length ? l.pages : [{ name: "Principal" }]).map(function (p, i) {
			return {
				id: String(p.id || "p" + (i + 1)),
				name: String(p.name || "Página " + (i + 1)),
				widgets: (p.widgets || []).map(function (w) { return L.normalizeWidget(w, cols, rows); })
			};
		});
		return {
			format: "resolume-remote", version: 1,
			name: String(l.name || "Mi remote"),
			host: String(l.host || ""),
			chataigneHost: String(l.chataigneHost || ""),
			device: dev, cols: cols, rows: rows,
			accent: /^#[0-9a-f]{6}$/i.test(l.accent || "") ? l.accent : "#ffb000",
			pages: pages
		};
	};

	// Qué fuentes usa un remote: {resolume, chataigne}
	L.sources = function (layout) {
		var r = false, c = false;
		layout.pages.forEach(function (p) {
			p.widgets.forEach(function (w) {
				if (["clipgrid", "columns", "layer", "tempo"].indexOf(w.type) >= 0) r = true;
				[w.bind, w.bind2].forEach(function (b) {
					if (!b) return;
					if (CS.isPath(b)) c = true; else r = true;
				});
			});
		});
		return { resolume: r, chataigne: c };
	};

	// Tamaño mínimo razonable de cada tipo (en celdas)
	L.minSize = function (type) {
		return { clipgrid: [2, 1], columns: [2, 1], layer: [1, 3], tempo: [3, 2], xy: [2, 2], fader: [1, 2] }[type] || [1, 1];
	};

	// ---------- huecos libres ----------

	function occupied(page, cols, rows, ignoreId) {
		var g = [];
		for (var y = 0; y < rows; y++) { g.push([]); for (var x = 0; x < cols; x++) g[y].push(null); }
		page.widgets.forEach(function (w) {
			if (w.id == ignoreId) return;
			for (var y = w.y; y < Math.min(rows, w.y + w.h); y++) for (var x = w.x; x < Math.min(cols, w.x + w.w); x++) g[y][x] = w.id;
		});
		return g;
	}
	L.fits = function (page, cols, rows, x, y, w, h, ignoreId) {
		if (x < 0 || y < 0 || x + w > cols || y + h > rows) return false;
		var g = occupied(page, cols, rows, ignoreId);
		for (var j = y; j < y + h; j++) for (var i = x; i < x + w; i++) if (g[j][i]) return false;
		return true;
	};
	// Primer hueco de w×h (de arriba abajo, de izquierda a derecha); prefiere (px, py) si cabe
	L.findSpot = function (page, cols, rows, w, h, px, py) {
		if (px !== undefined && L.fits(page, cols, rows, px, py, w, h)) return { x: px, y: py };
		for (var y = 0; y <= rows - h; y++) for (var x = 0; x <= cols - w; x++) if (L.fits(page, cols, rows, x, y, w, h)) return { x: x, y: y };
		return null;
	};

	// ---------- comprobaciones (el asistente las enseña mientras diseñas) ----------

	// Devuelve [{level: "error"|"aviso"|"consejo", msg, page, widget, fix?}]
	L.check = function (layout, comp, tree) {
		var res = [];
		var dev = L.DEVICES[layout.device] || L.DEVICES["tablet-h"];
		var cellW = dev.w / layout.cols, cellH = dev.h / layout.rows;
		function add(level, msg, pi, w, fix) { res.push({ level: level, msg: msg, page: pi, widget: w ? w.id : null, fix: fix || null }); }
		function where(p, w) { return "«" + p.name + "» · " + (w.label || typeName(w.type)); }
		var bindsSeen = {};
		layout.pages.forEach(function (p, pi) {
			if (!p.widgets.length) add("consejo", "La página «" + p.name + "» está vacía: arrastra controles o usa el asistente.", pi);
			var g = {};
			p.widgets.forEach(function (w) {
				var needs = ["button", "fader", "knob", "xy", "choice", "value", "meter", "lamp"].indexOf(w.type) >= 0;
				if (needs && !w.bind) add("aviso", where(p, w) + ": no está conectado a nada. Arrástrale un parámetro o elígelo en el panel de la derecha.", pi, w);
				if (w.type == "xy" && !w.bind2) add("aviso", where(p, w) + ": falta el parámetro del eje vertical.", pi, w);
				[w.bind, w.bind2].forEach(function (b) {
					if (b && CS.isPath(b) && tree && !CS.resolve(tree, b)) add("error", where(p, w) + ": «" + CS.address(b) + "» no existe en Chataigne (¿has renombrado o borrado el módulo?).", pi, w);
				});
				if (comp) {
					[w.bind, w.bind2].forEach(function (b) {
						if (b && !CS.isPath(b) && !C.resolve(comp, b)) add("error", where(p, w) + ": «" + b + "» no existe en la composición actual (¿has borrado o movido una capa?).", pi, w);
					});
					if (w.type == "clipgrid" && !C.resolve(comp, "/composition/layers/" + (w.opts.layer || 1) + "/clear")) add("error", where(p, w) + ": la capa " + (w.opts.layer || 1) + " no existe.", pi, w);
					if (w.type == "layer" && !C.resolve(comp, "/composition/layers/" + (w.opts.layer || 1) + "/clear")) add("error", where(p, w) + ": la capa " + (w.opts.layer || 1) + " no existe.", pi, w);
				}
				if (w.x + w.w > layout.cols || w.y + w.h > layout.rows) add("error", where(p, w) + ": se sale de la pantalla.", pi, w, "fit");
				var unitW = cellW * w.w, unitH = cellH * w.h;
				if (w.type == "clipgrid" || w.type == "columns") {
					var c = Math.max(1, w.opts.cols || 8), n = Math.max(1, w.opts.count || 8);
					unitW = cellW * w.w / c; unitH = cellH * w.h / Math.ceil(n / c);
				}
				if (w.type != "label" && (unitW < L.MIN_TOUCH || unitH < L.MIN_TOUCH * 0.75)) add("consejo", where(p, w) + ": queda pequeño para el dedo en " + dev.name.toLowerCase() + " (" + Math.round(unitW) + "×" + Math.round(unitH) + " px).", pi, w);
				for (var y = w.y; y < w.y + w.h; y++) for (var x = w.x; x < w.x + w.w; x++) {
					var k = x + "," + y;
					if (g[k] && g[k] != w.id) { add("aviso", where(p, w) + " se monta encima de otro control.", pi, w); y = w.y + w.h; break; }
					g[k] = w.id;
				}
				if (w.bind && (w.type == "fader" || w.type == "knob")) {
					if (bindsSeen[w.bind]) add("consejo", where(p, w) + ": hay otro control para el mismo parámetro (" + bindsSeen[w.bind] + "). Está bien si es a propósito.", pi, w);
					else bindsSeen[w.bind] = where(p, w);
				}
			});
		});
		return res;
	};

	function typeName(t) {
		return { button: "Botón", fader: "Fader", knob: "Knob", xy: "Pad XY", choice: "Selector", clipgrid: "Rejilla de clips", columns: "Columnas", layer: "Tira de capa", tempo: "Tempo", value: "Valor", meter: "Medidor", lamp: "Indicador", label: "Texto" }[t] || t;
	}
	L.typeName = typeName;

	// Encoge o mueve los controles que se salen (al cambiar de dispositivo)
	L.fit = function (layout) {
		layout.pages.forEach(function (p) {
			p.widgets.forEach(function (w) {
				w.w = Math.min(w.w, layout.cols); w.h = Math.min(w.h, layout.rows);
				w.x = Math.min(w.x, layout.cols - w.w); w.y = Math.min(w.y, layout.rows - w.h);
			});
		});
		return layout;
	};
	// Reescala todas las posiciones a otro tamaño de rejilla
	L.rescale = function (layout, cols, rows) {
		var fx = cols / layout.cols, fy = rows / layout.rows;
		layout.pages.forEach(function (p) {
			p.widgets.forEach(function (w) {
				var x2 = Math.round((w.x + w.w) * fx), y2 = Math.round((w.y + w.h) * fy);
				w.x = Math.round(w.x * fx); w.y = Math.round(w.y * fy);
				w.w = Math.max(1, x2 - w.x); w.h = Math.max(1, y2 - w.y);
			});
		});
		layout.cols = cols; layout.rows = rows;
		return L.fit(layout);
	};

	// ---------- asistente: crear un remote a partir de unas elecciones ----------

	// choices: {
	//   clipLayers: [1, 2],       capas con rejilla de clips
	//   clipsPerLayer: 8,
	//   columns: true,            fila de columnas
	//   mixLayers: [1, 2, 3],     tiras de capa (opacidad, bypass, solo, vaciar)
	//   tempo: true, master: true (master, crossfader, limpiar todo, blackout)
	//   effectsLayer: 1,          página con los efectos de esa capa
	//   clipControls: true        página con velocidad, dirección, R/G/B... del clip seleccionado de la capa 1
	// }
	L.generate = function (comp, choices, device, name, tree) {
		var dev = L.DEVICES[device] || L.DEVICES["tablet-h"];
		var cols = dev.cols, rows = dev.rows;
		var pages = [];
		var ch = choices || {};
		function page(n) { var p = { id: "p" + (pages.length + 1), name: n, widgets: [] }; pages.push(p); return p; }
		function put(p, w) {
			var spot = L.findSpot(p, cols, rows, w.w, w.h);
			if (!spot) return false;
			w.x = spot.x; w.y = spot.y; w.id = uid();
			p.widgets.push(L.normalizeWidget(w, cols, rows));
			return true;
		}
		function layerName(i) { var l = comp && comp.layers && comp.layers[i - 1]; return (l && l.name && l.name.value) || "Capa " + i; }
		function clipCount(i) { var l = comp && comp.layers && comp.layers[i - 1]; return l && l.clips ? l.clips.length : 8; }

		// Clips: una franja por capa; si no caben, más páginas
		var clipLayers = (ch.clipLayers || []).filter(function (i) { return i > 0; });
		if (clipLayers.length) {
			var per = Math.max(1, Math.min(ch.clipsPerLayer || 8, 16));
			var labelW = cols >= 8 ? 2 : 0;
			var gridW = cols - labelW;
			var gridCols = Math.min(per, gridW >= 8 ? 8 : gridW);
			var bandH = Math.max(1, Math.ceil(per / gridCols));
			var top = ch.columns ? 1 : 0;
			// si sobra altura, franjas más altas (botones más fáciles de tocar)
			bandH = Math.max(bandH, Math.min(3, Math.floor((rows - top) / Math.min(clipLayers.length, Math.max(1, Math.floor((rows - top) / bandH))))));
			var perPage = Math.max(1, Math.floor((rows - top) / bandH));
			for (var start = 0; start < clipLayers.length; start += perPage) {
				var p = page(clipLayers.length > perPage ? "Clips " + (start / perPage + 1) : "Clips");
				if (ch.columns) put(p, { type: "columns", w: cols, h: 1, opts: { first: 1, count: Math.min(cols, Math.max(1, (comp && comp.columns ? comp.columns.length : 8))), cols: cols } });
				clipLayers.slice(start, start + perPage).forEach(function (li) {
					var count = Math.min(per, clipCount(li));
					if (labelW) put(p, { type: "label", w: labelW, h: bandH, label: layerName(li) });
					put(p, { type: "clipgrid", w: gridW, h: bandH, opts: { layer: li, first: 1, count: count, cols: Math.min(gridCols, count) } });
				});
			}
		}

		// Mezcla: arriba tempo y botones generales; debajo una tira por capa y el master
		var mix = (ch.mixLayers || []).filter(function (i) { return i > 0; });
		if (mix.length || ch.tempo || ch.master) {
			var pm = page("Mezcla");
			var topH = ch.tempo || ch.master ? Math.min(2, rows - 2) : 0;
			var x = 0;
			function at(w) { w.id = uid(); pm.widgets.push(L.normalizeWidget(w, cols, rows)); x = w.x + w.w; }
			if (ch.tempo) at({ type: "tempo", x: 0, y: 0, w: Math.min(cols, Math.max(3, Math.floor(cols / 2))), h: topH });
			if (ch.master) {
				[["Limpiar todo", "/composition/disconnect-all", ""], ["Blackout", "/composition/bypassed", "#ff5a52"]].forEach(function (b) {
					if (x + 2 <= cols) at({ type: "button", x: x, y: 0, w: 2, h: topH, label: b[0], bind: b[1], color: b[2] });
				});
				if (cols - x >= 2 && comp && comp.crossfader && comp.crossfader.phase) at({ type: "fader", x: x, y: 0, w: cols - x, h: topH, label: "Crossfader", bind: "/composition/crossfader/phase", opts: { orientation: "h" } });
			}
			var avail = cols - (ch.master ? 1 : 0);
			var stripW = Math.max(1, Math.min(2, Math.floor(avail / Math.max(1, mix.length))));
			var stripH = rows - topH;
			x = 0;
			mix.forEach(function (li) { if (x + stripW <= avail) at({ type: "layer", x: x, y: topH, w: stripW, h: stripH, opts: { layer: li, fader: "opacity" } }); });
			if (ch.master) at({ type: "fader", x: cols - 1, y: topH, w: 1, h: stripH, label: "Master", bind: "/composition/master" });
		}

		// Efectos de una capa
		if (ch.effectsLayer && comp) {
			var lay = comp.layers && comp.layers[ch.effectsLayer - 1];
			var entries = C.walk(comp).filter(function (e) {
				return e.kind == "param" && !e.advanced && e.path.indexOf("/composition/layers/" + ch.effectsLayer + "/video/effects/") == 0;
			});
			if (lay) {
				var pe = page("Efectos · " + layerName(ch.effectsLayer));
				var lastGroup = "";
				entries.forEach(function (e) {
					if (e.group != lastGroup) {
						lastGroup = e.group;
						put(pe, { type: "label", w: Math.min(cols, 4), h: 1, label: e.group.split(" › ").pop().replace("Efecto ", "") });
					}
					var t = e.valuetype == "ParamRange" || e.valuetype == "ParamInteger" ? "knob" : e.valuetype == "ParamChoice" ? "choice" : e.valuetype == "ParamBoolean" || e.valuetype == "ParamEvent" ? "button" : null;
					if (!t) return;
					put(pe, { type: t, w: t == "choice" ? Math.min(cols, 4) : 2, h: t == "choice" ? 1 : 2, label: e.label, bind: e.path });
				});
				if (!entries.length) put(pe, { type: "label", w: cols, h: 1, label: "Esta capa no tiene efectos en la composición leída." });
			}
		}

		// Clip seleccionado: no tiene ruta fija, así que se hace sobre el clip activo de la capa 1…
		// En Resolume no hay "clip seleccionado" en el WebSocket por ruta: se usa la capa elegida.
		if (ch.clipControls && comp) {
			var li2 = ch.clipControlsLayer || 1;
			var lay2 = comp.layers && comp.layers[li2 - 1];
			if (lay2) {
				var pc = page("Clips · ajustes");
				(lay2.clips || []).slice(0, ch.clipsPerLayer || 8).forEach(function (cl, j) {
					if (!cl.connected || cl.connected.value == "Empty" || !cl.transport) return;
					var base = "/composition/layers/" + li2 + "/clips/" + (j + 1);
					var n = (cl.name && cl.name.value) || "Clip " + (j + 1);
					put(pc, { type: "label", w: 2, h: 1, label: n });
					if (cl.transport.controls && cl.transport.controls.speed) put(pc, { type: "knob", w: 2, h: 2, label: "Velocidad", bind: base + "/transport/controls/speed" });
					if (cl.transport.controls && cl.transport.controls.playdirection) put(pc, { type: "choice", w: 3, h: 1, label: "Dirección", bind: base + "/transport/controls/playdirection" });
				});
			}
		}

		// Chataigne: lo marcado (variables, valores de destinos como Sunlite, secuencias, estados...)
		var chPaths = ch.chataignePaths || [];
		if (chPaths.length && tree) {
			var pc2 = page("Chataigne");
			var lastG = "";
			chPaths.forEach(function (path) {
				var r = CS.resolve(tree, path);
				if (!r) return;
				var n = CS.node(tree, CS.address(path));
				var vt = r.param.valuetype, ro = r.param.readonly;
				var t = vt == "ParamEvent" ? "button" : vt == "ParamBoolean" ? (ro ? "lamp" : "button") : vt == "ParamChoice" ? "choice" :
					vt == "ParamRange" || vt == "ParamInteger" ? (ro ? "meter" : "fader") : "value";
				var size = { button: [2, 2], lamp: [2, 1], choice: [Math.min(cols, 4), 1], fader: [Math.min(cols, 4), 1], meter: [Math.min(cols, 3), 1], value: [2, 1] }[t];
				var opts = t == "fader" ? { orientation: "h" } : {};
				var grp = CS.address(path).split("/").slice(0, -1).join("/");
				if (grp != lastG) {
					lastG = grp;
					var parent = CS.node(tree, grp);
					if (!put(pc2, { type: "label", w: cols, h: 1, label: (parent && parent.DESCRIPTION) || grp })) pc2 = page("Chataigne " + (pages.length));
				}
				if (!put(pc2, { type: t, w: size[0], h: size[1], label: (n && n.DESCRIPTION) || "", bind: path, opts: opts })) {
					pc2 = page("Chataigne " + pages.length);
					put(pc2, { type: t, w: size[0], h: size[1], label: (n && n.DESCRIPTION) || "", bind: path, opts: opts });
				}
			});
		}

		if (!pages.length) page("Principal");
		return L.normalize({ name: name || "Mi remote", device: device, cols: cols, rows: rows, pages: pages });
	};

})(typeof module != "undefined" && module.exports ? module.exports : (window.RemoteLayout = {}),
	typeof module != "undefined" && module.exports ? require("./catalog") : window.RemoteCatalog,
	typeof module != "undefined" && module.exports ? require("./chataigne") : window.ChataigneSource);
