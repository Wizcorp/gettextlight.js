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
### Load a string from default language file
*gettext(msgid)*
```javascript
var greeting = GetText.gettext("Hello!");
```
> Equivalent to `GetText.dpngettext(null, null, msgid, null, null)`.

### Load a plural string from default language file
*ngettext(msgid, msgid_plural, n)*
```javascript
GetText.ngettext("Comment", "Comments", 10);
```
> Equivalent to `GetText.dpngettext(null, null, msgid, msgid_plural, n)`.

### Load a string from a specific language file
*dgettext(domain, msgid)*
```javascript
var greeting = GetText.dgettext("ja", "Hello!");
```
> Equivalent to `GetText.dpngettext(domain, null, msgid, null, null)`.

### Load a plural string from a specific language file
*dngettext(domain, msgid, msgid_plural, n)*
```javascript
GetText.dngettext("ja", "Comment", "Comments", 10);
```
> Equivalent to `GetText.dpngettext(domain, null, msgid, msgid_plural, n)`.

### Load a string of a specific context
*pgettext(msgctxt, msgid)*
```javascript
GetText.pgettext("menu items", "File");
```
> Equivalent to `GetText.dpngettext(null, msgctxt, msgid, null, null)`.

### Load a plural string of a specific context
*pngettext(msgctxt, msgid, msgid_plural, n)*
```javascript
GetText.pngettext("menu items", "Recent File", "Recent Files", 3)*
```
> Equivalent to `GetText.dpngettext(null, msgctxt, msgid, msgid_plural, n)`.

### Load a string of a specific context from specific language file
*dpgettext(domain, msgctxt, msgid)*
```javascript
GetText.dpgettext("ja", "menu items", "File");
```
> Equivalent to `GetText.dpngettext(domain, msgctxt, msgid, null, null)`.

### Load a plural string of a specific context from specific language file
*dpngettext(domain, msgctxt, msgid, msgid_plural, n)*
```javascript
GetText.dpngettext("ja", "menu items", "Recent File", "Recent Files", 3)
```

### Bind the source (.po file) to a specific domain.
*GetText.loadDomain(domain, source, error_handler)*
> `error_handler` will be called every time an error is encountered.

### Bind the source with the domain 'message'
*GetText.load(source, error_handler)*
> Equivalent to `GetText.loadDomain('messages', source, error_handler)`

### Release all data bound to the domain 'messages'
*release()*
> Equivalent to `GetText.releaseDomain('messages')`.

### Releases all data bound to the specified domain.
*releaseDomain(domain)*

### Release all data
*reset()*

### Generate a .po file
```bash
node bin/update-po-files.js ../www/
```
