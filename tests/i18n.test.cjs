"use strict";

/* global require */

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var vm = require("node:vm");
var source = fs.readFileSync(require.resolve("../i18n.js"), "utf8");

function Element(tagName, attributes, children) {
    this.nodeType = 1;
    this.tagName = tagName.toUpperCase();
    this.attributes = attributes || {};
    this.children = children || [];
    this.textContent = "Original text";
    this.listeners = {};
    Object.defineProperty(this, "innerHTML", {
        set: function () {
            throw new Error("Translations must never be assigned as HTML");
        }
    });
}

Element.prototype.getAttribute = function (name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
};

Element.prototype.setAttribute = function (name, value) {
    this.attributes[name] = value;
};

Element.prototype.hasAttribute = function (name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name);
};

Element.prototype.addEventListener = function (name, listener) {
    this.listeners[name] = this.listeners[name] || [];
    this.listeners[name].push(listener);
};

Element.prototype.querySelectorAll = function (selector) {
    var selectors = selector.split(",");
    var result = [];

    function visit(element) {
        var matches = selectors.some(function (part) {
            var match = /^\s*(select)?\[([^\]]+)\]\s*$/.exec(part);
            return match && (!match[1] || element.tagName === "SELECT") && element.hasAttribute(match[2]);
        });
        if (matches) {
            result.push(element);
        }
        element.children.forEach(visit);
    }

    this.children.forEach(visit);
    return result;
};

function loadRuntime(options) {
    options = options || {};
    var href = options.href || "https://example.test/index.html";
    var documentElement = new Element("html", {}, options.children);
    var document = {
        documentElement: documentElement,
        readyState: options.readyState || "loading",
        listeners: {},
        addEventListener: Element.prototype.addEventListener,
        querySelectorAll: function (selector) {
            return documentElement.querySelectorAll(selector);
        }
    };
    var storage = {};
    var navigation = [];
    var window = {
        location: {
            href: href,
            search: (href.split("#")[0].split("?")[1] || "") ? "?" + href.split("#")[0].split("?")[1] : "",
            assign: function (nextHref) {
                navigation.push(nextHref);
            }
        }
    };
    storage["cheesefork.language"] = options.storedLocale;
    Object.defineProperty(window, "localStorage", {
        get: function () {
            if (options.blockStorage) {
                throw new Error("Storage is blocked");
            }
            return {
                getItem: function (key) {
                    return storage[key] || null;
                },
                setItem: function (key, value) {
                    storage[key] = value;
                }
            };
        }
    });
    vm.runInNewContext(source, { window: window, document: document });
    return {
        api: window.CheeseI18n,
        document: document,
        html: documentElement,
        storage: storage,
        navigation: navigation,
        ready: function () {
            (document.listeners.DOMContentLoaded || []).forEach(function (listener) {
                listener();
            });
        }
    };
}

test("sets Hebrew language and direction before DOM ready by default", function () {
    var runtime = loadRuntime();
    assert.equal(runtime.api.getLocale(), "he");
    assert.equal(runtime.api.isRTL(), true);
    assert.equal(runtime.html.getAttribute("lang"), "he");
    assert.equal(runtime.html.getAttribute("dir"), "rtl");
});

test("a supported URL language takes priority over the stored preference", function () {
    var runtime = loadRuntime({ href: "https://example.test/?schedule=42&lang=en#calendar", storedLocale: "he" });
    assert.equal(runtime.api.getLocale(), "en");
    assert.equal(runtime.api.isRTL(), false);
    assert.equal(runtime.html.getAttribute("lang"), "en");
    assert.equal(runtime.html.getAttribute("dir"), "ltr");
    assert.equal(loadRuntime({ href: "https://example.test/?lang=he", storedLocale: "en" }).api.getLocale(), "he");
});

test("uses a supported saved preference when the URL has no supported language", function () {
    assert.equal(loadRuntime({ storedLocale: "en" }).api.getLocale(), "en");
    assert.equal(loadRuntime({ href: "https://example.test/?lang=fr", storedLocale: "en" }).api.getLocale(), "en");
    assert.equal(loadRuntime({ href: "https://example.test/?lang=%E0%A4%A", storedLocale: "en" }).api.getLocale(), "en");
    assert.equal(loadRuntime({ storedLocale: "fr" }).api.getLocale(), "he");
});

test("handles blocked storage at startup and while switching language", function () {
    var runtime = loadRuntime({ blockStorage: true });
    assert.equal(runtime.api.getLocale(), "he");
    assert.equal(runtime.api.setLocale("en"), true);
    assert.deepEqual(runtime.navigation, ["https://example.test/index.html?lang=en"]);
    assert.equal(loadRuntime({ href: "https://example.test/?lang=en", blockStorage: true }).api.getLocale(), "en");
});

