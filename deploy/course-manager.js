'use strict';

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
            // Extract sadnaot from course comments.
            var comment = general['הערות'];
            var commentLines = comment.split('\n');
            for (var i = 0; i < commentLines.length; i++) {
                var line = commentLines[i];
                // Check if the line starts with a required prefix.
                // https://stackoverflow.com/a/4579228
                if (line.lastIndexOf('סדנאות', 0) === 0 || line.lastIndexOf('סדנת', 0) === 0) {
                    var sadnaotTa = '';
                    var match = /^מתרגל[ית]? הסדנ(?:א|ה|אות).*?:\s*(.*?)$/m.exec(comment);
                    if (match !== null) {
                        sadnaotTa = match[1];
                    }

                    var sadnaot = [];
                    var sadnaId = 101;
                    for (i++; i < commentLines.length; i++) {
                        line = commentLines[i];
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
                            'קבוצה': sadnaId,
                            'מס.': sadnaId,
                            'סוג': 'sadna',
                            'מרצה\/מתרגל': match[8] || sadnaotTa,
                            'יום': match[1],
                            'שעה': match[2] + ':' + match[3] + ' - ' + match[4] + ':' + match[5],
                            'בניין': building,
                            'חדר': match[7]
                        });
                        sadnaId++;
                    }

                    if (sadnaot) {
                        schedule = schedule.concat(sadnaot);
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

CourseManager.prototype.getDescription = function (course) {
    var general = this.coursesHashmap[course].general;
    var text = general['מספר מקצוע'] + ' - ' + general['שם מקצוע'];

    if (general['פקולטה']) {
        text += '\nפקולטה: ' + general['פקולטה'];
    }

    if (general['נקודות']) {
        text += '\nנקודות: ' + general['נקודות'];
    }

    if (general['סילבוס']) {
        text += '\n\n' + general['סילבוס'];
    }

    if (general['אחראים']) {
        text += '\n\nאחראים: ' + general['אחראים'];
    }

    if (general['מועד א'] || general['מועד ב']) {
        text += '\n';
        if (general['מועד א']) {
            text += '\nמועד א\': ' + general['מועד א'];
        }
        if (general['מועד ב']) {
            text += '\nמועד ב\': ' + general['מועד ב'];
        }
    }

    if (general['הערות']) {
        text += '\n\nהערות: ' + general['הערות'];
    }

    return text;
};

CourseManager.prototype.getLessonTypeAndNumber = function (lesson) {
    if (lesson['סוג'] === 'sadna') {
        // No number since that's our addition to the schedule.
        // We assume only one sadna can be selected.
        return 'סדנה';
    }
    return lesson['סוג'] + ' ' + lesson['מס.'];
};

CourseManager.prototype.parseExamDateTime = function (strDate) {
    var match = /^בתאריך (\d+)\.(\d+)\.(\d+) (?:יום [א-ו] משעה (\d+)(:\d+)? עד השעה (\d+)(:\d+)?)?/.exec(strDate);
    if (match === null) {
        return null;
    }

    var date =  match[3] + '-' + match[2] + '-' + match[1];

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
