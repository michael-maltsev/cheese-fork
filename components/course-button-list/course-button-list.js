'use strict';

/* global HistogramBrowser, CourseFeedback, BootstrapDialog, showBootstrapDialogWithModelessButton, firebase, gtag */

// eslint-disable-next-line no-unused-vars
var CourseButtonList = (function () {
    function CourseButtonList(element, options) {
        this.element = element;
        this.courseManager = options.courseManager;
        this.colorGenerator = options.colorGenerator;
        this.readonly = options.readonly;
        this.onHoverIn = options.onHoverIn;
        this.onHoverOut = options.onHoverOut;
        this.onEnableCourse = options.onEnableCourse;
        this.onDisableCourse = options.onDisableCourse;

        var that = this;

        that.infoDialogs = [];
    }

    function makeWhatsappGroupLinkContent(data) {
        var result = $('<div>');

        var linksFound = 0;

        var whatsappLinks = [];
        var whatsappLinkKeys = [
            'whatsappGroupLink',
            'whatsappGroupLink2',
            'whatsappGroupLink3'
        ];

        whatsappLinkKeys.forEach(function (whatsappLinkKey) {
            var url = data[whatsappLinkKey];
            if (url && url.match(/^https:\/\/chat\.whatsapp\.com\//)) {
                whatsappLinks.push(url);
                linksFound++;
            }
        });

        whatsappLinks.forEach(function (url, i) {
            var linkText = 'קבוצת וואטסאפ';
            if (i > 0) {
                linkText += ' ' + (i + 1);
            }

            result.append($('<div>', {
                html: $('<a>', {
                    href: url,
                    target: '_blank',
                    rel: 'noopener',
                    onclick: 'gtag(\'event\', \'info-click-group-link-whatsapp\')',
                    text: linkText
                })
            }));
        });

        var url = data.telegramGroupLink;
        if (url && url.match(/^https:\/\/t\.me\/joinchat\//)) {
            linksFound++;
            result.append($('<div>', {
                html: $('<a>', {
                    href: url,
                    target: '_blank',
                    rel: 'noopener',
                    onclick: 'gtag(\'event\', \'info-click-group-link-telegram\')',
                    text: 'קבוצת טלגרם'
                })
            }));
        }

        if (linksFound > 1) {
            result.prepend('<div>באפשרותכם להצטרף לקבוצות בעזרת הלינקים הבאים:</div>');
        } else if (linksFound > 0) {
            result.prepend('<div>באפשרותכם להצטרף לקבוצה בעזרת הלינק הבא:</div>');
        } else {
            result.text('לא קיימים קישורי הצטרפות לקבוצת וואטסאפ/טלגרם עבור קורס זה. אם יש ברשותכם קישור עדכני, אנא לחצו על כפתור העדכון והזינו אותו.');
        }

        return result;
    }

    function makeWhatsappGroupLinkForm(data) {
        var result = $('<form>', {
            html: [
                $('<input>', {
                    type: 'text',
                    value: data.whatsappGroupLink || '',
                    class: 'form-control mt-2 whatsapp-group-link',
                    placeholder: 'https://chat.whatsapp.com/...',
                    style: 'direction: ltr;',
                    pattern: 'https://chat\\.whatsapp\\.com/.+'
                }),
                $('<input>', {
                    type: 'text',
                    value: data.whatsappGroupLink2 || '',
                    class: 'form-control mt-2 whatsapp-group-link2',
                    placeholder: 'https://chat.whatsapp.com/...',
                    style: 'direction: ltr;',
                    pattern: 'https://chat\\.whatsapp\\.com/.+'
                }),
                $('<input>', {
                    type: 'text',
                    value: data.whatsappGroupLink3 || '',
                    class: 'form-control mt-2 whatsapp-group-link3',
                    placeholder: 'https://chat.whatsapp.com/...',
                    style: 'direction: ltr;',
                    pattern: 'https://chat\\.whatsapp\\.com/.+'
                }),
                $('<input>', {
                    type: 'text',
                    value: data.telegramGroupLink || '',
                    class: 'form-control mt-2 telegram-group-link',
                    placeholder: 'https://t.me/joinchat/...',
                    style: 'direction: ltr;',
                    pattern: 'https://t\\.me/joinchat/.+'
                }),
                '<div class="invalid-feedback">' +
                    '<div>קישורים לקבוצות וואטסאפ חייבים להיות מהצורה: <span style="direction: ltr; unicode-bidi: embed;">https://chat.whatsapp.com/...</span></div>' +
                    '<div>קישורים לקבוצות טלגרם חייבים להיות מהצורה: <span style="direction: ltr; unicode-bidi: embed;">https://t.me/joinchat/...</span></div>' +
                '</div>'
            ]
        });

        return result;
    }

    function showWhatsappGroupLink(course) {
        var groupLinksData = {};

        var whatsappGroupDialog = BootstrapDialog.show({
            title: 'קבוצת וואטסאפ/טלגרם',
            message: '<div class="whatsapp-group-link-content">טוען נתונים...</div>',
            onshow: function (dialog) {
                dialog.getButton('update-link').disable();
            },
            buttons: [{
                id: 'update-link',
                label: 'עדכן קישורים',
                action: function (dialog) {
                    var content = dialog.getModalBody().find('.whatsapp-group-link-content');

                    var form = content.find('form').get(0);
                    if (!form) {
                        content.html(makeWhatsappGroupLinkForm(groupLinksData));
                        content.find('form input:first').focus();
                        return;
                    }

                    if (form.checkValidity() === false) {
                        form.classList.add('was-validated');
                        return;
                    }
                    form.classList.remove('was-validated');

                    var button = dialog.getButton('update-link');
                    button.disable();

                    var newGroupLinksData = {};
                    var newGroupLinksDataWithDelete = {};
                    var newGroupLinksDataSelectors = {
                        whatsappGroupLink: '.whatsapp-group-link',
                        whatsappGroupLink2: '.whatsapp-group-link2',
                        whatsappGroupLink3: '.whatsapp-group-link3',
                        telegramGroupLink: '.telegram-group-link'
                    };

                    Object.keys(newGroupLinksDataSelectors).forEach(function (key) {
                        var selector = newGroupLinksDataSelectors[key];
                        var url = content.find(selector).val()
                            .trim().replace(/[?&]fbclid=[a-zA-Z0-9_-]+$/, '');

                        if (url !== '') {
                            newGroupLinksData[key] = url;
                            newGroupLinksDataWithDelete[key] = url;
                        } else {
                            newGroupLinksDataWithDelete[key] = firebase.firestore.FieldValue.delete();
                        }
                    });

                    firebase.firestore().collection('courseExtraDetails').doc(course)
                        .set(newGroupLinksDataWithDelete, { merge: true })
                        .then(function () {
                            groupLinksData = newGroupLinksData;
                            content.html(makeWhatsappGroupLinkContent(groupLinksData));
                            button.enable();
                        }, function (error) {
                            button.enable();
                            alert('Error writing document: ' + error);
                        });
                }
            }, {
                label: 'סגור',
                action: function (dialog) {
                    dialog.close();
                }
            }]
        });

        var onError = function () {
            whatsappGroupDialog.getModalBody().find('.whatsapp-group-link-content')
                .text('טעינת הנתונים נכשלה. נסו שוב מאוחר יותר.');
        };

        if (typeof firebase !== 'undefined') {
            firebase.firestore().collection('courseExtraDetails').doc(course).get()
                .then(function (doc) {
                    if (doc.exists) {
                        groupLinksData = doc.data();
                    }

                    whatsappGroupDialog.getModalBody().find('.whatsapp-group-link-content')
                        .html(makeWhatsappGroupLinkContent(groupLinksData));

                    whatsappGroupDialog.getButton('update-link').enable();
                }, function (error) {
                    onError();
                });
        } else {
            onError();
        }
    }

    CourseButtonList.prototype.addCourse = function (course) {
        var that = this;

        var courseTitle = that.courseManager.getTitle(course);

        // A wrapper div for proper word wrapping of the content text.
        var spanAbsolute = $('<div class="content-wrapper"></div>').html($('<span class="content-absolute"></span>').text(courseTitle));
        var spanBoldHidden = $('<span class="content-bold-hidden"></span>').text(courseTitle);

        var button = $('<li' +
            ' class="list-group-item active course-button-list-item"' +
            ' data-course-number="' + course + '">' +
            '</li>');
        var badge = $('<span class="badge badge-secondary float-right">' +
            '<span class="course-button-list-badge-text">i</span>' +
            '</span>');
        var color = that.colorGenerator(course);
        button.css('background-color', color)
            .click(function () {
                if (!that.readonly) {
                    onCourseButtonClick($(this), course);
                }
            })
            .hover(function () {
                $(this).addClass('course-button-list-item-hovered');
                that.onHoverIn(course);
            },
            function () {
                $(this).removeClass('course-button-list-item-hovered');
                that.onHoverOut(course);
            })
            .append(spanAbsolute, spanBoldHidden, badge);

        // Add tooltip to badge.
        var courseDescriptionHtml = that.courseManager.getDescription(course, {html: true});
        badge.hover(
            function () {
                $(this).removeClass('badge-secondary');
                $(this).addClass('badge-primary');
            }, function () {
                $(this).removeClass('badge-primary');
                $(this).addClass('badge-secondary');
            }
        ).click(function (e) {
            e.stopPropagation(); // don't execute parent button onclick

            gtag('event', 'course-button-list-info-click');

            var firstTimeTooltipBadge = that.element.find('[data-special-tooltip="first-time"]');
            if (firstTimeTooltipBadge.length > 0) {
                firstTimeTooltipBadge.tooltip('dispose');
                addTooltipToBadge(firstTimeTooltipBadge, courseDescriptionHtml, false);
                try {
                    localStorage.setItem('dontShowHistogramsTip', Date.now().toString());
                } catch (e) {
                    // localStorage is not available in IE/Edge when running from a local file.
                }
            }

            $(this).tooltip('hide');
            showBootstrapDialogWithModelessButton('course-info', {
                title: courseTitle,
                size: BootstrapDialog.SIZE_WIDE,
                message: '<div class="course-information"></div><br><br>' +
                    '<div class="course-feedback"></div>' +
                    '<h3 class="text-center">היסטוגרמות</h3><div class="inline-histograms"></div>',
                onshow: function (dialog) {
                    that.infoDialogs.push(dialog);

                    setInfoDialogContent(dialog, course, that.courseManager);
                },
                onhidden: function (dialog) {
                    var index = that.infoDialogs.indexOf(dialog);
                    if (index !== -1) {
                        that.infoDialogs.splice(index, 1);
                    }
                }
            });
        });

        var showFirstTimeTooltip = false;
        if (that.element.find('li.list-group-item:first').length === 0) {
            try {
                showFirstTimeTooltip = !localStorage.getItem('dontShowHistogramsTip');
            } catch (e) {
                // localStorage is not available in IE/Edge when running from a local file.
            }
        }

        var tooltipHtml = courseDescriptionHtml;
        if (showFirstTimeTooltip) {
            tooltipHtml = 'לחצו כאן להצגת היסטוגרמות וחוות דעת על הקורס';
        }

        addTooltipToBadge(badge, tooltipHtml, showFirstTimeTooltip);

        that.element.append(button);

        if (showFirstTimeTooltip) {
            // Without setTimeout, if the list is hidden, the tooltip won't
            // scroll with the list once the list is shown.
            setTimeout(function () {
                badge.tooltip('show');
            }, 0);
        }

        function addTooltipToBadge(badge, tooltipHtml, firstTimeTooltip) {
            var trigger = 'hover';
            var extraClass = '';
            var extraClassInner = '';
            if (firstTimeTooltip) {
                trigger = 'manual';
                extraClass = ' course-button-list-tooltip-persistent';
                badge.attr('data-special-tooltip', 'first-time');
            } else {
                extraClassInner = ' course-description-tooltip-inner';
                badge.removeAttr('data-special-tooltip');
            }

            badge.prop('title', tooltipHtml)
                .attr('data-toggle', 'tooltip')
                .tooltip({
                    html: true,
                    placement: 'right',
                    template: '<div class="tooltip' + extraClass + '" role="tooltip"><div class="arrow arrow-fix-placement"></div><div class="tooltip-inner' + extraClassInner + '"></div></div>',
                    trigger: trigger
                });
        }

        function onCourseButtonClick(button, course) {
            if (button.hasClass('active')) {
                button.removeClass('active').removeClass('course-button-list-item-conflicted');
                button.find('.content-absolute').removeClass('course-button-list-content-has-hidden')
                    .tooltip('dispose');
                button.css('background-color', '');
                that.onDisableCourse(course);
            } else {
                button.addClass('active');
                var color = that.colorGenerator(course);
                button.css('background-color', color);
                that.onEnableCourse(course);
            }
        }
    };

    function setInfoDialogContent(dialog, course, courseManager) {
        var modalBody = dialog.getModalBody();

        var courseDescriptionHtmlWithLinks = courseManager.getDescription(course, {
            html: true,
            relatedCourseInfo: true,
            links: true,
            whatsappGroupLink: true,
            logging: true
        });

        var courseInfo = $('<div>', {
            html: courseDescriptionHtmlWithLinks
        });

        courseInfo.find('.whatsapp-group-link').click(function () {
            showWhatsappGroupLink(course);
            return false;
        });

        // Put links on course numbers.
        // Replace only text inside element: https://stackoverflow.com/a/11867485
        courseInfo.contents().filter(function () {
            return this.nodeType === Node.TEXT_NODE;
        }).each(function () {
            var replaced = false;
            var html = $('<div>').text(this.textContent).html().replace(/\b\d{6}\b/g, function (match) {
                if (match === course) {
                    return match;
                }

                var tooltipTitle;
                if (courseManager.doesExist(match)) {
                    tooltipTitle = courseManager.getTitle(match);
                } else {
                    tooltipTitle = '(לא מועבר בסמסטר)';
                }

                replaced = true;
                return $('<a>', {
                    href: 'https://students.technion.ac.il/local/technionsearch/course/' + match,
                    target: '_blank',
                    rel: 'noopener',
                    onclick: 'gtag(\'event\', \'info-click-dependency-link-rishum\')',
                    title: tooltipTitle,
                    'data-toggle': 'tooltip',
                    'data-trigger': 'hover',
                    text: match
                })[0].outerHTML;
            });

            if (replaced) {
                var newElement = $('<span>', { html: html });
                newElement.find('[data-toggle="tooltip"]').tooltip();
                $(this).replaceWith(newElement);
            }
        });

        modalBody.find('.course-information').html(courseInfo);

        var courseFeedback = new CourseFeedback(modalBody.find('.course-feedback'), {});
        courseFeedback.loadFeedback(course);

        var histogramBrowser = new HistogramBrowser(modalBody.find('.inline-histograms'), {});
        histogramBrowser.loadHistograms(course);
    }

    CourseButtonList.prototype.setFloatingCourseInfo = function (course) {
        var that = this;

        if (that.infoDialogs.length === 0) {
            return;
        }

        var dialog = that.infoDialogs[that.infoDialogs.length - 1];

        var courseTitle = that.courseManager.getTitle(course);
        if (dialog.getTitle() === courseTitle) {
            return; // already showing this course
        }

        dialog.setTitle(courseTitle);

        setInfoDialogContent(dialog, course, that.courseManager);
    };

    CourseButtonList.prototype.setHovered = function (course) {
        var selector = 'li.list-group-item[data-course-number="' + course + '"]';
        this.element.find(selector).addClass('course-button-list-item-hovered');
    };

    CourseButtonList.prototype.removeHovered = function (course) {
        var selector = 'li.list-group-item[data-course-number="' + course + '"]';
        this.element.find(selector).removeClass('course-button-list-item-hovered');
    };

    CourseButtonList.prototype.setConflicted = function (course) {
        var selector = 'li.list-group-item[data-course-number="' + course + '"]';
        this.element.find(selector).addClass('course-button-list-item-conflicted');
    };

    CourseButtonList.prototype.removeConflicted = function (course) {
        var selector = 'li.list-group-item[data-course-number="' + course + '"]';
        this.element.find(selector).removeClass('course-button-list-item-conflicted');
    };

    CourseButtonList.prototype.setLessonTypesHidden = function (course, lessonTypesHidden) {
        var selector = 'li.list-group-item[data-course-number="' + course + '"] .content-absolute';
        var listGroupTextItem = this.element.find(selector);

        if (lessonTypesHidden.length > 0) {
            var title = 'אירועים מהסוגים הבאים הוסתרו מהמערכת:\n' + lessonTypesHidden.sort().join(', ');
            var titleHtml = $('<div>').text(title).html().replace(/\n/g, '<br>');

            listGroupTextItem.addClass('course-button-list-content-has-hidden')
                .tooltip('dispose')
                .prop('title', titleHtml)
                .attr('data-toggle', 'tooltip')
                .tooltip({
                    html: true,
                    placement: 'bottom'
                });
        } else {
            listGroupTextItem.removeClass('course-button-list-content-has-hidden')
                .tooltip('dispose');
        }
    };

    CourseButtonList.prototype.isCourseInList = function (course) {
        var selector = 'li.list-group-item[data-course-number="' + course + '"]';
        return this.element.find(selector).length > 0;
    };

    CourseButtonList.prototype.getCourseNumbers = function (onlySelected) {
        var that = this;

        var selector = 'li.list-group-item';
        if (onlySelected) {
            selector += '.active';
        }

        var courseNumbers = [];
        that.element.find(selector).each(function () {
            var course = $(this).attr('data-course-number');
            courseNumbers.push(course);
        });

        return courseNumbers;
    };

    CourseButtonList.prototype.clear = function () {
        this.element.find('[data-toggle="tooltip"]').tooltip('hide');
        this.element.empty();
    };

    return CourseButtonList;
})();
