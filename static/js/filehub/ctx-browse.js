/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

(function ($, window, undefined) {
  'use strict';

  var filehub = window['filehub'];
  if (!PROD && !filehub) throw Error("filehub is not defined.");

  function updateUrl(url, state) {
    if (filehub.support.pushState) {
      window.history.pushState(state, "", url);
    } else {
      location.assign(url); // Should stop script execution
    }
  }

  var ACTIONS = {
    folderAccessList: function(folder) {
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
    },
    itemDelete: function (items) {

    },
    trashRestore: function (items) {
    },
    trashRemove: function (items) {
    }
  };

  filehub.register('browse', function () {
    var View = filehub.View;
    var poppingState;

    var api = new filehub.Api();

    var browse = new View({});

    browse.on('refresh', function (uid, item) {
      if (!poppingState) {
        updateUrl(item.data('url'), {
          ctx: this.context,
          url: item.data('url'),
          uid: uid
        });
      }

      var navlist = [], tree, last=true;

      do {
        navlist.unshift({
          label: item.children('.tree-label').text(),
          cls: 'subdir'+(last?'':' act'),
          data: { uid: item.data('uid') }
        });
        last = false;

        tree = item.closest('.tree');
        item = tree.prev('.tree-item');
      } while (item.length);

      this.nav.update(navlist);
    }).on('load', function (uid, item, callback) {
      var self = this;

      self.sidePanel.enable(false);

      $.get(item.data('url')+'?list-only=1', function (html) {
        var list = $('<div/>').html(html).children('.list-box');

        if (list.length) {
          callback(null, list);
        } else {
          callback({ statusCode: 404, textStatus: 'error', error: 'Not Found' });
        }
      }).fail(function (jqxhr, textStatus, error) {
        callback({ statusCode: jqxhr.statusCode(), textStatus: textStatus, error: error });
      });
    }).on('activate', function (listrow) {
      switch(listrow.data('type')) {
        case 'folder':
          this.sidePanel.select(listrow.data('uid'));
          break;
        default:
          api.getFile(listrow.data('path'));
      }
    }).on('view', function (active) {
      this.sidePanel.enable((active.data('flags')||'').indexOf('w') >= 0);
    }).on('select', function (selected) {
      var list = this.viewActive,
          selTypes = {}, types = 0;

      selected.each(function () {
        var row = $(this), t = row.data('type');
        if (!selTypes[t]) {
          types++;
          selTypes[t] = true;
        }
      });

      this.nav.actions().each(function () {
        var action = $(this),
            select = action.data('select') || 'single',
            target = (action.data('target') || '*').split('|'),
            flag = target[1],
            filter = target[2],
            visible = false;

        target = target[0];

        do {
          // Must have selected element
          if (!selected || !selected.length) break;
          if (selected.length > 1 && select === 'single') break;
          // Active list must match the filter
          if (filter && !list.is(filter)) break;
          // Active list must have the flag
          if (flag && list.data('flags').indexOf(flag) < 0) break;

          if (target !== '*' && (types !== 1 || !selTypes[target])) break;

          visible = true;
        } while(0);

        action.toggle(visible);
      });
    }).on('action', function (action, actBtn) {
      var selected = this.getSelected(),
          handler = ACTIONS[action];

      if (!handler || typeof handler !== 'function') {
        return;
      }

      handler.call(this, selected, actBtn);
    }).on('accessListUpdated', function (folder, list, count) {
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

    $(window).on('popstate', function (evt) {
      var state = evt.originalEvent.state;

      if (state && state.ctx === browse.context) {
        poppingState = true;
        browse.sidePanel.select(state.uid);
        poppingState = false;
      }
    });

    return browse;
  });
})(jQuery, window);
