'use strict';

/* global ColorHash, BootstrapDialog, moment, ics, JsDiff, firebase, firebaseui, gtag */
/* global CourseManager, CourseSelect, CourseButtonList, CourseExamInfo, CourseCalendar */
/* global courses_from_rishum, availableSemesters, currentSemester, scheduleSharingUserId */

(function () {
    var courseManager = new CourseManager(courses_from_rishum);
    var colorHash = new ColorHash();
    var firestoreDb = null;
    var viewingSharedSchedule = false;
    var previewingFromSelectControl = null;
    var stopScheduleWatching = null;
    var currentSavedSession = null, savedSessionForUndo = null, savedSessionForRedo = null;
    var metadataDiff = {};

    // UI components.
    var loginDialog = null;
    var courseSelect = null;
    var courseButtonList = null;
    var courseExamInfo = null;
    var courseCalendar = null;

    if (!crawlersInfo()) {
        cheeseforkInit();
    }

    function cheeseforkInit() {
        $('[data-toggle="tooltip"]').tooltip();

        viewingSharedSchedule = scheduleSharingUserId ? true : false;

        navbarInit();

        if (!viewingSharedSchedule) {
            courseSelect = new CourseSelect($('#course-select'), {
                courseManager: courseManager,
                onItemAdd: function (course) {
                    if (!courseButtonList.isCourseInList(course)) {
                        courseButtonList.addCourse(course);
                        courseCalendar.addCourse(course);
                        selectedCourseSave(course);
                        updateGeneralInfoLine();
                        courseExamInfo.renderCourses(courseButtonList.getCourseNumbers(true));
                        // Can't apply filter inside onItemAdd since it changes the select contents.
                        setTimeout(function () {
                            courseSelect.filterApply();
                        }, 0);
                    }
                },
                onDropdownItemActivate: function (course) {
                    previewingFromSelectControl = course;

                    if (!courseButtonList.isCourseInList(course)) {
                        courseCalendar.addCourse(course);
                        courseExamInfo.renderCourses(courseButtonList.getCourseNumbers(true).concat([course]));
                    }
                    courseExamInfo.setHighlighted(course);
                    courseCalendar.previewCourse(course);
                },
                onDropdownItemDeactivate: function (course) {
                    if (!courseButtonList.isCourseInList(course)) {
                        courseCalendar.removeCourse(course);
                        courseExamInfo.renderCourses(courseButtonList.getCourseNumbers(true));
                    } else {
                        // Remove highlight
                        courseExamInfo.removeHighlighted(course);
                        courseCalendar.unpreviewCourse(course);
                    }

                    previewingFromSelectControl = null;
                },
                getSelectedCoursesForFilter: function () {
                    return courseButtonList.getCourseNumbers(true);
                }
            });
        } else {
            $('#top-navbar-home').removeClass('d-none');
            $('#top-navbar-share').addClass('d-none');
            $('#top-navbar-semester').addClass('d-none');
            $('#course-select').hide();
        }

        courseButtonList = new CourseButtonList($('#course-button-list'), {
            courseManager: courseManager,
            colorGenerator: function (course) {
                return colorHash.hex(course);
            },
            readonly: viewingSharedSchedule,
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
                updateGeneralInfoLine();
                courseExamInfo.renderCourses(courseButtonList.getCourseNumbers(true));
                courseSelect.filterApply();
            },
            onDisableCourse: function (course) {
                courseCalendar.removeCourse(course);
                selectedCourseUnsave(course);
                updateGeneralInfoLine();
                courseExamInfo.renderCourses(courseButtonList.getCourseNumbers(true));
                courseSelect.filterApply();
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
            readonly: viewingSharedSchedule,
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
            },
            onCustomEventAdded: function (eventId, eventData) {
                customEventSave(eventId, eventData);
            },
            onCustomEventUpdated: function (eventId, eventData) {
                customEventSave(eventId, eventData);
            },
            onCustomEventRemoved: function (eventId) {
                customEventUnsave(eventId);
            }
        });

        $('#top-navbar-supported-content').removeClass('top-navbar-content-uninitialized');

        $('#footer-semester-name').text(semesterFriendlyName(currentSemester));
        $('#footer-semester').removeClass('d-none');

        $('#right-content-bar').removeClass('invisible');

        if (viewingSharedSchedule) {
            firebaseInit();
            firestoreDbInit();
            watchSharedSchedule(function () {
                $('#page-loader').hide();
            });
        } else {
            var firebaseAuthUIInitialized = false;

            if (typeof firebase !== 'undefined') {
                try {
                    firebaseInit();
                    firestoreDbInit();
                    firebaseAuthUIInit(function () {
                        watchSavedSchedule(function () {
                            $('#page-loader').hide();
                            showThursdayGraphPopup() || showTechnionScansPopup();
                        });
                    });
                    firebaseAuthUIInitialized = true;
                } catch (e) {
                    // Firebase UI doesn't work on Edge/IE in private mode.
                    // Will fall back to offline mode.
                }
            }

            if (!firebaseAuthUIInitialized) {
                watchSavedSchedule(function () {
                    $('#page-loader').hide();
                    showThursdayGraphPopup() || showTechnionScansPopup();
                });
            }
        }
    }

    function showThursdayGraphPopup() {
        var currentDate = new Date();
        var currentDay = currentDate.getDay();
        var currentHours = currentDate.getHours();
        if (currentDay < 5 ||
            (currentDay === 5 && currentHours < 8) ||
            (currentDay === 6 && currentHours > 4) ||
            currentDay > 6) {
            // Not Thursday 08:00 to Friday 04:00.
            //return false;
        }

        try {
            var dontShowDate = localStorage.getItem('dontShowThursdayGraphPopup');
            if (dontShowDate) {
                var days = (Date.now() - parseInt(dontShowDate, 10)) / (24 * 3600 * 1000);
                if (days <= 365) {
                    return false;
                }
            }
        } catch (e) {
            // localStorage is not available in IE/Edge when running from a local file.
        }

        BootstrapDialog.show({
            title: 'הגרף השבועי',
            message: 'חדש! מעכשיו בכל יום חמישי יפורסם גרף מעניין הקשור למקצועות בטכניון בעמוד הפייסבוק שלנו. תהנו ☺<br>' +
                '<br>' +
                '<div class="form-check">' +
                    '<input class="form-check-input" type="checkbox" id="dont-show-technion-scans-popup"> ' +
                    '<label class="form-check-label" for="dont-show-technion-scans-popup">' +
                    'אל תציג את ההודעה שוב' +
                    '</label>' +
                '</div>' +
                '<br>' +
                '<iframe style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowTransparency="true" allow="encrypted-media"></iframe>',
            onshown: function (dialog) {
                var modalBody = dialog.getModalBody();
                var width = modalBody.width();
                var height = modalBody.height() * 1.5;
                var frameSrc = 'https://www.facebook.com/plugins/page.php?href=https%3A%2F%2Fwww.facebook.com%2Fcheesefork.technion%2F&tabs=timeline' +
                    '&width=' + width + '&height=' + height + '&small_header=true&adapt_container_width=true&hide_cover=false&show_facepile=true&appId=863730240682785';
                modalBody.find('iframe').width(width).height(height).attr('src', frameSrc);
            },
            buttons: [{
                label: 'סגור',
                action: function (dialog) {
                    dialog.close();
                }
            }],
            onhide: function (dialog) {
                if (document.getElementById('dont-show-technion-scans-popup').checked) {
                    gtag('event', 'scans-dont-show');

                    localStorage.setItem('dontShowThursdayGraphPopup', Date.now().toString());
                }
            }
        });

        return true;
    }

    function showTechnionScansPopup() {
        return false; // disabled

        try {
            var dontShowDate = localStorage.getItem('dontShowTechnionScansPopup');
            if (dontShowDate) {
                var days = (Date.now() - parseInt(dontShowDate, 10)) / (24 * 3600 * 1000);
                if (days <= 7) {
                    return false;
                }
            }
        } catch (e) {
            // localStorage is not available in IE/Edge when running from a local file.
        }

        BootstrapDialog.show({
            title: 'סריקות לקראת המבחנים',
            message: 'לומדים למבחנים? (אם לא, אולי אתם צריכים להתחיל ☺️)<br>' +
            'מחפשים סריקות של סטודנטים מסמסטרים קודמים ללמוד מהם?<br>' +
            'קיבלתם ציון טוב, ויש לכם סריקות שיכולות לעזור לאחרים?<br>' +
            '<br>' +
            'אתם מוזמנים ' +
            '<a href="https://tscans.cf/" target="_blank" rel="noopener" onclick="gtag(\'event\', \'scans-click-link\')">להיכנס למערכת הסריקות</a>' +
            ', להיעזר ולעזור.<br>' +
            'בהצלחה במבחנים!<br>' +
            '<br>' +
            '<div class="form-check">' +
            '<input class="form-check-input" type="checkbox" id="dont-show-technion-scans-popup"> ' +
            '<label class="form-check-label" for="dont-show-technion-scans-popup">' +
            'אל תציג את ההודעה שוב' +
            '</label>' +
            '</div>',
            buttons: [{
                label: 'מעבר למערכת הסריקות',
                cssClass: 'btn-primary',
                action: function (dialog) {
                    gtag('event', 'scans-click-button');

                    var win = window.open('https://tscans.cf/', '_blank', 'noopener');
                    if (win) {
                        win.focus();
                    }
                }
            }, {
                label: 'סגור',
                action: function (dialog) {
                    dialog.close();
                }
            }],
            onhide: function (dialog) {
                if (document.getElementById('dont-show-technion-scans-popup').checked) {
                    gtag('event', 'scans-dont-show');

                    localStorage.setItem('dontShowTechnionScansPopup', Date.now().toString());
                }
            }
        });

        return true;
    }

    function navbarInit() {
        if (!viewingSharedSchedule) {
            var semesterSelect = $('#top-navbar-semester').find('.dropdown-menu');

            Object.keys(availableSemesters).sort().forEach(function (semester) {
                var link = $('<a class="dropdown-item">')
                    .prop('href', '?semester=' + encodeURIComponent(semester))
                    .text(semesterFriendlyName(semester));
                if (semester === currentSemester) {
                    link.addClass('active');
                }
                semesterSelect.append(link);
            });

            $('#top-navbar-changes').click(function (event) {
                event.preventDefault();

                gtag('event', 'navbar-changes');

                BootstrapDialog.show({
                    title: 'שינויים במערכת השעות',
                    message: getPrettyMetadataDiff(),
                    buttons: [{
                        label: 'אשר שינויים',
                        cssClass: 'btn-primary',
                        action: function (dialog) {
                            gtag('event', metadataDiff ? 'metadata-to-current' : 'metadata-first-time');

                            setMetadataToCurrent();
                            dialog.close();
                        }
                    }, {
                        label: 'סגור',
                        action: function (dialog) {
                            dialog.close();
                        }
                    }]
                });
            });

            $('#top-navbar-login').click(function (event) {
                event.preventDefault();

                gtag('event', 'navbar-login');

                if (loginDialog) {
                    loginDialog.open();
                    return;
                }

                loginDialog = BootstrapDialog.show({
                    title: 'כניסה למערכת',
                    message: $('#firebaseui-auth-container'),
                    buttons: [{
                        label: 'סגור',
                        action: function (dialog) {
                            dialog.close();
                        }
                    }],
                    autodestroy: false
                });
            });

            $('#top-navbar-logout').click(function (event) {
                event.preventDefault();

                gtag('event', 'navbar-logout');

                firebase.auth().signOut();
            });

            $('#top-navbar-share').click(function (event) {
                event.preventDefault();
                if ($(this).find('a').hasClass('disabled')) {
                    return;
                }

                gtag('event', 'navbar-share');

                var url = location.protocol + '//' + location.host + location.pathname +
                    '?semester=' + encodeURIComponent(currentSemester) +
                    '&uid=' + encodeURIComponent(firebase.auth().currentUser.uid);
                var urlElement = $('<a target="_blank" rel="noopener">לחצו כאן לפתיחה</a>').prop('href', url);
                var shareDialogContent = $('<div>הקישור לשיתוף המערכת: </div>').append(urlElement).append('.');

                BootstrapDialog.show({
                    title: 'שיתוף מערכת',
                    message: shareDialogContent,
                    buttons: [{
                        label: 'העתק קישור',
                        cssClass: 'btn-primary',
                        action: function (dialog) {
                            copyToClipboard(url, function () {
                                dialog.close();
                            }, function () {
                                alert('ההעתקה נכשלה');
                            });
                        }
                    }, {
                        label: 'סגור',
                        action: function (dialog) {
                            dialog.close();
                        }
                    }]
                });
            });

            $('#top-navbar-undo').click(function (event) {
                event.preventDefault();

                gtag('event', 'navbar-undo');

                makeUndo();
            });

            $('#top-navbar-redo').click(function (event) {
                event.preventDefault();

                gtag('event', 'navbar-redo');

                makeRedo();
            });
        }

        $('#top-navbar-export').click(function (event) {
            event.preventDefault();

            gtag('event', 'navbar-export');

            var icsCal = ics();

            // Schedule.
            var dateFrom = availableSemesters[currentSemester].start;
            var dateTo = availableSemesters[currentSemester].end;
            courseCalendar.saveAsIcs(icsCal, dateFrom, dateTo);

            // Exams.
            courseButtonList.getCourseNumbers(true).forEach(function (course) {
                var general = courseManager.getGeneralInfo(course);
                ['מועד א', 'מועד ב'].forEach(function (moed) {
                    if (general[moed]) {
                        var parsedDate = courseManager.parseExamDateTime(general[moed]);
                        if (parsedDate) {
                            var title = moed + '\' - ' + general['שם מקצוע'];
                            icsCal.addEvent(title, '', '', parsedDate.start, parsedDate.end);
                        }
                    }
                });
            });

            if (!icsCal.download(semesterFriendlyName(currentSemester))) {
                BootstrapDialog.show({
                    title: 'אופס',
                    message: 'המערכת ריקה',
                    size: BootstrapDialog.SIZE_SMALL
                });
            }
        });
    }

    function firebaseInit() {
        var config = {
            apiKey: 'AIzaSyAfKPyTM83mkLgdQTdx9YS9UXywiswwIYI',
            authDomain: 'cheesefork-de9af.firebaseapp.com',
            databaseURL: 'https://cheesefork-de9af.firebaseio.com',
            projectId: 'cheesefork-de9af',
            storageBucket: 'cheesefork-de9af.appspot.com',
            messagingSenderId: '916559682433'
        };
        firebase.initializeApp(config);
    }

    function firestoreDbInit() {
        firestoreDb = firebase.firestore();
        firestoreDb.settings({timestampsInSnapshots: true}); // silence a warning
    }

    function firebaseAuthUIInit(onInitialized) {
        // FirebaseUI config.
        var uiConfig = {
            // Opens IDP Providers sign-in flow in a popup.
            signInFlow: 'popup',
            signInOptions: [
                firebase.auth.GoogleAuthProvider.PROVIDER_ID,
                firebase.auth.EmailAuthProvider.PROVIDER_ID
                // I wanted to implement viewing Facebook friends' schedule via the Facebook API,
                // but they require business verification for the user_friends permission. -_-
                // https://stackoverflow.com/questions/51089608/business-verification-required-as-part-of-my-app-review
                /*,
                {
                    provider: firebase.auth.FacebookAuthProvider.PROVIDER_ID,
                    scopes: [
                        'public_profile',
                        'email',
                        'user_friends'
                    ]
                }*/
            ],
            callbacks: {
                // Called when the user has been successfully signed in.
                signInSuccessWithAuthResult: function (authResult) {
                    if (authResult.user) {
                        loginDialog.close();
                    }
                    // Do not redirect.
                    return false;
                }
            },
            // Terms of service url.
            //tosUrl: 'https://policies.google.com/terms',
            // Privacy policy url.
            //privacyPolicyUrl: 'https://policies.google.com/privacy',
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
                onInitialized();
                authInitialized = true;
            } else if (user) {
                // Slow reload.
                $('#page-loader').show();
                stopScheduleWatching();
                resetSchedule();
                watchSavedSchedule(function () {
                    $('#page-loader').hide();
                });
            } else {
                // Fast reload.
                stopScheduleWatching();
                resetSchedule();
                watchSavedSchedule(function () {});
            }
        });

        function handleSignedInUser(user) {
            $('#top-navbar-login').addClass('d-none');
            $('#top-navbar-logout').removeClass('d-none')
                .find('a').attr('data-original-title', 'מחובר בתור: ' + user.displayName);
            $('#top-navbar-share').find('a').removeClass('disabled').tooltip('disable');
        }

        function handleSignedOutUser() {
            $('#top-navbar-logout').addClass('d-none');
            $('#top-navbar-login').removeClass('d-none');
            $('#top-navbar-share').find('a').addClass('disabled').tooltip('enable');
            firebaseUI.start('#firebaseui-auth-container', uiConfig);
        }
    }

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

        courseButtonList.getCourseNumbers(true).forEach(function (course) {
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
        var metadataCourseKey = null;
        var courseData = null;
        var metadataUpdate = !!metadataDiff;
        if (metadataUpdate) {
            metadataCourseKey = currentSemester + '_metadata_' + course;
            courseData = courseManager.getCourseData(course);
        }

        var semesterCoursesKey = currentSemester + '_courses';
        var courseKey = currentSemester + '_' + course;

        // Keep all of the items from currentSavedSession[semesterCoursesKey], even if there
        // are numbers of courses which don't exist anymore. Use the button list for the order.
        var courseNumbers = courseButtonList.getCourseNumbers(true);
        currentSavedSession[semesterCoursesKey] = courseNumbers.concat(
            $(currentSavedSession[semesterCoursesKey]).not(courseNumbers).get());
        currentSavedSession[courseKey] = {};

        var doc = firestoreAuthenticatedUserDoc();
        if (doc) {
            var input = {};
            input[semesterCoursesKey] = currentSavedSession[semesterCoursesKey];
            input[courseKey] = {};
            if (metadataUpdate) {
                input[metadataCourseKey] = courseData;
            }
            doc.update(input);
        } else {
            try {
                localStorage.setItem(semesterCoursesKey, JSON.stringify(currentSavedSession[semesterCoursesKey]));
                localStorage.removeItem(courseKey);
                if (metadataUpdate) {
                    localStorage.setItem(metadataCourseKey, JSON.stringify(courseData));
                }
            } catch (e) {
                // localStorage is not available in IE/Edge when running from a local file.
            }
        }

        onSavedSessionChange();
    }

    function selectedCourseUnsave(course) {
        var metadataCourseKey = currentSemester + '_metadata_' + course;

        var semesterCoursesKey = currentSemester + '_courses';
        var courseKey = currentSemester + '_' + course;

        currentSavedSession[semesterCoursesKey] = currentSavedSession[semesterCoursesKey].filter(function (item) {
            return item !== course;
        });
        delete currentSavedSession[courseKey];

        var doc = firestoreAuthenticatedUserDoc();
        if (doc) {
            var input = {};
            input[semesterCoursesKey] = firebase.firestore.FieldValue.arrayRemove(course);
            input[courseKey] = firebase.firestore.FieldValue.delete();
            input[metadataCourseKey] = firebase.firestore.FieldValue.delete();
            doc.update(input);
        } else {
            try {
                localStorage.setItem(semesterCoursesKey, JSON.stringify(currentSavedSession[semesterCoursesKey]));
                localStorage.removeItem(courseKey);
                localStorage.removeItem(metadataCourseKey);
            } catch (e) {
                // localStorage is not available in IE/Edge when running from a local file.
            }
        }

        onSavedSessionChange();

        if (metadataDiff && metadataDiff.propertyIsEnumerable(course)) {
            delete metadataDiff[course];
            onMetadataDiffChange();
        }
    }

    function selectedLessonSave(course, lessonNumber, lessonType) {
        var courseKey = currentSemester + '_' + course;

        currentSavedSession[courseKey][lessonType] = lessonNumber;

        var doc = firestoreAuthenticatedUserDoc();
        if (doc) {
            var input = {};
            input[courseKey + '.' + lessonType] = lessonNumber;
            doc.update(input);
        } else {
            try {
                localStorage.setItem(courseKey, JSON.stringify(currentSavedSession[courseKey]));
            } catch (e) {
                // localStorage is not available in IE/Edge when running from a local file.
            }
        }

        onSavedSessionChange();
    }

    function selectedLessonUnsave(course, lessonNumber, lessonType) {
        var courseKey = currentSemester + '_' + course;

        delete currentSavedSession[courseKey][lessonType];

        var doc = firestoreAuthenticatedUserDoc();
        if (doc) {
            var input = {};
            input[courseKey + '.' + lessonType] = firebase.firestore.FieldValue.delete();
            doc.update(input);
        } else {
            try {
                localStorage.setItem(courseKey, JSON.stringify(currentSavedSession[courseKey]));
            } catch (e) {
                // localStorage is not available in IE/Edge when running from a local file.
            }
        }

        onSavedSessionChange();
    }

    function customEventSave(eventId, eventData) {
        var semesterCustomEventsKey = currentSemester + '_custom_events';

        currentSavedSession[semesterCustomEventsKey][eventId] = eventData;

        var doc = firestoreAuthenticatedUserDoc();
        if (doc) {
            var input = {};
            input[semesterCustomEventsKey + '.' + eventId] = eventData;
            doc.update(input);
        } else {
            try {
                localStorage.setItem(semesterCustomEventsKey, JSON.stringify(currentSavedSession[semesterCustomEventsKey]));
            } catch (e) {
                // localStorage is not available in IE/Edge when running from a local file.
            }
        }

        onSavedSessionChange();
    }

    function customEventUnsave(eventId) {
        var semesterCustomEventsKey = currentSemester + '_custom_events';

        delete currentSavedSession[semesterCustomEventsKey][eventId];

        var doc = firestoreAuthenticatedUserDoc();
        if (doc) {
            var input = {};
            input[semesterCustomEventsKey + '.' + eventId] = firebase.firestore.FieldValue.delete();
            doc.update(input);
        } else {
            try {
                localStorage.setItem(semesterCustomEventsKey, JSON.stringify(currentSavedSession[semesterCustomEventsKey]));
            } catch (e) {
                // localStorage is not available in IE/Edge when running from a local file.
            }
        }

        onSavedSessionChange();
    }

    function watchSharedSchedule(onLoadedFunc) {
        var firstDataLoaded = false;

        var doc = firestoreUserDoc(scheduleSharingUserId);
        doc.onSnapshot(function (result) {
            var session = result.exists ? savedSessionFromFirestoreData(result.data()) : {};
            setScheduleFromSavedSession(session, !firstDataLoaded);

            if (result.exists && result.data().displayName) {
                var displayName = result.data().displayName;
                $('#sharing-user-name').text(displayName);
                $('#sharing-user-known').removeClass('d-none');
                $('#sharing-user-unknown').addClass('d-none');
                document.title = displayName + ' - CheeseFork - Your Cheesy Scheduler';
            } else {
                $('#sharing-user-unknown').removeClass('d-none');
                $('#sharing-user-known').addClass('d-none');
                document.title = 'CheeseFork - Your Cheesy Scheduler';
            }

            if (!firstDataLoaded) {
                onLoadedFunc();
                firstDataLoaded = true;
            }
        }, function (error) {
            alert('Error loading data from server: ' + error);
        });
    }

    function watchSavedSchedule(onLoadedFunc) {
        var doc = firestoreAuthenticatedUserDoc();
        if (doc) {
            var firstDataLoaded = false;

            stopScheduleWatching = doc.onSnapshot(function (result) {
                if (result.metadata.hasPendingWrites) {
                    // The callback was called as a result of a local change, ignore it.
                    // https://stackoverflow.com/questions/50186413/is-firestore-onsnapshot-update-event-due-to-local-client-set
                    return;
                }

                if (!firstDataLoaded) {
                    // Save name in server for sharing purposes.
                    doc.set({displayName: firebase.auth().currentUser.displayName}, {merge: true});
                }

                var session = savedSessionFromFirestoreData(result.exists ? result.data() : {});
                setScheduleFromSavedSession(session, !firstDataLoaded);

                var metadata = savedMetadataFromFirestoreData(result.exists ? result.data() : {});
                metadataDiff = metadata ? computeMetadataDiff(metadata) : null;
                onMetadataDiffChange();

                currentSavedSession = session;

                if (!firstDataLoaded) {
                    onSavedSessionReset();
                    firstDataLoaded = true;
                    onLoadedFunc();
                } else {
                    onSavedSessionChange();
                }
            }, function (error) {
                alert('Error loading data from server: ' + error);
            });
        } else {
            var onStorageEvent = function (e) {
                var prefix = currentSemester + '_';
                // Check if the line starts with a required prefix.
                // https://stackoverflow.com/a/4579228
                if (e.key.lastIndexOf(prefix, 0) === 0) {
                    var session = savedSessionFromLocalStorage();
                    setScheduleFromSavedSession(session, true);

                    var metadata = savedMetadataFromLocalStorage();
                    metadataDiff = metadata ? computeMetadataDiff(metadata) : null;
                    onMetadataDiffChange();

                    currentSavedSession = session;
                    onSavedSessionChange();
                }
            };

            window.addEventListener('storage', onStorageEvent);

            stopScheduleWatching = function () {
                window.removeEventListener('storage', onStorageEvent);
            };

            var session = savedSessionFromLocalStorage();
            setScheduleFromSavedSession(session, false);

            var metadata = savedMetadataFromLocalStorage();
            metadataDiff = metadata ? computeMetadataDiff(metadata) : null;
            onMetadataDiffChange();

            currentSavedSession = session;
            onSavedSessionReset();

            onLoadedFunc();
        }
    }

    function savedSessionFromLocalStorage() {
        var semesterCoursesKey = currentSemester + '_courses';
        var session = {};
        try {
            session[semesterCoursesKey] = JSON.parse(localStorage.getItem(semesterCoursesKey) || '[]');
            session[semesterCoursesKey].forEach(function (course) {
                var courseKey = currentSemester + '_' + course;
                session[courseKey] = JSON.parse(localStorage.getItem(courseKey) || '{}');
            });
        } catch (e) {
            // localStorage is not available in IE/Edge when running from a local file.
            session[semesterCoursesKey] = [];
        }

        var semesterCustomEventsKey = currentSemester + '_custom_events';
        try {
            session[semesterCustomEventsKey] = JSON.parse(localStorage.getItem(semesterCustomEventsKey) || '{}');
        } catch (e) {
            // localStorage is not available in IE/Edge when running from a local file.
            session[semesterCustomEventsKey] = {};
        }

        return session;
    }

    function savedMetadataFromLocalStorage() {
        var semesterCoursesKey = currentSemester + '_courses';
        var metadata = {};
        try {
            var courses = JSON.parse(localStorage.getItem(semesterCoursesKey) || '[]');
            courses.forEach(function (course) {
                var metadataCourseKey = currentSemester + '_metadata_' + course;
                var courseMetadataEncoded = localStorage.getItem(metadataCourseKey);
                if (courseMetadataEncoded) {
                    metadata[course] = JSON.parse(courseMetadataEncoded);
                }
            });

            // If there's at least one course but no metadata at all, that probably means that
            // the user built the schedule before the feature was introduced.
            // Return null to handle the case.
            if (courses.length > 0 && Object.keys(metadata).length === 0) {
                metadata = null;
            }
        } catch (e) {
            // localStorage is not available in IE/Edge when running from a local file.
        }

        return metadata;
    }

    function savedSessionFromFirestoreData(data) {
        // Returns only the data relevant to the current semester from data.
        var semesterCoursesKey = currentSemester + '_courses';
        var session = {};
        session[semesterCoursesKey] = data[semesterCoursesKey] || [];
        session[semesterCoursesKey].forEach(function (course) {
            var courseKey = currentSemester + '_' + course;
            session[courseKey] = data[courseKey] || {};
        });

        var semesterCustomEventsKey = currentSemester + '_custom_events';
        session[semesterCustomEventsKey] = data[semesterCustomEventsKey] || {};

        return session;
    }

    function savedMetadataFromFirestoreData(data) {
        var semesterCoursesKey = currentSemester + '_courses';
        var metadata = {};

        var courses = data[semesterCoursesKey] || [];
        courses.forEach(function (course) {
            var metadataCourseKey = currentSemester + '_metadata_' + course;
            if (data[metadataCourseKey]) {
                metadata[course] = data[metadataCourseKey];
            }
        });

        // If there's at least one course but no metadata at all, that probably means that
        // the user built the schedule before the feature was introduced.
        // Return null to handle the case.
        if (courses.length > 0 && Object.keys(metadata).length === 0) {
            metadata = null;
        }

        return metadata;
    }

    function restoreSavedSession(currentSession, sessionToRestore) {
        var newKeys = [], removeKeys = [];
        var newMetadataCourses = [];

        var semesterCoursesKey = currentSemester + '_courses';
        var currentCourses = currentSession[semesterCoursesKey];
        var newCourses = sessionToRestore[semesterCoursesKey];
        if (JSON.stringify(currentCourses) !== JSON.stringify(newCourses)) {
            newKeys.push(semesterCoursesKey);
        }

        currentCourses.forEach(function (course) {
            if (newCourses.indexOf(course) === -1) {
                var courseKey = currentSemester + '_' + course;
                removeKeys.push(courseKey);

                if (metadataDiff) {
                    var metadataCourseKey = currentSemester + '_metadata_' + course;
                    removeKeys.push(metadataCourseKey);
                }
            }
        });

        newCourses.forEach(function (course) {
            var courseKey = currentSemester + '_' + course;
            if (currentCourses.indexOf(course) === -1) {
                newKeys.push(courseKey);
                if (metadataDiff) {
                    newMetadataCourses.push(course);
                }
            } else {
                var currentLessons = currentSession[courseKey];
                var newLessons = sessionToRestore[courseKey];
                // Can be different even if object are equal due to key order,
                // but that's OK, we'll just override the same data.
                if (JSON.stringify(currentLessons) !== JSON.stringify(newLessons)) {
                    newKeys.push(courseKey);
                }
            }
        });

        var semesterCustomEventsKey = currentSemester + '_custom_events';
        var currentCustomEvents = currentSession[semesterCustomEventsKey];
        var newCustomEvents = sessionToRestore[semesterCustomEventsKey];
        // Can be different even if object are equal due to key order,
        // but that's OK, we'll just override the same data.
        if (JSON.stringify(currentCustomEvents) !== JSON.stringify(newCustomEvents)) {
            newKeys.push(semesterCustomEventsKey);
        }

        var doc = firestoreAuthenticatedUserDoc();
        if (doc) {
            var input = {};

            removeKeys.forEach(function (key) {
                input[key] = firebase.firestore.FieldValue.delete();
            });

            newKeys.forEach(function (key) {
                input[key] = sessionToRestore[key];
            });

            newMetadataCourses.forEach(function (course) {
                var metadataCourseKey = currentSemester + '_metadata_' + course;
                input[metadataCourseKey] = courseManager.getCourseData(course);
            });

            doc.update(input);
        } else {
            try {
                removeKeys.forEach(function (key) {
                    localStorage.removeItem(key);
                });

                newKeys.forEach(function (key) {
                    localStorage.setItem(key, JSON.stringify(sessionToRestore[key]));
                });

                newMetadataCourses.forEach(function (course) {
                    var metadataCourseKey = currentSemester + '_metadata_' + course;
                    localStorage.setItem(metadataCourseKey, JSON.stringify(courseManager.getCourseData(course)));
                });
            } catch (e) {
                // localStorage is not available in IE/Edge when running from a local file.
            }
        }

        setScheduleFromSavedSession(sessionToRestore);
    }

    function setScheduleFromSavedSession(session, restoreScrollPosition) {
        var scrollTop;
        if (restoreScrollPosition) {
            scrollTop = $(window).scrollTop(); // save scroll position
        }

        var semesterCoursesKey = currentSemester + '_courses';
        courseButtonList.clear();

        var schedule = {};

        var courses = session[semesterCoursesKey] || [];
        courses.forEach(function (course) {
            if (!schedule[course] && courseManager.doesExist(course)) {
                courseButtonList.addCourse(course);

                var courseKey = currentSemester + '_' + course;
                var lessons = session[courseKey] || {};
                schedule[course] = lessons;
            }
        });

        var semesterCustomEventsKey = currentSemester + '_custom_events';
        var customEvents = session[semesterCustomEventsKey] || {};

        courseCalendar.loadSavedSchedule(schedule, customEvents);
        updateGeneralInfoLine();
        courseExamInfo.renderCourses(courseButtonList.getCourseNumbers(true));

        if (restoreScrollPosition) {
            $(window).scrollTop(scrollTop); // restore scroll position
        }
    }

    function resetSchedule() {
        courseButtonList.clear();
        courseCalendar.removeAll();
        updateGeneralInfoLine();
        courseExamInfo.renderCourses([]);
        courseSelect.filterReset();
    }

    function onSavedSessionReset() {
        savedSessionForUndo = $.extend(true, {}, currentSavedSession); // make a deep copy

        $('#top-navbar-undo').addClass('d-none');
        $('#top-navbar-redo').addClass('d-none');
    }

    function onSavedSessionChange() {
        $('#top-navbar-undo').removeClass('d-none');
        $('#top-navbar-redo').addClass('d-none');
    }

    function makeUndo() {
        restoreSavedSession(currentSavedSession, savedSessionForUndo);

        savedSessionForRedo = currentSavedSession;
        currentSavedSession = $.extend(true, {}, savedSessionForUndo); // make a deep copy

        $('#top-navbar-undo').addClass('d-none');
        $('#top-navbar-redo').removeClass('d-none');
    }

    function makeRedo() {
        restoreSavedSession(currentSavedSession, savedSessionForRedo);

        currentSavedSession = savedSessionForRedo;
        savedSessionForRedo = null;

        $('#top-navbar-redo').addClass('d-none');
        $('#top-navbar-undo').removeClass('d-none');
    }

    function firestoreAuthenticatedUserDoc() {
        if (typeof firebase !== 'undefined' && firebase.auth().currentUser !== null) {
            var doc = firestoreDb.collection('users').doc(firebase.auth().currentUser.uid);

            var semestersWithoutSubCollection = ['201701', '201702', '201703', '201801'];
            if (semestersWithoutSubCollection.indexOf(currentSemester) === -1) {
                doc = doc.collection('semesters').doc(currentSemester);
            }

            return doc;
        }
        return null;
    }

    function firestoreUserDoc(userId) {
        var doc = firestoreDb.collection('users').doc(userId);

        var semestersWithoutSubCollection = ['201701', '201702', '201703', '201801'];
        if (semestersWithoutSubCollection.indexOf(currentSemester) === -1) {
            doc = doc.collection('semesters').doc(currentSemester);
        }

        return doc;
    }

    function computeMetadataDiff(metadata) {
        var diff = {};

        Object.keys(metadata).forEach(function (course) {
            var courseMetadata = metadata[course];

            if (!courseManager.doesExist(course)) {
                diff[course] = {
                    exists: false,
                    general: courseMetadata.general
                };
                return;
            }

            var generalCourseDiff = computeCourseGeneralMetadataDiff(courseMetadata.general, courseManager.getGeneralInfo(course));
            var scheduleCourseDiff = computeCourseScheduleMetadataDiff(courseMetadata.schedule, courseManager.getSchedule(course));
            if (generalCourseDiff.length > 0 || scheduleCourseDiff.length > 0) {
                diff[course] = {
                    exists: true,
                    changes: generalCourseDiff.concat(scheduleCourseDiff)
                };
            }
        });

        return diff;
    }

    function computeCourseGeneralMetadataDiff(oldGeneral, newGeneral) {
        var keyOrder = {
            'פקולטה'                          : 1,
            'שם מקצוע'                        : 2,
            'מספר מקצוע'                      : 3,
            'אתר הקורס'                       : 4,
            'נקודות'                          : 5,
            'הרצאה'                           : 6,
            'תרגיל'                           : 7,
            'מעבדה'                           : 8,
            'סמינר\/פרויקט'                   : 9,
            'סילבוס'                          : 10,
            'מקצועות קדם'                     : 11,
            'מקצועות צמודים'                  : 12,
            'מקצועות ללא זיכוי נוסף'          : 13,
            'מקצועות ללא זיכוי נוסף (מכילים)' : 14,
            'מקצועות ללא זיכוי נוסף (מוכלים)' : 15,
            'מקצועות זהים'                    : 16,
            'עבור לסמסטר'                     : 17,
            'אחראים'                          : 18,
            'הערות'                           : 19,
            'מועד הבחינה'                     : 20,
            'מועד א'                          : 21,
            'מועד ב'                          : 22,
            'מיקום'                           : 23
        };
        var compareFunction = function (a, b) {
            if (keyOrder[a] && keyOrder[b]) {
                return keyOrder[a] - keyOrder[b];
            } else if (keyOrder[a]) {
                return -1;
            } else if (keyOrder[b]) {
                return 1;
            } else {
                return a.localeCompare(b);
            }
        };

        var keyExclude = {
            'אתר הקורס': true,
            'עבור לסמסטר': true,
            'מיקום': true
        };

        var oldText = '';
        Object.keys(oldGeneral).sort(compareFunction).forEach(function (key) {
            if (!keyExclude[key] && oldGeneral[key] !== newGeneral[key] && oldGeneral[key]) {
                oldText += key + ': ' + oldGeneral[key] + '\n';
            }
        });

        var newText = '';
        Object.keys(newGeneral).sort(compareFunction).forEach(function (key) {
            if (!keyExclude[key] && newGeneral[key] !== oldGeneral[key] && newGeneral[key]) {
                newText += key + ': ' + newGeneral[key] + '\n';
            }
        });

        if (oldText === '' && newText === '') {
            return [];
        }

        return [{
            title: 'מידע כללי',
            old: oldText.trim(),
            new: newText.trim()
        }];
    }

    function computeCourseScheduleMetadataDiff(oldSchedule, newSchedule) {
        var diff = [];
        var scheduleGroups = {};

        var oldScheduleByGroups = scheduleToGroupOfTexts(oldSchedule);
        var newScheduleByGroups = scheduleToGroupOfTexts(newSchedule);

        Object.keys(scheduleGroups).sort().forEach(function (typeAndNumber) {
            if (oldScheduleByGroups[typeAndNumber] !== newScheduleByGroups[typeAndNumber]) {
                diff.push({
                    title: typeAndNumber,
                    old: (oldScheduleByGroups[typeAndNumber] || '').trim(),
                    new: (newScheduleByGroups[typeAndNumber] || '').trim()
                });
            }
        });

        return diff;

        function scheduleToGroupOfTexts(schedule) {
            var keyOrder = {
                'מרצה\/מתרגל' : 1,
                'יום'         : 2,
                'שעה'         : 3,
                'בניין'       : 4,
                'חדר'         : 5
            };
            var compareFunction = function (a, b) {
                if (keyOrder[a] && keyOrder[b]) {
                    return keyOrder[a] - keyOrder[b];
                } else if (keyOrder[a]) {
                    return -1;
                } else if (keyOrder[b]) {
                    return 1;
                } else {
                    return a.localeCompare(b);
                }
            };

            var lessonsAdded = {};

            var scheduleByGroups = {};
            schedule.forEach(function (lesson) {
                if (lessonsAdded.propertyIsEnumerable(lesson['מס.']) && lessonsAdded[lesson['מס.']] !== lesson['קבוצה']) {
                    return;
                }

                var lessonText = '';
                Object.keys(lesson).sort(compareFunction).forEach(function (key) {
                    if (key !== 'קבוצה' &&
                        key !== 'מס.' &&
                        key !== 'סוג' &&
                        lesson[key]) {
                        lessonText += key + ': ' + lesson[key] + '\n';
                    }
                });

                var typeAndNumber = courseManager.getLessonTypeAndNumber(lesson);
                if (!scheduleByGroups.propertyIsEnumerable(typeAndNumber)) {
                    scheduleByGroups[typeAndNumber] = '';
                }

                scheduleByGroups[typeAndNumber] += lessonText + '\n';

                lessonsAdded[lesson['מס.']] = lesson['קבוצה'];
                scheduleGroups[typeAndNumber] = true;
            });

            return scheduleByGroups;
        }
    }

    function getPrettyMetadataDiff() {
        var result;

        if (metadataDiff) {
            result = $('<div class="course-metadata-diff-container">');

            Object.keys(metadataDiff).sort().forEach(function (course) {
                var courseDiff = metadataDiff[course];
                var general, courseTitle;
                if (courseDiff.exists) {
                    general = courseManager.getGeneralInfo(course);
                    courseTitle = general['מספר מקצוע'] + ' - ' + general['שם מקצוע'];
                    result.append($('<h3>').text(courseTitle));

                    courseDiff.changes.forEach(function (diff) {
                        result.append($('<h5>').text(diff.title));

                        var jsDiff = JsDiff.diffWords(diff.old, diff.new);
                        jsDiff.forEach(function (part) {
                            var partElement = $('<span>').text(part.value);
                            if (part.added) {
                                partElement.addClass('course-metadata-diff-new');
                            } else if (part.removed) {
                                partElement.addClass('course-metadata-diff-old');
                            }

                            result.append(partElement);
                        });
                    });
                } else {
                    general = courseDiff.general;
                    courseTitle = general['מספר מקצוע'] + ' - ' + general['שם מקצוע'];
                    result.append($('<h3>').text(courseTitle)).append($('<span>').text('הקורס לא קיים יותר'));
                }
            });
        } else {
            result = $('<div>');

            var explanation = 'מעכשיו תוכלו להתעדכן בכל השינויים שקורים בקורסים שלכם דרך CheeseFork! ' +
                'לחצו על הכפתור <b>אשר שינויים</b>, ובכל פעם שיהיו שינויים באחד הקורסים שאתם רשומים אליו, אתם תראו אותם פה בחלון השינויים.';

            result.html(explanation);
        }

        return result;
    }

    function setMetadataToCurrent() {
        var deletedCourses = [];
        if (metadataDiff) {
            deletedCourses = Object.keys(metadataDiff).filter(function (course) {
                return !metadataDiff[course].exists;
            });
        }

        var semesterCoursesKey = currentSemester + '_courses';
        if (deletedCourses.length > 0) {
            currentSavedSession[semesterCoursesKey] = $(currentSavedSession[semesterCoursesKey]).not(deletedCourses).get();
        }

        deletedCourses.forEach(function (course) {
            var courseKey = currentSemester + '_' + course;
            delete currentSavedSession[courseKey];
        });

        var courseNumbers = courseButtonList.getCourseNumbers(true);

        var doc = firestoreAuthenticatedUserDoc();
        if (doc) {
            var input = {};

            courseNumbers.forEach(function (course) {
                var metadataCourseKey = currentSemester + '_metadata_' + course;
                var courseData = courseManager.getCourseData(course);
                input[metadataCourseKey] = courseData;
            });

            if (deletedCourses.length > 0) {
                input[semesterCoursesKey] = currentSavedSession[semesterCoursesKey];
            }

            deletedCourses.forEach(function (course) {
                var courseKey = currentSemester + '_' + course;
                input[courseKey] = firebase.firestore.FieldValue.delete();

                var metadataCourseKey = currentSemester + '_metadata_' + course;
                input[metadataCourseKey] = firebase.firestore.FieldValue.delete();
            });

            doc.update(input);
        } else {
            try {
                courseNumbers.forEach(function (course) {
                    var metadataCourseKey = currentSemester + '_metadata_' + course;
                    var courseData = courseManager.getCourseData(course);
                    localStorage.setItem(metadataCourseKey, JSON.stringify(courseData));
                });

                if (deletedCourses.length > 0) {
                    localStorage.setItem(semesterCoursesKey, JSON.stringify(currentSavedSession[semesterCoursesKey]));
                }

                deletedCourses.forEach(function (course) {
                    var courseKey = currentSemester + '_' + course;
                    localStorage.removeItem(courseKey);

                    var metadataCourseKey = currentSemester + '_metadata_' + course;
                    localStorage.removeItem(metadataCourseKey);
                });
            } catch (e) {
                // localStorage is not available in IE/Edge when running from a local file.
            }
        }

        metadataDiff = {};
        onMetadataDiffChange();
    }

    function onMetadataDiffChange() {
        var badgeCount = 0;

        if (metadataDiff) {
            var diffCourses = Object.keys(metadataDiff);
            if (diffCourses.length > 0) {
                badgeCount = diffCourses.reduce(function (accumulator, course) {
                    var diff = metadataDiff[course];
                    return accumulator + (diff.exists ? diff.changes.length : 1);
                }, 0);
            }
        } else {
            // If !metadataDiff, that probably means that
            // the user built the schedule before the feature was introduced.
            badgeCount = 1;
        }

        if (badgeCount > 0) {
            $('#top-navbar-changes').removeClass('d-none').find('.unread-count-badge').text(badgeCount);
            $('#top-navbar .navbar-toggler .unread-count-badge').text(badgeCount).removeClass('d-none');
        } else {
            $('#top-navbar-changes').addClass('d-none');
            $('#top-navbar .navbar-toggler .unread-count-badge').addClass('d-none');
        }
    }

    // https://stackoverflow.com/a/30810322
    function copyToClipboard(text, onSuccess, onFailure) {
        if (!navigator.clipboard) {
            fallbackCopyTextToClipboard(text);
            return;
        }
        navigator.clipboard.writeText(text).then(function () {
            onSuccess();
        }, function (err) {
            onFailure();
        });

        function fallbackCopyTextToClipboard(text) {
            var textArea = document.createElement("textarea");
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            var successful = false;
            try {
                successful = document.execCommand('copy');
            } catch (err) { }

            document.body.removeChild(textArea);

            if (successful) {
                onSuccess();
            } else {
                onFailure();
            }
        }
    }

    function crawlersInfo() {
        var courseParameter = getParameterByName('course');
        var staffParameter = getParameterByName('staff');
        var roomParameter = getParameterByName('room');

        if (courseParameter === null && staffParameter === null && roomParameter === null) {
            return false;
        }

        var content = $('<div class="col-md-12">');
        var title = semesterFriendlyName(currentSemester) + ' - CheeseFork';

        if (courseParameter !== null) {
            if (courseManager.doesExist(courseParameter)) {
                crawlersMakeCourseContent(content, courseParameter);
                title = courseManager.getTitle(courseParameter) + ' - ' + title;
            } else {
                crawlersMakeListHeader(content, 'course');
                crawlersMakeCourseListContent(content);
                title = 'קורסים - ' + title;
            }
        } else if (staffParameter !== null) {
            if (crawlersMakeStaffContent(content, staffParameter)) {
                title = staffParameter + ' - ' + title;
            } else {
                crawlersMakeListHeader(content, 'staff');
                crawlersMakeStaffListContent(content);
                title = 'סגל - ' + title;
            }
        } else { // if (roomParameter !== null)
            if (crawlersMakeRoomContent(content, roomParameter)) {
                title = roomParameter + ' - ' + title;
            } else {
                crawlersMakeListHeader(content, 'room');
                crawlersMakeRoomListContent(content);
                title = 'חדרים - ' + title;
            }
        }

        document.title = title;

        $('#content-container').html(content);

        $('#top-navbar-home').removeClass('d-none');
        $('#top-navbar-share').addClass('d-none');
        $('#top-navbar-export').addClass('d-none');
        $('#top-navbar-semester').addClass('d-none');
        $('#course-select').hide();

        $('#top-navbar-supported-content').removeClass('top-navbar-content-uninitialized');

        $('#footer-semester-name').text(semesterFriendlyName(currentSemester));
        $('#footer-semester').removeClass('d-none');

        // The filter form is indexed by Google even though it's hidden, so remove it.
        $('#filter-form').remove();

        $('#page-loader').hide();

        return true;
    }

    function crawlersMakeListHeader(content, currentList) {
        Object.keys(availableSemesters).sort().forEach(function (semester) {
            var text = semesterFriendlyName(semester);
            if (semester === currentSemester) {
                content.append($('<span>').text(text));
            } else {
                var url = '?semester=' + encodeURIComponent(semester) + '&course=all';
                content.append($('<a>').text(text).prop('href', url));
            }
            content.append('<br>');
        });

        content.append('<br>');

        var listToText = {
            'course': 'קורסים',
            'staff': 'סגל',
            'room': 'חדרים'
        };

        ['course', 'staff', 'room'].forEach(function (list) {
            var text = listToText[list];
            if (list === currentList) {
                content.append($('<span>').text(text));
            } else {
                var url = '?semester=' + encodeURIComponent(currentSemester) + '&' + encodeURIComponent(list) + '=all';
                content.append($('<a>').text(text).prop('href', url));
            }
            content.append('<br>');
        });

        content.append('<br>');
    }

    function crawlersMakeCourseContent(content, course) {
        var url = '?semester=' + encodeURIComponent(currentSemester) + '&course=all';
        content.append($('<a>').text('לרשימת הקורסים').prop('href', url));
        content.append('<br><br>');

        var description = courseManager.getDescription(course, {html: true, links: true});
        content.append($('<div>').html(description));

        var lessonsAdded = {};
        courseManager.getSchedule(course).forEach(function (lesson) {
            if (lessonsAdded.propertyIsEnumerable(lesson['מס.']) && lessonsAdded[lesson['מס.']] !== lesson['קבוצה']) {
                return;
            }

            content.append('<br>');

            var typeAndNumber = courseManager.getLessonTypeAndNumber(lesson);
            content.append($('<div style="font-weight: bold;">').text(typeAndNumber));

            if (lesson['מרצה\/מתרגל']) {
                var staffContents = $('<div>').text('מרצה\/מתרגל' + ': ');
                lesson['מרצה\/מתרגל'].split('\n').forEach(function (name, i) {
                    if (i > 0) {
                        staffContents.append(', ');
                    }
                    var staffUrl = '?semester=' + encodeURIComponent(currentSemester) + '&staff=' + encodeURIComponent(name);
                    var staffLink = $('<a>').text(name).prop('href', staffUrl);
                    staffContents.append(staffLink);
                });
                content.append(staffContents);
            }

            if (lesson['יום']) {
                content.append($('<div>').text('יום' + ': ' + lesson['יום']));
            }

            if (lesson['שעה']) {
                content.append($('<div>').text('שעה' + ': ' + lesson['שעה']));
            }

            if (lesson['בניין'] && lesson['חדר']) {
                content.append($('<div>').text('בניין' + ': ' + lesson['בניין']));
                var roomUrl = '?semester=' + encodeURIComponent(currentSemester) + '&room=' + encodeURIComponent(lesson['בניין'] + ' ' + lesson['חדר']);
                var roomLink = $('<a>').text(lesson['חדר']).prop('href', roomUrl);
                content.append($('<div>').text('חדר' + ': ').append(roomLink));
            } else if (lesson['בניין']) {
                var roomUrl = '?semester=' + encodeURIComponent(currentSemester) + '&room=' + encodeURIComponent(lesson['בניין']);
                var roomLink = $('<a>').text(lesson['בניין']).prop('href', roomUrl);
                content.append($('<div>').text('בניין' + ': ').append(roomLink));
            } else if (lesson['חדר']) {
                content.append($('<div>').text('חדר' + ': ' + lesson['חדר']));
            }

            lessonsAdded[lesson['מס.']] = lesson['קבוצה'];
        });
    }

    function crawlersMakeCourseListContent(content) {
        courseManager.getAllCourses().sort().forEach(function (cbCourse) {
            var title = courseManager.getTitle(cbCourse);
            var url = '?semester=' + encodeURIComponent(currentSemester) + '&course=' + encodeURIComponent(cbCourse);
            content.append($('<a>').text(title).prop('href', url));
            content.append('<br>');
        });
    }

    function crawlersMakeStaffContent(content, staff) {
        var schedule = [];
        courseManager.getAllCourses().forEach(function (course) {
            var lessonsAdded = {};
            courseManager.getSchedule(course).forEach(function (lesson) {
                if (lessonsAdded.propertyIsEnumerable(lesson['מס.']) && lessonsAdded[lesson['מס.']] !== lesson['קבוצה']) {
                    return;
                }

                if (lesson['מרצה\/מתרגל'] && lesson['מרצה\/מתרגל'].split('\n').indexOf(staff) !== -1) {
                    var time = null;
                    if (lesson['יום']) {
                        if (lesson['שעה']) {
                            time = 'יום ' + lesson['יום'] + ' ' + lesson['שעה'];
                        } else {
                            time = 'יום ' + lesson['יום'];
                        }
                    }

                    schedule.push({course: course, time: time});
                }

                lessonsAdded[lesson['מס.']] = lesson['קבוצה'];
            });
        });

        if (schedule.length === 0) {
            return false;
        }

        var url = '?semester=' + encodeURIComponent(currentSemester) + '&staff=all';
        content.append($('<a>').text('לרשימת הסגל').prop('href', url));
        content.append('<br><br>');

        content.append($('<b>').text(staff));
        content.append('<br>');

        schedule.sort(function (a, b) {
            if (!a.time && !b.time) {
                return 0;
            } else if (!a.time) {
                return 1;
            } else if (!b.time) {
                return -1;
            } else {
                return a.time.localeCompare(b.time, undefined, {numeric: true});
            }
        }).forEach(function (item) {
            if (item.time) {
                content.append($('<span>').text(item.time + ' - '));
            }

            var url = '?semester=' + encodeURIComponent(currentSemester) + '&course=' + encodeURIComponent(item.course);
            var courseTitle = courseManager.getTitle(item.course);
            content.append($('<a>').text(courseTitle).prop('href', url));
            content.append('<br>');
        });

        return true;
    }

    function crawlersMakeStaffListContent(content) {
        var staff = {};
        courseManager.getAllCourses().forEach(function (course) {
            courseManager.getSchedule(course).forEach(function (lesson) {
                if (lesson['מרצה\/מתרגל']) {
                    lesson['מרצה\/מתרגל'].split('\n').forEach(function (name) {
                        staff[name] = true;
                    });
                }
            });
        });

        Object.keys(staff).sort().forEach(function (name) {
            var url = '?semester=' + encodeURIComponent(currentSemester) + '&staff=' + encodeURIComponent(name);
            content.append($('<a>').text(name).prop('href', url));
            content.append('<br>');
        });
    }

    function crawlersMakeRoomContent(content, room) {
        var schedule = [];
        courseManager.getAllCourses().forEach(function (course) {
            var lessonsAdded = {};
            courseManager.getSchedule(course).forEach(function (lesson) {
                if (lessonsAdded.propertyIsEnumerable(lesson['מס.']) && lessonsAdded[lesson['מס.']] !== lesson['קבוצה']) {
                    return;
                }

                var roomCompare = null;
                if (lesson['בניין']) {
                    if (lesson['חדר']) {
                        roomCompare = lesson['בניין'] + ' ' + lesson['חדר'];
                    } else {
                        roomCompare = lesson['בניין'];
                    }
                }

                if (roomCompare && room === roomCompare) {
                    var time = null;
                    if (lesson['יום']) {
                        if (lesson['שעה']) {
                            time = 'יום ' + lesson['יום'] + ' ' + lesson['שעה'];
                        } else {
                            time = 'יום ' + lesson['יום'];
                        }
                    }

                    schedule.push({course: course, time: time});
                }

                lessonsAdded[lesson['מס.']] = lesson['קבוצה'];
            });
        });

        if (schedule.length === 0) {
            return false;
        }

        var url = '?semester=' + encodeURIComponent(currentSemester) + '&room=all';
        content.append($('<a>').text('לרשימת החדרים').prop('href', url));
        content.append('<br><br>');

        content.append($('<b>').text(room));
        content.append('<br>');

        schedule.sort(function (a, b) {
            if (!a.time && !b.time) {
                return 0;
            } else if (!a.time) {
                return 1;
            } else if (!b.time) {
                return -1;
            } else {
                return a.time.localeCompare(b.time, undefined, {numeric: true});
            }
        }).forEach(function (item) {
            if (item.time) {
                content.append($('<span>').text(item.time + ' - '));
            }

            var url = '?semester=' + encodeURIComponent(currentSemester) + '&course=' + encodeURIComponent(item.course);
            var courseTitle = courseManager.getTitle(item.course);
            content.append($('<a>').text(courseTitle).prop('href', url));
            content.append('<br>');
        });

        return true;
    }

    function crawlersMakeRoomListContent(content) {
        var rooms = {};
        courseManager.getAllCourses().forEach(function (course) {
            courseManager.getSchedule(course).forEach(function (lesson) {
                if (lesson['בניין']) {
                    if (lesson['חדר']) {
                        rooms[lesson['בניין'] + ' ' + lesson['חדר']] = true;
                    } else {
                        rooms[lesson['בניין']] = true;
                    }
                }
            });
        });

        Object.keys(rooms).sort().forEach(function (room) {
            var url = '?semester=' + encodeURIComponent(currentSemester) + '&room=' + encodeURIComponent(room);
            content.append($('<a>').text(room).prop('href', url));
            content.append('<br>');
        });
    }

    // https://stackoverflow.com/a/901144
    function getParameterByName(name, url) {
        if (!url) url = window.location.href;
        name = name.replace(/[\[\]]/g, "\\$&");
        var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
            results = regex.exec(url);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, " "));
    }
})();
