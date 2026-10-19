// Pruebas del remote en Node: catálogo de parámetros, rutas -> ids, simulador, comprobaciones y asistente.
// Uso: node tests/remote.test.js
"use strict";
const C = require("../src/remote/catalog");
const L = require("../src/remote/layout");
const SIM = require("../src/remote/sim");
const mock = require("./mock_resolume");

let failures = 0, checks = 0;
function ok(name, cond, extra) {
	checks++;
	if (cond) return;
	failures++;
	console.log("FALLO: " + name + (extra ? "\n   " + extra : ""));
}

// composición con efectos y transporte, como la que manda Resolume
const comp = mock.demoComposition();
comp.layers[0].video.effects = [
	{ id: 9001, name: "Blur", display_name: "Blur", bypassed: { id: 9002, valuetype: "ParamBoolean", value: false }, params: { Amount: { id: 9003, valuetype: "ParamRange", value: 0.2, min: 0, max: 1 } } },
	{ id: 9011, name: "Blur", display_name: "Blur 2", bypassed: { id: 9012, valuetype: "ParamBoolean", value: false }, params: { Amount: { id: 9013, valuetype: "ParamRange", value: 0.5, min: 0, max: 1 } } },
	{ id: 9021, name: "Transform", params: { "Position X": { id: 9022, valuetype: "ParamRange", value: 0, min: -1000, max: 1000 } } }
];

// ---------- catálogo ----------
const entries = C.walk(comp);
const paths = entries.map((e) => e.path);
ok("catálogo: master de la composición", paths.indexOf("/composition/master") >= 0);
ok("catálogo: tempo y tap", paths.indexOf("/composition/tempocontroller/tempo") >= 0 && paths.indexOf("/composition/tempocontroller/tempo_tap") >= 0);
ok("catálogo: opacidad de capa", paths.indexOf("/composition/layers/2/video/opacity") >= 0);
ok("catálogo: lanzar clip (acción)", C.find(entries, "/composition/layers/1/clips/3/connect").kind == "action");
ok("catálogo: velocidad de clip", paths.indexOf("/composition/layers/1/clips/1/transport/controls/speed") >= 0);
ok("catálogo: efectos por nombre y duplicados con #2", paths.indexOf("/composition/layers/1/video/effects/blur/params/Amount") >= 0 && paths.indexOf("/composition/layers/1/video/effects/blur#2/params/Amount") >= 0);
ok("catálogo: parámetro con espacios", paths.indexOf("/composition/layers/1/video/effects/transform/params/Position X") >= 0);
ok("catálogo: clips vacíos solo con lanzar y estado", !entries.some((e) => e.path.indexOf("/composition/layers/1/clips/5/video") == 0) && paths.indexOf("/composition/layers/1/clips/5/connect") >= 0);
ok("catálogo: nombres en español", C.find(entries, "/composition/layers/2/video/opacity").label == "Opacidad" && /Capa 2 · Strobos/.test(C.find(entries, "/composition/layers/2/video/opacity").group));
ok("catálogo: avanzados marcados", C.find(entries, "/composition/layers/1/name").advanced === true);

// ---------- de ruta a id ----------
ok("resolver: parámetro", C.resolve(comp, "/composition/layers/2/video/opacity").param.id == comp.layers[1].video.opacity.id);
ok("resolver: efecto por nombre", C.resolve(comp, "/composition/layers/1/video/effects/blur#2/params/Amount").param.id == 9013);
ok("resolver: efecto por número", C.resolve(comp, "/composition/layers/1/video/effects/3/params/Position X").param.id == 9022);
ok("resolver: lanzar clip -> trigger por id", C.resolve(comp, "/composition/layers/2/clips/4/connect").trigger == "/composition/clips/by-id/" + comp.layers[1].clips[3].id + "/connect");
ok("resolver: columna", C.resolve(comp, "/composition/columns/3/connect").trigger == "/composition/columns/by-id/" + comp.columns[2].id + "/connect");
ok("resolver: vaciar capa", C.resolve(comp, "/composition/layers/1/clear").trigger == "/composition/layers/by-id/" + comp.layers[0].id + "/clear");
ok("resolver: limpiar todo", C.resolve(comp, "/composition/disconnect-all").trigger == "/composition/disconnect-all");
ok("resolver: lo que no existe = null", C.resolve(comp, "/composition/layers/9/video/opacity") === null && C.resolve(comp, "/composition/nada") === null);
// tras reordenar efectos, el de nombre sigue apuntando al mismo
const moved = JSON.parse(JSON.stringify(comp));
moved.layers[0].video.effects.reverse();
ok("resolver: efectos reordenados", C.resolve(moved, "/composition/layers/1/video/effects/transform/params/Position X").param.id == 9022);

