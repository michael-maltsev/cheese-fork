function CoursesExamInfo(element, options) {
    this.element = element;
    this.allCourses = options.allCourses;
    this.onHoverIn = options.onHoverIn;
    this.onHoverOut = options.onHoverOut;
    this.colorGenerator = options.colorGenerator;
}

CoursesExamInfo.prototype.renderCourses = function (courses, options) {
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

    function rishumExamDateParse(date) {
        var match = /^בתאריך (\d+)\.(\d+)\.(\d+) /.exec(date);
        if (match === null) {
            return null;
        }
        return match[3] + '-' + match[2] + '-' + match[1] + 'T00:00:00';
    }

    function makeExamInfoSpan(moed, courses, options) {
        var moedNames = ['מועד א', 'מועד ב'];
        var moedName = moedNames[moed - 1];
        var moedDates = {};

        courses.forEach(function (course) {
            var general = that.allCourses[course].general;
            if (general.propertyIsEnumerable(moedName) && general[moedName].length > 0) {
                var date = rishumExamDateParse(general[moedName]);
                if (date !== null) {
                    moedDates[course] = moment.utc(date);
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

            if (i === 0) {
                daysText.text(date);
                spanExamList.append(daysText);
            } else {
                daysText
                    .prop('title', date)
                    .attr('data-toggle', 'tooltip')
                    .tooltip({
                        placement: (moed === 1 ? 'top' : 'bottom'),
                        template: '<div class="tooltip" role="tooltip"><div class="tooltip-inner"></div></div>'
                    });
                var left = moedDates[moedCourses[i - 1]];
                var right = moedDates[course];
                var diff = right.diff(left, 'days');
                daysText.text(diff);
                if (diff === 0) {
                    daysText.addClass('exam-info-item-conflicted');
                }
                //spanExamList.append('🢀\u00AD');
                spanExamList.append('<i class="exam-info-left-arrow"></i> ');
                spanExamList.append(daysText);
            }
        });

        return spanExamList;
    }
};

CoursesExamInfo.prototype.setHovered = function (course) {
    $('.exam-info-item-course-' + course).addClass('exam-info-item-hovered');
};

CoursesExamInfo.prototype.removeHovered = function (course) {
    $('.exam-info-item-course-' + course).removeClass('exam-info-item-hovered');
};

CoursesExamInfo.prototype.setHighlighted = function (course) {
    $('.exam-info-item-course-' + course).addClass('exam-info-item-highlighted');
};

CoursesExamInfo.prototype.removeHighlighted = function (course) {
    $('.exam-info-item-course-' + course).removeClass('exam-info-item-highlighted');
};
