(function () {
	"use strict";

	// Default plural formula, used when none is specified in .po (which means no plural).
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
	var useDomain;

	/**
	* GetText support for CommonJS and the browser.
	*/
	var GetText = {
		/**
		* Get string with the specified id.
		*
		* @param {String} msgid Id of the string to get.
		*
		* @return {String}      String found in the catalog, or msgid if not found.
		*/
		gettext: function (msgid) {
			return this.dpngettext(null, null, msgid, null, 1);
		},

		/**
		* Pluralize the string with the specified id, according to a number.
		*
		* @param {String} msgid        Id of the string to pluralize.
		* @param {String} msgid_plural Plural form of the string passed in msgid in the default language.
		* @param {Number} n            Quantity on which to base singular/plural choice (typically an integer, though that's not enforced).
		*
		* @return {String}             Pluralization as found in the catalog, or msgid if n === 1, or msgid_plural otherwise.
		*/
		ngettext: function (msgid, msgid_plural, n) {
			return this.dpngettext(null, null, msgid, msgid_plural, n);
		},

		/**
		* Get string with the specified id from the specified domain.
		*
		* @param {?String=} domain_name Domain identifier. Defaults to 'messages' if null or not provided.
		* @param {String}   msgid       Id of the string to get.
		*
		* @return {String}              String found in the catalog, or msgid if not found.
		*/
		dgettext: function (domain_name, msgid) {
			return this.dpngettext(domain_name, null, msgid, null, 1);
		},

		/**
		* Pluralize the string with the specified id from the specified domain, according to a number.
		*
		* @param {?String=} domain_name  Domain identifier. Defaults to 'messages' if null or not provided.
		* @param {String}   msgid        Id of the string to pluralize.
		* @param {String}   msgid_plural Plural form of the string passed in msgid in the default language.
		* @param {Number}   n            Quantity on which to base singular/plural choice (typically an integer, though that's not enforced).
		* @return {String}               Pluralization as found in the catalog, or msgid if n === 1, or msgid_plural otherwise.
		*/
		dngettext: function (domain_name, msgid, msgid_plural, n) {
			return this.dpngettext(domain_name, null, msgid, msgid_plural, n);
		},

		/**
		* Get string with the specified context and id.
		*
		* @param {String} msgctxt Context. Typically used to resolve ambiguity, e.g. 'cat' may have different translation depending if it's
		*                         referring to an animal or to a verb, so you may want to use 'animal' and 'verb' as contextes.
		* @param {String} msgid   Id of the string to get.
		*
		* @return {String}        String found in the catalog, or msgid if not found.
		*/
		pgettext: function (msgctxt, msgid) {
			return this.dpngettext(null, msgctxt, msgid, null, 1);
		},

		/**
		* Pluralize the string with the specified context and id, according to a number.
		*
		* @param {String} msgctxt      Context. Typically used to resolve ambiguity, e.g. 'cat' may have different translation depending if it's
		*                              referring to an animal or to a verb, so you may want to use 'animal' and 'verb' as contextes.
		* @param {String} msgid        Id of the string to pluralize.
		* @param {String} msgid_plural Plural form of the string passed in msgid in the default language.
		* @param {Number} n            Quantity on which to base singular/plural choice (typically an integer, though that's not enforced).
		*
		* @return {String}             Pluralization as found in the catalog, or msgid if n === 1, or msgid_plural otherwise.
		*/
		pngettext: function (msgctxt, msgid, msgid_plural, n) {
			return this.dpngettext(null, msgctxt, msgid, msgid_plural, n);
		},

		/**
		* Get string with the specified context and id from the specified domain.
		*
		* @param {?String=} domain_name Domain identifier. Defaults to 'messages' if null or not provided.
		* @param {String}   msgctxt     Context. Typically used to resolve ambiguity, e.g. 'cat' may have different translation depending if it's
		*                               referring to an animal or to a verb, so you may want to use 'animal' and 'verb' as contextes.
		* @param {String}   msgid       Id of the string to get.
		*
		* @return {String}              String found in the catalog, or msgid if not found.
		*/
		dpgettext: function (domain_name, msgctxt, msgid) {
			return this.dpngettext(domain_name, msgctxt, msgid, null, 1);
		},

		/**
		* Pluralize the string with the specified context and id, from the specified domain, according to a number.
		*
		* @param {?String=} domain_name   Domain identifier. Defaults to 'messages' if null or not provided.
		* @param {String}   msgctxt       Context. Typically used to resolve ambiguity, e.g. 'cat' may have different translation depending if it's
		*                                 referring to an animal or to a verb, so you may want to use 'animal' and 'verb' as contextes.
		* @param {String}   msgid         Id of the string to pluralize.
		* @param {String}   msgid_plural  Plural form of the string passed in msgid in the default language.
		* @param {Number}   n             Quantity on which to base singular/plural choice (typically an integer, though that's not enforced).
		*
		* @return {String}                Pluralization as found in the catalog, or msgid if n === 1, or msgid_plural otherwise.
		*/
		dpngettext: function (domain_name, msgctxt, msgid, msgid_plural, n) {
			domain_name  = domain_name || useDomain || DEFAULT_DOMAIN;
			msgctxt = msgctxt || '';
			msgid_plural = msgid_plural || msgid;
			n = +n;

			var value, domain = domains[domain_name];
			if (domain && domain.entries) {
				var entry = domain.entries[msgctxt + '\u0004' + msgid];
				var pluralIndex = 0;
				try {
					pluralIndex = +domain.pluralForms(isNaN(n) ? 1 : n);
				} catch (ignored) { }
				value = entry && entry[pluralIndex];
				if (value === "") {
					value = msgid;
				}
			}
			return (value !== undefined) ? value : (n === 1 ? msgid : msgid_plural);
		},

		/**
		* Parse the Portable Object (.po) source code associated with a domain.
		*
		* @param {?String=}         domain_name Domain identifier. Defaults to 'messages' if null or not provided.
		*                                       Note it's only ever used for error reporting. The parser itself doesn't care about the domain.
		* @param {String|Buffer}    source      Portable Object source code. If a Buffer object is provided its content will be interpreted as UTF-8.
		* @param {function(Object)} listener    A function that will be called for each token.
		*
		* @internal
		*/
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

			while (source && (m = PO_TOKENIZER_RE.exec(source))) {
				source = source.slice(m[0].length);
				++line;

				// Blank line separates entries
				if (m[0].length === 1) {
					if (current.msgid) {
						listener('entry', current);
					} else if (!pastHeaders) {
						pastHeaders = true;

						var raw = current.msgstr[0];
						while ((m = HEADERS_RE.exec(raw))) {
							raw = raw.slice(m[0].length);
							var name = m[1].toLowerCase(),
								value = m[2].trim();

							listener('header', {
								name: m[1], // Preserve case of original header
								value: value
							});

							if (name === 'content-type') {
								if (!(m = /\bcharset=['"]?([^"'\n;]+)/.exec(value))) {
									error('Bogus Content-Type detected: ' + JSON.stringify(value));
								} else if (SUPPORTED_CHARSETS.indexOf(m[1].toLowerCase()) === -1) {
									error('Unsupported ' + m[1] + ' charset detected. Will treat as UTF-8 anyway.');
								}
								continue;
							}

							if (name === 'plural-forms') {
								if (!(m = /\bplural=([^;]+)/.exec(value))) {
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
									} catch (e) {
										return error('Could not evaluate plural form: ' + m[1], true);
									}
								}

								listener('pluralForms', cached_plurals[m[1]]);
							}
						}
					}
					current = { msgstr: [] };
					listener('blank');
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

		/**
		* Load a Portable Object (.po) source code, and bind it to the default ('messages') domain.
		*
		* @param {String|Buffer}    source  Portable Object source code. If a Buffer object is provided its content will be interpreted as UTF-8.
		* @param {function(Object)} onerror Error handler. Called every time an error is encountered, with a single argument having the
		*                                   following properties:
        *                                     - {String}  domain_name Domain identifier.
		*                                     - {Number}  line        Line of the source code at which the error happened.
		*                                     - {String}  message     Some text explaining the problem.
		*                                     - {Boolean} fatal       Whether the error caused the parsing to stop or not.
		*/
		load: function load(source, onerror) {
			return this.loadDomain(null, source, onerror);
		},

		/**
		* Release the default ('messages') domain.
		*/
		release: function release() {
			return this.releaseDomain(null);
		},

		/**
		* Load a Portable Object (.po) source code, and bind it to the specified domain.
		*
		* @param {?String=}         domain_name Domain identifier. Defaults to 'messages' if null or not provided.
		* @param {String|Buffer}    source      Portable Object source code. If a Buffer object is provided its content will be interpreted as UTF-8.
		* @param {function(Object)} onerror     Error handler. Called every time an error is encountered, with a single argument having the
		*                                       following properties:
		*                                         - {String}  domain_name Domain identifier.
		*                                         - {Number}  line        Line of the source code at which the error happened.
		*                                         - {String}  message     Some text explaining the problem.
		*                                         - {Boolean} fatal       Whether the error caused the parsing to stop or not.
		*/
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

		/**
		* Release the specified domain.
		*
		* @param {?String=} domain_name Domain identifier. Defaults to 'messages' if null or not provided.
		*/
		releaseDomain: function releaseDomain(domain_name) {
			domain_name = domain_name || DEFAULT_DOMAIN;
			domains[domain_name] = {};
		},

		/**
		* Reset GetText, i.e. release all domains.
		*/
		reset: function reset() {
			cached_plurals = {};
			domains = {};
		},

		/**
		* Set a default domain.
		*/
		textdomain: function textdomain(domain) {
			useDomain = domain;
		}
	};

	// Export as either window.GetText or exports.GetText
	var g = new Fn('return this')();
	if (Object.prototype.toString.call(g.document) !== '[object HTMLDocument]') {
		g = exports;
	}
	g.GetText = GetText;
}());

