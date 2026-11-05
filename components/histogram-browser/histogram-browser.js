'use strict';

/* global BootstrapDialog, CheeseI18n, gtag */

// eslint-disable-next-line no-unused-vars
var HistogramBrowser = (function () {
    function HistogramBrowser(element, options) {
        this.element = element;
        this.selectColumnGrid = options.selectColumnGrid;
        this.shareGuideInNewWindow = options.shareGuideInNewWindow;
    }

    function t(key, params) {
        return CheeseI18n.t(key, params);
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function h(key, params) {
        return escapeHtml(t(key, params));
    }

    function roundGrade(strGrade) {
        return strGrade.trim().replace(/\.\d+$/, '') || '--';
    }

    function renderHistograms(histogramBrowser, course, data) {
        var element = histogramBrowser.element;
        var semesters = Object.keys(data);
        if (semesters.length > 0) {
            var semesterSelect = $('<select class="form-control"></select>').attr('aria-label', t('histogram.semester'));

            semesters.sort(function (a, b) {
                return b.localeCompare(a, undefined, {numeric: true});
            }).forEach(function (semester, i) {
                var text = semesterFriendlyName(semester);
                var props = [];

                var termA = data[semester].Final_A || data[semester].Exam_A;
                if (termA) {
                    props.push(t('histogram.summary.a', {grade: roundGrade(termA.average)}));
                }

                var termB = data[semester].Final_B || data[semester].Exam_B;
                if (termB) {
                    props.push(t('histogram.summary.b', {grade: roundGrade(termB.average)}));
                }

                var final = data[semester].Finals;
                if (final) {
                    props.push(t('histogram.summary.final', {grade: roundGrade(final.average)}));
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
                    text += '\xA0'.repeat(Math.max(2, 16 - text.length));
                    text += props.join('\xA0\xA0');
                }

                semesterSelect.append($('<option>', {
                    value: semester,
                    text: text,
                    selected: i === 0
                }));
            });

            var activated = shouldActivateHistogramView();
            var selectColumnGrid = histogramBrowser.selectColumnGrid || 'lg';
            var html = '<div class="histogram-container' + (activated ? ' histogram-activated' : '') + '">' +
                    '<div class="histogram-overlay-message">' +
                        '<div class="alert alert-primary" role="alert">' +
                            h('histogram.shareRequired') +
                        '</div>' +
                        '<div class="histogram-overlay-message-button-container">' +
                            '<button type="button" class="btn btn-primary histogram-button-share">' + h('histogram.share') + '</button>' +
                        '</div>' +
                        '<div class="histogram-overlay-message-button-container">' +
                            '<button type="button" class="btn histogram-button-activate">' + h('histogram.alreadyShared') + '</button>' +
                        '</div>' +
                        '<div class="histogram-overlay-message-button-container">' +
                            '<button type="button" class="btn histogram-button-snooze">' + h('histogram.shareLater') + '</button>' +
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
                                        '<th scope="col">' + h('histogram.students') + '</th>' +
                                        '<th scope="col">' + h('histogram.passed') + '</th>' +
                                        '<th scope="col">' + h('histogram.failed') + '</th>' +
                                        '<th scope="col">' + h('histogram.passPercent') + '</th>' +
                                        '<th scope="col">' + h('histogram.minimum') + '</th>' +
                                        '<th scope="col">' + h('histogram.maximum') + '</th>' +
                                        '<th scope="col">' + h('histogram.average') + '</th>' +
                                        '<th scope="col">' + h('histogram.median') + '</th>' +
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
                        '<p class="histogram-image-note small text-muted"></p>' +
                        '<div class="histogram-staff-table row mt-3 d-none">' +
                            '<div class="col-' + selectColumnGrid + '-6">' +
                                '<table class="table table-bordered table-sm">' +
                                    '<thead class="thead-light">' +
                                        '<tr>' +
                                            '<th scope="col">' + h('histogram.staffMember') + '</th>' +
                                            '<th scope="col">' + h('histogram.staffRole') + '</th>' +
                                        '</tr>' +
                                    '</thead>' +
                                    '<tbody>' +
                                    '</tbody>' +
                                '</table>' +
                            '</div>' +
                        '</div>' +
                        '<div>' +
                            '<a href="' + escapeHtml(CheeseI18n.withLocale('share-histograms.html')) + '" target="_blank" class="small">' + h('histogram.share') + '</a>' +
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
            var noDataHtml = '<div>' + h('histogram.empty') + '</div>' +
                '<div>' +
                    '<a href="' + escapeHtml(CheeseI18n.withLocale('share-histograms.html')) + '" target="_blank" class="small">' + h('histogram.share') + '</a>' +
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

    function createShareGuide() {
        var guide = $('<div class="histogram-modal-guide-content">' +
            '<div class="form-group language-selector d-inline-flex">' +
                '<i class="fas fa-globe" aria-hidden="true"></i>' +
                '<label for="histogram-guide-language" class="sr-only">' + h('sharing.language') + '</label>' +
                '<select id="histogram-guide-language" class="language-switch" data-language-switch aria-label="' + h('sharing.language') + '">' +
                    '<option value="en" lang="en">English</option><option value="he" lang="he">עברית</option>' +
                '</select>' +
            '</div>' +
            '<p>' + h('sharing.guide.intro') + '</p>' +
            '<p>' + h('sharing.guide.scriptIntro') + ' <a href="' + escapeHtml(CheeseI18n.withLocale('share-histograms.js')) + '" target="_blank" rel="noopener">' + h('sharing.here') + '</a>.</p>' +
            '<p>' + h('sharing.guide.repositoryIntro') + ' <a href="https://github.com/michael-maltsev/technion-histograms" target="_blank" rel="noopener">' + h('sharing.here') + '</a>.</p>' +
            '<p>' + h('sharing.guide.privacy') + '</p>' +
            '<p>' + h('sharing.guide.mobile') + '</p>' +
            '<h3>' + h('sharing.guide.extensionTitle') + ' <a href="https://chromewebstore.google.com/detail/technion-plus-plus/pfhjnidbfndnjhpcpfecngcigdjebemk" target="_blank" rel="noopener">Technion Plus Plus</a></h3>' +
            '<ol>' +
                '<li class="mb-0">' + h('sharing.guide.open') + ' <a href="https://grades.technion.ac.il/" target="_blank" rel="noopener">' + h('sharing.guide.gradesSite') + '</a> ' + h('sharing.guide.signIn') + '</li>' +
                '<li class="mb-0">' + h('sharing.guide.click') + ' <a href="assets/share-histograms-guide-technionplus-1.png" target="_blank" rel="noopener">' + h('sharing.guide.extensionButton') + '</a>.</li>' +
                '<li>' + h('sharing.guide.skipToFour') + '</li>' +
            '</ol>' +
            '<h3>' + h('sharing.guide.manualTitle') + '</h3>' +
            '<ol>' +
                '<li>' + h('sharing.guide.copyCode') +
                    '<div class="form-row mt-2"><div class="form-group mb-0 col-md-12">' +
                        '<textarea dir="ltr" class="form-control" id="javascript-code-container" aria-label="' + h('sharing.guide.codeLabel') + '" rows="4" onfocus="this.select();" onmouseup="return false;" readonly></textarea>' +
                        '<button type="button" class="btn btn-primary mt-2" id="javascript-code-copy-button">' + h('sharing.guide.copy') + '</button>' +
                    '</div></div>' +
                '</li>' +
                '<li>' + h('sharing.guide.visitGrades') +
                    '<div class="form-group"><a class="btn btn-primary mt-2" href="https://grades.technion.ac.il/" role="button" target="_blank" rel="noopener">' + h('sharing.guide.openGrades') + '</a></div>' +
                '</li>' +
                '<li>' +
                    '<p><strong>' + h('sharing.guide.chrome') + '</strong> ' + h('sharing.guide.chromeInstructions') + '<br>' +
                        '<img class="border border-primary mt-2 img-fluid d-none d-sm-block" src="assets/share-histograms-guide-1.png" alt="' + h('sharing.guide.pasteImageAlt') + '">' +
                        '<img class="border border-primary mt-2 img-fluid d-block d-sm-none" src="assets/share-histograms-guide-mobile-1.png" alt="' + h('sharing.guide.pasteImageAlt') + '">' +
                    '</p>' +
                    '<p><strong>' + h('sharing.guide.otherBrowsers') + '</strong> ' + h('sharing.guide.otherBrowserInstructions') + '</p>' +
                '</li>' +
                '<li><p>' + h('sharing.guide.waitForData') + '<br>' +
                    '<strong>' + h('sharing.guide.important') + '</strong> ' + h('sharing.guide.avoidBrowsing') + '<br>' +
                    '<img class="border border-primary mt-2 img-fluid d-none d-sm-block" src="assets/share-histograms-guide-2.png" alt="' + h('sharing.guide.shareImageAlt') + '">' +
                    '<img class="border border-primary mt-2 img-fluid d-block d-sm-none" src="assets/share-histograms-guide-mobile-2.png" alt="' + h('sharing.guide.shareImageAlt') + '">' +
                '</p></li>' +
                '<li>' + h('sharing.guide.waitForCompletion') + '</li>' +
            '</ol>' +
        '</div>');
        var scriptLink = document.createElement('a');
        scriptLink.href = CheeseI18n.withLocale('share-histograms.js');
        var code = 'avascript:var url=' + JSON.stringify(scriptLink.href) + ';var script=document.createElement(\'script\');script.src=url;document.head.appendChild(script);';
        guide.find('#javascript-code-container').val(code);
        guide.find('#javascript-code-copy-button').click(function () {
            var button = $(this);
            copyToClipboard(code, function () {
                var text = button.text();
                button.text(text + ' ✓').prop('disabled', true);
                setTimeout(function () {
                    button.text(text).prop('disabled', false);
                }, 500);
            }, function () {
                alert(t('sharing.copyFailed'));
            });
        });
        CheeseI18n.apply(guide[0]);
        return guide;
    }

    function onButtonShare(histogramBrowser) {
        gtag('event', 'histogram-button-share');

        if (histogramBrowser.shareGuideInNewWindow) {
            popupWindow(CheeseI18n.withLocale('share-histograms.html'), 'share-histograms.html', window, 800, 600);
            return;
        }

        BootstrapDialog.show({
            title: t('histogram.share'),
            message: createShareGuide(),
            buttons: [{
                label: t('histogram.shared'),
                cssClass: 'btn-primary',
                action: function (dialog) {
                    gtag('event', 'histogram-share-submit');

                    var nextShowDate = new Date();
                    nextShowDate.setDate(nextShowDate.getDate() + 30 * 4);
                    activateAndSetNextShowDate(histogramBrowser, nextShowDate);

                    dialog.close();
                }
            }, {
                label: t('histogram.close'),
                action: function (dialog) {
                    dialog.close();
                }
            }]
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
        var categorySelect = $('<select class="form-control"></select>').attr('aria-label', t('histogram.category'));

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
                    .append($('<td>').text(staffTitleFriendlyName(staffPerson.title)));
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
        element.find('.histogram-image-container').html($('<img class="img-fluid histogram-image">')
            .prop('src', imageUrl)
            .attr('alt', t('histogram.imageAlt', {
                course: course,
                semester: semesterFriendlyName(semester),
                category: categoryFriendlyName(category)
            })));
        element.find('.histogram-image-note').text(t('histogram.imageNote'));
    }

    function semesterFriendlyName(semester) {
        var year = parseInt(semester.slice(0, 4), 10);
        var semesterCode = semester.slice(4);

        switch (semesterCode) {
        case '01':
            return t('histogram.semester.winter', {year: year, nextYear: year + 1});

        case '02':
            return t('histogram.semester.spring', {year: year + 1});

        case '03':
            return t('histogram.semester.summer', {year: year + 1});

        default:
            return semester;
        }
    }

    function categoryFriendlyName(category) {
        var histogramCategories = {
            Exam_A: 'histogram.category.examA',
            Final_A: 'histogram.category.finalA',
            Exam_B: 'histogram.category.examB',
            Final_B: 'histogram.category.finalB',
            Exam_C: 'histogram.category.examC',
            Final_C: 'histogram.category.finalC',
            Finals: 'histogram.category.finals'
        };

        return histogramCategories[category] ? t(histogramCategories[category]) : category;
    }

    function staffTitleFriendlyName(title) {
        var titles = {
            'מרצה - אחראי מקצוע': 'histogram.staff.courseCoordinator',
            'מרצה': 'histogram.staff.lecturer',
            'מתרגל': 'histogram.staff.teachingAssistant',
            'מתרגלת': 'histogram.staff.teachingAssistant',
            'מתרגל - אחראי תרגול': 'histogram.staff.teachingCoordinator'
        };
        return titles[title] ? t(titles[title]) : title;
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

        element.text(t('histogram.loading'));

        var onError = function () {
            var fallbackUrl = 'https://michael-maltsev.github.io/technion-histograms/' + course + '/';
            element.text(t('histogram.loadFailed') + ' ');
            var urlElement = $('<a target="_blank" rel="noopener"></a>').prop('href', fallbackUrl).text(t('histogram.here'));
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

    HistogramBrowser.createShareGuide = createShareGuide;

    return HistogramBrowser;
})();
