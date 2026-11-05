'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const contexts = new WeakMap();

function load(window, file) {
    const context = contexts.get(window);
    if (context) {
        vm.runInContext(read(file), context, { filename: file });
    } else {
        window.eval(read(file));
    }
}

function createPage(file = 'index.html', language = 'en', query = '') {
    const dom = new JSDOM(read(file), {
        url: 'https://cheesefork.test/' + file + '?lang=' + language + query,
        runScripts: 'outside-only',
        pretendToBeVisual: true
    });
    contexts.set(dom.window, dom.getInternalVMContext());
    load(dom.window, 'i18n.js');
    load(dom.window, 'locales/he.js');
    load(dom.window, 'locales/en.js');
    dom.window.CheeseI18n.apply(dom.window.document);
    return dom;
}

function loadUI(window) {
    const getComputedStyle = window.getComputedStyle.bind(window);
    window.getComputedStyle = element => getComputedStyle(element);
    window.scrollTo = function () {};
    [
        'modules/fullcalendar/lib/jquery.min.js',
        'modules/fullcalendar/lib/jquery-ui.min.js',
        'modules/popper/popper.js',
        'modules/bootstrap-rtl/js/bootstrap.min.js',
        'modules/bootstrap4-dialog/js/bootstrap-dialog.min.js',
        'i18n-dialogs.js',
        'modules/OverlayScrollbars/js/jquery.overlayScrollbars.min.js',
        'modules/fullcalendar/lib/moment.min.js',
        'modules/fullcalendar/fullcalendar.min.js',
        'modules/fullcalendar/locale/he.js',
        'modules/selectize/js/standalone/selectize.min.js',
        'modules/color-hash/color-hash.js',
        'modules/jsdiff/diff.min.js',
        'modules/intro.js/intro.min.js',
        'modules/reparse.js',
        'modules/boolean-expression.js',
        'course-manager.js',
        'components/course-select/course-select.js',
        'components/course-button-list/course-button-list.js',
        'components/course-exam-info/course-exam-info.js',
        'components/course-calendar/course-calendar.js',
        'components/course-feedback/course-feedback.js',
        'components/histogram-browser/histogram-browser.js'
    ].forEach(file => load(window, file));
    window.$.expr.pseudos.hover = () => false;
    window.gtag = function () {};
    window.currentSemester = '202601';
    window.availableSemesters = {
        '202601': { start: '2026-10-25', end: '2027-02-01' },
        '202602': { start: '2027-03-01', end: '2027-06-01' }
    };
    window.scheduleSharingUserId = null;
    window.courses_from_rishum = [{
        general: {
            'מספר מקצוע': '01040001',
            'שם מקצוע': 'Course Alpha',
            'פקולטה': 'הפקולטה למתמטיקה',
            'מסגרת לימודים': 'לימודי הסמכה',
            'נקודות': '3',
            'סילבוס': 'A synthetic course syllabus.',
            'אחראים': 'Professor Example',
            'מועד א': '05-02-2027',
            'מועד ב': '05-03-2027',
            'הערות': 'Synthetic catalog notes.'
        },
        schedule: [{
            'קבוצה': 11,
            'מס.': 10,
            'סוג': 'הרצאה',
            'יום': 'ראשון',
            'שעה': '10:30 - 12:30',
            'בניין': 'Example Building',
            'חדר': 101,
            'מרצה/מתרגל': 'Professor Example'
        }]
    }];
    return window;
}

function englishContent(element) {
    const copy = element.cloneNode(true);
    copy.querySelectorAll('script, style, [lang="he"], option[value="he"]').forEach(node => node.remove());
    return copy.textContent;
}

module.exports = { root, read, load, createPage, loadUI, englishContent };
