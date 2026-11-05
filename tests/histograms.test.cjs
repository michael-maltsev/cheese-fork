'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const { createPage, loadUI, read, englishContent } = require('./helpers.cjs');

function createBrowser(language = 'en', options = {}) {
    const dom = createPage('course-widget-histograms.html', language);
    const window = loadUI(dom.window);
    const requests = [];

    window.XMLHttpRequest = class {
        open(method, url, async) {
            this.method = method;
            this.url = url;
            this.async = async;
        }

        send() {
            requests.push(this);
        }

        respond(status, response) {
            this.status = status;
            this.response = typeof response === 'string' ? response : JSON.stringify(response);
            this.onload();
        }

        fail() {
            this.onerror();
        }
    };

    const element = window.$('<div>').appendTo(window.document.body);
    const browser = new window.HistogramBrowser(element, options);
    return { dom, window, element, browser, requests };
}

function grade(average, overrides = {}) {
    return {
        students: '100',
        passFail: '75/25',
        passPercent: '75%',
        min: '10',
        max: '100',
        average,
        median: '83',
        ...overrides
    };
}

function histogramData() {
    return {
        '202601': {
            Exam_A: grade('70.25'),
            Final_A: grade('80.75'),
            Exam_B: grade('  '),
            Finals: grade('82.50'),
            Staff: [{ name: 'Example & <Professor>', title: 'מרצה - אחראי מקצוע' }]
        },
        '202501': {
            Exam_A: grade('68.90')
        }
    };
}

for (const language of ['en', 'he']) {
    for (const status of [200, 404]) {
        test(language + ': an empty histogram response (' + status + ') keeps a localized sharing link', () => {
            const { dom, window, element, browser, requests } = createBrowser(language);
            try {
                browser.loadHistograms('01040001');
                assert.equal(element.text(), window.CheeseI18n.t('histogram.loading'));
                assert.equal(requests.length, 1);
                assert.equal(requests[0].method, 'GET');
                assert.equal(requests[0].async, true);
                assert.equal(requests[0].url, 'https://michael-maltsev.github.io/technion-histograms/01040001/index.min.json');
                requests[0].respond(status, {});
                assert.ok(element.text().includes(window.CheeseI18n.t('histogram.empty')));
                const link = element.find('a')[0];
                assert.equal(link.textContent, window.CheeseI18n.t('histogram.share'));
                assert.equal(new URL(link.href).searchParams.get('lang'), language);
                assert.equal(element.find('.histogram-container').length, 0);
                if (language === 'en') {
                    assert.doesNotMatch(element.text(), /[\u0590-\u05ff]/);
                }
            } finally {
                dom.window.close();
            }
        });
    }
}

for (const failure of ['http', 'invalid-json', 'network']) {
    test('a ' + failure + ' failure displays the translated fallback without leaving a loading state', () => {
        const { dom, window, element, browser, requests } = createBrowser();
        try {
            browser.loadHistograms('01040001');
            if (failure === 'network') {
                requests[0].fail();
            } else {
                requests[0].respond(failure === 'http' ? 500 : 200, '{invalid json');
            }
            assert.ok(element.text().includes(window.CheeseI18n.t('histogram.loadFailed')));
            assert.ok(!element.text().includes(window.CheeseI18n.t('histogram.loading')));
            assert.doesNotMatch(element.text(), /[\u0590-\u05ff]/);
            const fallback = element.find('a')[0];
            assert.equal(fallback.href, 'https://michael-maltsev.github.io/technion-histograms/01040001/');
            assert.equal(fallback.textContent, window.CheeseI18n.t('histogram.here'));
            assert.equal(fallback.rel, 'noopener');
        } finally {
            dom.window.close();
        }
    });
}

