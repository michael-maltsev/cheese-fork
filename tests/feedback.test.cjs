'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPage, load, englishContent } = require('./helpers.cjs');

const course = '01040001';
const originalReview = 'ההרצאות היו ברורות ומעניינות.\nמומלץ לתרגל לפני המבחן.';
const post = {
    timestamp: Date.UTC(2026, 10, 5, 12),
    author: 'סטודנט לדוגמה',
    semester: '202601',
    text: originalReview,
    generalRank: 4,
    difficultyRank: 3
};

function settle() {
    return new Promise(resolve => setImmediate(resolve));
}

function setup(options = {}) {
    const dom = createPage('course-widget-comments.html', options.locale || 'en', options.query || '');
    const { window } = dom;
    const writes = [];
    const dialogs = [];
    const posts = options.posts || [post];
    let currentUser = Object.hasOwn(options, 'user') ? options.user : { uid: 'test-user' };
    load(window, 'modules/fullcalendar/lib/jquery.min.js');
    window.$.fn.tooltip = function () { return this; };
    window.currentSemester = '202601';
    window.BootstrapDialog = {
        SIZE_SMALL: 'small',
        show(configuration) {
            const body = window.$('<div class="test-dialog-body">').append(configuration.message);
            window.$('body').append(body);
            const dialog = {
                getModalBody: () => body,
                close: () => body.remove()
            };
            dialogs.push({ configuration, body, dialog });
            if (configuration.onshow) configuration.onshow(dialog);
            return dialog;
        }
    };
    const firestore = function () {
        return {
            collection(name) {
                return {
                    doc(id) {
                        return {
                            get: () => options.getFailure
                                ? Promise.reject(new Error('offline'))
                                : Promise.resolve({ exists: posts.length > 0, data: () => ({ posts }) }),
                            set(update, settings) {
                                writes.push({ collection: name, course: id, update, settings });
                                return Promise.resolve();
                            }
                        };
                    }
                };
            }
        };
    };
    firestore.FieldValue = { arrayUnion: value => value };
    window.firebase = {
        initializeApp() {},
        firestore,
        auth: () => ({
            currentUser,
            onAuthStateChanged(callback) {
                callback(currentUser);
            }
        })
    };
    if (options.translator) window.Translator = options.translator;
    load(window, 'components/course-feedback/course-feedback.js');
    const feedback = new window.CourseFeedback(window.$('.course-feedback'), {
        loginUrl: './index.html?course=01040001#login'
    });
    return { dom, window, feedback, writes, dialogs, setUser: value => { currentUser = value; } };
}

async function render(fixture) {
    fixture.feedback.loadFeedback(course);
    await settle();
    return fixture.window.document;
}

function translatorFor(value = 'The lectures were clear and interesting.\nPractice before the exam.') {
    const calls = { availability: [], create: [], translate: [], destroy: 0 };
    const api = {
        availability(options) {
            calls.availability.push({ ...options });
            return Promise.resolve('available');
        },
        create(options) {
            calls.create.push(options);
            return Promise.resolve({
                translate(text) {
                    calls.translate.push(text);
                    return Promise.resolve(value);
                },
                destroy() { calls.destroy++; }
            });
        }
    };
    return { api, calls };
}

test('English reviews localize labels, ratings, dates and carousel controls while preserving authored text', async () => {
    const native = translatorFor();
    const fixture = setup({ translator: native.api });
    try {
        const document = await render(fixture);
        assert.equal(document.querySelector('#course-feedback-summary h3').textContent, '1 review');
        assert.equal(document.querySelector('.box-title').textContent, 'Semester: Winter 2026–2027');
        assert.match(document.querySelector('.box-footer').textContent, /5 November 2026/);
        assert.equal(document.querySelector('.feedback-author').textContent, post.author);
        assert.equal(document.querySelector('.feedback-original-text').textContent, originalReview);
        assert.equal(document.querySelector('.feedback-original-text').lang, 'he');
        assert.equal(document.querySelector('.feedback-original-text').dir, 'auto');
        assert.equal(document.querySelector('.feedback-report').getAttribute('aria-label'), 'Report inappropriate content');
        assert.equal(document.querySelector('.carousel-control-prev .sr-only').textContent, 'Previous review');
        assert.equal(document.querySelector('.carousel-control-next .sr-only').textContent, 'Next review');
        assert.equal(document.querySelector('.carousel-indicators li').getAttribute('aria-label'), 'Review 1 of 1');
        assert.equal(document.querySelector('[role="img"]').getAttribute('aria-label'), 'Overall rating: 4 out of 5');
        assert.doesNotMatch(englishContent(document.body), /[\u0590-\u05ff]|feedback\./);
        assert.equal(native.calls.availability.length, 0);
        assert.equal(native.calls.create.length, 0);
    } finally {
        fixture.dom.window.close();
    }
});

