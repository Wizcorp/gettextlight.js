#!/usr/bin/env node
"use strict";


var assert = require('assert').ok;
var fs = require('fs');
var path = require('path');
var events = require('events');
var GetText = require('../lib/index.js');
var argv = require('optimist').argv;
var esprima = require('esprima');
var FolderTraversal = require('FolderTraversal').FolderTraversal;

var SOURCE_FILES_RE = new RegExp(argv.match || '\\.js$');
var SOURCE_FOLDER = argv._[0] || '.';
var LOCALIZATION_FOLDER = argv.d || '.';
var GETTEXT_RE = /^d?p?n?gettext$/;
var COMMENT_LOCATION_RE = /^#:\s*([^:]+):(\d+)/;
var FILENAME_TO_DOMAIN_RE = /([^\/]+)\.po/i;

assert(fs.statSync(SOURCE_FOLDER).isDirectory(),       '"' + SOURCE_FOLDER       + '" is not a directory!');
assert(fs.statSync(LOCALIZATION_FOLDER).isDirectory(), '"' + LOCALIZATION_FOLDER + '" is not a directory!');

process.stderr.write('This script will now:\n');
process.stderr.write('  - Parse all files that match the regex "' + SOURCE_FILES_RE.source + '" in "' + SOURCE_FOLDER + '".\n');
process.stderr.write('  - Generate/update .po files in "' + LOCALIZATION_FOLDER + '".\n');


var domains = {},
	present = {};

var NOW_PO = (function () {
	var d     = new Date(),
		year  = d.getUTCFullYear(),
		month = d.getUTCMonth(),
		day   = d.getUTCDate(),
		hour  = d.getUTCHours(),
		min   = d.getUTCMinutes();

	year  = (year  < 1000 ? year < 100 ? year < 10 ? year < 0 ? '' : '000' : '00' : '0' : '') + year;
	month = (month < 10 ? '0' : '') + month;
	day   = (day   < 10 ? '0' : '') + day;
	hour  = (hour  < 10 ? '0' : '') + hour;
	min   = (min   < 10 ? '0' : '') + min;

	return year.concat('-', month, '-', day, ' ', hour, ':', min, '+0000');
} ());

function process_po_file(filePath, domainName) {
	var source = fs.readFileSync(path.join(LOCALIZATION_FOLDER, filePath), 'utf-8'),
		tokens = [],
		toc = {},
		location = null;

	GetText.parse(domainName, source, function (type, data) {
		switch (type) {
		case 'error':
			console.error('*** ' + filePath + ':' + data.line + ' ERROR: ' + data.message);
			if (data.fatal) {
				console.error('Fatal error. Giving up...');
				process.exit(1);
			}
			// Don't append errors to the token list
			return undefined;
		case 'comment':
			var m = COMMENT_LOCATION_RE.exec(data);
			if (m) {
				location = [m[1], m[2]];
				// Don't append location information to the token list (it will be regenerated later)
				return undefined;
			}
			break;
		case 'entry':
			// Save entry index in TOC
			toc[(data.msgctxt || '') + '\u0004' + data.msgid] = tokens.length;
			// Append location to data
			data.location = location || ['', 0];
			// Reset location
			location = null;
			break;
		}

		tokens.push([type, data]);
	});

	var domain = domains[domainName];
	if (domain === undefined) {
		domain = domains[domainName] = {};
	}

	domain[filePath] = {
		tokens: tokens,
		toc: toc
	};
}