test('long English semester names render summaries, categories, and safe source data', () => {
    const { dom, window, element, browser, requests } = createBrowser();
    try {
        window.CheeseI18n.addMessages('en', {
            'histogram.semester.winter': 'Winter semester {year}/{nextYear} (extended English label)'
        });
        const data = histogramData();
        const original = JSON.stringify(data);
        browser.loadHistograms('01040001');
        assert.doesNotThrow(() => requests[0].respond(200, data));
        assert.equal(JSON.stringify(data), original);

        const semesters = element.find('.histogram-semesters select')[0];
        assert.deepEqual(Array.from(semesters.options, option => option.value), ['202601', '202501']);
        assert.equal(semesters.value, '202601');
        assert.equal(semesters.getAttribute('aria-label'), window.CheeseI18n.t('histogram.semester'));
        assert.match(semesters.options[0].textContent, /Winter semester 2026\/2027 \(extended English label\)/);
        assert.ok(semesters.options[0].textContent.includes(window.CheeseI18n.t('histogram.summary.a', { grade: '80' })));
        assert.ok(semesters.options[0].textContent.includes(window.CheeseI18n.t('histogram.summary.b', { grade: '--' })));
        assert.ok(semesters.options[0].textContent.includes(window.CheeseI18n.t('histogram.summary.final', { grade: '82' })));
        assert.ok(semesters.options[0].textContent.includes('Example & <Professor>'));

        const categories = element.find('.histogram-categories select')[0];
        assert.equal(categories.getAttribute('aria-label'), window.CheeseI18n.t('histogram.category'));
        assert.deepEqual(Array.from(categories.options, option => option.value), ['Exam_A', 'Final_A', 'Exam_B', 'Finals']);
        assert.equal(categories.value, 'Finals');
        assert.ok(categories.options[0].textContent.includes(window.CheeseI18n.t('histogram.category.examA')));
        assert.equal(element.find('.histogram-value-average').text(), '82.50');
        assert.equal(element.find('.histogram-value-pass').text(), '75');
        assert.equal(element.find('.histogram-value-fail').text(), '25');
        assert.equal(element.find('.histogram-value-passPercent').text(), '75%');
        assert.equal(element.find('.histogram-staff-table tbody td').first().text(), 'Example & <Professor>');
        assert.ok(element.find('.histogram-staff-table').text().includes(window.CheeseI18n.t('histogram.staff.courseCoordinator')));
        assert.equal(element.find('professor').length, 0);

        const image = element.find('.histogram-image')[0];
        assert.equal(image.src, 'https://michael-maltsev.github.io/technion-histograms/01040001/202601/Finals.png');
        assert.ok(image.alt.includes('01040001'));
        assert.ok(image.alt.includes('Winter semester 2026/2027'));
        assert.ok(image.alt.includes(window.CheeseI18n.t('histogram.category.finals')));
        assert.equal(element.find('.histogram-image-note').text(), window.CheeseI18n.t('histogram.imageNote'));
        assert.doesNotMatch(element.text(), /[\u0590-\u05ff]/);

        categories.value = 'Exam_A';
        window.$(categories).trigger('change');
        assert.equal(element.find('.histogram-value-average').text(), '70.25');
        assert.match(element.find('.histogram-image')[0].src, /\/Exam_A\.png$/);

        semesters.value = '202501';
        window.$(semesters).trigger('change');
        assert.equal(element.find('.histogram-value-average').text(), '68.90');
        assert.equal(element.find('.histogram-staff-table').hasClass('d-none'), true);
    } finally {
        dom.window.close();
    }
});

for (const action of ['snooze', 'activate']) {
    test('the ' + action + ' action dismisses the sharing overlay without changing language', () => {
        const { dom, window, element, browser, requests } = createBrowser();
        try {
            window.localStorage.setItem('cheesefork.language', 'en');
            browser.loadHistograms('01040001');
            requests[0].respond(200, histogramData());
            assert.equal(element.find('.histogram-container').hasClass('histogram-activated'), false);
            assert.ok(element.find('.histogram-overlay-message').text().includes(window.CheeseI18n.t('histogram.shareRequired')));
            const before = Date.now();
            element.find('.histogram-button-' + action).trigger('click');
            assert.equal(element.find('.histogram-container').hasClass('histogram-activated'), true);
            const reminder = Number(window.localStorage.getItem('nextHistogramShareMessage'));
            assert.ok(reminder > before);
            if (action === 'snooze') {
                assert.ok(reminder <= Date.now() + 60 * 60 * 1000);
            } else {
                assert.ok(reminder > before + 100 * 24 * 60 * 60 * 1000);
            }
            assert.equal(window.localStorage.getItem('cheesefork.language'), 'en');
        } finally {
            dom.window.close();
        }
    });
}

test('a future sharing reminder opens histograms already activated', () => {
    const { dom, window, element, browser, requests } = createBrowser();
    try {
        window.localStorage.setItem('nextHistogramShareMessage', String(Date.now() + 60 * 60 * 1000));
        browser.loadHistograms('01040001');
        requests[0].respond(200, histogramData());
        assert.equal(element.find('.histogram-container').hasClass('histogram-activated'), true);
    } finally {
        dom.window.close();
    }
});

