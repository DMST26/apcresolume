// Arranque del remote exportado (remote.html).
(function () {
	"use strict";
	const R = window.RemoteRuntime;
	const layout = window.REMOTE_LAYOUT;
	const $ = (id) => document.getElementById(id);
	const store = {
		get(k) { try { return localStorage.getItem("remote." + k); } catch (e) { return null; } },
		set(k, v) { try { localStorage.setItem("remote." + k, v); } catch (e) { /* sin almacenamiento */ } }
	};

	// Dirección de Resolume, por orden:
	// ?host=ip:puerto  >  la que elegiste en este aparato  >  la del propio Resolume si el remote
	// se abre desde su webserver  >  la del remote  >  127.0.0.1:8080
	function pickHost() {
		const q = new URLSearchParams(location.search).get("host");
		if (q) return q;
		const saved = store.get("host");
		if (saved) return saved;
		if (/^https?:$/.test(location.protocol) && location.host) return location.host;
		return layout.host || "127.0.0.1:8080";
	}

	let current = 0;
	try { current = Math.min(layout.pages.length - 1, parseInt(store.get("page:" + layout.name) || "0", 10) || 0); } catch (e) { current = 0; }
	let view = null;
	document.documentElement.style.setProperty("--acc", layout.accent);
	document.title = layout.name;
	$("title").textContent = layout.name;

	const conn = new R.Connection({
		host: pickHost(),
		onComposition: () => render(),
		onStatus: (ok) => {
			$("status").classList.toggle("ok", ok);
			$("statusText").textContent = ok ? conn.host : "Sin conexión";
			$("overlay").textContent = ok ? "" : "Sin conexión con Resolume (" + conn.host + "). Reintentando… Revisa que el Webserver esté activado.";
			$("overlay").classList.toggle("show", !ok);
		}
	});

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
		// mientras no hay composición no se marcan como «no encontrado»
		if (!conn.composition) view.nodes.forEach((n) => n.node.classList.remove("missing"));
	}

	$("status").onclick = () => {
		const h = prompt("Dirección de Resolume (IP:puerto). Vacío = automática.", conn.host);
		if (h === null) return;
		store.set("host", h.trim());
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

	tabs();
	render();
	conn.connect();
	window.REMOTE = { conn: conn, layout: layout };
})();
