// Simulación mínima del entorno de scripts de Chataigne 1.10.4 para probar los scripts en Node.
// Cada script corre en su propio contexto (como en Chataigne) y todo lo que mandan los módulos
// se apunta en `out`.
var vm = require("vm");
var fs = require("fs");
var path = require("path");

function createRig(opts) {
	opts = opts || {};
	var out = [];
	var logs = [];
	var files = opts.files || {};

	function mod(name, extra) {
		var m = { _name: name, name: name };
		for (var k in extra) m[k] = extra[k];
		return m;
	}
	var bpm = 120, sendClock = false;
	var modules = {
		apc: mod("apc", {
			sendNoteOn: function (ch, pitch, vel) { out.push("midi " + ch + " " + pitch + " " + vel); },
			values: {
				tempo: {
					bpm: { set: function (v) { bpm = v; out.push("bpm " + v.toFixed(2)); }, get: function () { return bpm; } },
					sendClock: { set: function (v) { sendClock = v; out.push("clock " + v); }, get: function () { return sendClock; } }
				}
			}
		}),
		resolume: mod("resolume", {
			send: function (address, value) { out.push("osc " + address + " " + fmt(value)); }
		}),
		resolumeapi: mod("resolumeapi", {
			sendGET: function (url, type) { out.push("get " + url); },
			sendPUT: function (url, o) { out.push("put " + url + " " + JSON.stringify(o.payload) + " " + o.extraHeaders); }
		})
	};
	if (opts.withWs !== false) modules.resolumews = mod("resolumews", {
		send: function (msg) { out.push("ws " + msg); }
	});

	// APC adicionales: ["apc2"] -> módulos MIDI que apuntan "apc2:midi canal nota velocity"
	(opts.devices || []).forEach(function (id) {
		modules[id] = mod(id, {
			sendNoteOn: function (ch, pitch, vel) { out.push(id + ":midi " + ch + " " + pitch + " " + vel); },
			values: { tempo: { bpm: { set: function () {}, get: function () { return 120; } }, sendClock: { set: function () {}, get: function () { return true; } } } }
		});
	});

	// destinos extra: {sunlite: "midi", luces: "osc"}
	var extra = opts.targets || {};
	Object.keys(extra).forEach(function (id) {
		if (extra[id] == "midi") modules[id] = mod(id, {
			sendNoteOn: function (ch, n, v) { out.push(id + " on " + ch + " " + n + " " + v); },
			sendNoteOff: function (ch, n) { out.push(id + " off " + ch + " " + n); },
			sendCC: function (ch, n, v) { out.push(id + " cc " + ch + " " + n + " " + v); },
			sendProgramChange: function (ch, n) { out.push(id + " pc " + ch + " " + n); }
		});
		else modules[id] = mod(id, { send: function (a, v) { out.push(id + " osc " + a + " " + fmt(v)); } });
	});

	function fmt(v) { return typeof v == "number" ? String(Math.round(v * 10000) / 10000) : JSON.stringify(v); }

	var root = { modules: modules };
	// otras partes del proyecto (customVariables, states...) para las pruebas
	Object.keys(opts.root || {}).forEach(function (k) { root[k] = opts.root[k]; });
	var util = {
		fileExists: function (p) { return Object.prototype.hasOwnProperty.call(files, norm(p)); },
		readFile: function (p, asJson) {
			var t = files[norm(p)];
			if (t === undefined) return undefined;
			if (!asJson) return t;
			try { return JSON.parse(t); } catch (e) { return undefined; }
		}
	};
	function norm(p) { return p.split("\\").join("/"); }

	function load(file, moduleName) {
		var code = fs.readFileSync(file, "utf8");
		var triggers = [];
		var ctx = {
			root: root,
			local: modules[moduleName],
			util: util,
			Math: Math, parseInt: parseInt, parseFloat: parseFloat,
			script: {
				log: function (s) { logs.push("[" + moduleName + "] " + s); },
				logWarning: function (s) { logs.push("[" + moduleName + "] WARN " + s); },
				logError: function (s) { logs.push("[" + moduleName + "] ERROR " + s); },
				setUpdateRate: function (hz) { ctx._rate = hz; },
				getScriptDirectory: function () { return opts.dir || "D:/chataigne"; },
				addTrigger: function (name) {
					var t = { name: name, is: function (x) { return x === t; } };
					triggers.push(t);
					return t;
				}
			}
		};
		vm.createContext(ctx);
		vm.runInContext(code, ctx, { filename: path.basename(file) });
		ctx._triggers = triggers;
		return ctx;
	}

	return { out: out, logs: logs, files: files, modules: modules, load: load };
}

module.exports = { createRig: createRig };
