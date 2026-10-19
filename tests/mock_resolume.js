// Resolume de mentira para probar remotes sin Resolume:
//   - WebSocket en ws://host:puerto/api/v1 que se comporta como el de Resolume (src/remote/sim.js)
//   - GET /api/v1/composition y miniaturas de clips
//   - el resto de rutas sirve archivos de una carpeta, como la «Root Directory» del webserver
//
// Uso: node tests/mock_resolume.js [puerto] [carpeta]
//      y abre http://127.0.0.1:8080/remote-ejemplo.html
// Sin dependencias: el WebSocket está hecho a mano (tests/ws_server.js).
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const SIM = require("../src/remote/sim");
const WS = require("./ws_server");
const RC = require("../src/remote/catalog");

function demoComposition() {
	const names = ["Visuales", "Strobos", "Outline", "pxel", "madrix"];
	return RC.skeleton({
		name: "Composición de prueba",
		layers: names.map((n, i) => ({ name: n, clips: Array.from({ length: i == 1 ? 17 : 16 }, (_, j) => (j % 5 == 4 ? "" : n + " " + (j + 1))) }))
	});
}

function start(opts) {
	opts = opts || {};
	const root = path.resolve(opts.root || path.join(__dirname, ".."));
	const sim = SIM.create(opts.composition || demoComposition());
	const log = [];
	// miniatura: un PNG de 1×1 gris
	const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

	const server = http.createServer((req, res) => {
		const url = decodeURIComponent(req.url.split("?")[0]);
		if (url == "/api/v1/composition") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(sim.composition())); return; }
		if (/^\/api\/v1\/composition\/.*thumbnail/.test(url)) { res.writeHead(200, { "Content-Type": "image/png" }); res.end(PNG); return; }
		const file = path.join(root, path.normalize(url == "/" ? "/index.html" : url));
		if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end("no existe"); return; }
		const type = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json" }[path.extname(file)] || "application/octet-stream";
		res.writeHead(200, { "Content-Type": type });
		fs.createReadStream(file).pipe(res);
	});

	server.on("upgrade", (req, socket) => {
		if (req.url != "/api/v1") { socket.destroy(); return; }
		let link = null;
		const ws = WS.accept(req, socket, {
			text: (t) => { log.push(JSON.parse(t)); link.receive(t); },
			close: () => link && link.close()
		});
		link = sim.connect((obj) => ws.sendText(JSON.stringify(obj)));
	});

	return new Promise((resolve) => {
		server.listen(opts.port || 0, "127.0.0.1", () => resolve({ server: server, port: server.address().port, sim: sim, log: log, close: () => new Promise((r) => server.close(r)) }));
	});
}

module.exports = { start: start, demoComposition: demoComposition };

if (require.main === module) {
	const port = parseInt(process.argv[2] || "8080", 10);
	start({ port: port, root: process.argv[3] }).then((m) => {
		console.log("Resolume de prueba en http://127.0.0.1:" + m.port + "/  (WebSocket ws://127.0.0.1:" + m.port + "/api/v1)");
		console.log("Abre http://127.0.0.1:" + m.port + "/remote-ejemplo.html");
	});
}
