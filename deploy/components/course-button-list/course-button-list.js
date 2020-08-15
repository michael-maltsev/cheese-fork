'use strict';

/* global HistogramBrowser, CourseFeedback, BootstrapDialog, gtag */

function CourseButtonList(element, options) {
    this.element = element;
    this.courseManager = options.courseManager;
    this.colorGenerator = options.colorGenerator;
    this.readonly = options.readonly;
    this.onHoverIn = options.onHoverIn;
    this.onHoverOut = options.onHoverOut;
    this.onEnableCourse = options.onEnableCourse;
    this.onDisableCourse = options.onDisableCourse;
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
    var courseDescriptionHtmlWithLinks = that.courseManager.getDescription(course, {html: true, links: true, logging: true});
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
        BootstrapDialog.show({
            title: courseTitle,
            size: BootstrapDialog.SIZE_WIDE,
            message: $('<div>').html(courseDescriptionHtmlWithLinks + '<br><br>' +
                '<div class="course-feedback"></div>' +
                '<h3 class="text-center">היסטוגרמות</h3><div class="inline-histograms"></div>'
            ),
            onshow: function (dialog) {
                var courseFeedback = new CourseFeedback(dialog.getModalBody().find('.course-feedback'), {});
                courseFeedback.loadFeedback(course);

                var histogramBrowser = new HistogramBrowser(dialog.getModalBody().find('.inline-histograms'), {});
                histogramBrowser.loadHistograms(course);
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
        badge.tooltip('show');
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
