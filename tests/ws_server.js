// WebSocket mínimo para los servidores de prueba (sin dependencias): texto y binario.
"use strict";
const crypto = require("crypto");

// Acepta la conexión de un "upgrade" HTTP. handlers: {text(str), close()}
// Devuelve {sendText(str), sendBinary(buffer)}
function accept(req, socket, handlers) {
	const key = crypto.createHash("sha1").update(req.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
	socket.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + key + "\r\n\r\n");
	function frame(op, data) {
		let head;
		if (data.length < 126) head = Buffer.from([0x80 | op, data.length]);
		else if (data.length < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 126; head.writeUInt16BE(data.length, 2); }
		else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 127; head.writeBigUInt64BE(BigInt(data.length), 2); }
		if (!socket.destroyed) socket.write(Buffer.concat([head, data]));
	}
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
			const payload = Buffer.from(buf.slice(off + (masked ? 4 : 0), need));
			if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
			buf = buf.slice(need);
			if (op == 0x8) { socket.end(); return; }
			if (op == 0x9) { frame(0xa, payload); continue; }
			if (op == 0x1 && handlers.text) handlers.text(payload.toString("utf8"));
		}
	});
	socket.on("close", () => handlers.close && handlers.close());
	socket.on("error", () => handlers.close && handlers.close());
	return {
		sendText: (s) => frame(0x1, Buffer.from(s)),
		sendBinary: (b) => frame(0x2, Buffer.from(b))
	};
}

module.exports = { accept: accept };
