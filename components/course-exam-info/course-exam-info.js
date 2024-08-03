'use strict';

/* global moment */

function CourseExamInfo(element, options) {
    this.element = element;
    this.courseManager = options.courseManager;
    this.colorGenerator = options.colorGenerator;
    this.onHoverIn = options.onHoverIn;
    this.onHoverOut = options.onHoverOut;
}

CourseExamInfo.prototype.renderCourses = function (courses) {
    var that = this;

    // Make sure existing tooltips are disposed. Otherwise if there
    // are any visible tooltips, they'll stay hanging forever.
    that.element.find('[data-toggle="tooltip"]').tooltip('dispose');

    var moedASpan = makeExamInfoSpan(1, courses);
    var moedBSpan = makeExamInfoSpan(2, courses);

    if (!moedASpan && !moedBSpan) {
        that.element.empty();
    } else {
        that.element.html($('<div>').text('מספר ימי למידה למבחנים:'));

        if (moedASpan) {
            that.element.append($('<div>').addClass('exam-info-content').text('מועדי א\': ').append(moedASpan));
        }

        if (moedBSpan) {
            that.element.append($('<div>').addClass('exam-info-content').text('מועדי ב\': ').append(moedBSpan));
        }
    }

    function makeExamInfoSpan(moed, courses) {
        var moedNames = ['מועד א', 'מועד ב'];
        var moedName = moedNames[moed - 1];
        var moedDates = {};

        courses.forEach(function (course) {
            var general = that.courseManager.getGeneralInfo(course);
            if (general[moedName]) {
                var parsedDate = that.courseManager.parseExamDateTime(general[moedName]);
                if (parsedDate) {
                    moedDates[course] = moment.utc(parsedDate.start);
                }
            }
        });

        var moedCourses = Object.keys(moedDates);
        if (moedCourses.length === 0) {
            return false;
        }

        moedCourses.sort(function (leftCourse, rightCourse) {
            var left = moedDates[leftCourse];
            var right = moedDates[rightCourse];
            var diff = left.diff(right);
            return diff !== 0 ? diff : leftCourse - rightCourse;
        });

        var spanExamList = $('<span>');

        moedCourses.forEach(function (course, i) {
            if (i !== 0) {
                //spanExamList.append('🢀\u00AD');
                spanExamList.append('<span class="exam-info-left-arrow"></span> ');
            }

            var daysText = $('<span class="exam-info-item exam-info-item-course-' + course + '"></span>');
            var color = that.colorGenerator(course);
            daysText.css('background-color', color);
            daysText.hover(
                function () {
                    $(this).addClass('exam-info-item-hovered');
                    that.onHoverIn(course);
                }, function () {
                    $(this).removeClass('exam-info-item-hovered');
                    that.onHoverOut(course);
                }
            );

            var date = moedDates[course].format('DD/MM');
            var dateWithTime = null;
            if (moedDates[course].hour() !== 0) {
                dateWithTime = moedDates[course].format('DD/MM HH:mm');
            }

            var elementText;
            var tooltipText = null;
            if (i === 0) {
                elementText = date;
                if (dateWithTime) {
                    tooltipText = dateWithTime;
                }
            } else {
                var left = moedDates[moedCourses[i - 1]].clone().set({hour: 0, minute: 0, second: 0});
                var right = moedDates[course].clone().set({hour: 0, minute: 0, second: 0});
                var diff = right.diff(left, 'days');
                elementText = diff;
                if (diff === 0) {
                    daysText.addClass('exam-info-item-conflicted');
                }
                tooltipText = dateWithTime || date;
            }

            var spanAbsolute = $('<span class="content-absolute"></span>').text(elementText);
            var spanBoldHidden = $('<span class="content-bold-hidden"></span>').text(elementText);

            daysText.append(spanAbsolute, spanBoldHidden);

            if (tooltipText) {
                daysText
                    .prop('title', tooltipText)
                    .attr('data-toggle', 'tooltip')
                    .tooltip({
                        placement: (moed === 1 ? 'top' : 'bottom'),
                        template: '<div class="tooltip" role="tooltip"><div class="tooltip-inner"></div></div>'
                    });
            }

            spanExamList.append(daysText);
        });

        return spanExamList;
    }
};

CourseExamInfo.prototype.setHovered = function (course) {
    $('.exam-info-item-course-' + course, this.element).addClass('exam-info-item-hovered');
};

CourseExamInfo.prototype.removeHovered = function (course) {
    $('.exam-info-item-course-' + course, this.element).removeClass('exam-info-item-hovered');
};

CourseExamInfo.prototype.setHighlighted = function (course) {
    $('.exam-info-item-course-' + course, this.element).addClass('exam-info-item-highlighted');
};

CourseExamInfo.prototype.removeHighlighted = function (course) {
    $('.exam-info-item-course-' + course, this.element).removeClass('exam-info-item-highlighted');
};
