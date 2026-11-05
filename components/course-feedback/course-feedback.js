'use strict';

/* global BootstrapDialog, CheeseI18n, firebase, currentSemester */

// eslint-disable-next-line no-unused-vars
var CourseFeedback = (function () {
    var templateLabels = [
        'שם המרצה:',
        'חוות דעת - הרצאות:',
        'שם המתרגל/ת:',
        'חוות דעת - תרגולים:',
        'שעורי הבית:',
        'המבחן:',
        'השורה התחתונה:',
        'Lecturer name:',
        'Lecture feedback:',
        'Teaching assistant name:',
        'Tutorial feedback:',
        'Homework:',
        'Exam:',
        'The bottom line:'
    ];

    function t(key, params) {
        return CheeseI18n.t('feedback.' + key, params);
    }

    function translatedHtml(key, params) {
        return $('<div>').text(t(key, params)).html().replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function CourseFeedback(element, options) {
        this.element = element;
        this.columnGrid = options.columnGrid;
        this.openNewFeedbackDialog = options.openNewFeedbackDialog;
        this.loginUrl = options.loginUrl ? CheeseI18n.withLocale(options.loginUrl) : null;
    }

    var authReady = false;
    var authReadyCallbacks = null;

    // currentUser is null both when signed out and before the initial auth state is
    // restored, and the compat SDK doesn't expose authStateReady, so tell the two apart
    // by the first onAuthStateChanged call.
    function whenAuthReady(callback) {
        if (authReady || typeof firebase === 'undefined' || !firebase.auth) {
            callback();
            return;
        }

        var registerListener = authReadyCallbacks === null;
        if (registerListener) {
            authReadyCallbacks = [];
        }

        authReadyCallbacks.push(callback);

        if (registerListener) {
            var onReady = function () {
                authReady = true;

                var callbacks = authReadyCallbacks;
                authReadyCallbacks = [];
                callbacks.forEach(function (queuedCallback) {
                    queuedCallback();
                });
            };

            try {
                firebase.auth().onAuthStateChanged(onReady, onReady);
            } catch (e) {
                // Firebase auth doesn't work on Edge/IE in private mode.
                onReady();
            }
        }
    }

    function newFeedbackDialog(course, options) {
        var authenticated = firebase.auth &&
            firebase.auth().currentUser !== null;

        var defaultText = t('form.template');

        var formHtml = authenticated
            ? ('<form>' +
                '<div class="form-row">' +
                    '<div class="form-group col-md-6">' +
                        '<label for="feedback-form-author">' + translatedHtml('form.author') + '</label>' +
                        '<input type="text" class="form-control" id="feedback-form-author" dir="auto" required pattern=".*\\S.*">' +
                        '<div class="invalid-feedback">' +
                            translatedHtml('form.authorRequired') +
                        '</div>' +
                    '</div>' +
                    '<div class="form-group col-md-6">' +
                        '<label for="feedback-form-semester">' + translatedHtml('form.semester') + '</label>' +
                        '<select class="form-control" id="feedback-form-semester" required>' +
                        '</select>' +
                        '<div class="invalid-feedback">' +
                            translatedHtml('form.semesterRequired') +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="form-row">' +
                    '<div class="form-group col-md-12">' +
                        '<label for="feedback-form-text">' + translatedHtml('form.text') + '</label>' +
                        '<textarea class="form-control" id="feedback-form-text" dir="auto" rows="12" required>' +
                            $('<div>').text(defaultText).html() +
                        '</textarea>' +
                        '<div class="invalid-feedback">' +
                            translatedHtml('form.textRequired') +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="form-row">' +
                    '<div class="form-group col-md-6">' +
                        '<label for="feedback-form-difficulty">' + translatedHtml('form.difficulty') + '</label>' +
                        '<select class="form-control" id="feedback-form-difficulty" required>' +
                            '<option value="">' + translatedHtml('form.choose') + '</option>' +
                            '<option value="5">' + translatedHtml('form.workload5') + '</option>' +
                            '<option value="4">' + translatedHtml('form.workload4') + '</option>' +
                            '<option value="3">' + translatedHtml('form.workload3') + '</option>' +
                            '<option value="2">' + translatedHtml('form.workload2') + '</option>' +
                            '<option value="1">' + translatedHtml('form.workload1') + '</option>' +
                        '</select>' +
                        '<div class="invalid-feedback">' +
                            translatedHtml('form.choiceRequired') +
                        '</div>' +
                    '</div>' +
                    '<div class="form-group col-md-6">' +
                        '<label for="feedback-form-general">' + translatedHtml('form.general') + '</label>' +
                        '<select class="form-control" id="feedback-form-general" required>' +
                            '<option value="">' + translatedHtml('form.choose') + '</option>' +
                            '<option value="5">' + translatedHtml('form.recommendation5') + '</option>' +
                            '<option value="4">' + translatedHtml('form.recommendation4') + '</option>' +
                            '<option value="3">' + translatedHtml('form.recommendation3') + '</option>' +
                            '<option value="2">' + translatedHtml('form.recommendation2') + '</option>' +
                            '<option value="1">' + translatedHtml('form.recommendation1') + '</option>' +
                        '</select>' +
                        '<div class="invalid-feedback">' +
                            translatedHtml('form.choiceRequired') +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div>' +
                    '<strong>' + translatedHtml('form.noticeTitle') + '</strong> ' +
                    translatedHtml('form.noticeText') +
                '</div>' +
            '</form>')
            : ('<div>' +
                translatedHtml('form.loginRequired') +
                // Pages without a login flow of their own point at one that has it.
                (options.loginUrl
                    ? '<br>' +
                        $('<a>', {
                            href: CheeseI18n.withLocale(options.loginUrl),
                            target: '_blank',
                            rel: 'noopener',
                            text: t('form.loginLink')
                        }).prop('outerHTML') +
                        ' ' + translatedHtml('form.loginRefresh')
                    : '') +
            '</div>');

        var messageElement = $('<div>').append(options.preHtml, formHtml, options.postHtml);

        var buttons = [];

        if (authenticated) {
            buttons.push({
                label: t('form.submit'),
                cssClass: 'btn-primary',
                action: function (dialog) {
                    var body = dialog.getModalBody();

                    var form = body.find('form').get(0);
                    if (form.checkValidity() === false) {
                        form.classList.add('was-validated');
                        return;
                    }
                    form.classList.remove('was-validated');

                    var feedbackDisplayName = body.find('#feedback-form-author').val().trim();
                    try {
                        localStorage.setItem('feedbackDisplayName', feedbackDisplayName);
                    } catch (e) {
                        // localStorage is not available in IE/Edge when running from a local file.
                    }

                    var data = {
                        timestamp: Date.now(),
                        author: feedbackDisplayName,
                        semester: body.find('#feedback-form-semester').val(),
                        text: body.find('#feedback-form-text').val().trim(),
                        difficultyRank: parseInt(body.find('#feedback-form-difficulty').val(), 10),
                        generalRank: parseInt(body.find('#feedback-form-general').val(), 10)
                    };

                    var update = {
                        posts: firebase.firestore.FieldValue.arrayUnion(data)
                    };

                    firebase.firestore().collection('courseFeedback').doc(course)
                        .set(update, {merge: true})
                        .then(function () {
                            options.onSubmit();
                        }, function (error) {
                            alert(t('writeError', {error: error}));
                        });

                    dialog.close();
                }
            });
        }

        if (authenticated && options.skipButton) {
            buttons.push({
                label: t('form.skip'),
                action: function (dialog) {
                    dialog.close();
                    options.onSubmit();
                }
            });
        }

        buttons.push({
            label: t('close'),
            action: function (dialog) {
                dialog.close();
            }
        });

        BootstrapDialog.show({
            title: t('form.title'),
            message: messageElement,
            buttons: buttons,
            onshow: function (dialog) {
                if (!authenticated) {
                    return;
                }

                var body = dialog.getModalBody();

                var selectSemester = body.find('#feedback-form-semester');
                var selectValue = '';
                var semesterEndMonths = ['03', '07', '10'];
                var done = false;
                var monthNow = new Date().toISOString().slice(0, '2000-01'.length);
                for (var year = 2000; !done; year++) {
                    for (var season = 1; !done && season <= 3; season++) {
                        var semester = year.toString() + '0' + season.toString();
                        selectSemester.prepend($('<option>', {
                            value: semester,
                            text: semesterFriendlyName(semester)
                        }));

                        if (typeof currentSemester !== 'undefined' && currentSemester === semester) {
                            selectValue = semester;
                        }

                        var semesterEnd = (year + 1) + '-' + semesterEndMonths[season - 1];
                        done = semesterEnd > monthNow;
                    }
                }
                selectSemester.prepend($('<option>', {
                    value: '',
                    text: t('form.semesterChoose')
                })).val(selectValue);

                var displayName;
                try {
                    displayName = localStorage.getItem('feedbackDisplayName');
                } catch (e) {
                    // A display name can still be entered when browser storage is unavailable.
                }
                if (displayName) {
                    body.find('#feedback-form-author').val(displayName);
                }

                var validateFeedbackText = function () {
                    var value = this.value;
                    templateLabels.forEach(function (templatePart) {
                        value = value.split(templatePart).join('');
                    });

                    var words = value.trim().split(/\s+/);

                    if (words.length <= 3) {
                        this.setCustomValidity(t('form.textRequired'));
                    } else {
                        this.setCustomValidity('');
                    }
                };

                body.find('#feedback-form-text').on('input', validateFeedbackText).trigger('input');
            },
            onhide: options.onHide || function () {}
        });
    }

    function reportFeedbackDialog(course, postTimestamp, postText, postAuthor, options) {
        var contentHtml =
            '<div>' +
                '<div>' +
                    translatedHtml('report.intro') +
                    '<br>' +
                    '<br>' +
                    translatedHtml('report.inappropriateExamples') +
                    '<ul>' +
                        '<li>' + translatedHtml('report.offensiveLanguage') + '</li>' +
                        '<li>' + translatedHtml('report.unrelatedContent') + '</li>' +
                        '<li>' + translatedHtml('report.personalRemarks') + '</li>' +
                    '</ul>' +
                    translatedHtml('report.appropriateExamples') +
                    '<ul>' +
                        '<li>' + translatedHtml('report.constructiveCriticism') + '</li>' +
                    '</ul>' +
                '</div>' +
                '<form>' +
                    '<div class="form-row">' +
                        '<div class="form-group col-md-6">' +
                            '<label for="report-form-email">' + translatedHtml('report.email') + '</label>' +
                            '<input type="email" class="form-control" id="report-form-email" dir="ltr" required>' +
                            '<div class="invalid-feedback">' +
                                translatedHtml('report.emailInvalid') +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="form-row">' +
                        '<div class="form-group col-md-12">' +
                            '<label for="report-form-reason">' + translatedHtml('report.reason') + '</label>' +
                            '<textarea class="form-control" id="report-form-reason" dir="auto" rows="6" required>' +
                            '</textarea>' +
                            '<div class="invalid-feedback">' +
                                translatedHtml('report.reasonRequired') +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</form>' +
            '</div>';

        var buttons = [{
            label: t('report.submit'),
            cssClass: 'btn-primary',
            action: function (dialog) {
                var body = dialog.getModalBody();

                var form = body.find('form').get(0);
                if (form.checkValidity() === false) {
                    form.classList.add('was-validated');
                    return;
                }
                form.classList.remove('was-validated');

                var data = {
                    timestamp: Date.now(),
                    email: body.find('#report-form-email').val(),
                    reason: body.find('#report-form-reason').val(),
                    postTimestamp: postTimestamp,
                    postText: postText,
                    postAuthor: postAuthor
                };

                var update = {
                    posts: firebase.firestore.FieldValue.arrayUnion(data)
                };

                firebase.firestore().collection('courseFeedbackReports').doc(course)
                    .set(update, {merge: true})
                    .then(function () {
                        options.onSubmit();
                    }, function (error) {
                        alert(t('writeError', {error: error}));
                    });

                dialog.close();
            }
        }, {
            label: t('close'),
            action: function (dialog) {
                dialog.close();
            }
        }];

        BootstrapDialog.show({
            title: t('report.title'),
            message: contentHtml,
            buttons: buttons
        });
    }

    function makeRanksHtml(generalRank, difficultyRank, columnGrid) {
        var makeRanks = function (rank, full, half, empty) {
            var html = '';
            var rankTimesTwo = Math.round(rank * 2);
            for (var i = 0; i < 5; i++) {
                if (i * 2 >= rankTimesTwo) {
                    html += empty;
                } else if (i * 2 + 1 >= rankTimesTwo) {
                    html += half;
                } else {
                    html += full;
                }
            }

            return html;
        };

        var makeStars = function (rank) {
            var fullStar = '<i class="fas fa-star"></i>';
            var halfStar = '<i class="fas fa-star-half-alt"></i>';
            var emptyStar = '<i class="far fa-star"></i>';
            return makeRanks(rank, fullStar, halfStar, emptyStar);
        };

        var makeWeights = function (rank) {
            var full = '<i class="fas fa-weight-hanging"></i>';

            // https://fontawesome.com/icons/weight-hanging?style=regular
            var empty = '<i style="line-height: 0; display:inline-block;">' +
                '<svg style="width: 1em;" aria-hidden="true" focusable="false" data-prefix="far" data-icon="weight-hanging" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" class="svg-inline--fa fa-weight-hanging fa-1x">' +
                '<path fill="currentColor" d="M510.28 445.86l-73.03-292.13c-3.8-15.19-16.44-25.72-30.87-25.72h-72.41c6.2-12.05 10.04-25.51 10.04-40 0-48.6-39.4-88-88-88s-88 39.4-88 88c0 14.49 3.83 27.95 10.04 40h-72.41c-14.43 0-27.08 10.54-30.87 25.72L1.72 445.86C-6.61 479.17 16.38 512 48.03 512h415.95c31.64 0 54.63-32.83 46.3-66.14zM216 88c0-22.06 17.94-40 40-40s40 17.94 40 40c0 22.05-17.94 40-40 40s-40-17.95-40-40zm246.72 376H49.28c-.7-.96-1.81-3.23-1-6.5L118.66 176h274.68l70.38 281.5c.81 3.27-.3 5.54-1 6.5z">' +
                '</path></svg></i>';

            // Edited empty with https://editor.method.ac/
            var half = '<i style="line-height: 0; display:inline-block;">' +
                '<svg style="width: 1em;" aria-hidden="true" focusable="false" data-prefix="far" data-icon="weight-hanging" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" class="svg-inline--fa fa-weight-hanging fa-1x">' +
                '<path fill="currentColor" d="m510.28,445.86l-73.03,-292.13c-3.8,-15.19 -16.44,-25.72 -30.87,-25.72l-72.41,0c6.2,-12.05 10.04,-25.51 10.04,-40c0,-48.6 -39.4,-88 -88,-88s-88,39.4 -88,88c0,14.49 3.83,27.95 10.04,40l-72.41,0c-14.43,0 -27.08,10.54 -30.87,25.72l-73.05,292.13c-8.33,33.31 14.66,66.14 46.31,66.14l415.95,0c31.64,0 54.63,-32.83 46.3,-66.14zm-294.28,-357.86c0,-22.06 17.94,-40 40,-40s40,17.94 40,40c0,22.05 -17.94,40 -40,40s-40,-17.95 -40,-40zm246.72,376c-137.64664,0 -69.07336,0 -206.72,0l0,-288l137.34,0l70.38,281.5c0.81,3.27 -0.3,5.54 -1,6.5z">' +
                '</path></svg></i>';

            return makeRanks(rank, full, half, empty);
        };

        columnGrid = columnGrid || 'lg';

        return '<div class="row course-ranks">' +
                '<div class="col-' + columnGrid + ' course-rank">' +
                    '<div class="course-rank-title">' + translatedHtml('rank.general') + '</div>' +
                    '<div role="img" aria-label="' + translatedHtml('rank.generalLabel', {rating: Math.round(generalRank * 10) / 10}) + '">' +
                        '<span aria-hidden="true" class="course-rank-icons">' +
                        '<i class="fas fa-2x fa-thumbs-down"></i>' +
                        makeStars(generalRank) +
                        '<i class="fas fa-2x fa-thumbs-up"></i>' +
                        '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="col-' + columnGrid + ' course-rank">' +
                    '<div class="course-rank-title">' + translatedHtml('rank.workload') + '</div>' +
                    '<div role="img" aria-label="' + translatedHtml('rank.workloadLabel', {rating: Math.round(difficultyRank * 10) / 10}) + '">' +
                        '<span aria-hidden="true" class="course-rank-icons">' +
                        '<i class="fas fa-2x fa-feather-alt"></i>' +
                        makeWeights(difficultyRank) +
                        '<i class="fas fa-2x fa-dumbbell"></i>' +
                        '</span>' +
                    '</div>' +
                '</div>' +
            '</div>';
    }

    function makeFeedbackSummaryHtml(posts, columnGrid) {
        var content = $('<div id="course-feedback-summary"></div>');

        var title = t('summary.title');
        if (posts.length === 1) {
            title = t('summary.one');
        } else if (posts.length > 1) {
            title = t('summary.many', {count: posts.length});
        }

        content.append($('<h3>', {
            text: title
        }));

        if (posts.length > 0) {
            var generalRank = 0;
            var difficultyRank = 0;
            var rankCount = 0;

            posts.forEach(function (post) {
                if (post.generalRank && post.difficultyRank) {
                    generalRank += post.generalRank;
                    difficultyRank += post.difficultyRank;
                    rankCount++;
                }
            });

            if (rankCount > 0) {
                generalRank /= rankCount;
                difficultyRank /= rankCount;

                content.append(makeRanksHtml(generalRank, difficultyRank, columnGrid));
            }
        }

        return content;
    }

    function preprocessPostText(text) {
        var labelPattern = templateLabels.map(function (label) {
            return label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }).join('|');
        var pattern = new RegExp('(^|\\n)[\\t ]*(?:' + labelPattern + ')', 'g');
        var sections = [];
        var match;
        while ((match = pattern.exec(text)) !== null) {
            sections.push({start: match.index + match[1].length, end: pattern.lastIndex});
        }
        var result = '';
        var cursor = 0;
        sections.forEach(function (section, index) {
            var end = index + 1 < sections.length ? sections[index + 1].start : text.length;
            if (!text.slice(section.end, end).trim()) {
                result += text.slice(cursor, section.start);
                cursor = end;
            }
        });
        return (result + text.slice(cursor)).trim();
    }

    function addPostTranslation(postContent, originalText) {
        var api = window.Translator;
        var supported = api && typeof api.availability === 'function' && typeof api.create === 'function';
        var state = supported ? 'idle' : 'fallback';
        var availabilityState = '';
        var translatedValue = null;
        var translator = null;
        var requestOptions = {sourceLanguage: 'he', targetLanguage: 'en'};
        var translatedText = $('<div>', {
            class: 'feedback-post-text feedback-translated-text',
            lang: 'en',
            dir: 'ltr'
        });
        var translatedContent = $('<div>', {
            class: 'feedback-translated-review',
            lang: 'en',
            dir: 'ltr'
        }).append($('<div>', {
            class: 'feedback-translation-label small font-weight-bold',
            text: t('translation.machineLabel')
        }), translatedText).hide();
        var controls = $('<div>', {class: 'feedback-translation-controls'});
        var status = $('<div>', {
            class: 'feedback-translation-status small',
            role: 'status',
            'aria-live': 'polite',
            'aria-atomic': 'true'
        });
        var button = $('<button>', {
            type: 'button',
            class: 'btn btn-sm btn-outline-secondary feedback-translate',
            text: t(supported ? 'translation.translate' : 'translation.select')
        });
        var selectionButton = $('<button>', {
            type: 'button',
            class: 'btn btn-sm btn-link feedback-select-original',
            text: t('translation.select')
        }).hide();

        function stopWaiting() {
            controls.removeAttr('aria-busy');
            button.prop('disabled', false);
        }

        function releaseTranslator() {
            if (translator && typeof translator.destroy === 'function') {
                try {
                    translator.destroy();
                } catch (e) {
                    // Translation results remain usable when model cleanup is unavailable.
                }
            }
            translator = null;
        }

        function selectOriginal() {
            originalText.show();
            translatedContent.hide();
            if (translatedValue !== null) {
                state = 'original';
                button.text(t('translation.showEnglish'));
            }
            try {
                if (typeof window.getSelection === 'function' && typeof document.createRange === 'function') {
                    var selection = window.getSelection();
                    var range = document.createRange();
                    if (selection) {
                        range.selectNodeContents(originalText.get(0));
                        selection.removeAllRanges();
                        selection.addRange(range);
                        status.text(t('translation.selected') + ' ' + t('translation.browserHelp'));
                        return;
                    }
                }
            } catch (e) {
                // The browser menu remains available when text selection is restricted.
            }
            status.text(t('translation.browserHelp'));
        }

        function showFallback() {
            state = 'fallback';
            stopWaiting();
            button.text(t('translation.select'));
            selectOriginal();
            status.text(t('translation.unavailable') + ' ' + status.text());
        }

        function onError() {
            releaseTranslator();
            state = 'idle';
            stopWaiting();
            button.text(t('translation.retry'));
            selectionButton.show();
            status.text(t('translation.error') + ' ' + t('translation.browserHelp'));
        }

        function showTranslation(value) {
            if (typeof value !== 'string' || !value.trim()) {
                onError();
                return;
            }
            translatedValue = value;
            translatedText.text(value);
            originalText.hide();
            translatedContent.show();
            selectionButton.hide();
            state = 'translated';
            stopWaiting();
            button.text(t('translation.showOriginal'));
            status.text(t('translation.complete'));
            releaseTranslator();
        }

        function createTranslator() {
            if (window.navigator.userActivation && window.navigator.userActivation.isActive === false) {
                state = 'ready';
                stopWaiting();
                button.text(t('translation.continue'));
                status.text(t('translation.activationRequired'));
                return;
            }
            status.text(t(availabilityState === 'available' ? 'translation.translating' : 'translation.downloading'));
            var created;
            try {
                created = api.create({
                    sourceLanguage: requestOptions.sourceLanguage,
                    targetLanguage: requestOptions.targetLanguage,
                    monitor: function (monitor) {
                        if (monitor && typeof monitor.addEventListener === 'function') {
                            monitor.addEventListener('downloadprogress', function (event) {
                                if (state === 'pending' && typeof event.loaded === 'number' && isFinite(event.loaded)) {
                                    status.text(t('translation.downloadProgress', {
                                        percent: Math.max(0, Math.min(100, Math.round(event.loaded * 100)))
                                    }));
                                }
                            });
                        }
                    }
                });
            } catch (e) {
                onError();
                return;
            }
            if (!created || typeof created.then !== 'function') {
                onError();
                return;
            }
            created.then(function (createdTranslator) {
                translator = createdTranslator;
                if (!translator || typeof translator.translate !== 'function') {
                    onError();
                    return;
                }
                status.text(t('translation.translating'));
                var result;
                try {
                    result = translator.translate(originalText.text());
                } catch (e) {
                    onError();
                    return;
                }
                if (!result || typeof result.then !== 'function') {
                    onError();
                    return;
                }
                result.then(showTranslation, onError);
            }, onError);
        }

        button.on('click', function () {
            if (state === 'pending') {
                return;
            }
            if (state === 'fallback') {
                selectOriginal();
                return;
            }
            if (state === 'translated') {
                originalText.show();
                translatedContent.hide();
                state = 'original';
                button.text(t('translation.showEnglish'));
                status.text(t('translation.originalShown'));
                return;
            }
            if (state === 'original') {
                showTranslation(translatedValue);
                return;
            }
            if (window.navigator.userActivation && window.navigator.userActivation.isActive === false) {
                button.text(t('translation.continue'));
                status.text(t('translation.activationRequired'));
                return;
            }
            var ready = state === 'ready';
            state = 'pending';
            button.prop('disabled', true);
            controls.attr('aria-busy', 'true');
            status.text(t('translation.checking'));
            if (ready) {
                createTranslator();
                return;
            }
            var availability;
            try {
                availability = api.availability(requestOptions);
            } catch (e) {
                onError();
                return;
            }
            if (!availability || typeof availability.then !== 'function') {
                onError();
                return;
            }
            availability.then(function (value) {
                if (value !== 'available' && value !== 'downloadable' && value !== 'downloading') {
                    showFallback();
                    return;
                }
                availabilityState = value;
                createTranslator();
            }, onError);
        });

        selectionButton.on('click', selectOriginal);
        if (!supported) {
            status.text(t('translation.unavailable') + ' ' + t('translation.browserHelp'));
        }
        controls.append(button, selectionButton, status);
        postContent.append(translatedContent, controls);
    }

    function makeFeedbackSinglePostHtml(course, post, columnGrid) {
        var content = $('<div class="timeline-box"></div>');

        content.append($('<div>', {
            class: 'box-title',
            text: t('post.semester', {semester: semesterFriendlyName(post.semester)})
        }));

        var postText = preprocessPostText(post.text);

        var originalText = $('<div>', {
            class: 'feedback-post-text feedback-original-text',
            lang: /[\u0590-\u05ff]/.test(postText) ? 'he' : 'en',
            dir: 'auto',
            text: postText
        });
        var postContent = $('<div>', {class: 'box-content'}).append(originalText);

        if (CheeseI18n.getLocale() === 'en' && /[\u0590-\u05ff]/.test(postText)) {
            addPostTranslation(postContent, originalText);
        }

        if (post.generalRank && post.difficultyRank) {
            postContent.append(makeRanksHtml(post.generalRank, post.difficultyRank, columnGrid));
        }

        content.append(postContent);

        var prettyDate = new Date(post.timestamp).toLocaleDateString(CheeseI18n.getLocale() === 'en' ? 'en-GB' : 'he-IL', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        var flagButton = $('<button>', {
            type: 'button',
            class: 'btn btn-link p-0 feedback-report',
            'aria-label': t('report.title'),
            title: t('report.title'),
            'data-toggle': 'tooltip'
        }).append($('<i>', {
            class: 'fas fa-flag',
            'aria-hidden': 'true'
        })).tooltip().click(function (event) {
            reportFeedbackDialog(course, post.timestamp, post.text, post.author, {
                onSubmit: function () {
                    BootstrapDialog.show({
                        title: t('report.successTitle'),
                        message: t('report.successText'),
                        size: BootstrapDialog.SIZE_SMALL
                    });
                }
            });
            return false;
        });

        var footerBox = $('<div>', {
            class: 'box-footer'
        }).append($('<span>', {
            text: '- '
        }), $('<span>', {
            class: 'feedback-author',
            dir: 'auto',
            lang: /[\u0590-\u05ff]/.test(post.author) ? 'he' : 'en',
            text: post.author
        }), $('<span>', {
            text: ', ' + prettyDate
        }).append(' ', flagButton));

        content.append(footerBox);

        return content;
    }

    function makeFeedbackPostsHtml(course, posts, columnGrid) {
        var content = $('<div id="course-feedback-carousel" class="carousel slide carousel-fade" data-ride="carousel" data-interval="false" role="region">' +
                '<ol class="carousel-indicators"></ol>' +
                '<div class="carousel-inner"></div>' +
                '<a class="carousel-control-prev" href="#course-feedback-carousel" role="button" data-slide="prev">' +
                    '<span class="carousel-control-prev-icon" aria-hidden="true"></span>' +
                    '<span class="sr-only">' + translatedHtml('carousel.previous') + '</span>' +
                '</a>' +
                '<a class="carousel-control-next" href="#course-feedback-carousel" role="button" data-slide="next">' +
                    '<span class="carousel-control-next-icon" aria-hidden="true"></span>' +
                    '<span class="sr-only">' + translatedHtml('carousel.next') + '</span>' +
                '</a>' +
            '</div>');
        content.attr('aria-label', t('carousel.label'));

        var carouselIndicators = content.find('.carousel-indicators');
        var carouselInner = content.find('.carousel-inner');

        posts.forEach(function (post, i) {
            var active = i === posts.length - 1;

            var reviewLabel = t('carousel.reviewNumber', {number: i + 1, count: posts.length});
            var indicator = $('<li>', {
                'data-target': '#course-feedback-carousel',
                'data-slide-to': i,
                class: active ? 'active' : '',
                role: 'button',
                tabindex: '0',
                'aria-label': reviewLabel,
                'aria-current': active ? 'true' : 'false'
            }).on('keydown', function (event) {
                if (event.which === 13 || event.which === 32) {
                    event.preventDefault();
                    $(this).click();
                }
            });
            carouselIndicators.append(indicator);

            var carouselItemContents = $('<div class="carousel-item-contents"></div>')
                .append(makeFeedbackSinglePostHtml(course, post, columnGrid));

            var carouselItem = $('<div class="carousel-item' + (active ? ' active' : '') + '"></div>')
                .attr({role: 'group', 'aria-label': reviewLabel})
                .append(carouselItemContents);

            carouselInner.append(carouselItem);
        });

        content.on('slid.bs.carousel', function () {
            carouselIndicators.children().attr('aria-current', 'false').filter('.active').attr('aria-current', 'true');
        });

        return content;
    }

    function renderFeedback(courseFeedback, course, posts) {
        var element = courseFeedback.element;

        var columnGrid = courseFeedback.columnGrid;

        var content = $('<div id="course-feedback"></div>')
            .append(makeFeedbackSummaryHtml(posts, columnGrid));

        if (posts.length > 0) {
            content.append(makeFeedbackPostsHtml(course, posts, columnGrid));
        } else {
            content.append($('<div>', {
                class: 'mb-2',
                text: t('empty')
            }));
        }

        var newFeedbackButton = $('<button>', {
            type: 'button',
            class: 'btn btn-primary',
            text: t('form.title')
        })
            .click(function (event) {
                var button = $(this).prop('disabled', true).text(t('form.checkingAuth'));

                whenAuthReady(function () {
                    button.prop('disabled', false).text(t('form.title'));

                    newFeedbackDialog(course, {
                        onSubmit: function () {
                            courseFeedback.loadFeedback(course, false);
                        },
                        loginUrl: courseFeedback.loginUrl
                    });
                });
            });

        content.append($('<div class="text-center"></div>').append(newFeedbackButton));

        element.html(content);

        // Only on the first render, so that the dialog doesn't reopen after submitting.
        if (courseFeedback.openNewFeedbackDialog) {
            courseFeedback.openNewFeedbackDialog = false;
            newFeedbackButton.click();
        }
    }

    function semesterFriendlyName(semester) {
        var year = parseInt(semester.slice(0, 4), 10);
        var semesterCode = semester.slice(4);

        switch (semesterCode) {
        case '01':
            return t('semester.winter', {year: year, nextYear: year + 1});

        case '02':
            return t('semester.spring', {year: year + 1});

        case '03':
            return t('semester.summer', {year: year + 1});

        default:
            return semester;
        }
    }

    CourseFeedback.prototype.loadFeedback = function (course, loadingMessage) {
        var element = this.element;
        var that = this;

        if (loadingMessage === undefined || loadingMessage) {
            element.text(t('loading'));
        }

        var onError = function () {
            element.text(t('loadError'));
        };

        if (typeof firebase !== 'undefined') {
            firebase.firestore().collection('courseFeedback').doc(course).get()
                .then(function (doc) {
                    var posts = [];
                    if (doc.exists) {
                        var data = doc.data();
                        posts = data.posts;
                    }

                    renderFeedback(that, course, posts);
                }, function (error) {
                    onError();
                });
        } else {
            onError();
        }
    };

    CourseFeedback.prototype.endOfSemesterFeedbackDialog = function (courses, options) {
        var i = 0;

        var nextDialog = function () {
            if (i < courses.length) {
                var course = courses[i].course;
                var courseTitle = courses[i].title;
                i++;

                var perHtml = $('<div>').append(options.dialogHtml, $('<h3>', {
                    text: courseTitle,
                    lang: 'he',
                    dir: 'auto'
                }));

                newFeedbackDialog(course, {
                    onSubmit: nextDialog,
                    onHide: options.onHide,
                    preHtml: perHtml,
                    postHtml: options.postHtml,
                    skipButton: true
                });
            } else if (options.onSharingDone) {
                options.onSharingDone();
            }
        };

        nextDialog();
    };

    return CourseFeedback;
})();
