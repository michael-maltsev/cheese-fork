$(document).ready(function() {
    'use strict';

    var courses_hashmap = {};
    var courses_chosen = {};
    var color_hash = new ColorHash();

    function rishum_time_parse(time) {
        var match = /^(\d+)(:\d+)? - (\d+)(:\d+)?$/.exec(time);
        var start_hour = ('00' + match[1]).slice(-2);
        var start_minute = '00';
        if (match[2] !== undefined) {
            start_minute = (match[2] + '00').slice(1, 3);
        }
        var start = start_hour + ':' + start_minute;

        var end_hour = ('00' + match[3]).slice(-2);
        var end_minute = '00';
        if (match[4] !== undefined) {
            end_minute = (match[4] + '00').slice(1, 3);
        }
        var end = end_hour + ':' + end_minute;

        return {'start': start, 'end': end};
    }

    function rishum_exam_date_parse(date) {
        var match = /^בתאריך (\d+)\.(\d+)\.(\d+) /.exec(date);
        if (match === null) {
            return null;
        }
        return moment.utc(match[3] + '-' + match[2] + '-' + match[1] + 'T00:00:00');
    }

    function get_lesson_type(course_number, lesson) {
        // Sport courses have a non-standard format, treat all of the lessons as the same type.
        if (/^394[89]\d\d$/.test(course_number)) {
            return 'sport';
        } else {
            return string_hex_encode(lesson['סוג']);
        }
    }

    function get_event_lesson_type(event) {
        return get_lesson_type(event.courseNumber, event.lessonData);
    }

    function update_calendar_max_day_and_time(extra_courses) {
        var calendar = $('#calendar');
        var min_time = moment.utc('2017-01-01T08:30:00');
        var max_time = moment.utc('2017-01-01T18:30:00');
        var friday = false;

        Object.keys(courses_chosen).filter(function (course) {
            return courses_chosen[course];
        }).concat(extra_courses).forEach(function (course) {
            var schedule = courses_hashmap[course].schedule;
            for (var i = 0; i < schedule.length; i++) {
                var lesson = schedule[i];
                var lesson_day = lesson['יום'].charCodeAt(0) - 'א'.charCodeAt(0) + 1;
                if (lesson_day === 6) {
                    friday = true;
                }

                var lesson_start_end = rishum_time_parse(lesson['שעה']);
                var event_start = moment.utc('2017-01-01T' + lesson_start_end['start'] + ':00');
                if (min_time.isAfter(event_start)) {
                    min_time = event_start;
                }

                var event_end = moment.utc('2017-01-01T' + lesson_start_end['end'] + ':00');
                if (max_time.isBefore(event_end)) {
                    max_time = event_end;
                }
            }
        });

        calendar.fullCalendar('option', {
            minTime: min_time.format('HH:mm:ss'),
            maxTime: max_time.format('HH:mm:ss'),
            hiddenDays: friday ? [6] : [5, 6]
        });
    }

    function get_course_description(course) {
        var general = courses_hashmap[course].general;
        var text = general['מספר מקצוע'] + ' - ' + general['שם מקצוע'];

        if ('פקולטה' in general && general['פקולטה'].length > 0) {
            text += '\nפקולטה: ' + general['פקולטה'];
        }

        if ('נקודות' in general && general['נקודות'].length > 0) {
            var points = general['נקודות'];
            if (points.indexOf('.') < 0) {
                points += '.0';
            }
            text += '\nנקודות: ' + points;
        }

        if ('סילבוס' in general && general['סילבוס'].length > 0) {
            text += '\n\n' + general['סילבוס'];
        }

        if ('אחראים' in general && general['אחראים'].length > 0) {
            text += '\n\nאחראים: ' + general['אחראים'];
        }

        if ((('מועד א' in general) && general['מועד א'].length > 0) ||
            (('מועד ב' in general) && general['מועד ב'].length > 0)) {
            text += '\n';
            if (('מועד א' in general) && general['מועד א'].length > 0) {
                text += '\nמועד א\': ' + general['מועד א'];
            }
            if (('מועד ב' in general) && general['מועד ב'].length > 0) {
                text += '\nמועד ב\': ' + general['מועד ב'];
            }
        }

        if ('הערות' in general && general['הערות'].length > 0) {
            text += '\n\nהערות: ' + general['הערות'];
        }

        return text;
    }

    function update_general_info_line() {
        var courses = 0;
        var points = 0;

        Object.keys(courses_chosen).filter(function (course) {
            return courses_chosen[course];
        }).forEach(function (course) {
            var general = courses_hashmap[course].general;
            courses++;
            points += parseFloat(general['נקודות']);
        });

        points = points.toFixed(1).replace(/\.0+$/, '');

        var text;
        if (courses > 0) {
            if (courses === 1) {
                text = 'מקצוע אחד';
            } else {
                text = courses + ' מקצועות';
            }

            text += ', ';
            if (points === '1') {
                text += 'נקודה אחת';
            } else {
                text += points + ' נקודות';
            }
        } else {
            text = 'לא נבחרו מקצועות';
        }

        $('#general-info').text(text);
    }

    function string_hex_encode(str) {
        var result = "";
        for (var i=0; i<str.length; i++) {
            var hex = str.charCodeAt(i).toString(16);
            result += ("000"+hex).slice(-4);
        }
        return result;
    }

    function update_moed_exam_info(moed, div_content, span_exam_list, extra_courses) {
        var moed_names = ['מועד א', 'מועד ב'];
        var moed_name = moed_names[moed - 1];
        var moed_dates = {};

        Object.keys(courses_chosen).filter(function (course) {
            return courses_chosen[course];
        }).concat(extra_courses).forEach(function (course) {
            var general = courses_hashmap[course].general;
            if (moed_name in general) {
                var date = rishum_exam_date_parse(general[moed_name]);
                if (date !== null) {
                    moed_dates[course] = date;
                }
            }
        });

        var moed_courses = Object.keys(moed_dates);
        if (moed_courses.length === 0) {
            div_content.hide();
            return false;
        }

        div_content.show();

        moed_courses.sort(function (left_course, right_course) {
            var left = moed_dates[left_course];
            var right = moed_dates[right_course];
            var diff = left.diff(right);
            return diff !== 0 ? diff : left_course - right_course;
        });

        span_exam_list.html('');

        moed_courses.forEach(function (course, i) {
            var days_text = $('<span class="exam-days-item exam-days-item-course-' + course + '"></span>');
            var color = color_hash.hex(course);
            days_text.css('background-color', color);
            days_text.hover(
                function() {
                    $(this).addClass('exam-days-item-same-course-as-hovered');
                    change_course_previewed_status(course, true);
                    $('.list-group-item-course-' + course).addClass('list-group-item-same-course-as-hovered');
                }, function() {
                    $(this).removeClass('exam-days-item-same-course-as-hovered');
                    change_course_previewed_status(course, false);
                    $('.list-group-item-course-' + course).removeClass('list-group-item-same-course-as-hovered');
                }
            );

            var date = moed_dates[course].format('DD/MM');

            if (i === 0) {
                days_text.text(date);
                span_exam_list.append(days_text);
            } else {
                days_text
                    .prop('title', date)
                    .attr('data-toggle', 'tooltip')
                    .tooltip({
                        placement: (moed === 1 ? 'top' : 'bottom'),
                        template: '<div class="tooltip" role="tooltip"><div class="tooltip-inner"></div></div>'
                    });
                var left = moed_dates[moed_courses[i - 1]];
                var right = moed_dates[course];
                var diff = right.diff(left, 'days');
                days_text.text(diff);
                if (diff === 0) {
                    days_text.addClass('exam-days-item-conflicted');
                }
                //span_exam_list.append('🢀\u00AD');
                span_exam_list.append('<i class="exam-days-left-arrow"></i> ');
                span_exam_list.append(days_text);
            }
        });

        return true;
    }

    function update_exam_info(extra_courses) {
        var moed_a_added = update_moed_exam_info(1, $('#exams-moed-a'), $('#exams-moed-a-list'), extra_courses);
        var moed_b_added = update_moed_exam_info(2, $('#exams-moed-b'), $('#exams-moed-b-list'), extra_courses);

        if (moed_a_added || moed_b_added) {
            $('#exam-info').removeClass('d-none');
        } else {
            $('#exam-info').addClass('d-none');
        }
    }

    function update_course_conflicted_status(course) {
        var calendar = $('#calendar');

        var available_options_per_type = {};

        calendar.fullCalendar('clientEvents', function (event) {
            if (event.courseNumber !== course) {
                return false;
            }

            var type = get_lesson_type(course, event.lessonData);
            if (!(type in available_options_per_type)) {
                available_options_per_type[type] = 0;
            }

            if (event.start.week() === 1) {
                available_options_per_type[type]++;
            }

            return false;
        });

        var conflicted = false;

        Object.keys(available_options_per_type).some(function (type) {
            if (available_options_per_type[type] === 0) {
                conflicted = true;
                return true;
            }
            return false;
        });

        if (conflicted) {
            $('.list-group-item-course-' + course).addClass('list-group-item-conflicted');
        } else {
            $('.list-group-item-course-' + course).removeClass('list-group-item-conflicted');
        }
    }

    function are_events_overlapping(event1, event2) {
        if (event1.start.day() !== event2.start.day()) {
            return false;
        }

        var start_time_1 = event1.start.clone().year(0).month(0).date(1);
        var end_time_1 = event1.end.clone().year(0).month(0).date(1);
        var start_time_2 = event2.start.clone().year(0).month(0).date(1);
        var end_time_2 = event2.end.clone().year(0).month(0).date(1);

        return start_time_1.isBefore(end_time_2) && end_time_1.isAfter(start_time_2);
    }

    function add_course_to_calendar(course) {
        var general = courses_hashmap[course].general;
        var schedule = courses_hashmap[course].schedule;
        if (schedule.length === 0) {
            return;
        }

        var calendar = $('#calendar');

        var lessons_added = {};
        var events = [];
        var has_conflicted = false;

        for (var i = 0; i < schedule.length; i++) {
            var lesson = schedule[i];
            if (lesson['מס.'] in lessons_added && (lessons_added[lesson['מס.']]) !== lesson['קבוצה']) {
                continue;
            }

            events.push(make_lesson_event(lesson));
            lessons_added[lesson['מס.']] = lesson['קבוצה'];
        }

        calendar.fullCalendar('renderEvents', events);

        if (has_conflicted) {
            update_course_conflicted_status(course);
        }

        function make_lesson_event(lesson) {
            var lesson_type = get_lesson_type(course, lesson);
            var lesson_day = lesson['יום'].charCodeAt(0) - 'א'.charCodeAt(0) + 1;
            var lesson_start_end = rishum_time_parse(lesson['שעה']);
            var event_start_end = {
                start: moment.utc('2017-01-0' + lesson_day + 'T' + lesson_start_end['start'] + ':00'),
                end: moment.utc('2017-01-0' + lesson_day + 'T' + lesson_start_end['end'] + ':00')
            };

            // Hopefully a unique id.
            var event_id = course
                + '.' + lesson['מס.']
                + '.' + lesson_type
                + '.' + lesson_day
                + '.' + lesson_start_end['start']
                + '.' + lesson_start_end['end'];

            var title = lesson['סוג'] + ' ' + lesson['מס.'];
            if (lesson['בניין'] !== '') {
                title += '\n' + lesson['בניין'];
                if (lesson['חדר'] !== '') {
                    title += ' ' + lesson['חדר'];
                }
            }
            if (lesson['מרצה/מתרגל'] !== '') {
                title += '\n' + lesson['מרצה/מתרגל'];
            }
            title += '\n' + general['שם מקצוע'];

            // Hide conflicting events which cannot be selected.
            calendar.fullCalendar('clientEvents', function (cb_event) {
                if (cb_event.selected && are_events_overlapping(cb_event, event_start_end)) {
                    event_start_end.start.add(7, 'days');
                    event_start_end.end.add(7, 'days');
                    has_conflicted = true;
                }
                return false;
            });

            return {
                id: event_id,
                title: title,
                start: event_start_end.start,
                end: event_start_end.end,
                backgroundColor: '#F8F9FA',
                textColor: 'black',
                borderColor: 'black',
                className: 'calendar-item-course-' + course
                    + ' calendar-item-course-' + course + '-type-' + lesson_type
                    + ' calendar-item-course-' + course + '-lesson-' + lesson['מס.'],
                courseNumber: course,
                lessonData: lesson,
                selected: false,
                temporary: false
            };
        }
    }

    function remove_course_from_calendar(course) {
        var calendar = $('#calendar');

        // Show conflicting events which can now be selected.
        var conflicted_events = calendar.fullCalendar('clientEvents', function (event) {
            return event.courseNumber !== course && is_conflicted(event, course);
        });

        var conflicted_courses = {};

        for (var i = 0; i < conflicted_events.length; i++) {
            conflicted_events[i].start.add(-7, 'days');
            conflicted_events[i].end.add(-7, 'days');
            conflicted_courses[conflicted_events[i].courseNumber] = true;
        }

        calendar.fullCalendar('updateEvents', conflicted_events);
        calendar.fullCalendar('removeEvents', function (event) {
            return event.courseNumber === course;
        });

        Object.keys(conflicted_courses).forEach(function (conflicted_course) {
            update_course_conflicted_status(conflicted_course);
        });

        // True if the event cannot be selected because of the given course.
        function is_conflicted(event, course) {
            var conflicting_event = calendar.fullCalendar('clientEvents', function (cb_event) {
                return cb_event.courseNumber === course && cb_event.selected && are_events_overlapping(cb_event, event);
            });

            return conflicting_event.length > 0;
        }
    }

    function change_course_previewed_status(course, previewed) {
        var calendar = $('#calendar');
        if (previewed) {
            var conflicted_events = calendar.fullCalendar('clientEvents', function (event) {
                return event.courseNumber === course && event.start.week() > 1;
            });

            var temporary_events = [];

            for (var i = 0; i < conflicted_events.length; i++) {
                var conf = conflicted_events[i];
                var temp = {
                    id: 'temp_' + conf.id,
                    title: conf.title,
                    start: conf.start.clone().week(1),
                    end: conf.end.clone().week(1),
                    backgroundColor: conf.backgroundColor,
                    textColor: conf.textColor,
                    borderColor: conf.borderColor,
                    className: conf.className,
                    courseNumber: conf.courseNumber,
                    lessonData: conf.lessonData,
                    selected: conf.selected,
                    temporary: true
                };

                temporary_events.push(temp);
            }

            calendar.fullCalendar('renderEvents', temporary_events);

            $('.calendar-item-course-' + course).addClass('calendar-item-previewed');
        } else {
            $('.calendar-item-course-' + course).removeClass('calendar-item-previewed');
            calendar.fullCalendar('removeEvents', function (event) {
                return event.temporary;
            });
        }
    }

    function on_event_click(event) {
        var calendar = $('#calendar');

        var selecting_event = !event.selected;
        var conflicted_courses = {};

        var same_course_type_events = calendar.fullCalendar('clientEvents', function (cb_event) {
            if (cb_event.courseNumber === event.courseNumber &&
                get_event_lesson_type(cb_event) === get_event_lesson_type(event)) {

                if (cb_event.lessonData['מס.'] === event.lessonData['מס.']) {
                    // There might be multiple events for the same course, type, and number, process them all.
                    apply_event_click_on_item(cb_event);
                    return false;
                } else {
                    return true;
                }
            }
            return false;
        });

        for (var i = 0; i < same_course_type_events.length; i++) {
            same_course_type_events[i].start.add(selecting_event ? 7 : -7, 'days');
            same_course_type_events[i].end.add(selecting_event ? 7 : -7, 'days');
        }

        calendar.fullCalendar('updateEvents', same_course_type_events);

        Object.keys(conflicted_courses).forEach(function (conflicted_course) {
            update_course_conflicted_status(conflicted_course);
        });

        function apply_event_click_on_item(event) {
            if (selecting_event) {
                selected_lesson_save(event.courseNumber, event.lessonData['מס.'], get_event_lesson_type(event));
                event.selected = true;
                event.backgroundColor = color_hash.hex(event.courseNumber);
                event.textColor = 'white';
                event.borderColor = 'white';
            } else {
                selected_lesson_unsave(event.courseNumber, event.lessonData['מס.'], get_event_lesson_type(event));
                event.selected = false;
                event.backgroundColor = '#F8F9FA';
                event.textColor = 'black';
                event.borderColor = 'black';
            }
            calendar.fullCalendar('updateEvent', event);

            var conflicted_events = calendar.fullCalendar('clientEvents', function (cb_event) {
                if (cb_event.courseNumber === event.courseNumber &&
                    get_event_lesson_type(cb_event) === get_event_lesson_type(event)) {
                    return false;
                }

                return are_events_overlapping(cb_event, event);
            });

            for (var i = 0; i < conflicted_events.length; i++) {
                conflicted_events[i].start.add(selecting_event ? 7 : -7, 'days');
                conflicted_events[i].end.add(selecting_event ? 7 : -7, 'days');
                conflicted_courses[conflicted_events[i].courseNumber] = true;
            }

            calendar.fullCalendar('updateEvents', conflicted_events);
        }
    }

    function on_event_mouseover(event) {
        $('.list-group-item-course-' + event.courseNumber).addClass('list-group-item-same-course-as-hovered');
        $('.exam-days-item-course-' + event.courseNumber).addClass('exam-days-item-same-course-as-hovered');
        $('.calendar-item-course-' + event.courseNumber).addClass('calendar-item-same-course-as-hovered');
        $('.calendar-item-course-' + event.courseNumber + '-type-' + get_event_lesson_type(event)).addClass('calendar-item-same-type-as-hovered');
    }

    function on_event_mouseout(event) {
        $('.list-group-item-course-' + event.courseNumber).removeClass('list-group-item-same-course-as-hovered');
        $('.exam-days-item-course-' + event.courseNumber).removeClass('exam-days-item-same-course-as-hovered');
        $('.calendar-item-course-' + event.courseNumber).removeClass('calendar-item-same-course-as-hovered');
        $('.calendar-item-course-' + event.courseNumber + '-type-' + get_event_lesson_type(event)).removeClass('calendar-item-same-type-as-hovered');
    }

    function after_event_render(event, element) {
        if (!event.selected) {
            var same_type = $('.calendar-item-course-' + event.courseNumber + '-type-' + get_event_lesson_type(event))
                .not('.calendar-item-course-' + event.courseNumber + '-lesson-' + event.lessonData['מס.']);
            if (same_type.length === 0) {
                element.addClass('calendar-item-last-choice');
            }
        }
    }

    function get_course_title(course) {
        var general = courses_hashmap[course].general;
        return general['מספר מקצוע'] + ' - ' + general['שם מקצוע'];
    }

    function on_course_button_click(button, course) {
        if (button.hasClass('active')) {
            remove_course_from_calendar(course);
            button.removeClass('active').removeClass('list-group-item-conflicted');
            button.css({ 'background-color': '', 'border-color': '' });
            selected_course_unsave(course);
            courses_chosen[course] = false;
            update_general_info_line();
            update_calendar_max_day_and_time([]);
            update_exam_info([]);
        } else {
            add_course_to_calendar(course);
            change_course_previewed_status(course, true);
            button.addClass('active');
            var color = color_hash.hex(course);
            button.css({ 'background-color': color, 'border-color': color });
            selected_course_save(course);
            courses_chosen[course] = true;
            update_general_info_line();
            update_calendar_max_day_and_time([]);
            update_exam_info([]);
        }
    }

    function add_course_to_list_group(course) {
        var button = $('<a href="#" type="button"'
            + ' class="list-group-item active list-group-item-course-' + course + '">'
            + '</a>');
        var badge = $('<span class="badge badge-pill badge-secondary float-right">i</span>');
        var color = color_hash.hex(course);
        button.css({ 'background-color': color, 'border-color': color }).click(function () {
                $(this).tooltip('disable');
                on_course_button_click($(this), course);
                return false;
            }).hover(
                function() {
                    $(this).addClass('list-group-item-same-course-as-hovered');
                    $('.exam-days-item-course-' + course).addClass('exam-days-item-same-course-as-hovered');
                    change_course_previewed_status(course, true);
                }, function() {
                    $(this).removeClass('list-group-item-same-course-as-hovered');
                    $('.exam-days-item-course-' + course).removeClass('exam-days-item-same-course-as-hovered');
                    change_course_previewed_status(course, false);
                    $(this).tooltip('enable');
                }
            ).text(get_course_title(course))
            .append(badge);
        var course_description_html = $('<div>').text(get_course_description(course)).html().replace(/\n/g, '<br>');
        badge.hover(
                function() {
                    $(this).removeClass('badge-secondary');
                    $(this).addClass('badge-primary');
                }, function() {
                    $(this).removeClass('badge-primary');
                    $(this).addClass('badge-secondary');
                }
            ).prop('title', course_description_html)
            .attr('data-toggle', 'tooltip')
            .tooltip({
                html: true,
                placement: 'right',
                template: '<div class="tooltip" role="tooltip"><div class="arrow"></div><div class="tooltip-inner course-description-tooltip-inner"></div></div>',
                trigger: 'hover'
            });
        $('#course-button-list').append(button);
    }

    function selected_course_save(course) {
        var courses = JSON.parse(localStorage.getItem('courses') || '[]');
        courses.push(course);
        localStorage.setItem('courses', JSON.stringify(courses));
        localStorage.removeItem(course);
    }

    function selected_course_unsave(course) {
        var courses = JSON.parse(localStorage.getItem('courses') || '[]');
        courses = courses.filter(function (item) {
            return item !== course;
        });
        localStorage.setItem('courses', JSON.stringify(courses));
        localStorage.removeItem(course);
    }

    function selected_lesson_save(course, lesson_number, lesson_type) {
        var lessons = JSON.parse(localStorage.getItem(course) || '{}');
        delete lessons[lesson_number]; // remove old format
        lessons[lesson_type] = lesson_number;
        localStorage.setItem(course, JSON.stringify(lessons));
    }

    function selected_lesson_unsave(course, lesson_number, lesson_type) {
        var lessons = JSON.parse(localStorage.getItem(course) || '{}');
        delete lessons[lesson_number]; // remove old format
        delete lessons[lesson_type];
        localStorage.setItem(course, JSON.stringify(lessons));
    }

    function load_saved_courses_and_lessons() {
        var courses = JSON.parse(localStorage.getItem('courses') || '[]');
        courses.forEach(function (course) {
            if (!(course in courses_chosen) && (course in courses_hashmap)) {
                courses_chosen[course] = true;
                add_course_to_list_group(course);
                add_course_to_calendar(course);

                var lessons = JSON.parse(localStorage.getItem(course) || '{}');
                Object.keys(lessons).forEach(function (lesson_type) {
                    var lesson_number = lessons[lesson_type];
                    if (lesson_number === true) {
                        // Old data, for compatibility reasons.
                        // lesson_type is actually the lesson number.
                        $('.calendar-item-course-' + course + '-lesson-' + lesson_type).first().click();
                    } else {
                        $('.calendar-item-course-' + course + '-type-' + lesson_type
                            + '.calendar-item-course-' + course + '-lesson-' + lesson_number).first().click();
                    }
                });
            }
        });

        update_general_info_line();
        update_calendar_max_day_and_time([]);
        update_exam_info([]);
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    courses_from_rishum.forEach(function (item) {
        var course_number = item.general['מספר מקצוע'];
        courses_hashmap[course_number] = item;
        $('#select-course').append($('<option>', {
            value: course_number,
            text: course_number + ' - ' + item.general['שם מקצוע']
        }));
    });

    $('#select-course').selectize({
        //searchConjunction: 'or',
        maxOptions: 200,
        onItemAdd: function (course) {
            if (!(course in courses_chosen)) {
                courses_chosen[course] = true;
                add_course_to_list_group(course);
                add_course_to_calendar(course);
                selected_course_save(course);
                update_general_info_line();
                update_calendar_max_day_and_time([]);
                update_exam_info([]);
            }
            this.clear();
        },
        onDropdownItemActivate: function (course) {
            if (!(course in courses_chosen)) {
                add_course_to_calendar(course);
                update_calendar_max_day_and_time([course]);
                update_exam_info([course]);
                $('.exam-days-item-course-' + course).addClass('exam-days-item-same-course-as-hovered');
            }
            change_course_previewed_status(course, true);
        },
        onDropdownItemDeactivate: function (course) {
            if (!(course in courses_chosen)) {
                remove_course_from_calendar(course);
                update_calendar_max_day_and_time([]);
                update_exam_info([]);
            } else {
                // Remove highlight
                change_course_previewed_status(course, false);
            }
        }
    });

    $('#calendar').fullCalendar({
        defaultDate: '2017-01-01',
        //editable: true,
        //eventLimit: true, // allow "more" link when too many events
        defaultView: 'agendaWeek',
        header: false,
        allDaySlot: false,
        minTime: '08:00:00',
        maxTime: '18:30:00',
        height: 'auto',
        contentHeight: 'auto',
        columnFormat: 'dddd',
        locale: 'he',
        slotEventOverlap: false,
        displayEventTime: false,
        eventClick: on_event_click,
        eventMouseover: on_event_mouseover,
        eventMouseout: on_event_mouseout,
        eventAfterRender: after_event_render
    });

    $('#right-content-bar').removeClass('invisible');
    load_saved_courses_and_lessons();
    $('#page-loader').hide();
});
