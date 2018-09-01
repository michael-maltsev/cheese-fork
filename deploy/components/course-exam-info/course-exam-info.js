function CourseExamInfo(element, options) {
    this.element = element;
    this.courseManager = options.courseManager;
    this.colorGenerator = options.colorGenerator;
    this.onHoverIn = options.onHoverIn;
    this.onHoverOut = options.onHoverOut;
}

CourseExamInfo.prototype.renderCourses = function (courses, options) {
    var that = this;

    if (typeof options === 'undefined') {
        options = {};
    }

    var moedASpan = makeExamInfoSpan(1, courses, options);
    var moedBSpan = makeExamInfoSpan(2, courses, options);

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

    function makeExamInfoSpan(moed, courses, options) {
        var moedNames = ['מועד א', 'מועד ב'];
        var moedName = moedNames[moed - 1];
        var moedDates = {};

        courses.forEach(function (course) {
            var general = that.courseManager.getGeneralInfo(course);
            if (general[moedName]) {
                var match = /^בתאריך (\d+)\.(\d+)\.(\d+) (?:יום [א-ו] משעה (\d+)(:\d+)? עד השעה (\d+)(:\d+)?)?/.exec(general[moedName]);
                if (match !== null) {
                    var startHour = '00';
                    if (match[4] !== undefined) {
                        startHour = ('00' + match[4]).slice(-2);
                    }
                    var startMinute = '00';
                    if (match[5] !== undefined) {
                        startMinute = (match[5] + '00').slice(1, 3);
                    }
                    moedDates[course] = moment.utc(match[3] + '-' + match[2] + '-' + match[1] + 'T' + startHour + ':' + startMinute + ':00');
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
                spanExamList.append('<i class="exam-info-left-arrow"></i> ');
            }

            var daysText = $('<span class="exam-info-item exam-info-item-course-' + course + '"></span>');
            if (course === options.hovered) {
                daysText.addClass('exam-info-item-hovered');
            } else if (course === options.highlighted) {
                daysText.addClass('exam-info-item-highlighted');
            }
            var color = that.colorGenerator ? that.colorGenerator(course) : 'black';
            daysText.css('background-color', color);
            daysText.hover(
                function () {
                    $(this).addClass('exam-info-item-hovered');
                    that.onHoverIn && that.onHoverIn(course);
                }, function () {
                    $(this).removeClass('exam-info-item-hovered');
                    that.onHoverOut && that.onHoverOut(course);
                }
            );

            var date = moedDates[course].format('DD/MM');
            var dateWithTime = null;
            if (moedDates[course].hour() !== 0) {
                dateWithTime = moedDates[course].format('DD/MM HH:mm');
            }

            var tooltipText = null;
            if (i === 0) {
                daysText.text(date);
                if (dateWithTime) {
                    tooltipText = dateWithTime;
                }
            } else {
                var left = moedDates[moedCourses[i - 1]];
                var right = moedDates[course];
                var diff = right.diff(left, 'days');
                daysText.text(diff);
                if (diff === 0) {
                    daysText.addClass('exam-info-item-conflicted');
                }
                tooltipText = dateWithTime || date;
            }

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
    $('.exam-info-item-course-' + course).addClass('exam-info-item-hovered');
};

CourseExamInfo.prototype.removeHovered = function (course) {
    $('.exam-info-item-course-' + course).removeClass('exam-info-item-hovered');
};

CourseExamInfo.prototype.setHighlighted = function (course) {
    $('.exam-info-item-course-' + course).addClass('exam-info-item-highlighted');
};

CourseExamInfo.prototype.removeHighlighted = function (course) {
    $('.exam-info-item-course-' + course).removeClass('exam-info-item-highlighted');
};
