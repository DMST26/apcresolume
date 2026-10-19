// Constructor de Resolume Remote (pestaña «Resolume Remote» del configurador).
// Arrastrar controles y parámetros al lienzo, asistente, prueba con simulador o con Resolume
// y exportación a un remote.html que se abre en el móvil o la tablet.
(function () {
	"use strict";

	const C = window.RemoteCatalog, L = window.RemoteLayout, R = window.RemoteRuntime, SIM = window.ResolumeSim, CS = window.ChataigneSource;
	// app.js define window.APCApp después de cargar este archivo: se busca al usarlo
	const APP = new Proxy({}, { get: (_, k) => window.APCApp[k] });
	const DATA = window.APP_DATA;
	const $ = (id) => document.getElementById(id);
	const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
	const clone = (o) => JSON.parse(JSON.stringify(o));
	const store = {
		get(k, d) { try { const v = localStorage.getItem("apcres." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
		set(k, v) { try { localStorage.setItem("apcres." + k, JSON.stringify(v)); return true; } catch (e) { return false; } }
	};

	const TYPE_INFO = {
		button: ["▣", "Lanza clips, columnas, tap, bypass… o pone un valor fijo."],
		fader: ["▮", "Opacidad, master, velocidad, volumen… cualquier valor con rango."],
		knob: ["◔", "Como un fader pero redondo: ideal para efectos."],
		xy: ["✛", "Dos parámetros a la vez con un dedo (por ejemplo posición X e Y)."],
		choice: ["☰", "Elegir una opción: modo de fusión, dirección, beat snap…"],
		clipgrid: ["▦", "Todos los clips de una capa, con miniaturas y estado."],
		columns: ["▥", "Lanzar columnas enteras."],
		layer: ["▤", "Una capa completa: opacidad, bypass, solo y vaciar."],
		tempo: ["♩", "BPM, tap, resync, ÷2 y ×2."],
		value: ["123", "Muestra un valor: BPM, estado de un clip, un texto de Chataigne…"],
		meter: ["▬", "Barra de nivel que solo muestra: audio, intensidad, tiempo de una secuencia…"],
		lamp: ["●", "Luz que se enciende con un sí/no o cuando un valor pasa de un umbral."],
		label: ["T", "Un título o una nota."]
	};
	const COLORS = ["#ffb000", "#ff5a52", "#38ff5c", "#00a9ff", "#ff00ff", "#ffffff", "#ff7f00", "#8e66ff"];

	let layout = L.normalize(store.get("remote", null) || defaultLayout());
	let rcomp = store.get("remoteComp", null);
	let compSource = store.get("remoteCompSource", "");
	let pageIdx = 0;
	let selId = null;
	let mode = "edit";          // edit | sim | live
	let conn = null, view = null;
	let history = [], future = [];
	let showAdvanced = false, search = "";
	let leftTab = "pieces";
	let paramSource = store.get("remoteParamSource", "resolume"); // resolume | chataigne
	let ctree = store.get("chataigneTree", null);
	let ctreeSource = store.get("chataigneTreeSource", "");
	let chataigneHost = store.get("chataigneHost", "127.0.0.1:42000");
	let dirHandle = null;

	function defaultLayout() {
		return { name: "Remote Deseo54", device: "tablet-h", pages: [{ name: "Principal", widgets: [] }] };
	}

	// Composición para diseñar: la leída de Resolume o una de ejemplo hecha con el mapa del APC
	function composition() {
		if (rcomp) return rcomp;
		const cfg = APP.getConfig(), names = APP.getComposition();
		const n = Math.max(5, ...Object.keys(cfg.layers).map(Number).filter((x) => x > 0));
		const layers = [];
		for (let i = 1; i <= n; i++) {
			const cl = names && names.layers[i - 1];
			layers.push({
				name: (cl && cl.name) || cfg.layers[i] || "Capa " + i,
				clips: cl ? cl.clips.map((c) => (c.empty ? "" : c.name || "Clip")) : Array.from({ length: 16 }, (_, j) => "Clip " + (j + 1))
			});
		}
		rcomp = C.skeleton({ name: "Ejemplo (" + cfg.name + ")", layers: layers });
		compSource = "ejemplo";
		return rcomp;
	}
	// Árbol de Chataigne: el leído o uno de ejemplo con los módulos del puente y los destinos
	function chataigneTree() {
		if (ctree) return ctree;
		ctree = CS.exampleTree(APP.getConfig());
		ctreeSource = "ejemplo";
		return ctree;
	}
	let entriesCache = null, entriesFor = null, entriesTree = null;
	function entries() {
		const comp = composition(), tree = chataigneTree();
		if (entriesFor !== comp || entriesTree !== tree) { entriesCache = C.walk(comp).concat(CS.walk(tree)); entriesFor = comp; entriesTree = tree; }
		return entriesCache;
	}
	function realComp() { return rcomp && compSource != "ejemplo" ? rcomp : null; }
	function realTree() { return ctree && ctreeSource != "ejemplo" ? ctree : null; }

	// ---------- historial ----------

	function save() { store.set("remote", layout); }
	function commit(fn, keepSel) {
		history.push(JSON.stringify(layout));
		if (history.length > 200) history.shift();
		future = [];
		fn();
		layout = L.normalize(layout);
		save();
		if (!keepSel && selId && !widget(selId)) selId = null;
		render();
	}
	function undo() { if (!history.length) return; future.push(JSON.stringify(layout)); layout = JSON.parse(history.pop()); save(); render(); }
	function redo() { if (!future.length) return; history.push(JSON.stringify(layout)); layout = JSON.parse(future.pop()); save(); render(); }

	function page() { return layout.pages[Math.min(pageIdx, layout.pages.length - 1)]; }
	function widget(id) { return page().widgets.find((w) => w.id == id) || null; }

	// ---------- DOM base ----------

	function buildShell() {
		const st = document.createElement("style");
		st.textContent = R.CSS;
		document.head.appendChild(st);
		$("remoteMode").innerHTML = `
			<aside id="rbLeft">
				<nav class="tabs" id="rbTabs">
					<button data-lt="pieces">Piezas</button><button data-lt="params">Parámetros</button><button data-lt="assist">Asistente</button>
				</nav>
				<div class="tabpane" id="rbPieces"></div>
				<div class="tabpane" id="rbParams"></div>
				<div class="tabpane" id="rbAssist"></div>
			</aside>
			<section id="rbCenter">
				<div class="rbbar">
					<input type="text" id="rbName" title="Nombre del remote">
					<select id="rbDevice" title="Pantalla de destino"></select>
					<span class="dim" id="rbGridInfo"></span>
					<span class="spacer"></span>
					<div class="seg" id="rbMode"><button data-m="edit">Editar</button><button data-m="sim">Probar</button><button data-m="live">Con Resolume</button></div>
				</div>
				<div class="rbbar" id="rbPages"></div>
				<div id="rbStage"><div id="rbFrame"><div id="rbGrid"></div><div id="rbDrop"></div></div></div>
				<div class="rbbar dim" id="rbHint"></div>
			</section>
			<aside id="rbRight"><div id="rbInspector" class="tabpane on"></div></aside>
			<dialog id="rbDialog"></dialog>`;
		$("rbDevice").innerHTML = Object.keys(L.DEVICES).map((k) => '<option value="' + k + '">' + L.DEVICES[k].name + "</option>").join("");
		$("rbTabs").onclick = (e) => { const b = e.target.closest("[data-lt]"); if (b) { leftTab = b.dataset.lt; renderLeft(); } };
		$("rbName").onchange = (e) => commit(() => { layout.name = e.target.value.trim() || "Mi remote"; });
		$("rbDevice").onchange = (e) => {
			const d = L.DEVICES[e.target.value];
			commit(() => {
				const had = layout.pages.some((p) => p.widgets.length);
				layout.device = e.target.value;
				if (had) L.rescale(layout, d.cols, d.rows); else { layout.cols = d.cols; layout.rows = d.rows; }
			});
			toast("Pantalla: " + d.name + ". Los controles se han recolocado; revisa el asistente por si algo queda pequeño.");
		};
		$("rbMode").onclick = (e) => { const b = e.target.closest("[data-m]"); if (b) setMode(b.dataset.m); };
		$("rbPages").onclick = onPagesClick;
		setupCanvas();
		window.addEventListener("resize", fitFrame);
		window.addEventListener("apc:composition", (e) => {
			rcomp = e.detail;
			compSource = "Resolume · " + new Date().toLocaleTimeString();
			if (!store.set("remoteComp", rcomp)) store.set("remoteComp", null);
			store.set("remoteCompSource", compSource);
			entriesFor = null;
			paramsKey = null;
			render();
		});
	}

	function toast(msg, err) { APP.toast(msg, err); }

	// ---------- render ----------

	function render() {
		if ($("remoteMode").hidden) return;
		$("rbName").value = layout.name;
		$("rbDevice").value = layout.device;
		$("rbGridInfo").textContent = layout.cols + "×" + layout.rows + " celdas";
		document.querySelectorAll("#rbMode button").forEach((b) => b.classList.toggle("on", b.dataset.m == mode));
		renderPages();
		renderCanvas();
		renderLeft();
		renderInspector();
		APP.setRemoteToolbar({ undo: history.length > 0, redo: future.length > 0 });
	}

	function renderPages() {
		$("rbPages").innerHTML = layout.pages.map((p, i) => '<button class="small' + (i == pageIdx ? " on" : "") + '" data-page="' + i + '">' + esc(p.name) + " <span class=\"dim\">" + p.widgets.length + "</span></button>").join("") +
			'<button class="small" data-act="addpage" title="Añadir página">+ Página</button>';
	}
	function onPagesClick(e) {
		const b = e.target.closest("button");
		if (!b) return;
		if (b.dataset.act == "addpage") {
			commit(() => { layout.pages.push({ name: "Página " + (layout.pages.length + 1), widgets: [] }); });
			pageIdx = layout.pages.length - 1;
			selId = null;
			render();
			return;
		}
		pageIdx = parseInt(b.dataset.page, 10);
		selId = null;
		render();
	}

	function fitFrame() {
		const stage = $("rbStage"), frame = $("rbFrame");
		if (!stage || $("remoteMode").hidden) return;
		const d = L.DEVICES[layout.device];
		const sw = stage.clientWidth - 24, sh = stage.clientHeight - 24;
		const s = Math.min(sw / d.w, sh / d.h, 1.4);
		frame.style.width = Math.max(200, d.w * s) + "px";
		frame.style.height = Math.max(150, d.h * s) + "px";
	}

	function renderCanvas() {
		fitFrame();
		if (view) view.destroy();
		if (conn) conn.clearListeners();
		const g = $("rbGrid");
		g.classList.toggle("editing", mode == "edit");
		g.style.setProperty("--acc", layout.accent);
		g.style.setProperty("--cols", layout.cols);
		g.style.setProperty("--rows", layout.rows);
		view = R.renderPage(g, layout, page(), mode == "edit" ? null : conn, { composition: composition(), tree: chataigneTree() });
		if (mode == "edit") {
			view.nodes.forEach((n) => {
				const ov = document.createElement("div");
				ov.className = "rb-ov" + (n.w.id == selId ? " sel" : "");
				ov.dataset.wid = n.w.id;
				ov.innerHTML = '<span class="rb-tag">' + esc(L.typeName(n.w.type)) + '</span><span class="rb-rs" data-rs="1"></span>';
				n.node.appendChild(ov);
			});
			if (!page().widgets.length) {
				const hint = document.createElement("div");
				hint.className = "rb-empty";
				hint.innerHTML = "Arrastra aquí controles (Piezas) o parámetros (Parámetros).<br>¿Prefieres que te lo monte? Abre el <strong>Asistente</strong>.";
				g.appendChild(hint);
			}
		}
		const issues = L.check(layout, realComp(), realTree()).filter((i) => i.page == pageIdx);
		$("rbHint").innerHTML = mode == "edit"
			? (issues.length ? '<span class="warn">⚠ ' + issues.length + " cosas que revisar en esta página (Asistente).</span> " : "") +
			"Arrastra para mover · esquina inferior derecha para cambiar el tamaño · Supr borra · Ctrl+D duplica · flechas mueven"
			: mode == "sim" ? "Modo prueba con el simulador: toca los controles. No se manda nada a Resolume."
				: '<span class="warn">Conectado de verdad: los controles mandan a ' + esc([conn && conn.resolume ? "Resolume" : "", conn && conn.chataigne ? "Chataigne" : ""].filter(Boolean).join(" y ")) + ".</span>";
	}

	// ---------- lienzo: soltar, mover y redimensionar ----------

	function cellAt(e) {
		const r = $("rbGrid").getBoundingClientRect();
		return {
			x: Math.max(0, Math.min(layout.cols - 1, Math.floor((e.clientX - r.left) / r.width * layout.cols))),
			y: Math.max(0, Math.min(layout.rows - 1, Math.floor((e.clientY - r.top) / r.height * layout.rows)))
		};
	}
	function showDrop(x, y, w, h, ok) {
		const d = $("rbDrop");
		if (x == null) { d.style.display = "none"; return; }
		d.style.display = "block";
		d.style.left = (x / layout.cols * 100) + "%";
		d.style.top = (y / layout.rows * 100) + "%";
		d.style.width = (w / layout.cols * 100) + "%";
		d.style.height = (h / layout.rows * 100) + "%";
		d.classList.toggle("bad", !ok);
	}

	function setupCanvas() {
		const g = $("rbGrid"), frame = $("rbFrame");
		frame.addEventListener("dragover", (e) => {
			if (mode != "edit") return;
			e.preventDefault();
			const c = cellAt(e);
			const t = dragType(e);
			const over = e.target.closest && e.target.closest("[data-wid]");
			if (t && t.path && over) { showDrop(null); highlightTarget(over.dataset.wid); return; }
			highlightTarget(null);
			const size = t ? sizeFor(t) : [2, 2];
			const x = Math.min(c.x, layout.cols - size[0]), y = Math.min(c.y, layout.rows - size[1]);
			showDrop(x, y, size[0], size[1], L.fits(page(), layout.cols, layout.rows, x, y, size[0], size[1]));
		});
		frame.addEventListener("dragleave", (e) => { if (!frame.contains(e.relatedTarget)) { showDrop(null); highlightTarget(null); } });
		frame.addEventListener("drop", (e) => {
			if (mode != "edit") return;
			e.preventDefault();
			showDrop(null);
			highlightTarget(null);
			const t = readDrag(e);
			if (!t) return;
			const over = e.target.closest && e.target.closest("[data-wid]");
			if (t.path && over) { bindTo(over.dataset.wid, t.path); return; }
			const c = cellAt(e);
			addWidget(t, c.x, c.y);
		});

		// mover / redimensionar
		let op = null;
		g.addEventListener("pointerdown", (e) => {
			if (mode != "edit") return;
			const ov = e.target.closest(".rb-ov");
			if (!ov) { if (e.target == g) { selId = null; render(); } return; }
			const w = widget(ov.dataset.wid);
			if (!w) return;
			e.preventDefault();
			if (selId != w.id) { selId = w.id; renderInspector(); g.querySelectorAll(".rb-ov").forEach((o) => o.classList.toggle("sel", o.dataset.wid == selId)); }
			const c = cellAt(e);
			op = { id: w.id, resize: !!e.target.dataset.rs, sx: c.x, sy: c.y, x: w.x, y: w.y, w: w.w, h: w.h, nx: w.x, ny: w.y, nw: w.w, nh: w.h, node: ov.parentNode };
			try { g.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
		});
		g.addEventListener("pointermove", (e) => {
			if (!op) return;
			const c = cellAt(e), w = widget(op.id);
			const min = L.minSize(w.type);
			let nx = op.x, ny = op.y, nw = op.w, nh = op.h;
			if (op.resize) { nw = Math.max(min[0], op.w + c.x - op.sx); nh = Math.max(min[1], op.h + c.y - op.sy); }
			else { nx = Math.max(0, Math.min(layout.cols - op.w, op.x + c.x - op.sx)); ny = Math.max(0, Math.min(layout.rows - op.h, op.y + c.y - op.sy)); }
			if (!L.fits(page(), layout.cols, layout.rows, nx, ny, nw, nh, op.id)) return; // solo posiciones libres
			op.nx = nx; op.ny = ny; op.nw = nw; op.nh = nh;
			op.node.style.gridColumn = (nx + 1) + " / span " + nw;
			op.node.style.gridRow = (ny + 1) + " / span " + nh;
		});
		const end = () => {
			if (!op) return;
			const o = op;
			op = null;
			if (o.nx != o.x || o.ny != o.y || o.nw != o.w || o.nh != o.h) commit(() => { const w = widget(o.id); w.x = o.nx; w.y = o.ny; w.w = o.nw; w.h = o.nh; }, true);
		};
		g.addEventListener("pointerup", end);
		g.addEventListener("pointercancel", end);
	}
	function highlightTarget(id) {
		document.querySelectorAll("#rbGrid .rb-ov").forEach((o) => o.classList.toggle("target", o.dataset.wid == id));
	}

	// Lo que se arrastra: {type} desde Piezas o {path} desde Parámetros
	let dragging = null;
	function dragType() { return dragging; }
	function readDrag(e) {
		if (dragging) { const d = dragging; dragging = null; return d; }
		try { return JSON.parse(e.dataTransfer.getData("application/json")); } catch (err) { return null; }
	}
	function sizeFor(t) {
		if (t.type) return [R.TYPES[t.type].w, R.TYPES[t.type].h].map((v, i) => Math.min(v, i ? layout.rows : layout.cols));
		const e = C.find(entries(), t.path);
		const type = R.typeFor(e);
		return [Math.min(R.TYPES[type].w, layout.cols), Math.min(R.TYPES[type].h, layout.rows)];
	}

	function addWidget(t, cx, cy) {
		let w;
		if (t.type) w = { type: t.type, opts: defaultOpts(t.type) };
		else {
			const e = C.find(entries(), t.path);
			w = { type: R.typeFor(e), bind: t.path, label: shortLabel(e), opts: {} };
			if (e && e.key == "phase") w.opts.orientation = "h";
		}
		const size = sizeFor(t);
		if (w.type == "fader" && w.opts.orientation == "h") { size[0] = Math.min(layout.cols, 4); size[1] = 1; }
		const spot = L.findSpot(page(), layout.cols, layout.rows, size[0], size[1], cx == null ? undefined : Math.min(cx, layout.cols - size[0]), cy == null ? undefined : Math.min(cy, layout.rows - size[1]))
			|| L.findSpot(page(), layout.cols, layout.rows, 1, 1);
		if (!spot) { toast("No queda sitio en esta página. Añade otra página o haz más pequeños los controles.", true); return; }
		w.x = spot.x; w.y = spot.y; w.w = size[0]; w.h = size[1]; w.id = L.uid();
		// si no cabe entero, se encoge hasta que quepa
		while ((w.w > 1 || w.h > 1) && !L.fits(page(), layout.cols, layout.rows, w.x, w.y, w.w, w.h)) { if (w.w >= w.h && w.w > 1) w.w--; else w.h--; }
		commit(() => { page().widgets.push(w); });
		selId = w.id;
		render();
		tipFor(w);
	}
	function defaultOpts(type) {
		const comp = composition();
		if (type == "clipgrid") return { layer: 1, first: 1, count: Math.min(8, (comp.layers[0] && comp.layers[0].clips.length) || 8), cols: 8, thumbs: true };
		if (type == "columns") return { first: 1, count: Math.min(8, comp.columns.length || 8), cols: 8 };
		if (type == "layer") return { layer: 1, fader: "opacity" };
		return {};
	}
	function shortLabel(e) {
		if (!e) return "";
		const g = e.group.split(" › ");
		const last = g[g.length - 1];
		if (e.kind == "action") return e.action == "connect" && /Clip/.test(last) ? last.replace(/^Clip \d+ · /, "") : e.label;
		return (/^(Capa|Columna|Clip|Efecto)/.test(last) ? last.replace(/^Capa \d+ · /, "").replace(/^Efecto /, "") + " · " : "") + e.label;
	}
	function bindTo(id, path) {
		const w = widget(id), e = C.find(entries(), path);
		if (!w || !e) return;
		const accepts = R.TYPES[w.type].accepts;
		if (!accepts.length) { toast("«" + L.typeName(w.type) + "» no se conecta a un parámetro: se configura en el panel de la derecha.", true); return; }
		if (accepts.indexOf(e.valuetype) < 0) {
			toast("Un " + L.typeName(w.type).toLowerCase() + " no sirve para «" + e.label + "» (" + vtName(e.valuetype) + "). Suéltalo en un hueco libre y se crea el control adecuado.", true);
			return;
		}
		commit(() => { const ww = widget(id); ww.bind = path; if (!ww.label) ww.label = shortLabel(e); });
		selId = id;
		render();
		toast("Conectado: " + e.group + " › " + e.label);
	}
	function tipFor(w) {
		const tips = {
			fader: "Fader creado. En el remote, doble toque = valor por defecto.",
			button: w.bind ? "" : "Botón creado. Arrástrale encima un parámetro o una acción (Parámetros) para conectarlo.",
			clipgrid: "Rejilla de clips: elige la capa y cuántos clips en el panel de la derecha.",
			xy: "Pad XY: necesita dos parámetros (horizontal y vertical) en el panel de la derecha."
		};
		if (tips[w.type]) $("rbHint").textContent = tips[w.type];
	}
	function vtName(vt) {
		return { ParamRange: "valor con rango", ParamBoolean: "sí/no", ParamEvent: "pulsador", ParamChoice: "opciones", ParamString: "texto", ParamText: "texto", ParamInteger: "número", ParamColor: "color", Action: "acción" }[vt] || vt;
	}

	// ---------- panel izquierdo ----------

	function renderLeft() {
		document.querySelectorAll("#rbTabs button").forEach((b) => b.classList.toggle("on", b.dataset.lt == leftTab));
		["pieces", "params", "assist"].forEach((k) => $("rb" + k.charAt(0).toUpperCase() + k.slice(1)).classList.toggle("on", leftTab == k));
		if (leftTab == "pieces") renderPieces();
		if (leftTab == "params") renderParams();
		if (leftTab == "assist") renderAssist();
	}

	function renderPieces() {
		const el = $("rbPieces");
		el.innerHTML = '<p class="dim">Arrastra una pieza al lienzo (o haz clic para ponerla en el primer hueco).</p>' +
			L.WIDGET_TYPES.map((t) => '<div class="rb-piece" draggable="true" data-type="' + t + '"><span class="ico">' + TYPE_INFO[t][0] + "</span><div><strong>" + esc(L.typeName(t)) + '</strong><div class="hint">' + esc(TYPE_INFO[t][1]) + "</div></div></div>").join("");
		el.querySelectorAll(".rb-piece").forEach((p) => {
			p.addEventListener("dragstart", (e) => { dragging = { type: p.dataset.type }; e.dataTransfer.setData("application/json", JSON.stringify(dragging)); e.dataTransfer.effectAllowed = "copy"; });
			p.addEventListener("dragend", () => { dragging = null; showDrop(null); });
			p.addEventListener("click", () => { if (mode != "edit") setMode("edit"); addWidget({ type: p.dataset.type }); });
		});
	}

	let paramsKey = null;
	function renderParams(force) {
		const el = $("rbParams");
		const key = [entriesFor && entriesFor.name && entriesFor.name.value, compSource, ctreeSource, paramSource, search, showAdvanced, entries().length].join("|");
		if (!force && key == paramsKey && el.innerHTML) return;
		paramsKey = key;
		const isCha = paramSource == "chataigne";
		const list = entries().filter((e) => (e.source == "chataigne") == isCha && (showAdvanced || !e.advanced) && (!search || (e.group + " " + e.label + " " + e.path).toLowerCase().indexOf(search.toLowerCase()) >= 0));
		const groups = [];
		const byGroup = {};
		list.forEach((e) => { if (!byGroup[e.group]) { byGroup[e.group] = []; groups.push(e.group); } byGroup[e.group].push(e); });
		const seg = '<div class="seg" id="rbSrc" style="margin-bottom:8px"><button data-src="resolume"' + (isCha ? "" : ' class="on"') + '>Resolume</button><button data-src="chataigne"' + (isCha ? ' class="on"' : "") + ">Chataigne</button></div>";
		let src;
		if (!isCha) {
			src = (compSource == "ejemplo" || !compSource
				? '<p class="warn" style="font-size:12px">Usando una composición de ejemplo hecha con tu mapa. Lee la de Resolume para tener todos los efectos y parámetros reales.</p>'
				: '<p class="ok" style="font-size:12px">Composición: ' + esc(compSource) + "</p>") +
				'<div class="row"><button class="small" id="rbRead">Leer de Resolume</button><button class="small" id="rbLoad">Cargar archivo…</button></div>';
		} else {
			src = (ctreeSource == "ejemplo" || !ctreeSource
				? '<p class="warn" style="font-size:12px">Usando un Chataigne de ejemplo. Léelo de verdad para ver tus módulos (Sunlite, Resolume…), variables, estados y secuencias.</p>'
				: '<p class="ok" style="font-size:12px">Chataigne: ' + esc(ctreeSource) + "</p>") +
				'<div class="row"><input type="text" id="rbChaHost" value="' + esc(chataigneHost) + '" title="IP:puerto del OSC Remote Control de Chataigne"><button class="small fixed" id="rbReadCha">Leer de Chataigne</button></div>' +
				'<p class="hint">En Chataigne: <strong>Archivo → Preferencias → OSC Remote Control</strong>, actívalo (puerto 42000).</p>';
		}
		el.innerHTML = seg + src +
			'<div class="row" style="margin:8px 0"><input type="text" id="rbSearch" placeholder="Buscar: opacidad, blur, tap…" value="' + esc(search) + '"></div>' +
			'<label class="check" style="margin-bottom:8px"><input type="checkbox" id="rbAdv"' + (showAdvanced ? " checked" : "") + "> Mostrar avanzados</label>" +
			'<p class="hint">Arrástralos a un hueco (crea el control) o encima de un control (lo conecta). Clic = conectar al control elegido.</p>' +
			'<div id="rbTree">' + (groups.length ? "" : '<p class="dim">Nada coincide con la búsqueda.</p>') +
			groups.map((g) => {
				const open = search || groups.length < 8 || /^(Composición|Tempo|Crossfader)$|^Chataigne › Variables/.test(g);
				return "<details" + (open ? " open" : "") + "><summary>" + esc(g) + ' <span class="dim">' + byGroup[g].length + "</span></summary>" +
					byGroup[g].map((e) => '<div class="rb-param" draggable="true" data-path="' + esc(e.path) + '" title="' + esc(e.path + (C.HELP[e.key] ? "\n" + C.HELP[e.key] : "")) + '">' +
						"<span>" + esc(e.label) + '</span><span class="vt">' + esc(vtName(e.valuetype)) + "</span></div>").join("") + "</details>";
			}).join("") + "</div>";
		$("rbSrc").onclick = (e) => { const b = e.target.closest("[data-src]"); if (b) { paramSource = b.dataset.src; store.set("remoteParamSource", paramSource); renderParams(true); } };
		if (!isCha) {
			$("rbRead").onclick = readFromResolume;
			$("rbLoad").onclick = () => APP.openCompositionFile();
		} else {
			$("rbChaHost").onchange = (e) => { chataigneHost = e.target.value.trim() || "127.0.0.1:42000"; store.set("chataigneHost", chataigneHost); };
			$("rbReadCha").onclick = readFromChataigne;
		}
		const s = $("rbSearch");
		s.oninput = () => { search = s.value; const pos = s.selectionStart; renderParams(true); const n = $("rbSearch"); n.focus(); n.setSelectionRange(pos, pos); };
		$("rbAdv").onchange = (e) => { showAdvanced = e.target.checked; renderParams(true); };
		el.querySelectorAll(".rb-param").forEach((p) => {
			p.addEventListener("dragstart", (e) => { dragging = { path: p.dataset.path }; e.dataTransfer.setData("application/json", JSON.stringify(dragging)); e.dataTransfer.effectAllowed = "copy"; });
			p.addEventListener("dragend", () => { dragging = null; showDrop(null); highlightTarget(null); });
			p.addEventListener("click", () => {
				if (mode != "edit") setMode("edit");
				const w = selId && widget(selId);
				if (w && R.TYPES[w.type].accepts.length) bindTo(w.id, p.dataset.path);
				else addWidget({ path: p.dataset.path });
			});
		});
	}

	async function readFromChataigne() {
		try {
			toast("Leyendo Chataigne en " + chataigneHost + "…");
			const r = await fetch("http://" + chataigneHost + "/", { cache: "no-store" });
			const tree = await r.json();
			if (!tree || !tree.CONTENTS) throw new Error("no parece Chataigne");
			ctree = tree;
			ctreeSource = chataigneHost + " · " + new Date().toLocaleTimeString();
			if (!store.set("chataigneTree", ctree)) store.set("chataigneTree", null);
			store.set("chataigneTreeSource", ctreeSource);
			entriesFor = null; paramsKey = null;
			render();
			toast("Chataigne leído: " + CS.walk(ctree).length + " parámetros.");
		} catch (e) {
			toast("No se pudo leer Chataigne en " + chataigneHost + ". ¿Está abierto con OSC Remote Control activado (Preferencias)?", true);
		}
	}

	async function readFromResolume() {
		const cfg = APP.getConfig();
		const host = cfg.resolume.host + ":" + cfg.resolume.apiPort;
		try {
			toast("Leyendo la composición de " + host + "…");
			const comp = await R.fetchComposition(host, 6000);
			APP.setComposition(comp);
		} catch (e) {
			toast(e.message + ". Comprueba que Resolume está abierto con el Webserver activado, o carga la composición desde un archivo.", true);
		}
	}

	function renderAssist() {
		const comp = rcomp && compSource != "ejemplo" ? rcomp : null;
		const issues = L.check(layout, comp);
		const icon = { error: '<span class="err">✖</span>', aviso: '<span class="warn">⚠</span>', consejo: '<span class="dim">💡</span>' };
		const steps = [];
		const total = layout.pages.reduce((a, p) => a + p.widgets.length, 0);
		if (!total) steps.push("Empieza con el asistente o arrastra piezas al lienzo.");
		if (!comp) steps.push("Lee la composición de Resolume (pestaña Parámetros) para ver todos tus clips, efectos y parámetros reales.");
		if (total && !issues.some((i) => i.level == "error")) steps.push("Pulsa <strong>Probar</strong> arriba para tocarlo con el simulador.");
		if (total) steps.push("Cuando te guste, <strong>Exportar remote</strong> y ábrelo en la tablet.");
		$("rbAssist").innerHTML =
			'<button class="primary" id="rbWizard" style="width:100%">✨ Crear un remote paso a paso</button>' +
			'<p class="hint">Eliges qué quieres controlar y lo monta solo. Después puedes moverlo y cambiarlo todo.</p>' +
			"<h3>Siguientes pasos</h3><ol class=\"hint\" style=\"padding-left:18px\">" + steps.map((s) => "<li>" + s + "</li>").join("") + "</ol>" +
			"<h3>Revisión (" + issues.length + ")</h3>" +
			(issues.length ? issues.map((it, n) => '<div class="box rb-issue">' + icon[it.level] + " " + esc(it.msg) +
				'<div class="row" style="margin-top:6px">' + (it.widget ? '<button class="small fixed" data-go="' + n + '">Ir</button>' : "") +
				(it.fix == "fit" ? '<button class="small fixed" data-fit="1">Encajar en la pantalla</button>' : "") + "</div></div>").join("")
				: '<p class="ok">✔ Todo en orden.</p>') +
			"<h3>Trucos</h3><ul class=\"hint\" style=\"padding-left:18px\">" +
			"<li>Suelta un parámetro <em>encima</em> de un control para conectarlo; en un hueco crea el control que le va.</li>" +
			"<li>Un botón conectado a un valor con rango pone un valor fijo (p. ej. opacidad 0 = apagar capa).</li>" +
			"<li>Los efectos se guardan por nombre: si los reordenas en Resolume, el remote sigue funcionando.</li>" +
			"<li>Las capas y clips van por número: si los mueves, vuelve a leer la composición y revisa esta lista.</li></ul>";
		$("rbWizard").onclick = openWizard;
		$("rbAssist").querySelectorAll("[data-go]").forEach((b) => {
			b.onclick = () => { const it = issues[+b.dataset.go]; pageIdx = it.page; selId = it.widget; if (mode != "edit") setMode("edit"); render(); };
		});
		$("rbAssist").querySelectorAll("[data-fit]").forEach((b) => { b.onclick = () => commit(() => L.fit(layout)); });
	}

	// ---------- asistente paso a paso ----------

	// Grupos de parámetros de Chataigne que tiene sentido poner en una tablet
	let chaGroups = {};
	function chataigneStep() {
		chaGroups = {};
		CS.walk(chataigneTree()).filter((e) => !e.advanced).forEach((e) => { (chaGroups[e.group] = chaGroups[e.group] || []).push(e.path); });
		const names = Object.keys(chaGroups);
		if (!names.length) return "";
		const pre = (g) => /Variables|Secuencias|Estados/.test(g) || APP.getConfig().targets.some((t) => g.indexOf("› " + t.id + " ›") >= 0 || g.endsWith("› " + t.id));
		return '<div class="box"><strong>5. Chataigne</strong><div class="hint">' + (ctreeSource == "ejemplo" ? "Chataigne de ejemplo: lee el tuyo en Parámetros → Chataigne para ver lo real. " : "") +
			"Valores de los destinos (Sunlite…), variables, estados y secuencias. Se crea una página con lo que marques.</div>" +
			'<div class="rb-checks" style="grid-template-columns:1fr">' + names.map((g, i) => '<label class="check"><input type="checkbox" name="wzCha" value="' + esc(g) + '"' + (pre(g) ? " checked" : "") + "> " + esc(g.replace(/^Chataigne › /, "")) + ' <span class="dim">' + chaGroups[g].length + "</span></label>").join("") + "</div></div>";
	}

	function openWizard() {
		const comp = composition();
		const dlg = $("rbDialog");
		const layerChecks = (name, checkedFn) => comp.layers.map((l, i) => '<label class="check"><input type="checkbox" name="' + name + '" value="' + (i + 1) + '"' + (checkedFn(i + 1) ? " checked" : "") + "> " + (i + 1) + " · " + esc((l.name && l.name.value) || "Capa " + (i + 1)) + "</label>").join("");
		const layerOpts = comp.layers.map((l, i) => '<option value="' + (i + 1) + '">' + (i + 1) + " · " + esc((l.name && l.name.value) || "Capa " + (i + 1)) + "</option>").join("");
		dlg.innerHTML = "<h2>Crear un remote paso a paso</h2>" +
			(compSource == "ejemplo" ? '<p class="warn" style="font-size:12px">Ahora mismo uso una composición de ejemplo. Para los efectos reales, lee antes la composición de Resolume.</p>' : "") +
			'<div class="row"><div class="field"><label>1. ¿Dónde lo vas a usar?</label><select id="wzDevice">' + Object.keys(L.DEVICES).map((k) => '<option value="' + k + '"' + (k == layout.device ? " selected" : "") + ">" + L.DEVICES[k].name + "</option>").join("") + "</select></div>" +
			'<div class="field"><label>Nombre</label><input type="text" id="wzName" value="' + esc(layout.name) + '"></div></div>' +
			'<div class="box"><strong>2. Lanzar clips</strong><div class="hint">Una rejilla con miniaturas por cada capa marcada.</div><div class="rb-checks">' + layerChecks("wzClips", (i) => i <= 2) + "</div>" +
			'<div class="row"><label class="fixed">Clips por capa</label><input type="number" id="wzPer" min="1" max="16" value="8" class="fixed"><label class="check fixed"><input type="checkbox" id="wzCols"> Fila de columnas</label></div></div>' +
			'<div class="box"><strong>3. Mezcla</strong><div class="hint">Tira por capa con opacidad, bypass, solo y vaciar.</div><div class="rb-checks">' + layerChecks("wzMix", () => true) + "</div>" +
			'<label class="check"><input type="checkbox" id="wzTempo" checked> Tempo (BPM, tap, resync)</label>' +
			'<label class="check"><input type="checkbox" id="wzMaster" checked> Master, blackout, limpiar todo y crossfader</label></div>' +
			'<div class="box"><strong>4. Más páginas (opcional)</strong>' +
			'<div class="row"><label class="check fixed"><input type="checkbox" id="wzFx"> Efectos de la capa</label><select id="wzFxLayer">' + layerOpts + "</select></div>" +
			'<div class="row"><label class="check fixed"><input type="checkbox" id="wzClipCtl"> Velocidad y dirección de los clips de la capa</label><select id="wzClipLayer">' + layerOpts + "</select></div></div>" +
			chataigneStep() +
			'<label class="check"><input type="checkbox" id="wzAppend"> Añadir como páginas nuevas (sin borrar lo que ya tengo)</label>' +
			'<div class="row" style="margin-top:14px"><button id="wzCancel">Cancelar</button><button class="primary" id="wzOk">Crear remote</button></div>';
		const vals = (name) => Array.from(dlg.querySelectorAll('input[name="' + name + '"]:checked')).map((i) => parseInt(i.value, 10));
		$("wzCancel").onclick = () => dlg.close();
		$("wzOk").onclick = () => {
			const choices = {
				clipLayers: vals("wzClips"), clipsPerLayer: parseInt($("wzPer").value, 10) || 8, columns: $("wzCols").checked,
				mixLayers: vals("wzMix"), tempo: $("wzTempo").checked, master: $("wzMaster").checked,
				effectsLayer: $("wzFx").checked ? parseInt($("wzFxLayer").value, 10) : 0,
				clipControls: $("wzClipCtl").checked, clipControlsLayer: parseInt($("wzClipLayer").value, 10),
				chataignePaths: Array.from(dlg.querySelectorAll('input[name="wzCha"]:checked')).reduce((a, i) => a.concat(chaGroups[i.value] || []), [])
			};
			const device = $("wzDevice").value;
			const made = L.generate(comp, choices, device, $("wzName").value.trim() || "Mi remote", chataigneTree());
			const append = $("wzAppend").checked && device == layout.device;
			if (!append && layout.pages.some((p) => p.widgets.length) && !confirm("Esto sustituye el remote actual (Ctrl+Z para deshacer). ¿Seguir?")) return;
			commit(() => {
				if (append) layout.pages = layout.pages.concat(made.pages.map((p, i) => Object.assign(p, { id: "p" + Date.now() + i })));
				else layout = made;
			});
			pageIdx = append ? layout.pages.length - made.pages.length : 0;
			selId = null;
			dlg.close();
			render();
			toast("Remote creado: " + made.pages.map((p) => p.name).join(", ") + ". Ahora puedes moverlo y ajustarlo todo.");
		};
		dlg.showModal();
	}

	// ---------- inspector ----------

	function renderInspector() {
		const el = $("rbInspector");
		const w = selId && widget(selId);
		if (!w) { renderPageInspector(el); return; }
		const e = w.bind ? C.find(entries(), w.bind) : null;
		const e2 = w.bind2 ? C.find(entries(), w.bind2) : null;
		const accepts = R.TYPES[w.type].accepts;
		let h = "<h2>" + esc(L.typeName(w.type)) + '</h2><p class="hint" style="margin-top:-6px">' + esc(TYPE_INFO[w.type][1]) + "</p>";
		h += field("Etiqueta", '<input type="text" data-w="label" value="' + esc(w.label) + '" placeholder="Automática">');
		if (accepts.length) {
			h += bindBox("Conectado a", "bind", w.bind, e, accepts);
			if (w.type == "xy") h += bindBox("Eje vertical", "bind2", w.bind2, e2, accepts);
		}
		h += typeOptions(w, e);
		h += "<h3>Aspecto</h3>" + '<div class="quick">' + COLORS.map((c) => '<div data-color="' + c + '" class="' + ((w.color || "") == c ? "on" : "") + '" style="background:' + c + '"></div>').join("") +
			'<div data-color="" title="Color del remote" class="' + (!w.color ? "on" : "") + '" style="background:repeating-linear-gradient(45deg,#333 0 4px,#555 4px 8px)"></div></div>';
		h += '<div class="row">' + num("x", "Columna", w.x + 1) + num("y", "Fila", w.y + 1) + num("w", "Ancho", w.w) + num("h", "Alto", w.h) + "</div>";
		h += '<div class="row" style="margin-top:10px"><button data-act="dup">Duplicar</button><button data-act="del">Borrar</button></div>';
		el.innerHTML = h;
		wireInspector(el, w);
	}
	function field(label, inner, hint) { return '<div class="field"><label>' + label + "</label>" + inner + (hint ? '<div class="hint">' + hint + "</div>" : "") + "</div>"; }
	function num(k, label, v) { return '<div class="field"><label>' + label + '</label><input type="number" data-pos="' + k + '" value="' + v + '" min="1" style="width:100%"></div>'; }
	function bindBox(title, key, path, e, accepts) {
		let h = '<div class="box"><div class="dim" style="font-size:12px">' + title + "</div>";
		if (path) {
			h += e ? "<strong>" + esc(e.label) + '</strong><div class="hint">' + esc(e.group) + " · " + esc(vtName(e.valuetype)) + "</div>" + (C.HELP[e.key] ? '<div class="hint">' + esc(C.HELP[e.key]) + "</div>" : "")
				: '<strong class="err">No existe en la composición</strong><div class="hint">' + esc(path) + "</div>";
		} else h += '<p class="warn">Sin conectar. Arrastra un parámetro encima o elige uno aquí:</p>';
		const options = entries().filter((x) => accepts.indexOf(x.valuetype) >= 0 && (showAdvanced || !x.advanced));
		h += '<select data-bindsel="' + key + '"><option value="">— elegir —</option>' + groupOptions(options, path) + "</select>";
		if (path) h += '<button class="small" data-unbind="' + key + '" style="margin-top:6px">Quitar</button>';
		return h + "</div>";
	}
	function groupOptions(list, cur) {
		const groups = {};
		const order = [];
		list.forEach((x) => { if (!groups[x.group]) { groups[x.group] = []; order.push(x.group); } groups[x.group].push(x); });
		return order.map((g) => '<optgroup label="' + esc(g) + '">' + groups[g].map((x) => '<option value="' + esc(x.path) + '"' + (x.path == cur ? " selected" : "") + ">" + esc(x.label) + "</option>").join("") + "</optgroup>").join("");
	}
	function layerSelect(k, v) {
		const comp = composition();
		return '<select data-opt="' + k + '" data-t="int">' + comp.layers.map((l, i) => '<option value="' + (i + 1) + '"' + (v == i + 1 ? " selected" : "") + ">" + (i + 1) + " · " + esc((l.name && l.name.value) || "Capa " + (i + 1)) + "</option>").join("") + "</select>";
	}
	function typeOptions(w, e) {
		const o = w.opts;
		let h = "";
		const nIn = (k, label, v, min, max) => field(label, '<input type="number" data-opt="' + k + '" data-t="int" value="' + v + '" min="' + (min || 1) + '"' + (max ? ' max="' + max + '"' : "") + ' style="width:100%">');
		if (w.type == "button" && e) {
			if (e.valuetype == "ParamBoolean") h += field("Al pulsar", '<select data-opt="mode">' + [["toggle", "Encender / apagar (interruptor)"], ["momentary", "Solo mientras se mantiene"]].map((x) => '<option value="' + x[0] + '"' + ((o.mode || "toggle") == x[0] ? " selected" : "") + ">" + x[1] + "</option>").join("") + "</select>");
			if (e.valuetype == "ParamRange") h += field("Valor que pone", '<input type="number" step="any" data-opt="value" data-t="num" value="' + (o.value != null ? o.value : e.max) + '">', "Entre " + e.min + " y " + e.max + ". Se ilumina cuando el parámetro vale eso.");
			if (e.valuetype == "ParamChoice") h += field("Opción que elige", '<select data-opt="index" data-t="int">' + (e.options || []).map((x, i) => '<option value="' + i + '"' + ((o.index || 0) == i ? " selected" : "") + ">" + esc(x) + "</option>").join("") + "</select>");
			if (e.kind == "action" && /\/clips\//.test(w.bind)) h += '<label class="check"><input type="checkbox" data-opt="thumb" data-t="bool"' + (o.thumb !== false ? " checked" : "") + "> Miniatura del clip</label>";
		}
		if (w.type == "fader") {
			h += field("Orientación", '<select data-opt="orientation">' + [["v", "Vertical"], ["h", "Horizontal"]].map((x) => '<option value="' + x[0] + '"' + ((o.orientation || "v") == x[0] ? " selected" : "") + ">" + x[1] + "</option>").join("") + "</select>");
			h += '<label class="check"><input type="checkbox" data-opt="showValue" data-t="bool"' + (o.showValue !== false ? " checked" : "") + "> Mostrar el valor</label>";
		}
		if (w.type == "meter") h += field("Orientación", '<select data-opt="orientation">' + [["h", "Horizontal"], ["v", "Vertical"]].map((x) => '<option value="' + x[0] + '"' + ((o.orientation || "h") == x[0] ? " selected" : "") + ">" + x[1] + "</option>").join("") + "</select>");
		if (w.type == "lamp" && e) {
			if (e.valuetype == "ParamChoice") h += field("Se enciende con", '<select data-opt="index" data-t="int">' + (e.options || []).map((x, i) => '<option value="' + i + '"' + ((o.index || 0) == i ? " selected" : "") + ">" + esc(x) + "</option>").join("") + "</select>");
			else if (e.valuetype != "ParamBoolean") h += field("Se enciende por encima de", '<input type="number" step="any" data-opt="threshold" data-t="num" value="' + (o.threshold != null ? o.threshold : (e.max != null ? (e.min + e.max) / 2 : 0)) + '">');
		}
		if (w.type == "clipgrid") {
			h += field("Capa", layerSelect("layer", o.layer || 1));
			h += '<div class="row">' + nIn("first", "Primer clip", o.first || 1) + nIn("count", "Cuántos", o.count || 8, 1, 64) + nIn("cols", "Por fila", o.cols || 8, 1, 16) + "</div>";
			h += '<label class="check"><input type="checkbox" data-opt="thumbs" data-t="bool"' + (o.thumbs !== false ? " checked" : "") + "> Miniaturas</label>";
		}
		if (w.type == "columns") h += '<div class="row">' + nIn("first", "Primera columna", o.first || 1) + nIn("count", "Cuántas", o.count || 8, 1, 64) + nIn("cols", "Por fila", o.cols || 8, 1, 16) + "</div>";
		if (w.type == "layer") {
			h += field("Capa", layerSelect("layer", o.layer || 1));
			h += field("Fader", '<select data-opt="fader">' + [["opacity", "Opacidad"], ["master", "Master"]].map((x) => '<option value="' + x[0] + '"' + ((o.fader || "opacity") == x[0] ? " selected" : "") + ">" + x[1] + "</option>").join("") + "</select>");
		}
		if (w.type == "label") {
			h += field("Tamaño", '<select data-opt="size">' + [["", "Normal"], ["12px", "Pequeño"], ["20px", "Grande"], ["28px", "Muy grande"]].map((x) => '<option value="' + x[0] + '"' + ((o.size || "") == x[0] ? " selected" : "") + ">" + x[1] + "</option>").join("") + "</select>");
			h += field("Alineación", '<select data-opt="align">' + [["", "Izquierda"], ["center", "Centro"], ["right", "Derecha"]].map((x) => '<option value="' + x[0] + '"' + ((o.align || "") == x[0] ? " selected" : "") + ">" + x[1] + "</option>").join("") + "</select>");
		}
		return h ? "<h3>Opciones</h3>" + h : "";
	}
	function wireInspector(el, w) {
		const upd = (fn) => commit(() => { const ww = widget(w.id); if (ww) fn(ww); }, true);
		el.querySelectorAll("[data-w]").forEach((i) => { i.onchange = () => upd((ww) => { ww[i.dataset.w] = i.value; }); });
		el.querySelectorAll("[data-bindsel]").forEach((s) => { s.onchange = () => { if (s.value) bindTo(w.id, s.value); }; });
		el.querySelectorAll("[data-unbind]").forEach((b) => { b.onclick = () => upd((ww) => { ww[b.dataset.unbind] = ""; }); });
		el.querySelectorAll("[data-opt]").forEach((i) => {
			i.onchange = () => upd((ww) => {
				const t = i.dataset.t;
				ww.opts[i.dataset.opt] = t == "int" ? parseInt(i.value, 10) || 0 : t == "num" ? parseFloat(i.value) : t == "bool" ? i.checked : i.value;
				if (ww.type == "fader" && i.dataset.opt == "orientation") {
					const nw = i.value == "h" ? Math.max(ww.w, ww.h) : Math.min(ww.w, ww.h), nh = i.value == "h" ? Math.min(ww.w, ww.h) : Math.max(ww.w, ww.h);
					if (L.fits(page(), layout.cols, layout.rows, ww.x, ww.y, nw, nh, ww.id)) { ww.w = nw; ww.h = nh; }
				}
			});
		});
		el.querySelectorAll("[data-pos]").forEach((i) => {
			i.onchange = () => {
				const k = i.dataset.pos, v = parseInt(i.value, 10) || 1;
				const ww = widget(w.id), nx = { x: ww.x, y: ww.y, w: ww.w, h: ww.h };
				nx[k] = k == "x" || k == "y" ? v - 1 : v;
				if (!L.fits(page(), layout.cols, layout.rows, nx.x, nx.y, nx.w, nx.h, ww.id)) { toast("Ahí no cabe: choca con otro control o se sale de la pantalla.", true); renderInspector(); return; }
				upd((x) => Object.assign(x, nx));
			};
		});
		el.querySelectorAll("[data-color]").forEach((c) => { c.onclick = () => upd((ww) => { ww.color = c.dataset.color; }); });
		el.querySelector('[data-act="dup"]').onclick = duplicate;
		el.querySelector('[data-act="del"]').onclick = removeSel;
	}

	function renderPageInspector(el) {
		const p = page();
		el.innerHTML = "<h2>Página «" + esc(p.name) + "»</h2>" +
			'<p class="hint" style="margin-top:-6px">Elige un control del lienzo para ajustarlo.</p>' +
			field("Nombre de la página", '<input type="text" id="rbPageName" value="' + esc(p.name) + '">') +
			'<div class="row"><button id="rbPageLeft"' + (pageIdx == 0 ? " disabled" : "") + ">◀ Mover</button><button id=\"rbPageRight\"" + (pageIdx == layout.pages.length - 1 ? " disabled" : "") + ">Mover ▶</button></div>" +
			'<div class="row" style="margin-top:6px"><button id="rbPageDup">Duplicar página</button><button id="rbPageDel"' + (layout.pages.length < 2 ? " disabled" : "") + ">Borrar página</button></div>" +
			"<h3>Remote</h3>" +
			field("Color principal", '<div class="quick">' + COLORS.map((c) => '<div data-acc="' + c + '" class="' + (layout.accent == c ? "on" : "") + '" style="background:' + c + '"></div>').join("") + "</div>") +
			field("Rejilla (columnas × filas)", '<div class="row"><input type="number" id="rbCols" min="2" max="32" value="' + layout.cols + '"><input type="number" id="rbRows" min="2" max="32" value="' + layout.rows + '"></div>', "Al cambiarla se reescala todo.") +
			field("Dirección de Resolume por defecto", '<input type="text" id="rbHost" value="' + esc(layout.host) + '" placeholder="Automática">',
				"Vacío = automática: si el remote se abre desde el webserver de Resolume se conecta a ese mismo ordenador. En el remote, tocando el punto de estado se puede cambiar.") +
			field("Dirección de Chataigne por defecto", '<input type="text" id="rbChaHostL" value="' + esc(layout.chataigneHost) + '" placeholder="Automática (mismo ordenador, puerto 42000)">',
				"Solo se usa si el remote tiene controles de Chataigne.");
		$("rbPageName").onchange = (e) => commit(() => { page().name = e.target.value.trim() || "Página"; });
		$("rbPageLeft").onclick = () => movePage(-1);
		$("rbPageRight").onclick = () => movePage(1);
		$("rbPageDup").onclick = () => {
			commit(() => { const c = clone(page()); c.id = "p" + Date.now(); c.name += " (copia)"; c.widgets.forEach((w) => { w.id = L.uid(); }); layout.pages.splice(pageIdx + 1, 0, c); });
			pageIdx++;
			render();
		};
		$("rbPageDel").onclick = () => {
			if (!confirm("¿Borrar la página «" + page().name + "»? (Ctrl+Z para deshacer)")) return;
			commit(() => { layout.pages.splice(pageIdx, 1); });
			pageIdx = Math.max(0, pageIdx - 1);
			render();
		};
		el.querySelectorAll("[data-acc]").forEach((c) => { c.onclick = () => commit(() => { layout.accent = c.dataset.acc; }); });
		$("rbCols").onchange = $("rbRows").onchange = () => commit(() => L.rescale(layout, parseInt($("rbCols").value, 10) || layout.cols, parseInt($("rbRows").value, 10) || layout.rows));
		$("rbHost").onchange = (e) => commit(() => { layout.host = e.target.value.trim(); });
		$("rbChaHostL").onchange = (e) => commit(() => { layout.chataigneHost = e.target.value.trim(); });
	}
	function movePage(d) {
		const j = pageIdx + d;
		if (j < 0 || j >= layout.pages.length) return;
		commit(() => { const p = layout.pages.splice(pageIdx, 1)[0]; layout.pages.splice(j, 0, p); });
		pageIdx = j;
		render();
	}

	function duplicate() {
		const w = selId && widget(selId);
		if (!w) return;
		const spot = L.findSpot(page(), layout.cols, layout.rows, w.w, w.h, Math.min(w.x + w.w, layout.cols - w.w), w.y);
		if (!spot) { toast("No hay sitio para duplicarlo en esta página.", true); return; }
		const c = clone(w);
		c.id = L.uid(); c.x = spot.x; c.y = spot.y;
		commit(() => page().widgets.push(c));
		selId = c.id;
		render();
	}
	function removeSel() {
		if (!selId) return;
		commit(() => { const p = page(); p.widgets = p.widgets.filter((w) => w.id != selId); });
		selId = null;
		render();
	}
	function nudge(dx, dy) {
		const w = selId && widget(selId);
		if (!w || !L.fits(page(), layout.cols, layout.rows, w.x + dx, w.y + dy, w.w, w.h, w.id)) return;
		commit(() => { const ww = widget(selId); ww.x += dx; ww.y += dy; }, true);
	}

	// ---------- probar ----------

	function setMode(m) {
		if (m == mode) return;
		if (m == "live") {
			const cfg = APP.getConfig();
			const host = layout.host || cfg.resolume.host + ":" + cfg.resolume.apiPort;
			const u = L.sources(layout);
			const what = [u.resolume || !u.chataigne ? "Resolume (" + host + ")" : "", u.chataigne ? "Chataigne (" + (layout.chataigneHost || chataigneHost) + ")" : ""].filter(Boolean).join(" y ");
			if (!confirm("Vas a conectar el remote con " + what + ".\nLo que toques se manda de verdad. ¿Seguir?")) { render(); return; }
			stopConn();
			const uses = L.sources(layout);
			const chHost = layout.chataigneHost || chataigneHost;
			const res = uses.resolume || !uses.chataigne ? new R.Connection({ host: host, onComposition: () => renderCanvas(), onStatus: (ok) => { if (!ok) $("rbHint").innerHTML = '<span class="err">Sin conexión con Resolume (' + esc(host) + "). Reintentando…</span>"; } }) : null;
			const cha = uses.chataigne ? new R.ChataigneConnection({ host: chHost, onTree: () => renderCanvas(), onStatus: (ok) => { if (!ok) $("rbHint").innerHTML = '<span class="err">Sin conexión con Chataigne (' + esc(chHost) + "). Reintentando…</span>"; } }) : null;
			conn = R.MultiConnection(res, cha);
			conn.connect();
		} else if (m == "sim") {
			stopConn();
			const res = new R.Connection({ sim: SIM.create(clone(composition())), onComposition: () => renderCanvas() });
			const cha = new R.ChataigneConnection({ sim: CS.sim(clone(chataigneTree())), onTree: () => renderCanvas() });
			conn = R.MultiConnection(res, cha);
			conn.connect();
		} else stopConn();
		mode = m;
		selId = m == "edit" ? selId : null;
		render();
	}
	function stopConn() { if (conn) { conn.close(); conn = null; } }

	// ---------- exportar ----------

	function remoteHtml() {
		return DATA.remoteTemplate.split("/*@@LAYOUT@@*/null").join(JSON.stringify(layout).replace(/<\//g, "<\\/"));
	}
	function slug(s) { return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "remote"; }

	function openExport() {
		const dlg = $("rbDialog");
		const lib = store.get("remotes", {});
		const names = Object.keys(lib).sort();
		const errors = L.check(layout, realComp(), realTree()).filter((i) => i.level == "error");
		const file = store.get("remoteFile", "remote.html");
		dlg.innerHTML = "<h2>Exportar «" + esc(layout.name) + "»</h2>" +
			(errors.length ? '<p class="err">Hay ' + errors.length + " errores (pestaña Asistente). Puedes exportar igualmente.</p>" : "") +
			field("Nombre del archivo", '<input type="text" id="exFile" value="' + esc(file) + '">') +
			'<div class="row"><button class="primary" id="exFolder">Guardar en la carpeta…</button><button id="exDownload">Descargar</button></div>' +
			'<h3>Para usarlo en la tablet o el móvil</h3><ol class="hint" style="padding-left:18px">' +
			"<li>En Resolume: <strong>Preferencias → Webserver</strong>. Activa el webserver y en <strong>Root Directory</strong> elige una carpeta (por ejemplo <code>Documentos\\Resolume Remote</code>).</li>" +
			"<li>Guarda ahí el archivo («Guardar en la carpeta…» y eliges esa carpeta).</li>" +
			"<li>En la tablet, conectada a la misma wifi: abre <code>http://IP-del-PC:8080/" + esc(file) + "</code>. La IP sale en esa misma pantalla de Resolume.</li>" +
			"<li>En el navegador de la tablet: «Añadir a pantalla de inicio» para abrirlo a pantalla completa.</li></ol>" +
			'<p class="hint">También funciona abriendo el archivo en el propio PC (doble clic): se conecta a 127.0.0.1:8080.</p>' +
			"<h3>Diseño</h3>" +
			'<div class="row"><button id="exSaveJson">Guardar diseño (.json)</button><button id="exOpenJson">Abrir diseño…</button></div>' +
			'<div class="row" style="margin-top:6px"><select id="exLib">' + (names.length ? names.map((n) => '<option value="' + esc(n) + '"' + (n == layout.name ? " selected" : "") + ">" + esc(n) + "</option>").join("") : '<option value="">(ninguno guardado)</option>') + "</select></div>" +
			'<div class="row" style="margin-top:6px"><button id="exLibSave">Guardar en el navegador</button><button id="exLibLoad"' + (names.length ? "" : " disabled") + '>Cargar</button><button id="exLibDel"' + (names.length ? "" : " disabled") + ">Borrar</button></div>" +
			'<div class="row" style="margin-top:14px"><button id="exClose">Cerrar</button></div>' +
			'<input type="file" id="exFileIn" accept=".json,application/json" hidden>';
		const fname = () => { let f = $("exFile").value.trim() || "remote.html"; if (!/\.html?$/i.test(f)) f += ".html"; store.set("remoteFile", f); return f; };
		$("exDownload").onclick = () => APP.download(fname(), new Blob([remoteHtml()], { type: "text/html" }));
		$("exFolder").onclick = async () => {
			if (!window.showDirectoryPicker) { toast("Este navegador no guarda en carpetas: usa «Descargar» (o Chrome/Edge).", true); return; }
			try {
				dirHandle = await window.showDirectoryPicker({ id: "resolume-remote", mode: "readwrite" });
				const fh = await dirHandle.getFileHandle(fname(), { create: true });
				const wr = await fh.createWritable();
				await wr.write(remoteHtml());
				await wr.close();
				toast("Guardado «" + fname() + "» en «" + dirHandle.name + "».");
			} catch (e) { if (e && e.name != "AbortError") toast("No se pudo guardar: " + e.message, true); }
		};
		$("exSaveJson").onclick = () => APP.download(slug(layout.name) + ".remote.json", new Blob([JSON.stringify(layout, null, 1)], { type: "application/json" }));
		$("exOpenJson").onclick = () => $("exFileIn").click();
		$("exFileIn").onchange = (e) => {
			const f = e.target.files[0];
			if (!f) return;
			const r = new FileReader();
			r.onload = () => {
				try {
					const j = JSON.parse(r.result);
					if (j.format != "resolume-remote") throw new Error("no es un diseño de remote");
					commit(() => { layout = L.normalize(j); });
					pageIdx = 0; selId = null;
					dlg.close();
					render();
					toast("Abierto: " + layout.name);
				} catch (err) { toast("No se pudo abrir: " + err.message, true); }
			};
			r.readAsText(f);
		};
		$("exLibSave").onclick = () => { const l = store.get("remotes", {}); l[layout.name] = layout; store.set("remotes", l); toast("Guardado en el navegador: " + layout.name); openExport(); };
		$("exLibLoad").onclick = () => { const n = $("exLib").value; if (n && lib[n]) { commit(() => { layout = L.normalize(lib[n]); }); pageIdx = 0; selId = null; dlg.close(); render(); } };
		$("exLibDel").onclick = () => { const n = $("exLib").value; if (n && confirm("¿Borrar «" + n + "» del navegador?")) { const l = store.get("remotes", {}); delete l[n]; store.set("remotes", l); openExport(); } };
		$("exClose").onclick = () => dlg.close();
		if (!dlg.open) dlg.showModal();
	}

	// ---------- teclado y API para app.js ----------

	document.addEventListener("keydown", (e) => {
		if (document.body.dataset.mode != "remote" || $("rbDialog").open) return;
		const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName);
		if (typing) return;
		const k = e.key.toLowerCase();
		if ((e.ctrlKey || e.metaKey) && k == "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
		else if ((e.ctrlKey || e.metaKey) && k == "y") { e.preventDefault(); redo(); }
		else if ((e.ctrlKey || e.metaKey) && k == "d") { e.preventDefault(); duplicate(); }
		else if (mode == "edit" && (e.key == "Delete" || e.key == "Backspace")) { e.preventDefault(); removeSel(); }
		else if (mode == "edit" && e.key.indexOf("Arrow") == 0 && selId) {
			e.preventDefault();
			nudge(e.key == "ArrowLeft" ? -1 : e.key == "ArrowRight" ? 1 : 0, e.key == "ArrowUp" ? -1 : e.key == "ArrowDown" ? 1 : 0);
		}
		else if (e.key == "Escape") { selId = null; render(); }
	});

	window.RemoteBuilder = {
		init: buildShell,
		show: () => { render(); setTimeout(fitFrame, 0); },
		hide: () => { if (mode != "edit") setMode("edit"); },
		undo: undo, redo: redo,
		exportDialog: openExport,
		wizard: openWizard,
		layout: () => layout,
		setMode: setMode
	};
})();
