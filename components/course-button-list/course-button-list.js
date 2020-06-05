'use strict';

/* global HistogramBrowser, BootstrapDialog, gtag, DISQUS */

function CourseButtonList(element, options) {
    this.element = element;
    this.courseManager = options.courseManager;
    this.colorGenerator = options.colorGenerator;
    this.readonly = options.readonly;
    this.onHoverIn = options.onHoverIn;
    this.onHoverOut = options.onHoverOut;
    this.onEnableCourse = options.onEnableCourse;
    this.onDisableCourse = options.onDisableCourse;

    try {
        this.disqusReadCounters = JSON.parse(localStorage.getItem('disqusReadCounters') || '{}');
    } catch (e) {
        // localStorage is not available in IE/Edge when running from a local file.
        this.disqusReadCounters = {};
    }
}

CourseButtonList.prototype.addCourse = function (course) {
    var that = this;

    var courseTitle = that.courseManager.getTitle(course);

    // A wrapper div for proper word wrapping of the content text.
    var spanAbsolute = $('<div class="content-wrapper"></div>').html($('<span class="content-absolute"></span>').text(courseTitle));
    var spanBoldHidden = $('<span class="content-bold-hidden"></span>').text(courseTitle);

    var button = $('<li' +
        ' class="list-group-item active course-button-list-item"' +
        ' data-course-number="' + course + '">' +
        '</li>');
    var badge = $('<span class="badge badge-pill badge-secondary float-right course-button-list-unread-count-badge-container">' +
        '<span class="course-button-list-unread-count-badge d-none"></span>i' +
        '</span>');
    var color = that.colorGenerator(course);
    //var rgbaColor = 'rgba(' + parseInt(color.slice(-6, -4), 16)
    //    + ',' + parseInt(color.slice(-4, -2), 16)
    //    + ',' + parseInt(color.slice(-2), 16)
    //    + ',0.75)';
    button.css('background-color', color)
        .click(function () {
            if (!that.readonly) {
                onCourseButtonClick($(this), course);
            }
        })
        .hover(function () {
                $(this).addClass('course-button-list-item-hovered');
                that.onHoverIn(course);
            },
            function () {
                $(this).removeClass('course-button-list-item-hovered');
                that.onHoverOut(course);
            })
        .append(spanAbsolute, spanBoldHidden, badge);

    // Add tooltip to badge.
    var courseDescriptionHtml = that.courseManager.getDescription(course, {html: true});
    var courseDescriptionHtmlWithLinks = that.courseManager.getDescription(course, {html: true, links: true, logging: true});
    badge.hover(
        function () {
            $(this).removeClass('badge-secondary');
            $(this).addClass('badge-primary');
        }, function () {
            $(this).removeClass('badge-primary');
            $(this).addClass('badge-secondary');
        }
    ).click(function (e) {
        e.stopPropagation(); // don't execute parent button onclick

        gtag('event', 'course-button-list-info-click');

        that.disqusMarkCourseAsRead(course);

        $(this).tooltip('hide');
        BootstrapDialog.show({
            title: courseTitle,
            size: BootstrapDialog.SIZE_WIDE,
            message: $('<div>').html(courseDescriptionHtmlWithLinks + '<br><br>' +
                '<p class="text-center font-weight-bold h6">היסטוגרמות</p><div class="inline-histograms"></div><br>' +
                '<div id="disqus_thread"></div>'
            ),
            onshow: function (dialog) {
                var histogramBrowser = new HistogramBrowser(dialog.getModalBody().find('.inline-histograms'), {});
                histogramBrowser.loadHistograms(course);
            },
            onshown: function (dialog) {
                var disqusConfig = function () {
                    this.page.url = location.protocol + '//' + location.hostname + (location.port ? ':' + location.port : '') + location.pathname + '#!' + 'course_comments_' + course;
                    this.page.identifier = 'course_comments_' + course;
                };
                if (typeof DISQUS === 'undefined') {
                    window.disqus_config = disqusConfig;
                    var d = document, s = d.createElement('script');
                    s.src = 'https://cheesefork.disqus.com/embed.js';
                    s.setAttribute('data-timestamp', +new Date());
                    (d.head || d.body).appendChild(s);
                } else {
                    DISQUS.reset({
                        reload: true,
                        config: disqusConfig
                    });
                }
            }
        });
    });

    function setRegularTooltip(tip) {
        badge.prop('title', courseDescriptionHtml)
            .attr('data-toggle', 'tooltip')
            .tooltip({
                html: true,
                placement: 'right',
                template: '<div class="tooltip" role="tooltip"><div class="arrow arrow-fix-placement"></div><div class="tooltip-inner course-description-tooltip-inner"></div></div>',
                trigger: 'hover'
            }).on('hidden.bs.tooltip', function () {
                tip !== true && tip.tooltip('hide');
            });
    }

    try {
        window.course_button_list_promo_shown = window.course_button_list_promo_shown || !!localStorage.getItem('dontShowHistogramsTip');
    } catch (e) {
        // localStorage is not available in IE/Edge when running from a local file.
    }

    if (window.course_button_list_promo_shown) {
        setRegularTooltip(window.course_button_list_promo_shown);
    } else {
        badge.prop('title', 'חדש, היסטוגרמות!<br>לחצו כאן')
            .attr('data-toggle', 'tooltip')
            .tooltip({
                container: '.container-fluid',
                html: true,
                placement: 'right',
                template: '<div class="tooltip" role="tooltip"><div class="arrow arrow-fix-placement"></div><div class="tooltip-inner"></div></div>',
                trigger: 'manual'
            }).on('hidden.bs.tooltip', function () {
                badge.tooltip('dispose');
                setRegularTooltip(true);
                window.course_button_list_promo_shown = true;
                try {
                    localStorage.setItem('dontShowHistogramsTip', Date.now().toString());
                } catch (e) {
                    // localStorage is not available in IE/Edge when running from a local file.
                }
            });
    }
    that.element.append(button);

    if (!window.course_button_list_promo_shown) {
        badge.tooltip('show');
        window.course_button_list_promo_shown = badge;
    }

    function onCourseButtonClick(button, course) {
        if (button.hasClass('active')) {
            button.removeClass('active').removeClass('course-button-list-item-conflicted');
            button.css('background-color', '');
            that.onDisableCourse(course);
        } else {
            button.addClass('active');
            var color = that.colorGenerator(course);
            //var rgbaColor = 'rgba(' + parseInt(color.slice(-6, -4), 16)
            //    + ',' + parseInt(color.slice(-4, -2), 16)
            //    + ',' + parseInt(color.slice(-2), 16)
            //    + ',0.75)';
            button.css('background-color', color);
            that.onEnableCourse(course);
        }
    }
};

