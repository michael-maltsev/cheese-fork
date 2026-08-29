'use strict';

/* global HistogramBrowser, CourseFeedback, BootstrapDialog, showBootstrapDialogWithModelessButton, firebase, gtag, currentSemester */

var LayerPanel = (function () {
    function LayerPanel(element, options) {
        this.element = element;
        this.courseManager = options.courseManager;
        this.colorGenerator = options.colorGenerator;
        this.readonly = options.readonly;
        
        // Layer callbacks
        this.onLayerVisibilityChanged = options.onLayerVisibilityChanged;
        this.onLayerCreated = options.onLayerCreated;
        this.onLayerRenamed = options.onLayerRenamed;
        this.onLayerDeleted = options.onLayerDeleted;
        this.onActiveLayerChanged = options.onActiveLayerChanged;
        
        // Course/event callbacks
        this.onHoverIn = options.onHoverIn;
        this.onHoverOut = options.onHoverOut;
        this.onEnableCourse = options.onEnableCourse;
        this.onDisableCourse = options.onDisableCourse;
        this.onEnableCustomEvent = options.onEnableCustomEvent;
        this.onDisableCustomEvent = options.onDisableCustomEvent;
        this.onRemoveCustomEvent = options.onRemoveCustomEvent;
        this.onReorder = options.onReorder;
        this.onItemMovedToLayer = options.onItemMovedToLayer;

        this.layers = [];
        this.layerContents = {}; // layerId -> { courses: [], customEvents: {} }
        this.activeLayerId = null;
        this.infoDialogs = [];
        this.sortableInitialized = false;

        var that = this;

        if (this.readonly) {
            this.element.addClass('layer-panel-readonly');
        }

        // Create main container
        this.container = $('<div class="layer-panel-container"></div>');
        this.element.append(this.container);

        // Add layer button (moved to index.html next to general-info)
        if (!this.readonly) {
            $('#btn-add-layer').removeClass('d-none').off('click').on('click', function () {
                that.showAddLayerDialog();
            });
        } else {
            $('#btn-add-layer').addClass('d-none');
        }

        // Layer groups container
        this.layersContainer = $('<div class="layer-groups-container"></div>');
        this.container.append(this.layersContainer);

        // Delete area
        if (!this.readonly) {
            this.deleteArea = $('<div class="layer-panel-delete-area">' +
                '<i class="fas fa-trash-alt"></i>' +
                '</div>');
            this.deleteArea.hide();
            this.container.append(this.deleteArea);
        }
    }

    LayerPanel.prototype.updateLayerHeadersVisibility = function () {
        var that = this;
        if (this.layers.length <= 1) {
            this.layersContainer.addClass('single-layer-mode');
            this.layersContainer.find('.layer-group-header').hide();
            this.layersContainer.find('.layer-group').removeClass('collapsed layer-hidden-group');
            if (this.layers.length === 1 && !this.layers[0].visible) {
                this.layers[0].visible = true;
                this.layersContainer.find('.layer-group[data-layer-id="' + this.layers[0].id + '"] .layer-visibility-toggle i')
                    .removeClass('fa-square').addClass('fa-check-square');
                if (this.onLayerVisibilityChanged) {
                    this.onLayerVisibilityChanged(this.layers[0].id, true);
                }
            }
        } else {
            this.layersContainer.removeClass('single-layer-mode');
            this.layersContainer.find('.layer-group-header').show();
            this.layersContainer.find('.layer-group').each(function () {
                var groupId = $(this).attr('data-layer-id');
                var layer = that.layers.find(function(l) { return l.id === groupId; });
                if (layer) {
                    if (!layer.visible) {
                        $(this).addClass('layer-hidden-group');
                    }
                    var isCollapsed = false;
                    try {
                        isCollapsed = localStorage.getItem('layer_collapsed_' + layer.id) === 'true';
                    } catch (e) {}
                    if (isCollapsed) {
                        $(this).addClass('collapsed');
                    }
                }
            });
        }
    };

    LayerPanel.prototype.loadLayers = function (layersArray, layerContents) {
        var that = this;
        this.layers = layersArray || [];
        this.layerContents = layerContents || {};
        
        // Ensure at least one layer exists visually
        if (this.layers.length === 0) {
            return;
        }

        this.activeLayerId = this.layers[0].id; // Default to first layer if not set
        
        this.destroySortable();
        this.layersContainer.empty();

        this.layers.forEach(function(layer) {
            that.renderLayerGroup(layer);
        });

        this.updateLayerHeadersVisibility();
        this.initializeSortableIfNeeded();
    };

    LayerPanel.prototype.getLayers = function () {
        return this.layers;
    };

    LayerPanel.prototype.getActiveLayerId = function () {
        return this.activeLayerId;
    };

    LayerPanel.prototype.setActiveLayer = function (layerId) {
        if (this.readonly) return;
        
        this.activeLayerId = layerId;
        this.layersContainer.find('.layer-group-header').removeClass('active-layer');
        this.layersContainer.find('.layer-group[data-layer-id="' + layerId + '"] .layer-group-header').addClass('active-layer');
        
        if (this.onActiveLayerChanged) {
            this.onActiveLayerChanged(layerId);
        }
    };

    LayerPanel.prototype.getVisibleLayerIds = function () {
        return this.layers.filter(function(l) { return l.visible; }).map(function(l) { return l.id; });
    };

    LayerPanel.prototype.renderLayerGroup = function(layer) {
        var that = this;
        
        var isCollapsed = false;
        try {
            isCollapsed = localStorage.getItem('layer_collapsed_' + layer.id) === 'true';
        } catch (e) {}

        var group = $('<div class="layer-group" data-layer-id="' + layer.id + '"></div>');
        if (isCollapsed) group.addClass('collapsed');
        if (!layer.visible) group.addClass('layer-hidden-group');

        var header = $('<div class="layer-group-header"></div>');
        if (layer.id === this.activeLayerId) header.addClass('active-layer');


        // Collapse toggle
        var collapseToggle = $('<div class="layer-collapse-toggle"><i class="fas fa-chevron-down"></i></div>');
        collapseToggle.click(function(e) {
            e.stopPropagation();
            group.toggleClass('collapsed');
            try {
                localStorage.setItem('layer_collapsed_' + layer.id, group.hasClass('collapsed'));
            } catch (err) {}
        });
        header.append(collapseToggle);

        // Visibility checkbox
        var visibilityToggle = $('<div class="layer-visibility-toggle">' + 
            '<i class="' + (layer.visible ? 'far fa-check-square' : 'far fa-square') + '"></i>' + 
            '</div>');
        if (!this.readonly) {
            visibilityToggle.click(function(e) {
                e.stopPropagation();
                var newVisible = !layer.visible;
                layer.visible = newVisible;
                $(this).find('i').removeClass('fa-check-square fa-square')
                    .addClass(newVisible ? 'far fa-check-square' : 'far fa-square');
                
                if (newVisible) {
                    group.removeClass('layer-hidden-group');
                } else {
                    group.addClass('layer-hidden-group');
                }
                
                if (that.onLayerVisibilityChanged) {
                    that.onLayerVisibilityChanged(layer.id, newVisible);
                }
            });
        }
        header.append(visibilityToggle);

        // Name
        var nameSpan = $('<div class="layer-name"></div>').text(layer.name).attr('title', layer.name);
        header.append(nameSpan);

        // Menu
        if (!this.readonly) {
            var menuButton = $('<div class="layer-menu-toggle dropdown">' +
                '<i class="fas fa-ellipsis-v" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false"></i>' +
                '<div class="dropdown-menu dropdown-menu-right text-right">' +
                '<a class="dropdown-item rename-btn" href="#">שנה שם</a>' +
                '<a class="dropdown-item delete-btn text-danger" href="#">מחק</a>' +
                '</div>' +
                '</div>');
            
            menuButton.find('.dropdown').click(function(e) { e.stopPropagation(); });
            
            menuButton.find('.rename-btn').click(function(e) {
                e.preventDefault();
                that.showRenameLayerDialog(layer);
            });
            
            menuButton.find('.delete-btn').click(function(e) {
                e.preventDefault();
                if (that.layers.length <= 1) {
                    BootstrapDialog.show({
                        title: 'שגיאה',
                        message: 'לא ניתן למחוק את השכבה האחרונה.',
                        type: BootstrapDialog.TYPE_DANGER
                    });
                    return;
                }
                that.showDeleteLayerDialog(layer);
            });
            
            header.append(menuButton);
        }

        // Set active on click
        if (!this.readonly) {
            header.click(function() {
                that.setActiveLayer(layer.id);
            });
        }

        group.append(header);

        // Children container
        var childrenList = $('<ul class="layer-children"></ul>');
        group.append(childrenList);
        
        this.layersContainer.append(group);

        // Render contents if any
        if (this.layerContents[layer.id]) {
            var courses = this.layerContents[layer.id].courses || [];
            courses.forEach(function(course) {
                that.renderCourseItem(course, layer.id, childrenList);
            });
            
            var customEvents = this.layerContents[layer.id].customEvents || {};
            Object.keys(customEvents).forEach(function(eventId) {
                that.renderCustomEventItem(eventId, customEvents[eventId].title, layer.id, childrenList);
            });
        }
    };

    LayerPanel.prototype.showAddLayerDialog = function() {
        var that = this;
        BootstrapDialog.show({
            title: 'שכבה חדשה',
            message: '<input type="text" class="form-control" id="new-layer-name" placeholder="שם השכבה" maxlength="20">',
            onshown: function(dialog) {
                $('#new-layer-name').focus().keypress(function(e) {
                    if (e.which === 13) {
                        dialog.getButton('btn-ok').click();
                    }
                });
            },
            buttons: [{
                id: 'btn-ok',
                label: 'הוסף',
                cssClass: 'btn-primary',
                action: function(dialog) {
                    var name = $('#new-layer-name').val().trim();
                    if (name) {
                        var id = 'layer_' + Date.now() + Math.floor(Math.random() * 1000);
                        var newLayer = { id: id, name: name, visible: true };
                        that.layers.push(newLayer);
                        that.layerContents[id] = { courses: [], customEvents: {} };
                        
                        that.renderLayerGroup(newLayer);
                        that.setActiveLayer(id);
                        that.destroySortable();
                        that.initializeSortableIfNeeded();
                        that.updateLayerHeadersVisibility();
                        
                        if (that.onLayerCreated) {
                            that.onLayerCreated(id, newLayer.name);
                        }
                        dialog.close();
                    }
                }
            }, {
                label: 'ביטול',
                action: function(dialog) {
                    dialog.close();
                }
            }]
        });
    };

    LayerPanel.prototype.showRenameLayerDialog = function(layer) {
        var that = this;
        var renameInput = $('<input type="text" class="form-control" id="rename-layer-name" maxlength="20">').val(layer.name);

        BootstrapDialog.show({
            title: 'שינוי שם שכבה',
            message: renameInput,
            onshown: function(dialog) {
                dialog.getModalBody().find('#rename-layer-name').focus().select().keypress(function(e) {
                    if (e.which === 13) {
                        dialog.getButton('btn-ok').click();
                    }
                });
            },
            buttons: [{
                id: 'btn-ok',
                label: 'שמור',
                cssClass: 'btn-primary',
                action: function(dialog) {
                    var name = dialog.getModalBody().find('#rename-layer-name').val().trim();
                    if (name && name !== layer.name) {
                        layer.name = name;
                        that.layersContainer.find('.layer-group[data-layer-id="' + layer.id + '"] .layer-name')
                            .text(name).attr('title', name);
                        
                        if (that.onLayerRenamed) {
                            that.onLayerRenamed(layer.id, name);
                        }
                    }
                    dialog.close();
                }
            }, {
                label: 'ביטול',
                action: function(dialog) {
                    dialog.close();
                }
            }]
        });
    };

    LayerPanel.prototype.showDeleteLayerDialog = function(layer) {
        var that = this;
        var message = $('<div></div>');
        message.append(document.createTextNode('האם אתם בטוחים שברצונכם למחוק את השכבה "'));
        message.append($('<span></span>').text(layer.name));
        message.append(document.createTextNode('"? הקורסים והאירועים שבה יועברו לשכבה הראשונה.'));

        BootstrapDialog.show({
            title: 'מחיקת שכבה',
            message: message,
            buttons: [{
                label: 'מחק',
                cssClass: 'btn-danger',
                action: function(dialog) {
                    var group = that.layersContainer.find('.layer-group[data-layer-id="' + layer.id + '"]');
                    var targetLayerId = that.layers[0].id;
                    if (targetLayerId === layer.id) {
                        targetLayerId = that.layers[1].id;
                    }
                    
                    // The orchestrator handles moving the data, we just trigger the event
                    if (that.onLayerDeleted) {
                        that.onLayerDeleted(layer.id, targetLayerId);
                    }
                    
                    dialog.close();
                }
            }, {
                label: 'ביטול',
                action: function(dialog) {
                    dialog.close();
                }
            }]
        });
    };

    LayerPanel.prototype.renderCourseItem = function (course, layerId, container) {
        var that = this;
        var courseTitle = that.courseManager.getTitle(course);

        // A wrapper div for proper word wrapping of the content text.
        var spanAbsolute = $('<div class="layer-panel-content-wrapper"></div>').attr('title', courseTitle).html($('<span class="content-absolute"></span>').text(courseTitle));
        
        // Create drag handle (only visible when not readonly)
        var dragHandle = $('<span class="layer-panel-drag-handle">' +
            '<i class="fas fa-grip-vertical"></i>' +
            '</span>');

        var button = $('<li' +
            ' class="layer-panel-item active"' +
            ' data-item-type="course"' +
            ' data-item-id="' + course + '">' +
            '</li>');
            
        var badge = $('<span class="badge badge-secondary float-right layer-panel-badge">' +
            '<span class="course-button-list-badge-text">i</span>' +
            '</span>');
            
        button.css('background-color', that.colorGenerator(course, layerId))
            .click(function () {
                if (!that.readonly) {
                    if (button.hasClass('active')) {
                        button.removeClass('active').removeClass('layer-panel-item-conflicted');
                        button.find('.content-absolute').removeClass('layer-panel-content-has-hidden')
                            .tooltip('dispose');
                        button.css('background-color', '');
                        if (that.onDisableCourse) that.onDisableCourse(course, layerId);
                    } else {
                        button.addClass('active');
                        button.css('background-color', that.colorGenerator(course, layerId));
                        if (that.onEnableCourse) that.onEnableCourse(course, layerId);
                    }
                }
            })
            .hover(function () {
                $(this).addClass('layer-panel-item-hovered');
                if (that.onHoverIn) that.onHoverIn(course, layerId);
            },
            function () {
                $(this).removeClass('layer-panel-item-hovered');
                if (that.onHoverOut) that.onHoverOut(course, layerId);
            })
            .append(dragHandle, spanAbsolute, badge);

        // Add tooltip to badge.
        var courseDescriptionHtml = that.courseManager.getDescription(course, {html: true});
        badge.hover(
            function () {
                $(this).removeClass('badge-secondary').addClass('badge-primary');
            }, function () {
                $(this).removeClass('badge-primary').addClass('badge-secondary');
            }
        ).click(function (e) {
            e.stopPropagation(); // don't execute parent button onclick
            gtag('event', 'course-button-list-info-click');

            var firstTimeTooltipBadge = that.layersContainer.find('[data-special-tooltip="first-time"]');
            if (firstTimeTooltipBadge.length > 0) {
                firstTimeTooltipBadge.tooltip('dispose');
                that.addTooltipToBadge(firstTimeTooltipBadge, courseDescriptionHtml, false);
                try { localStorage.setItem('dontShowHistogramsTip', Date.now().toString()); } catch (e) {}
            }

            $(this).tooltip('hide');
            that.showCourseInfoDialog(course, courseTitle);
        });

        var showFirstTimeTooltip = false;
        if (that.layersContainer.find('li.layer-panel-item:first').length === 0) {
            try { showFirstTimeTooltip = !localStorage.getItem('dontShowHistogramsTip'); } catch (e) {}
        }

        var tooltipHtml = showFirstTimeTooltip ? 'לחצו כאן להצגת היסטוגרמות וחוות דעת על הקורס' : courseDescriptionHtml;
        that.addTooltipToBadge(badge, tooltipHtml, showFirstTimeTooltip);

        container.append(button);

        if (showFirstTimeTooltip) {
            setTimeout(function () { badge.tooltip('show'); }, 0);
        }
    };

    LayerPanel.prototype.renderCustomEventItem = function (eventId, title, layerId, container) {
        var that = this;
        
        var spanAbsolute = $('<div class="layer-panel-content-wrapper"></div>').attr('title', title).html($('<span class="content-absolute"></span>').text('✦ ' + title));
        var dragHandle = $('<span class="layer-panel-drag-handle"><i class="fas fa-grip-vertical"></i></span>');

        var button = $('<li class="layer-panel-item active" data-item-type="custom" data-item-id="' + eventId + '" data-item-title="' + title.replace(/"/g, '&quot;') + '"></li>');
        
        button.css('background-color', that.colorGenerator(title, layerId))
            .click(function () {
                if (!that.readonly) {
                    if (button.hasClass('active')) {
                        button.removeClass('active');
                        button.css('background-color', '');
                        if (that.onDisableCustomEvent) that.onDisableCustomEvent(eventId, layerId);
                    } else {
                        button.addClass('active');
                        button.css('background-color', that.colorGenerator(title, layerId));
                        if (that.onEnableCustomEvent) that.onEnableCustomEvent(eventId, layerId);
                    }
                }
            })
            .hover(function () { $(this).addClass('layer-panel-item-hovered'); },
                   function () { $(this).removeClass('layer-panel-item-hovered'); })
            .append(dragHandle, spanAbsolute);

        container.append(button);
    };

    LayerPanel.prototype.addTooltipToBadge = function(badge, tooltipHtml, firstTimeTooltip) {
        var trigger = firstTimeTooltip ? 'manual' : 'hover';
        var extraClass = firstTimeTooltip ? ' course-button-list-tooltip-persistent' : '';
        var extraClassInner = firstTimeTooltip ? '' : ' course-description-tooltip-inner';
        
        if (firstTimeTooltip) badge.attr('data-special-tooltip', 'first-time');
        else badge.removeAttr('data-special-tooltip');

        badge.prop('title', tooltipHtml)
            .attr('data-toggle', 'tooltip')
            .tooltip({
                html: true,
                placement: 'right',
                template: '<div class="tooltip' + extraClass + '" role="tooltip"><div class="arrow arrow-fix-placement"></div><div class="tooltip-inner' + extraClassInner + '"></div></div>',
                trigger: trigger
            });
    };

    LayerPanel.prototype.initializeSortableIfNeeded = function () {
        var that = this;

        if (that.sortableInitialized || that.readonly) return;
        
        var itemsCount = that.layersContainer.find('li.layer-panel-item').length;
        if (itemsCount === 0 && that.layers.length <= 1) return; // Wait until there's something to drag or multiple layers

        that.sortableInitialized = true;
        var shouldDelete = false;
        var cachedHeight = 0;
        var originalLayerId = null;
        var originalIndex = -1;

        // Make each layer's ul sortable and connected
        that.layersContainer.find('.layer-children').sortable({
            handle: '.layer-panel-drag-handle',
            placeholder: 'layer-panel-item ui-sortable-placeholder',
            tolerance: 'pointer',
            cursor: 'move',
            opacity: 0.8,
            delay: 100,
            distance: 5,
            connectWith: '.layer-children',
            
            helper: function(event, item) {
                cachedHeight = item.outerHeight();
                return item.clone();
            },
            
            start: function(event, ui) {
                shouldDelete = false;
                originalIndex = ui.item.index();
                originalLayerId = ui.item.closest('.layer-group').attr('data-layer-id');
                
                that.layersContainer.find('[data-toggle="tooltip"]').tooltip('hide');
                ui.helper.addClass('ui-sortable-helper');
                ui.placeholder.outerHeight(cachedHeight);
                
                if (that.deleteArea) that.deleteArea.fadeIn(150);
            },
            
            over: function(event, ui) {
                // Highlight the target layer group
                if ($(this).hasClass('layer-children')) {
                    var targetLayerId = $(this).closest('.layer-group').attr('data-layer-id');
                    if (targetLayerId !== originalLayerId) {
                        $(this).closest('.layer-group').addClass('layer-panel-drag-target');
                    }
                }
            },
            
            out: function(event, ui) {
                if ($(this).hasClass('layer-children')) {
                    $(this).closest('.layer-group').removeClass('layer-panel-drag-target');
                }
            },
            
            receive: function(event, ui) {
                var itemId = ui.item.attr('data-item-id');
                var itemType = ui.item.attr('data-item-type');
                if ($(this).find('.layer-panel-item[data-item-type="' + itemType + '"][data-item-id="' + itemId + '"]').length > 1) {
                    ui.sender.sortable('cancel');
                }
            },
            
            stop: function(event, ui) {
                if (that.deleteArea) that.deleteArea.fadeOut(150);
                that.layersContainer.find('.layer-group').removeClass('layer-panel-drag-target');

                var itemId = ui.item.attr('data-item-id');
                var itemType = ui.item.attr('data-item-type');
                
                if (shouldDelete) {
                    ui.item.remove();
                    if (itemType === 'course' && that.onDisableCourse) {
                        that.onDisableCourse(itemId, originalLayerId);
                    } else if (itemType === 'custom' && that.onRemoveCustomEvent) {
                        that.onRemoveCustomEvent(itemId, originalLayerId);
                    }
                } else {
                    var newLayerId = ui.item.closest('.layer-group').attr('data-layer-id');
                    var newIndex = ui.item.index();
                    
                    if (newLayerId !== originalLayerId) {
                        // Item moved to a different layer
                        if (that.onItemMovedToLayer) {
                            that.onItemMovedToLayer(itemType, itemId, originalLayerId, newLayerId);
                        }
                    } else if (newIndex !== originalIndex) {
                        // Reordered within same layer
                        if (that.onReorder) that.onReorder(originalLayerId);
                    }
                }
                shouldDelete = false;
            }
        });

        // Make delete area droppable
        if (that.deleteArea) {
            that.deleteArea.droppable({
                accept: '.layer-panel-item',
                tolerance: 'pointer',
                hoverClass: 'ui-droppable-hover',
                over: function(event, ui) { shouldDelete = true; },
                out: function(event, ui) { shouldDelete = false; }
            });
        }
    };

    LayerPanel.prototype.destroySortable = function () {
        if (this.sortableInitialized) {
            try { this.layersContainer.find('.layer-children').sortable('destroy'); } catch (e) {}
            if (this.deleteArea) {
                try { this.deleteArea.droppable('destroy'); } catch (e) {}
            }
            this.sortableInitialized = false;
        }
    };

    // --- CourseButtonList Ported API Methods ---

    LayerPanel.prototype.addCourse = function (course, layerId) {
        if (!layerId) layerId = this.activeLayerId;
        
        // Find the layer group
        var group = this.layersContainer.find('.layer-group[data-layer-id="' + layerId + '"]');
        if (group.length === 0) return; // Layer doesn't exist
        
        var childrenList = group.find('.layer-children');
        
        // Check if already exists in this layer
        if (childrenList.find('.layer-panel-item[data-item-type="course"][data-item-id="' + course + '"]').length > 0) {
            return; // Already in layer
        }
        
        this.renderCourseItem(course, layerId, childrenList);
        
        // Re-init sortable if needed (new element)
        try { this.layersContainer.find('.layer-children').sortable('refresh'); } catch(e) {}
        this.initializeSortableIfNeeded();
    };

    LayerPanel.prototype.addCustomEvent = function (eventId, title, layerId) {
        if (!layerId) layerId = this.activeLayerId;
        
        var group = this.layersContainer.find('.layer-group[data-layer-id="' + layerId + '"]');
        if (group.length === 0) return;
        
        var childrenList = group.find('.layer-children');
        if (childrenList.find('.layer-panel-item[data-item-type="custom"][data-item-id="' + eventId + '"]').length > 0) return;
        
        this.renderCustomEventItem(eventId, title, layerId, childrenList);
        
        try { this.layersContainer.find('.layer-children').sortable('refresh'); } catch(e) {}
        this.initializeSortableIfNeeded();
    };

    LayerPanel.prototype.updateCustomEvent = function (eventId, title, layerId) {
        if (!layerId) layerId = this.activeLayerId;
        var selector = '.layer-group[data-layer-id="' + layerId + '"] .layer-panel-item[data-item-type="custom"][data-item-id="' + eventId + '"]';
        this.layersContainer.find(selector).find('.content-absolute').text('✦ ' + title);
    };

    LayerPanel.prototype.removeCustomEvent = function (eventId, layerId) {
        if (!layerId) layerId = this.activeLayerId;
        var selector = '.layer-group[data-layer-id="' + layerId + '"] .layer-panel-item[data-item-type="custom"][data-item-id="' + eventId + '"]';
        this.layersContainer.find(selector).remove();
    };

    LayerPanel.prototype.isCourseInLayer = function (course, layerId) {
        var selector = '.layer-group[data-layer-id="' + layerId + '"] .layer-panel-item[data-item-type="course"][data-item-id="' + course + '"]';
        return this.layersContainer.find(selector).length > 0;
    };

    LayerPanel.prototype.isCourseActiveInLayer = function (course, layerId) {
        var selector = '.layer-group[data-layer-id="' + layerId + '"] .layer-panel-item.active[data-item-type="course"][data-item-id="' + course + '"]';
        return this.layersContainer.find(selector).length > 0;
    };

    LayerPanel.prototype.getCourseNumbers = function (onlySelected, layerId, onlyVisibleLayers) {
        var selector = '.layer-panel-item[data-item-type="course"]';
        if (onlySelected) selector += '.active';
        
        var container = layerId ? 
            this.layersContainer.find('.layer-group[data-layer-id="' + layerId + '"]') : 
            this.layersContainer;
            
        var courseNumbers = [];
        container.find(selector).each(function () {
            if (onlyVisibleLayers && $(this).closest('.layer-group').hasClass('layer-hidden-group')) {
                return; // skip
            }
            courseNumbers.push($(this).attr('data-item-id'));
        });
        return courseNumbers;
    };

    LayerPanel.prototype.setHovered = function (course) {
        this.layersContainer.find('.layer-panel-item[data-item-type="course"][data-item-id="' + course + '"]')
            .addClass('layer-panel-item-hovered');
    };

    LayerPanel.prototype.removeHovered = function (course) {
        this.layersContainer.find('.layer-panel-item[data-item-type="course"][data-item-id="' + course + '"]')
            .removeClass('layer-panel-item-hovered');
    };

    LayerPanel.prototype.setConflicted = function (course, layerId) {
        var selector = '.layer-panel-item[data-item-type="course"][data-item-id="' + course + '"]';
        var container = layerId ? this.layersContainer.find('.layer-group[data-layer-id="' + layerId + '"]') : this.layersContainer;
        container.find(selector).addClass('layer-panel-item-conflicted');
    };

    LayerPanel.prototype.removeConflicted = function (course, layerId) {
        var selector = '.layer-panel-item[data-item-type="course"][data-item-id="' + course + '"]';
        var container = layerId ? this.layersContainer.find('.layer-group[data-layer-id="' + layerId + '"]') : this.layersContainer;
        container.find(selector).removeClass('layer-panel-item-conflicted');
    };

    LayerPanel.prototype.setLessonTypesHidden = function (course, layerId, lessonTypesHidden) {
        var selector = '.layer-panel-item[data-item-type="course"][data-item-id="' + course + '"] .content-absolute';
        var container = layerId ? this.layersContainer.find('.layer-group[data-layer-id="' + layerId + '"]') : this.layersContainer;
        var listGroupTextItem = container.find(selector);

        if (lessonTypesHidden && lessonTypesHidden.length > 0) {
            var title = 'אירועים מהסוגים הבאים הוסתרו מהמערכת:\n' + lessonTypesHidden.sort().join(', ');
            var titleHtml = $('<div>').text(title).html().replace(/\n/g, '<br>');

            listGroupTextItem.addClass('layer-panel-content-has-hidden')
                .tooltip('dispose')
                .prop('title', titleHtml)
                .attr('data-toggle', 'tooltip')
                .tooltip({ html: true, placement: 'bottom' });
        } else {
            listGroupTextItem.removeClass('layer-panel-content-has-hidden').tooltip('dispose');
        }
    };

    LayerPanel.prototype.updateColors = function () {
        var that = this;
        this.layersContainer.find('.layer-panel-item').each(function () {
            var item = $(this);
            var layerId = item.closest('.layer-group').attr('data-layer-id');
            var itemType = item.attr('data-item-type');
            if (itemType === 'course') {
                var course = item.attr('data-item-id');
                if (item.hasClass('active')) {
                    item.css('background-color', that.colorGenerator(course, layerId));
                }
            } else if (itemType === 'custom') {
                var title = item.attr('data-item-title');
                if (title && item.hasClass('active')) {
                    item.css('background-color', that.colorGenerator(title, layerId));
                }
            }
        });
    };

    LayerPanel.prototype.clear = function () {
        this.layersContainer.find('[data-toggle="tooltip"]').tooltip('hide');
        this.destroySortable();
        this.layersContainer.empty();
        this.layers = [];
        this.layerContents = {};
        this.activeLayerId = null;
    };
    
    // --- Course Info Dialog Methods ---
    
    LayerPanel.prototype.showCourseInfoDialog = function(course, courseTitle) {
        var that = this;
        showBootstrapDialogWithModelessButton('course-info', {
            title: courseTitle,
            size: BootstrapDialog.SIZE_WIDE,
            message: '<div class="course-information"></div><br><br>' +
                '<div class="course-feedback"></div>' +
                '<h3 class="text-center">היסטוגרמות</h3><div class="inline-histograms"></div>',
            onshow: function (dialog) {
                that.infoDialogs.push(dialog);
                that.setInfoDialogContent(dialog, course);
            },
            onhidden: function (dialog) {
                var index = that.infoDialogs.indexOf(dialog);
                if (index !== -1) that.infoDialogs.splice(index, 1);
            }
        });
    };
    
    LayerPanel.prototype.setFloatingCourseInfo = function (course) {
        if (this.infoDialogs.length === 0) return;
        var dialog = this.infoDialogs[this.infoDialogs.length - 1];
        var courseTitle = this.courseManager.getTitle(course);
        if (dialog.getTitle() === courseTitle) return; // already showing this course
        dialog.setTitle(courseTitle);
        this.setInfoDialogContent(dialog, course);
    };
    
    LayerPanel.prototype.setInfoDialogContent = function(dialog, course) {
        var modalBody = dialog.getModalBody();
        var courseManager = this.courseManager;

        var courseDescriptionHtmlWithLinks = courseManager.getDescription(course, {
            html: true, relatedCourseInfo: true, links: true, whatsappGroupLink: true, logging: true
        });

        var courseInfo = $('<div>', { html: courseDescriptionHtmlWithLinks });

        // Link Replacement Logic from CourseButtonList (omitted Whatsapp modal logic for brevity, 
        // assuming it could be moved to a shared utils file or copied entirely. For now, 
        // we'll keep the dependency links logic which is critical)
        courseInfo.contents().filter(function () {
            return this.nodeType === Node.TEXT_NODE;
        }).each(function () {
            var replaced = false;
            var html = $('<div>').text(this.textContent).html().replace(/\b(?:\d{5,8})\b/g, function (match) {
                var matchCourse = courseManager.toSemesterFormatCourseNumber(courseManager.stringToCourseNumber(match));
                if (matchCourse === course) return match;

                var url;
                if (currentSemester < '202401') {
                    if (matchCourse.length !== 6) return match;
                    url = 'https://students.technion.ac.il/local/technionsearch/course/' + matchCourse;
                } else {
                    if (matchCourse.length !== 8) return match;
                    var currentSemesterYear = currentSemester.slice(0, 4);
                    var currentSemesterSapSemester = parseInt(currentSemester.slice(4), 10) - 1 + 200;
                    url = 'https://portalex.technion.ac.il/ovv/?sap-theme=sap_belize&sap-language=HE&sap-ui-language=HE#/details/' + currentSemesterYear + '/' + currentSemesterSapSemester + '/SM/' + matchCourse;
                }

                var tooltipTitle;
                if (courseManager.doesExist(matchCourse)) {
                    tooltipTitle = courseManager.getTitle(matchCourse);
                } else {
                    tooltipTitle = '(לא מועבר בסמסטר)';
                }

                replaced = true;
                return $('<a>', {
                    href: url, target: '_blank', rel: 'noopener',
                    onclick: 'gtag(\'event\', \'info-click-dependency-link-rishum\')',
                    title: tooltipTitle, 'data-toggle': 'tooltip', 'data-trigger': 'hover',
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

        if (typeof CourseFeedback !== 'undefined') {
            var courseFeedback = new CourseFeedback(modalBody.find('.course-feedback'), {});
            courseFeedback.loadFeedback(courseManager.toNewCourseNumber(course));
        }

        if (typeof HistogramBrowser !== 'undefined') {
            var histogramBrowser = new HistogramBrowser(modalBody.find('.inline-histograms'), {});
            histogramBrowser.loadHistograms(courseManager.toNewCourseNumber(course));
        }
    };

    return LayerPanel;
})();
