// Arranque del remote exportado (remote.html).
(function () {
	"use strict";
	const R = window.RemoteRuntime, CS = window.ChataigneSource;
	const layout = window.REMOTE_LAYOUT;
	const $ = (id) => document.getElementById(id);
	const store = {
		get(k) { try { return localStorage.getItem("remote." + k); } catch (e) { return null; } },
		set(k, v) { try { localStorage.setItem("remote." + k, v); } catch (e) { /* sin almacenamiento */ } }
	};
	const query = new URLSearchParams(location.search);
	const served = /^https?:$/.test(location.protocol) && location.host;

	// Qué usa el diseño: Resolume (clips, capas, parámetros de la composición) y/o Chataigne
	const uses = { resolume: false, chataigne: false };
	layout.pages.forEach((p) => p.widgets.forEach((w) => {
		if (["clipgrid", "columns", "layer", "tempo"].indexOf(w.type) >= 0) uses.resolume = true;
		[w.bind, w.bind2].forEach((b) => { if (b) { if (CS.isPath(b)) uses.chataigne = true; else uses.resolume = true; } });
	}));

	// Direcciones, por orden: ?host= / ?chataigne=  >  las elegidas en este aparato  >  las del diseño  >
	// el ordenador desde el que se sirve el remote  >  este mismo ordenador
	function pickHost(key, param, def, port) {
		return query.get(param) || store.get(key) || def || (served ? location.hostname + ":" + port : "127.0.0.1:" + port);
	}
	const resHost = query.get("host") || store.get("host") || layout.host || (served ? location.host : "127.0.0.1:8080");
	const chaHost = pickHost("chataigneHost", "chataigne", layout.chataigneHost, 42000);

	let current = 0;
	try { current = Math.min(layout.pages.length - 1, parseInt(store.get("page:" + layout.name) || "0", 10) || 0); } catch (e) { current = 0; }
	let view = null;
	document.documentElement.style.setProperty("--acc", layout.accent);
	document.title = layout.name;
	$("title").textContent = layout.name;

	const state = {};
	function status() {
		const parts = [];
		if (uses.resolume) parts.push('<i class="' + (state.resolume ? "ok" : "") + '"></i><b>Resolume</b>');
		if (uses.chataigne) parts.push('<i class="' + (state.chataigne ? "ok" : "") + '"></i><b>Chataigne</b>');
		$("status").innerHTML = parts.join("");
		const down = [];
		if (uses.resolume && !state.resolume) down.push("Resolume (" + resHost + ", activa el Webserver)");
		if (uses.chataigne && !state.chataigne) down.push("Chataigne (" + chaHost + ", activa OSC Remote Control en Preferencias)");
		$("overlay").textContent = down.length ? "Sin conexión con " + down.join(" y ") + ". Reintentando…" : "";
		$("overlay").classList.toggle("show", down.length > 0);
	}
	const res = uses.resolume ? new R.Connection({ host: resHost, onComposition: () => render(), onStatus: (ok) => { state.resolume = ok; status(); } }) : null;
	const cha = uses.chataigne ? new R.ChataigneConnection({ host: chaHost, onTree: () => render(), onStatus: (ok) => { state.chataigne = ok; status(); } }) : null;
	const conn = R.MultiConnection(res, cha);

	function tabs() {
		$("tabs").innerHTML = "";
		if (layout.pages.length < 2) return;
		layout.pages.forEach((p, i) => {
			const b = document.createElement("button");
			b.textContent = p.name;
			b.className = i == current ? "on" : "";
			b.onclick = () => { current = i; store.set("page:" + layout.name, String(i)); tabs(); render(); };
			$("tabs").appendChild(b);
		});
	}
	function render() {
		if (view) view.destroy();
		conn.clearListeners();
		view = R.renderPage($("page"), layout, layout.pages[current], conn);
		// mientras no han llegado los datos no se marcan como «no encontrado»
		view.nodes.forEach((n) => {
			const b = n.w.bind || "";
			const ready = CS.isPath(b) ? conn.tree : conn.composition;
			if (!ready) n.node.classList.remove("missing");
		});
	}

	$("status").onclick = () => {
		if (uses.resolume) {
			const h = prompt("Dirección de Resolume (IP:puerto). Vacío = automática.", resHost);
			if (h === null) return;
			store.set("host", h.trim());
		}
		if (uses.chataigne) {
			const h = prompt("Dirección de Chataigne (IP:puerto, normalmente 42000). Vacío = automática.", chaHost);
			if (h === null) return;
			store.set("chataigneHost", h.trim());
		}
		location.reload();
	};
	$("full").onclick = () => {
		const d = document.documentElement;
		if (document.fullscreenElement) document.exitFullscreen();
		else if (d.requestFullscreen) d.requestFullscreen().catch(() => {});
	};
	// que la pantalla no se apague en mitad del show
	let lock = null;
	async function keepAwake() {
		try { if ("wakeLock" in navigator && !lock) { lock = await navigator.wakeLock.request("screen"); lock.addEventListener("release", () => { lock = null; }); } } catch (e) { /* no soportado */ }
	}
	document.addEventListener("pointerdown", keepAwake);
	document.addEventListener("visibilitychange", () => { if (document.visibilityState == "visible") keepAwake(); });
	document.addEventListener("contextmenu", (e) => e.preventDefault());

	status();
	tabs();
	render();
	conn.connect();
	window.REMOTE = { conn: conn, layout: layout, uses: uses };
})();
