'use strict';

/* global moment, BooleanExpression */

function CourseManager(allCourses) {
    var that = this;

    that.coursesHashmap = {};

    allCourses.forEach(function (item) {
        var courseNumber = item.general['מספר מקצוע'];
        that.coursesHashmap[courseNumber] = item;
    });

    that.coursesScheduleProcessed = {};
}

CourseManager.prototype.doesExist = function (course) {
    return course in this.coursesHashmap;
};

CourseManager.prototype.getAllCourses = function () {
    return Object.keys(this.coursesHashmap);
};

CourseManager.prototype.getCourseData = function (course) {
    return this.coursesHashmap[course];
};

CourseManager.prototype.getGeneralInfo = function (course) {
    return this.coursesHashmap[course].general;
};

CourseManager.prototype.getSchedule = function (course) {
    var that = this;

    if (!that.coursesScheduleProcessed[course]) {
        that.coursesHashmap[course].schedule = processSchedule(course);
        that.coursesScheduleProcessed[course] = true;
    }

    return that.coursesHashmap[course].schedule;

    function processSchedule(course) {
        var general = that.coursesHashmap[course].general;
        var schedule = that.coursesHashmap[course].schedule;

        if (general['הערות']) {
            // Extract workshops from course comments.
            var comment = general['הערות'];

            // Fix common typos.
            // Examples:
            // Semester 201702, course 044198: מתרגלת הסנא
            // Semester 202001, course 044137: סדאות רשות
            comment = comment.replace(/(^|[^א-ת])(ה?ס)(דנ|ד|נ)(א|ה|אות)($|[^א-ת])/g, '$1$2דנ$4$5');

            // Add a newline for a single workshop.
            comment = comment.replace(/^(סדנת רשות:)\s*(ב?ימי|יום)(\s)/mg, '$1\n$2$3');

            var commentLines = comment.split('\n');
            for (var i = 0; i < commentLines.length; i++) {
                var line = commentLines[i];
                if (line.match(/^סדנ(ת|ה|א|אות)[: ]/)) {
                    var workshopsTa = '';
                    var match = /(?:\n|^)מתרגל[ית]? ה?סדנ(?:א|ה|אות).*?:\s*([\s\S]*?)\s*(?:=|$)/.exec(comment);
                    if (match) {
                        workshopsTa = match[1].replace(/\s+/g, ' ').replace(/(\((גם אחראי[תם]?|\d+)\)\s*)+,?/g, ',').replace(/\s*,\s*/g, '\n').trim();
                    }

                    var workshops = [];
                    var workshopId = 101;
                    for (i++; i < commentLines.length; i++) {
                        line = commentLines[i];
                        match = /^ב?(?:ימי|יום) ([א-ת]+)'?,?\s*(\d+)\.(\d+)-(\d+)\.(\d+)(?:\s*,\s*(.*?)(?:\s+(\d+))?(?:\s*,\s*(.*?))?)?$/.exec(line);
                        if (!match) {
                            break;
                        }

                        var dayMapping = {
                            'ראשון': 'ראשון',
                            'שני': 'שני',
                            'שלישי': 'שלישי',
                            'רביעי': 'רביעי',
                            'חמישי': 'חמישי',
                            'שישי': 'שישי',
                            'א': 'ראשון',
                            'ב': 'שני',
                            'ג': 'שלישי',
                            'ד': 'רביעי',
                            'ה': 'חמישי',
                            'ו': 'שישי'
                        };
                        var day = dayMapping[match[1]];
                        if (!day) {
                            break;
                        }

                        // If the TA name is a number, it's not a TA name but a room number.
                        if (match[6] && !match[7] && match[8] && /^\d+$/.test(match[8])) {
                            match[7] = match[8];
                            match[8] = null;
                        }

                        var building = match[6] || '';
                        switch (building) {
                        case 'פ\'':
                            building = 'פישבך';
                            break;

                        case 'מ\'':
                            building = 'מאייר';
                            break;
                        }

                        var startTime = match[2] + ':' + match[3];
                        var endTime = match[4] + ':' + match[5];
                        var time = startTime + ' - ' + endTime;

                        // Make sure the start time is before the end time.
                        var timeParsed = that.parseLessonTime(time);
                        if (timeParsed.end !== '00:00' && timeParsed.start > timeParsed.end) {
                            time = endTime + ' - ' + startTime;
                        }

                        workshops.push({
                            'קבוצה': workshopId,
                            'מס.': workshopId,
                            'סוג': 'sadna',
                            'מרצה/מתרגל': match[8] || workshopsTa,
                            'יום': day,
                            'שעה': time,
                            'בניין': building,
                            'חדר': match[7] || ''
                        });
                        workshopId++;
                    }

                    if (workshops.length > 0) {
                        schedule = schedule.concat(workshops);
                    }

                    break;
                }
            }
        }

        return schedule;
    }
};

