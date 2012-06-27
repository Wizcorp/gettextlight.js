GetText support for CommonJS and the browser
=======
# Lightweight GetText for Javascript
This module provides GetText support for both CommonJS and the browser.

Categories and locales are not supported, and will never be. It is assumed that the content currently loaded into GetText matches the current locale.

## Server-side example

```js
var fs = require('fs');
var GetText = require('gettextlight').GetText;

function errorHandler(err) {
	console.log('[GetText][' + err.domain_name + '][#' + err.line + '] ' + err.message);
}

GetText.load(fs.readFileSync('en/messages.po', 'utf-8'), errorHandler);
GetText.loadDomain('domain1', fs.readFileSync('en/domain1.po', 'utf-8'), errorHandler);

console.log(GetText.ngettext('person', 'persons', 12));
console.log(GetText.dpgettext('domain1', 'animal', 'cat'));
```

## Browser example

```html
<script src="gettextlight/lib/index.js"></script>
<script>//<![CDATA[
function errorHandler(err) {
	console.log('[GetText][' + err.domain_name + '][#' + err.line + '] ' + err.message);
}

function on_localization_data(data) {
	var numPOFiles = data && data.length >>> 0;
	while (numPOFiles > 0) {
		var po = data[--numPOFiles];
		// if po.domainName is undefined or null, the default domain ('messages') is used
		window.GetText.loadDomain(po.domainName, po.content, errorHandler);
	}

	console.log(window.GetText.ngettext('person', 'persons', 12));
	console.log(window.GetText.dpgettext('domain1', 'animal', 'cat'));
}

//]]>
</script>
<!-- query some JSONP content -->
<script src="get_po_content.js?callback=on_localization_data"></script>
```

## API
* `GetText.gettext(msgid)` is equivalent to `GetText.dpngettext(null, null, msgid, null, null)`.
* `GetText.ngettext(msgid, msgid_plural, n)` is equivalent to `GetText.dpngettext(null, null, msgid, msgid_plural, n)`.
* `GetText.dgettext(domain, msgid)` is equivalent to `GetText.dpngettext(domain, null, msgid, null, null)`.
* `GetText.dngettext(domain, msgid, msgid_plural, n)` is equivalent to `GetText.dpngettext(domain, null, msgid, msgid_plural, n)`.
* `GetText.pgettext(msgctxt, msgid)` is equivalent to `GetText.dpngettext(null, msgctxt, msgid, null, null)`.
* `GetText.pngettext(msgctxt, msgid, msgid_plural, n)` is equivalent to `GetText.dpngettext(null, msgctxt, msgid, msgid_plural, n)`.
* `GetText.dpgettext(domain, msgctxt, msgid)` is equivalent to `GetText.dpngettext(domain, msgctxt, msgid, null, null)`.
* `GetText.dpngettext(domain, msgctxt, msgid, msgid_plural, n)`.
* `GetText.load(source, error_handler)` is equivalent to `GetText.loadDomain('messages', source, error_handler)`..
* `GetText.loadDomain(domain, source, error_handler)` binds `source` (the content of a .po file) to the specified domain. `error_handler` will be called every time an error is encountered.
* `GetText.release()` is equivalent to `GetText.releaseDomain('messages')`.
* `GetText.releaseDomain(domain)` releases all data currently bound to the specified domain.
* `GetText.reset()` releases all data.
