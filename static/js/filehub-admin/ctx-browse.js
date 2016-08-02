/**
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * License: MIT
 */

(function ($, window, undefined) {
  'use strict';

  var filehub = window['filehub'];
  if (!PROD && !filehub) throw Error("filehub is not defined.");

  // post init of browse context for admin features
  filehub.register(true, 'browse', function () {
    var ACTIONS = this.ACTIONS;

    ACTIONS['folderAccessList'] = function(folder) {
      var self = this;

      if (folder.length !== 1 || folder.data('flags').indexOf('f') < 0) {
        return;
      }

      if (!self.accessListDialog) {
        self.accessListDialog = new filehub.AccessList({
          api: self.api
        });
        self.accessListDialog.dialog.on('show.bs.modal', function (evt) {
          self._scDisabled = true;
        }).on('hide.bs.modal', function (evt) {
          delete self._scDisabled;
        });
      }
      self.accessListDialog.edit(folder.data('path'), function (list, count) {
        self.trigger('accessListUpdated', [ folder, list, count ]);
      }, function (err, jqxhr) {
        self.trigger('error', [ err, jqxhr && jqxhr.statusCode() ]);
      });
    };

    this.on('accessListUpdated', function (folder, list, count) {
      var shared = folder.find('.folder-shared');
      if (!count) {
        if (shared.length) shared.remove();
        return;
      }
      if (!shared.length) {
        shared = $('<span class="folder-shared"/>').appendTo(folder.children('.folder-name').children('.list-cell-content'));
      }
      shared.text(count).prepend('<span class="fa fa-user"/>');
    });
  });
}(jQuery, window));
