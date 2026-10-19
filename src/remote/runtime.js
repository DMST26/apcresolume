// Motor del remote: conexión con Resolume por WebSocket y los controles en pantalla.
// Lo usan el remote exportado (remote.html) y el constructor (vista previa y «Probar").
// Necesita RemoteCatalog (catalog.js). Sin dependencias.
(function (R) {
	"use strict";

	const C = window.RemoteCatalog;

	// ---------- conexión ----------

	// host = "ip:puerto". Con sim (ResolumeSim.create(...)) no hay red: todo va al simulador.
	R.Connection = function (opts) {
		const self = this;
		let ws = null, simLink = null, retry = 1000, timer = null, closed = false;
		self.composition = null;
		self.connected = false;
		self.host = opts.host;
		const params = {};          // id -> último objeto parámetro conocido
		const listeners = {};       // id -> [fn]
		let subscribed = {};        // id -> true

		function emitStatus() { if (opts.onStatus) opts.onStatus(self.connected); }
		function handle(m) {
			if (typeof m == "string") { try { m = JSON.parse(m); } catch (e) { return; } }
			if (!m || typeof m != "object") return;
			if (typeof m.type != "string") {
				if (m.layers && m.columns) {
					self.composition = m;
					indexParams(m);
					subscribed = {};
					if (opts.onComposition) opts.onComposition(m);
				}
				return;
			}
			if (m.type == "thumbnail_update" && opts.onThumbnail) { opts.onThumbnail(m.value); return; }
			if (/^parameter_(update|set|get|subscribed)$/.test(m.type) && m.id !== undefined) {
				const p = params[m.id] || {};
				Object.keys(m).forEach((k) => { if (k != "type" && k != "path") p[k] = m[k]; });
				params[m.id] = p;
				(listeners[m.id] || []).forEach((fn) => fn(p));
			}
		}
		function indexParams(o) {
			if (!o || typeof o != "object") return;
			if (Array.isArray(o)) { o.forEach(indexParams); return; }
			if (typeof o.valuetype == "string" && o.id !== undefined) params[o.id] = o;
			Object.keys(o).forEach((k) => { if (k != "options") indexParams(o[k]); });
		}
		function send(m) {
			if (simLink) { simLink.receive(JSON.parse(JSON.stringify(m))); return; }
			if (ws && ws.readyState == 1) ws.send(JSON.stringify(m));
		}

		self.connect = function () {
			closed = false;
			if (opts.sim) {
				simLink = opts.sim.connect((m) => setTimeout(() => handle(JSON.parse(JSON.stringify(m))), 0));
				self.connected = true;
				emitStatus();
				return;
			}
			try { ws = new WebSocket("ws://" + self.host + "/api/v1"); }
			catch (e) { schedule(); return; }
			ws.onopen = () => { self.connected = true; retry = 1000; emitStatus(); };
			ws.onmessage = (e) => handle(e.data);
			ws.onclose = ws.onerror = () => {
				if (ws) { ws.onclose = ws.onerror = null; }
				const was = self.connected;
				self.connected = false;
				if (was || !timer) emitStatus();
				schedule();
			};
		};
		function schedule() {
			if (closed || timer) return;
			timer = setTimeout(() => { timer = null; self.connect(); }, retry);
			retry = Math.min(retry * 2, 8000);
		}
		self.close = function () {
			closed = true;
			clearTimeout(timer); timer = null;
			if (ws) { ws.onclose = ws.onerror = null; try { ws.close(); } catch (e) { /* ya cerrado */ } ws = null; }
			if (simLink) { simLink.close(); simLink = null; }
			self.connected = false;
		};
		self.param = (id) => params[id];
		self.on = function (id, fn) {
			(listeners[id] = listeners[id] || []).push(fn);
			if (!subscribed[id]) { subscribed[id] = true; send({ action: "subscribe", parameter: "/parameter/by-id/" + id }); }
			return () => { const l = listeners[id]; if (l) l.splice(l.indexOf(fn), 1); };
		};
		self.clearListeners = function () { Object.keys(listeners).forEach((k) => { listeners[k] = []; }); };
		self.set = (id, value) => send({ action: "set", parameter: "/parameter/by-id/" + id, value: value });
		self.reset = (id) => send({ action: "reset", parameter: "/parameter/by-id/" + id });
		self.trigger = (path, value) => send({ action: "trigger", parameter: path, value: value });
		self.thumbUrl = function (clip) {
			if (opts.sim || !clip || !clip.id) return "";
			const t = clip.thumbnail || {};
			if (t.is_default || !t.last_update) return "";
			return "http://" + self.host + "/api/v1/composition/clips/by-id/" + clip.id + "/thumbnail/" + t.last_update;
		};
	};

	// Lee la composición una vez por WebSocket (funciona también desde un archivo local, sin CORS).
	R.fetchComposition = function (host, timeoutMs) {
		return new Promise((resolve, reject) => {
			let ws, done = false;
			const t = setTimeout(() => finish(new Error("Resolume no contesta en " + host)), timeoutMs || 5000);
			function finish(err, comp) {
				if (done) return;
				done = true;
				clearTimeout(t);
				try { ws.close(); } catch (e) { /* nada */ }
				if (err) reject(err); else resolve(comp);
			}
			try { ws = new WebSocket("ws://" + host + "/api/v1"); } catch (e) { finish(e); return; }
			ws.onmessage = (e) => {
				try { const m = JSON.parse(e.data); if (m && m.layers && m.columns) finish(null, m); } catch (err) { /* sigue esperando */ }
			};
			ws.onerror = () => finish(new Error("No se pudo conectar con ws://" + host + "/api/v1"));
		});
	};

	// ---------- controles ----------

	R.TYPES = {
		button: { name: "Botón", w: 2, h: 2, accepts: ["Action", "ParamEvent", "ParamBoolean", "ParamRange", "ParamChoice"] },
		fader: { name: "Fader", w: 1, h: 4, accepts: ["ParamRange", "ParamInteger"] },
		knob: { name: "Knob", w: 2, h: 2, accepts: ["ParamRange", "ParamInteger"] },
		xy: { name: "Pad XY", w: 4, h: 4, accepts: ["ParamRange"] },
		choice: { name: "Selector", w: 4, h: 1, accepts: ["ParamChoice"] },
		clipgrid: { name: "Rejilla de clips", w: 8, h: 2, accepts: [] },
		columns: { name: "Columnas", w: 8, h: 1, accepts: [] },
		layer: { name: "Tira de capa", w: 2, h: 6, accepts: [] },
		tempo: { name: "Tempo", w: 4, h: 2, accepts: [] },
		value: { name: "Valor", w: 2, h: 1, accepts: ["ParamRange", "ParamInteger", "ParamChoice", "ParamString", "ParamText", "ParamBoolean"] },
		label: { name: "Texto", w: 4, h: 1, accepts: [] }
	};

	// Control adecuado para un tipo de parámetro (al arrastrar un parámetro al lienzo)
	R.typeFor = function (entry) {
		if (!entry) return "button";
		if (entry.valuetype == "ParamRange" || entry.valuetype == "ParamInteger") return entry.key == "phase" ? "fader" : "fader";
		if (entry.valuetype == "ParamChoice") return entry.key == "connected" ? "value" : "choice";
		if (entry.valuetype == "ParamString" || entry.valuetype == "ParamText") return "value";
		return "button";
	};

	function el(tag, cls, html) {
		const e = document.createElement(tag);
		if (cls) e.className = cls;
		if (html != null) e.innerHTML = html;
		return e;
	}
	function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
	function fmt(p) {
		if (!p) return "—";
		if (p.valuetype == "ParamChoice") return p.value;
		if (p.valuetype == "ParamBoolean") return p.value ? "On" : "Off";
		if (typeof p.value == "number") {
			const units = p.view && p.view.display_units;
			const v = Math.abs(p.max - p.min) <= 2 ? p.value.toFixed(2) : (Math.abs(p.value) >= 100 ? p.value.toFixed(1) : p.value.toFixed(2));
			return v + (units ? " " + units : "");
		}
		return String(p.value == null ? "" : p.value);
	}
	function norm(p) {
		if (!p || typeof p.value != "number" || p.max == p.min) return 0;
		return Math.max(0, Math.min(1, (p.value - p.min) / (p.max - p.min)));
	}
	function fromNorm(p, x) {
		x = Math.max(0, Math.min(1, x));
		let v = p.min + (p.max - p.min) * x;
		if (p.valuetype == "ParamInteger") v = Math.round(v);
		return v;
	}

	// Enlace de un control con un parámetro o una acción. ctx lo da la página.
	function bind(ctx, path) {
		const r = path ? ctx.resolve(path) : null;
		return {
			path: path, ok: !!r, kind: r && r.kind,
			param: r && r.kind == "param" ? ctx.param(r.param.id) || r.param : null,
			id: r && r.kind == "param" ? r.param.id : null,
			trigger: r && r.kind == "action" ? r.trigger : null,
			target: r && r.kind == "action" ? r.target : null
		};
	}

	// Pulsar con el dedo: down al tocar, up al soltar (aunque el dedo salga del control)
	function press(node, down, up) {
		node.addEventListener("pointerdown", (e) => {
			if (e.button > 0) return;
			e.preventDefault();
			try { node.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
			node.classList.add("down");
			down(e);
		});
		const end = (e) => {
			if (!node.classList.contains("down")) return;
			node.classList.remove("down");
			if (up) up(e);
		};
		node.addEventListener("pointerup", end);
		node.addEventListener("pointercancel", end);
	}

	// Arrastre continuo (faders, knobs, XY): fn(e, rect, start)
	function drag(node, fn, end) {
		let active = false, start = null;
		node.addEventListener("pointerdown", (e) => {
			if (e.button > 0) return;
			e.preventDefault();
			active = true;
			start = { x: e.clientX, y: e.clientY };
			try { node.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
			node.classList.add("down");
			fn(e, node.getBoundingClientRect(), start, true);
		});
		node.addEventListener("pointermove", (e) => { if (active) fn(e, node.getBoundingClientRect(), start, false); });
		const stop = () => { if (!active) return; active = false; node.classList.remove("down"); if (end) end(); };
		node.addEventListener("pointerup", stop);
		node.addEventListener("pointercancel", stop);
	}

	// Envío limitado a uno por fotograma
	function throttled(fn) {
		let pending = null, scheduled = false;
		return (v) => {
			pending = v;
			if (scheduled) return;
			scheduled = true;
			requestAnimationFrame(() => { scheduled = false; fn(pending); });
		};
	}
	// Doble toque
	function doubleTap(node, fn) {
		let last = 0;
		node.addEventListener("pointerdown", () => {
			const now = Date.now();
			if (now - last < 300) fn();
			last = now;
		});
	}

	const W = {};
	// control dentro de otro (rejilla, tempo, tira de capa)
	function part(inst) {
		inst.node.classList.add("rw");
		if (inst.missing) inst.node.classList.add("missing");
		return inst;
	}

	W.label = function (w) {
		const node = el("div", "rw-label", esc(w.label || "Texto"));
		node.style.fontSize = (w.opts && w.opts.size) || "";
		node.style.textAlign = (w.opts && w.opts.align) || "";
		return { node: node, update() {} };
	};

	W.value = function (w, ctx) {
		const b = bind(ctx, w.bind);
		const node = el("div", "rw-value", '<span class="rw-name"></span><span class="rw-big"></span>');
		node.querySelector(".rw-name").textContent = w.label || ctx.labelOf(w.bind);
		const big = node.querySelector(".rw-big");
		const update = () => { big.textContent = b.id != null ? fmt(ctx.param(b.id)) : "—"; };
		if (b.id != null) ctx.watch(b.id, update);
		return { node: node, update: update, missing: !b.ok && !!w.bind };
	};

	W.button = function (w, ctx) {
		const o = w.opts || {};
		const b = bind(ctx, w.bind);
		const node = el("div", "rw-button", '<div class="rw-thumb"></div><span class="rw-name"></span>');
		const nameEl = node.querySelector(".rw-name");
		const thumb = node.querySelector(".rw-thumb");
		nameEl.textContent = w.label || ctx.labelOf(w.bind) || "Botón";
		let lit = () => false;
		let fbId = null;

		if (b.kind == "action") {
			const t = b.target;
			if (/\/connect$/.test(b.trigger) && t && t.connected) {
				fbId = t.connected.id;
				lit = () => { const p = ctx.param(fbId); return p && (p.index >= 3 || p.value == "Connected"); };
				if (/\/clips\//.test(b.trigger) && o.thumb !== false) {
					const url = ctx.thumbUrl(t);
					if (url) thumb.style.backgroundImage = "url('" + url + "')";
					if (!w.label && t.name) nameEl.textContent = (t.name.value || "") || nameEl.textContent;
					const cp = ctx.param(fbId);
					if (cp && cp.index === 0) node.classList.add("empty");
				}
			} else if (/\/select$/.test(b.trigger) && t && t.selected) {
				fbId = t.selected.id;
				lit = () => { const p = ctx.param(fbId); return p && p.value === true; };
			}
			press(node, () => ctx.trigger(b.trigger, true), () => ctx.trigger(b.trigger, false));
		} else if (b.param) {
			const vt = b.param.valuetype;
			fbId = b.id;
			if (vt == "ParamEvent") press(node, () => ctx.set(b.id, true), () => ctx.set(b.id, false));
			else if (vt == "ParamBoolean") {
				lit = () => { const p = ctx.param(b.id); return p && p.value === true; };
				if (o.mode == "momentary") press(node, () => ctx.set(b.id, true), () => ctx.set(b.id, false));
				else press(node, () => { const p = ctx.param(b.id); ctx.set(b.id, !(p && p.value)); });
			} else if (vt == "ParamChoice") {
				const idx = o.index || 0;
				lit = () => { const p = ctx.param(b.id); return p && p.index == idx; };
				if (!w.label) nameEl.textContent = (b.param.options || [])[idx] || nameEl.textContent;
				press(node, () => ctx.set(b.id, idx));
			} else {
				const v = o.value != null ? Number(o.value) : (b.param.max != null ? b.param.max : 1);
				lit = () => { const p = ctx.param(b.id); return p && Math.abs(p.value - v) < 1e-6; };
				press(node, () => ctx.set(b.id, v));
			}
		} else {
			press(node, () => {});
		}
		const update = () => node.classList.toggle("on", !!lit());
		if (fbId != null) ctx.watch(fbId, update);
		return { node: node, update: update, missing: !b.ok && !!w.bind };
	};

	W.fader = function (w, ctx) {
		const o = w.opts || {};
		const b = bind(ctx, w.bind);
		const horiz = o.orientation == "h";
		const node = el("div", "rw-fader" + (horiz ? " h" : ""), '<span class="rw-name"></span><div class="rw-track"><div class="rw-fill"></div><div class="rw-cap"></div></div><span class="rw-num"></span>');
		node.querySelector(".rw-name").textContent = w.label || ctx.labelOf(w.bind) || "Fader";
		const fill = node.querySelector(".rw-fill"), cap = node.querySelector(".rw-cap"), num = node.querySelector(".rw-num");
		const track = node.querySelector(".rw-track");
		let dragging = false;
		const show = (x) => {
			if (horiz) { fill.style.width = x * 100 + "%"; fill.style.height = "100%"; cap.style.left = "calc(" + x * 100 + "% - 4px)"; }
			else { fill.style.height = x * 100 + "%"; cap.style.bottom = "calc(" + x * 100 + "% - 4px)"; }
		};
		const update = () => {
			if (b.id == null) { show(0.5); num.textContent = ""; return; }
			const p = ctx.param(b.id);
			if (!dragging) show(norm(p));
			num.textContent = o.showValue === false ? "" : fmt(p);
		};
		if (b.id != null) {
			const send = throttled((v) => ctx.set(b.id, v));
			drag(track, (e, r) => {
				dragging = true;
				const x = horiz ? (e.clientX - r.left) / r.width : 1 - (e.clientY - r.top) / r.height;
				const p = ctx.param(b.id);
				const v = fromNorm(p, x);
				show(norm({ value: v, min: p.min, max: p.max }));
				num.textContent = fmt({ valuetype: p.valuetype, value: v, min: p.min, max: p.max, view: p.view });
				send(v);
			}, () => { dragging = false; });
			doubleTap(track, () => ctx.reset(b.id));
			ctx.watch(b.id, update);
		}
		return { node: node, update: update, missing: !b.ok && !!w.bind };
	};

	W.knob = function (w, ctx) {
		const b = bind(ctx, w.bind);
		const node = el("div", "rw-knob", '<span class="rw-name"></span><svg viewBox="0 0 100 100"><path class="rw-arc-bg" d=""/><path class="rw-arc" d=""/></svg><span class="rw-num"></span>');
		node.querySelector(".rw-name").textContent = w.label || ctx.labelOf(w.bind) || "Knob";
		const arc = node.querySelector(".rw-arc"), bg = node.querySelector(".rw-arc-bg"), num = node.querySelector(".rw-num");
		const A0 = -135, A1 = 135;
		function path(a0, a1) {
			const r = 40, cx = 50, cy = 54;
			const p = (a) => [cx + r * Math.sin(a * Math.PI / 180), cy - r * Math.cos(a * Math.PI / 180)];
			const s = p(a0), e = p(a1);
			return "M" + s[0].toFixed(2) + " " + s[1].toFixed(2) + " A" + r + " " + r + " 0 " + (a1 - a0 > 180 ? 1 : 0) + " 1 " + e[0].toFixed(2) + " " + e[1].toFixed(2);
		}
		bg.setAttribute("d", path(A0, A1));
		let local = null;
		const show = (x) => arc.setAttribute("d", path(A0, A0 + Math.max(0.5, (A1 - A0) * x)));
		const update = () => {
			if (b.id == null) { show(0.5); num.textContent = ""; return; }
			const p = ctx.param(b.id);
			if (local == null) show(norm(p));
			num.textContent = fmt(p);
		};
		if (b.id != null) {
			const send = throttled((v) => ctx.set(b.id, v));
			let startX = 0;
			drag(node.querySelector("svg"), (e, r, start, first) => {
				const p = ctx.param(b.id);
				if (first) { startX = norm(p); local = startX; return; }
				local = Math.max(0, Math.min(1, startX + (start.y - e.clientY) / 200 + (e.clientX - start.x) / 400));
				show(local);
				const v = fromNorm(p, local);
				num.textContent = fmt({ valuetype: p.valuetype, value: v, min: p.min, max: p.max, view: p.view });
				send(v);
			}, () => { local = null; });
			doubleTap(node.querySelector("svg"), () => ctx.reset(b.id));
			ctx.watch(b.id, update);
		}
		return { node: node, update: update, missing: !b.ok && !!w.bind };
	};

	W.xy = function (w, ctx) {
		const bx = bind(ctx, w.bind), by = bind(ctx, w.bind2);
		const node = el("div", "rw-xy", '<span class="rw-name"></span><div class="rw-pad"><div class="rw-dot"></div></div>');
		node.querySelector(".rw-name").textContent = w.label || (ctx.labelOf(w.bind) + " / " + ctx.labelOf(w.bind2));
		const dot = node.querySelector(".rw-dot"), pad = node.querySelector(".rw-pad");
		let dragging = false;
		const show = (x, y) => { dot.style.left = x * 100 + "%"; dot.style.top = (1 - y) * 100 + "%"; };
		const update = () => {
			if (dragging) return;
			show(bx.id != null ? norm(ctx.param(bx.id)) : 0.5, by.id != null ? norm(ctx.param(by.id)) : 0.5);
		};
		const sx = throttled((v) => ctx.set(bx.id, v)), sy = throttled((v) => ctx.set(by.id, v));
		drag(pad, (e, r) => {
			dragging = true;
			const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height));
			show(x, y);
			if (bx.id != null) sx(fromNorm(ctx.param(bx.id), x));
			if (by.id != null) sy(fromNorm(ctx.param(by.id), y));
		}, () => { dragging = false; });
		if (bx.id != null) ctx.watch(bx.id, update);
		if (by.id != null) ctx.watch(by.id, update);
		return { node: node, update: update, missing: (!bx.ok && !!w.bind) || (!by.ok && !!w.bind2) };
	};

	W.choice = function (w, ctx) {
		const b = bind(ctx, w.bind);
		const node = el("div", "rw-choice", '<span class="rw-name"></span><div class="rw-opts"></div>');
		node.querySelector(".rw-name").textContent = w.label || ctx.labelOf(w.bind) || "Selector";
		const box = node.querySelector(".rw-opts");
		const opts = b.param ? b.param.options || [] : ["A", "B", "C"];
		const buttons = opts.map((name, i) => {
			const btn = el("div", "rw-opt");
			btn.textContent = name;
			if (b.id != null) press(btn, () => ctx.set(b.id, i));
			box.appendChild(btn);
			return btn;
		});
		const update = () => {
			const p = b.id != null ? ctx.param(b.id) : null;
			buttons.forEach((btn, i) => btn.classList.toggle("on", !!p && p.index == i));
		};
		if (b.id != null) ctx.watch(b.id, update);
		return { node: node, update: update, missing: !b.ok && !!w.bind };
	};

	// Rejilla con los clips de una capa
	W.clipgrid = function (w, ctx) {
		const o = Object.assign({ layer: 1, first: 1, count: 8, cols: 8, thumbs: true }, w.opts || {});
		const node = el("div", "rw-clipgrid");
		node.style.gridTemplateColumns = "repeat(" + Math.max(1, o.cols) + ", 1fr)";
		const parts = [];
		for (let i = 0; i < o.count; i++) {
			const sub = part(W.button({ bind: "/composition/layers/" + o.layer + "/clips/" + (o.first + i) + "/connect", opts: { thumb: o.thumbs } }, ctx));
			sub.node.classList.add("rw-clip");
			node.appendChild(sub.node);
			parts.push(sub);
		}
		const missing = !ctx.resolve("/composition/layers/" + o.layer + "/clear");
		return { node: node, update: () => parts.forEach((p) => p.update()), missing: missing };
	};

	W.columns = function (w, ctx) {
		const o = Object.assign({ first: 1, count: 8, cols: 8 }, w.opts || {});
		const node = el("div", "rw-clipgrid rw-columns");
		node.style.gridTemplateColumns = "repeat(" + Math.max(1, o.cols) + ", 1fr)";
		const parts = [];
		for (let i = 0; i < o.count; i++) {
			const path = "/composition/columns/" + (o.first + i) + "/connect";
			const r = ctx.resolve(path);
			const name = r && r.target && r.target.name ? r.target.name.value : "Columna " + (o.first + i);
			const sub = part(W.button({ bind: path, label: name, opts: { thumb: false } }, ctx));
			node.appendChild(sub.node);
			parts.push(sub);
		}
		return { node: node, update: () => parts.forEach((p) => p.update()) };
	};

	W.tempo = function (w, ctx) {
		const T = "/composition/tempocontroller/";
		const node = el("div", "rw-tempo");
		const v = part(W.value({ bind: T + "tempo", label: w.label || "BPM" }, ctx));
		v.node.classList.add("rw-bpm");
		node.appendChild(v.node);
		const row = el("div", "rw-row");
		const btn = (bindPath, label, opts) => { const b = part(W.button({ bind: bindPath, label: label, opts: opts }, ctx)); row.appendChild(b.node); return b; };
		const parts = [v, btn(T + "tempo_tap", "TAP"), btn(T + "resync", "RESYNC"), btn(T + "tempo_pull", "−"), btn(T + "tempo_push", "+")];
		// ÷2 y ×2: el valor del BPM se calcula al pulsar
		const tb = bind(ctx, T + "tempo");
		["÷2", "×2"].forEach((name, i) => {
			const b = el("div", "rw rw-button", '<span class="rw-name">' + name + "</span>");
			if (tb.id != null) press(b, () => { const p = ctx.param(tb.id); ctx.set(tb.id, i ? p.value * 2 : p.value / 2); });
			row.appendChild(b);
		});
		node.appendChild(row);
		return { node: node, update: () => parts.forEach((p) => p.update()), missing: v.missing };
	};

	W.layer = function (w, ctx) {
		const o = Object.assign({ layer: 1, fader: "opacity" }, w.opts || {});
		const L = "/composition/layers/" + o.layer;
		const node = el("div", "rw-layer");
		const r = ctx.resolve(L + "/clear");
		const name = el("div", "rw-lname");
		name.textContent = w.label || (r && r.target && r.target.name && r.target.name.value) || "Capa " + o.layer;
		node.appendChild(name);
		const f = part(W.fader({ bind: L + (o.fader == "master" ? "/master" : "/video/opacity"), label: o.fader == "master" ? "Master" : "Opacidad" }, ctx));
		node.appendChild(f.node);
		const row = el("div", "rw-row");
		const parts = [f];
		[[L + "/bypassed", "BYP"], [L + "/solo", "SOLO"], [L + "/clear", "CLR"]].forEach((x) => {
			const b = part(W.button({ bind: x[0], label: x[1] }, ctx));
			row.appendChild(b.node);
			parts.push(b);
		});
		node.appendChild(row);
		return { node: node, update: () => parts.forEach((p) => p.update()), missing: !r };
	};

	R.widget = function (w, ctx) {
		const make = W[w.type] || W.label;
		const inst = make(w, ctx);
		inst.node.classList.add("rw");
		if (w.color) inst.node.style.setProperty("--acc", w.color);
		if (inst.missing) inst.node.classList.add("missing");
		inst.update();
		return inst;
	};

	// ---------- página ----------

	// Dibuja una página del remote en `container`. conn = Connection (o null en el editor).
	// Devuelve {destroy, nodes: [{w, node}]}
	R.renderPage = function (container, layout, page, conn, opts) {
		opts = opts || {};
		const comp = (conn && conn.composition) || opts.composition || null;
		const watchers = [];
		// sin conexión (editor) los valores salen de la composición tal cual
		const local = {};
		(function index(o) {
			if (conn || !o || typeof o != "object") return;
			if (Array.isArray(o)) { o.forEach(index); return; }
			if (typeof o.valuetype == "string" && o.id !== undefined) local[o.id] = o;
			Object.keys(o).forEach((k) => { if (k != "options") index(o[k]); });
		})(comp);
		const ctx = {
			resolve: (path) => C.resolve(comp, path),
			param: (id) => (conn ? conn.param(id) : local[id]) || null,
			labelOf: (path) => labelOf(comp, path),
			watch: (id, fn) => { if (conn) watchers.push(conn.on(id, fn)); },
			set: (id, v) => { if (conn) conn.set(id, v); },
			reset: (id) => { if (conn) conn.reset(id); },
			trigger: (path, v) => { if (conn) conn.trigger(path, v); },
			thumbUrl: (clip) => (conn ? conn.thumbUrl(clip) : "")
		};
		container.innerHTML = "";
		container.classList.add("rgrid");
		container.style.gridTemplateColumns = "repeat(" + layout.cols + ", 1fr)";
		container.style.gridTemplateRows = "repeat(" + layout.rows + ", 1fr)";
		const nodes = [];
		(page.widgets || []).forEach((w) => {
			const inst = R.widget(w, ctx);
			inst.node.style.gridColumn = (w.x + 1) + " / span " + w.w;
			inst.node.style.gridRow = (w.y + 1) + " / span " + w.h;
			inst.node.dataset.wid = w.id;
			container.appendChild(inst.node);
			nodes.push({ w: w, node: inst.node, inst: inst });
		});
		return {
			nodes: nodes,
			destroy: () => { watchers.forEach((off) => off()); container.innerHTML = ""; }
		};
	};

	// Nombre corto de una ruta, para etiquetas automáticas
	function labelOf(comp, path) {
		if (!path) return "";
		const parts = String(path).split("/").filter(Boolean).map((s) => decodeURIComponent(s));
		const last = parts[parts.length - 1];
		if (last == "connect" && parts[1] == "layers") {
			const r = comp && C.resolve(comp, path);
			const n = r && r.target && r.target.name && r.target.name.value;
			return n || "L" + parts[2] + " · " + parts[4];
		}
		if (last == "connect" && parts[1] == "columns") return "Columna " + parts[2];
		if (last == "clear") return "Vaciar";
		if (last == "select") return "Seleccionar";
		if (last == "disconnect-all") return "Limpiar todo";
		let where = "";
		if (parts[1] == "layers") {
			const r = comp && comp.layers && comp.layers[parseInt(parts[2], 10) - 1];
			where = (r && r.name && r.name.value) || "Capa " + parts[2];
			if (parts[3] == "clips") where += " " + parts[4];
		}
		return (where ? where + " · " : "") + C.label(last);
	}
	R.labelOf = labelOf;

	// CSS de los controles (compartido por el remote y el constructor)
	R.CSS = `
.rgrid{display:grid;gap:6px;width:100%;height:100%;box-sizing:border-box;touch-action:none;user-select:none;-webkit-user-select:none}
.rw{--acc:#ffb000;position:relative;min-width:0;min-height:0;border-radius:8px;background:#1d1f23;border:1px solid #2c3036;color:#e8e9eb;
 font:12px/1.2 "Segoe UI",system-ui,sans-serif;box-sizing:border-box;overflow:hidden}
.rw.missing{border-color:#ff5a52;border-style:dashed}
.rw .rw-name{display:block;font-size:11px;color:#aab0b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rw-label{display:flex;align-items:center;padding:0 10px;font-size:15px;font-weight:600;background:transparent;border-color:transparent}
.rw-value{display:flex;flex-direction:column;justify-content:center;padding:4px 10px}
.rw-value .rw-big{font-size:clamp(14px,3.2vmin,28px);font-weight:700;color:var(--acc);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rw-button{display:flex;align-items:flex-end;justify-content:flex-start;padding:6px 8px;cursor:pointer;background:#24272c;transition:background .08s}
.rw-button .rw-name{position:relative;z-index:1;color:#e8e9eb;font-weight:600;font-size:12px;text-shadow:0 0 3px #000}
.rw-button.on{background:var(--acc);border-color:var(--acc)}
.rw-button.on .rw-name{color:#111;text-shadow:none}
.rw-button.down{filter:brightness(1.35)}
.rw-button.empty{opacity:.35}
.rw-thumb{position:absolute;inset:0;background-size:cover;background-position:center;opacity:.75}
.rw-button.on .rw-thumb{opacity:.35}
.rw-fader{display:flex;flex-direction:column;align-items:stretch;padding:6px;gap:4px}
.rw-fader .rw-name,.rw-fader .rw-num{text-align:center}
.rw-fader .rw-num{font-size:11px;color:var(--acc);min-height:13px}
.rw-track{position:relative;flex:1;background:#101113;border-radius:6px;cursor:pointer;overflow:hidden;min-height:20px}
.rw-fill{position:absolute;left:0;right:0;bottom:0;background:var(--acc);opacity:.22}
.rw-cap{position:absolute;left:0;right:0;height:8px;background:var(--acc);border-radius:3px}
.rw-fader.h .rw-fill{top:0;bottom:0;right:auto}
.rw-fader.h .rw-cap{top:0;bottom:0;width:8px;height:auto;right:auto}
.rw-knob{display:flex;flex-direction:column;align-items:center;padding:6px}
.rw-knob svg{flex:1;min-height:0;width:100%;cursor:ns-resize}
.rw-arc-bg{fill:none;stroke:#101113;stroke-width:9;stroke-linecap:round}
.rw-arc{fill:none;stroke:var(--acc);stroke-width:9;stroke-linecap:round}
.rw-knob .rw-num{font-size:11px;color:var(--acc)}
.rw-xy{display:flex;flex-direction:column;padding:6px;gap:4px}
.rw-pad{position:relative;flex:1;background:#101113;border-radius:6px;cursor:crosshair;
 background-image:linear-gradient(#ffffff10 1px,transparent 1px),linear-gradient(90deg,#ffffff10 1px,transparent 1px);background-size:25% 25%}
.rw-dot{position:absolute;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:var(--acc);box-shadow:0 0 12px var(--acc)}
.rw-choice{display:flex;flex-direction:column;padding:6px;gap:4px}
.rw-opts{flex:1;display:flex;gap:4px;min-height:0}
.rw-opt{flex:1;display:flex;align-items:center;justify-content:center;background:#24272c;border-radius:5px;cursor:pointer;font-size:11px;padding:2px;text-align:center;overflow:hidden}
.rw-opt.on{background:var(--acc);color:#111;font-weight:600}
.rw-clipgrid{display:grid;gap:4px;padding:4px;background:transparent;border-color:transparent;grid-auto-rows:1fr}
.rw-clipgrid > .rw{border-radius:6px}
.rw-tempo{display:flex;flex-direction:column;gap:4px;padding:4px}
.rw-tempo .rw-bpm{flex:1;border:0;background:transparent}
.rw-row{display:flex;gap:4px;flex:1;min-height:0}
.rw-row > .rw{flex:1}
.rw-layer{display:flex;flex-direction:column;gap:4px;padding:4px}
.rw-layer > .rw-fader{flex:1;border:0}
.rw-layer .rw-row{flex:0 0 34%}
.rw-layer .rw-row{flex-direction:column}
.rw-lname{font-weight:700;font-size:13px;text-align:center;color:var(--acc);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
`;
})(window.RemoteRuntime = {});