for (const language of ['en', 'he']) {
    test(language + ': the sharing guide carries the selected language into its bookmarklet', () => {
        const { dom, window } = createBrowser(language);
        try {
            const guide = window.HistogramBrowser.createShareGuide();
            assert.ok(guide.jquery);
            const textarea = guide.find('#javascript-code-container')[0];
            assert.ok(textarea);
            assert.match(textarea.value, /^avascript:/);
            assert.ok(textarea.value.includes('share-histograms.js?lang=' + language));
            assert.equal(textarea.dir, 'ltr');
            assert.ok(guide.find('#javascript-code-copy-button').text().length > 0);
            if (language === 'en') {
                assert.doesNotMatch(englishContent(guide[0]), /[\u0590-\u05ff]/);
                guide.find('img').each(function () {
                    assert.doesNotMatch(this.alt, /[\u0590-\u05ff]/);
                    assert.ok(this.alt.length > 0);
                });
            } else {
                assert.match(guide.text(), /[\u0590-\u05ff]/);
            }
        } finally {
            dom.window.close();
        }
    });
}

test('sharing opens the same translated guide in a modal without activating it prematurely', () => {
    const { dom, window, element, browser, requests } = createBrowser();
    try {
        let dialogOptions;
        window.BootstrapDialog.show = options => {
            dialogOptions = options;
        };
        browser.loadHistograms('01040001');
        requests[0].respond(200, histogramData());
        element.find('.histogram-button-share').trigger('click');
        assert.equal(dialogOptions.title, window.CheeseI18n.t('histogram.share'));
        assert.equal(dialogOptions.buttons[0].label, window.CheeseI18n.t('histogram.shared'));
        assert.equal(dialogOptions.buttons[1].label, window.CheeseI18n.t('histogram.close'));
        assert.doesNotMatch(englishContent(dialogOptions.message[0]), /[\u0590-\u05ff]/);
        assert.equal(element.find('.histogram-container').hasClass('histogram-activated'), false);
        assert.equal(window.localStorage.getItem('nextHistogramShareMessage'), null);

        let closed = false;
        dialogOptions.buttons[0].action({ close() { closed = true; } });
        assert.equal(closed, true);
        assert.equal(element.find('.histogram-container').hasClass('histogram-activated'), true);
    } finally {
        dom.window.close();
    }
});

test('widget sharing opens a language preserving guide popup', () => {
    const { dom, window, element, browser, requests } = createBrowser('en', { shareGuideInNewWindow: true });
    try {
        const popups = [];
        window.open = (...args) => popups.push(args);
        browser.loadHistograms('01040001');
        requests[0].respond(200, histogramData());
        element.find('.histogram-button-share').trigger('click');
        assert.equal(popups.length, 1);
        assert.equal(popups[0][0], 'share-histograms.html?lang=en');
        assert.match(popups[0][2], /width=800/);
        assert.equal(window.localStorage.getItem('nextHistogramShareMessage'), null);
    } finally {
        dom.window.close();
    }
});

function createGradesPage(scriptLanguage, pageLanguage = 'he', courseMarkup = '') {
    const pageDirection = pageLanguage === 'he' ? 'rtl' : 'ltr';
    const dom = new JSDOM('<!DOCTYPE html><html lang="' + pageLanguage + '" dir="' + pageDirection + '">' +
        '<head><title>Source grades page</title></head><body>' +
        '<div id="contents"><p id="source-content">Original grade information</p>' + courseMarkup + '</div>' +
        '</body></html>', {
        url: 'https://grades.technion.ac.il/grades.aspx',
        runScripts: 'outside-only'
    });
    const window = dom.window;
    const script = window.document.createElement('script');
    script.src = 'https://cheesefork.test/share-histograms.js' + (scriptLanguage ? '?lang=' + scriptLanguage : '');
    Object.defineProperty(window.document, 'currentScript', { value: script, configurable: true });
    window.TextDecoder = TextDecoder;
    const fetches = [];
    const alerts = [];
    window.fetch = async (...args) => {
        fetches.push(args);
        throw new Error('No network response was configured by this offline test');
    };
    window.alert = message => alerts.push(message);
    return { dom, window, fetches, alerts, pageDirection };
}

function loadSharingScript(dom) {
    vm.runInContext(read('share-histograms.js'), dom.getInternalVMContext(), { filename: 'share-histograms.js' });
}

