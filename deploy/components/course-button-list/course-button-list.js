'use strict';

/* global HistogramBrowser, CourseFeedback, BootstrapDialog, showBootstrapDialogWithModelessButton, firebase, gtag */

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

    function showWhatsappGroupLink(course) {
        var whatsappGroupLink = null;

        var whatsappGroupDialog = BootstrapDialog.show({
            title: 'קבוצת וואטסאפ',
            message: '<div class="whatsapp-group-link-content">טוען נתונים...</div>',
            onshow: function (dialog) {
                dialog.getButton('open-link').disable();
                dialog.getButton('update-link').disable();
            },
            buttons: [{
                id: 'open-link',
                label: 'הצטרף לקבוצה',
                cssClass: 'btn-primary',
                action: function (dialog) {
                    var win = window.open(whatsappGroupLink, '_blank', 'noopener');
                    if (win) {
                        win.focus();
                    }
                }
            }, {
                id: 'update-link',
                label: 'עדכן קישור',
                action: function (dialog) {
                    var body = dialog.getModalBody();

                    var form = body.find('form').get(0);
                    if (form.checkValidity() === false) {
                        form.classList.add('was-validated');
                        return;
                    }
                    form.classList.remove('was-validated');

                    var button = dialog.getButton('update-link');
                    button.disable();

                    var url = body.find('.whatsapp-group-link').val();

                    firebase.firestore().collection('courseExtraDetails').doc(course)
                        .set({whatsappGroupLink: url}, {merge: true})
                        .then(function () {
                            whatsappGroupLink = url;
                            dialog.getButton('open-link').enable();
                        })
                        .catch(function (error) {
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
                    var url = null;
                    if (doc.exists) {
                        var data = doc.data();
                        url = data.whatsappGroupLink;
                    }

                    var text;
                    if (url && url.match(/^https:\/\/chat\.whatsapp\.com\//)) {
                        text = 'באפשרותכם להצטרף לקבוצה ובמידת הצורך לעדכן את הקישור.';
                        whatsappGroupLink = url;
                        whatsappGroupDialog.getButton('open-link').enable();
                    } else {
                        text = 'לא קיים קישור הצטרפות לקבוצת וואטסאפ עבור קורס זה. אם ידוע לכם הקישור העדכני, אנא הכניסו אותו ולחצו על כפתור העדכון.';
                    }

                    whatsappGroupDialog.getModalBody().find('.whatsapp-group-link-content').html([
                        $('<div>', {text: text}),
                        $('<form>', {
                            html: [
                                $('<input>', {
                                    type: 'text',
                                    value: url || '',
                                    class: 'form-control mt-2 whatsapp-group-link',
                                    placeholder: 'https://chat.whatsapp.com/...',
                                    style: 'direction: ltr;',
                                    pattern: 'https://chat\.whatsapp\.com/.+',
                                    required: true
                                }).on('input', function () {
                                    whatsappGroupDialog.getButton('update-link').enable();
                                }),
                                '<div class="invalid-feedback">' +
                                    'הקישור חייב להיות מהצורה: <span style="direction: ltr; unicode-bidi: embed;">https://chat.whatsapp.com/...</span>' +
                                '</div>'
                            ]
                        })
                    ]);
                })
                .catch(function (error) {
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
