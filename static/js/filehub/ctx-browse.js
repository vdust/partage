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

  var renameDialog = (function () {
    var r_modal, title, n, d, showSet, hideSet, _done;

    return function (type, done, name, desc) {
      if (!r_modal) {
        r_modal = $('#create-or-rename');
        title = $('#rd-title');
        n = $('#rd-name');
        d = $('#rd-desc');
        showSet = $('#rd-load');
        hideSet = $([n.parent().get(0), title.siblings('.close').get(0), r_modal.find('.modal-footer').get(0)]);

        r_modal.modal({
          backdrop: 'static',
          show: false
        });

        r_modal.on('hidden.bs.modal', function () {
          _done = null;
          hideSet.show();
          showSet.hide();
        }).on('shown.bs.modal', function () {
          n.removeClass('error').get(0).focus();
        }).on('click', 'button[data-type]', function () {
          var el = $(this);
          if (typeof _done === 'function') {
            hideSet.hide();
            showSet.show();
            r_modal.modal('handleUpdate');
            _done(el.data('type'), function (err) {
              if (err) {
                hideSet.show();
                showSet.hide();
                r_modal.modal('handleUpdate');
                n.addClass('error').get(0).focus();
              } else {
                r_modal.modal('hide');
              }
            }, n.val(), d.val());
          } else {
            r_modal.modal('hide');
          }
        });
      } 

      r_modal.find('.modal-footer').children('button[data-type]').each(function () {
        var el = $(this);
        el.toggle(el.data('type') === type);
      });

      d.toggle(desc != null).val(desc || '');
      n.val(name || '');
      title.text(title.data(type) || '');

      _done = done;
      r_modal.modal('show');
    }
  })();

  var ACTIONS = {
    contextMenu: function (items, button) {
      var off = button.offset(),
          h = button.innerHeight(),
          w = button.innerWidth(),
          e = $.Event('contextmenu', {
            pageX: off.left,
            pageY: off.top + h + 1,
            target: this.getSelected().get(0) || this.viewActive.get(0),
            selected: $()
          });

      this.contextMenu.css('min-width', w);
      this.viewContents.trigger(e);
    },
    newFolder: function (items) {
      var self = this,
          flags = self.viewActive.data('flags'),
          path = self.viewActive.data('path');

      if (!flags.indexOf('w') < 0) return;

      renameDialog('create', function (type, done, name, desc) {
        name = (name || '').replace(/^ +| +$/g, '');
        desc = (desc || '').replace(/^ +| +$/g, '');

        if (!name || name.indexOf('/') >= 0) {
          return done('name');
        }

        if (flags.indexOf('c') >= 0) {
          self.api.createFolder(name, {
            description: desc
          }).done(function () {
            done();
            self.reloadActive();
          }).error(function () {
            // TODO: Proper error reporting
            done('name');
          });
        } else {
          self.api.createDir('/'+path.replace(/^\/+/, '')+'/'+name)
            .done(function () {
              done();
              self.reloadActive();
            }).error(function () {
              done('name');
            });
        }
      }, '', flags.indexOf('c') >= 0 ? '' : null);
    },
    menuDownload: function (items) {
      console.log("download");
    },
    menuArchive: function (items) {
      console.log("get archive");
    },
    itemDelete: function (items) {
      console.log("delete");
    },
    trashRestore: function (items) {
    },
    trashRemove: function (items) {
    }
  };

  var MENUCHECK = {
    menuFolderCheck: function (el, selected) {
      var list = this.viewActive,
          disable = (list.data('flags')||'').indexOf('w') < 0,
          visible = !(selected && selected.length) && !list.is('#l-trash');

      el.toggle(visible);

      el.toggleClass('disabled', disable)
        .children('input').prop('disabled', disable);
    },
    menuItemCheck: function (el, selected) {
      var list = this.viewActive,
          select = el.data('select') || 'single',
          target = (el.data('target') || '*').split('|'),
          flag = target[1],
          filter = target[2],
          len = (selected && selected.length) || 0,
          visible = false,
          types = selected._browseSelectedTypes;

      target = target[0];

      do {
        // Must have selected elements
        if (!len) break;
        if (len > 1 && select === 'single') break;
        if (len < 2 && select === 'multi+') break;
        // Active list must match the filter
        if (filter && !list.is(filter)) break;
        // Active list must have the flag
        if (flag && (list.data('flags')||'').indexOf(flag) < 0) break;

        if (!types) {
          // We cache the items types in the jQuery object so we don't
          // create the list each time the function is called on the same
          // set.
          types = selected._browseSelectedTypes = {
            count: 0,
            map: {}
          };

          selected.each(function () {
            var row = $(this), t = row.data('type');
            if (!types.map[t]) {
              types.count++;
              types.map[t] = true;
            }
          });
        }

        if (target !== '*' && (types.count !== 1 || !types.map[target])) break;

        visible = true;
      } while (0);

      el.toggle(visible);
    }
  };

  filehub.register('browse', function () {
    var View = filehub.View;
    var poppingState;

    var api = new filehub.Api();

    var browse = new View({
      contextMenu: '#context-menu',
      dropzone: true,
      shortcuts: {
        "46": {
          "0": {
            eventname: 'action',
            args: [ 'itemDelete' ]
          }
        }
      }
    });

    browse.ACTIONS = ACTIONS;
    browse.api = api;

    browse.getSendQueue = function () {
      var self = this;

      if (!self.sendQueue) {
        self.sendQueue = new filehub.SendQueue({
          api: api
        });

        var pendingPaths = {};
        self.sendQueue.on('uploaded', function (up, ctx) {
          pendingPaths[up.options.path] = true;
        }).on('complete', function () {
          if (pendingPaths[self.viewActive.data('path')]) {
            self.reloadActive();
          }
          pendingPaths = {};
        });
      }

      return self.sendQueue;
    };

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
    }).on('reload-aside', function (uid) {
      if (uid === 'trash') return; // No reload to do if trash is the target.

      var aside = this.sidePanel,
          root = aside.getItem(),
          p = aside.getItem(uid);

      if (!p.length) p = root;

      $.getJSON(aside.treeBox.data('url'), {
        path: p.data('path'),
        merge: JSON.stringify({
          icon: { on: root.data('ico-on'), off: root.data('ico-off') }
        })
      }, function (list) {
        aside.update(uid, list);
      }).fail(function (jqxhr, txtstatus, error) {
        // TODO: Handle failure.
      });
    }).on('select', function (selected) {
      var self = this;

      this.nav.actions().each(function () {
        MENUCHECK.menuItemCheck.call(self, $(this), selected);
      });
    }).on('menuinit', function (menu) {
      $('#browse-menu-upload').on('change', function (e) {
        var files = this.files,
            path = menu.data('path');

        e.preventDefault();

        if (!path || !files || !files.length) return;

        browse.getSendQueue().queue(files, { path: path });
        browse.contextMenu.contextMenu('hide');
      });
    }).on('viewmenu', function (menu, selected) {
      var self = this;

      menu.data('path', self.viewActive.data('path'));

      // update visibility status of context items.
      menu.children('li').each(function () {
        var el = $(this),
            check = el.data('check');

        if (MENUCHECK[check]) {
          MENUCHECK[check].call(self, el, selected);
        }
      });
    }).on('button', function (button) {
      var act = button.data('action');
      if (act) this.trigger('action', [ act, button ]);
    }).on('action', function (action) {
      var handler = this.ACTIONS[action],
          args = [];

      if (!handler || typeof handler !== 'function') {
        return;
      }
      args.push(this.getSelected());
      $.merge(args, Array.prototype.slice.call(arguments, 1));

      handler.apply(this, args);
    }).on({
      dragenter: _dragUpdate,
      dragupdate: _dragUpdate,
      dragleave: _dragRelease,
      drop: _drop
    });

    var memDropTarget;
    function _dragUpdate(evt, ctx) {
      var rowDrop = ctx.row
            && ctx.row.hasClass('view-droppable')
            && ctx.row.data('flags').indexOf('w') >= 0,
          listDrop = ctx.list
            && ctx.list.data('flags').indexOf('w') >= 0
            && ctx.list.data('flags').indexOf('s') < 0;

      if (memDropTarget) memDropTarget.removeClass('view-dragover');
      if (rowDrop) {
        memDropTarget = ctx.row;
      } else if (listDrop) {
        memDropTarget = ctx.list;
      } else {
        memDropTarget = $();
      }
      memDropTarget.addClass('view-dragover');
    }
    function _dragRelease(evt, ctx) {
      if (memDropTarget) {
        memDropTarget.removeClass('view-dragover');
        memDropTarget = undefined;
      }
    }
    function _drop(evt, ctx) {
      var self = this,
          dt = evt.dataTransfer || (evt.originalEvent || {}).dataTransfer,
          target;

      _dragRelease();

      if (!dt || !dt.files || !dt.files.length) return;

      if (ctx.row
          && ctx.row.hasClass('view-droppable')
          && ctx.row.data('flags').indexOf('w') >= 0
      ) {
        target = ctx.row;
      } else if (ctx.list
                 && ctx.list.data('flags').indexOf('w') >= 0
                 && ctx.list.data('flags').indexOf('s') < 0
      ) {
        target = ctx.list;
      } else {
        return;
      }

      self.getSendQueue().queue(dt.files, {
        path: target.data('path')
      });
    }

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
