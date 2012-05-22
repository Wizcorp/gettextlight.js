// FYI: http://translate.sourceforge.net/wiki/l10n/pluralforms has the plural formulas for many languages
(function () {
	"use strict";

	// Default plural formula, used when none is specified (which means no plural).
	var default_plural = function (n) {
		return 0;
	};

	// Cached plural formulas.
	var cached_plurals = {};

	// Alias Function to export GetText and (carefully) evaluate plural formulas
	// without jshint care.
	var Fn = Function;

	// Regular expressions used by this module
	var PO_TOKENIZER_RE = /^\n|^#[^\n]*\n|^(msgctxt|msgid_plural|msgid|msgstr)(?:\[(\d+)\])?[ \t]+((?:"[^\n]*"\n)+)/,
		SPLIT_LINES_RE = /\s*\n\s*/g,
		HEADERS_RE = /^([^:]+):((?:[ \t]+[^\n]+\n)+)/,
		PLURAL_FORM_VALIDATION_RE = /^(\s+|[0-9]+|n|[*+\-%<>?:()]|[<>!=]=|\|\||&&)+$/,
		OPENING_PAREN_RE = /\(/g,
		CLOSING_PAREN_RE = /\)/g;

	// Values we expect to find if a charset is ever specified.
	// (only UTF-8 and its ASCII subset are supported, along with their synonyms)
	var SUPPORTED_CHARSETS = ['utf8', 'utf-8', 'us-ascii', 'us', 'ascii', 'cp367', 'iso646-us'];

	// Domains
	var domains = {};

	// Default domain
	var DEFAULT_DOMAIN = 'messages';

	/**
	* GetText support for CommonJS and the browser.
	*/
	var GetText = {
		gettext: function (msgid) {
			return this.dpngettext(null, null, msgid, null, null);
		},
		ngettext: function (msgid, msgid_plural, n) {
			return this.dpngettext(null, null, msgid, msgid_plural, n);
		},
		dgettext: function (domain_name, msgid) {
			return this.dpngettext(domain_name, null, msgid, null, null);
		},
		dngettext: function (domain_name, msgid, msgid_plural, n) {
			return this.dpngettext(domain_name, null, msgid, msgid_plural, n);
		},
		pgettext: function (msgctxt, msgid) {
			return this.dpngettext(null, msgctxt, msgid, null, null);
		},
		pngettext: function (msgctxt, msgid, msgid_plural, n) {
			return this.dpngettext(null, msgctxt, msgid, msgid_plural, n);
		},
		dpgettext: function (domain_name, msgctxt, msgid) {
			return this.dpngettext(domain_name, msgctxt, msgid, null, null);
		},
		dpngettext: function (domain_name, msgctxt, msgid, msgid_plural, n) {
			domain_name  = domain_name || DEFAULT_DOMAIN;
			msgctxt = msgctxt || '';
			msgid_plural = msgid_plural || msgid;
			n = +n;

			var value, domain = domains[domain_name];
			if (domain && domain.entries) {
				var entry = domain.entries[msgctxt + '\u0004' + msgid],
					pluralIndex = domain.pluralForms(isNaN(n) ? 1 : n);
				value = entry && entry[pluralIndex];
			}
			return (value !== undefined) ? value : (n == 1 ? msgid : msgid_plural);
		},
		parse: function (domain_name, source, listener) {
			domain_name = domain_name || DEFAULT_DOMAIN;

			var line = 0,
				current = { msgstr: [] },
				m,
				pastHeaders,
				error = function (msg, fatal) {
					fatal = !!fatal;
					listener('error', {
						domain_name: domain_name,
						line: line,
						message: msg,
						fatal: fatal
					});
				},
				// Check if a plural form is "safe enough" to evaluate.
				// - Parentheses, if any, must be balanced.
				// - First parenthesis, if any, must be an opening one.
				// - Last parenthesis, if any, must be a closing one.
				// - Only the tokens captured by PLURAL_FORM_VALIDATION_RE are allowed.
				checkPluralForm = function checkPluralForm(form) {
					var opening_count = (form.match(OPENING_PAREN_RE) || []).length,
						closing_count = (form.match(CLOSING_PAREN_RE) || []).length;

					return opening_count === closing_count &&
						form.indexOf('(') <= form.indexOf(')') &&
						form.lastIndexOf('(') <= form.lastIndexOf(')') &&
						PLURAL_FORM_VALIDATION_RE.test(form);
				};

			if (source !== undefined && typeof source.utf8Slice === 'function') {
				// V8 buffer object, as returned by e.g. fs.readFile(). Interpret it as a UTF-8 string.
				source = source.utf8Slice(0);
			}

			while (source && (m=PO_TOKENIZER_RE.exec(source))) {
				source = source.slice(m[0].length);
				++line;

				// Blank line separates entries
				if (m[0].length === 1) {
					if (current.msgid) {
						listener('entry', current);
					} else if (!pastHeaders) {
						pastHeaders = true;

						var raw = current.msgstr[0];
						listener('raw_headers', raw);
						while ((m = HEADERS_RE.exec(raw))) {
							raw = raw.slice(m[0].length);
							var name = m[1].toLowerCase(),
								value = m[2].trim();

							listener('header', {
								name: name,
								value: value
							});

							if (name === 'content-type') {
								if (!(m=/\bcharset=['"]?([^"'\n;]+)/.exec(value))) {
									error('Bogus Content-Type detected: ' + JSON.stringify(value));
								} else if (SUPPORTED_CHARSETS.indexOf(m[1].toLowerCase()) === -1) {
									error('Unsupported ' + m[1] + ' charset detected. Will treat as UTF-8 anyway.');
								}
								continue;
							}

							if (name === 'plural-forms') {
								if (!(m=/\bplural=([^;]+)/.exec(value))) {
									error('Bogus Plural-Forms header detected: ' + JSON.stringify(value));
									continue;
								}

								if (!checkPluralForm(m[1])) {
									return error('Invalid plural form: ' + m[1], true);
								}

								if (cached_plurals[m[1]] === undefined) {
									var fn_source = '"use strict"; return (' + m[1] + ') >>> 0';
									try {
										cached_plurals[m[1]] = new Fn('n', fn_source);
									} catch(e) {
										return error('Could not evaluate plural form: ' + m[1], true);
									}
								}

								listener('pluralForms', cached_plurals[m[1]]);
							}
						}
					}
					current = { msgstr: [] };
					continue;
				}

				// Comment line
				if (!m[1]) {
					listener('comment', m[0].trim());
					continue;
				}

				// At this point m[3] is guaranteed to exist.
				var lines = m[3].split(SPLIT_LINES_RE).slice(0, -1);
				line += lines.length - 1;

				listener('raw_entry', {
					keyword: m[1],
					number: m[2],
					lines: lines
				});

				// Each line now contains a valid JSON string (though we try/catch just in case)
				var content;
				try {
					content = lines.map(JSON.parse).join('');
				} catch (ignored) {
					// Should never happen.
					return error('Parse error', true);
				}

				if (m[1] === 'msgstr') {
					current.msgstr[m[2] || 0] = content;
				} else {
					current[m[1]] = content;
				}
			}
			// Add last entry
			if (current.msgid) {
				listener('entry', current);
			}

		},
		load: function load(source, onerror) {
			return this.loadDomain(null, source, onerror);
		},
		release: function release() {
			return this.releaseDomain(null);
		},
		loadDomain: function loadDomain(domain_name, source, onerror) {
			domain_name = domain_name || DEFAULT_DOMAIN;

			this.releaseDomain(domain_name);
			var entries = {},
				pluralForms = default_plural,
				failed = false;

			this.parse(domain_name, source, function (type, data) {
				switch (type) {
				case 'error':
					if (typeof onerror === 'function') {
						onerror(data);
					} else if (onerror instanceof Array) {
						onerror.push(data);
					}
					if (data.fatal) {
						failed = true;
					}
					break;
				case 'entry':
					entries[(data.msgctxt || '') + '\u0004' + data.msgid] = data.msgstr;
					break;
				case 'pluralForms':
					pluralForms = data;
					break;
				}
			});

			var domain = domains[domain_name] = {};
			if (!failed) {
				domain.entries = entries;
				domain.pluralForms = pluralForms;
			}
		},
		releaseDomain: function releaseDomain(domain_name) {
			domain_name = domain_name || DEFAULT_DOMAIN;
			domains[domain_name] = {};
		},
		reset: function reset() {
			cached_plurals = {};
			domains = {};
		}
	};

	var g = new Fn('return this')();
	if (Object.prototype.toString.call(g.document) !== '[object HTMLDocument]') {
		g = exports;
	}
	g.GetText = GetText;
}());

/*
// Example:
var fs = require('fs');
var GetText = exports.GetText;


fs.readFile('test2.po', 'utf-8', function (err, data) {
	if (err) {
		return console.log(err);
	}

	GetText.load(data, function (err) {
		console.log('[GetText][' + err.domain_name + '][#' + err.line + '] ' + err.message);
	});

	console.log(GetText.ngettext('person', 'persons', 12));
});
*/