for (const [scriptLanguage, pageLanguage, expectedLanguage] of [
    ['en', 'he', 'en'],
    ['he', 'en', 'he'],
    [null, 'en', 'he'],
    ['fr', 'en', 'he']
]) {
    test('the injected sharing UI uses script lang=' + scriptLanguage + ' while preserving the host page', async () => {
        const { dom, window, fetches, alerts, pageDirection } = createGradesPage(scriptLanguage, pageLanguage);
        try {
            loadSharingScript(dom);
            await new Promise(resolve => setImmediate(resolve));
            const region = window.document.querySelector('#cheesefork-histogram-sharing');
            assert.ok(region);
            assert.equal(region.lang, expectedLanguage);
            assert.equal(region.dir, expectedLanguage === 'he' ? 'rtl' : 'ltr');
            assert.equal(window.document.documentElement.lang, pageLanguage);
            assert.equal(window.document.documentElement.dir, pageDirection);
            assert.equal(window.document.querySelector('#source-content').textContent, 'Original grade information');
            assert.equal(fetches.length, 0);
            assert.deepEqual(alerts, []);
            const submit = region.querySelector('#grabber_submit_button');
            assert.equal(submit.style.display, 'inline-block');
            if (expectedLanguage === 'en') {
                assert.doesNotMatch(region.textContent, /[\u0590-\u05ff]/);
                assert.match(region.querySelector('#grabber_title').textContent, /ready/i);
                assert.match(submit.textContent, /share/i);
            } else {
                assert.match(region.textContent, /[\u0590-\u05ff]/);
            }
            submit.click();
            await new Promise(resolve => setImmediate(resolve));
            assert.equal(fetches.length, 0);
            if (expectedLanguage === 'en') {
                assert.match(region.querySelector('#grabber_title').textContent, /complete/i);
            }
        } finally {
            dom.window.close();
        }
    });
}

test('the injected English sharing table translates statuses from an offline grades response', async () => {
    const courseMarkup = '<a class="ga-course" data-sem="01/2026" href="/contentEng.aspx?course=1040001">1 1040001 Synthetic Course</a>';
    const { dom, window, fetches, alerts } = createGradesPage('en', 'he', courseMarkup);
    try {
        const html = '<table id="cBody_GV_StudentGrade"><tbody><tr>' +
            '<td></td><td></td><td></td><td></td><td>Exam_A</td>' +
            '<td><a data-histogram href="https://grades.technion.ac.il/histogram.aspx?id=1&amp;lang=he">Histogram</a></td>' +
            '</tr></tbody></table>';
        window.fetch = async (url, options) => {
            fetches.push([url, options]);
            return { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(html).buffer };
        };
        loadSharingScript(dom);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(fetches.length, 1);
        assert.equal(fetches[0][0], 'https://grades.technion.ac.il/content.aspx?course=1040001');
        assert.equal(fetches[0][1].redirect, 'error');
        assert.deepEqual(alerts, []);
        const region = window.document.querySelector('#cheesefork-histogram-sharing');
        const row = region.querySelector('tr.grabber_course_202601_01040001');
        assert.ok(row);
        assert.equal(row.querySelector('.Exam_A').textContent, '📁');
        assert.equal(row.querySelector('.Finals').textContent, '➖');
        assert.match(row.querySelector('.Exam_A').title, /available/i);
        assert.match(row.querySelector('.Finals').title, /no data/i);
        assert.doesNotMatch(region.textContent, /[\u0590-\u05ff]/);
        assert.match(region.querySelector('#grabber_title').textContent, /ready/i);
        assert.ok(window.document.querySelector('#contents a.ga-course'));
    } finally {
        dom.window.close();
    }
});

test('the injected English sharing UI exposes a translated retry after a failed offline request', async () => {
    const courseMarkup = '<a class="ga-course" data-sem="01/2026" href="/content.aspx?course=1040001">1 1040001 Synthetic Course</a>';
    const { dom, window, fetches, alerts } = createGradesPage('en', 'he', courseMarkup);
    try {
        window.fetch = async (url, options) => {
            fetches.push([url, options]);
            return { ok: false, status: 503 };
        };
        loadSharingScript(dom);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(fetches.length, 4);
        assert.equal(alerts.length, 1);
        assert.match(alerts[0], /503/);
        const region = window.document.querySelector('#cheesefork-histogram-sharing');
        assert.match(region.querySelector('#grabber_title').textContent, /error/i);
        const retry = region.querySelector('#grabber_try_again_button');
        assert.equal(retry.style.display, 'inline-block');
        assert.match(retry.textContent, /try again|retry/i);
        assert.doesNotMatch(region.textContent, /[\u0590-\u05ff]/);
        assert.ok(window.document.querySelector('#contents a.ga-course'));
    } finally {
        dom.window.close();
    }
});
