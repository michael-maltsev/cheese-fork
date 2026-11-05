# CheeseFork

![logo](logo.png)

A scheduling helper web application for Technion students.

Use the language selector to switch between Hebrew and English. You can also open
`?lang=en` or `?lang=he`; an explicit URL language takes priority over the saved
browser preference. Hebrew remains the default. Switching languages reloads the
page while retaining its other URL parameters and fragment.

Course names, syllabuses, staff names, catalog notes, and existing histogram images
remain in their source language. In English mode, Hebrew course reviews offer a
**Translate to English** button. Where supported, this uses the browser's native
Translator API after a click and keeps the original review available. Other
browsers show instructions for their built-in translation command. Translations
are never saved back to the review database.

## Development

Serve this directory with any static HTTP server. No application build is needed.
Run the checks with Node.js 24 or later:

```sh
npm ci
npm run lint
npm test
```

The tests use synthetic course and review data without connecting to Firebase or
the Technion grades portal. DOM integration checks complement the ES5 browser
compatibility lint; they do not replace visual checks in a real browser.

## Localization

`i18n.js` provides `CheeseI18n.t(key, parameters)` and explicit `data-i18n`
attributes for static text. The complete catalogs are `locales/he.js` and
`locales/en.js`. Keep their keys and `{parameter}` placeholders in sync; the tests
check both. Use separate elements for translated text and existing icons or links.
Use `.text()` or escape interpolated values when building HTML, including quotes
when placing text inside an attribute.

Locale selection also sets the document's `lang` and `dir`. `i18n.css` supplies
the LTR adjustments for the existing RTL styles. Internal links should use
`CheeseI18n.withLocale(url)`, including links to standalone widgets. Keep raw
Technion data keys and saved lesson identifiers independent of their displayed
translations.

The histogram-sharing script runs inside the Technion grades portal, so its small
translation catalog is isolated inside `share-histograms.js`. It reads `lang`
from its own script URL and changes only its overlay, preserving the host page's
language and direction. Old sharing links continue to default to Hebrew.
