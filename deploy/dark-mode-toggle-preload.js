'use strict';

// eslint-disable-next-line no-unused-vars
function getStylesheetTagsForDarkModeToggle(darkModeHref) {
    var PREFERS_COLOR_SCHEME = 'prefers-color-scheme';
    var LIGHT = 'light';
    var DARK = 'dark';
    var ALL = 'all';
    var NOT_ALL = 'not all';
    var NAME = 'dark-mode-toggle';

    var mode = null;
    try {
        mode = localStorage.getItem(NAME);
    } catch (e) {
        // Do nothing.
    }

    // var lightCSSMedia = '(' + PREFERS_COLOR_SCHEME + ': ' + LIGHT + ')';
    var darkCSSMedia = '(' + PREFERS_COLOR_SCHEME + ': ' + DARK + ')';

    switch (mode) {
    case LIGHT:
        // lightCSSMedia += ', ' + ALL;
        darkCSSMedia += ' and ' + NOT_ALL;
        break;

    case DARK:
        darkCSSMedia += ', ' + ALL;
        // lightCSSMedia += ' and ' + NOT_ALL;
        break;
    }

    return (
        // '<link rel="stylesheet" href="' + lightModeHref + '" media="' + lightCSSMedia + '">' +
        '<link rel="stylesheet" href="' + darkModeHref + '" media="' + darkCSSMedia + '">'
    );
}