test('Hebrew interface retains Hebrew labels and does not request opinion translation', async () => {
    const native = translatorFor();
    const fixture = setup({ locale: 'he', translator: native.api, posts: [post, { ...post, semester: '202602' }] });
    try {
        const document = await render(fixture);
        assert.equal(document.querySelector('#course-feedback-summary h3').textContent, '2 חוות דעת');
        assert.equal(document.querySelectorAll('.box-title')[1].textContent, 'סמסטר אביב 2027');
        assert.equal(document.querySelector('.feedback-translate'), null);
        assert.equal(native.calls.availability.length, 0);
        assert.match(document.querySelector('.feedback-report').getAttribute('aria-label'), /דיווח/);
    } finally {
        fixture.dom.window.close();
    }
});

test('review display removes empty Hebrew and English template fields without changing stored reviews', async () => {
    const legacy = 'שם המרצה:\nדוקטור כהן\nחוות דעת - הרצאות:\nההסברים היו ברורים ומעניינים מאוד\n\nשם המתרגל/ת: \nחוות דעת - תרגולים: \n\nשעורי הבית: \n\nהמבחן: \n\nהשורה התחתונה: ';
    const english = 'Lecturer name:\nProfessor Example\nLecture feedback:\nClear explanations and useful examples.\n\nTeaching assistant name: \nTutorial feedback: \nHomework: \nExam: \nThe bottom line: ';
    const posts = [{ ...post, text: legacy }, { ...post, text: english, author: '<img src=x>' }];
    const before = JSON.stringify(posts);
    const fixture = setup({ posts });
    try {
        const document = await render(fixture);
        const reviews = document.querySelectorAll('.feedback-original-text');
        assert.equal(reviews[0].textContent, 'שם המרצה:\nדוקטור כהן\nחוות דעת - הרצאות:\nההסברים היו ברורים ומעניינים מאוד');
        assert.equal(reviews[1].textContent, 'Lecturer name:\nProfessor Example\nLecture feedback:\nClear explanations and useful examples.');
        assert.equal(reviews[1].lang, 'en');
        assert.equal(document.querySelectorAll('.feedback-translate').length, 1);
        assert.equal(document.querySelectorAll('.feedback-author')[1].textContent, '<img src=x>');
        assert.equal(document.querySelector('.feedback-author img'), null);
        assert.equal(JSON.stringify(posts), before);
        assert.equal(document.querySelector('#course-feedback-summary h3').textContent, '2 reviews');
    } finally {
        fixture.dom.window.close();
    }
});

for (const locale of ['en', 'he']) {
    test(locale + ': localized review form rejects an empty template and stores original field values', async () => {
        const fixture = setup({ locale, posts: [] });
        try {
            const document = await render(fixture);
            document.querySelector('#course-feedback > .text-center button').click();
            const { configuration, body, dialog } = fixture.dialogs[0];
            const review = body.find('#feedback-form-text').get(0);
            assert.equal(configuration.title, fixture.window.CheeseI18n.t('feedback.form.title'));
            assert.equal(review.value, fixture.window.CheeseI18n.t('feedback.form.template'));
            assert.equal(review.validity.customError, true);
            assert.equal(review.validationMessage, fixture.window.CheeseI18n.t('feedback.form.textRequired'));
            body.find('#feedback-form-author').val('מקור השם');
            body.find('#feedback-form-semester').val('202601');
            body.find('#feedback-form-text').val('The lectures were useful and the homework was clear.').trigger('input');
            body.find('#feedback-form-difficulty').val('3');
            body.find('#feedback-form-general').val('5');
            assert.equal(review.validity.customError, false);
            configuration.buttons[0].action(dialog);
            await settle();
            assert.equal(fixture.writes.length, 1);
            assert.equal(fixture.writes[0].collection, 'courseFeedback');
            assert.equal(fixture.writes[0].course, course);
            const stored = fixture.writes[0].update.posts;
            assert.deepEqual(Object.keys(stored).sort(), ['author', 'difficultyRank', 'generalRank', 'semester', 'text', 'timestamp']);
            assert.equal(stored.author, 'מקור השם');
            assert.equal(stored.text, 'The lectures were useful and the homework was clear.');
            assert.equal(stored.semester, '202601');
            assert.equal(stored.difficultyRank, 3);
            assert.equal(stored.generalRank, 5);
        } finally {
            fixture.dom.window.close();
        }
    });
}

