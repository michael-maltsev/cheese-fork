'use strict';

/* global BootstrapDialog, CheeseI18n */

(function () {
    var types = ['DEFAULT', 'INFO', 'PRIMARY', 'SECONDARY', 'SUCCESS', 'WARNING', 'DANGER', 'DARK', 'LIGHT'];
    types.forEach(function (type) {
        BootstrapDialog.DEFAULT_TEXTS[BootstrapDialog['TYPE_' + type]] = CheeseI18n.t('shell.dialog.' + type.toLowerCase());
    });
    ['OK', 'CANCEL', 'CONFIRM'].forEach(function (label) {
        BootstrapDialog.DEFAULT_TEXTS[label] = CheeseI18n.t('shell.dialog.' + label.toLowerCase());
    });
    var createCloseButton = BootstrapDialog.prototype.createCloseButton;
    BootstrapDialog.prototype.createCloseButton = function () {
        var button = createCloseButton.call(this);
        button.find('button.close').attr('aria-label', CheeseI18n.t('shell.dialog.close'));
        return button;
    };
}());
