/* partage
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * ISC Licensed
 */

(function ($, window, undefined) {
  'use strict';

  var partage = window['partage'];
  if (!PROD && !partage) throw Error("partage is not defined.");

  var _TRIM = /^\s*|\s*$/g;

  function updateUrl(url, state) {
    if (partage.support.pushState) {
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
        }).on('keydown', 'input', function (e) {
          switch (e.which) {
            case 13:
              r_modal.find('button[data-type]:visible').click();
              break;
            case 27:
              r_modal.find('button[data-dismiss]:visible').first().click();
              break;
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

      if (flags.indexOf('w') < 0) return;

      renameDialog('create', function (type, done, name, desc) {
        name = (name || '').replace(_TRIM, '');
        desc = (desc || '').replace(_TRIM, '');

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
    menuRename: function (items) {
      var self = this,
        act = self.viewActive,
        flags = act.data('flags'),
        path = act.data('path'),
        o_path = items.data('path'),
        o_name, o_desc;

      if (!o_path || flags.indexOf('w') < 0 || items.length !== 1) return;

      o_name = decodeURIComponent(o_path.split('/').slice(-1)[0]);
      o_desc = flags.indexOf('c') >= 0
             ? items.find('.folder-desc').text() || ''
             : null;

      renameDialog('rename', function (type, done, name, desc) {
        name = (name || '').replace(_TRIM, '');
        desc = (desc || '').replace(_TRIM, '');

        if (!name || name.indexOf('/') >= 0) {
          return done('name');
        }

        function _rename() {
          var n_path;

          if (name === o_name) {
            done();
            if (o_desc != null && o_desc !== desc) {
              self.reloadActive();
            }
            return;
          }

          n_path = o_path.split('/').slice(0, -1).join('/') +'/'+ name;

          self.api.rename(decodeURI(o_path), decodeURI(n_path).replace(/^\//, ''), {
            /* no options */
          }).done(function () {
            done();
            self.reloadActive();
          }).error(function () {
            // TODO: proper error reporting
            done('name');
          });
        }

        if (o_desc != null && o_desc !== desc) {
          self.api.updateFolder(o_path, {
            description: desc
          }).done(function () {
            _rename();

            // Ensure we don't redo this request if error on renaming
            o_desc = desc;
          }).error(function () {
            // TODO: proper error reporting
            done('desc');
          });
        } else {
          _rename();
        }
      }, o_name, o_desc);
    },
    menuDownload: function (items) {
      if (items.length !== 1 || items.data('type') === 'folder' || !items.data('path')) {
        return;
      }
      this.api.getFile(items.data('path'));
    },
    menuArchive: function (items) {
      console.log("get archive");
    },
    itemDelete: function (items) {
      var self = this;

      if (!items || !items.length) return;

      items = items.toArray();

      function next() {
        var item = items.shift();

        if (!item) {
          // TODO: User feedback.
          self.reloadActive();
          return;
        }

        item = $(item);

        if (!item.data('path')) return next();

        self.api.trash('/'+item.data('path')+(item.data('type') === 'folder' ? '/' : ''))
          .complete(next);
      }

      next();
    },
    trashRestore: function (items) {
    },
    trashRemove: function (items) {
      var self = this;

      if (!items || !items.length) return;

      items = items.toArray();

      function next(done) {
        var item = items.shift();

        if (!item) {
          if (typeof done === 'function') done();
          // TODO: User feedback.
          self.reloadActive();
          return;
        }

        item = $(item);

        if (!item.data('trash-id')) return next(done);

        self.api.trashDel(item.data('trash-id'))
          .complete(function () { next(done); });
      }

      self.showConfirm('trash.remove', next);
    },
    trashEmpty: function (items) {
      var self = this;

      self.showConfirm('trash.empty', function (done) {
        self.api.trashEmpty().done(function () {
          if (self.viewActive.data('uid') === 'trash') {
            self.reloadActive();
          }
        }).error(function () {
          // TODO: error feedback
        }).complete(done);
      });
    }
  };

  var MENUCHECK = {
    menuFolderCheck: function (el, selected, noroot) {
      var list = this.viewActive,
          flags = list.data('flags') || '',
          disable = flags.indexOf('w') < 0 || (noroot && flags.indexOf('c') >= 0),
          visible = !(selected && selected.length) && !list.is('#l-trash');

      el.toggle(!!visible);

      el.toggleClass('disabled', !!disable)
        .children('input').prop('disabled', !!disable);
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
    },
    menuTrashCheck: function (el, selected) {
      var visible = this.viewActive.is('#l-trash') && (!selected || !selected.length);
      el.toggle(visible);
    }
  };

  partage.register('browse', function () {
    var View = partage.View;
    var poppingState;

    var api = new partage.Api();

    var browse = new View({
      contextMenu: '#context-menu',
      dropzone: true
    });

    browse.ACTIONS = ACTIONS;
    browse.api = api;

    browse.getSendQueue = function () {
      var self = this;

      if (!self.sendQueue) {
        self.sendQueue = new partage.SendQueue({
          api: api
        });

        var pendingPaths = {};
        self.sendQueue.on('uploaded', function (up, ctx) {
          pendingPaths[up.options.path] = true;
        }).on('error', function (qinfos, xhr) {
          if (xhr.status === 401) {
            qinfos.preventNext = true;
            location.assign(window['PARTAGE_BASEURL']+'/login');
          }
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
          cls: 'subdir'+(last?' menu-last':' act'),
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
        var dom = $('<div/>').html(html),
            list = dom.children('.list-box');

        if (list.length) {
          callback(null, list);
        } else {
          callback({ statusCode: 404, textStatus: 'error', error: 'Not Found' });
        }
      }).fail(function (jqxhr, textStatus, error) {
        callback({ statusCode: jqxhr.statusCode(), textStatus: textStatus, error: error });
      });
    }).on('releaseview', function (view) {
      view.remove(); // Don't keep views in cache.
    }).on('activate', function (listrow) {
      switch (listrow.data('type')) {
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
    }).on('navmenu', function (navitem) {
      this.trigger('action', [ 'contextMenu', navitem ]);
    }).on('delete', function (items) {
      if (this.viewActive.data('uid') !== 'trash') {
        this.trigger('action', [ 'itemDelete', items ]);
      } else {
        this.trigger('action', [ 'trashRemove', items ]);
      }
    }).on('viewmenu', function (menu, selected) {
      var self = this;

      menu.data('path', self.viewActive.data('path'));

      // update visibility status of context items.
      menu.children('li').each(function () {
        var el = $(this),
            check = el.data('check'),
            args = check.split(':');

        check = args[0];
        args = args.slice(1);

        if (MENUCHECK[check]) {
          args.unshift(el, selected);
          MENUCHECK[check].apply(self, args);
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