test('signed-out review dialog and standalone links preserve the chosen language', async () => {
    const fixture = setup({ user: null, query: '&course=104001&publish' });
    try {
        const { window } = fixture;
        const startup = [...window.document.querySelectorAll('script:not([src])')].find(script => script.textContent.includes('stringToCourseNumber'));
        window.eval(startup.textContent);
        await settle();
        assert.equal(window.document.querySelector('#feedback-language').getAttribute('aria-label'), 'Language');
        assert.equal(window.document.querySelector('#feedback-language').value, 'en');
        assert.equal(new URL(window.document.querySelector('#feedback-home').href).searchParams.get('lang'), 'en');
        assert.equal(fixture.dialogs.length, 1);
        const { configuration, body } = fixture.dialogs[0];
        assert.match(body.text(), /Sign in to your account/);
        assert.equal(new URL(body.find('a').get(0).href).searchParams.get('lang'), 'en');
        assert.deepEqual(Array.from(configuration.buttons, button => button.label), ['Close']);
    } finally {
        fixture.dom.window.close();
    }
});

test('native translation runs only on click, reports downloads, escapes output and toggles a per-review result', async () => {
    let resolveTranslation;
    let downloadProgress;
    const result = '<img src=x onerror=alert(1)>\nTranslated safely.';
    const native = translatorFor(result);
    native.api.availability = options => {
        native.calls.availability.push({ ...options });
        return Promise.resolve('downloadable');
    };
    native.api.create = options => {
        native.calls.create.push(options);
        options.monitor({ addEventListener(name, callback) {
            assert.equal(name, 'downloadprogress');
            downloadProgress = callback;
        } });
        return new Promise(resolve => { resolveTranslation = () => resolve({
            translate: text => { native.calls.translate.push(text); return Promise.resolve(result); },
            destroy: () => { native.calls.destroy++; }
        }); });
    };
    const fixture = setup({ translator: native.api, posts: [post, { ...post, text: 'ביקורת שנייה עם תוכן שונה.' }] });
    try {
        const document = await render(fixture);
        const buttons = document.querySelectorAll('.feedback-translate');
        assert.equal(native.calls.availability.length, 0);
        buttons[0].click();
        assert.equal(buttons[0].disabled, true);
        await settle();
        assert.deepEqual(native.calls.availability, [{ sourceLanguage: 'he', targetLanguage: 'en' }]);
        assert.equal(native.calls.create[0].sourceLanguage, 'he');
        assert.equal(native.calls.create[0].targetLanguage, 'en');
        assert.match(document.querySelector('.feedback-translation-status').textContent, /downloading/);
        downloadProgress({ loaded: 0.42 });
        assert.match(document.querySelector('.feedback-translation-status').textContent, /42%/);
        resolveTranslation();
        await settle();
        assert.equal(native.calls.translate[0], originalReview);
        assert.equal(native.calls.destroy, 1);
        assert.equal(document.querySelector('.feedback-translated-text').textContent, result);
        assert.equal(document.querySelector('.feedback-translated-text img'), null);
        assert.equal(document.querySelector('.feedback-original-text').style.display, 'none');
        assert.match(document.querySelector('.feedback-translation-label').textContent, /Machine translation/);
        assert.equal(document.querySelector('.feedback-translation-status').getAttribute('aria-live'), 'polite');
        assert.equal(buttons[0].textContent, 'Show original Hebrew');
        buttons[0].click();
        assert.equal(document.querySelector('.feedback-original-text').style.display, '');
        assert.equal(buttons[0].textContent, 'Show English translation');
        buttons[0].click();
        assert.equal(buttons[0].textContent, 'Show original Hebrew');
        assert.equal(native.calls.availability.length, 1);
        assert.equal(native.calls.translate.length, 1);
        assert.equal(document.querySelectorAll('.feedback-translated-text')[1].textContent, '');
        assert.equal(buttons[1].textContent, 'Translate to English');
    } finally {
        fixture.dom.window.close();
    }
});

