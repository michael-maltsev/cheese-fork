'use strict';

/* global moment, BootstrapDialog */

var CourseCalendar = (function () {
    function CourseCalendar(element, options) {
        this.element = element;
        this.courseManager = options.courseManager;
        this.colorGenerator = options.colorGenerator;
        this.readonly = options.readonly;
        this.onCourseHoverIn = options.onCourseHoverIn;
        this.onCourseHoverOut = options.onCourseHoverOut;
        this.onCourseConflictedStatusChanged = options.onCourseConflictedStatusChanged;
        this.onLessonSelected = options.onLessonSelected;
        this.onLessonUnselected = options.onLessonUnselected;
        this.onCustomEventAdded = options.onCustomEventAdded;
        this.onCustomEventUpdated = options.onCustomEventUpdated;
        this.onCustomEventRemoved = options.onCustomEventRemoved;

        var that = this;

        element.addClass('course-calendar').fullCalendar({
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
            selectable: !that.readonly,
            selectHelper: true,
            selectOverlap: true,
            select: onSelect.bind(that),
            eventDrop: onCustomEventMoveResize.bind(that),
            eventResize: onCustomEventMoveResize.bind(that),
            eventClick: onEventClick.bind(that),
            eventMouseover: onEventMouseover.bind(that),
            eventMouseout: onEventMouseout.bind(that),
            eventAfterRender: afterEventRender.bind(that)
        }).fullCalendar('option', {
            // Set afterwards as a bug workaround.
            // https://github.com/fullcalendar/fullcalendar/issues/4102
            hiddenDays: [5, 6]
        });

        initTouchScalingSupport(that);
    }

    function initTouchScalingSupport(courseCalendar) {
        var calendar = courseCalendar.element;

        // Based on the CSS rule:
        // .fc-time-grid .fc-slats td {
        //     height: 1.5em;
        // }
        var gridSlotHeight = 1.5;

        var scaling = false;
        var verticalCenter;
        var pendingAnimationRequest = null;
        var renderRequired = false;
        var previousDist;

        // Based on:
        // https://stackoverflow.com/a/11183333

        calendar.get(0).addEventListener('touchstart', function (event) {
            // https://plus.google.com/+RickByers/posts/GHwpqnAFATf
            event.target.addEventListener('touchmove', onTouchMove, {passive: true});
            event.target.addEventListener('touchend', onTouchEnd, {passive: true});
            event.target.addEventListener('touchcancel', onTouchEnd, {passive: true});

            if (!scaling && event.touches.length >= 2) {
                scaling = true;
                verticalCenter = getVerticalCenter(event.touches);
                previousDist = Math.hypot(
                    event.touches[0].pageX - event.touches[1].pageX,
                    event.touches[0].pageY - event.touches[1].pageY);

                pendingAnimationRequest = window.requestAnimationFrame(renderNewSlotHeight);
            } else if (scaling && event.touches.length < 2) {
                scaling = false;
                endScaling();
            }
        }, {passive: true});

        function onTouchMove(event) {
            if (scaling && event.touches.length >= 2) {
                var dist = Math.hypot(
                    event.touches[0].pageX - event.touches[1].pageX,
                    event.touches[0].pageY - event.touches[1].pageY);
                scaleGridSlotHeight(dist / previousDist);
                previousDist = dist;
            }
        }

        function onTouchEnd(event) {
            if (scaling) {
                if (event.type === 'touchcancel' || event.touches.length < 2) {
                    scaling = false;
                    endScaling();
                }
            }

            var targetStillTouched = false;
            for (var i = 0; i < event.touches.length; i++) {
                var touch = event.touches[i];
                if (touch.target === event.target) {
                    targetStillTouched = true;
                    break;
                }
            }

            if (!targetStillTouched) {
                event.target.removeEventListener('touchmove', onTouchMove);
                event.target.removeEventListener('touchend', onTouchEnd);
                event.target.removeEventListener('touchcancel', onTouchEnd);
            }
        }

        function endScaling() {
            if (pendingAnimationRequest !== null) {
                window.cancelAnimationFrame(pendingAnimationRequest);
                renderNewSlotHeight();
            }
        }

        function scaleGridSlotHeight(scale) {
            var prevHeight = gridSlotHeight;
            gridSlotHeight *= scale;
            if (gridSlotHeight < 1.5) {
                gridSlotHeight = 1.5;
            } else if (gridSlotHeight > 4.5) {
                gridSlotHeight = 4.5;
            }

            if (gridSlotHeight !== prevHeight) {
                renderRequired = true;
            }
        }

        function renderNewSlotHeight() {
            if (renderRequired) {
                var timeGrid = calendar.find('.fc-time-grid');
                var heightBefore = timeGrid.height();

                calendar.find('.fc-time-grid .fc-slats td').css('height', gridSlotHeight + 'em');

                calendar.fullCalendar('render');
                calendar.fullCalendar('rerenderEvents');

                var heightAfter = timeGrid.height();

                // Make verticalCenter the vertical anchor of the zoom.
                $(window).scrollTop($(window).scrollTop() + (heightAfter - heightBefore) * verticalCenter);

                renderRequired = false;
            }

            if (scaling) {
                pendingAnimationRequest = window.requestAnimationFrame(renderNewSlotHeight);
            } else {
                pendingAnimationRequest = null;
            }
        }

        function getVerticalCenter(touches) {
            var timeGrid = calendar.find('.fc-time-grid');
            var offset = timeGrid.offset();
            var top = offset.top;
            var height = timeGrid.height();

            var centerY = (touches[0].pageY + touches[1].pageY) / 2;

            var centerYRelative = (centerY - top) / height;
            if (centerYRelative < 0) {
                centerYRelative = 0;
            } else if (centerYRelative > 1) {
                centerYRelative = 1;
            }

            return centerYRelative;
        }
    }

    function stringHexEncode(str) {
        var result = '';
        for (var i = 0; i < str.length; i++) {
            var hex = str.charCodeAt(i).toString(16);
            result += ('000' + hex).slice(-4);
        }
        return result;
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

    function updateLessonEvents(calendar, events) {
        events = events.slice(); // make a copy
        events.forEach(function (value, index) {
            events[index] = $.extend({}, events[index]); // make a copy

            // Delete properties which are not shared among events with the same id.
            delete events[index].title;
            delete events[index].lessonData;
        });
        calendar.fullCalendar('updateEvents', events);
    }

    function updateLessonEvent(calendar, event) {
        updateLessonEvents(calendar, [event]);
    }

    function getCourseConflictedStatus(calendar, course) {
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

        return conflicted;
    }

    function getCalendarTimeBoundaries(calendar, onlySelectedEvents = false) {
        var minTime = calendar.fullCalendar('getCalendar').moment('2017-01-01T08:30:00');
        var maxTime = calendar.fullCalendar('getCalendar').moment('2017-01-01T18:30:00');
        var maxDay = 4;

        calendar.fullCalendar('clientEvents', function (event) {

            if(onlySelectedEvents && !event.selected)
                return false;

            // Subtract one minute to treat 24:00 as the previous day.
            var endDay = event.end.clone().add(-1, 'minute').day();
            if (maxDay < endDay) {
                maxDay = endDay;
            }

            var start = event.start.clone().set({year: 2017, month: 0, date: 1});
            var end = event.end.clone().set({year: 2017, month: 0, date: 1});

            if (event.end.day() !== event.start.day()) {
                // Event spans to more than one day, display up to 24:00 to make sure it's visible.
                end = calendar.fullCalendar('getCalendar').moment('2017-01-01T24:00:00');
            }

            if (minTime.isAfter(start)) {
                minTime = start;
            }

            if (maxTime.isBefore(end)) {
                maxTime = end;
            }

            return false;
        });

        return {
            minTime: minTime,
            maxTime: maxTime,
            maxDay: maxDay,
        };
    }

    function updateCalendarMaxDayAndTime(calendar) {

        var timeBoundaries = getCalendarTimeBoundaries(calendar);

        var maxDay = timeBoundaries.maxDay;
        var maxTime = timeBoundaries.maxTime;
        var minTime = timeBoundaries.minTime;

        minTime = minTime.format('HH:mm:ss');
        maxTime = maxTime.format('kk:mm:ss');
        
        var hiddenDays = [];
        for (var i = maxDay + 1; i < 7; i++) {
            hiddenDays.push(i);
        }

        // Only apply options that changed, avoids re-rendering if not needed, which is very slow.
        var newOptions = {};

        if (minTime !== calendar.fullCalendar('option', 'minTime')) {
            newOptions.minTime = minTime;
        }

        if (maxTime !== calendar.fullCalendar('option', 'maxTime')) {
            newOptions.maxTime = maxTime;
        }

        if (JSON.stringify(hiddenDays) !== JSON.stringify(calendar.fullCalendar('option', 'hiddenDays'))) {
            newOptions.hiddenDays = hiddenDays;
        }

        if (Object.keys(newOptions).length > 0) {
            calendar.fullCalendar('option', newOptions);
        }
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

    function makeLessonEvent(courseCalendar, course, lesson) {
        var lessonType = getLessonType(course, lesson);
        var lessonDay = lesson['יום'].charCodeAt(0) - 'א'.charCodeAt(0) + 1;
        var lessonStartEnd = courseCalendar.courseManager.parseLessonTime(lesson['שעה']);
        var eventStartEnd = {
            start: courseCalendar.element.fullCalendar('getCalendar').moment('2017-01-0' + lessonDay + 'T' + lessonStartEnd.start + ':00'),
            end: courseCalendar.element.fullCalendar('getCalendar').moment('2017-01-0' + lessonDay + 'T' + lessonStartEnd.end + ':00')
        };

        var eventId = course + '.' + lesson['מס.'] + '.' + lessonType;

        var general = courseCalendar.courseManager.getGeneralInfo(course);

        var title = courseCalendar.courseManager.getLessonTypeAndNumber(lesson);
        if (lesson['בניין']) {
            title += '\n' + lesson['בניין'];
            if (lesson['חדר']) {
                title += ' ' + lesson['חדר'];
            }
        }
        if (lesson['מרצה/מתרגל']) {
            title += '\n' + lesson['מרצה/מתרגל'];
        }
        title += '\n' + general['שם מקצוע'];

        return {
            id: eventId,
            title: title,
            start: eventStartEnd.start,
            end: eventStartEnd.end,
            backgroundColor: courseCalendar.colorGenerator(course),
            textColor: 'white',
            borderColor: 'white',
            className: 'calendar-item-course-' + course +
                ' calendar-item-course-' + course + '-type-' + lessonType +
                ' calendar-item-course-' + course + '-lesson-' + lesson['מס.'],
            courseNumber: course,
            lessonData: lesson,
            selected: false,
            temporary: false
        };
    }

    function initCreateCourseEvents(courseCalendar, course) {
        var schedule = courseCalendar.courseManager.getSchedule(course);
        if (schedule.length === 0) {
            return [];
        }

        var lessonsAdded = {};
        var events = [];

        for (var i = 0; i < schedule.length; i++) {
            var lesson = schedule[i];
            if (lessonsAdded.propertyIsEnumerable(lesson['מס.']) && lessonsAdded[lesson['מס.']] !== lesson['קבוצה']) {
                continue;
            }

            events.push(makeLessonEvent(courseCalendar, course, lesson));
            lessonsAdded[lesson['מס.']] = lesson['קבוצה'];
        }

        return events;
    }

    function initSelectLesson(events, courseNumber, lessonType, lessonNumber) {
        var selected = false;
        var conflictedIds = {};

        events.forEach(function (cbEvent) {
            if (cbEvent.start.week() === 1 &&
                !cbEvent.selected &&
                cbEvent.courseNumber === courseNumber &&
                getEventLessonType(cbEvent) === lessonType &&
                cbEvent.lessonData['מס.'] === lessonNumber) {

                cbEvent.selected = true;
                selected = true;

                markConflictedEvents(cbEvent);
            }
        });

        if (selected) {
            events.forEach(function (cbEvent) {
                if (cbEvent.courseNumber === courseNumber &&
                    getEventLessonType(cbEvent) === lessonType &&
                    cbEvent.lessonData['מס.'] !== lessonNumber) {
                    // Different lesson number of the same course and type - can no longer be selected.
                    cbEvent.start.add(7, 'days');
                    cbEvent.end.add(7, 'days');
                }

                if (conflictedIds.propertyIsEnumerable(cbEvent.id)) {
                    var weeks = conflictedIds[cbEvent.id];
                    cbEvent.start.add(7 * weeks, 'days');
                    cbEvent.end.add(7 * weeks, 'days');
                }
            });
        }

        function markConflictedEvents(event) {
            events.forEach(function (cbEvent) {
                if (cbEvent.courseNumber === event.courseNumber &&
                    getEventLessonType(cbEvent) === getEventLessonType(event)) {
                    return;
                }

                if (areEventsOverlapping(cbEvent, event)) {
                    if (!conflictedIds.propertyIsEnumerable(cbEvent.id)) {
                        conflictedIds[cbEvent.id] = 0;
                    }
                    conflictedIds[cbEvent.id]++;
                }
            });
        }
    }

    function makeCustomEvent(courseCalendar, eventId, eventTitle, start, end) {
        return {
            id: eventId,
            title: eventTitle,
            start: start,
            end: end,
            backgroundColor: courseCalendar.colorGenerator(eventTitle),
            textColor: 'white',
            borderColor: 'white',
            editable: !courseCalendar.readonly,
            constraint: {
                start: '2017-01-01T00:00:00',
                end: '2017-01-07T24:00:00'
            },
            courseNumber: null,
            lessonData: null,
            selected: true,
            temporary: false
        };
    }

    function onSelect(start, end) {
        var that = this;
        var calendar = that.element;

        BootstrapDialog.show({
            title: 'הוספת אירוע מותאם אישית',
            message: $('<textarea class="form-control" placeholder="תיאור האירוע"></textarea>'),
            onshown: function (dialog) {
                dialog.getModalBody().find('textarea').focus();
            },
            onhide: function (dialog) {
                calendar.fullCalendar('unselect');
            },
            buttons: [{
                label: 'הוסף',
                cssClass: 'btn-primary',
                action: function (dialog) {
                    dialog.close();

                    var eventTitle = dialog.getModalBody().find('textarea').val().trim();
                    if (eventTitle === '') {
                        return;
                    }

                    var eventIdCounter = Math.round(Date.now() / 1000);
                    var eventId = 'custom_event_' + eventIdCounter;
                    while (calendar.fullCalendar('clientEvents', eventId).length > 0) {
                        eventIdCounter++;
                        eventId = 'custom_event_' + eventIdCounter;
                    }

                    calendar.fullCalendar('renderEvent', makeCustomEvent(that, eventId, eventTitle, start, end));
                    updateCalendarMaxDayAndTime(calendar);

                    that.onCustomEventAdded(eventIdCounter, {
                        title: eventTitle,
                        start: start.format(),
                        end: end.format()
                    });
                }
            }]
        });
    }

    function onCustomEventMoveResize(event) {
        var that = this;
        var calendar = that.element;

        updateCalendarMaxDayAndTime(calendar);

        that.onCustomEventUpdated(event.id.replace(/^custom_event_/, ''), {
            title: event.title,
            start: event.start.format(),
            end: event.end.format()
        });
    }

    function onEventClick(event) {
        if (this.readonly) {
            return;
        }

        var that = this;
        var calendar = that.element;

        if (event.courseNumber === null) {
            BootstrapDialog.show({
                title: 'עריכת אירוע מותאם אישית',
                message: $('<textarea class="form-control" placeholder="תיאור האירוע"></textarea>').val(event.title),
                onshown: function (dialog) {
                    dialog.getModalBody().find('textarea').focus();
                },
                buttons: [{
                    label: 'ערוך',
                    cssClass: 'btn-primary',
                    action: function (dialog) {
                        dialog.close();

                        var eventTitle = dialog.getModalBody().find('textarea').val().trim();
                        if (eventTitle === '') {
                            return;
                        }

                        event.title = eventTitle;
                        event.backgroundColor = that.colorGenerator(eventTitle);
                        calendar.fullCalendar('updateEvent', event);

                        that.onCustomEventUpdated(event.id.replace(/^custom_event_/, ''), {
                            title: eventTitle,
                            start: event.start.format(),
                            end: event.end.format()
                        });
                    }
                }, {
                    label: 'הסר',
                    action: function (dialog) {
                        dialog.close();

                        calendar.fullCalendar('removeEvents', event.id);
                        updateCalendarMaxDayAndTime(calendar);

                        that.onCustomEventRemoved(event.id.replace(/^custom_event_/, ''));
                    }
                }]
            });

            return;
        }

        var selectingEvent = !event.selected;
        var conflictedCourses = {};

        event.selected = selectingEvent;
        updateLessonEvent(calendar, event);

        var sameCourseTypeEvents = calendar.fullCalendar('clientEvents', function (cbEvent) {
            if (cbEvent.courseNumber === event.courseNumber &&
                getEventLessonType(cbEvent) === getEventLessonType(event)) {

                if (cbEvent.lessonData['מס.'] === event.lessonData['מס.']) {
                    // There might be multiple events for the same course, type, and number, process them all.
                    handleConflictedEvents(cbEvent);
                    return false;
                } else {
                    // Different lesson number of the same course and type - can no longer be selected.
                    return true;
                }
            }
            return false;
        });

        for (var i = 0; i < sameCourseTypeEvents.length; i++) {
            sameCourseTypeEvents[i].start.add(selectingEvent ? 7 : -7, 'days');
            sameCourseTypeEvents[i].end.add(selectingEvent ? 7 : -7, 'days');
        }

        updateLessonEvents(calendar, sameCourseTypeEvents);

        Object.keys(conflictedCourses).forEach(function (conflictedCourse) {
            var conflicted = getCourseConflictedStatus(calendar, conflictedCourse);
            that.onCourseConflictedStatusChanged(conflictedCourse, conflicted);
        });

        if (selectingEvent) {
            that.onLessonSelected(event.courseNumber, event.lessonData['מס.'], getEventLessonType(event));
        } else {
            that.onLessonUnselected(event.courseNumber, event.lessonData['מס.'], getEventLessonType(event));
        }

        function handleConflictedEvents(event) {
            var conflictedIds = {};

            var conflictedEvents = calendar.fullCalendar('clientEvents', function (cbEvent) {
                if (cbEvent.courseNumber === null) {
                    return false;
                }

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
                conflictedEvents[i].start.add((selectingEvent ? 7 : -7) * weeks, 'days');
                conflictedEvents[i].end.add((selectingEvent ? 7 : -7) * weeks, 'days');
                conflictedCourses[conflictedEvents[i].courseNumber] = true;
            }

            updateLessonEvents(calendar, conflictedEvents);
        }
    }

    function onEventMouseover(event) {
        if (event.courseNumber === null) {
            return;
        }

        $('.calendar-item-course-' + event.courseNumber, this.element).addClass('calendar-item-same-course-as-hovered');
        $('.calendar-item-course-' + event.courseNumber + '-type-' + getEventLessonType(event), this.element).addClass('calendar-item-same-type-as-hovered');
        this.onCourseHoverIn(event.courseNumber);
    }

    function onEventMouseout(event) {
        if (event.courseNumber === null) {
            return;
        }

        $('.calendar-item-course-' + event.courseNumber, this.element).removeClass('calendar-item-same-course-as-hovered');
        $('.calendar-item-course-' + event.courseNumber + '-type-' + getEventLessonType(event), this.element).removeClass('calendar-item-same-type-as-hovered');
        this.onCourseHoverOut(event.courseNumber);
    }

    function afterEventRender(event, element) {
        if (event.selected) {
            element.addClass('calendar-item-selected');
        } else {
            element.addClass('calendar-item-unselected');

            if (event.courseNumber !== null) {
                var sameType = $('.calendar-item-course-' + event.courseNumber + '-type-' + getEventLessonType(event), this.element)
                    .not('.calendar-item-course-' + event.courseNumber + '-lesson-' + event.lessonData['מס.']);
                if (sameType.length === 0) {
                    element.addClass('calendar-item-last-choice');
                }
            }
        }
    }

    CourseCalendar.prototype.addCourse = function (course) {
        var that = this;

        var schedule = that.courseManager.getSchedule(course);
        if (schedule.length === 0) {
            return;
        }

        var calendar = that.element;

        var lessonsAdded = {};
        var events = [];
        var conflictedIds = {};

        for (var i = 0; i < schedule.length; i++) {
            var lesson = schedule[i];
            if (lessonsAdded.propertyIsEnumerable(lesson['מס.']) && lessonsAdded[lesson['מס.']] !== lesson['קבוצה']) {
                continue;
            }

            var event = makeLessonEvent(that, course, lesson);

            var conflictCount = countEventConflicts(event);
            if (conflictCount > 0) {
                if (!conflictedIds.propertyIsEnumerable(event.id)) {
                    conflictedIds[event.id] = 0;
                }
                conflictedIds[event.id] += conflictCount;
            }

            events.push(event);

            lessonsAdded[lesson['מס.']] = lesson['קבוצה'];
        }

        for (i = 0; i < events.length; i++) {
            if (conflictedIds.propertyIsEnumerable(events[i].id)) {
                var weeks = conflictedIds[events[i].id];
                events[i].start.add(7 * weeks, 'days');
                events[i].end.add(7 * weeks, 'days');
            }
        }

        calendar.fullCalendar('renderEvents', events);

        if (Object.keys(conflictedIds).length > 0 && getCourseConflictedStatus(calendar, course)) {
            that.onCourseConflictedStatusChanged(course, true);
        }

        updateCalendarMaxDayAndTime(calendar);

        function countEventConflicts(event) {
            var count = 0;
            calendar.fullCalendar('clientEvents', function (cbEvent) {
                if (cbEvent.courseNumber !== null && cbEvent.selected && areEventsOverlapping(cbEvent, event)) {
                    count++;
                }
                return false;
            });
            return count;
        }
    };

    CourseCalendar.prototype.removeCourse = function (course) {
        var that = this;
        var calendar = that.element;

        // Show conflicting events which can now be selected.
        var conflictedIds = {};

        var conflictedEvents = calendar.fullCalendar('clientEvents', function (event) {
            if (event.courseNumber !== null && event.courseNumber !== course && isConflicted(event, course)) {
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
            conflictedEvents[i].start.add(-7 * weeks, 'days');
            conflictedEvents[i].end.add(-7 * weeks, 'days');
            conflictedCourses[conflictedEvents[i].courseNumber] = true;
        }

        updateLessonEvents(calendar, conflictedEvents);
        calendar.fullCalendar('removeEvents', function (event) {
            return event.courseNumber === course;
        });

        Object.keys(conflictedCourses).forEach(function (conflictedCourse) {
            var conflicted = getCourseConflictedStatus(calendar, conflictedCourse);
            that.onCourseConflictedStatusChanged(conflictedCourse, conflicted);
        });

        updateCalendarMaxDayAndTime(calendar);

        // True if the event cannot be selected because of the given course.
        function isConflicted(event, course) {
            var conflictingEvent = calendar.fullCalendar('clientEvents', function (cbEvent) {
                return cbEvent.courseNumber === course && cbEvent.selected && areEventsOverlapping(cbEvent, event);
            });

            return conflictingEvent.length > 0;
        }
    };

    CourseCalendar.prototype.previewCourse = function (course) {
        var that = this;
        var calendar = that.element;

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

        $('.calendar-item-course-' + course, this.element).addClass('calendar-item-previewed');

        if (conflictedEvents.length > 0) {
            updateCalendarMaxDayAndTime(calendar);
        }
    };

    CourseCalendar.prototype.unpreviewCourse = function (course) {
        var that = this;
        var calendar = that.element;

        var removed = 0;

        calendar.fullCalendar('removeEvents', function (event) {
            if (event.temporary && event.courseNumber === course) {
                removed++;
                return true;
            } else {
                return false;
            }
        });

        $('.calendar-item-course-' + course, this.element).removeClass('calendar-item-previewed');

        if (removed > 0) {
            updateCalendarMaxDayAndTime(calendar);
        }
    };

    CourseCalendar.prototype.loadSavedSchedule = function (schedule, customEvents) {
        var that = this;
        var calendar = that.element;

        calendar.fullCalendar('removeEvents', function () {
            return true;
        });

        var events = [];
        Object.keys(schedule).forEach(function (course) {
            events = events.concat(initCreateCourseEvents(that, course));
        });

        Object.keys(schedule).forEach(function (course) {
            var lessons = schedule[course];
            Object.keys(lessons).forEach(function (lessonType) {
                var lessonNumber = lessons[lessonType];
                initSelectLesson(events, course, lessonType, lessonNumber);
            });
        });

        Object.keys(customEvents).forEach(function (eventId) {
            var eventData = customEvents[eventId];
            var start = calendar.fullCalendar('getCalendar').moment(eventData.start);
            var end = calendar.fullCalendar('getCalendar').moment(eventData.end);
            events.push(makeCustomEvent(that, 'custom_event_' + eventId, eventData.title, start, end));
        });

        calendar.fullCalendar('renderEvents', events);
        updateCalendarMaxDayAndTime(calendar);

        Object.keys(schedule).forEach(function (course) {
            if (getCourseConflictedStatus(calendar, course)) {
                that.onCourseConflictedStatusChanged(course, true);
            }
        });
    };

    CourseCalendar.prototype.saveAsIcs = function (icsCal, dateFrom, dateTo) {
        var that = this;
        var calendar = that.element;

        var dateFromArray = dateFrom.split('-');
        var dateFromObject = {
            year: parseInt(dateFromArray[0], 10),
            month: parseInt(dateFromArray[1], 10) - 1,
            date: parseInt(dateFromArray[2], 10)
        };

        var until = moment.utc(dateTo + 'T00:00:00').add(1, 'days').format();
        var rrule = {freq: 'WEEKLY', until: until};

        var count = 0;

        calendar.fullCalendar('clientEvents', function (event) {
            if (event.start.week() === 1 && event.selected) {
                var subject = '';
                var description = '';
                var location = '';
                if (event.courseNumber !== null) {
                    var general = that.courseManager.getGeneralInfo(event.courseNumber);
                    var lesson = event.lessonData;

                    subject = that.courseManager.getLessonTypeAndNumber(lesson);
                    subject += ' - ' + general['שם מקצוע'];

                    description = '';
                    if (lesson['מרצה/מתרגל']) {
                        description = lesson['מרצה/מתרגל'];
                    }

                    location = '';
                    if (lesson['בניין']) {
                        location = lesson['בניין'];
                        if (lesson['חדר']) {
                            location += ' ' + lesson['חדר'];
                        }
                    }
                } else {
                    subject = event.title.replace(/\n/g, ', ');
                }

                var begin = event.start.clone().set(dateFromObject);
                var eventDay = event.start.day();

                // If setting the day will move us to the past, add 7 days
                // to move forward to the next week.
                if (eventDay < begin.day()) {
                    begin.add(7, 'days');
                }

                begin.day(eventDay);
                var end = event.end.clone().add(begin.diff(event.start), 'milliseconds');

                // https://stackoverflow.com/a/667274
                description = description.replace(/\n/g, '\\n');

                // Causes timezone to be added to the formatted string,
                // fixes a time shift issue in Safari.
                // https://stackoverflow.com/q/54210749
                begin.local();
                end.local();

                icsCal.addEvent(subject, description, location, begin.format(), end.format(), rrule);
                count++;
            }

            return false;
        });

        return count;
    };

    /**
     * Draws a dotted line on a jsPDF doc between two points.
     * Note that the segment length is adjusted a little so
     * that we end the line with a drawn segment and don't
     * overflow.
     */
    function dottedLine(doc, xFrom, yFrom, xTo, yTo, segmentLength)
    {
        // Calculate line length (c)
        var a = Math.abs(xTo - xFrom);
        var b = Math.abs(yTo - yFrom);
        var c = Math.sqrt(Math.pow(a,2) + Math.pow(b,2));

        // Make sure we have an odd number of line segments (drawn or blank)
        // to fit it nicely
        var fractions = c / segmentLength;
        var adjustedSegmentLength = (Math.floor(fractions) % 2 === 0) ? (c / Math.ceil(fractions)) : (c / Math.floor(fractions));

        // Calculate x, y deltas per segment
        var deltaX = adjustedSegmentLength * (a / c);
        var deltaY = adjustedSegmentLength * (b / c);

        var curX = xFrom, curY = yFrom;
        while (curX <= xTo && curY <= yTo)
        {
            doc.line(curX, curY, curX + deltaX, curY + deltaY);
            curX += 2*deltaX;
            curY += 2*deltaY;
        }
    }

    /**
     * Exports the calendar to a direct PDF download
     * @param {string} title 
     * @param {string} subtitle 
     * @param {string} pdfFilename 
     */
    CourseCalendar.prototype.saveAsPDF = function(title, subtitle, pdfFilename) {

        // calendar object
        var calendar = this.element;

        // number of rows the calendar will use for a single hour
        var rowsPerHour = 4;

        // smallest hour fraction
        var hourFrac = 1 / rowsPerHour;

        // calculate calendar time boundaries
        var timeBoundaries = getCalendarTimeBoundaries(calendar, true);
        var maxDay = timeBoundaries.maxDay;
        var minTime = timeBoundaries.minTime.hour() + timeBoundaries.minTime.minute() / 60;
        var maxTime = timeBoundaries.maxTime.hour() + timeBoundaries.maxTime.minute() / 60;

        // always start from an half-hour
        minTime = (timeBoundaries.minTime.minute() < 30 ? Math.trunc(minTime)-1 : Math.trunc(minTime)) + 0.5;

        // always end at a full-hour
        maxTime = (timeBoundaries.maxTime.minute() < 30 ? Math.trunc(maxTime) : Math.trunc(maxTime) + 1) + 0.5;

        // the index of the last table-body row
        var lastRowIndex = (maxTime - minTime) * rowsPerHour - 1;

        // will contain all calendar events
        var events = {};

        // table headers
        var tableHeaders = [
            "",
            "ראשון",
            "שני",
            "שלישי",
            "רביעי",
            "חמישי",
            "שישי",
            "שבת"
        ].map(function(day) {
            return {
                content: day,
                styles: {
                    textColor: "#212529",
                    fillColor: "white",
                    fontSize: 8
                }
            }
        });

        // remove the last days of the week if they are not in the calendar
        tableHeaders = tableHeaders.slice(0, 2 + maxDay);

        // table rows
        var tableRows = [];
        
        // extract the required event information from the current calendar
        calendar.fullCalendar('clientEvents', function (event) {

            // consider only selected events
            if (event.start.week() === 1 && event.selected) {

                var day = event.start.day();
                var start = event.start.hour() + event.start.minute() / 60;
                var end = event.end.hour() + event.end.minute() / 60;
                var title = event.title;
                var bgcolor = event.backgroundColor;

                // each event will have a unique key in a <day>-<hour> format
                var eventKey = String(day)+"-"+String(start);

                events[eventKey] = {
                    title: title,
                    bgcolor: bgcolor,
                    day: day,
                    start: start,
                    end: end
                };
            }
            return false;
        });

        // a list of days
        // each day is a dictinary that has a key for a "used" hour
        // for example { 9.5: true } means in 9.5 there is an event
        var hoursUsed = [{}, {}, {}, {}, {}, {}, {}]; // an entry for each day

        // for each row
        for(var hour = minTime; hour < maxTime; hour += hourFrac) {

            // a new empty row
            var row = [];

            // minutes of the event
            var minutesFraction = hour - Math.trunc(hour)

            var isHalfHour = minutesFraction == 0.5;
            var isFullHour = minutesFraction == 0;

            // first column creation
            // *:30
            if(isHalfHour) {

                // an hour cell (like 8:30) which has a rowSpan of 2
                row.push({
                    content: (String(Math.trunc(hour))+":30").split("").reverse().join(""), // string reverse because of RTL problems
                    rowSpan: rowsPerHour/2
                });
            }
            // *:00
            else if(isFullHour) {

                // the second part of an hour cell which has a rowSpan of 2 and no content
                row.push({
                    content: "",
                    rowSpan: rowsPerHour/2
                });
            }

            // for each day (other columns creation)
            for(var day = 0; day <= maxDay; ++day) {

                // if the hour is already filled with an event, do not create the cell
                // because it is already created with a rowSpan > 1
                if(hour in hoursUsed[day])
                    continue;

                // initialize an empty cell
                var cell = {
                    content: "",
                    styles: {}
                }

                var eventKey = String(day) + "-" + String(hour);

                // if there is an event at this hour
                if(eventKey in events) {

                    // to set a text with autotable plugin we should use "content" instead of "text"
                    // we use text so it won't render it but only save this property for our custom render later
                    cell["text"] = events[eventKey].title;

                    // this is also a custom property which will be used later in our custom render function 
                    cell["bgColor"] = events[eventKey].bgcolor;

                    // row-span of the event
                    cell["rowSpan"] = (events[eventKey].end-events[eventKey].start) * rowsPerHour;

                    // fill the hours of the event in our dictionary to prevent the addition of extra cells 
                    for(var i=events[eventKey].start; i<events[eventKey].end; i += 0.25)
                        hoursUsed[day][i] = true;
                }

                row.push(cell);
            }

            tableRows.push(row);
        }

        // here we start the PDF generation

        // jsPDF object with a landscape orientation
        var pdf = new jsPDF({
            orientation: "landscape"
        })

        // support for Hebrew font and RTL
        pdf.setR2L(true);
        pdf.addFileToVFS('Rubik-normal.ttf', fontNormal);
        pdf.addFont('Rubik-normal.ttf', 'Rubik', 'normal');
        pdf.addFileToVFS('Rubik-bold.ttf', fontBold);
        pdf.addFont('Rubik-bold.ttf', 'Rubik', 'bold');
        pdf.setFont('Rubik');

        // logo
        var logo = new Image();
        logo.src = "logo.png";
        pdf.setR2L(false);
        pdf.setFontSize(8);
        pdf.text("CheeseFork", 5, 8);
        pdf.setR2L(true);
        pdf.addImage(logo, 'PNG', 21, 5, 15, 6);

        // title
        pdf.setFontSize(25);
        pdf.myText(title, 100, 15, {
            align: "center"
        });

        // subtitle
        pdf.setFontSize(12);
        pdf.myText(subtitle, 100, 25, {
            align: "center"
        });

        var columnStyles = {};
        columnStyles[maxDay+1] = {
            cellWidth: 10
        };

        // calendar table
        pdf.autoTable({
            head: [tableHeaders.reverse()], // reverse because of RTL
            body: tableRows.map(function(row) {return row.reverse()}), // reverse because of RTL
            theme: 'grid',
            startY: 30,
            styles: { // basic table styles
                font: "Rubik",
                halign: "center",
                fontSize: 6,
                lineWidth: 0,
                valign: "top",
                textColor: "black",
                fillColor: "white"
            },
            headStyles: { // basic table header styles
                lineWidth: 0.1,
                textColor: "black",
                fillColor: "white"
            },
            columnStyles: columnStyles,
            // this method is being called after each cell renderning
            didDrawCell: function(hookData) {

                var cell = hookData.cell;
                var row = hookData.row;
                var col = hookData.column;
                var doc = hookData.doc;
                
                doc.setLineWidth(0.1);

                // if we are in the table-body
                if(hookData.section == "body") {

                    row.height = 2.5; // a number that works well
                    cell.height = 2.5 * cell.rowSpan;

                    // an event cell
                    if("bgColor" in cell.raw) {

                        // render the background
                        doc.setFillColor(cell.raw.bgColor);
                        doc.rect(cell.x+0.2, cell.y+0.2, cell.width-0.4, cell.height-0.4, 'F');
                        doc.setFillColor("white");

                        // render the text
                        var halfLineHeight = doc.getLineHeight() * (1/1.25)/2; // magic numbers from https://github.com/MrRio/jsPDF/issues/1573
                        var nLines = cell.raw.text.split("\n").length;

                        doc.setTextColor("white");
                        doc.text(cell.raw.text,
                            cell.x+cell.width/2,
                            cell.y+cell.height/2 - (nLines>1)*halfLineHeight + (nLines==1)*0.75, {
                                align: "center",
                            });
                        doc.setTextColor("black");
                    }

                    // right cell border
                    doc.line(cell.x+cell.width, cell.y, cell.x+cell.width, cell.y+cell.height);

                    // left cell border
                    doc.line(cell.x, cell.y, cell.x, cell.y+cell.height);

                    // if time is *:30
                    if(row.index % 4 == 0) {
                        // top cell border
                        doc.line(cell.x, cell.y, cell.x+cell.width, cell.y);
                    }
                    // if time is *:00
                    else if(row.index % 4 == 2) {
                        // top border
                        dottedLine(doc, cell.x, cell.y, cell.x+cell.width-0.2, cell.y, 0.2);
                    }

                    // if it is the last row
                    if(row.index == lastRowIndex || row.index == lastRowIndex-1 && col.index == maxDay+1) {
                        // bottom border
                        doc.line(cell.x, cell.y+cell.height, cell.x+cell.width, cell.y+cell.height);
                    }
                }
            }
        });

        pdf.save(pdfFilename);
    }

    CourseCalendar.prototype.removeAll = function () {
        var that = this;
        var calendar = that.element;

        calendar.fullCalendar('removeEvents', function () {
            return true;
        });

        updateCalendarMaxDayAndTime(calendar);
    };

    return CourseCalendar;
})();
