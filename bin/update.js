#!/usr/bin/env node
"use strict";

var assert = require('assert').ok,
	fs = require('fs'),
	path = require('path'),
	events = require('events'),
	GetText = require('poo').GetText,
	argv = require('optimist').argv,
	esprima = require('esprima'),
	FolderTraversal = require('FolderTraversal').FolderTraversal;

var SOURCE_FILES_RE = new RegExp(argv.match || '\\.js$'),
	SOURCE_FOLDER = argv._[0] || '.',
	LOCALIZATION_FOLDER = argv.d || '.',
	GETTEXT_RE = /^d?p?n?gettext$/;

assert(fs.statSync(SOURCE_FOLDER).isDirectory(),       '"' + SOURCE_FOLDER       + '" is not a directory!');
assert(fs.statSync(LOCALIZATION_FOLDER).isDirectory(), '"' + LOCALIZATION_FOLDER + '" is not a directory!');

process.stderr.write('This script will now:\n');
process.stderr.write('  - Parse all files that match the regex "' + SOURCE_FILES_RE.source + '" in "' + SOURCE_FOLDER + '".\n');
process.stderr.write('  - Generate/update .po files in "' + LOCALIZATION_FOLDER + '".\n');


function process_source_file(filePath) {
	var current_source_file = path.join(SOURCE_FOLDER, filePath);

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
	walk_ast(esprima.parse(fs.readFileSync(current_source_file, 'utf-8'), {loc: true}));
}

FolderTraversal.traverse(
	SOURCE_FOLDER,
	function (filePath) {
		if (SOURCE_FILES_RE.test(filePath)) {
			return process_source_file(filePath);
		}
	},
	function () {
		console.log('ok');
	}
);