function process_source_file(filePath) {
	function entryHandler(entry) {
		var domainName = entry.domain || 'messages',
			domain = domains[domainName],
			presentForDomain = present[domainName],
			fqid = (entry.msgctxt || '') + '\u0004' + entry.msgid;

		if (domain === undefined) {
			// New domain! Just create it at the root of the localization folder and let the user move it later.
			domain = domains[domainName] = {};
			domain[domainName + '.po'] = {
				tokens: [
					['header', {name: 'Project-Id-Version',        value: 'your-project'}],
					['header', {name: 'POT-Creation-Date',         value: NOW_PO}],
					['header', {name: 'MIME-Version',              value: '1.0'}],
					['header', {name: 'Content-Type',              value: 'text/plain; charset=UTF-8'}],
					['header', {name: 'Content-Transfer-Encoding', value: '8bit'}],
					['header', {name: 'Plural-Forms',              value: 'nplurals=2; plural=n != 1;'}],
					['blank']
				],
				toc: {}
			};
		}

		if (presentForDomain === undefined) {
			presentForDomain = present[domainName] = {}
		}
		presentForDomain[fqid] = true;

		for (var file in domain) {
			file = domain[file];
			var pos = file.toc[fqid], t;
			if (pos === undefined) {
				// entry wasn't found, add it to file!
				pos = file.toc[fqid] = file.tokens.length;
				t = {
					msgid: entry.msgid,
					msgstr:[''],
					location: ['', 0]
				};
				if (entry.msgctxt !== undefined) t.msgctxt = entry.msgctxt;
				file.tokens.push(['entry', t]);
				file.tokens.push(['blank']);
			}
			// Update entry
			t = file.tokens[pos][1];
			t.location[0] = entry.file;
			t.location[1] = entry.line;
			if (entry.msgid_plural !== undefined) t.msgid_plural = entry.msgid_plural;

		}
	}

	function error(ast, message) {
		console.error(filePath + ':' + ast.loc.start.line + ' ' + message);
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

			if (object.name && object.name.toLowerCase() === 'gettext' && GETTEXT_RE.test(func)) {
				var args = ast.arguments.map(function (a) {
					return a.type === 'Literal' ? a.value : null;
				});
				var len = args.length >>> 0;
				while (args[len - 1] === null) --len;
				args = args.slice(0, len);

				var entry = {
					file: filePath,
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

				entryHandler(entry);
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
	walk_ast(esprima.parse(fs.readFileSync(path.join(SOURCE_FOLDER, filePath), 'utf-8'), {loc: true}));
}

function write_all_po_files() {
	for (var domainName in domains) {
		var domain = domains[domainName],
			presentForDomain = present[domainName];

		for (var filePath in domain) {
			var tokens = domain[filePath].tokens,
				numTokens = tokens.length >>> 0,
				data = [],
				headersStarted = false;

			for (var i = 0; i < numTokens; ++i) {
				var token = tokens[i],
					tokenType = token[0],
					tokenData = token[1];

				switch(tokenType) {
				case 'comment':
					data.push(tokenData);
					continue;
				case 'header':
					if (!headersStarted) {
						// Open the headers block
						data.push('msgid ""\nmsgstr ""');
						headersStarted = true;
					}
					data.push('"' + tokenData.name + ': ' + tokenData.value + '\\n"');
					continue;
				case 'blank':
					data.push('');
					continue;
				case 'entry':
					var fqid = (tokenData.msgctxt || '') + '\u0004' + tokenData.msgid,
						numStr = tokenData.msgstr.length >>> 0,
						presentInSource = (fqid in presentForDomain),
						prefix = presentInSource ? '' : '#~ ';

					// Entry is currently present in source code, so add its location
					if (presentInSource) {
						data.push('#: ' + tokenData.location.join(':'));
					}

					// A context is provided
					if (tokenData.msgctxt !== undefined) {
						data.push(prefix + 'msgctxt' + JSON.stringify(tokenData.msgctxt));
					}

					data.push(prefix + 'msgid ' + JSON.stringify(tokenData.msgid));

					// A plural is provided
					if (tokenData.msgid_plural !== undefined) {
						data.push(prefix + 'msgid_plural ' + JSON.stringify(tokenData.msgid_plural));
					}

					if (numStr === 1) {
						data.push(prefix + 'msgstr ' + JSON.stringify(tokenData.msgstr[0]));
					} else for (var strIndex = 0; strIndex < numStr; ++strIndex) {
						data.push(prefix + 'msgstr[' + strIndex + '] ' + JSON.stringify(tokenData.msgstr[strIndex]));
					}
					continue;
				}
			}
			var finalPath = path.join(LOCALIZATION_FOLDER, filePath),
				tmpPath = finalPath + '.part';

			fs.writeFileSync(tmpPath, data.join('\n'), 'utf-8');
			fs.renameSync(tmpPath, finalPath);
		}
	}
}

function report_errors(errors) {
	if (errors) {
		console.log('Failed!');
		errors.forEach(function (err) {
			console.log(err);
		});
		process.exit(1);
	}
}

FolderTraversal.traverse(
	LOCALIZATION_FOLDER,
	function (filePath) {
		var m = FILENAME_TO_DOMAIN_RE.exec(filePath);
		if (m) {
			process_po_file(filePath, m[1]);
		}
	},
	function (errors) {
		report_errors(errors);
		FolderTraversal.traverse(
			SOURCE_FOLDER,
			function (filePath) {
				if (SOURCE_FILES_RE.test(filePath)) {
					process_source_file(filePath);
				}
			},
			function (errors) {
				report_errors(errors);
				write_all_po_files();
			}
		);
	}
);

