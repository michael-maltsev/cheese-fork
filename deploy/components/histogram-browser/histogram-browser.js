'use strict';

var HistogramBrowser = (function () {
    function HistogramBrowser(element) {
        this.element = element;
    }

    function renderHistograms(histogramBrowser, course, data) {
        var element = histogramBrowser.element;
        var semesters = Object.keys(data);
        if (semesters.length > 0) {
            var semesterSelect = $('<select class="form-control">');

            semesters.forEach(function (semester, i) {
                var text = semesterFriendlyName(semester);
                var props = [];

                var moedA = data[semester].Final_A || data[semester].Exam_A;
                if (moedA && moedA.average) {
                    props.push('א\': ' + moedA.average);
                }

                var moedB = data[semester].Final_B || data[semester].Exam_B;
                if (moedB && moedB.average) {
                    props.push('ב\': ' + moedB.average);
                }

                var final = data[semester].Finals;
                if (final && final.average) {
                    props.push('סופי: ' + final.average);
                }

                if (props.length > 0) {
                    text += ', ' + props.join(', ');
                }

                semesterSelect.append($('<option>', {
                    value: semester,
                    text: text,
                    selected: i === semesters.length - 1
                }));
            });

            var html = '<div>' +
                    '<div class="form-row">' +
                        '<div class="form-group col-lg-6 histogram-semesters"></div>' +
                        '<div class="form-group col-lg-6 histogram-categories"></div>' +
                    '</div>' +
                    '<div class="histogram-data table-responsive">' +
                        '<table class="table table-bordered table-sm">' +
                            '<thead class="thead-light">' +
                                '<tr>' +
                                    '<th scope="col">סטודנטים</th>' +
                                    '<th scope="col">עברו/נכשלו</th>' +
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
                                    '<td class="histogram-value-passFail"></td>' +
                                    '<td class="histogram-value-passPercent"></td>' +
                                    '<td class="histogram-value-min"></td>' +
                                    '<td class="histogram-value-max"></td>' +
                                    '<td class="histogram-value-average"></td>' +
                                    '<td class="histogram-value-median"></td>' +
                                '</tr>' +
                            '</tbody>' +
                        '</table>' +
                    '</div>' +
                    '<div class="histogram-image-container"></div>' +
                '</div>';

            element.html(html).find('.histogram-semesters').html(semesterSelect);

            semesterSelect.on('change', function () {
                onSemesterSelect(histogramBrowser, course, this.value, data[this.value]);
            }).trigger('change');
        } else {
            element.text('לא קיימות היסטוגרמות לקורס זה.');
        }
    }

    function onSemesterSelect(histogramBrowser, course, semester, data) {
        var element = histogramBrowser.element;
        var categories = Object.keys(data);
        var categorySelect = $('<select class="form-control">');

        categories.forEach(function (category, i) {
            var text = categoryFriendlyName(category);
            text += ': ' + data[category].average;

            categorySelect.append($('<option>', {
                value: category,
                text: text,
                selected: i === categories.length - 1
            }));
        });

        element.find('.histogram-categories').html(categorySelect);

        categorySelect.on('change', function () {
            onCategorySelect(histogramBrowser, course, semester, this.value, data[this.value]);
        }).trigger('change');
    }

    function onCategorySelect(histogramBrowser, course, semester, category, data) {
        var element = histogramBrowser.element;

        Object.keys(data).forEach(function (item) {
            element.find('.histogram-data .histogram-value-' + item).text(data[item]);
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
            Finals: 'סופי'
        };

        return histogramCategories[category] || category;
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

        var url = 'https://michael-maltsev.github.io/technion-histograms/' + course + '/index.json';

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