CourseButtonList.prototype.updateDisqusUnreadCounters = function () {
    var that = this;

    var courseNumbers = that.getCourseNumbers(false);
    if (courseNumbers.length === 0) {
        return;
    }

    var disqusScriptUrlParams = courseNumbers.map(function (course) {
        return '1=course_comments_' + course;
    });
    var disqusScriptUrl = 'https://cheesefork.disqus.com/count-data.js?' + disqusScriptUrlParams.join('&');

    window.DISQUSWIDGETS = {
        displayCount: function (data) {
            var counts = (data && data.counts) || [];
            counts.forEach(function (countItem) {
                var match = /^course_comments_(\d+)$/.exec(countItem.id);
                if (!match) {
                    return;
                }

                var course = match[1];

                var count = countItem.comments - (that.disqusReadCounters[course] || 0);
                if (count <= 0) {
                    return;
                }

                var selector = 'li.list-group-item[data-course-number="' + course + '"] .course-button-list-unread-count-badge';
                that.element.find(selector).text(count).removeClass('d-none');
            });
        }
    };

    $.getScript(disqusScriptUrl);
};

CourseButtonList.prototype.disqusMarkCourseAsRead = function (course) {
    var that = this;

    var selector = 'li.list-group-item[data-course-number="' + course + '"] .course-button-list-unread-count-badge';
    var countBadge = that.element.find(selector);
    if (countBadge.hasClass('d-none')) {
        return;
    }

    countBadge.addClass('d-none');
    var count = parseInt(countBadge.text(), 10);

    this.disqusReadCounters[course] = (this.disqusReadCounters[course] || 0) + count;
    localStorage.setItem('disqusReadCounters', JSON.stringify(this.disqusReadCounters));
};

CourseButtonList.prototype.setHovered = function (course) {
    var selector = 'li.list-group-item[data-course-number="' + course + '"]';
    this.element.find(selector).addClass('course-button-list-item-hovered');
};

CourseButtonList.prototype.removeHovered = function (course) {
    var selector = 'li.list-group-item[data-course-number="' + course + '"]';
    this.element.find(selector).removeClass('course-button-list-item-hovered');
};

CourseButtonList.prototype.setConflicted = function (course) {
    var selector = 'li.list-group-item[data-course-number="' + course + '"]';
    this.element.find(selector).addClass('course-button-list-item-conflicted');
};

CourseButtonList.prototype.removeConflicted = function (course) {
    var selector = 'li.list-group-item[data-course-number="' + course + '"]';
    this.element.find(selector).removeClass('course-button-list-item-conflicted');
};

CourseButtonList.prototype.isCourseInList = function (course) {
    var selector = 'li.list-group-item[data-course-number="' + course + '"]';
    return this.element.find(selector).length > 0;
};

CourseButtonList.prototype.getCourseNumbers = function (onlySelected) {
    var that = this;

    var selector = 'li.list-group-item';
    if (onlySelected) {
        selector += '.active';
    }

    var courseNumbers = [];
    that.element.find(selector).each(function () {
        var course = $(this).attr('data-course-number');
        courseNumbers.push(course);
    });

    return courseNumbers;
};

CourseButtonList.prototype.clear = function () {
    if (window.course_button_list_promo_shown) {
        var tip = window.course_button_list_promo_shown;
        tip !== true && tip.tooltip('hide');
        try {
            localStorage.setItem('dontShowHistogramsTip', Date.now().toString());
        } catch (e) {
            // localStorage is not available in IE/Edge when running from a local file.
        }
        window.course_button_list_promo_shown = true;
    }
    this.element.empty();
};
