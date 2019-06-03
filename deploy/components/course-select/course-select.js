'use strict';

/* global moment, BootstrapDialog, gtag */

var CourseSelect = (function () {
    function CourseSelect(element, options) {
        this.element = element;
        this.courseManager = options.courseManager;
        this.onItemAdd = options.onItemAdd;
        this.onDropdownItemActivate = options.onDropdownItemActivate;
        this.onDropdownItemDeactivate = options.onDropdownItemDeactivate;
        this.getSelectedCoursesForFilter = options.getSelectedCoursesForFilter;

        var that = this;

        var courses = that.courseManager.getAllCourses();
        that.allCoursesCount = courses.length;
        that.filteredCoursesCount = courses.length;

        that.filterDialog = null;

        that.courseSelect = element.addClass('course-select').selectize({
            //searchConjunction: 'or',
            options: makeCourseSelectOptions(courses.sort(), that.courseManager),
            maxOptions: 202,
            render: {
                option: function (item) {
                    if (item.value === 'filter') {
                        var text = 'סינון קורסים';

                        if (that.filteredCoursesCount < that.allCoursesCount) {
                            text += ' (' + that.filteredCoursesCount + '/' + that.allCoursesCount + ')';
                        }

                        return $('<div>').addClass('option font-weight-bold').text(text);
                    } else if (item.value === 'partial') {
                        return $('<div>').addClass('option font-italic').text('מציג 200 קורסים ראשונים');
                    }

                    var course = item.value;
                    var general = that.courseManager.getGeneralInfo(course);

                    var courseDescriptionHtml = that.courseManager.getDescription(course, {html: true});

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
                if (course === 'filter') {
                    that.filterOpen();
                } else if (course === 'partial') {
                    // Do nothing
                } else {
                    that.onItemAdd(course);
                }
                this.clear();
            },
            onDropdownItemActivate: function (course) {
                if (course === 'filter' || course === 'partial') {
                    return;
                }

                that.onDropdownItemActivate(course);
            },
            onDropdownItemDeactivate: function (course) {
                if (course === 'filter' || course === 'partial') {
                    return;
                }

                that.onDropdownItemDeactivate(course);
            }
        }).data('selectize');

        that.courseSelect.$dropdown
            .tooltip({selector: '[data-toggle=tooltip]'})
            .on('mousedown click', '[data-toggle=tooltip]', function () {
                $(this).tooltip('hide');
            });

        filterInit(that.courseManager);
    }

    function makeCourseSelectOptions(courses, courseManager) {
        var items = [{
            value: 'filter',
            text: ''
        }].concat(courses.map(function (course) {
            var general = courseManager.getGeneralInfo(course);
            return {
                value: course,
                text: course + ' - ' + general['שם מקצוע']
            };
        }));

        if (items.length > 202) {
            items.splice(201, 0, {
                value: 'partial',
                text: ''
            });
        }

        return items;
    }

    function filterInit(courseManager) {
        var faculties = {};
        var points = {};
        var moedAMin = null;
        var moedAMax = null;
        var moedBMin = null;
        var moedBMax = null;

        courseManager.getAllCourses().forEach(function (course) {
            var general = courseManager.getGeneralInfo(course);

            if (general['פקולטה']) {
                faculties[general['פקולטה']] = true;
            }

            if (general['נקודות']) {
                points[general['נקודות']] = true;
            }

            if (general['מועד א']) {
                var dateTimeA = courseManager.parseExamDateTime(general['מועד א']);
                if (dateTimeA) {
                    var moedA = moment.utc(dateTimeA.start).set({hour: 0, minute: 0, second: 0});
                    if (moedAMin === null || moedA.isBefore(moedAMin)) {
                        moedAMin = moedA;
                    }
                    if (moedAMax === null || moedA.isAfter(moedAMax)) {
                        moedAMax = moedA;
                    }
                }
            }

            if (general['מועד ב']) {
                var dateTimeB = courseManager.parseExamDateTime(general['מועד ב']);
                if (dateTimeB) {
                    var moedB = moment.utc(dateTimeB.start).set({hour: 0, minute: 0, second: 0});
                    if (moedBMin === null || moedB.isBefore(moedBMin)) {
                        moedBMin = moedB;
                    }
                    if (moedBMax === null || moedB.isAfter(moedBMax)) {
                        moedBMax = moedB;
                    }
                }
            }
        });

        faculties = Object.keys(faculties).sort();

        var selectFaculties = $('#filter-faculty');

        faculties.forEach(function (faculty) {
            selectFaculties.append($('<option>', {
                value: faculty,
                text: faculty
            }));
        });

        selectFaculties.selectize();

        var selectPointsMin = $('#filter-points-min');
        var selectPointsMax = $('#filter-points-max');

        points = Object.keys(points).sort(function (a, b) {
            return parseFloat(a) - parseFloat(b);
        });

        points.forEach(function (point, i) {
            selectPointsMin.append($('<option>', {
                value: point,
                text: point,
                selected: i === 0
            }));
            selectPointsMax.append($('<option>', {
                value: point,
                text: point,
                selected: i === points.length - 1
            }));
        });

        if (moedAMin && moedAMax) {
            var selectMoedAMin = $('#filter-moed-a-min');
            var selectMoedAMax = $('#filter-moed-a-max');

            var date, dateStrFull, dateStrShort;

            for (date = moedAMin.clone(); !date.isAfter(moedAMax); date.add(1, 'days')) {
                dateStrFull = date.format();
                dateStrShort = date.format('DD/MM');
                selectMoedAMin.append($('<option>', {
                    value: dateStrFull,
                    text: dateStrShort,
                    selected: date.isSame(moedAMin)
                }));
                selectMoedAMax.append($('<option>', {
                    value: dateStrFull,
                    text: dateStrShort,
                    selected: date.isSame(moedAMax)
                }));
            }

            selectMoedAMax.val(dateStrFull);
        }

        if (moedBMin && moedBMax) {
            var selectMoedBMin = $('#filter-moed-b-min');
            var selectMoedBMax = $('#filter-moed-b-max');

            for (date = moedBMin.clone(); !date.isAfter(moedBMax); date.add(1, 'days')) {
                dateStrFull = date.format();
                dateStrShort = date.format('DD/MM');
                selectMoedBMin.append($('<option>', {
                    value: dateStrFull,
                    text: dateStrShort,
                    selected: date.isSame(moedBMin)
                }));
                selectMoedBMax.append($('<option>', {
                    value: dateStrFull,
                    text: dateStrShort,
                    selected: date.isSame(moedBMax)
                }));
            }

            selectMoedBMax.val(dateStrFull);
        }
    }

    CourseSelect.prototype.filterOpen = function () {
        var that = this;

        gtag('event', 'course-select-filter-open');

        if (that.filterDialog) {
            that.filterDialog.open();
            return;
        }

        var filterForm = $('#filter-form');
        that.filterDialog = BootstrapDialog.show({
            cssClass: 'course-filter-dialog',
            title: 'סינון קורסים',
            message: filterForm,
            buttons: [{
                label: 'סינון',
                cssClass: 'btn-primary',
                action: function (dialog) {
                    gtag('event', 'course-select-filter-submit');

                    that.filterApply();
                }
            }, {
                label: 'איפוס',
                action: function (dialog) {
                    gtag('event', 'course-select-filter-reset');

                    that.filterReset();
                }
            }, {
                label: 'סגור',
                action: function (dialog) {
                    dialog.close();
                }
            }],
            autodestroy: false
        });

        var footer = that.filterDialog.getModalFooter();
        footer.css('flex-wrap', 'wrap');
        $('<span id="filter-result">').addClass('bootstrap-dialog-message')
            .css({'margin-bottom': '.25rem'}).prependTo(footer);

        filterForm.submit(function (event) {
            event.preventDefault();
            that.filterDialog.getModalFooter().find('button.btn-primary').click();
        });
    };

    CourseSelect.prototype.filterApply = function () {
        var that = this;

        var filters = {};

        var faculties = $('#filter-faculty').data('selectize').items;
        if (faculties.length > 0) {
            filters.faculties = faculties;
        }

        var selectPointsMin = $('#filter-points-min');
        // If not first which is already the minimum.
        if (selectPointsMin.prop('selectedIndex') > 0) {
            filters.pointsMin = parseFloat(selectPointsMin.val());
        }

        var selectPointsMax = $('#filter-points-max');
        // If not last which is already the maximum.
        if (selectPointsMax.prop('selectedIndex') < selectPointsMax.find('option').length - 1) {
            filters.pointsMax = parseFloat(selectPointsMax.val());
        }

        var coursesTaken = $('#filter-courses-taken-list').val().match(/\d+/g);
        if (coursesTaken) {
            filters.coursesTaken = coursesTaken.filter(function (num) {
                return parseInt(num, 10) <= 999999;
            }).map(function (num) {
                return ('000000' + num).slice(-6);
            });
        }

        filters.filterPrerequisites = $('#filter-prerequisites').prop('checked');
        filters.filterLinkedCourses = $('#filter-linked-courses').prop('checked');
        filters.filterOverlappingCourses = $('#filter-overlapping-courses').prop('checked');

        var selectMoedAMin = $('#filter-moed-a-min');
        if (selectMoedAMin.prop('selectedIndex') > 0) {
            filters.moedAMin = selectMoedAMin.val();
        }

        var selectMoedAMax = $('#filter-moed-a-max');
        if (selectMoedAMax.prop('selectedIndex') < selectMoedAMax.find('option').length - 1) {
            filters.moedAMax = selectMoedAMax.val();
        }

        var selectMoedBMin = $('#filter-moed-b-min');
        if (selectMoedBMin.prop('selectedIndex') > 0) {
            filters.moedBMin = selectMoedBMin.val();
        }

        var selectMoedBMax = $('#filter-moed-b-max');
        if (selectMoedBMax.prop('selectedIndex') < selectMoedBMax.find('option').length - 1) {
            filters.moedBMax = selectMoedBMax.val();
        }

        filters.moedADaysMin = parseInt($('#filter-moed-a-days-min').val(), 10);
        filters.moedBDaysMin = parseInt($('#filter-moed-b-days-min').val(), 10);

        filters.filterWithExam = $('#filter-with-exam').prop('checked');
        filters.filterWithoutExam = $('#filter-without-exam').prop('checked');

        var coursesLimit = $('#filter-courses-limit').val().match(/\d+/g);
        if (coursesLimit) {
            filters.coursesLimit = coursesLimit.filter(function (num) {
                return parseInt(num, 10) <= 999999;
            }).map(function (num) {
                return ('000000' + num).slice(-6);
            });
        }

        var coursesExclude = $('#filter-courses-exclude').val().match(/\d+/g);
        if (coursesExclude) {
            filters.coursesExclude = coursesExclude.filter(function (num) {
                return parseInt(num, 10) <= 999999;
            }).map(function (num) {
                return ('000000' + num).slice(-6);
            });
        }

        var selectedCourses = that.getSelectedCoursesForFilter();
        if (selectedCourses.length > 0) {
            filters.coursesCurrent = selectedCourses;
        }

        var filtered = that.courseManager.filterCourses(filters);
        that.filteredCoursesCount = filtered.length;

        that.courseSelect.clearOptions();
        that.courseSelect.addOption(makeCourseSelectOptions(filtered.sort(), that.courseManager));

        if (that.filterDialog) {
            var messageElement = that.filterDialog.getModalFooter().find('#filter-result');
            messageElement.text('מציג ' + that.filteredCoursesCount + ' מתוך ' + that.allCoursesCount + ' קורסים');
        }
    };

    CourseSelect.prototype.filterReset = function () {
        var that = this;

        $('#filter-form').trigger('reset');
        $('#filter-faculty').data('selectize').clear(); // selectize doesn't work with reset

        if (that.filteredCoursesCount < that.allCoursesCount) {
            that.courseSelect.clearOptions();
            that.courseSelect.addOption(makeCourseSelectOptions(that.courseManager.getAllCourses().sort(), that.courseManager));
            that.filteredCoursesCount = that.allCoursesCount;
        }

        if (that.filterDialog) {
            var messageElement = that.filterDialog.getModalFooter().find('#filter-result');
            messageElement.text('');
        }
    };

    return CourseSelect;
})();