CourseManager.prototype.getTitle = function (course) {
    var general = this.coursesHashmap[course].general;
    return general['מספר מקצוע'] + ' - ' + general['שם מקצוע'];
};

CourseManager.prototype.getDescription = function (course, options) {
    var general = this.coursesHashmap[course].general;
    var header = general['מספר מקצוע'] + ' - ' + general['שם מקצוע'];

    if (general['פקולטה']) {
        header += '\nפקולטה: ' + general['פקולטה'];
    }

    if (general['מסגרת לימודים']) {
        header += '\nמסגרת לימודים: ' + general['מסגרת לימודים'].replace(/\n/g, ', ');
    }

    if (general['נקודות']) {
        header += '\nנקודות: ' + general['נקודות'];
    }

    var content = '';

    if (general['סילבוס']) {
        content += '\n\n' + general['סילבוס'];
    }

    if (options.relatedCourseInfo) {
        var relatedCourseKeys = [
            'מקצועות קדם',
            'מקצועות צמודים',
            'מקצועות זהים',
            'מקצועות ללא זיכוי נוסף (מוכלים)',
            'מקצועות ללא זיכוי נוסף (מכילים)',
            'מקצועות ללא זיכוי נוסף'
        ];
        relatedCourseKeys.forEach(function (key) {
            if (general[key]) {
                var value = general[key];
                value = value
                    .replace(/(ו-)\s+/g, '$1')
                    .replace(/(\()\s+/g, '$1')
                    .replace(/\s+(\))/g, '$1')
                    .replace(/\s+/g, ' ') // replaces &nbsp; and multiple spaces with a single space
                    .trim();
                content += '\n\n' + key + ': ' + value;
            }
        });
    }

    if (general['אחראים']) {
        content += '\n\nאחראים: ' + general['אחראים'];
    }

    var pre_exam_content = '';
    [
        'בוחן מועד א',
        'בוחן מועד ב',
        'בוחן מועד ג',
        'בוחן מועד ד',
        'בוחן מועד ה'
    ].forEach(function (key) {
        if (general[key]) {
            pre_exam_content += '\n' + key + '\': ' + general[key].replace(/\n\n/g, '\n========\n');
        }
    });

    if (pre_exam_content) {
        content += '\n' + pre_exam_content;
    }

    var exam_content = '';
    [
        'מועד א',
        'מועד ב',
        'מועד ג'
    ].forEach(function (key) {
        if (general[key]) {
            exam_content += '\n' + key + '\': ' + general[key].replace(/\n\n/g, '\n========\n');
        }
    });

    if (exam_content) {
        content += '\n' + exam_content;
    }

    if (general['הערות']) {
        content += '\n\nהערות: ' + general['הערות'];
    }

    if (!options.html) {
        return header + content;
    }

    var headerHtml = $('<div>').text(header).html().replace(/\n/g, '<br>');
    var linksHtml = '';
    var contentHtml = $('<div>').text(content).html().replace(/\n/g, '<br>');

    if (options.links) {
        var loggingProps = options.logging ? ' onclick="gtag(\'event\', \'info-click-link-rishum\')"' : '';
        linksHtml += '<br><br><a href="https://students.technion.ac.il/local/technionsearch/course/' + course + '" target="_blank" rel="noopener"' + loggingProps + '>' +
            '<img src="assets/icon-students.png" alt="icon" width="16" height="16"> פורטל הסטודנטים</a>';

        if (/^23\d\d\d\d$/.test(course)) {
            // Only for computer science courses.
            loggingProps = options.logging ? ' onclick="gtag(\'event\', \'info-click-link-webcourse\')"' : '';
            linksHtml += '<br><a href="https://webcourse.cs.technion.ac.il/' + course + '/" target="_blank" rel="noopener"' + loggingProps + '>' +
                '<img src="assets/icon-webcourse.png" alt="icon" width="16" height="16"> אתר ה-WebCourse</a>';
        }

        loggingProps = options.logging ? ' onclick="gtag(\'event\', \'info-click-link-facebook\')"' : '';
        linksHtml += '<br><a href="https://www.facebook.com/search/groups/?q=' + course + '" target="_blank" rel="noopener"' + loggingProps + '>' +
            '<img src="assets/icon-facebook.png" alt="icon" width="16" height="16"> חיפוש קבוצה בפייסבוק</a>';

        loggingProps = options.logging ? ' onclick="gtag(\'event\', \'info-click-link-tscans\')"' : '';
        linksHtml += '<br><a href="https://tscans.cf/?course=' + course + '" target="_blank" rel="noopener"' + loggingProps + '>' +
            '<img src="assets/icon-scans.png" alt="icon" width="16" height="16"> סריקות</a>';

        if (options.whatsappGroupLink) {
            loggingProps = options.logging ? ' onclick="gtag(\'event\', \'info-click-link-whatsapp\')"' : '';
            linksHtml += '<br><a href="#" class="whatsapp-group-link"' + loggingProps + '>' +
                '<img src="assets/icon-whatsapp.png" alt="icon" width="16" height="16"> קבוצת וואטסאפ/טלגרם</a>';
        }
    }

    return headerHtml + linksHtml + contentHtml;
};

