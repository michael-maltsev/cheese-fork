'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPage, loadUI, load, englishContent } = require('./helpers.cjs');

for (const file of ['index.html', 'course-widget-comments.html', 'course-widget-histograms.html', 'share-histograms.html']) {
    test(file + ': English static content and accessible labels are localized', () => {
        const dom = createPage(file);
        try {
            if (file === 'share-histograms.html') {
                loadUI(dom.window);
                dom.window.$('#share-guide').append(dom.window.HistogramBrowser.createShareGuide());
            }
            const { document } = dom.window;
            assert.equal(document.documentElement.lang, 'en');
            assert.equal(document.documentElement.dir, 'ltr');
            assert.doesNotMatch(englishContent(document.documentElement), /[\u0590-\u05ff]/);
            document.querySelectorAll('[data-i18n], [data-i18n-title], [data-i18n-placeholder], [data-i18n-alt], [data-i18n-aria-label], [data-i18n-data-intro]').forEach(element => {
                for (const name of ['title', 'placeholder', 'alt', 'aria-label', 'data-intro']) {
                    assert.doesNotMatch(element.getAttribute(name) || '', /[\u0590-\u05ff]/);
                }
            });
            assert.ok(document.querySelector('select[data-language-switch]'));
        } finally {
            dom.window.close();
        }
    });
}

for (const language of ['en', 'he']) {
    test(language + ': standalone review dialogs localize their accessible close button', () => {
        const dom = createPage('course-widget-comments.html', language);
        try {
            const window = loadUI(dom.window);
            const dialog = window.BootstrapDialog.show({ title: 'Example' });
            assert.equal(dialog.getModal().find('button.close').attr('aria-label'), window.CheeseI18n.t('shell.dialog.close'));
            dialog.close();
        } finally {
            dom.window.close();
        }
    });

    test(language + ': schedule restores raw lesson identities and remains editable', () => {
        const dom = createPage('index.html', language);
        try {
            const window = loadUI(dom.window);
            window.localStorage.setItem('202601_courses', '["01040001"]');
            const savedLesson = '{"05d405e805e605d005d4":10}';
            window.localStorage.setItem('202601_01040001', savedLesson);
            for (const key of ['dontShowIntro', 'dontShowHistogramsTip', 'dontShowThursdayGraphPopup', 'dontShowTechnionScansPopup']) {
                window.localStorage.setItem(key, String(Date.now()));
            }
            load(window, 'cheesefork.js');
            assert.match(window.document.querySelector('#general-info').textContent, /3/);
            assert.ok(window.document.querySelector('#course-button-list').textContent.includes('Course Alpha'));
            const events = window.$('#course-calendar').fullCalendar('clientEvents');
            assert.equal(events.length, 1);
            assert.equal(events[0].selected, true);
            assert.equal(events[0].start.day(), 0);
            assert.equal(window.$('#course-calendar').fullCalendar('option', 'locale'), language);
            assert.equal(window.localStorage.getItem('202601_01040001'), savedLesson);
            window.$('#course-calendar .fc-event').trigger('click');
            assert.equal(window.localStorage.getItem('202601_01040001'), '{}');
            window.$('#course-calendar .fc-event').trigger('click');
            assert.equal(window.localStorage.getItem('202601_01040001'), savedLesson);
            if (language === 'en') {
                assert.doesNotMatch(englishContent(window.document.body), /[\u0590-\u05ff]/);
                const placeholder = window.document.querySelector('.selectize-input input').placeholder;
                assert.doesNotMatch(placeholder, /[\u0590-\u05ff]/);
            } else {
                assert.match(window.document.querySelector('#general-info').textContent, /[\u0590-\u05ff]/);
            }
            const firstLink = window.document.querySelector('#top-navbar-semester .dropdown-item');
            assert.equal(new URL(firstLink.href).searchParams.get('lang'), language);
        } finally {
            dom.window.close();
        }
    });
}

test('English course details translate labels while preserving source data', () => {
    const dom = createPage();
    try {
        const window = loadUI(dom.window);
        const manager = new window.CourseManager(window.courses_from_rishum);
        const before = JSON.stringify(window.courses_from_rishum);
        const description = manager.getDescription('01040001', { html: false, relatedCourseInfo: true });
        assert.match(description, /Faculty|School/);
        assert.match(description, /Mathematics/);
        assert.doesNotMatch(description, /[\u0590-\u05ff]/);
        assert.equal(manager.getLessonType(window.courses_from_rishum[0].schedule[0]), 'הרצאה');
        assert.match(manager.getLessonTypeAndNumber(window.courses_from_rishum[0].schedule[0]), /Lecture/);
        assert.equal(JSON.stringify(window.courses_from_rishum), before);
        window.courses_from_rishum[0].general['שם מקצוע'] = 'חשבון אינפיניטסימלי';
        assert.match(manager.getTitle('01040001'), /חשבון אינפיניטסימלי/);
        window.courses_from_rishum[0].general['מקצועות קדם'] = '01040002 או (01040003 ו- 01040004) אוטומטים';
        const related = manager.getDescription('01040001', { html: false, relatedCourseInfo: true });
        assert.match(related, /01040002 or \(01040003 and 01040004\) אוטומטים/);
    } finally {
        dom.window.close();
    }
});

test('English weekday headings adapt to narrow calendars without changing selected lessons', () => {
    const dom = createPage();
    try {
        const window = loadUI(dom.window);
        const calendar = window.$('#course-calendar').css('width', '900px');
        window.localStorage.setItem('202601_courses', '["01040001"]');
        window.localStorage.setItem('202601_01040001', '{"05d405e805e605d005d4":10}');
        window.localStorage.setItem('dontShowIntro', String(Date.now()));
        load(window, 'cheesefork.js');
        assert.equal(calendar.find('.fc-day-header').first().text(), 'Sunday');
        calendar.css('width', '375px');
        calendar.fullCalendar('option', 'windowResize')();
        assert.equal(calendar.find('.fc-day-header').first().text(), 'Sun');
        assert.equal(calendar.fullCalendar('clientEvents')[0].selected, true);
        calendar.css('width', '900px');
        calendar.fullCalendar('option', 'windowResize')();
        assert.equal(calendar.find('.fc-day-header').first().text(), 'Sunday');
        assert.equal(calendar.fullCalendar('clientEvents')[0].selected, true);
    } finally {
        dom.window.close();
    }
});
