'use strict';

/* global BootstrapDialog, firebase, currentSemester */

// eslint-disable-next-line no-unused-vars
var CourseFeedback = (function () {
    function CourseFeedback(element, options) {
        this.element = element;
        this.columnGrid = options.columnGrid;
    }

    function newFeedbackDialog(course, options) {
        var defaultText = 'שם המרצה: \n' +
            'חוות דעת - הרצאות: \n' +
            '\n' +
            'שם המתרגל/ת: \n' +
            'חוות דעת - תרגולים: \n' +
            '\n' +
            'שעורי הבית: \n' +
            '\n' +
            'המבחן: \n' +
            '\n' +
            'השורה התחתונה: ';

        var formHtml = '<form>' +
                '<div class="form-row">' +
                    '<div class="form-group col-md-6">' +
                        '<label for="feedback-form-author">שם או כינוי</label>' +
                        '<input type="text" class="form-control" id="feedback-form-author" required pattern=".*\\S.*">' +
                        '<div class="invalid-feedback">' +
                            'יש להכניס שם או כינוי' +
                        '</div>' +
                    '</div>' +
                    '<div class="form-group col-md-6">' +
                        '<label for="feedback-form-semester">סמסטר</label>' +
                        '<select class="form-control" id="feedback-form-semester" required>' +
                        '</select>' +
                        '<div class="invalid-feedback">' +
                            'יש לבחור סמסטר' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="form-row">' +
                    '<div class="form-group col-md-12">' +
                        '<label for="feedback-form-text">חוות דעת</label>' +
                        '<textarea class="form-control" id="feedback-form-text" rows="12" required>' +
                            defaultText +
                        '</textarea>' +
                        '<div class="invalid-feedback">' +
                            'איכות חוות הדעת חשובה לנו, אנא הוסיפו פרטים על הקורס שיכולים לעזור לסטודנטים אחרים' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="form-row">' +
                    '<div class="form-group col-md-6">' +
                        '<label for="feedback-form-difficulty">עומס הקורס</label>' +
                        '<select class="form-control" id="feedback-form-difficulty" required>' +
                            '<option value="">לחצו לבחירה...</option>' +
                            '<option value="5">עמוס מאוד</option>' +
                            '<option value="4">עמוס</option>' +
                            '<option value="3">בינוני</option>' +
                            '<option value="2">טיפה עמוס</option>' +
                            '<option value="1">לא עמוס כלל</option>' +
                        '</select>' +
                        '<div class="invalid-feedback">' +
                            'יש לבחור אפשרות מתאימה' +
                        '</div>' +
                    '</div>' +
                    '<div class="form-group col-md-6">' +
                        '<label for="feedback-form-general">דירוג כללי</label>' +
                        '<select class="form-control" id="feedback-form-general" required>' +
                            '<option value="">לחצו לבחירה...</option>' +
                            '<option value="5">מומלץ מאוד</option>' +
                            '<option value="4">מומלץ</option>' +
                            '<option value="3">בינוני</option>' +
                            '<option value="2">פחות מומלץ</option>' +
                            '<option value="1">לא מומלץ כלל</option>' +
                        '</select>' +
                        '<div class="invalid-feedback">' +
                            'יש לבחור אפשרות מתאימה' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</form>';

        var messageElement = $('<div>').append(options.preHtml, formHtml, options.postHtml);

        var buttons = [{
            label: 'פרסם',
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
                        alert('Error writing document: ' + error);
                    });

                dialog.close();
            }
        }, {
            label: 'סגור',
            action: function (dialog) {
                dialog.close();
            }
        }];

        if (options.skipButton) {
            buttons.splice(1, 0, {
                label: 'דלג על הקורס',
                action: function (dialog) {
                    dialog.close();
                    options.onSubmit();
                }
            });
        }

        BootstrapDialog.show({
            title: 'פרסום חוות דעת',
            message: messageElement,
            buttons: buttons,
            onshow: function (dialog) {
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
                selectSemester.prepend($('<option value="">לחצו לבחירת סמסטר...</option>')).val(selectValue);

                try {
                    var displayName = localStorage.getItem('feedbackDisplayName');
                    if (!displayName) {
                        displayName = firebase.auth().currentUser.displayName;
                    }

                    if (displayName) {
                        body.find('#feedback-form-author').val(displayName);
                    }
                } catch (e) {
                    // Can fail if no auth module is loaded, or if not authenticated.
                }

                var validateFeedbackText = function () {
                    var templateParts = [
                        'שם המרצה:',
                        'חוות דעת - הרצאות:',
                        'שם המתרגל/ת:',
                        'חוות דעת - תרגולים:',
                        'שעורי הבית:',
                        'המבחן:',
                        'השורה התחתונה:'
                    ];

                    var value = this.value;
                    templateParts.forEach(function (templatePart) {
                        value = value.replace(templatePart, '');
                    });

                    var words = value.trim().split(/\s+/);

                    if (words.length <= 3) {
                        this.setCustomValidity('איכות חוות הדעת חשובה לנו, אנא הוסיפו פרטים על הקורס שיכולים לעזור לסטודנטים אחרים');
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
                    'טופס זה מאפשר לדווח על חוות דעת שמכילה תוכן לא ראוי.' +
                    '<br>' +
                    '<br>' +
                    'דוגמאות לתוכן לא ראוי:' +
                    '<ul>' +
                        '<li>שפה בוטה</li>' +
                        '<li>תוכן שאינו קשור לקורס (למשל: אמירות פוליטיות)</li>' +
                        '<li>התייחסות אישית ולא עניינית לאיש סגל (למשל: המרצה שונא את הסטודנטים ושמח לראות אותם נכשלים)</li>' +
                    '</ul>' +
                    'דוגמאות לתוכן שאינו תוכן לא ראוי:' +
                    '<ul>' +
                        '<li>ביקורת עניינית נוקבת (למשל: המרצה מבולגן וקשה לעקוב אחרי ההסברים שלו)</li>' +
                    '</ul>' +
                '</div>' +
                '<form>' +
                    '<div class="form-row">' +
                        '<div class="form-group col-md-6">' +
                            '<label for="report-form-email">כתובת דואר אלקטרוני</label>' +
                            '<input type="email" class="form-control" id="report-form-email" required>' +
                            '<div class="invalid-feedback">' +
                                'יש להזין כתובת דואר אלקטרוני חוקית' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="form-row">' +
                        '<div class="form-group col-md-12">' +
                            '<label for="report-form-reason">סיבת הדיווח</label>' +
                            '<textarea class="form-control" id="report-form-reason" rows="6" required>' +
                            '</textarea>' +
                            '<div class="invalid-feedback">' +
                                'יש להזין את סיבת הדיווח' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</form>' +
            '</div>';

        var buttons = [{
            label: 'דווח',
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
                        alert('Error writing document: ' + error);
                    });

                dialog.close();
            }
        }, {
            label: 'סגור',
            action: function (dialog) {
                dialog.close();
            }
        }];

        BootstrapDialog.show({
            title: 'דיווח על תוכן לא ראוי',
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
                    '<div class="course-rank-title">כללי</div>' +
                    '<div class="course-rank-icons">' +
                        '<i class="fas fa-2x fa-thumbs-down"></i>' +
                        makeStars(generalRank) +
                        '<i class="fas fa-2x fa-thumbs-up"></i>' +
                    '</div>' +
                '</div>' +
                '<div class="col-' + columnGrid + ' course-rank">' +
                    '<div class="course-rank-title">עומס</div>' +
                    '<div class="course-rank-icons">' +
                        '<i class="fas fa-2x fa-feather-alt"></i>' +
                        makeWeights(difficultyRank) +
                        '<i class="fas fa-2x fa-dumbbell"></i>' +
                    '</div>' +
                '</div>' +
            '</div>';
    }

    function makeFeedbackSummaryHtml(posts, columnGrid) {
        var content = $('<div id="course-feedback-summary"></div>');

        var title = 'חוות דעת';
        if (posts.length === 1) {
            title = 'חוות דעת אחת';
        } else if (posts.length > 1) {
            title = posts.length + ' חוות דעת';
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
        // Remove non-filled template parts.
        var templateParts = [
            'שם המרצה:',
            'חוות דעת - הרצאות:',
            'שם המתרגל/ת:',
            'חוות דעת - תרגולים:',
            'שעורי הבית:',
            'המבחן:',
            'השורה התחתונה:'
        ].filter(function (templatePart) {
            return text.indexOf(templatePart) !== -1;
        });

        for (var i = 0; i + 1 < templateParts.length; i++) {
            var t1 = templateParts[i];
            var t2 = templateParts[i + 1];
            var regex = new RegExp(t1 + '\\s*' + t2);
            text = text.replace(regex, t2);
        }

        var t1Last = templateParts[templateParts.length - 1];
        var regexLast = new RegExp(t1Last + '\\s*$');
        text = text.replace(regexLast, '');

        return text.trim();
    }

    function makeFeedbackSinglePostHtml(course, post, columnGrid) {
        var content = $('<div class="timeline-box"></div>');

        content.append($('<div>', {
            class: 'box-title',
            text: 'סמסטר ' + semesterFriendlyName(post.semester)
        }));

        var postText = preprocessPostText(post.text);

        var postContent = $('<div>', {
            class: 'box-content',
            html: $('<div>').text(postText).html().replace(/\n/g, '<br>')
        });

        if (post.generalRank && post.difficultyRank) {
            postContent.append(makeRanksHtml(post.generalRank, post.difficultyRank, columnGrid));
        }

        content.append(postContent);

        var prettyDate = new Date(post.timestamp).toLocaleDateString('he-IL', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        var flagButton = $('<a>', {
            href: '#'
        }).append($('<i>', {
            class: 'fas fa-flag',
            title: 'דיווח על תוכן לא ראוי',
            'data-toggle': 'tooltip'
        }).tooltip().click(function (event) {
            reportFeedbackDialog(course, post.timestamp, post.text, post.author, {
                onSubmit: function () {
                    BootstrapDialog.show({
                        title: 'הדיווח נשלח בהצלחה',
                        message: 'תודה על הדיווח! נטפל בו בהקדם האפשרי.',
                        size: BootstrapDialog.SIZE_SMALL
                    });
                }
            });
            return false;
        }));

        var footerBox = $('<div>', {
            class: 'box-footer'
        }).append($('<span>', {
            text: '- '
        }), $('<span>', {
            style: 'unicode-bidi: embed;', // prevent RTL mixing: https://stackoverflow.com/a/28257435
            text: post.author
        }), $('<span>', {
            text: ', ' + prettyDate
        }).append(' ', flagButton));

        content.append(footerBox);

        return content;
    }

    function makeFeedbackPostsHtml(course, posts, columnGrid) {
        var content = $('<div id="course-feedback-carousel" class="carousel slide carousel-fade" data-ride="carousel" data-interval="false">' +
                '<ol class="carousel-indicators"></ol>' +
                '<div class="carousel-inner"></div>' +
                '<a class="carousel-control-prev" href="#course-feedback-carousel" role="button" data-slide="prev">' +
                    '<span class="carousel-control-prev-icon" aria-hidden="true"></span>' +
                    '<span class="sr-only">Previous</span>' +
                '</a>' +
                '<a class="carousel-control-next" href="#course-feedback-carousel" role="button" data-slide="next">' +
                    '<span class="carousel-control-next-icon" aria-hidden="true"></span>' +
                    '<span class="sr-only">Next</span>' +
                '</a>' +
            '</div>');

        var carouselIndicators = content.find('.carousel-indicators');
        var carouselInner = content.find('.carousel-inner');

        posts.forEach(function (post, i) {
            var active = i === posts.length - 1;

            var indicator = '<li data-target="#course-feedback-carousel" data-slide-to="' + i + '"' + (active ? ' class="active"' : '') + '></li>';
            carouselIndicators.append(indicator);

            var carouselItemContents = $('<div class="carousel-item-contents"></div>')
                .append(makeFeedbackSinglePostHtml(course, post, columnGrid));

            var carouselItem = $('<div class="carousel-item' + (active ? ' active' : '') + '"></div>')
                .append(carouselItemContents);

            carouselInner.append(carouselItem);
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
                text: 'לא קיימות חוות דעת לקורס זה.'
            }));
        }

        var newFeedbackButton = $('<button type="button" class="btn btn-primary">פרסום חוות דעת</button>')
            .click(function (event) {
                newFeedbackDialog(course, {
                    onSubmit: function () {
                        courseFeedback.loadFeedback(course, false);
                    }
                });
            });

        content.append($('<div class="text-center"></div>').append(newFeedbackButton));

        element.html(content);
    }

    function semesterFriendlyName(semester) {
        var year = parseInt(semester.slice(0, 4), 10);
        var semesterCode = semester.slice(4);

        switch (semesterCode) {
        case '01':
            return 'חורף ' + year + '-' + (year + 1);

        case '02':
            return 'אביב ' + (year + 1);

        case '03':
            return 'קיץ ' + (year + 1);

        default:
            return semester;
        }
    }

    CourseFeedback.prototype.loadFeedback = function (course, loadingMessage) {
        var element = this.element;
        var that = this;

        if (loadingMessage === undefined || loadingMessage) {
            element.text('טוען נתונים...');
        }

        var onError = function () {
            element.text('טעינת הנתונים נכשלה. נסו שוב מאוחר יותר.');
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
                    text: courseTitle
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
