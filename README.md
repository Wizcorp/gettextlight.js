GetText support for Node.js and Component
=======
# Lightweight GetText for Javascript
This module provides GetText support for both Node.js and the Component.

Categories and locales are not supported, and will never be. It is assumed that the content currently loaded into GetText matches the current locale.

## Server-side example

```javascript
var fs = require('fs');
var gettext = require('gettextlight');

function errorHandler(err) {
	console.log('[GetText][' + err.domain_name + '][#' + err.line + '] ' + err.message);
}

gettext.load(fs.readFileSync('en/messages.po', 'utf-8'), errorHandler);
gettext.loadDomain('domain1', fs.readFileSync('en/domain1.po', 'utf-8'), errorHandler);

console.log(gettext.ngettext('person', 'persons', 12));
console.log(gettext.dggettext('domain1', fs.readFileSync('ja/domain1.po', 'utf-8'), 'cat'));
```

## Browser example

```javascript
var gettext = require('gettextlight');

function errorHandler(err) {
	console.log('[GetText][' + err.domain_name + '][#' + err.line + '] ' + err.message);
}

/**
 * Called on getting data from the server
 * The parameter data is an array of object contening the domainName and the content of the po file
 */
function on_localization_data(data) {
	var numPOFiles = data && data.length >>> 0;
	while (numPOFiles > 0) {
		var po = data[--numPOFiles];
		// if po.domainName is undefined or null, the default domain ('messages') is used
		gettext.loadDomain(po.domainName, po.content, errorHandler);
	}

	// Set the default domain
	gettext.textdomain('nature');

	// Output the translation of "person" based on the number from the default domain
	console.log(gettext.ngettext('person', 'persons', 12));

	// Output the translation of "cat" from the domain "animal"
	console.log(gettext.dgettext('animal', 'cat'));
}
```
> Note: we are using Component for the frontend

## API
### Load a string from default language file
*gettext(msgid)*
```javascript
var greeting = gettext.gettext("Hello!");
```
> Equivalent to `gettext.dpngettext(null, null, msgid, null, null)`.

### Load a plural string from default language file
*ngettext(msgid, msgid_plural, n)*
```javascript
gettext.ngettext("Comment", "Comments", 10);
```
> Equivalent to `gettext.dpngettext(null, null, msgid, msgid_plural, n)`.

### Load a string from a specific language file
*dgettext(domain, msgid)*
```javascript
var greeting = gettext.dgettext("ja", "Hello!");
```
> Equivalent to `gettext.dpngettext(domain, null, msgid, null, null)`.

### Load a plural string from a specific language file
*dngettext(domain, msgid, msgid_plural, n)*
```javascript
gettext.dngettext("ja", "Comment", "Comments", 10);
```
> Equivalent to `gettext.dpngettext(domain, null, msgid, msgid_plural, n)`.

### Load a string of a specific context
*pgettext(msgctxt, msgid)*
```javascript
gettext.pgettext("menu items", "File");
```
> Equivalent to `gettext.dpngettext(null, msgctxt, msgid, null, null)`.

### Load a plural string of a specific context
*pngettext(msgctxt, msgid, msgid_plural, n)*
```javascript
gettext.pngettext("menu items", "Recent File", "Recent Files", 3);
```
> Equivalent to `gettext.dpngettext(null, msgctxt, msgid, msgid_plural, n)`.

### Load a string of a specific context from specific language file
*dpgettext(domain, msgctxt, msgid)*
```javascript
gettext.dpgettext("ja", po, "Cat");
```
> Equivalent to `gettext.dpngettext(domain, msgctxt, msgid, null, null)`.

### Load a plural string of a specific context from specific language file
*dpngettext(domain, msgctxt, msgid, msgid_plural, n)*
```javascript
gettext.dpngettext("ja", "menu items", "Recent File", "Recent Files", 3);
```

### Bind the source (.po file) to a specific domain.
*gettext.loadDomain(domain, source, error_handler)*
> `error_handler` will be called every time an error is encountered.

### Bind the source with the domain 'message'
*gettext.load(source, error_handler)*
> Equivalent to `gettext.loadDomain('messages', source, error_handler)`

### Release all data bound to the domain 'messages'
*release()*
> Equivalent to `gettext.releaseDomain('messages')`.

### Releases all data bound to the specified domain.
*releaseDomain(domain)*

### Release all data
*reset()*

### Set a default domain
*textdomain(domain)*
```javascript
gettext.textdomain("ja");
```

### Generate a .po file
```bash
node bin/update-po-files.js <source_path> [-d <dest_path>]
```
> To be able to extract the data, the required object has to be named `gettext` (case insensitive)
