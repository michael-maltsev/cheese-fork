"use strict";

(function (window, document) {
    var storageKey = "cheesefork.language";
    var defaultLocale = "he";
    var messages = {
        en: Object.create(null),
        he: Object.create(null)
    };
    var translatedAttributes = ["title", "placeholder", "alt", "aria-label", "content", "data-intro"];
    var locale = getInitialLocale();

    function isSupportedLocale(value) {
        return value === "en" || value === "he";
    }

    function decodeQueryPart(value) {
        try {
            return decodeURIComponent(value.replace(/\+/g, " "));
        } catch (error) {
            return value;
        }
    }

    function getInitialLocale() {
        var parts = window.location.search.replace(/^\?/, "").split("&");
        var i;
        var pair;
        var value;

        for (i = 0; i < parts.length; i += 1) {
            pair = parts[i].split("=");
            if (decodeQueryPart(pair[0]) === "lang") {
                value = decodeQueryPart(pair.slice(1).join("="));
                if (isSupportedLocale(value)) {
                    return value;
                }
            }
        }

        try {
            value = window.localStorage.getItem(storageKey);
            if (isSupportedLocale(value)) {
                return value;
            }
        } catch (error) {
            // Language selection also works when browser storage is unavailable.
        }

        return defaultLocale;
    }

    function addMessages(messageLocale, catalog) {
        var key;
        if (!isSupportedLocale(messageLocale) || !catalog) {
            return;
        }
        for (key in catalog) {
            if (Object.prototype.hasOwnProperty.call(catalog, key) && typeof catalog[key] === "string") {
                messages[messageLocale][key] = catalog[key];
            }
        }
    }

    function t(key, params) {
        var value = messages[locale][key];
        if (typeof value !== "string") {
            value = messages[defaultLocale][key];
        }
        if (typeof value !== "string") {
            value = key;
        }
        return String(value).replace(/\{([^{}]+)\}/g, function (placeholder, name) {
            if (params && Object.prototype.hasOwnProperty.call(params, name)) {
                return String(params[name]);
            }
            return placeholder;
        });
    }

    function urlWithLocale(url, selectedLocale) {
        var hashIndex = url.indexOf("#");
        var hash = hashIndex === -1 ? "" : url.slice(hashIndex);
        var withoutHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
        var queryIndex = withoutHash.indexOf("?");
        var path = queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex);
        var query = queryIndex === -1 ? "" : withoutHash.slice(queryIndex + 1);
        var parts = query ? query.split("&") : [];
        var nextParts = [];
        var found = false;
        var i;

        for (i = 0; i < parts.length; i += 1) {
            if (decodeQueryPart(parts[i].split("=")[0]) === "lang") {
                if (!found) {
                    nextParts.push("lang=" + selectedLocale);
                    found = true;
                }
            } else {
                nextParts.push(parts[i]);
            }
        }
        if (!found) {
            nextParts.push("lang=" + selectedLocale);
        }
        return path + "?" + nextParts.join("&") + hash;
    }

    function withLocale(url) {
        return urlWithLocale(String(url), locale);
    }

    function setLocale(selectedLocale) {
        var url;
        if (!isSupportedLocale(selectedLocale)) {
            return false;
        }
        try {
            window.localStorage.setItem(storageKey, selectedLocale);
        } catch (error) {
            // The explicit URL remains the source of truth without storage.
        }
        url = urlWithLocale(window.location.href, selectedLocale);
        if (url !== window.location.href) {
            window.location.assign(url);
        }
        return true;
    }

    function applyElement(element) {
        var key = element.getAttribute("data-i18n");
        var i;
        if (key) {
            element.textContent = t(key);
        }
        for (i = 0; i < translatedAttributes.length; i += 1) {
            key = element.getAttribute("data-i18n-" + translatedAttributes[i]);
            if (key) {
                element.setAttribute(translatedAttributes[i], t(key));
            }
        }
        if (element.tagName === "SELECT" && element.hasAttribute("data-language-switch")) {
            element.value = locale;
            if (!element.cheeseI18nLanguageBound) {
                element.addEventListener("change", function () {
                    setLocale(this.value);
                });
                element.cheeseI18nLanguageBound = true;
            }
        }
    }

    function apply(root) {
        var selector = "[data-i18n], select[data-language-switch]";
        var elements;
        var i;
        root = root || document;
        if (root.nodeType === 1) {
            applyElement(root);
        }
        for (i = 0; i < translatedAttributes.length; i += 1) {
            selector += ", [data-i18n-" + translatedAttributes[i] + "]";
        }
        elements = root.querySelectorAll(selector);
        for (i = 0; i < elements.length; i += 1) {
            applyElement(elements[i]);
        }
    }

    document.documentElement.setAttribute("lang", locale);
    document.documentElement.setAttribute("dir", locale === "he" ? "rtl" : "ltr");

    window.CheeseI18n = {
        addMessages: addMessages,
        t: t,
        getLocale: function () {
            return locale;
        },
        isRTL: function () {
            return locale === "he";
        },
        apply: apply,
        setLocale: setLocale,
        withLocale: withLocale
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
            apply(document);
        });
    } else {
        apply(document);
    }
}(window, document));