test('reporting a translated review sends the unchanged original review and author', async () => {
    const native = translatorFor('Translated review');
    const fixture = setup({ translator: native.api });
    try {
        const document = await render(fixture);
        document.querySelector('.feedback-translate').click();
        await settle();
        document.querySelector('.feedback-report').click();
        const { configuration, body, dialog } = fixture.dialogs[0];
        assert.equal(configuration.title, 'Report inappropriate content');
        assert.doesNotMatch(body.text(), /[\u0590-\u05ff]/);
        body.find('#report-form-email').val('student@example.test');
        body.find('#report-form-reason').val('Reason in the student’s own words.');
        configuration.buttons[0].action(dialog);
        await settle();
        const report = fixture.writes[0];
        assert.equal(report.collection, 'courseFeedbackReports');
        assert.equal(report.update.posts.postText, originalReview);
        assert.equal(report.update.posts.postAuthor, post.author);
        assert.equal(report.update.posts.reason, 'Reason in the student’s own words.');
        assert.equal(fixture.dialogs[1].configuration.title, 'Report submitted');
    } finally {
        fixture.dom.window.close();
    }
});

for (const unsupported of ['absent', 'unavailable']) {
    test(unsupported + ' native translation offers an actionable browser translation fallback', async () => {
        const native = translatorFor();
        native.api.availability = () => Promise.resolve('unavailable');
        const fixture = setup({ translator: unsupported === 'absent' ? null : native.api });
        try {
            const document = await render(fixture);
            const button = document.querySelector('.feedback-translate');
            button.click();
            await settle();
            assert.equal(button.textContent, 'Select text to translate');
            assert.equal(native.calls.create.length, 0);
            assert.equal(fixture.window.getSelection().toString(), originalReview);
            assert.match(document.querySelector('.feedback-translation-status').textContent, /browser menu|Translate selection/);
            button.click();
            assert.equal(fixture.window.getSelection().toString(), originalReview);
            assert.equal(document.querySelector('.feedback-original-text').textContent, originalReview);
            assert.equal(document.querySelector('.feedback-translated-text').textContent, '');
        } finally {
            fixture.dom.window.close();
        }
    });
}

test('translation failure preserves the original and permits a fresh retry', async () => {
    const native = translatorFor();
    let attempts = 0;
    native.api.create = () => Promise.resolve({
        translate: () => ++attempts === 1 ? Promise.reject(new Error('download failed')) : Promise.resolve('Retry succeeded.')
    });
    const fixture = setup({ translator: native.api });
    try {
        const document = await render(fixture);
        const button = document.querySelector('.feedback-translate');
        button.click();
        await settle();
        assert.equal(document.querySelector('.feedback-original-text').style.display, '');
        assert.match(document.querySelector('.feedback-translation-status').textContent, /could not finish/);
        assert.equal(button.textContent, 'Try translation again');
        assert.equal(button.disabled, false);
        document.querySelector('.feedback-select-original').click();
        assert.equal(fixture.window.getSelection().toString(), originalReview);
        button.click();
        await settle();
        assert.equal(attempts, 2);
        assert.equal(document.querySelector('.feedback-translated-text').textContent, 'Retry succeeded.');
    } finally {
        fixture.dom.window.close();
    }
});

test('expired user activation waits for a second click before creating the translator', async () => {
    let resolveAvailability;
    const native = translatorFor();
    native.api.availability = () => new Promise(resolve => { resolveAvailability = resolve; });
    const fixture = setup({ translator: native.api });
    try {
        const activation = { isActive: true };
        Object.defineProperty(fixture.window.navigator, 'userActivation', { value: activation });
        const document = await render(fixture);
        const button = document.querySelector('.feedback-translate');
        button.click();
        activation.isActive = false;
        resolveAvailability('available');
        await settle();
        assert.equal(native.calls.create.length, 0);
        assert.equal(button.textContent, 'Continue translation');
        assert.match(document.querySelector('.feedback-translation-status').textContent, /another click/);
        activation.isActive = true;
        button.click();
        await settle();
        assert.equal(native.calls.create.length, 1);
        assert.equal(button.textContent, 'Show original Hebrew');
    } finally {
        fixture.dom.window.close();
    }
});

test('a click without browser user activation does not request or create a translator', async () => {
    const native = translatorFor();
    const fixture = setup({ translator: native.api });
    try {
        Object.defineProperty(fixture.window.navigator, 'userActivation', { value: { isActive: false } });
        const document = await render(fixture);
        const button = document.querySelector('.feedback-translate');
        button.click();
        await settle();
        assert.equal(native.calls.availability.length, 0);
        assert.equal(native.calls.create.length, 0);
        assert.equal(button.disabled, false);
        assert.match(document.querySelector('.feedback-translation-status').textContent, /another click/);
    } finally {
        fixture.dom.window.close();
    }
});

test('review load failure is localized', async () => {
    const fixture = setup({ getFailure: true });
    try {
        const document = await render(fixture);
        assert.equal(document.querySelector('.course-feedback').textContent, 'Reviews could not be loaded. Please try again later.');
    } finally {
        fixture.dom.window.close();
    }
});