test("interpolates literal text, retains missing parameters, and falls back predictably", function () {
    var runtime = loadRuntime({ storedLocale: "en" });
    var inheritedParams = Object.create({ name: "inherited" });
    var inheritedMessages = Object.create({ inherited: "must not be registered" });
    inheritedMessages.own = "Registered";
    runtime.api.addMessages("he", { greeting: "שלום {name}", fallback: "עברית" });
    runtime.api.addMessages("en", { greeting: "Hello {name}, {count} courses for {name}", blank: "" });
    runtime.api.addMessages("en", inheritedMessages);
    runtime.api.addMessages("fr", { ignored: "ignored" });
    assert.equal(runtime.api.t("greeting", { name: "<b>$&</b>", count: 0 }), "Hello <b>$&</b>, 0 courses for <b>$&</b>");
    assert.equal(runtime.api.t("greeting", inheritedParams), "Hello {name}, {count} courses for {name}");
    assert.equal(runtime.api.t("fallback"), "עברית");
    assert.equal(runtime.api.t("missing"), "missing");
    assert.equal(runtime.api.t("blank"), "");
    assert.equal(runtime.api.t("own"), "Registered");
    assert.equal(runtime.api.t("inherited"), "inherited");
    assert.equal(runtime.api.t("toString"), "toString");
    assert.equal(runtime.api.t("ignored"), "ignored");
});

test("switching preserves all other URL bytes, the hash, and unrelated storage", function () {
    var runtime = loadRuntime({ href: "https://example.test/path?semester=2026%2B1&%6cang=he&schedule=a%3Db%26c&flag&lang=en#week%2F2" });
    runtime.storage.schedule = "untouched";
    assert.equal(runtime.api.setLocale("en"), true);
    assert.equal(runtime.storage["cheesefork.language"], "en");
    assert.equal(runtime.storage.schedule, "untouched");
    assert.deepEqual(runtime.navigation, ["https://example.test/path?semester=2026%2B1&lang=en&schedule=a%3Db%26c&flag#week%2F2"]);
});

test("invalid language values cannot change storage or trigger navigation", function () {
    var runtime = loadRuntime({ storedLocale: "he" });
    assert.equal(runtime.api.setLocale("fr"), false);
    assert.equal(runtime.api.setLocale("en-US"), false);
    assert.equal(runtime.storage["cheesefork.language"], "he");
    assert.deepEqual(runtime.navigation, []);
});

test("internal links retain locale without losing query parameters or fragments", function () {
    var runtime = loadRuntime({ storedLocale: "en" });
    assert.equal(runtime.api.withLocale("course-widget-comments.html?course=123&semester=2026#opinions"), "course-widget-comments.html?course=123&semester=2026&lang=en#opinions");
    assert.equal(runtime.api.withLocale("./?lang=he&schedule=123#calendar"), "./?lang=en&schedule=123#calendar");
    assert.equal(runtime.api.withLocale("./#calendar"), "./?lang=en#calendar");
});

test("applies only explicitly marked text and attributes without parsing HTML", function () {
    var translated = new Element("span", { "data-i18n": "text" });
    var unmarked = new Element("span");
    var input = new Element("input", {
        "data-i18n-title": "attribute",
        "data-i18n-placeholder": "attribute",
        "data-i18n-alt": "attribute",
        "data-i18n-aria-label": "attribute",
        "data-i18n-content": "attribute",
        "data-i18n-data-intro": "attribute"
    });
    var runtime = loadRuntime({ storedLocale: "en", children: [translated, input, unmarked] });
    var text = "<img src=x onerror=alert(1)> & Hebrew עברית";
    var attribute = "\" onfocus=\"alert(1)";
    runtime.api.addMessages("en", { text: text, attribute: attribute });
    assert.equal(translated.textContent, "Original text");
    runtime.ready();
    assert.equal(translated.textContent, text);
    assert.equal(unmarked.textContent, "Original text");
    ["title", "placeholder", "alt", "aria-label", "content", "data-intro"].forEach(function (name) {
        assert.equal(input.getAttribute(name), attribute);
    });
    assert.equal(input.hasAttribute("onfocus"), false);
});

test("apply includes its root and binds a language switch once", function () {
    var select = new Element("select", { "data-language-switch": "" });
    var root = new Element("section", { "data-i18n-title": "heading" }, [select]);
    var runtime = loadRuntime({ storedLocale: "en" });
    runtime.api.addMessages("en", { heading: "Language" });
    runtime.api.apply(root);
    runtime.api.apply(root);
    assert.equal(root.getAttribute("title"), "Language");
    assert.equal(select.value, "en");
    assert.equal(select.listeners.change.length, 1);
    select.value = "he";
    select.listeners.change[0].call(select);
    assert.equal(runtime.storage["cheesefork.language"], "he");
    assert.deepEqual(runtime.navigation, ["https://example.test/index.html?lang=he"]);
});

test("binds existing switches when the runtime loads after DOM ready", function () {
    var select = new Element("select", { "data-language-switch": "" });
    loadRuntime({ storedLocale: "en", readyState: "complete", children: [select] });
    assert.equal(select.value, "en");
    assert.equal(select.listeners.change.length, 1);
});