CourseManager.prototype.getLessonType = function (lesson) {
    if (lesson['סוג'] === 'sadna') {
        return 'סדנה';
    }
    return lesson['סוג'];
};

CourseManager.prototype.getLessonTypeAndNumber = function (lesson) {
    if (lesson['סוג'] === 'sadna') {
        // No number since that's our addition to the schedule.
        // We assume only one workshop can be selected.
        return 'סדנה';
    }
    return lesson['סוג'] + ' ' + lesson['מס.'];
};

CourseManager.prototype.parseExamDateTime = function (strDate) {
    var match = /^(\d+)-(\d+)-(\d+)(?:\s+(\d+)(:\d+)\s*-\s*(\d+)(:\d+))?/.exec(strDate);
    if (!match) {
        match = /^בתאריך (\d+)\.(\d+)\.(\d+) (?:יום [א-ו] משעה (\d+)(:\d+)? עד השעה (\d+)(:\d+)?)?/.exec(strDate);
    }

    if (!match) {
        return null;
    }

    var date = match[3] + '-' + match[2] + '-' + match[1];

    var startHour = '00';
    if (match[4] !== undefined) {
        startHour = ('00' + match[4]).slice(-2);
    }
    var startMinute = '00';
    if (match[5] !== undefined) {
        startMinute = (match[5] + '00').slice(1, 3);
    }
    var start = date + 'T' + startHour + ':' + startMinute + ':00';

    var endHour = '00';
    if (match[6] !== undefined) {
        endHour = ('00' + match[6]).slice(-2);
    }
    var endMinute = '00';
    if (match[7] !== undefined) {
        endMinute = (match[7] + '00').slice(1, 3);
    }
    var end = date + 'T' + endHour + ':' + endMinute + ':00';

    return {start: start, end: end};
};

CourseManager.prototype.parseLessonTime = function (strTime) {
    var match = /^(\d+)(:\d+)? - (\d+)(:\d+)?$/.exec(strTime);
    if (!match) {
        return null;
    }

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

    return {start: start, end: end};
};

