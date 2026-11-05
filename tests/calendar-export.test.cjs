'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPage, loadUI } = require('./helpers.cjs');

function createCalendar(language) {
    const dom = createPage('index.html', language);
    const window = loadUI(dom.window);
    window.courses_from_rishum[0].schedule.push({
        'קבוצה': 11,
        'מס.': 11,
        'סוג': 'תרגול',
        'יום': 'שלישי',
        'שעה': '14:30 - 15:30',
        'בניין': 'Example Building',
        'חדר': 102,
        'מרצה/מתרגל': 'Teaching Assistant Example'
    });
    const calendar = new window.CourseCalendar(window.$('#course-calendar'), {
        courseManager: new window.CourseManager(window.courses_from_rishum),
        colorGenerator: () => '#336699',
        onCourseConflictedStatusChanged() {},
        onLessonTypesHidden() {}
    });
    return { dom, window, calendar };
}

for (const language of ['en', 'he']) {
    test(language + ': a saved lesson retains its Sunday time and exports one localized recurring event', () => {
        const { dom, window, calendar } = createCalendar(language);
        try {
            const savedSchedule = { '01040001': { '05d405e805e605d005d4': 10 } };
            const savedSnapshot = JSON.stringify(savedSchedule);
            calendar.loadSavedSchedule(savedSchedule, {});
            const events = window.$('#course-calendar').fullCalendar('clientEvents');
            assert.equal(events.length, 2);
            const selected = events.filter(event => event.selected);
            assert.equal(selected.length, 1);
            assert.equal(selected[0].lessonData['סוג'], 'הרצאה');
            assert.equal(selected[0].start.day(), 0);
            assert.equal(selected[0].start.format('HH:mm'), '10:30');
            assert.equal(selected[0].end.format('HH:mm'), '12:30');
            assert.equal(events.find(event => event.lessonData['סוג'] === 'תרגול').selected, false);

            const calls = [];
            const count = calendar.saveAsIcs({
                addEvent(...args) { calls.push(args); }
            }, '2026-10-25', '2027-02-01', ['2026-11-01', '2026-11-02']);

            assert.equal(count, 1);
            assert.equal(calls.length, 1);
            const [subject, description, location, start, end, recurrence, holidays] = calls[0];
            assert.equal(subject, language === 'en' ? 'Lecture 10 - Course Alpha' : 'הרצאה 10 - Course Alpha');
            assert.equal(description, 'Professor Example');
            assert.equal(location, 'Example Building 101');
            assert.equal(window.moment.parseZone(start).format('YYYY-MM-DDTHH:mm:ss'), '2026-10-25T10:30:00');
            assert.equal(window.moment.parseZone(end).format('YYYY-MM-DDTHH:mm:ss'), '2026-10-25T12:30:00');
            assert.equal(recurrence.freq, 'WEEKLY');
            assert.equal(recurrence.until, '2027-02-02T00:00:00Z');
            assert.equal(holidays.length, 1);
            assert.equal(holidays[0].getFullYear(), 2026);
            assert.equal(holidays[0].getMonth(), 10);
            assert.equal(holidays[0].getDate(), 1);
            assert.equal(holidays[0].getDay(), 0);
            assert.equal(JSON.stringify(savedSchedule), savedSnapshot);
        } finally {
            dom.window.close();
        }
    });

    test(language + ': visible lessons without a saved selection are excluded from the export', () => {
        const { dom, window, calendar } = createCalendar(language);
        try {
            calendar.loadSavedSchedule({ '01040001': {} }, {});
            const events = window.$('#course-calendar').fullCalendar('clientEvents');
            assert.equal(events.length, 2);
            assert.ok(events.every(event => !event.selected));
            const calls = [];
            const count = calendar.saveAsIcs({
                addEvent(...args) { calls.push(args); }
            }, '2026-10-25', '2027-02-01', []);
            assert.equal(count, 0);
            assert.equal(calls.length, 0);
        } finally {
            dom.window.close();
        }
    });
}
