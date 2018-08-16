$(document).ready(function() {
    'use strict';

    var courses_hashmap = {};
    var courses_chosen = {};
    var color_hash = new ColorHash();
    var firestore_db = null;

    function semester_friendly_name(semester) {
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

    function get_course_schedule(course) {
        var general = courses_hashmap[course].general;
        var schedule = courses_hashmap[course].schedule;

        if (general.propertyIsEnumerable('הערות') && general['הערות'].length > 0) {
            // Extract sadnaot from course comments.
            var comment = general['הערות'];
            var comment_lines = comment.split('\n');
            for (var i = 0; i < comment_lines.length; i++) {
                var line = comment_lines[i];
                if (line.lastIndexOf('סדנאות', 0) === 0 || line.lastIndexOf('סדנת', 0) === 0) {
                    var sadnaot_ta = '';
                    match = /^מתרגל[ית]? הסדנ(?:א|ה|אות).*?:\s*(.*?)$/m.exec(comment);
                    if (match !== null) {
                        sadnaot_ta = match[1];
                    }

                    var sadnaot = [];
                    var sadna_id = 101;
                    var match;
                    for (i++; i < comment_lines.length; i++) {
                        line = comment_lines[i];
                        match = /^ימי ([א-ו])' (\d+)\.(\d+)-(\d+)\.(\d+)\s*,\s*(.*?) (\d+)(?:\s*,\s*(.*?))?$/.exec(line);
                        if (match === null) {
                            break;
                        }

                        var building = match[6];
                        switch (building) {
                            case 'פ\'':
                                building = 'פישבך';
                                break;

                            case 'מ\'':
                                building = 'מאייר';
                                break;
                        }

                        sadnaot.push({
                            'קבוצה': sadna_id,
                            'מס.': sadna_id,
                            'סוג': 'sadna',
                            'מרצה\/מתרגל': match[8] || sadnaot_ta,
                            'יום': match[1],
                            'שעה': match[2] + ':' + match[3] + ' - ' + match[4] + ':' + match[5],
                            'בניין': building,
                            'חדר': match[7]
                        });
                        sadna_id++;
                    }

                    if (sadnaot.length > 0) {
                        schedule = schedule.concat(sadnaot);
                    }

                    break;
                }
            }
        }

        return schedule;
    }

    function update_calendar_max_day_and_time(extra_courses) {
        var calendar = $('#calendar');
        var min_time = moment.utc('2017-01-01T08:30:00');
        var max_time = moment.utc('2017-01-01T18:30:00');
        var friday = false;

        Object.keys(courses_chosen).filter(function (course) {
            return courses_chosen[course];
        }).concat(extra_courses).forEach(function (course) {
            var schedule = get_course_schedule(course);
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

        if (general.propertyIsEnumerable('פקולטה') && general['פקולטה'].length > 0) {
            text += '\nפקולטה: ' + general['פקולטה'];
        }

        if (general.propertyIsEnumerable('נקודות') && general['נקודות'].length > 0) {
            var points = general['נקודות'];
            if (points.indexOf('.') < 0) {
                points += '.0';
            }
            text += '\nנקודות: ' + points;
        }

        if (general.propertyIsEnumerable('סילבוס') && general['סילבוס'].length > 0) {
            text += '\n\n' + general['סילבוס'];
        }

        if (general.propertyIsEnumerable('אחראים') && general['אחראים'].length > 0) {
            text += '\n\nאחראים: ' + general['אחראים'];
        }

        if ((general.propertyIsEnumerable('מועד א') && general['מועד א'].length > 0) ||
            (general.propertyIsEnumerable('מועד ב') && general['מועד ב'].length > 0)) {
            text += '\n';
            if (general.propertyIsEnumerable('מועד א') && general['מועד א'].length > 0) {
                text += '\nמועד א\': ' + general['מועד א'];
            }
            if (general.propertyIsEnumerable('מועד ב') && general['מועד ב'].length > 0) {
                text += '\nמועד ב\': ' + general['מועד ב'];
            }
        }

        if (general.propertyIsEnumerable('הערות') && general['הערות'].length > 0) {
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
            if (general.propertyIsEnumerable(moed_name)) {
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

        span_exam_list.empty();

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
            if (!available_options_per_type.propertyIsEnumerable(type)) {
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

    function my_update_events(calendar, events) {
        events = events.slice(); // make a copy
        events.forEach(function (value, index) {
            events[index] = $.extend({}, events[index]); // make a copy

            // Delete properties which are not shared among events with the same id.
            delete events[index].title;
            delete events[index].lessonData;
        });
        calendar.fullCalendar('updateEvents', events);
    }

    function my_update_event(calendar, event) {
        my_update_events(calendar, [event]);
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
        var schedule = get_course_schedule(course);
        if (schedule.length === 0) {
            return;
        }

        var calendar = $('#calendar');

        var lessons_added = {};
        var events = [];
        var conflicted_ids = {};

        for (var i = 0; i < schedule.length; i++) {
            var lesson = schedule[i];
            if (lessons_added.propertyIsEnumerable(lesson['מס.']) && lessons_added[lesson['מס.']] !== lesson['קבוצה']) {
                continue;
            }

            events.push(make_lesson_event(lesson));
            lessons_added[lesson['מס.']] = lesson['קבוצה'];
        }

        for (i = 0; i < events.length; i++) {
            if (conflicted_ids.propertyIsEnumerable(events[i].id)) {
                var weeks = conflicted_ids[events[i].id];
                events[i].start.add(7*weeks, 'days');
                events[i].end.add(7*weeks, 'days');
            }
        }

        calendar.fullCalendar('renderEvents', events);

        if (Object.keys(conflicted_ids).length > 0) {
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

            var event_id = course + '.' + lesson['מס.'] + '.' + lesson_type;

            var title = lesson['סוג'] + ' ' + lesson['מס.'];
            if (lesson['סוג'] === 'sadna') {
                title = 'סדנה';
            }
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

            // Mark conflicting events which cannot be selected.
            calendar.fullCalendar('clientEvents', function (cb_event) {
                if (cb_event.selected && are_events_overlapping(cb_event, event_start_end)) {
                    if (!conflicted_ids.propertyIsEnumerable(event_id)) {
                        conflicted_ids[event_id] = 0;
                    }
                    conflicted_ids[event_id]++;
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
        var conflicted_ids = {};

        var conflicted_events = calendar.fullCalendar('clientEvents', function (event) {
            if (event.courseNumber !== course && is_conflicted(event, course)) {
                if (!conflicted_ids.propertyIsEnumerable(event.id)) {
                    conflicted_ids[event.id] = 1;
                    return true;
                }
                conflicted_ids[event.id]++;
                return false;
            }

            return false;
        });

        var conflicted_courses = {};

        for (var i = 0; i < conflicted_events.length; i++) {
            var weeks = conflicted_ids[conflicted_events[i].id];
            conflicted_events[i].start.add(-7*weeks, 'days');
            conflicted_events[i].end.add(-7*weeks, 'days');
            conflicted_courses[conflicted_events[i].courseNumber] = true;
        }

        my_update_events(calendar, conflicted_events);
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
        my_update_event(calendar, event);

        var same_course_type_events = calendar.fullCalendar('clientEvents', function (cb_event) {
            if (cb_event.courseNumber === event.courseNumber &&
                get_event_lesson_type(cb_event) === get_event_lesson_type(event)) {

                if (cb_event.lessonData['מס.'] === event.lessonData['מס.']) {
                    // There might be multiple events for the same course, type, and number, process them all.
                    handle_conflicted_events(cb_event);
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

        my_update_events(calendar, same_course_type_events);

        Object.keys(conflicted_courses).forEach(function (conflicted_course) {
            update_course_conflicted_status(conflicted_course);
        });

        function handle_conflicted_events(event) {
            var conflicted_ids = {};

            var conflicted_events = calendar.fullCalendar('clientEvents', function (cb_event) {
                if (cb_event.courseNumber === event.courseNumber &&
                    get_event_lesson_type(cb_event) === get_event_lesson_type(event)) {
                    return false;
                }

                if (are_events_overlapping(cb_event, event)) {
                    if (!conflicted_ids.propertyIsEnumerable(cb_event.id)) {
                        conflicted_ids[cb_event.id] = 1;
                        return true;
                    }
                    conflicted_ids[cb_event.id]++;
                    return false;
                }

                return false;
            });

            for (var i = 0; i < conflicted_events.length; i++) {
                var weeks = conflicted_ids[conflicted_events[i].id];
                conflicted_events[i].start.add((selecting_event ? 7 : -7)*weeks, 'days');
                conflicted_events[i].end.add((selecting_event ? 7 : -7)*weeks, 'days');
                conflicted_courses[conflicted_events[i].courseNumber] = true;
            }

            my_update_events(calendar, conflicted_events);
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

    function save_as_ics() {
        var calendar = $('#calendar');
        var ics_cal = ics();

        var year_from = parseInt(current_semester.slice(0, 4), 10);
        var year_to = year_from + 2;

        var rrule = {'freq': 'WEEKLY', until: year_to + '-01-01T00:00:00'};

        var count = 0;

        calendar.fullCalendar('clientEvents', function (event) {
            if (event.start.week() === 1 && event.selected) {
                var general = courses_hashmap[event.courseNumber].general;
                var lesson = event.lessonData;

                var subject = lesson['סוג'] + ' ' + lesson['מס.'];
                if (lesson['סוג'] === 'sadna') {
                    subject = 'סדנה';
                }
                subject += ' - ' + general['שם מקצוע'];

                var description = '';
                if (lesson['מרצה/מתרגל'] !== '') {
                    description = lesson['מרצה/מתרגל'];
                }

                var location = '';
                if (lesson['בניין'] !== '') {
                    location = lesson['בניין'];
                    if (lesson['חדר'] !== '') {
                        location += ' ' + lesson['חדר'];
                    }
                }

                var begin = event.start.format();
                var end = event.end.format();

                ics_cal.addEvent(subject, description, location, begin, end, rrule);
                count++;
            }

            return false;
        });

        if (count > 0) {
            ics_cal.download(semester_friendly_name(current_semester));
        } else {
            alert('המערכת ריקה');
        }
    }

    function selected_course_save(course) {
        var semesterCoursesKey = current_semester + '_courses';
        var courseKey = current_semester + '_' + course;

        var doc = firestore_auth_user_doc();
        if (doc) {
            var input = {};
            input[semesterCoursesKey] = firebase.firestore.FieldValue.arrayUnion(course);
            input[courseKey] = {};
            doc.set(input, {merge: true});
        } else {
            var courses = JSON.parse(localStorage.getItem(semesterCoursesKey) || '[]');
            courses.push(course);
            localStorage.setItem(semesterCoursesKey, JSON.stringify(courses));
            localStorage.removeItem(courseKey);
        }
    }

    function selected_course_unsave(course) {
        var semesterCoursesKey = current_semester + '_courses';
        var courseKey = current_semester + '_' + course;

        var doc = firestore_auth_user_doc();
        if (doc) {
            var input = {};
            input[semesterCoursesKey] = firebase.firestore.FieldValue.arrayRemove(course);
            input[courseKey] = firebase.firestore.FieldValue.delete();
            doc.update(input);
        } else {
            var courses = JSON.parse(localStorage.getItem(semesterCoursesKey) || '[]');
            courses = courses.filter(function (item) {
                return item !== course;
            });
            localStorage.setItem(semesterCoursesKey, JSON.stringify(courses));
            localStorage.removeItem(courseKey);
        }
    }

    function selected_lesson_save(course, lesson_number, lesson_type) {
        var courseKey = current_semester + '_' + course;

        var doc = firestore_auth_user_doc();
        if (doc) {
            var input = {};
            input[courseKey + '.' + lesson_type] = lesson_number;
            doc.update(input);
        } else {
            var lessons = JSON.parse(localStorage.getItem(courseKey) || '{}');
            lessons[lesson_type] = lesson_number;
            localStorage.setItem(courseKey, JSON.stringify(lessons));
        }
    }

    function selected_lesson_unsave(course, lesson_number, lesson_type) {
        var courseKey = current_semester + '_' + course;

        var doc = firestore_auth_user_doc();
        if (doc) {
            var input = {};
            input[courseKey + '.' + lesson_type] = firebase.firestore.FieldValue.delete();
            doc.update(input);
        } else {
            var lessons = JSON.parse(localStorage.getItem(courseKey) || '{}');
            delete lessons[lesson_type];
            localStorage.setItem(courseKey, JSON.stringify(lessons));
        }
    }

    function load_saved_courses_and_lessons(on_loaded_func) {
        var semesterCoursesKey = current_semester + '_courses';

        var doc = firestore_auth_user_doc();
        if (doc) {
            doc.get().then(function (doc) {
                apply_saved(doc.exists ? doc.data() : {});
                on_loaded_func();
            }, function (error) {
                alert("Error loading data from server: " + error);
            });
        } else {
            var data = {};
            data[semesterCoursesKey] = JSON.parse(localStorage.getItem(semesterCoursesKey) || '[]');
            data[semesterCoursesKey].forEach(function (course) {
                var courseKey = current_semester + '_' + course;
                data[courseKey] = JSON.parse(localStorage.getItem(courseKey) || '{}');
            });
            apply_saved(data);
            on_loaded_func();
        }

        function apply_saved(data) {
            var courses = data[semesterCoursesKey] || [];

            courses.forEach(function (course) {
                if (!courses_chosen.propertyIsEnumerable(course) && courses_hashmap.propertyIsEnumerable(course)) {
                    courses_chosen[course] = true;
                    add_course_to_list_group(course);
                    add_course_to_calendar(course);

                    var courseKey = current_semester + '_' + course;

                    var lessons = data[courseKey] || {};
                    Object.keys(lessons).forEach(function (lesson_type) {
                        var lesson_number = lessons[lesson_type];
                        $('.calendar-item-course-' + course + '-type-' + lesson_type
                            + '.calendar-item-course-' + course + '-lesson-' + lesson_number).first().click();
                    });
                }
            });

            update_general_info_line();
            update_calendar_max_day_and_time([]);
            update_exam_info([]);
        }
    }

    function reload_saved_courses_and_lessons(on_loaded_func) {
        $('#course-button-list').empty();
        $('#calendar').fullCalendar('removeEvents', function (event) {
            return true;
        });
        courses_chosen = {};

        update_general_info_line();
        update_calendar_max_day_and_time([]);
        update_exam_info([]);

        load_saved_courses_and_lessons(on_loaded_func);
    }

    function firestore_auth_user_doc() {
        if (typeof firebase !== 'undefined' && firebase.auth().currentUser !== null) {
            return firestore_db.collection("users").doc(firebase.auth().currentUser.uid);
        }
        return null;
    }

    function firebase_init(after_init_func) {
        // Initialize Firebase.
        var config = {
            apiKey: "AIzaSyAfKPyTM83mkLgdQTdx9YS9UXywiswwIYI",
            authDomain: "cheesefork-de9af.firebaseapp.com",
            databaseURL: "https://cheesefork-de9af.firebaseio.com",
            projectId: "cheesefork-de9af",
            storageBucket: "cheesefork-de9af.appspot.com",
            messagingSenderId: "916559682433"
        };
        firebase.initializeApp(config);

        // Initialize Firestore.
        firestore_db = firebase.firestore();
        firestore_db.settings({timestampsInSnapshots: true}); // silence a warning

        // FirebaseUI config.
        var uiConfig = {
            // Opens IDP Providers sign-in flow in a popup.
            signInFlow: 'popup',
            signInOptions: [
                // Leave the lines as is for the providers you want to offer your users.
                firebase.auth.GoogleAuthProvider.PROVIDER_ID,
                firebase.auth.EmailAuthProvider.PROVIDER_ID
            ],
            callbacks: {
                // Called when the user has been successfully signed in.
                signInSuccessWithAuthResult: function (authResult) {
                    if (authResult.user) {
                        handleSignedInUser(authResult.user);
                    }
                    // Do not redirect.
                    return false;
                }
            },
            // Terms of service url.
            tosUrl: 'https://policies.google.com/terms',
            // Privacy policy url.
            privacyPolicyUrl: 'https://policies.google.com/privacy'
        };

        // Initialize the FirebaseUI Widget using Firebase.
        var firebaseUI = new firebaseui.auth.AuthUI(firebase.auth());
        // The start method will wait until the DOM is loaded.
        firebaseUI.start('#firebaseui-auth-container', uiConfig);

        var auth_initialized = false;

        // Listen to change in auth state so it displays the correct UI for when
        // the user is signed in or not.
        firebase.auth().onAuthStateChanged(function (user) {
            user ? handleSignedInUser(user) : handleSignedOutUser();
            if (!auth_initialized) {
                after_init_func();
                auth_initialized = true;
            } else if (user) {
                // Slow reload.
                $('#page-loader').show();
                reload_saved_courses_and_lessons(function () {
                    $('#page-loader').hide();
                });
            } else {
                // Fast reload.
                reload_saved_courses_and_lessons(function () {});
            }
        });

        document.getElementById('sign-out').addEventListener('click', function () {
            firebase.auth().signOut();
        });

        function handleSignedInUser(user) {
            document.getElementById('user-signed-in').style.display = 'block';
            document.getElementById('user-signed-out').style.display = 'none';
            document.getElementById('user-name').textContent = user.displayName;
        }

        function handleSignedOutUser() {
            document.getElementById('user-signed-in').style.display = 'none';
            document.getElementById('user-signed-out').style.display = 'block';
            firebaseUI.start('#firebaseui-auth-container', uiConfig);
        }
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    $('#select-semester').val(current_semester).change(function () {
        window.location = '?semester=' + this.value;
    });

    $('#save-as-ics').click(function () {
        save_as_ics();
    });

    available_semesters.forEach(function (semester) {
        $('#select-semester').append($('<option>', {
            value: semester,
            text: semester_friendly_name(semester)
        }));
    });

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
            if (!courses_chosen.propertyIsEnumerable(course)) {
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
            if (!courses_chosen.propertyIsEnumerable(course)) {
                add_course_to_calendar(course);
                update_calendar_max_day_and_time([course]);
                update_exam_info([course]);
                $('.exam-days-item-course-' + course).addClass('exam-days-item-same-course-as-hovered');
            }
            change_course_previewed_status(course, true);
        },
        onDropdownItemDeactivate: function (course) {
            if (!courses_chosen.propertyIsEnumerable(course)) {
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
        minTime: '08:30:00',
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
    }).fullCalendar('option', {
        // Set afterwards as a bug workaround.
        // https://github.com/fullcalendar/fullcalendar/issues/4102
        hiddenDays: [5, 6]
    });

    $('#footer-semester-name').text(semester_friendly_name(current_semester));
    $('#footer-semester').removeClass('d-none');

    $('#right-content-bar').removeClass('invisible');

    if (typeof firebase !== 'undefined') {
        firebase_init(function () {
            load_saved_courses_and_lessons(function () {
                $('#page-loader').hide();
            });
        });
    } else {
        document.getElementById('firebase-sign-in').style.display = 'none';
        load_saved_courses_and_lessons(function () {
            $('#page-loader').hide();
        });
    }
});
