// Resolume de mentira para probar remotes sin Resolume:
//   - WebSocket en ws://host:puerto/api/v1 que se comporta como el de Resolume (src/remote/sim.js)
//   - GET /api/v1/composition y miniaturas de clips
//   - el resto de rutas sirve archivos de una carpeta, como la «Root Directory» del webserver
//
// Uso: node tests/mock_resolume.js [puerto] [carpeta]
//      y abre http://127.0.0.1:8080/remote-ejemplo.html
// Sin dependencias: el WebSocket está hecho a mano (solo mensajes de texto).
"use strict";
const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const SIM = require("../src/remote/sim");
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
		const accept = crypto.createHash("sha1").update(req.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
		socket.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + accept + "\r\n\r\n");
		const send = (obj) => {
			const data = Buffer.from(JSON.stringify(obj));
			let head;
			if (data.length < 126) head = Buffer.from([0x81, data.length]);
			else if (data.length < 65536) { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 126; head.writeUInt16BE(data.length, 2); }
			else { head = Buffer.alloc(10); head[0] = 0x81; head[1] = 127; head.writeBigUInt64BE(BigInt(data.length), 2); }
			if (!socket.destroyed) socket.write(Buffer.concat([head, data]));
		};
		const link = sim.connect(send);
		let buf = Buffer.alloc(0);
		socket.on("data", (chunk) => {
			buf = Buffer.concat([buf, chunk]);
			for (;;) {
				if (buf.length < 2) return;
				const op = buf[0] & 0x0f, masked = buf[1] & 0x80;
				let len = buf[1] & 0x7f, off = 2;
				if (len == 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
				else if (len == 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
				const need = off + (masked ? 4 : 0) + len;
				if (buf.length < need) return;
				const mask = masked ? buf.slice(off, off + 4) : null;
				const payload = buf.slice(off + (masked ? 4 : 0), need);
				if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
				buf = buf.slice(need);
				if (op == 0x8) { socket.end(); return; }
				if (op == 0x9) { socket.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload])); continue; }
				if (op == 0x1) {
					const text = payload.toString("utf8");
					log.push(JSON.parse(text));
					link.receive(text);
				}
			}
		});
		socket.on("close", () => link.close());
		socket.on("error", () => link.close());
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
