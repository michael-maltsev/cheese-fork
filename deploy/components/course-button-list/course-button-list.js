'use strict';

/* global BootstrapDialog, gtag */

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
    var spanAbsolute = $('<div class="content-wrapper">').html($('<span class="content-absolute">').text(courseTitle));
    var spanBoldHidden = $('<span class="content-bold-hidden">').text(courseTitle);

    var button = $('<li' +
        ' class="list-group-item active course-button-list-item course-button-list-item-course-' + course + '">' +
        '</li>');
    var badge = $('<span class="badge badge-pill badge-secondary float-right">i</span>');
    var color = that.colorGenerator(course);
    button.css({'background-color': color, 'border-color': color})
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
    var courseDescriptionHtmlWithLinks = that.courseManager.getDescription(course, {html: true, links: true});
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

        $(this).tooltip('hide');
        BootstrapDialog.show({
            title: courseTitle,
            message: $('<div>').html(courseDescriptionHtmlWithLinks)
        });
    }).prop('title', courseDescriptionHtml)
        .attr('data-toggle', 'tooltip')
        .tooltip({
            html: true,
            placement: 'right',
            template: '<div class="tooltip" role="tooltip"><div class="arrow"></div><div class="tooltip-inner course-description-tooltip-inner"></div></div>',
            trigger: 'hover'
        });
    that.element.append(button);

    function onCourseButtonClick(button, course) {
        if (button.hasClass('active')) {
            button.removeClass('active').removeClass('course-button-list-item-conflicted');
            button.css({'background-color': '', 'border-color': ''});
            that.onDisableCourse(course);
        } else {
            button.addClass('active');
            var color = that.colorGenerator(course);
            button.css({'background-color': color, 'border-color': color});
            that.onEnableCourse(course);
        }
    }
};

CourseButtonList.prototype.setHovered = function (course) {
    $('.course-button-list-item-course-' + course, this.element).addClass('course-button-list-item-hovered');
};

CourseButtonList.prototype.removeHovered = function (course) {
    $('.course-button-list-item-course-' + course, this.element).removeClass('course-button-list-item-hovered');
};

CourseButtonList.prototype.setConflicted = function (course) {
    $('.course-button-list-item-course-' + course, this.element).addClass('course-button-list-item-conflicted');
};

CourseButtonList.prototype.removeConflicted = function (course) {
    $('.course-button-list-item-course-' + course, this.element).removeClass('course-button-list-item-conflicted');
};

CourseButtonList.prototype.clear = function () {
    this.element.empty();
};
