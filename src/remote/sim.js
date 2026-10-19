// Resolume de mentira: responde a los mensajes del WebSocket como Resolume (subscribe, set, get,
// reset, trigger) sobre una composición en memoria. Lo usan el botón «Probar» del constructor
// (sin Resolume delante) y las pruebas automáticas (tests/mock_resolume.js).
(function (S) {
	"use strict";

	// send(message) se llama para cada mensaje que Resolume mandaría a ESTE cliente.
	S.create = function (composition) {
		var comp = composition;
		var byId = {};
		var defaults = {};
		var clients = [];

		function index(o) {
			if (!o || typeof o != "object") return;
			if (Array.isArray(o)) { o.forEach(index); return; }
			if (typeof o.valuetype == "string" && o.id !== undefined) {
				byId[o.id] = o;
				if (!(o.id in defaults)) defaults[o.id] = o.valuetype == "ParamChoice" ? o.index : o.value;
			}
			Object.keys(o).forEach(function (k) { if (k != "options") index(o[k]); });
		}
		index(comp);

		function msg(type, p) {
			var m = { type: type, path: "/parameter/by-id/" + p.id };
			Object.keys(p).forEach(function (k) { m[k] = p[k]; });
			return m;
		}
		function notify(p) {
			clients.forEach(function (c) { if (c.subs[p.id]) c.send(msg("parameter_update", p)); });
		}
		function setParam(p, value) {
			if (p.valuetype == "ParamChoice") {
				var i = typeof value == "number" ? value : p.options.indexOf(value);
				if (i < 0 || i >= p.options.length) return;
				p.index = i; p.value = p.options[i];
			} else if (p.valuetype == "ParamRange") {
				var v = Number(value);
				if (isNaN(v)) return;
				p.value = Math.max(p.min, Math.min(p.max, v));
			} else if (p.valuetype == "ParamBoolean") p.value = !!value;
			else if (p.valuetype == "ParamEvent") { if (value) onEvent(p); return; }
			else p.value = value;
			notify(p);
		}
		function choice(p, i) { if (p && p.index != i) { p.index = i; p.value = p.options[i]; notify(p); } }
		function idOf(path) { var m = /by-id\/(\d+)/.exec(path); return m ? parseInt(m[1], 10) : null; }
		function find(list, id) { for (var i = 0; i < (list || []).length; i++) if (list[i].id == id) return { item: list[i], index: i }; return null; }

		function onEvent(p) {
			var t = comp.tempocontroller || {};
			if (p === t.tempo_push && t.tempo) setParam(t.tempo, t.tempo.value + 1);
			if (p === t.tempo_pull && t.tempo) setParam(t.tempo, t.tempo.value - 1);
		}
		function connectClip(layer, clip) {
			(layer.clips || []).forEach(function (c) {
				if (!c.connected || c.connected.index == 0) return;
				choice(c.connected, c === clip ? 3 : 1);
			});
		}
		function trigger(path, value) {
			if (!value) return; // el disparo cuenta al pulsar
			var id = idOf(path);
			if (path == "/composition/disconnect-all") {
				(comp.layers || []).forEach(function (l) { connectClip(l, null); });
				(comp.columns || []).forEach(function (c) { choice(c.connected, 1); });
				return;
			}
			if (/^\/composition\/clips\/by-id\/\d+\/connect$/.test(path)) {
				(comp.layers || []).forEach(function (l) {
					var f = find(l.clips, id);
					if (f && f.item.connected.index > 0) connectClip(l, f.item);
				});
			} else if (/^\/composition\/columns\/by-id\/\d+\/connect$/.test(path)) {
				var col = find(comp.columns, id);
				if (!col) return;
				(comp.columns || []).forEach(function (c, i) { choice(c.connected, i == col.index ? 3 : 1); });
				(comp.layers || []).forEach(function (l) {
					var c = l.clips && l.clips[col.index];
					if (c && c.connected.index > 0) connectClip(l, c);
				});
			} else if (/^\/composition\/layers\/by-id\/\d+\/clear$/.test(path)) {
				var l = find(comp.layers, id);
				if (l) connectClip(l.item, null);
			} else if (/\/select$/.test(path)) {
				["layers", "decks", "columns"].forEach(function (k) {
					var f = find(comp[k], id);
					if (!f) return;
					comp[k].forEach(function (x) { if (x.selected) { x.selected.value = x === f.item; notify(x.selected); } });
				});
				(comp.layers || []).forEach(function (l) {
					var f = find(l.clips, id);
					if (!f) return;
					(comp.layers || []).forEach(function (l2) {
						(l2.clips || []).forEach(function (c) { if (c.selected && c.selected.value != (c === f.item)) { c.selected.value = c === f.item; notify(c.selected); } });
					});
				});
			}
		}

		return {
			composition: function () { return comp; },
			// conectar un cliente: devuelve una función para pasarle los mensajes que manda
			connect: function (send) {
				var c = { send: send, subs: {} };
				clients.push(c);
				send(JSON.parse(JSON.stringify(comp)));
				send({ type: "sources_update", value: { video: [], audio: [] } });
				send({ type: "effects_update", value: { video: [], audio: [] } });
				return {
					receive: function (m) {
						if (typeof m == "string") { try { m = JSON.parse(m); } catch (e) { return; } }
						var id = idOf(m.parameter || "");
						var p = id != null ? byId[id] : null;
						if (m.action == "subscribe" && p) { c.subs[p.id] = true; send(msg("parameter_subscribed", p)); }
						else if (m.action == "unsubscribe" && p) { delete c.subs[p.id]; send(msg("parameter_unsubscribed", p)); }
						else if (m.action == "get" && p) send(msg("parameter_get", p));
						else if (m.action == "set" && p) { setParam(p, m.value); send(msg("parameter_set", p)); }
						else if (m.action == "reset" && p) setParam(p, defaults[p.id]);
						else if (m.action == "trigger") trigger(m.parameter, m.value);
					},
					close: function () { clients.splice(clients.indexOf(c), 1); }
				};
			}
		};
	};
})(typeof module != "undefined" && module.exports ? module.exports : (window.ResolumeSim = {}));
