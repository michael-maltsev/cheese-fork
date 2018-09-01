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
                    match = /^מתרגל[ית]? הסדנ(?:א|ה|אות).*?:\s*(.*?)$/m.exec(comment);
                    if (match !== null) {
                        sadnaotTa = match[1];
                    }

                    var sadnaot = [];
                    var sadnaId = 101;
                    var match;
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