CourseManager.prototype.filterCourses = function (filters) {
    var that = this;
    var filtered = [];
    var i;

    var moedAMin = filters.moedAMin ? moment.utc(filters.moedAMin).set({hour: 0, minute: 0, second: 0}) : null;
    var moedAMax = filters.moedAMax ? moment.utc(filters.moedAMax).set({hour: 0, minute: 0, second: 0}) : null;
    var moedBMin = filters.moedBMin ? moment.utc(filters.moedBMin).set({hour: 0, minute: 0, second: 0}) : null;
    var moedBMax = filters.moedBMax ? moment.utc(filters.moedBMax).set({hour: 0, minute: 0, second: 0}) : null;

    var currentMoedADates = [];
    if (filters.moedADaysMin && filters.coursesCurrent) {
        filters.coursesCurrent.forEach(function (course) {
            var general = that.coursesHashmap[course].general;
            if (general['מועד א']) {
                var dateTimeA = that.parseExamDateTime(general['מועד א']);
                if (dateTimeA) {
                    var moedA = moment.utc(dateTimeA.start).set({hour: 0, minute: 0, second: 0});
                    currentMoedADates.push(moedA);
                }
            }
        });
    }

    var currentMoedBDates = [];
    if (filters.moedBDaysMin && filters.coursesCurrent) {
        filters.coursesCurrent.forEach(function (course) {
            var general = that.coursesHashmap[course].general;
            if (general['מועד ב']) {
                var dateTimeB = that.parseExamDateTime(general['מועד ב']);
                if (dateTimeB) {
                    var moedB = moment.utc(dateTimeB.start).set({hour: 0, minute: 0, second: 0});
                    currentMoedBDates.push(moedB);
                }
            }
        });
    }

    Object.keys(that.coursesHashmap).forEach(function (course) {
        var general = that.coursesHashmap[course].general;

        if (filters.coursesLimit && filters.coursesLimit.indexOf(course) === -1) {
            return;
        }

        if (filters.coursesExclude && filters.coursesExclude.indexOf(course) !== -1) {
            return;
        }

        if (filters.faculties && general['פקולטה'] && filters.faculties.indexOf(general['פקולטה']) === -1) {
            return;
        }

        if (filters.frameworks && general['מסגרת לימודים']) {
            var frameworkMatch = general['מסגרת לימודים'].split('\n').some(function (item) {
                return filters.frameworks.indexOf(item) !== -1;
            });
            if (!frameworkMatch) {
                return;
            }
        }

        if (general['נקודות']) {
            var points = parseFloat(general['נקודות']);
            if (filters.pointsMin !== undefined && points < filters.pointsMin) {
                return;
            }
            if (filters.pointsMax !== undefined && points > filters.pointsMax) {
                return;
            }
        }

        if (filters.filterPrerequisites && general['מקצועות קדם']) {
            if (!filters.coursesTaken) {
                return;
            }

            var booleanExpression = general['מקצועות קדם'].replace(/\s/g, '').replace(/או/g, ' OR ').replace(/ו-/g, ' AND ');
            if (!new BooleanExpression(booleanExpression).test(filters.coursesTaken)) {
                return;
            }
        }

        if (filters.filterLinkedCourses && general['מקצועות צמודים']) {
            if (!filters.coursesTaken && !filters.coursesCurrent) {
                return;
            }

            var linkedCourses = general['מקצועות צמודים'].match(/\d+/g);
            if (linkedCourses) {
                for (i = 0; i < linkedCourses.length; i++) {
                    if ((filters.coursesTaken && filters.coursesTaken.indexOf(linkedCourses[i]) === -1) ||
                        (filters.coursesCurrent && filters.coursesCurrent.indexOf(linkedCourses[i]) === -1)) {
                        // OK, was taken or taking now.
                    } else {
                        return;
                    }
                }
            }
        }

        if (filters.filterOverlappingCourses && (filters.coursesTaken || filters.coursesCurrent)) {
            // If we've already taken this course, it's kinda trivially overlapping.
            if (filters.coursesTaken && filters.coursesTaken.indexOf(course) !== -1) {
                return;
            }
            if (filters.coursesCurrent && filters.coursesCurrent.indexOf(course) !== -1) {
                return;
            }

            var overlappingCourses = [];
            var overlappingCoursesKeys = [
                'מקצועות זהים',
                'מקצועות ללא זיכוי נוסף (מוכלים)',
                'מקצועות ללא זיכוי נוסף (מכילים)',
                'מקצועות ללא זיכוי נוסף'
            ];

            overlappingCoursesKeys.forEach(function (key) {
                if (general[key]) {
                    var overlappingCoursesPart = general[key].match(/\d+/g);
                    if (overlappingCoursesPart) {
                        overlappingCourses = overlappingCourses.concat(overlappingCoursesPart);
                    }
                }
            });

            for (i = 0; i < overlappingCourses.length; i++) {
                if (filters.coursesTaken && filters.coursesTaken.indexOf(overlappingCourses[i]) !== -1) {
                    return;
                }
                if (filters.coursesCurrent && filters.coursesCurrent.indexOf(overlappingCourses[i]) !== -1) {
                    return;
                }
            }
        }

        if ((moedAMin || moedAMax || filters.moedADaysMin) && general['מועד א']) {
            var dateTimeA = that.parseExamDateTime(general['מועד א']);
            if (dateTimeA) {
                var moedA = moment.utc(dateTimeA.start).set({hour: 0, minute: 0, second: 0});
                if ((moedAMin && moedA.isBefore(moedAMin)) || (moedAMax && moedA.isAfter(moedAMax))) {
                    return;
                }

                if (filters.moedADaysMin) {
                    for (i = 0; i < currentMoedADates.length; i++) {
                        if (Math.abs(moedA.diff(currentMoedADates[i], 'days')) < filters.moedADaysMin) {
                            return;
                        }
                    }
                }
            }
        }

        if ((moedBMin || moedBMax || filters.moedBDaysMin) && general['מועד ב']) {
            var dateTimeB = that.parseExamDateTime(general['מועד ב']);
            if (dateTimeB) {
                var moedB = moment.utc(dateTimeB.start).set({hour: 0, minute: 0, second: 0});
                if ((moedBMin && moedB.isBefore(moedBMin)) || (moedBMax && moedB.isAfter(moedBMax))) {
                    return;
                }

                if (filters.moedBDaysMin) {
                    for (i = 0; i < currentMoedBDates.length; i++) {
                        if (Math.abs(moedB.diff(currentMoedBDates[i], 'days')) < filters.moedBDaysMin) {
                            return;
                        }
                    }
                }
            }
        }

        if (filters.filterWithExam && (general['מועד א'] || general['מועד ב'])) {
            return;
        }

        if (filters.filterWithoutExam && !general['מועד א'] && !general['מועד ב']) {
            return;
        }

        filtered.push(course);
    });

    return filtered;
};
