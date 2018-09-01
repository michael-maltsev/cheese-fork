$(document).ready(function () {
    'use strict';

    var courseManager = new CourseManager(courses_from_rishum);
    var coursesChosen = {};
    var colorHash = new ColorHash();
    var firestoreDb = null;
    var coursesExamInfo = null;

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

    function rishumTimeParse(time) {
        var match = /^(\d+)(:\d+)? - (\d+)(:\d+)?$/.exec(time);
        var startHour = ('00' + match[1]).slice(-2);
        var startMinute = '00';
        if (match[2] !== undefined) {
            startMinute = (match[2] + '00').slice(1, 3);
        }
        var start = startHour + ':' + startMinute;

        var endHour = ('00' + match[3]).slice(-2);
        var endMinute = '00';
        if (match[4] !== undefined) {
            endMinute = (match[4] + '00').slice(1, 3);
        }
        var end = endHour + ':' + endMinute;

        return { start: start, end: end };
    }

    function getLessonType(courseNumber, lesson) {
        // Sport courses have a non-standard format, treat all of the lessons as the same type.
        if (/^394[89]\d\d$/.test(courseNumber)) {
            return 'sport';
        } else {
            return stringHexEncode(lesson['סוג']);
        }
    }

    function getEventLessonType(event) {
        return getLessonType(event.courseNumber, event.lessonData);
    }

    function updateCalendarMaxDayAndTime() {
        var calendar = $('#calendar');
        var minTime = calendar.fullCalendar('getCalendar').moment('2017-01-01T08:30:00');
        var maxTime = calendar.fullCalendar('getCalendar').moment('2017-01-01T18:30:00');
        var friday = false;

        calendar.fullCalendar('clientEvents', function (event) {
            if (event.start.week() === 1) {
                if (event.start.day() === 5) {
                    friday = true;
                }

                var start = event.start.clone().day(0);
                var end = event.end.clone().day(0);

                // Fix-up for 24:00 which is treated as 00:00 of the next day.
                if (end.hour() === 0 && end.minute() === 0) {
                    end.hour(24);
                }

                if (minTime.isAfter(start)) {
                    minTime = start;
                }

                if (maxTime.isBefore(end)) {
                    maxTime = end;
                }
            }

            return false;
        });

        minTime = minTime.format('kk:mm:ss');
        maxTime = maxTime.format('kk:mm:ss');
        var hiddenDays = friday ? [6] : [5, 6];

        // Only apply options that changed, avoids re-rendering if not needed, which is very slow.
        var newOptions = {};

        if (minTime !== calendar.fullCalendar('option', 'minTime')) {
            newOptions['minTime'] = minTime;
        }

        if (maxTime !== calendar.fullCalendar('option', 'maxTime')) {
            newOptions['maxTime'] = maxTime;
        }

        if (JSON.stringify(hiddenDays) !== JSON.stringify(calendar.fullCalendar('option', 'hiddenDays'))) {
            newOptions['hiddenDays'] = hiddenDays;
        }

        if (Object.keys(newOptions).length > 0) {
            calendar.fullCalendar('option', newOptions);
        }
    }

    function updateGeneralInfoLine() {
        var courses = 0;
        var points = 0;

        Object.keys(coursesChosen).filter(function (course) {
            return coursesChosen[course];
        }).forEach(function (course) {
            var general = courseManager.getGeneralInfo(course);
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

    function stringHexEncode(str) {
        var result = '';
        for (var i=0; i<str.length; i++) {
            var hex = str.charCodeAt(i).toString(16);
            result += ('000'+hex).slice(-4);
        }
        return result;
    }

    function updateExamInfo(extraCourses) {
        var courses = Object.keys(coursesChosen).filter(function (course) {
            return coursesChosen[course];
        }).concat(extraCourses);

        coursesExamInfo.renderCourses(courses);
    }

    function updateCourseConflictedStatus(course) {
        var calendar = $('#calendar');

        var availableOptionsPerType = {};

        calendar.fullCalendar('clientEvents', function (event) {
            if (event.courseNumber !== course) {
                return false;
            }

            var type = getLessonType(course, event.lessonData);
            if (!availableOptionsPerType.propertyIsEnumerable(type)) {
                availableOptionsPerType[type] = 0;
            }

            if (event.start.week() === 1) {
                availableOptionsPerType[type]++;
            }

            return false;
        });

        var conflicted = false;

        Object.keys(availableOptionsPerType).some(function (type) {
            if (availableOptionsPerType[type] === 0) {
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

    function myUpdateEvents(calendar, events) {
        events = events.slice(); // make a copy
        events.forEach(function (value, index) {
            events[index] = $.extend({}, events[index]); // make a copy

            // Delete properties which are not shared among events with the same id.
            delete events[index].title;
            delete events[index].lessonData;
        });
        calendar.fullCalendar('updateEvents', events);
    }

    function myUpdateEvent(calendar, event) {
        myUpdateEvents(calendar, [event]);
    }

    function areEventsOverlapping(event1, event2) {
        if (event1.start.day() !== event2.start.day()) {
            return false;
        }

        var startTime1 = event1.start.clone().year(0).month(0).date(1);
        var endTime1 = event1.end.clone().year(0).month(0).date(1);
        var startTime2 = event2.start.clone().year(0).month(0).date(1);
        var endTime2 = event2.end.clone().year(0).month(0).date(1);

        return startTime1.isBefore(endTime2) && endTime1.isAfter(startTime2);
    }

    function addCourseToCalendar(course) {
        var general = courseManager.getGeneralInfo(course);
        var schedule = courseManager.getSchedule(course);
        if (schedule.length === 0) {
            return;
        }

        var calendar = $('#calendar');

        var lessonsAdded = {};
        var events = [];
        var conflictedIds = {};

        for (var i = 0; i < schedule.length; i++) {
            var lesson = schedule[i];
            if (lessonsAdded.propertyIsEnumerable(lesson['מס.']) && lessonsAdded[lesson['מס.']] !== lesson['קבוצה']) {
                continue;
            }

            events.push(makeLessonEvent(lesson));
            lessonsAdded[lesson['מס.']] = lesson['קבוצה'];
        }

        for (i = 0; i < events.length; i++) {
            if (conflictedIds.propertyIsEnumerable(events[i].id)) {
                var weeks = conflictedIds[events[i].id];
                events[i].start.add(7*weeks, 'days');
                events[i].end.add(7*weeks, 'days');
            }
        }

        calendar.fullCalendar('renderEvents', events);

        if (Object.keys(conflictedIds).length > 0) {
            updateCourseConflictedStatus(course);
        }

        function makeLessonEvent(lesson) {
            var lessonType = getLessonType(course, lesson);
            var lessonDay = lesson['יום'].charCodeAt(0) - 'א'.charCodeAt(0) + 1;
            var lessonStartEnd = rishumTimeParse(lesson['שעה']);
            var eventStartEnd = {
                start: calendar.fullCalendar('getCalendar').moment('2017-01-0' + lessonDay + 'T' + lessonStartEnd['start'] + ':00'),
                end: calendar.fullCalendar('getCalendar').moment('2017-01-0' + lessonDay + 'T' + lessonStartEnd['end'] + ':00')
            };

            var eventId = course + '.' + lesson['מס.'] + '.' + lessonType;

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
            calendar.fullCalendar('clientEvents', function (cbEvent) {
                if (cbEvent.selected && areEventsOverlapping(cbEvent, eventStartEnd)) {
                    if (!conflictedIds.propertyIsEnumerable(eventId)) {
                        conflictedIds[eventId] = 0;
                    }
                    conflictedIds[eventId]++;
                }
                return false;
            });

            return {
                id: eventId,
                title: title,
                start: eventStartEnd.start,
                end: eventStartEnd.end,
                backgroundColor: '#F8F9FA',
                textColor: 'black',
                borderColor: 'black',
                className: 'calendar-item-course-' + course
                    + ' calendar-item-course-' + course + '-type-' + lessonType
                    + ' calendar-item-course-' + course + '-lesson-' + lesson['מס.'],
                courseNumber: course,
                lessonData: lesson,
                selected: false,
                temporary: false
            };
        }
    }

    function removeCourseFromCalendar(course) {
        var calendar = $('#calendar');

        // Show conflicting events which can now be selected.
        var conflictedIds = {};

        var conflictedEvents = calendar.fullCalendar('clientEvents', function (event) {
            if (event.courseNumber !== course && isConflicted(event, course)) {
                if (!conflictedIds.propertyIsEnumerable(event.id)) {
                    conflictedIds[event.id] = 1;
                    return true;
                }
                conflictedIds[event.id]++;
                return false;
            }

            return false;
        });

        var conflictedCourses = {};

        for (var i = 0; i < conflictedEvents.length; i++) {
            var weeks = conflictedIds[conflictedEvents[i].id];
            conflictedEvents[i].start.add(-7*weeks, 'days');
            conflictedEvents[i].end.add(-7*weeks, 'days');
            conflictedCourses[conflictedEvents[i].courseNumber] = true;
        }

        myUpdateEvents(calendar, conflictedEvents);
        calendar.fullCalendar('removeEvents', function (event) {
            return event.courseNumber === course;
        });

        Object.keys(conflictedCourses).forEach(function (conflictedCourse) {
            updateCourseConflictedStatus(conflictedCourse);
        });

        // True if the event cannot be selected because of the given course.
        function isConflicted(event, course) {
            var conflictingEvent = calendar.fullCalendar('clientEvents', function (cbEvent) {
                return cbEvent.courseNumber === course && cbEvent.selected && areEventsOverlapping(cbEvent, event);
            });

            return conflictingEvent.length > 0;
        }
    }

    function changeCoursePreviewedStatus(course, previewed) {
        var calendar = $('#calendar');
        if (previewed) {
            var conflictedEvents = calendar.fullCalendar('clientEvents', function (event) {
                return event.courseNumber === course && event.start.week() > 1;
            });

            var temporaryEvents = [];

            for (var i = 0; i < conflictedEvents.length; i++) {
                var conf = conflictedEvents[i];
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

                temporaryEvents.push(temp);
            }

            calendar.fullCalendar('renderEvents', temporaryEvents);

            $('.calendar-item-course-' + course).addClass('calendar-item-previewed');
        } else {
            $('.calendar-item-course-' + course).removeClass('calendar-item-previewed');
            calendar.fullCalendar('removeEvents', function (event) {
                return event.temporary;
            });
        }
    }

    function onEventClick(event) {
        var calendar = $('#calendar');

        var selectingEvent = !event.selected;
        var conflictedCourses = {};

        if (selectingEvent) {
            selectedLessonSave(event.courseNumber, event.lessonData['מס.'], getEventLessonType(event));
            event.selected = true;
            event.backgroundColor = colorHash.hex(event.courseNumber);
            event.textColor = 'white';
            event.borderColor = 'white';
        } else {
            selectedLessonUnsave(event.courseNumber, event.lessonData['מס.'], getEventLessonType(event));
            event.selected = false;
            event.backgroundColor = '#F8F9FA';
            event.textColor = 'black';
            event.borderColor = 'black';
        }
        myUpdateEvent(calendar, event);

        var sameCourseTypeEvents = calendar.fullCalendar('clientEvents', function (cbEvent) {
            if (cbEvent.courseNumber === event.courseNumber &&
                getEventLessonType(cbEvent) === getEventLessonType(event)) {

                if (cbEvent.lessonData['מס.'] === event.lessonData['מס.']) {
                    // There might be multiple events for the same course, type, and number, process them all.
                    handleConflictedEvents(cbEvent);
                    return false;
                } else {
                    return true;
                }
            }
            return false;
        });

        for (var i = 0; i < sameCourseTypeEvents.length; i++) {
            sameCourseTypeEvents[i].start.add(selectingEvent ? 7 : -7, 'days');
            sameCourseTypeEvents[i].end.add(selectingEvent ? 7 : -7, 'days');
        }

        myUpdateEvents(calendar, sameCourseTypeEvents);

        Object.keys(conflictedCourses).forEach(function (conflictedCourse) {
            updateCourseConflictedStatus(conflictedCourse);
        });

        updateCalendarMaxDayAndTime();

        function handleConflictedEvents(event) {
            var conflictedIds = {};

            var conflictedEvents = calendar.fullCalendar('clientEvents', function (cbEvent) {
                if (cbEvent.courseNumber === event.courseNumber &&
                    getEventLessonType(cbEvent) === getEventLessonType(event)) {
                    return false;
                }

                if (areEventsOverlapping(cbEvent, event)) {
                    if (!conflictedIds.propertyIsEnumerable(cbEvent.id)) {
                        conflictedIds[cbEvent.id] = 1;
                        return true;
                    }
                    conflictedIds[cbEvent.id]++;
                    return false;
                }

                return false;
            });

            for (var i = 0; i < conflictedEvents.length; i++) {
                var weeks = conflictedIds[conflictedEvents[i].id];
                conflictedEvents[i].start.add((selectingEvent ? 7 : -7)*weeks, 'days');
                conflictedEvents[i].end.add((selectingEvent ? 7 : -7)*weeks, 'days');
                conflictedCourses[conflictedEvents[i].courseNumber] = true;
            }

            myUpdateEvents(calendar, conflictedEvents);
        }
    }

    function onEventMouseover(event) {
        $('.list-group-item-course-' + event.courseNumber).addClass('list-group-item-same-course-as-hovered');
        coursesExamInfo.setHovered(event.courseNumber);
        $('.calendar-item-course-' + event.courseNumber).addClass('calendar-item-same-course-as-hovered');
        $('.calendar-item-course-' + event.courseNumber + '-type-' + getEventLessonType(event)).addClass('calendar-item-same-type-as-hovered');
    }

    function onEventMouseout(event) {
        $('.list-group-item-course-' + event.courseNumber).removeClass('list-group-item-same-course-as-hovered');
        coursesExamInfo.removeHovered(event.courseNumber);
        $('.calendar-item-course-' + event.courseNumber).removeClass('calendar-item-same-course-as-hovered');
        $('.calendar-item-course-' + event.courseNumber + '-type-' + getEventLessonType(event)).removeClass('calendar-item-same-type-as-hovered');
    }

    function afterEventRender(event, element) {
        if (!event.selected) {
            var sameType = $('.calendar-item-course-' + event.courseNumber + '-type-' + getEventLessonType(event))
                .not('.calendar-item-course-' + event.courseNumber + '-lesson-' + event.lessonData['מס.']);
            if (sameType.length === 0) {
                element.addClass('calendar-item-last-choice');
            }
        }
    }

    function onCourseButtonClick(button, course) {
        if (button.hasClass('active')) {
            removeCourseFromCalendar(course);
            button.removeClass('active').removeClass('list-group-item-conflicted');
            button.css({ 'background-color': '', 'border-color': '' });
            selectedCourseUnsave(course);
            coursesChosen[course] = false;
            updateGeneralInfoLine();
            updateCalendarMaxDayAndTime();
            updateExamInfo([]);
        } else {
            addCourseToCalendar(course);
            changeCoursePreviewedStatus(course, true);
            button.addClass('active');
            var color = colorHash.hex(course);
            button.css({ 'background-color': color, 'border-color': color });
            selectedCourseSave(course);
            coursesChosen[course] = true;
            updateGeneralInfoLine();
            updateCalendarMaxDayAndTime();
            updateExamInfo([]);
        }
    }

    function addCourseToListGroup(course) {
        var button = $('<a href="#" type="button"'
            + ' class="list-group-item active list-group-item-course-' + course + '">'
            + '</a>');
        var badge = $('<span class="badge badge-pill badge-secondary float-right">i</span>');
        var color = colorHash.hex(course);
        var courseTitle = courseManager.getTitle(course);
        button.css({ 'background-color': color, 'border-color': color })
            .click(function (e) {
                e.preventDefault(); // don't follow the link "#"
                onCourseButtonClick($(this), course);
            }).hover(
                function () {
                    $(this).addClass('list-group-item-same-course-as-hovered');
                    coursesExamInfo.setHovered(course);
                    changeCoursePreviewedStatus(course, true);
                }, function () {
                    $(this).removeClass('list-group-item-same-course-as-hovered');
                    coursesExamInfo.removeHovered(course);
                    changeCoursePreviewedStatus(course, false);
                }
            ).text(courseTitle)
            .append(badge);

        // Add tooltip to badge.
        var courseDescription = courseManager.getDescription(course);
        var courseDescriptionHtml = $('<div>').text(courseDescription).html().replace(/\n/g, '<br>');
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
                e.preventDefault(); // don't follow the link "#"
                $(this).tooltip('hide');
                BootstrapDialog.show({
                    title: courseTitle,
                    message: courseDescription
                });
            }).prop('title', courseDescriptionHtml)
            .attr('data-toggle', 'tooltip')
            .tooltip({
                html: true,
                placement: 'right',
                template: '<div class="tooltip" role="tooltip"><div class="arrow"></div><div class="tooltip-inner course-description-tooltip-inner"></div></div>',
                trigger: 'hover'
            });
        $('#course-button-list').append(button);
    }

    function saveAsIcs() {
        var calendar = $('#calendar');
        var icsCal = ics();

        var yearFrom = parseInt(current_semester.slice(0, 4), 10);
        var yearTo = yearFrom + 2;

        var rrule = { freq: 'WEEKLY', until: yearTo + '-01-01T00:00:00Z' };

        var count = 0;

        calendar.fullCalendar('clientEvents', function (event) {
            if (event.start.week() === 1 && event.selected) {
                var general = courseManager.getGeneralInfo(event.courseNumber);
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

                icsCal.addEvent(subject, description, location, begin, end, rrule);
                count++;
            }

            return false;
        });

        if (count > 0) {
            icsCal.download(semesterFriendlyName(current_semester));
        } else {
            alert('המערכת ריקה');
        }
    }

    function selectedCourseSave(course) {
        var semesterCoursesKey = current_semester + 'Courses';
        var courseKey = current_semester + '_' + course;

        var doc = firestoreAuthUserDoc();
        if (doc) {
            var input = {};
            input[semesterCoursesKey] = firebase.firestore.FieldValue.arrayUnion(course);
            input[courseKey] = {};
            doc.set(input, { merge: true });
        } else {
            var courses = JSON.parse(localStorage && localStorage.getItem(semesterCoursesKey) || '[]');
            courses.push(course);
            localStorage && localStorage.setItem(semesterCoursesKey, JSON.stringify(courses));
            localStorage && localStorage.removeItem(courseKey);
        }
    }

    function selectedCourseUnsave(course) {
        var semesterCoursesKey = current_semester + 'Courses';
        var courseKey = current_semester + '_' + course;

        var doc = firestoreAuthUserDoc();
        if (doc) {
            var input = {};
            input[semesterCoursesKey] = firebase.firestore.FieldValue.arrayRemove(course);
            input[courseKey] = firebase.firestore.FieldValue.delete();
            doc.update(input);
        } else {
            var courses = JSON.parse(localStorage && localStorage.getItem(semesterCoursesKey) || '[]');
            courses = courses.filter(function (item) {
                return item !== course;
            });
            localStorage && localStorage.setItem(semesterCoursesKey, JSON.stringify(courses));
            localStorage && localStorage.removeItem(courseKey);
        }
    }

    function selectedLessonSave(course, lessonNumber, lessonType) {
        var courseKey = current_semester + '_' + course;

        var doc = firestoreAuthUserDoc();
        if (doc) {
            var input = {};
            input[courseKey + '.' + lessonType] = lessonNumber;
            doc.update(input);
        } else {
            var lessons = JSON.parse(localStorage && localStorage.getItem(courseKey) || '{}');
            lessons[lessonType] = lessonNumber;
            localStorage && localStorage.setItem(courseKey, JSON.stringify(lessons));
        }
    }

    function selectedLessonUnsave(course, lessonNumber, lessonType) {
        var courseKey = current_semester + '_' + course;

        var doc = firestoreAuthUserDoc();
        if (doc) {
            var input = {};
            input[courseKey + '.' + lessonType] = firebase.firestore.FieldValue.delete();
            doc.update(input);
        } else {
            var lessons = JSON.parse(localStorage && localStorage.getItem(courseKey) || '{}');
            delete lessons[lessonType];
            localStorage && localStorage.setItem(courseKey, JSON.stringify(lessons));
        }
    }

    function loadSavedCoursesAndLessons(onLoadedFunc) {
        var semesterCoursesKey = current_semester + 'Courses';

        var doc = firestoreAuthUserDoc();
        if (doc) {
            doc.get().then(function (doc) {
                applySaved(doc.exists ? doc.data() : {});
                onLoadedFunc();
            }, function (error) {
                alert('Error loading data from server: ' + error);
            });
        } else {
            var data = {};
            data[semesterCoursesKey] = JSON.parse(localStorage && localStorage.getItem(semesterCoursesKey) || '[]');
            data[semesterCoursesKey].forEach(function (course) {
                var courseKey = current_semester + '_' + course;
                data[courseKey] = JSON.parse(localStorage && localStorage.getItem(courseKey) || '{}');
            });
            applySaved(data);
            onLoadedFunc();
        }

        function applySaved(data) {
            var courses = data[semesterCoursesKey] || [];

            courses.forEach(function (course) {
                if (!coursesChosen.propertyIsEnumerable(course) && courseManager.doesExist(course)) {
                    coursesChosen[course] = true;
                    addCourseToListGroup(course);
                    addCourseToCalendar(course);

                    var courseKey = current_semester + '_' + course;

                    var lessons = data[courseKey] || {};
                    Object.keys(lessons).forEach(function (lessonType) {
                        var lessonNumber = lessons[lessonType];
                        $('.calendar-item-course-' + course + '-type-' + lessonType
                            + '.calendar-item-course-' + course + '-lesson-' + lessonNumber).first().click();
                    });
                }
            });

            updateGeneralInfoLine();
            updateCalendarMaxDayAndTime();
            updateExamInfo([]);
        }
    }

    function reloadSavedCoursesAndLessons(onLoadedFunc) {
        $('#course-button-list').empty();
        $('#calendar').fullCalendar('removeEvents', function (event) {
            return true;
        });
        coursesChosen = {};

        updateGeneralInfoLine();
        updateCalendarMaxDayAndTime();
        updateExamInfo([]);

        loadSavedCoursesAndLessons(onLoadedFunc);
    }

    function firestoreAuthUserDoc() {
        if (typeof firebase !== 'undefined' && firebase.auth().currentUser !== null) {
            return firestoreDb.collection('users').doc(firebase.auth().currentUser.uid);
        }
        return null;
    }

    function firebaseInit(afterInitFunc) {
        // Initialize Firebase.
        var config = {
            apiKey: 'AIzaSyAfKPyTM83mkLgdQTdx9YS9UXywiswwIYI',
            authDomain: 'cheesefork-de9af.firebaseapp.com',
            databaseURL: 'https://cheesefork-de9af.firebaseio.com',
            projectId: 'cheesefork-de9af',
            storageBucket: 'cheesefork-de9af.appspot.com',
            messagingSenderId: '916559682433'
        };
        firebase.initializeApp(config);

        // Initialize Firestore.
        firestoreDb = firebase.firestore();
        firestoreDb.settings({ timestampsInSnapshots: true }); // silence a warning

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
            privacyPolicyUrl: 'https://policies.google.com/privacy',
            // Disable accountchooser.com which is enabled by default.
            credentialHelper: firebaseui.auth.CredentialHelper.NONE
        };

        // Initialize the FirebaseUI Widget using Firebase.
        var firebaseUI = new firebaseui.auth.AuthUI(firebase.auth());

        var authInitialized = false;

        // Listen to change in auth state so it displays the correct UI for when
        // the user is signed in or not.
        firebase.auth().onAuthStateChanged(function (user) {
            user ? handleSignedInUser(user) : handleSignedOutUser();
            if (!authInitialized) {
                afterInitFunc();
                authInitialized = true;
            } else if (user) {
                // Slow reload.
                $('#page-loader').show();
                reloadSavedCoursesAndLessons(function () {
                    $('#page-loader').hide();
                });
            } else {
                // Fast reload.
                reloadSavedCoursesAndLessons(function () {});
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

    available_semesters.forEach(function (semester) {
        $('#select-semester').append($('<option>', {
            value: semester,
            text: semesterFriendlyName(semester)
        }));
    });

    $('#select-semester').val(current_semester).change(function () {
        window.location = '?semester=' + this.value;
    });

    $('#save-as-ics').click(function () {
        saveAsIcs();
    });

    courseManager.getAllCourses().sort().forEach(function (course) {
        var general = courseManager.getGeneralInfo(course);
        $('#select-course').append($('<option>', {
            value: course,
            text: course + ' - ' + general['שם מקצוע']
        }));
    });

    coursesExamInfo = new CoursesExamInfo($('#course-exam-info'), {
        courseManager: courseManager,
        onHoverIn: function (course) {
            changeCoursePreviewedStatus(course, true);
            $('.list-group-item-course-' + course).addClass('list-group-item-same-course-as-hovered');
        },
        onHoverOut: function (course) {
            changeCoursePreviewedStatus(course, false);
            $('.list-group-item-course-' + course).removeClass('list-group-item-same-course-as-hovered');
        },
        colorGenerator: function (course) {
            return colorHash.hex(course);
        }
    });

    $('#select-course').selectize({
        //searchConjunction: 'or',
        maxOptions: 200,
        render: {
            option: function (item, escape) {
                var course = item.value;
                var general = courseManager.getGeneralInfo(course);

                var courseDescriptionHtml = $('<div>').text(courseManager.getDescription(course)).html().replace(/\n/g, '<br>');

                var courseNumber = $('<abbr>').text(general['מספר מקצוע'])
                    .prop('title', courseDescriptionHtml)
                    .attr({
                        'data-toggle': 'tooltip',
                        'data-html': 'true',
                        'data-placement': 'right',
                        'data-template': '<div class="tooltip" role="tooltip"><div class="arrow"></div><div class="tooltip-inner course-description-tooltip-inner"></div></div>',
                        'data-boundary': 'viewport'
                    });

                return $('<div>').addClass('option').append(courseNumber)
                    .append(document.createTextNode(' - ' + general['שם מקצוע'])).get(0);
            }
        },
        onItemAdd: function (course) {
            if (!coursesChosen.propertyIsEnumerable(course)) {
                coursesChosen[course] = true;
                addCourseToListGroup(course);
                addCourseToCalendar(course);
                selectedCourseSave(course);
                updateGeneralInfoLine();
                updateCalendarMaxDayAndTime();
                updateExamInfo([]);
            }
            this.clear();
        },
        onDropdownItemActivate: function (course) {
            if (!coursesChosen.propertyIsEnumerable(course)) {
                addCourseToCalendar(course);
                updateCalendarMaxDayAndTime();
                updateExamInfo([course]);
                coursesExamInfo.setHighlighted(course);
            }
            changeCoursePreviewedStatus(course, true);
        },
        onDropdownItemDeactivate: function (course) {
            if (!coursesChosen.propertyIsEnumerable(course)) {
                removeCourseFromCalendar(course);
                updateCalendarMaxDayAndTime();
                updateExamInfo([]);
            } else {
                // Remove highlight
                changeCoursePreviewedStatus(course, false);
            }
        }
    });

    $('.selectize-control .selectize-dropdown').tooltip({ selector: '[data-toggle=tooltip]' });

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
        eventClick: onEventClick,
        eventMouseover: onEventMouseover,
        eventMouseout: onEventMouseout,
        eventAfterRender: afterEventRender
    }).fullCalendar('option', {
        // Set afterwards as a bug workaround.
        // https://github.com/fullcalendar/fullcalendar/issues/4102
        hiddenDays: [5, 6]
    });

    $('#footer-semester-name').text(semesterFriendlyName(current_semester));
    $('#footer-semester').removeClass('d-none');

    $('#right-content-bar').removeClass('invisible');

    if (typeof firebase !== 'undefined') {
        // Firebase UI doesn't work on Edge/IE in private mode.
        // Fall back to offline mode.
        try {
            firebaseInit(function () {
                loadSavedCoursesAndLessons(function () {
                    $('#page-loader').hide();
                });
            });
        } catch(e) {
            firebase = undefined;
        }
    }

    if (typeof firebase === 'undefined') {
        document.getElementById('firebase-sign-in').style.display = 'none';
        loadSavedCoursesAndLessons(function () {
            $('#page-loader').hide();
        });
    }
});