// ---------- simulador ----------
const sim = SIM.create(JSON.parse(JSON.stringify(comp)));
const got = [];
const link = sim.connect((m) => got.push(m));
ok("sim: manda la composición al conectar", got[0].layers && got[1].type == "sources_update" && got[2].type == "effects_update");
const op = comp.layers[0].video.opacity.id;
link.receive({ action: "subscribe", parameter: "/parameter/by-id/" + op });
link.receive({ action: "set", parameter: "/parameter/by-id/" + op, value: 0.25 });
ok("sim: subscribe y set", got.some((m) => m.type == "parameter_subscribed" && m.id == op) && got.some((m) => m.type == "parameter_update" && m.id == op && m.value == 0.25));
link.receive({ action: "set", parameter: "/parameter/by-id/" + op, value: 7 });
ok("sim: valor recortado al rango", sim.composition().layers[0].video.opacity.value == 1);
link.receive({ action: "reset", parameter: "/parameter/by-id/" + op });
ok("sim: reset", sim.composition().layers[0].video.opacity.value == 1);
const c3 = sim.composition().layers[0].clips[2];
link.receive({ action: "subscribe", parameter: "/parameter/by-id/" + c3.connected.id });
link.receive({ action: "trigger", parameter: "/composition/clips/by-id/" + c3.id + "/connect", value: true });
ok("sim: lanzar clip", c3.connected.index == 3 && got.some((m) => m.type == "parameter_update" && m.id == c3.connected.id && m.value == "Connected"));
link.receive({ action: "trigger", parameter: "/composition/layers/by-id/" + sim.composition().layers[0].id + "/clear", value: true });
ok("sim: vaciar capa", c3.connected.index == 1);
const empty = sim.composition().layers[0].clips[4];
link.receive({ action: "trigger", parameter: "/composition/clips/by-id/" + empty.id + "/connect", value: true });
ok("sim: un clip vacío no se lanza", empty.connected.index == 0);
link.receive({ action: "trigger", parameter: "/composition/columns/by-id/" + sim.composition().columns[1].id + "/connect", value: true });
ok("sim: columna lanza el clip 2 de cada capa", sim.composition().layers.every((l) => l.clips[1].connected.index == 3));
const ch = sim.composition().layers[0].video.mixer["Blend Mode"];
link.receive({ action: "set", parameter: "/parameter/by-id/" + ch.id, value: 2 });
ok("sim: elección por índice", ch.index == 2 && ch.value == ch.options[2]);

// ---------- formato y comprobaciones ----------
const raw = { pages: [{ widgets: [{ type: "fader", x: 50, y: 50, w: 1, h: 4, bind: "/composition/master" }, { type: "raro" }] }] };
const n = L.normalize(raw);
ok("formato: valores por defecto", n.device == "tablet-h" && n.cols == 12 && n.rows == 8 && n.pages[0].name);
ok("formato: control fuera de la rejilla se mete dentro", n.pages[0].widgets[0].x == 11 && n.pages[0].widgets[0].y == 4);
ok("formato: tipo desconocido = texto", n.pages[0].widgets[1].type == "label");

const lay = L.normalize({
	device: "tablet-h",
	pages: [{ name: "A", widgets: [
		{ id: "a", type: "fader", x: 0, y: 0, w: 1, h: 4, bind: "/composition/master" },
		{ id: "b", type: "fader", x: 0, y: 2, w: 1, h: 4, bind: "/composition/layers/9/video/opacity" },
		{ id: "c", type: "button", x: 3, y: 0, w: 1, h: 1 },
		{ id: "d", type: "clipgrid", x: 4, y: 0, w: 2, h: 1, opts: { layer: 1, count: 16, cols: 16 } }
	] }, { name: "B", widgets: [] }]
});
const issues = L.check(lay, comp);
const has = (re, id) => issues.some((i) => re.test(i.msg) && (!id || i.widget == id));
ok("revisión: parámetro que no existe", has(/no existe en la composición/, "b"));
ok("revisión: control sin conectar", has(/no está conectado/, "c"));
ok("revisión: solapados", has(/encima de otro/));
ok("revisión: demasiado pequeño para el dedo", has(/pequeño para el dedo/, "d"));
ok("revisión: página vacía", has(/está vacía/));
ok("huecos: fits y findSpot", !L.fits(lay.pages[0], 12, 8, 0, 0, 1, 1) && L.fits(lay.pages[0], 12, 8, 6, 0, 2, 2) && L.findSpot(lay.pages[1], 12, 8, 3, 3).x === 0);

// ---------- asistente ----------
const gen = L.generate(comp, { clipLayers: [1, 2, 3, 4, 5], clipsPerLayer: 8, columns: true, mixLayers: [1, 2, 3], tempo: true, master: true, effectsLayer: 1 }, "tablet-h", "Prueba");
const names = gen.pages.map((p) => p.name);
ok("asistente: páginas", names.indexOf("Mezcla") >= 0 && names.some((x) => /^Clips/.test(x)) && names.some((x) => /^Efectos/.test(x)), names.join(", "));
const genIssues = L.check(gen, comp).filter((i) => i.level != "consejo");
ok("asistente: sin errores ni solapes", genIssues.length == 0, JSON.stringify(genIssues.slice(0, 3)));
const all = gen.pages.reduce((a, p) => a.concat(p.widgets), []);
ok("asistente: todas las capas de clips", [1, 2, 3, 4, 5].every((l) => all.some((w) => w.type == "clipgrid" && w.opts.layer == l)));
ok("asistente: tempo, master y tiras", all.some((w) => w.type == "tempo") && all.some((w) => w.bind == "/composition/master") && all.filter((w) => w.type == "layer").length == 3);
ok("asistente: efectos por nombre", all.some((w) => w.bind == "/composition/layers/1/video/effects/blur/params/Amount"));
const phone = L.generate(comp, { clipLayers: [1, 2], mixLayers: [1, 2], tempo: true, master: true }, "phone-v", "Móvil");
ok("asistente: móvil sin errores", L.check(phone, comp).filter((i) => i.level == "error" || /encima/.test(i.msg)).length == 0);
const res = L.rescale(JSON.parse(JSON.stringify(gen)), 6, 10);
ok("reescalar: todo dentro", res.pages.every((p) => p.widgets.every((w) => w.x + w.w <= 6 && w.y + w.h <= 10)));

console.log("\nComprobaciones: " + checks + ", fallos: " + failures);
process.exit(failures ? 1 : 0);
