#!/usr/bin/env node
"use strict";

var assert = require('assert').ok,
	fs = require('fs'),
	events = require('events'),
	GetText = require('poo').GetText,
	argv = require('optimist').argv,
	esprima = require("esprima");

var js_match = argv.match || '\\.js$',
	srcdir = argv._[0] || '.',
	locdir = argv.d || '.';

assert(fs.statSync(srcdir).isDirectory(), JSON.stringify(srcdir) + ' is not a directory!');
assert(fs.statSync(locdir).isDirectory(), JSON.stringify(locdir) + ' is not a directory!');

process.stderr.write('This script will now:\n');
process.stderr.write('  - Parse all files that match the regex ' + JSON.stringify(js_match) + ' in ' + JSON.stringify(srcdir) + '.\n');
process.stderr.write('  - Generate/update .po files in ' + JSON.stringify(locdir) + '.\n');

function main() {
	var GETTEXT_RE = /^d?p?n?gettext$/;
	var current_source_file;

	function error(ast, message) {
		console.error(current_source_file + ':' + ast.loc.start.line + ' ' + message);
	}

	function walk_ast(ast) {
		if (ast.type === 'CallExpression' &&
			ast.callee.type === 'MemberExpression' &&
			ast.callee.object.type !== 'ThisExpression'
		) {
			var object = ast.callee.object,
				func = ast.callee.property.name;
			while (object.type === 'MemberExpression') {
				object = object.property;
			}
			if (object.name === 'GetText' && GETTEXT_RE.test(func)) {
				var args = ast.arguments.map(function (a) {
					return a.type === 'Literal' ? a.value : null;
				});
				var len = args.length >>> 0;
				while (args[len - 1] === null) --len;
				args = args.slice(0, len);

				var entry = {
					file: current_source_file,
					line: ast.loc.start.line,
					func: func
				};

				var numargs;
				switch (func) {
				case 'gettext':
					numargs = 1;
					entry.msgid = args[0];
					break;
				case 'ngettext':
					numargs = 3;
					entry.msgid = args[0];
					entry.msgid_plural = args[1];
					break;
				case 'pgettext':
					numargs = 2;
					entry.msgctxt = args[0];
					entry.msgid = args[1];
					break;
				case 'pngettext':
					numargs = 4;
					entry.msgctxt = args[0];
					entry.msgid = args[1];
					entry.msgid_plural = args[2];
					break;
				case 'dgettext':
					numargs = 2;
					entry.domain = args[0];
					entry.msgid = args[1];
					break;
				case 'dngettext':
					numargs = 4;
					entry.domain = args[0];
					entry.msgid = args[1];
					entry.msgid_plural = args[2];
					break;
				case 'dpgettext':
					numargs = 3;
					entry.domain = args[0];
					entry.msgctxt = args[1];
					entry.msgid = args[2];
					break;
				case 'dpngettext':
					numargs = 5;
					entry.domain = args[0];
					entry.msgctxt = args[1];
					entry.msgid = args[2];
					entry.msgid_plural = args[3];
					break;
				}

				if (numargs !== ast.arguments.length) {
					return error(ast, func + '() expects ' + numargs + ' arguments, found ' + ast.arguments.length);
				}

				var bad = ['domain', 'msgctxt', 'msgid', 'msgid_plural'].filter(function (v) {
					return v in entry && typeof entry[v] !== 'string';
				});
				if (bad.length) {
					return error(ast, func + '(): bad param(s) ' + bad);
				}

				console.log(JSON.stringify(entry));

				return undefined;
			}
		}

		for (var key in ast) {
			var sub = ast[key];
			if (sub instanceof Array) {
				sub.forEach(walk_ast);
			} else if (sub && typeof sub === 'object') {
				walk_ast(sub);
			}
		}
	}

	// Process all the Javascript files
	function walk(dir, match_re) {
		fs.readdirSync(dir).forEach(function (fn) {
			fn = dir + '/' + fn;
			if (match_re.exec(fn)) {
				current_source_file = fn;
				walk_ast(esprima.parse(fs.readFileSync(fn, 'utf-8'), {loc: true}));
			}
			if (fs.statSync(fn).isDirectory()) {
				walk(fn, match_re);
			}
		});
	}

	walk(srcdir, new RegExp(js_match));
	process.exit(0);
}

if (argv.y) {
	main();
} else {
	var readline = require('readline');
	readline.createInterface(process.stdin, process.stderr).on('line', main);
	process.stderr.write('Press Enter to continue, or Ctrl+C to abort...\n');
}

