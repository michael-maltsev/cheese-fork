'use strict';

/* global ColorHash, BootstrapDialog, ics, firebase, firebaseui */
/* global CourseManager, CourseButtonList, CourseExamInfo, CourseCalendar */
/* global courses_from_rishum, availableSemesters, currentSemester */

(function () {
    var courseManager = new CourseManager(courses_from_rishum);
    var coursesChosen = {};
    var colorHash = new ColorHash();
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

    function updateExamInfo(extraCourses) {
        if (typeof extraCourses === 'undefined') {
            extraCourses = [];
        }

        var courses = Object.keys(coursesChosen).filter(function (course) {
            return coursesChosen[course];
        }).concat(extraCourses);

        courseExamInfo.renderCourses(courses);
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
            var courses = JSON.parse(localStorage && localStorage.getItem(semesterCoursesKey) || '[]');
            courses.push(course);
            localStorage && localStorage.setItem(semesterCoursesKey, JSON.stringify(courses));
            localStorage && localStorage.removeItem(courseKey);
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
            var courses = JSON.parse(localStorage && localStorage.getItem(semesterCoursesKey) || '[]');
            courses = courses.filter(function (item) {
                return item !== course;
            });
            localStorage && localStorage.setItem(semesterCoursesKey, JSON.stringify(courses));
            localStorage && localStorage.removeItem(courseKey);
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
            var lessons = JSON.parse(localStorage && localStorage.getItem(courseKey) || '{}');
            lessons[lessonType] = lessonNumber;
            localStorage && localStorage.setItem(courseKey, JSON.stringify(lessons));
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
            var lessons = JSON.parse(localStorage && localStorage.getItem(courseKey) || '{}');
            delete lessons[lessonType];
            localStorage && localStorage.setItem(courseKey, JSON.stringify(lessons));
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
            data[semesterCoursesKey] = JSON.parse(localStorage && localStorage.getItem(semesterCoursesKey) || '[]');
            data[semesterCoursesKey].forEach(function (course) {
                var courseKey = currentSemester + '_' + course;
                data[courseKey] = JSON.parse(localStorage && localStorage.getItem(courseKey) || '{}');
            });
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
            updateExamInfo();
        }
    }

    function reloadSavedCoursesAndLessons(onLoadedFunc) {
        courseButtonList.clear();
        courseCalendar.removeAll();
        coursesChosen = {};

        updateGeneralInfoLine();
        updateExamInfo();

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

    function cheeseforkInit() {
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

        var courseSelectItems = courseManager.getAllCourses().sort().map(function (course) {
            var general = courseManager.getGeneralInfo(course);
            return {
                value: course,
                text: course + ' - ' + general['שם מקצוע']
            };
        });

        $('#select-course').selectize({
            //searchConjunction: 'or',
            options: courseSelectItems,
            maxOptions: 200,
            render: {
                option: function (item) {
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
                    courseButtonList.addCourse(course);
                    courseCalendar.addCourse(course);
                    selectedCourseSave(course);
                    updateGeneralInfoLine();
                    updateExamInfo();
                }
                this.clear();
            },
            onDropdownItemActivate: function (course) {
                previewingFromSelectControl = course;

                if (!coursesChosen.propertyIsEnumerable(course)) {
                    courseCalendar.addCourse(course);
                    updateExamInfo([course]);
                }
                courseExamInfo.setHighlighted(course);
                courseCalendar.previewCourse(course);
            },
            onDropdownItemDeactivate: function (course) {
                if (!coursesChosen.propertyIsEnumerable(course)) {
                    courseCalendar.removeCourse(course);
                    updateExamInfo();
                } else {
                    // Remove highlight
                    courseExamInfo.removeHighlighted(course);
                    courseCalendar.unpreviewCourse(course);
                }

                previewingFromSelectControl = null;
            }
        });

        $('.selectize-control .selectize-dropdown').tooltip({selector: '[data-toggle=tooltip]'});

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
                updateExamInfo();
            },
            onDisableCourse: function (course) {
                courseCalendar.removeCourse(course);
                selectedCourseUnsave(course);
                coursesChosen[course] = false;
                updateGeneralInfoLine();
                updateExamInfo();
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
