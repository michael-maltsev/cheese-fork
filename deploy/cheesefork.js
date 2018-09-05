'use strict';

/* global ColorHash, BootstrapDialog, moment, ics, firebase, firebaseui */
/* global CourseManager, CourseButtonList, CourseExamInfo, CourseCalendar */
/* global courses_from_rishum, availableSemesters, currentSemester */

(function () {
    var courseManager = new CourseManager(courses_from_rishum);
    var coursesChosen = {};
    var colorHash = new ColorHash();
    var courseSelect = null;
    var filterDialog = null;
    var courseButtonList = null;
    var courseExamInfo = null;
    var courseCalendar = null;
    var previewingFromSelectControl = null;
    var firestoreDb = null;

    cheeseforkInit();

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

    function getSelectedCourses() {
        return Object.keys(coursesChosen).filter(function (course) {
            return coursesChosen[course];
        });
    }

    function updateGeneralInfoLine() {
        var courses = 0;
        var points = 0;

        getSelectedCourses().forEach(function (course) {
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

    function selectedCourseSave(course) {
        var semesterCoursesKey = currentSemester + '_courses';
        var courseKey = currentSemester + '_' + course;

        var doc = firestoreAuthUserDoc();
        if (doc) {
            var input = {};
            input[semesterCoursesKey] = firebase.firestore.FieldValue.arrayUnion(course);
            input[courseKey] = {};
            doc.set(input, {merge: true});
        } else {
            try {
                var courses = JSON.parse(localStorage.getItem(semesterCoursesKey) || '[]');
                courses.push(course);
                localStorage.setItem(semesterCoursesKey, JSON.stringify(courses));
                localStorage.removeItem(courseKey);
            } catch (e) {
                // localStorage is not available in IE/Edge when running from a local file.
            }
        }
    }

    function selectedCourseUnsave(course) {
        var semesterCoursesKey = currentSemester + '_courses';
        var courseKey = currentSemester + '_' + course;

        var doc = firestoreAuthUserDoc();
        if (doc) {
            var input = {};
            input[semesterCoursesKey] = firebase.firestore.FieldValue.arrayRemove(course);
            input[courseKey] = firebase.firestore.FieldValue.delete();
            doc.update(input);
        } else {
            try {
                var courses = JSON.parse(localStorage.getItem(semesterCoursesKey) || '[]');
                courses = courses.filter(function (item) {
                    return item !== course;
                });
                localStorage.setItem(semesterCoursesKey, JSON.stringify(courses));
                localStorage.removeItem(courseKey);
            } catch (e) {
                // localStorage is not available in IE/Edge when running from a local file.
            }
        }
    }

    function selectedLessonSave(course, lessonNumber, lessonType) {
        var courseKey = currentSemester + '_' + course;

        var doc = firestoreAuthUserDoc();
        if (doc) {
            var input = {};
            input[courseKey + '.' + lessonType] = lessonNumber;
            doc.update(input);
        } else {
            try {
                var lessons = JSON.parse(localStorage.getItem(courseKey) || '{}');
                lessons[lessonType] = lessonNumber;
                localStorage.setItem(courseKey, JSON.stringify(lessons));
            } catch (e) {
                // localStorage is not available in IE/Edge when running from a local file.
            }
        }
    }

    function selectedLessonUnsave(course, lessonNumber, lessonType) {
        var courseKey = currentSemester + '_' + course;

        var doc = firestoreAuthUserDoc();
        if (doc) {
            var input = {};
            input[courseKey + '.' + lessonType] = firebase.firestore.FieldValue.delete();
            doc.update(input);
        } else {
            try {
                var lessons = JSON.parse(localStorage.getItem(courseKey) || '{}');
                delete lessons[lessonType];
                localStorage.setItem(courseKey, JSON.stringify(lessons));
            } catch (e) {
                // localStorage is not available in IE/Edge when running from a local file.
            }
        }
    }

    function loadSavedCoursesAndLessons(onLoadedFunc) {
        var semesterCoursesKey = currentSemester + '_courses';

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
            try {
                data[semesterCoursesKey] = JSON.parse(localStorage.getItem(semesterCoursesKey) || '[]');
                data[semesterCoursesKey].forEach(function (course) {
                    var courseKey = currentSemester + '_' + course;
                    data[courseKey] = JSON.parse(localStorage.getItem(courseKey) || '{}');
                });
            } catch (e) {
                // localStorage is not available in IE/Edge when running from a local file.
                data[semesterCoursesKey] = [];
            }
            applySaved(data);
            onLoadedFunc();
        }

        function applySaved(data) {
            var schedule = {};

            var courses = data[semesterCoursesKey] || [];
            courses.forEach(function (course) {
                if (!coursesChosen.propertyIsEnumerable(course) && courseManager.doesExist(course)) {
                    coursesChosen[course] = true;
                    courseButtonList.addCourse(course);

                    var courseKey = currentSemester + '_' + course;
                    var lessons = data[courseKey] || {};
                    schedule[course] = lessons;
                }
            });

            courseCalendar.loadSavedSchedule(schedule);
            updateGeneralInfoLine();
            courseExamInfo.renderCourses(getSelectedCourses());
            filterReset();
        }
    }

    function reloadSavedCoursesAndLessons(onLoadedFunc) {
        courseButtonList.clear();
        courseCalendar.removeAll();
        coursesChosen = {};

        updateGeneralInfoLine();
        courseExamInfo.renderCourses(getSelectedCourses());

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
        firestoreDb.settings({timestampsInSnapshots: true}); // silence a warning

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

    function filterReset() {
        $('#filter-form').trigger('reset');
        $('#filter-faculty').data('selectize').clear(); // selectize doesn't work with reset

        var itemsInSelect = Object.keys(courseSelect.options).length - 1;
        var allCourses = courseManager.getAllCourses();
        if (itemsInSelect !== allCourses.length) {
            var courseSelectItems = [{
                value: 'filter',
                text: ''
            }].concat(allCourses.sort().map(function (course) {
                var general = courseManager.getGeneralInfo(course);
                return {
                    value: course,
                    text: course + ' - ' + general['שם מקצוע']
                };
            }));

            courseSelect.clearOptions();
            courseSelect.addOption(courseSelectItems);
        }

        if (filterDialog) {
            var messageElement = filterDialog.getModalFooter().find('#filter-result');
            messageElement.text('');
        }
    }

    function filterApply() {
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

        var selectedCourses = getSelectedCourses();
        if (selectedCourses.length > 0) {
            filters.coursesCurrent = getSelectedCourses();
        }

        var filtered = courseManager.filterCourses(filters);

        var courseSelectItems = [{
            value: 'filter',
            text: ''
        }].concat(filtered.sort().map(function (course) {
            var general = courseManager.getGeneralInfo(course);
            return {
                value: course,
                text: course + ' - ' + general['שם מקצוע']
            };
        }));

        courseSelect.clearOptions();
        courseSelect.addOption(courseSelectItems);

        if (filterDialog) {
            var totalCount = courseManager.getAllCourses().length;
            var afterFilterCount = courseSelectItems.length - 1;

            var messageElement = filterDialog.getModalFooter().find('#filter-result');
            messageElement.text('מציג ' + afterFilterCount + ' מתוך ' + totalCount + ' קורסים');
        }
    }

    function filterOpen() {
        if (filterDialog) {
            filterDialog.open();
            return;
        }

        var filterForm = $('#filter-form');
        filterDialog = BootstrapDialog.show({
            title: 'סינון קורסים',
            message: filterForm.get(0),
            buttons: [{
                label: 'סינון',
                cssClass: 'btn-primary',
                action: function (dialog) {
                    filterApply();
                }
            }, {
                label: 'איפוס',
                action: function (dialog) {
                    filterReset();
                }
            }, {
                label: 'סגור',
                action: function (dialog) {
                    dialog.close();
                }
            }],
            autodestroy: false
        });

        var footer = filterDialog.getModalFooter();
        footer.css('flex-wrap', 'wrap');
        $('<span id="filter-result">').addClass('bootstrap-dialog-message')
            .css({'margin-left': 'auto', 'margin-bottom': '.25rem'}).prependTo(footer);

        filterForm.submit(function (event) {
            event.preventDefault(); // prevent default browser behavior
            filterDialog.getModalFooter().find('button.btn-primary').click();
        });
    }

    function filterInit() {
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

    function cheeseforkInit() {
        $('[data-toggle="tooltip"]').tooltip();

        var semesterSelect = $('#select-semester');

        availableSemesters.forEach(function (semester) {
            semesterSelect.append($('<option>', {
                value: semester,
                text: semesterFriendlyName(semester)
            }));
        });

        semesterSelect.val(currentSemester).change(function () {
            window.location = '?semester=' + this.value;
        });

        $('#save-as-ics').click(function () {
            var icsCal = ics();

            var yearFrom = parseInt(currentSemester.slice(0, 4), 10);
            var yearTo = yearFrom + 2;

            if (courseCalendar.saveAsIcs(icsCal, yearFrom, yearTo) === 0) {
                alert('המערכת ריקה');
            } else {
                icsCal.download(semesterFriendlyName(currentSemester));
            }
        });

        var courseSelectItems = [{
            value: 'filter',
            text: ''
        }].concat(courseManager.getAllCourses().sort().map(function (course) {
            var general = courseManager.getGeneralInfo(course);
            return {
                value: course,
                text: course + ' - ' + general['שם מקצוע']
            };
        }));

        courseSelect = $('#select-course').selectize({
            //searchConjunction: 'or',
            options: courseSelectItems,
            maxOptions: 200,
            render: {
                option: function (item) {
                    if (item.value === 'filter') {
                        var text = 'סינון קורסים';

                        var itemsInSelect = Object.keys(courseSelect.options).length - 1;
                        var allCoursesCount = courseManager.getAllCourses().length;
                        if (itemsInSelect !== allCoursesCount) {
                            text += ' (' + itemsInSelect + '/' + allCoursesCount + ')';
                        }

                        return $('<div>').addClass('option font-weight-bold').text(text);
                    }

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
                if (course === 'filter') {
                    filterOpen();
                } else if (!coursesChosen.propertyIsEnumerable(course)) {
                    coursesChosen[course] = true;
                    courseButtonList.addCourse(course);
                    courseCalendar.addCourse(course);
                    selectedCourseSave(course);
                    updateGeneralInfoLine();
                    courseExamInfo.renderCourses(getSelectedCourses());
                    // Can't apply filter inside onItemAdd since it changes the select contents.
                    setTimeout(filterApply, 0);
                }
                this.clear();
            },
            onDropdownItemActivate: function (course) {
                if (course === 'filter') {
                    return;
                }

                previewingFromSelectControl = course;

                if (!coursesChosen.propertyIsEnumerable(course)) {
                    courseCalendar.addCourse(course);
                    courseExamInfo.renderCourses(getSelectedCourses().concat([course]));
                }
                courseExamInfo.setHighlighted(course);
                courseCalendar.previewCourse(course);
            },
            onDropdownItemDeactivate: function (course) {
                if (course === 'filter') {
                    return;
                }

                if (!coursesChosen.propertyIsEnumerable(course)) {
                    courseCalendar.removeCourse(course);
                    courseExamInfo.renderCourses(getSelectedCourses());
                } else {
                    // Remove highlight
                    courseExamInfo.removeHighlighted(course);
                    courseCalendar.unpreviewCourse(course);
                }

                previewingFromSelectControl = null;
            }
        }).data('selectize');

        $('.selectize-control .selectize-dropdown').tooltip({selector: '[data-toggle=tooltip]'});

        filterInit();

        courseButtonList = new CourseButtonList($('#course-button-list'), {
            courseManager: courseManager,
            colorGenerator: function (course) {
                return colorHash.hex(course);
            },
            onHoverIn: function (course) {
                courseExamInfo.setHovered(course);
                if (previewingFromSelectControl) {
                    courseCalendar.unpreviewCourse(previewingFromSelectControl);
                }
                courseCalendar.previewCourse(course);
            },
            onHoverOut: function (course) {
                courseExamInfo.removeHovered(course);
                courseCalendar.unpreviewCourse(course);
                if (previewingFromSelectControl) {
                    courseCalendar.previewCourse(previewingFromSelectControl);
                }
            },
            onEnableCourse: function (course) {
                courseCalendar.addCourse(course);
                courseCalendar.previewCourse(course);
                selectedCourseSave(course);
                coursesChosen[course] = true;
                updateGeneralInfoLine();
                courseExamInfo.renderCourses(getSelectedCourses());
                filterApply();
            },
            onDisableCourse: function (course) {
                courseCalendar.removeCourse(course);
                selectedCourseUnsave(course);
                coursesChosen[course] = false;
                updateGeneralInfoLine();
                courseExamInfo.renderCourses(getSelectedCourses());
                filterApply();
            }
        });

        courseExamInfo = new CourseExamInfo($('#course-exam-info'), {
            courseManager: courseManager,
            colorGenerator: function (course) {
                return colorHash.hex(course);
            },
            onHoverIn: function (course) {
                courseButtonList.setHovered(course);
                if (previewingFromSelectControl) {
                    courseCalendar.unpreviewCourse(previewingFromSelectControl);
                }
                courseCalendar.previewCourse(course);
            },
            onHoverOut: function (course) {
                courseButtonList.removeHovered(course);
                courseCalendar.unpreviewCourse(course);
                if (previewingFromSelectControl) {
                    courseCalendar.previewCourse(previewingFromSelectControl);
                }
            }
        });

        courseCalendar = new CourseCalendar($('#course-calendar'), {
            courseManager: courseManager,
            colorGenerator: function (course) {
                return colorHash.hex(course);
            },
            onCourseHoverIn: function (course) {
                courseButtonList.setHovered(course);
                courseExamInfo.setHovered(course);
            },
            onCourseHoverOut: function (course) {
                courseButtonList.removeHovered(course);
                courseExamInfo.removeHovered(course);
            },
            onCourseConflictedStatusChanged: function (course, conflicted) {
                if (conflicted) {
                    courseButtonList.setConflicted(course);
                } else {
                    courseButtonList.removeConflicted(course);
                }
            },
            onLessonSelected: function (course, lessonNumber, lessonType) {
                selectedLessonSave(course, lessonNumber, lessonType);
            },
            onLessonUnselected: function (course, lessonNumber, lessonType) {
                selectedLessonUnsave(course, lessonNumber, lessonType);
            }
        });

        $('#footer-semester-name').text(semesterFriendlyName(currentSemester));
        $('#footer-semester').removeClass('d-none');

        $('#right-content-bar').removeClass('invisible');

        var firebaseInitialized = false;

        if (typeof firebase !== 'undefined') {
            try {
                firebaseInit(function () {
                    loadSavedCoursesAndLessons(function () {
                        $('#page-loader').hide();
                    });
                });
                firebaseInitialized = true;
            } catch (e) {
                // Firebase UI doesn't work on Edge/IE in private mode.
                // Will fall back to offline mode.
            }
        }

        if (!firebaseInitialized) {
            document.getElementById('firebase-sign-in').style.display = 'none';
            loadSavedCoursesAndLessons(function () {
                $('#page-loader').hide();
            });
        }
    }
})();
