'use strict';

/* global moment, showBootstrapDialogWithModelessButton, currentSemester, gtag */

// eslint-disable-next-line no-unused-vars
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
            maxOptions: 201,
            render: {
                option: function (item) {
                    if (item.value === 'partial') {
                        return $('<div>').addClass('option font-italic').text('מציג 200 קורסים ראשונים').get(0);
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
            onInitialize: function () {
                addFilterButton(that, this);
            },
            onClear: function () {
                addFilterButton(that, this);
            },
            onItemAdd: function (course) {
                if (course === 'partial') {
                    // Do nothing
                } else {
                    that.onItemAdd(course);
                }
                this.clear();
            },
            onDropdownItemActivate: function (course) {
                if (course === 'partial') {
                    return;
                }

                that.onDropdownItemActivate(course);
            },
            onDropdownItemDeactivate: function (course) {
                if (course === 'partial') {
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

    function addFilterButton(courseSelect, selectize) {
        var title = 'לחצו כאן לסינון מתקדם של הקורסים המוצגים';
        var extraClass = '';
        if (courseSelect.filteredCoursesCount < courseSelect.allCoursesCount) {
            title += ' (' + courseSelect.filteredCoursesCount + '/' + courseSelect.allCoursesCount + ')';
            extraClass += ' course-select-filter-on';
        }

        selectize.$control.append($('<button>', {
            type: 'button',
            class: 'btn course-select-filter-button' + extraClass,
            html: '<i class="fas fa-sliders-h"></i>',
            title: title,
            'data-toggle': 'tooltip',
            'data-placement': 'bottom'
        }).tooltip().click(function (e) {
            e.stopPropagation();
            $(this).tooltip('hide');
            courseSelect.filterOpen();
        }).mousedown(function (e) {
            e.stopPropagation();
        }).mouseup(function (e) {
            e.stopPropagation();
        }));
    }

    function updateFilterButton(courseSelect, selectize) {
        var button = selectize.$control.find('button.course-select-filter-button');

        var title = 'לחצו כאן לסינון מתקדם של הקורסים המוצגים';
        if (courseSelect.filteredCoursesCount < courseSelect.allCoursesCount) {
            title += ' (' + courseSelect.filteredCoursesCount + '/' + courseSelect.allCoursesCount + ')';
            button.addClass('course-select-filter-on');
        } else {
            button.removeClass('course-select-filter-on');
        }

        button.attr('data-original-title', title);
    }

    function makeCourseSelectOptions(courses, courseManager) {
        var items = courses.map(function (course) {
            var general = courseManager.getGeneralInfo(course);
            return {
                value: course,
                text: course + ' - ' + general['שם מקצוע']
            };
        });

        if (items.length > 201) {
            items.splice(200, 0, {
                value: 'partial',
                text: ''
            });
        }

        return items;
    }

    function filterInit(courseManager) {
        var faculties = {};
        var frameworks = {};
        var points = {};
        var examDates = {
            'מועד א': {},
            'מועד ב': {}
        };

        var currentExamsYear = parseInt(currentSemester.slice(0, 4), 10) + 1;

        courseManager.getAllCourses().forEach(function (course) {
            var general = courseManager.getGeneralInfo(course);

            if (general['פקולטה']) {
                faculties[general['פקולטה']] = true;
            }

            if (general['מסגרת לימודים']) {
                general['מסגרת לימודים'].split('\n').forEach(function (item) {
                    frameworks[item] = true;
                });
            }

            if (general['נקודות']) {
                points[general['נקודות']] = true;
            }

            ['מועד א', 'מועד ב'].forEach(function (exam) {
                if (general[exam]) {
                    var dateTime = courseManager.parseExamDateTime(general[exam]);
                    if (dateTime) {
                        var day = moment.utc(dateTime.start).set({hour: 0, minute: 0, second: 0});
                        var year = day.year();
                        if (year === currentExamsYear) {
                            if (!examDates[exam].minDay || day.isBefore(examDates[exam].minDay)) {
                                examDates[exam].minDay = day;
                            }
                            if (!examDates[exam].maxDay || day.isAfter(examDates[exam].maxDay)) {
                                examDates[exam].maxDay = day;
                            }
                        } else {
                            examDates[exam].anomalyYears = examDates[exam].anomalyYears || {};
                            examDates[exam].anomalyYears[year] = true;
                        }
                    }
                }
            });
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

        frameworks = Object.keys(frameworks).sort();

        var selectFrameworks = $('#filter-framework');

        frameworks.forEach(function (framework) {
            selectFrameworks.append($('<option>', {
                value: framework,
                text: framework
            }));
        });

        selectFrameworks.selectize();

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

        [['מועד א', 'moed-a'], ['מועד ב', 'moed-b']].forEach(function (examData) {
            var exam = examData[0];
            var examId = examData[1];
            var anomalyYears = Object.keys(examDates[exam].anomalyYears || {}).sort(function (a, b) {
                return a - b;
            });
            var minDay = examDates[exam].minDay;
            var maxDay = examDates[exam].maxDay;

            var selectMoedMin = $('#filter-' + examId + '-min');
            var selectMoedMax = $('#filter-' + examId + '-max');
            var addDate = function (date) {
                var dateStrFull = date.format();
                var dateStrShort = date.format('DD/MM');
                selectMoedMin.append($('<option>', {
                    value: dateStrFull,
                    text: dateStrShort
                }));
                selectMoedMax.append($('<option>', {
                    value: dateStrFull,
                    text: dateStrShort
                }));
            };
            var addYear = function (year) {
                var yearStart = moment.utc([year]).startOf('year');
                var yearEnd = moment.utc([year]).endOf('year');
                selectMoedMin.append($('<option>', {
                    value: yearStart.format(),
                    text: year.toString()
                }));
                selectMoedMax.append($('<option>', {
                    value: yearEnd.format(),
                    text: year.toString()
                }));
            };

            anomalyYears.filter(function (year) {
                return year < currentExamsYear;
            }).forEach(function (year) {
                addYear(year);
            });

            if (minDay && maxDay) {
                for (var date = minDay.clone(); !date.isAfter(maxDay); date.add(1, 'days')) {
                    addDate(date);
                }
            }

            anomalyYears.filter(function (year) {
                return year > currentExamsYear;
            }).forEach(function (year) {
                addYear(year);
            });

            selectMoedMax.find('option:last').attr('selected', 'selected');
        });
    }

    CourseSelect.prototype.filterOpen = function () {
        var that = this;

        if (that.filterDialog) {
            that.filterDialog.getModalHeader().trigger('click');
            return;
        }

        gtag('event', 'course-select-filter-open');

        var filterForm = $('#filter-form');
        var filterFormParent = filterForm.parent();
        var filterFormOnSubmit;

        showBootstrapDialogWithModelessButton('course-filter', {
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
            onshow: function (dialog) {
                $('<span>', {
                    id: 'filter-result',
                    class: 'bootstrap-dialog-message',
                    css: {
                        'margin-bottom': '.25rem',
                        'margin-left': 'auto'
                    }
                }).prependTo(dialog.getModalFooter());

                filterFormOnSubmit = function (event) {
                    event.preventDefault();
                    dialog.getModalFooter().find('button.btn-primary').click();
                };
                filterForm.submit(filterFormOnSubmit);

                that.filterDialog = dialog;
            },
            onhidden: function (dialog) {
                // Put it back for reuse.
                filterForm.off('submit', null, filterFormOnSubmit);
                filterFormParent.html(filterForm);

                that.filterDialog = null;
            }
        });
    };

    CourseSelect.prototype.filterApply = function () {
        var that = this;

        var filters = {};

        var faculties = $('#filter-faculty').data('selectize').items;
        if (faculties.length > 0) {
            filters.faculties = faculties;
        }

        var frameworks = $('#filter-framework').data('selectize').items;
        if (frameworks.length > 0) {
            filters.frameworks = frameworks;
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
                return ('00000' + num).slice(-6);
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
                return ('00000' + num).slice(-6);
            });
        }

        var coursesExclude = $('#filter-courses-exclude').val().match(/\d+/g);
        if (coursesExclude) {
            filters.coursesExclude = coursesExclude.filter(function (num) {
                return parseInt(num, 10) <= 999999;
            }).map(function (num) {
                return ('00000' + num).slice(-6);
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

        updateFilterButton(that, that.courseSelect);
    };

    CourseSelect.prototype.filterReset = function () {
        var that = this;

        $('#filter-form').trigger('reset');
        $('#filter-faculty').data('selectize').clear(); // selectize doesn't work with reset
        $('#filter-framework').data('selectize').clear(); // selectize doesn't work with reset

        if (that.filteredCoursesCount < that.allCoursesCount) {
            that.courseSelect.clearOptions();
            that.courseSelect.addOption(makeCourseSelectOptions(that.courseManager.getAllCourses().sort(), that.courseManager));
            that.filteredCoursesCount = that.allCoursesCount;
        }

        if (that.filterDialog) {
            var messageElement = that.filterDialog.getModalFooter().find('#filter-result');
            messageElement.text('');
        }

        updateFilterButton(that, that.courseSelect);
    };

    return CourseSelect;
})();
