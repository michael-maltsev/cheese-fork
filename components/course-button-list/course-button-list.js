'use strict';

/* global HistogramBrowser, CourseFeedback, BootstrapDialog, showBootstrapDialogWithModelessButton, firebase, gtag, currentSemester */

// eslint-disable-next-line no-unused-vars
var CourseButtonList = (function () {
    function CourseButtonList(element, options) {
        this.element = element;
        this.courseManager = options.courseManager;
        this.colorGenerator = options.colorGenerator;
        this.readonly = options.readonly;
        this.onHoverIn = options.onHoverIn;
        this.onHoverOut = options.onHoverOut;
        this.onEnableCourse = options.onEnableCourse;
        this.onDisableCourse = options.onDisableCourse;
        this.onReorder = options.onReorder;
        this.onCourseMove = options.onCourseMove;
        this.onLayerCreate = options.onLayerCreate;
        this.onLayerRename = options.onLayerRename;
        this.onLayerDelete = options.onLayerDelete;
        this.onLayerVisibilityChange = options.onLayerVisibilityChange;

        var that = this;

        that.sortableInitialized = false;

        // Layers are optional. Without layers (the default), there's only the first
        // list, badgeContainer, which belongs to the first layer with an empty id.
        that.layers = [];
        that.activeLayerId = '';

        if (that.readonly) {
            that.element.addClass('course-button-list-readonly');
        }

        // Create a wrapper container inside the element for the badges
        that.badgeContainer = $('<ul class="course-button-list-badge-container list-group"></ul>');
        that.element.append(that.badgeContainer);

        // Create drop areas, shown while dragging: drag-to-delete, and
        // drag to move the course to a new layer (only if not readonly)
        if (!that.readonly) {
            that.deleteArea = $('<div class="course-button-list-delete-area">' +
                '<i class="fas fa-trash-alt"></i>' +
                '</div>');
            that.newLayerArea = $('<div class="course-button-list-new-layer-area" title="העברה לשכבה חדשה">' +
                '<i class="fas fa-layer-group"></i>' +
                '</div>');
            that.dropAreas = $('<div class="course-button-list-drop-areas"></div>')
                .append(that.newLayerArea, that.deleteArea);
            that.dropAreas.hide();
            that.element.append(that.dropAreas);
        }

        that.infoDialogs = [];
    }

    function getAllLists(that) {
        return that.element.find('ul.course-button-list-badge-container');
    }

    function getLayerList(that, layerId) {
        if (!layerId) {
            return that.badgeContainer;
        }

        return getAllLists(that).filter('[data-layer-id="' + layerId + '"]');
    }

    function getListLayerId(list) {
        return list.attr('data-layer-id') || '';
    }

    // If layerId is undefined, returns the items of the course in all layers.
    function findCourseItems(that, course, layerId) {
        var lists = layerId === undefined ? getAllLists(that) : getLayerList(that, layerId);
        return lists.find('li.list-group-item[data-course-number="' + course + '"]');
    }

    function makeLayerHeader(that, layer) {
        var header = $('<div class="course-button-list-layer-header"></div>').attr('data-layer-id', layer.id);

        var visibility = $('<span class="course-button-list-layer-visibility"><i class="far"></i></span>');
        visibility.find('i').addClass(layer.hidden ? 'fa-square' : 'fa-check-square');

        var name = $('<span class="course-button-list-layer-name"></span>').text(layer.name);

        header.append(visibility, name);

        if (that.readonly) {
            return header;
        }

        var menu = $('<span class="dropdown course-button-list-layer-menu">' +
            '<span class="course-button-list-layer-menu-button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">' +
            '<i class="fas fa-ellipsis-v"></i></span>' +
            '<div class="dropdown-menu dropdown-menu-right text-right">' +
            '<a class="dropdown-item course-button-list-layer-rename" href="#">שינוי שם</a>' +
            '<a class="dropdown-item course-button-list-layer-add" href="#">שכבה חדשה</a>' +
            '<a class="dropdown-item course-button-list-layer-delete" href="#">מחיקה</a>' +
            '</div></span>');

        header.append(menu);

        header.click(function (e) {
            // Clicking on the header selects the layer for adding new
            // courses and events, unless one of the controls was clicked.
            if ($(e.target).closest('.course-button-list-layer-visibility, .course-button-list-layer-menu').length === 0) {
                that.setActiveLayer(layer.id);
            }
        });

        visibility.attr('title', 'הצגה/הסתרה של השכבה').click(function () {
            that.onLayerVisibilityChange(layer.id, !layer.hidden);
        });

        menu.find('.course-button-list-layer-rename').click(function (e) {
            e.preventDefault();
            showLayerRenameDialog(that, layer);
        });

        menu.find('.course-button-list-layer-add').click(function (e) {
            e.preventDefault();
            that.onLayerCreate(null, null);
        });

        menu.find('.course-button-list-layer-delete').click(function (e) {
            e.preventDefault();
            showLayerDeleteDialog(that, layer);
        });

        return header;
    }

    function showLayerRenameDialog(that, layer) {
        var input = $('<input type="text" class="form-control" maxlength="20">').val(layer.name);

        var rename = function (dialog) {
            dialog.close();

            var name = input.val().trim();
            if (name !== '' && name !== layer.name) {
                that.onLayerRename(layer.id, name);
            }
        };

        BootstrapDialog.show({
            title: 'שינוי שם השכבה',
            message: input,
            onshown: function (dialog) {
                input.focus().select().keydown(function (e) {
                    if (e.key === 'Enter') {
                        rename(dialog);
                    }
                });
            },
            buttons: [{
                label: 'שמור',
                cssClass: 'btn-primary',
                action: rename
            }, {
                label: 'סגור',
                action: function (dialog) {
                    dialog.close();
                }
            }]
        });
    }

    function showLayerDeleteDialog(that, layer) {
        var message = $('<div>').text('הפעולה תמחק את השכבה "' + layer.name + '" יחד עם הקורסים והאירועים שבה.');

        BootstrapDialog.show({
            title: 'מחיקת שכבה',
            message: message,
            buttons: [{
                label: 'מחק',
                cssClass: 'btn-danger',
                action: function (dialog) {
                    dialog.close();
                    that.onLayerDelete(layer.id);
                }
            }, {
                label: 'סגור',
                action: function (dialog) {
                    dialog.close();
                }
            }]
        });
    }

    function removeLayers(that) {
        that.element.find('.course-button-list-layer-header').remove();
        getAllLists(that).not(that.badgeContainer).remove();
        that.badgeContainer.removeClass('course-button-list-layer-hidden course-button-list-layer-active');
        that.element.removeClass('course-button-list-with-layers');
        that.layers = [];
    }

    // Sets the layers to show, an array of { id, name, hidden } with the first layer (which
    // has an empty id) first, or an empty array for no layers. Call it for an empty list,
    // before adding the courses.
    CourseButtonList.prototype.setLayers = function (layers) {
        var that = this;

        that.destroySortable();
        removeLayers(that);

        that.layers = layers;

        if (!layers.some(function (layer) { return layer.id === that.activeLayerId; })) {
            that.activeLayerId = '';
        }

        if (layers.length === 0) {
            return;
        }

        that.element.addClass('course-button-list-with-layers');

        layers.forEach(function (layer) {
            var list = that.badgeContainer;
            if (layer.id) {
                list = $('<ul class="course-button-list-badge-container list-group"></ul>').attr('data-layer-id', layer.id);
                if (that.dropAreas) {
                    list.insertBefore(that.dropAreas);
                } else {
                    that.element.append(list);
                }
            }

            list.toggleClass('course-button-list-layer-hidden', !!layer.hidden);
            makeLayerHeader(that, layer).insertBefore(list);
        });

        that.setActiveLayer(that.activeLayerId);

        // Empty layers should be able to receive courses.
        that.initializeSortableIfNeeded();
    };

    // The active layer is the layer to which new courses and custom events are added.
    CourseButtonList.prototype.getActiveLayerId = function () {
        return this.activeLayerId;
    };

    CourseButtonList.prototype.setActiveLayer = function (layerId) {
        var that = this;

        that.activeLayerId = layerId;

        if (!that.readonly) {
            that.element.find('.course-button-list-layer-header').each(function () {
                $(this).toggleClass('course-button-list-layer-active', $(this).attr('data-layer-id') === layerId);
            });
        }
    };

    function makeWhatsappGroupLinkContent(data) {
        var result = $('<div>');

        var linksFound = 0;

        var whatsappLinks = [];
        var whatsappLinkKeys = [
            'whatsappGroupLink',
            'whatsappGroupLink2',
            'whatsappGroupLink3'
        ];

        whatsappLinkKeys.forEach(function (whatsappLinkKey) {
            var url = data[whatsappLinkKey];
            if (url && url.match(/^https:\/\/chat\.whatsapp\.com\//)) {
                whatsappLinks.push(url);
                linksFound++;
            }
        });

        whatsappLinks.forEach(function (url, i) {
            var linkText = 'קבוצת וואטסאפ';
            if (i > 0) {
                linkText += ' ' + (i + 1);
            }

            result.append($('<div>', {
                html: $('<a>', {
                    href: url,
                    target: '_blank',
                    rel: 'noopener',
                    onclick: 'gtag(\'event\', \'info-click-group-link-whatsapp\')',
                    text: linkText
                })
            }));
        });

        var url = data.telegramGroupLink;
        if (url && url.match(/^https:\/\/t\.me\/.+/)) {
            linksFound++;
            result.append($('<div>', {
                html: $('<a>', {
                    href: url,
                    target: '_blank',
                    rel: 'noopener',
                    onclick: 'gtag(\'event\', \'info-click-group-link-telegram\')',
                    text: 'קבוצת טלגרם'
                })
            }));
        }

        url = data.discordServerLink;
        if (url && url.match(/^https:\/\/(discord\.gg|discord\.com\/invite)\/.+/)) {
            linksFound++;
            result.append($('<div>', {
                html: $('<a>', {
                    href: url,
                    target: '_blank',
                    rel: 'noopener',
                    onclick: 'gtag(\'event\', \'info-click-group-link-discord\')',
                    text: 'שרת דיסקורד'
                })
            }));
        }

        if (linksFound > 1) {
            result.prepend('<div>באפשרותכם להצטרף לקבוצות בעזרת הלינקים הבאים:</div>');
        } else if (linksFound > 0) {
            result.prepend('<div>באפשרותכם להצטרף לקבוצה בעזרת הלינק הבא:</div>');
        } else {
            result.text('לא קיימים קישורי הצטרפות לקבוצת וואטסאפ/טלגרם/דיסקורד עבור קורס זה. אם יש ברשותכם קישור עדכני, אנא לחצו על כפתור העדכון והזינו אותו.');
        }

        return result;
    }

    function makeWhatsappGroupLinkForm(data) {
        var result = $('<form>', {
            html: [
                $('<input>', {
                    type: 'text',
                    value: data.whatsappGroupLink || '',
                    class: 'form-control mt-2 whatsapp-group-link',
                    placeholder: 'https://chat.whatsapp.com/...',
                    style: 'direction: ltr;',
                    pattern: 'https://chat\\.whatsapp\\.com/.+'
                }),
                $('<input>', {
                    type: 'text',
                    value: data.whatsappGroupLink2 || '',
                    class: 'form-control mt-2 whatsapp-group-link2',
                    placeholder: 'https://chat.whatsapp.com/...',
                    style: 'direction: ltr;',
                    pattern: 'https://chat\\.whatsapp\\.com/.+'
                }),
                $('<input>', {
                    type: 'text',
                    value: data.whatsappGroupLink3 || '',
                    class: 'form-control mt-2 whatsapp-group-link3',
                    placeholder: 'https://chat.whatsapp.com/...',
                    style: 'direction: ltr;',
                    pattern: 'https://chat\\.whatsapp\\.com/.+'
                }),
                $('<input>', {
                    type: 'text',
                    value: data.telegramGroupLink || '',
                    class: 'form-control mt-2 telegram-group-link',
                    placeholder: 'https://t.me/...',
                    style: 'direction: ltr;',
                    pattern: 'https://t\\.me/.+'
                }),
                $('<input>', {
                    type: 'text',
                    value: data.discordServerLink || '',
                    class: 'form-control mt-2 discord-server-link',
                    placeholder: 'https://discord.gg/...',
                    style: 'direction: ltr;',
                    pattern: 'https://(discord\\.gg|discord\\.com/invite)/.+'
                }),
                '<div class="invalid-feedback">' +
                    '<div>קישורים לקבוצות וואטסאפ חייבים להיות מהצורה: <span style="direction: ltr; unicode-bidi: embed;">https://chat.whatsapp.com/...</span></div>' +
                    '<div>קישורים לקבוצות טלגרם חייבים להיות מהצורה: <span style="direction: ltr; unicode-bidi: embed;">https://t.me/...</span></div>' +
                    '<div>קישורים לשרתי דיסקורד חייבים להיות מהצורה: <span style="direction: ltr; unicode-bidi: embed;">https://discord.gg/...</span> או <span style="direction: ltr; unicode-bidi: embed;">https://discord.com/invite/...</span></div>' +
                '</div>'
            ]
        });

        return result;
    }

    function showWhatsappGroupLink(course) {
        var groupLinksData = {};

        var whatsappGroupDialog = BootstrapDialog.show({
            title: 'קבוצת וואטסאפ/טלגרם/דיסקורד',
            message: '<div class="whatsapp-group-link-content">טוען נתונים...</div>',
            onshow: function (dialog) {
                dialog.getButton('update-link').disable();
            },
            buttons: [{
                id: 'update-link',
                label: 'עדכן קישורים',
                action: function (dialog) {
                    var content = dialog.getModalBody().find('.whatsapp-group-link-content');

                    var form = content.find('form').get(0);
                    if (!form) {
                        content.html(makeWhatsappGroupLinkForm(groupLinksData));
                        content.find('form input:first').focus();
                        return;
                    }

                    if (form.checkValidity() === false) {
                        form.classList.add('was-validated');
                        return;
                    }
                    form.classList.remove('was-validated');

                    var button = dialog.getButton('update-link');
                    button.disable();

                    var newGroupLinksData = {};
                    var newGroupLinksDataWithDelete = {};
                    var newGroupLinksDataSelectors = {
                        whatsappGroupLink: '.whatsapp-group-link',
                        whatsappGroupLink2: '.whatsapp-group-link2',
                        whatsappGroupLink3: '.whatsapp-group-link3',
                        telegramGroupLink: '.telegram-group-link',
                        discordServerLink: '.discord-server-link'
                    };

                    Object.keys(newGroupLinksDataSelectors).forEach(function (key) {
                        var selector = newGroupLinksDataSelectors[key];
                        var url = content.find(selector).val()
                            .trim()
                            .replace(/[?&]fbclid=[a-zA-Z0-9_-]+$/, '')
                            .replace(/[?&]mode=\w+$/, '');

                        if (url !== '') {
                            newGroupLinksData[key] = url;
                            newGroupLinksDataWithDelete[key] = url;
                        } else {
                            newGroupLinksDataWithDelete[key] = firebase.firestore.FieldValue.delete();
                        }
                    });

                    firebase.firestore().collection('courseExtraDetails').doc(course)
                        .set(newGroupLinksDataWithDelete, { merge: true })
                        .then(function () {
                            groupLinksData = newGroupLinksData;
                            content.html(makeWhatsappGroupLinkContent(groupLinksData));
                            button.enable();
                        }, function (error) {
                            button.enable();
                            alert('Error writing document: ' + error);
                        });
                }
            }, {
                label: 'סגור',
                action: function (dialog) {
                    dialog.close();
                }
            }]
        });

        var onError = function (errorMessage) {
            whatsappGroupDialog.getModalBody().find('.whatsapp-group-link-content')
                .text(errorMessage);
        };

        var authenticated = firebase.auth &&
            firebase.auth().currentUser !== null;
        if (!authenticated) {
            onError('יש להתחבר לחשבון שלכם במערכת כדי לצפות בקישורים לקבוצות הקורס.');
        } else if (typeof firebase !== 'undefined') {
            firebase.firestore().collection('courseExtraDetails').doc(course).get()
                .then(function (doc) {
                    if (doc.exists) {
                        groupLinksData = doc.data();
                    }

                    whatsappGroupDialog.getModalBody().find('.whatsapp-group-link-content')
                        .html(makeWhatsappGroupLinkContent(groupLinksData));

                    whatsappGroupDialog.getButton('update-link').enable();
                }, function (error) {
                    onError('טעינת הנתונים נכשלה. נסו שוב מאוחר יותר.');
                });
        } else {
            onError('שירות Firebase אינו זמין כרגע.');
        }
    }

    CourseButtonList.prototype.addCourse = function (course, layerId) {
        var that = this;

        var list = getLayerList(that, layerId);

        var courseTitle = that.courseManager.getTitle(course);

        // A wrapper div for proper word wrapping of the content text.
        var spanAbsolute = $('<div class="content-wrapper"></div>').html($('<span class="content-absolute"></span>').text(courseTitle));
        var spanBoldHidden = $('<span class="content-bold-hidden"></span>').text(courseTitle);

        // Create drag handle (only visible when not readonly)
        var dragHandle = $('<span class="course-button-list-drag-handle">' +
            '<i class="fas fa-grip-vertical"></i>' +
            '</span>');

        var button = $('<li' +
            ' class="list-group-item active course-button-list-item"' +
            ' data-course-number="' + course + '">' +
            '</li>');
        var badge = $('<span class="badge badge-secondary float-right">' +
            '<span class="course-button-list-badge-text">i</span>' +
            '</span>');
        var color = that.colorGenerator(course);
        button.css('background-color', color)
            .click(function () {
                if (!that.readonly) {
                    onCourseButtonClick($(this), course);
                }
            })
            .hover(function () {
                $(this).addClass('course-button-list-item-hovered');
                that.onHoverIn(course, getListLayerId($(this).parent()));
            },
            function () {
                $(this).removeClass('course-button-list-item-hovered');
                that.onHoverOut(course, getListLayerId($(this).parent()));
            })
            .append(dragHandle, spanAbsolute, spanBoldHidden, badge);

        // Add tooltip to badge.
        var courseDescriptionHtml = that.courseManager.getDescription(course, {html: true});
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

            var firstTimeTooltipBadge = getAllLists(that).find('[data-special-tooltip="first-time"]');
            if (firstTimeTooltipBadge.length > 0) {
                firstTimeTooltipBadge.tooltip('dispose');
                addTooltipToBadge(firstTimeTooltipBadge, courseDescriptionHtml, false);
                try {
                    localStorage.setItem('dontShowHistogramsTip', Date.now().toString());
                } catch (e) {
                    // localStorage is not available in IE/Edge when running from a local file.
                }
            }

            $(this).tooltip('hide');
            showBootstrapDialogWithModelessButton('course-info', {
                title: courseTitle,
                size: BootstrapDialog.SIZE_WIDE,
                message: '<div class="course-information"></div><br><br>' +
                    '<div class="course-feedback"></div>' +
                    '<h3 class="text-center">היסטוגרמות</h3><div class="inline-histograms"></div>',
                onshow: function (dialog) {
                    that.infoDialogs.push(dialog);

                    setInfoDialogContent(dialog, course, that.courseManager);
                },
                onhidden: function (dialog) {
                    var index = that.infoDialogs.indexOf(dialog);
                    if (index !== -1) {
                        that.infoDialogs.splice(index, 1);
                    }
                }
            });
        });

        var showFirstTimeTooltip = false;
        if (getAllLists(that).find('li.list-group-item:first').length === 0) {
            try {
                showFirstTimeTooltip = !localStorage.getItem('dontShowHistogramsTip');
            } catch (e) {
                // localStorage is not available in IE/Edge when running from a local file.
            }
        }

        var tooltipHtml = courseDescriptionHtml;
        if (showFirstTimeTooltip) {
            tooltipHtml = 'לחצו כאן להצגת היסטוגרמות וחוות דעת על הקורס';
        }

        addTooltipToBadge(badge, tooltipHtml, showFirstTimeTooltip);

        list.append(button);

        // Initialize sortable after first course is added
        that.initializeSortableIfNeeded();

        if (showFirstTimeTooltip) {
            // Without setTimeout, if the list is hidden, the tooltip won't
            // scroll with the list once the list is shown.
            setTimeout(function () {
                badge.tooltip('show');
            }, 0);
        }

        function addTooltipToBadge(badge, tooltipHtml, firstTimeTooltip) {
            var trigger = 'hover';
            var extraClass = '';
            var extraClassInner = '';
            if (firstTimeTooltip) {
                trigger = 'manual';
                extraClass = ' course-button-list-tooltip-persistent';
                badge.attr('data-special-tooltip', 'first-time');
            } else {
                extraClassInner = ' course-description-tooltip-inner';
                badge.removeAttr('data-special-tooltip');
            }

            badge.prop('title', tooltipHtml)
                .attr('data-toggle', 'tooltip')
                .tooltip({
                    html: true,
                    placement: 'right',
                    template: '<div class="tooltip' + extraClass + '" role="tooltip"><div class="arrow arrow-fix-placement"></div><div class="tooltip-inner' + extraClassInner + '"></div></div>',
                    trigger: trigger
                });
        }

        function onCourseButtonClick(button, course) {
            if (button.hasClass('active')) {
                button.removeClass('active').removeClass('course-button-list-item-conflicted');
                button.find('.content-absolute').removeClass('course-button-list-content-has-hidden')
                    .tooltip('dispose');
                button.css('background-color', '');
                that.onDisableCourse(course, getListLayerId(button.parent()));
            } else {
                button.addClass('active');
                var color = that.colorGenerator(course);
                button.css('background-color', color);
                that.onEnableCourse(course, getListLayerId(button.parent()));
            }
        }
    };

    CourseButtonList.prototype.initializeSortableIfNeeded = function () {
        var that = this;

        // Don't initialize if already done, or if readonly
        if (that.sortableInitialized || that.readonly) {
            return;
        }

        // Don't initialize if no courses yet, unless there are layers to drag courses to
        if (that.layers.length === 0 && that.badgeContainer.find('li.list-group-item').length === 0) {
            return;
        }

        that.sortableInitialized = true;

        // Track if item should be deleted or moved to a new layer, and original position
        var shouldDelete = false;
        var shouldCreateLayer = false;
        var cachedHeight = 0;
        var originalIndex = -1;
        var originalList = null;

        // Initialize jQuery UI sortable, the lists of the layers are connected
        getAllLists(that).sortable({
            handle: '.course-button-list-drag-handle',
            placeholder: 'course-button-list-item ui-sortable-placeholder',
            tolerance: 'pointer',
            cursor: 'move',
            opacity: 0.8,
            delay: 100, // Helps distinguish between click and drag
            distance: 5, // Minimum distance to start drag
            connectWith: '.course-button-list-badge-container, .course-button-list-delete-area',

            // Helper event - fires before start, get height while item is still visible
            helper: function(event, item) {
                // Cache the height before the item gets hidden
                cachedHeight = item.outerHeight();
                return item.clone();
            },

            // Start event - clean up UI and show delete area
            start: function(event, ui) {
                shouldDelete = false;
                shouldCreateLayer = false;

                // Store the original list and index to detect if position changed
                originalList = ui.item.parent();
                originalIndex = ui.item.index();

                // Hide any visible tooltips
                getAllLists(that).find('[data-toggle="tooltip"]').tooltip('hide');

                // Add helper class for additional styling
                ui.helper.addClass('ui-sortable-helper');

                // Set placeholder height using cached value (item is still visible when cached)
                ui.placeholder.outerHeight(cachedHeight);

                // Show drop areas (if they exist)
                if (that.dropAreas) {
                    that.dropAreas.fadeIn(150);
                }
            },

            // Stop event - save new order or delete course
            stop: function(event, ui) {
                // Hide drop areas (if they exist)
                if (that.dropAreas) {
                    that.dropAreas.fadeOut(150);
                }

                var course = ui.item.attr('data-course-number');
                var selected = ui.item.hasClass('active');
                var originalLayerId = getListLayerId(originalList);
                var newList = ui.item.parent();
                var newLayerId = getListLayerId(newList);

                if (shouldDelete) {
                    // Remove the item from DOM
                    ui.item.remove();

                    // Call onDisableCourse to handle the deletion
                    if (course && that.onDisableCourse) {
                        that.onDisableCourse(course, originalLayerId);
                    }
                } else if (shouldCreateLayer) {
                    // Put the item back, the list is rebuilt once the layer is created.
                    originalList.sortable('cancel');

                    if (selected) {
                        // Not from within the callback, since the sortable is destroyed.
                        setTimeout(function () {
                            that.onLayerCreate(course, originalLayerId);
                        }, 0);
                    }
                } else if (newLayerId !== originalLayerId) {
                    if (newList.find('li.list-group-item[data-course-number="' + course + '"]').length > 1) {
                        // The course is already in the target layer.
                        originalList.sortable('cancel');
                    } else if (selected) {
                        // Not from within the callback, since the sortable is destroyed.
                        setTimeout(function () {
                            that.onCourseMove(course, originalLayerId, newLayerId);
                        }, 0);
                    }
                } else {
                    // Only call onReorder if position actually changed
                    var newIndex = ui.item.index();
                    if (newIndex !== originalIndex && that.onReorder) {
                        that.onReorder(newLayerId);
                    }
                }

                shouldDelete = false;
                shouldCreateLayer = false;
            }
        });

        // Make delete area droppable (only if it exists)
        if (that.deleteArea) {
            that.deleteArea.droppable({
                accept: '.course-button-list-item',
                tolerance: 'pointer',
                hoverClass: 'ui-droppable-hover',
                over: function(event, ui) {
                    shouldDelete = true;
                },
                out: function(event, ui) {
                    shouldDelete = false;
                }
            });
        }

        // Make new layer area droppable (only if it exists)
        if (that.newLayerArea) {
            that.newLayerArea.droppable({
                accept: '.course-button-list-item',
                tolerance: 'pointer',
                hoverClass: 'ui-droppable-hover',
                over: function(event, ui) {
                    shouldCreateLayer = true;
                },
                out: function(event, ui) {
                    shouldCreateLayer = false;
                }
            });
        }
    };

    CourseButtonList.prototype.destroySortable = function () {
        var that = this;

        if (that.sortableInitialized) {
            getAllLists(that).each(function () {
                try {
                    $(this).sortable('destroy');
                } catch (e) {
                    // Sortable may not be initialized, ignore
                }
            });

            if (that.deleteArea) {
                try {
                    that.deleteArea.droppable('destroy');
                } catch (e) {
                    // Droppable may not be initialized, ignore
                }
            }

            if (that.newLayerArea) {
                try {
                    that.newLayerArea.droppable('destroy');
                } catch (e) {
                    // Droppable may not be initialized, ignore
                }
            }

            that.sortableInitialized = false;
        }
    };

    function setInfoDialogContent(dialog, course, courseManager) {
        var modalBody = dialog.getModalBody();

        var courseDescriptionHtmlWithLinks = courseManager.getDescription(course, {
            html: true,
            relatedCourseInfo: true,
            links: true,
            whatsappGroupLink: true,
            logging: true
        });

        var courseInfo = $('<div>', {
            html: courseDescriptionHtmlWithLinks
        });

        courseInfo.find('.whatsapp-group-link').click(function () {
            showWhatsappGroupLink(courseManager.toNewCourseNumber(course));
            return false;
        });

        // Put links on course numbers.
        // Replace only text inside element: https://stackoverflow.com/a/11867485
        courseInfo.contents().filter(function () {
            return this.nodeType === Node.TEXT_NODE;
        }).each(function () {
            var replaced = false;
            var html = $('<div>').text(this.textContent).html().replace(/\b(?:\d{5,8})\b/g, function (match) {
                var matchCourse = courseManager.toSemesterFormatCourseNumber(
                    courseManager.stringToCourseNumber(match));
                if (matchCourse === course) {
                    return match;
                }

                var url;
                if (currentSemester < '202401') {
                    if (matchCourse.length !== 6) {
                        return match;
                    }

                    url = 'https://students.technion.ac.il/local/technionsearch/course/' + matchCourse;
                } else {
                    if (matchCourse.length !== 8) {
                        return match;
                    }

                    var currentSemesterYear = currentSemester.slice(0, 4);
                    var currentSemesterSapSemester = parseInt(currentSemester.slice(4), 10) - 1 + 200;
                    url = 'https://portalex.technion.ac.il/ovv/?sap-theme=sap_belize&sap-language=HE&sap-ui-language=HE#/details/' + currentSemesterYear + '/' + currentSemesterSapSemester + '/SM/' + matchCourse;
                }

                var tooltipTitle;
                var onmouseover = undefined;
                if (courseManager.doesExist(matchCourse)) {
                    tooltipTitle = courseManager.getTitle(matchCourse);
                } else {
                    tooltipTitle = '(לא מועבר בסמסטר)';

                    var courseNameUrl = 'https://michael-maltsev.github.io/technion-course-names/num/' + matchCourse;
                    onmouseover = 'var that = this;' +
                        'if (!$(that).attr("data-name-loading")) {' +
                            '$(that).attr("data-name-loading", true);' +
                            '$.get("' + courseNameUrl + '", function (name) {' +
                                '$(that).attr("data-original-title", "' + matchCourse + ' - " + name + " (לא מועבר בסמסטר)");' +
                                'if ($(that).is(":hover")) { $(that).tooltip("show"); }' +
                            '});' +
                        '}';
                }

                replaced = true;
                return $('<a>', {
                    href: url,
                    target: '_blank',
                    rel: 'noopener',
                    onclick: 'gtag(\'event\', \'info-click-dependency-link-rishum\')',
                    onmouseover: onmouseover,
                    title: tooltipTitle,
                    'data-toggle': 'tooltip',
                    'data-trigger': 'hover',
                    text: match
                })[0].outerHTML;
            });

            if (replaced) {
                var newElement = $('<span>', { html: html });
                newElement.find('[data-toggle="tooltip"]').tooltip();
                $(this).replaceWith(newElement);
            }
        });

        modalBody.find('.course-information').html(courseInfo);

        var courseFeedback = new CourseFeedback(modalBody.find('.course-feedback'), {});
        courseFeedback.loadFeedback(courseManager.toNewCourseNumber(course));

        var histogramBrowser = new HistogramBrowser(modalBody.find('.inline-histograms'), {});
        histogramBrowser.loadHistograms(courseManager.toNewCourseNumber(course));
    }

    CourseButtonList.prototype.setFloatingCourseInfo = function (course) {
        var that = this;

        if (that.infoDialogs.length === 0) {
            return;
        }

        var dialog = that.infoDialogs[that.infoDialogs.length - 1];

        var courseTitle = that.courseManager.getTitle(course);
        if (dialog.getTitle() === courseTitle) {
            return; // already showing this course
        }

        dialog.setTitle(courseTitle);

        setInfoDialogContent(dialog, course, that.courseManager);
    };

    // In the functions below, an undefined layerId means all layers.

    CourseButtonList.prototype.setHovered = function (course, layerId) {
        findCourseItems(this, course, layerId).addClass('course-button-list-item-hovered');
    };

    CourseButtonList.prototype.removeHovered = function (course, layerId) {
        findCourseItems(this, course, layerId).removeClass('course-button-list-item-hovered');
    };

    CourseButtonList.prototype.setConflicted = function (course, layerId) {
        findCourseItems(this, course, layerId).addClass('course-button-list-item-conflicted');
    };

    CourseButtonList.prototype.removeConflicted = function (course, layerId) {
        findCourseItems(this, course, layerId).removeClass('course-button-list-item-conflicted');
    };

    CourseButtonList.prototype.setLessonTypesHidden = function (course, lessonTypesHidden, layerId) {
        var listGroupTextItem = findCourseItems(this, course, layerId).find('.content-absolute');

        if (lessonTypesHidden.length > 0) {
            var title = 'אירועים מהסוגים הבאים הוסתרו מהמערכת:\n' + lessonTypesHidden.sort().join(', ');
            var titleHtml = $('<div>').text(title).html().replace(/\n/g, '<br>');

            listGroupTextItem.addClass('course-button-list-content-has-hidden')
                .tooltip('dispose')
                .prop('title', titleHtml)
                .attr('data-toggle', 'tooltip')
                .tooltip({
                    html: true,
                    placement: 'bottom'
                });
        } else {
            listGroupTextItem.removeClass('course-button-list-content-has-hidden')
                .tooltip('dispose');
        }
    };

    CourseButtonList.prototype.isCourseInList = function (course, layerId) {
        return findCourseItems(this, course, layerId).length > 0;
    };

    // Each course is returned once, even if it's in several layers.
    CourseButtonList.prototype.getCourseNumbers = function (onlySelected, layerId) {
        var that = this;

        var selector = 'li.list-group-item';
        if (onlySelected) {
            selector += '.active';
        }

        var lists = layerId === undefined ? getAllLists(that) : getLayerList(that, layerId);

        var courseNumbers = [];
        lists.find(selector).each(function () {
            var course = $(this).attr('data-course-number');
            if (courseNumbers.indexOf(course) === -1) {
                courseNumbers.push(course);
            }
        });

        return courseNumbers;
    };

    CourseButtonList.prototype.clear = function () {
        getAllLists(this).find('[data-toggle="tooltip"]').tooltip('hide');
        this.destroySortable();
        removeLayers(this);
        this.badgeContainer.empty();
    };

    return CourseButtonList;
})();
