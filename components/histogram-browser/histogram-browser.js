'use strict';

/* global BootstrapDialog, gtag */

// eslint-disable-next-line no-unused-vars
var HistogramBrowser = (function () {
    function HistogramBrowser(element, options) {
        this.element = element;
        this.selectColumnGrid = options.selectColumnGrid;
        this.shareGuideInNewWindow = options.shareGuideInNewWindow;
    }

    function roundGrade(strGrade) {
        return strGrade.trim().replace(/\.\d+$/, '') || '--';
    }

    function renderHistograms(histogramBrowser, course, data) {
        var element = histogramBrowser.element;
        var semesters = Object.keys(data);
        if (semesters.length > 0) {
            var semesterSelect = $('<select class="form-control"></select>');

            semesters.forEach(function (semester, i) {
                var text = semesterFriendlyName(semester);
                var props = [];

                var termA = data[semester].Final_A || data[semester].Exam_A;
                if (termA) {
                    props.push('א\' ' + roundGrade(termA.average));
                }

                var termB = data[semester].Final_B || data[semester].Exam_B;
                if (termB) {
                    props.push('ב\' ' + roundGrade(termB.average));
                }

                // var termC = data[semester].Final_C || data[semester].Exam_C;
                // if (termC) {
                //     props.push('ג\' ' + roundGrade(termC.average));
                // }

                var final = data[semester].Finals;
                if (final) {
                    props.push('סופי ' + roundGrade(final.average));
                }

                var staff = data[semester].Staff;
                if (staff) {
                    var lecturer = null;
                    staff.forEach(function (item) {
                        if (!lecturer && item.title === 'מרצה - אחראי מקצוע') {
                            lecturer = item.name;
                        }
                    });

                    if (lecturer) {
                        props.push(lecturer);
                    }
                }

                if (props.length > 0) {
                    text += '\xA0'.repeat(16 - text.length);
                    text += props.join('\xA0\xA0');
                }

                semesterSelect.append($('<option>', {
                    value: semester,
                    text: text,
                    selected: i === semesters.length - 1
                }));
            });

            var activated = shouldActivateHistogramView();
            var selectColumnGrid = histogramBrowser.selectColumnGrid || 'lg';
            var html = '<div class="histogram-container' + (activated ? ' histogram-activated' : '') + '">' +
                    '<div class="histogram-overlay-message">' +
                        '<div class="alert alert-primary" role="alert">' +
                            'עליכם לשתף את ההיסטגרמות שלכם לפני שתוכלו להציג היסטוגרמות שסטודנטים אחרים שיתפו. השיתוף אוטומטי ולוקח מספר דקות.' +
                        '</div>' +
                        '<div class="histogram-overlay-message-button-container">' +
                            '<button type="button" class="btn btn-primary histogram-button-share">שיתוף היסטוגרמות</button>' +
                        '</div>' +
                        '<div class="histogram-overlay-message-button-container">' +
                            '<button type="button" class="btn histogram-button-activate">כבר שיתפתי</button>' +
                        '</div>' +
                        '<div class="histogram-overlay-message-button-container">' +
                            '<button type="button" class="btn histogram-button-snooze">שיתוף בפעם אחרת</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="histogram-content">' +
                        '<div class="form-row">' +
                            '<div class="form-group col-' + selectColumnGrid + '-6 histogram-semesters"></div>' +
                            '<div class="form-group col-' + selectColumnGrid + '-6 histogram-categories"></div>' +
                        '</div>' +
                        '<div class="histogram-data table-responsive">' +
                            '<table class="table table-bordered table-sm">' +
                                '<thead class="thead-light">' +
                                    '<tr>' +
                                        '<th scope="col">סטודנטים</th>' +
                                        '<th scope="col">עברו</th>' +
                                        '<th scope="col">נכשלו</th>' +
                                        '<th scope="col">אחוז עוברים</th>' +
                                        '<th scope="col">ציון מינימלי</th>' +
                                        '<th scope="col">ציון מקסימלי</th>' +
                                        '<th scope="col">ממוצע</th>' +
                                        '<th scope="col">חציון</th>' +
                                    '</tr>' +
                                '</thead>' +
                                '<tbody>' +
                                    '<tr>' +
                                        '<td class="histogram-value-students"></td>' +
                                        '<td class="histogram-value-pass"></td>' +
                                        '<td class="histogram-value-fail"></td>' +
                                        '<td class="histogram-value-passPercent"></td>' +
                                        '<td class="histogram-value-min"></td>' +
                                        '<td class="histogram-value-max"></td>' +
                                        '<td class="histogram-value-average"></td>' +
                                        '<td class="histogram-value-median"></td>' +
                                    '</tr>' +
                                '</tbody>' +
                            '</table>' +
                        '</div>' +
                        '<div class="histogram-image-container-outer"><div class="histogram-image-container"></div></div>' +
                        '<div class="histogram-staff-table row mt-3 d-none">' +
                            '<div class="col-' + selectColumnGrid + '-6">' +
                                '<table class="table table-bordered table-sm">' +
                                    '<thead class="thead-light">' +
                                        '<tr>' +
                                            '<th scope="col">איש סגל</th>' +
                                            '<th scope="col">תפקיד</th>' +
                                        '</tr>' +
                                    '</thead>' +
                                    '<tbody>' +
                                    '</tbody>' +
                                '</table>' +
                            '</div>' +
                        '</div>' +
                        '<div>' +
                            '<a href="share-histograms.html" target="_blank" class="small">שיתוף היסטוגרמות</a>' +
                        '</div>' +
                    '</div>' +
                '</div>';

            element.html(html).find('.histogram-semesters').html(semesterSelect);

            element.find('.histogram-button-share').click(function () {
                onButtonShare(histogramBrowser);
            });
            element.find('.histogram-button-activate').click(function () {
                onButtonActivate(histogramBrowser);
            });
            element.find('.histogram-button-snooze').click(function () {
                onButtonSnooze(histogramBrowser);
            });

            semesterSelect.on('change', function () {
                onSemesterSelect(histogramBrowser, course, this.value, data[this.value]);
            }).trigger('change');
        } else {
            var noDataHtml = '<div>לא קיימות היסטוגרמות לקורס זה.</div>' +
                '<div>' +
                    '<a href="share-histograms.html" target="_blank" class="small">שיתוף היסטוגרמות</a>' +
                '</div>';
            element.html(noDataHtml);
        }
    }

    // https://stackoverflow.com/a/32261263
    function popupWindow(url, title, win, w, h) {
        var y = win.outerHeight / 2 + win.screenY - (h / 2);
        var x = win.outerWidth / 2 + win.screenX - (w / 2);
        return win.open(url, title, 'toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=no, resizable=no, copyhistory=no, width=' + w + ', height=' + h + ', top=' + y + ', left=' + x);
    }

    function onButtonShare(histogramBrowser) {
        gtag('event', 'histogram-button-share');

        if (histogramBrowser.shareGuideInNewWindow) {
            popupWindow('share-histograms.html', 'share-histograms.html', window, 800, 600);
            return;
        }

        BootstrapDialog.show({
            title: 'שיתוף היסטוגרמות',
            // Message based on share-histograms.html.
            message: '<div class="histogram-modal-guide-content"> <p>עקבו אחרי השלבים הבאים בשביל לשתף את ההיסטוגרמות הנגישות לכם באתר הציונים של הטכניון.</p> <p>ביצוע השלבים יגרום לקוד של שיתוף ההיסטוגרמות לרוץ בסביבת אתר הציונים של הטכניון. את הקוד ניתן לראות <a href="share-histograms.js" target="_blank"> כאן</a>.</p> <p>המידע יישלח למאגר שמאוחסן ב-GitHub <a href="https://github.com/michael-maltsev/technion-histograms" target="_blank" rel="noopener">כאן</a>.</p> <p>ישותף מידע כללי בלבד, כגון מספר הסטודנטים וממוצעי המבחנים. המידע ישותף רק לאחר לחיצה על כפתור השיתוף. לא ישותף מידע אישי.</p> <p>את השיתוף ניתן לבצע גם מהפלאפון, לפחות דרך Chrome, וייתכן גם דרך דפדפנים אחרים שלא בדקנו.</p> <h3>שלבי השיתוף עם התוסף <a href="https://chrome.google.com/webstore/detail/technion-plus/dgnlgpmjgafdilamdjgapndbmlehamhl" target="_blank" rel="noopener">Technion Plus</a></h3> <ol> <li class="mb-0"> היכנסו <a href="https://grades.technion.ac.il/" target="_blank" rel="noopener">לאתר הציונים של הטכניון</a> והתחברו במידת הצורך. </li> <li class="mb-0"> לחצו על <a href="assets/share-histograms-guide-technionplus-1.png" target="_blank">כפתור שיתוף ההיסטוגרמות</a>. </li> <li> דלגו לשלב 4 בהמשך עמוד זה. </li> </ol> <h3>שלבי השיתוף ללא התוסף</h3> <ol> <li> העתיקו את הקוד הבא: <div class="form-row mt-2"> <div class="form-group mb-0 col-md-12"> <textarea dir="ltr" class="form-control" id="javascript-code-container" rows="4" onfocus="this.select();" onmouseup="return false;" readonly>avascript:var url=\'https://cheesefork.cf/share-histograms.js\';var script=document.createElement(\'script\');script.src=url;document.head.appendChild(script);</textarea> <button type="button" class="btn btn-primary mt-2" id="javascript-code-copy-button">העתקת הקוד</button> </div> </div> </li> <li> היכנסו לאתר הציונים של הטכניון והתחברו במידת הצורך. <div class="form-group"> <a class="btn btn-primary mt-2" href="https://grades.technion.ac.il/" role="button" target="_blank" rel="noopener">כניסה לאתר הציונים</a> </div> </li> <li> <p> <strong>עבור Chrome:</strong> הכניסו בשורת הכתובת את האות j, ולאחריה הדביקו את הקוד שהעתקתם בשלב 1. לבסוף לחצו Enter.<br> <img class="border border-primary mt-2 img-fluid d-none d-sm-block" src="assets/share-histograms-guide-1.png" alt="הדביקו את הקוד כך"> <img class="border border-primary mt-2 img-fluid d-block d-sm-none" src="assets/share-histograms-guide-mobile-1.png" alt="הדביקו את הקוד כך"> </p> <p> <strong>עבור דפדפנים אחרים:</strong> תנסו לבצע את הנ"ל. אם זה לא עובד (למשל האפשרות חסומה בגרסאות חדשות של Firefox) תפתחו את ה-Developer Tools בדפדפן שלכם, עברו ללשונית Console, הכניסו בשורת הקוד את האות j, ולאחריה הדביקו את הקוד שהעתקתם בשלב 1. לבסוף לחצו Enter. </p> </li> <li> <p> המתינו לטעינת המידע, ולחצו על כפתור השיתוף הירוק לשיתוף ההיסטוגרמות.<br> <strong>חשוב:</strong> אל תגלשו באתר הציונים בזמן הטעינה, גם לא בחלון אחר של הדפדפן.<br> <img class="border border-primary mt-2 img-fluid d-none d-sm-block" src="assets/share-histograms-guide-2.png" alt="לחצו לשיתוף ההיסטוגרמות כך"> <img class="border border-primary mt-2 img-fluid d-block d-sm-none" src="assets/share-histograms-guide-mobile-2.png" alt="לחצו לשיתוף ההיסטוגרמות כך"> </p> </li> <li> המתינו להשלמת השיתוף. גם בזמן השיתוף, אל תגלשו באתר הציונים, גם לא בחלון אחר של הדפדפן. </li> </ol> </div>',
            buttons: [{
                label: 'שיתפתי',
                cssClass: 'btn-primary',
                action: function (dialog) {
                    gtag('event', 'histogram-share-submit');

                    var nextShowDate = new Date();
                    nextShowDate.setDate(nextShowDate.getDate() + 30 * 4);
                    activateAndSetNextShowDate(histogramBrowser, nextShowDate);

                    dialog.close();
                }
            }, {
                label: 'סגור',
                action: function (dialog) {
                    dialog.close();
                }
            }],
            onshow: function (dialog) {
                dialog.getModalBody().find('#javascript-code-copy-button').click(function () {
                    var button = $(this);
                    var code = dialog.getModalBody().find('#javascript-code-container').val();
                    copyToClipboard(code, function () {
                        var text = button.text();
                        button.text(text + ' ✓').prop('disabled', true);
                        setTimeout(function () {
                            button.text(text).prop('disabled', false);
                        }, 500);
                    }, function () {
                        alert('ההעתקה נכשלה');
                    });
                });
            }
        });
    }

    function onButtonActivate(histogramBrowser) {
        gtag('event', 'histogram-button-claim-activate');
        var nextShowDate = new Date();
        nextShowDate.setDate(nextShowDate.getDate() + 30 * 4);
        activateAndSetNextShowDate(histogramBrowser, nextShowDate);
    }

    function onButtonSnooze(histogramBrowser) {
        gtag('event', 'histogram-button-snooze');
        var nextShowDate = new Date();
        nextShowDate.setHours(nextShowDate.getHours() + 1);
        activateAndSetNextShowDate(histogramBrowser, nextShowDate);
    }

    function shouldActivateHistogramView() {
        try {
            var nextShowDate = localStorage.getItem('nextHistogramShareMessage');
            return nextShowDate && Date.now() < nextShowDate;
        } catch (e) {
            // localStorage is not available in IE/Edge when running from a local file.
            return true;
        }
    }

    function activateAndSetNextShowDate(histogramBrowser, nextShowDate) {
        try {
            localStorage.setItem('nextHistogramShareMessage', nextShowDate.valueOf().toString());
        } catch (e) {
            // localStorage is not available in IE/Edge when running from a local file.
        }

        activateHistogramView(histogramBrowser);
    }

    function activateHistogramView(histogramBrowser) {
        var element = histogramBrowser.element;
        element.find('.histogram-container').addClass('histogram-activated');
    }

    function onSemesterSelect(histogramBrowser, course, semester, data) {
        var element = histogramBrowser.element;
        var categories = [
            'Exam_A',
            'Final_A',
            'Exam_B',
            'Final_B',
            'Exam_C',
            'Final_C',
            'Finals'
        ];
        var categorySelect = $('<select class="form-control"></select>');

        categories.forEach(function (category) {
            if (!data[category]) {
                return;
            }

            var text = categoryFriendlyName(category);
            text += ': ' + roundGrade(data[category].average);

            categorySelect.append($('<option>', {
                value: category,
                text: text
            }));
        });

        categorySelect.find('option:last').attr('selected', 'selected');

        element.find('.histogram-categories').html(categorySelect);

        categorySelect.on('change', function () {
            onCategorySelect(histogramBrowser, course, semester, this.value, data[this.value]);
        }).trigger('change');

        var staffTable = element.find('.histogram-staff-table');
        if (data.Staff) {
            var staffTableBody = staffTable.find('tbody');
            staffTableBody.html('');

            data.Staff.forEach(function (staffPerson) {
                var row = $('<tr>')
                    .append($('<td>').text(staffPerson.name))
                    .append($('<td>').text(staffPerson.title));
                staffTableBody.append(row);
            });

            staffTable.removeClass('d-none');
        } else {
            staffTable.addClass('d-none');
        }
    }

    function onCategorySelect(histogramBrowser, course, semester, category, data) {
        var element = histogramBrowser.element;

        var newData = jQuery.extend({}, data);
        var passFail = newData.passFail.split('/', 2);
        delete newData.passFail;
        newData.pass = passFail[0];
        newData.fail = passFail[1] || '';

        Object.keys(newData).forEach(function (item) {
            var text = newData[item].trim() || '-';
            element.find('.histogram-data .histogram-value-' + item).text(text);
        });

        var imageUrl = 'https://michael-maltsev.github.io/technion-histograms/' + course + '/' + semester + '/' + category + '.png';
        element.find('.histogram-image-container').html($('<img class="img-fluid histogram-image">').prop('src', imageUrl));
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

    function categoryFriendlyName(category) {
        var histogramCategories = {
            Exam_A: 'מבחן מועד א\'',
            Final_A: 'סופי מועד א\'',
            Exam_B: 'מבחן מועד ב\'',
            Final_B: 'סופי מועד ב\'',
            Exam_C: 'מבחן מועד ג\'',
            Final_C: 'סופי מועד ג\'',
            Finals: 'סופי'
        };

        return histogramCategories[category] || category;
    }

    // https://stackoverflow.com/a/30810322
    function copyToClipboard(text, onSuccess, onFailure) {
        if (!navigator.clipboard) {
            fallbackCopyTextToClipboard(text);
            return;
        }
        // eslint-disable-next-line compat/compat
        navigator.clipboard.writeText(text).then(function () {
            onSuccess();
        }, function (err) {
            onFailure();
        });

        function fallbackCopyTextToClipboard(text) {
            var textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            var successful = false;
            try {
                successful = document.execCommand('copy');
            } catch (err) {
                // We tried...
            }

            document.body.removeChild(textArea);

            if (successful) {
                onSuccess();
            } else {
                onFailure();
            }
        }
    }

    HistogramBrowser.prototype.loadHistograms = function (course) {
        var element = this.element;
        var that = this;

        element.text('טוען נתונים...');

        var onError = function () {
            var fallbackUrl = 'https://michael-maltsev.github.io/technion-histograms/' + course + '/';
            element.html('טעינת הנתונים נכשלה. נסו לגשת למאגר בצורה ידנית ');
            var urlElement = $('<a target="_blank" rel="noopener">כאן</a>').prop('href', fallbackUrl);
            element.append(urlElement);
            element.append('.');
        };

        var url = 'https://michael-maltsev.github.io/technion-histograms/' + course + '/index.min.json';

        var request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.onload = function () {
            var data = null;
            if (this.status === 200) {
                try {
                    data = JSON.parse(this.response);
                } catch (e) {
                    // Invalid response.
                }
            } else if (this.status === 404) {
                data = {};
            }

            if (data) {
                renderHistograms(that, course, data);
            } else {
                onError();
            }
        };
        request.onerror = onError;
        request.send();
    };

    return HistogramBrowser;
})();
