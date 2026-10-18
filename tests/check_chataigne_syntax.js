// Comprueba que los scripts no usan nada que el motor JS de Chataigne (JUCE) no entiende.
// Uso: node tests/check_chataigne_syntax.js [archivos...]
var fs = require("fs");
var path = require("path");

var RULES = [
	[/\blet\s/, "let"],
	[/\bconst\s/, "const"],
	[/=>/, "función flecha"],
	[/`/, "plantilla con comillas invertidas"],
	[/\bswitch\s*\(/, "switch"],
	[/\bclass\s/, "class"],
	[/for\s*\([^;)]*\s(in|of)\s/, "for...in / for...of"],
	[/\.(forEach|map|filter|reduce|some|every|find|includes)\s*\(/, "métodos de array modernos"],
	[/new\s+RegExp|\.(match|replace|test|search)\s*\(/, "expresiones regulares"],
	[/(^|[=(,:!&|?{};]\s*)\/[^/*\s]/, "posible expresión regular literal"],
	[/\.\.\./, "spread"],
	[/\btry\s*\{/, "try/catch"]
];

var ROOT = path.join(__dirname, "..");
var files = process.argv.slice(2);
if (!files.length) {
	["src/scripts", "chataigne"].forEach(function (d) {
		var dir = path.join(ROOT, d);
		if (!fs.existsSync(dir)) return;
		fs.readdirSync(dir).filter(function (f) { return /\.js$/.test(f); })
			.forEach(function (f) { files.push(path.join(dir, f)); });
	});
}

var bad = 0;
files.forEach(function (f) {
	var lines = fs.readFileSync(f, "utf8").split("\n");
	lines.forEach(function (line, i) {
		var code = line.replace(/\/\/.*$/, "").replace(/"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/g, '""');
		if (/^\s*var EMBEDDED_CONFIG = /.test(line)) return; // JSON del mapa
		RULES.forEach(function (r) {
			if (r[0].test(code)) {
				bad++;
				console.log(path.relative(ROOT, f) + ":" + (i + 1) + ": " + r[1] + "  ->  " + line.trim());
			}
		});
	});
	// que al menos se pueda interpretar como JavaScript
	try { new Function(fs.readFileSync(f, "utf8")); }
	catch (e) { bad++; console.log(path.relative(ROOT, f) + ": no compila: " + e.message); }
});
console.log(files.length + " archivos revisados, " + bad + " problemas");
process.exit(bad ? 1 : 0);
