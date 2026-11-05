'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root, read } = require('./helpers.cjs');

function catalogs() {
    const result = {};
    for (const locale of ['he', 'en']) {
        vm.runInNewContext(read('locales/' + locale + '.js'), {
            CheeseI18n: {
                addMessages(language, messages) {
                    assert.equal(language, locale);
                    result[locale] = { ...result[locale], ...messages };
                }
            }
        });
    }
    return result;
}

function firstPartySources(directory = root) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            return entry.name === 'components' || directory.includes(path.sep + 'components') ? firstPartySources(file) : [];
        }
        return /\.(js|html)$/.test(entry.name) && entry.name !== 'dark-mode-toggle-stylesheets-loader.min.js' ? [file] : [];
    });
}

test('catalogs have matching keys, interpolation parameters, and English text', () => {
    const { he, en } = catalogs();
    assert.ok(Object.keys(en).length > 100);
    assert.deepEqual(Object.keys(en).sort(), Object.keys(he).sort());
    for (const key of Object.keys(en)) {
        assert.equal(typeof en[key], 'string', key);
        assert.ok(en[key].trim().length, key);
        assert.doesNotMatch(en[key], /[\u0590-\u05ff]/, key);
        const parameters = value => [...value.matchAll(/\{([^{}]+)\}/g)].map(match => match[1]).sort();
        assert.deepEqual(parameters(en[key]), parameters(he[key]), key);
    }
});

test('every explicit message key in first-party UI exists in both catalogs', () => {
    const messages = catalogs();
    const used = new Set();
    for (const file of firstPartySources()) {
        const source = fs.readFileSync(file, 'utf8');
        const expressions = [
            /CheeseI18n\.t\(\s*['"]([^'"]+)['"]\s*(?=[,)])/g,
            /data-i18n(?:-(?:title|placeholder|alt|aria-label|content|data-intro))?=['"]([^'"]+)['"]/g
        ];
        if (file.endsWith('course-feedback.js')) {
            for (const match of source.matchAll(/\b(?:t|translatedHtml)\(\s*['"]([^'"]+)['"]\s*(?=[,)])/g)) {
                used.add('feedback.' + match[1]);
            }
        } else if (file.endsWith('histogram-browser.js')) {
            for (const match of source.matchAll(/\b[th]\(\s*['"]([^'"]+)['"]\s*(?=[,)])/g)) {
                used.add(match[1]);
            }
        }
        for (const expression of expressions) {
            for (const match of source.matchAll(expression)) {
                used.add(match[1]);
                for (const locale of ['he', 'en']) {
                    assert.ok(Object.hasOwn(messages[locale], match[1]), path.relative(root, file) + ': ' + match[1] + ' (' + locale + ')');
                }
            }
        }
    }
    for (const key of used) {
        for (const locale of ['he', 'en']) {
            assert.ok(Object.hasOwn(messages[locale], key), key + ' (' + locale + ')');
        }
    }
    assert.ok(used.size > 100);
});
