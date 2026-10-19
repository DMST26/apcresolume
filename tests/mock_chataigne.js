// Chataigne de mentira: el servidor OSCQuery de «OSC Remote Control» (puerto 42000 en el de verdad).
//   GET /            árbol del proyecto (JSON OSCQuery, con CORS abierto como Chataigne)
//   ws://host/       LISTEN / IGNORE y cambios de valor en JSON; responde con mensajes OSC binarios
//
// Uso: node tests/mock_chataigne.js [puerto]
"use strict";
const http = require("http");
const CS = require("../src/remote/chataigne");
const WS = require("./ws_server");

function start(opts) {
	opts = opts || {};
	const tree = opts.tree || CS.exampleTree({ targets: [{ id: "sunlite", type: "midi" }] });
	const sim = CS.sim(tree);
	const log = [];
	const server = http.createServer((req, res) => {
		const path = decodeURIComponent(req.url.split("?")[0]);
		const node = path == "/" ? tree : CS.node(tree, path);
		res.writeHead(node ? 200 : 404, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
		res.end(JSON.stringify(node || {}));
	});
	server.on("upgrade", (req, socket) => {
		let link = null;
		const ws = WS.accept(req, socket, {
			text: (t) => { log.push(JSON.parse(t)); link.receive(t); },
			close: () => link && link.close()
		});
		link = sim.connect((m) => ws.sendBinary(Buffer.from(CS.encodeOSC(m.address, m.args))));
	});
	return new Promise((resolve) => {
		server.listen(opts.port || 0, "127.0.0.1", () => resolve({ port: server.address().port, sim: sim, tree: tree, log: log, close: () => new Promise((r) => server.close(r)) }));
	});
}

module.exports = { start: start };

if (require.main === module) {
	start({ port: parseInt(process.argv[2] || "42000", 10) }).then((m) => console.log("Chataigne de prueba en http://127.0.0.1:" + m.port + "/"));
}
