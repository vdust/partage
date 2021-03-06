/* partage
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * ISC Licensed
 */

(function ($, window, undefined) {
  'use strict';

  var partage = window['partage'];
  if (!PROD && !partage) throw Error("partage is not defined.");

  var abs = Math.abs,
      max = Math.max,
      min = Math.min,

      win = $(window),
      doc = $(window.document),

      DZCTX = '.pt-dropzone',

      ROW = 'list-row',
      ROW_SEL = ROW + '-selected',
      ROW_PREV = ROW + '-prev',
      ROW_ORIG = ROW + '-orig',
      ROW_SELC = ROW_SEL + ' ' + ROW_PREV + ' ' + ROW_ORIG,
      ROW_DRAG = ROW + '-dragged',
      DRAG = 'on-drag',
      DZONE = 'view-drop-zone',
      D_COPY = DRAG+'-copy',
      D_HOVER = 'view-droppable-hover';

  var _globalDnDInitialized;
  var _views = {}, _viewId = 0;
  var _onDrag;
  function _dInit(evt) {
    var target = $(evt.target),
        zone = target.closest('.'+DZONE),
        dropId = zone.data('dropId');

    evt.preventDefault();
    evt.stopPropagation();

    return {
      dropId: dropId,
      zone: zone.length ? zone : undefined,
      view: dropId ? _views[dropId] : undefined
    };
  };
  function _updateCtx(evt, onDrag) {
    if (!_onDrag && !onDrag) return;
    if (onDrag) _onDrag = onDrag;

    var target = $(evt.target),
        list = target.closest('.list-box'),
        row = list.length ? target.closest('.'+ROW) : $();

    _onDrag.list = list.length ? list : undefined;
    _onDrag.row = row.length ? row : undefined;
  }

  // XXX Work around the d&d mouse tracking crap for user visual feedback
  function _dragendDetect(e) {
    if (_onDrag) {
      if (!(e.buttons & 1)) {
        _leave(e);
      }
    } else {
      // because of all the nasty corner-cases, we do this check even though
      // if should not happen (doesn't cost much).
      win.off('.ptdragdetect');
    }
  }

  function _leave(evt, skipLeave) {
    if (!_onDrag) return;
    win.off('.ptdragdetect');
    if (!skipLeave) {
      _onDrag.view.trigger('dragleave', [ evt, _onDrag ]);
    }
    _onDrag = undefined;
  }
  function _enter(evt, onDrag) {
    _leave(evt);
    _updateCtx(evt, onDrag);
    if (evt.buttons != null) { // Detection require MouseEvent.buttons
      win.on('mouseover.ptdragdetect', _dragendDetect);
    }
    onDrag.view.trigger('dragenter', [ evt, onDrag ]);
  }
  function setupDnD(view) {
    var vId = 'v'+(++_viewId);
    _views[vId] = view;
    view.viewContents.addClass(DZONE).data('dropId', vId);

    if (_globalDnDInitialized) return;

    // We need to setup a global handler because of inconsistent default
    // behaviour of browsers when dropping files (e.g. images get loaded
    // in Chrome)
    $('html').on('dragover'+DZCTX, function (evt) {
      // Handles as much as possible in dragover to prevent corner cases.
      var row, d = _dInit(evt);

      if (_onDrag) {
        if (!d.zone) {
          _leave(evt);
        } else if (d.dropId != _onDrag.dropId) {
          _enter(evt, d); // trigger dragleave on previous zone automatically.
        } else {
          _updateCtx(evt); // list and row can change.
          _onDrag.view.trigger('dragupdate', [ evt, _onDrag ]);
        }
      } else if (!d.zone || !d.view) {
        return;
      } else {
        _enter(evt, d);
      }
    }).on('dragenter'+DZCTX, function (evt) {
      evt.preventDefault();
      evt.stopPropagation();
    }).on('dragleave'+DZCTX, function (evt) {
      evt.preventDefault();
      evt.stopPropagation();
    }).on('drop'+DZCTX, function (evt) {
      var d = _dInit(evt);

      if (!d.zone || !d.view) return;
      // We need to do this because mouseover is triggered just before
      _updateCtx(evt, d);
      if (_onDrag) {
        _updateCtx(evt);
        _onDrag.view.trigger('drop', [ evt, _onDrag ]);
        _leave(evt, true); // no dragleave event is triggered.
      }
    });

    // FIXME: There is an issue when the cursor is leaving the browser to
    // another window on top of it. Browsers (at least Chrome and Firefox)
    // won't trigger dragleave events in this case. Google Drive seems to
    // know how to handle this case, however, which looks like black magic
    // to me right now. Maybe the right combinations of preventDefault()
    // and stopIteration() in the drag event handlers could do the trick,
    // but i can't figure out how to handle this for now.

    _globalDnDInitialized = true;
  }

  var View = partage.createClass('View', {
    options: {
      listIdPrefix: 'l-',
      listExpire: 300, // 5 minutes
      viewResize: '#view-resize',
      viewContents: '#view-contents',
      confirmDialog: '#confirm_dialog',
      dropzone: false,
      // ctrl = 1, alt = 2, shift = 4
      // { 'keyCode': { 'ctrl|alt|shift': 'eventname' } }
      shortcuts: {
        "65": {
          "1": 'selectall' // ctrl+A
        },
        "46": {
          "0": { // Delete
            eventname: 'delete',
            rows: '.'+ROW_SEL
          }
        },
        "13": {
          "0": { // Enter
            eventname: 'activate',
            rows: '.'+ROW_PREV
          }
        },
        "32": {
          "1": 'cursortoggle' // ctrl+Space
        },
        "38": { // Arrow Up
          "*": {
            eventname: 'cursorprevious',
            mods: true
          }
        },
        "40": { // Arrow Down
          "*": {
            eventname: 'cursornext',
            mods: true
          }
        },
      },
    },
    _init: function () {
      var self = this,
          options = self.options;

      self._body = $(window.document.body);

      self.sidePanel = new partage.Aside(options.aside);
      self.sidePanel.on('select', function () {
        self.trigger('refresh', arguments);
        self.loadTarget.apply(self, arguments);
      }).on('button', function () {
        self.trigger('button', arguments);
      });

      self.nav = new partage.Nav(options.nav);
      self.nav.on('activate', function (uid) {
        self.sidePanel.select(uid);
      }).on('menu', function (navitem) {
        self.trigger('navmenu', [ navitem ]);
      }).on('action', function () {
        self.trigger('action', arguments);
      });

      self.viewResize = $(options.viewResize);
      self.viewContents = $(options.viewContents);
      self.viewActive = self.viewContents.children('.list-box:visible');
      self.loader = new partage.ListLoader({
        container: self.viewContents
      });

      if (options.contextMenu) {
        self.contextMenu = $(options.contextMenu);
        if (!self.contextMenu.length) delete self.contextMenu;
      }

      self.confirmDialog = $(options.confirmDialog).confirmDialog();

      self._initResize();
      self._initShortcuts();
      self._initLists();
      self._initDropZone();
    },
    _initResize: function () {
      var self = this,
          sidePanel = self.sidePanel,
          startWidth, startX,
          handle = self.viewResize.children('.view-handle');

      handle.on('mousedown', function (evt) {
        if (evt.which !== 1) return; // left button only
        startWidth = sidePanel.width();
        startX = evt.pageX;

        win.on('mousemove.resize', function (evt) {
          var dX = evt.pageX - startX;
          var w = max(0, startWidth + dX);
          sidePanel.resize(w); // TODO: SizePanel.resize()
          self.nav.padding(w);
        }).on('mouseup.resize', function (evt) {
          if (evt.which !== 1) return; // left button only
          win.off('.resize');
        });
      });
    },
    showConfirm: function (context, cb) {
      this.confirmDialog.confirmDialog('confirm', context, cb);
    },
    getRows: function (filter) {
      var rows = this.viewActive
        .children('.list')
        .children('.list-body')
        .children('.'+ROW);

      return filter ? rows.filter(filter) : rows;
    },
    getSelected: function () {
      return this.getRows('.'+ROW_SEL);
    },
    _selectFromOrigin: function (row, allrows) {
      var self = this,
          row_i, prev_i, orig_i,
          uStart_i, uEnd_i,
          sStart_i, sEnd_i,
          selected,
          allrows = allrows || self.getRows();

      allrows.each(function (i) {
        var el = $(this);
        if (this === row.get(0)) row_i = i;
        if (el.hasClass(ROW_PREV)) prev_i = i;
        if (el.hasClass(ROW_ORIG)) orig_i = i;
        return !(prev_i >= 0 && orig_i >= 0 && row_i >= 0);
      });

      if (row_i < 0) return; // should not occur (fail safe for debug purposes)

      orig_i = orig_i < 0 ? 0 : orig_i;
      prev_i = prev_i < 0 ? orig_i : prev_i;
      uStart_i = min(orig_i, prev_i);
      uEnd_i = max(orig_i, prev_i);
      sStart_i = min(row_i, orig_i);
      sEnd_i = max(row_i, orig_i);

      allrows.each(function (i) {
        var select;
        if (i >= uStart_i && i <= uEnd_i) select = false;
        if (i >= sStart_i && i <= sEnd_i) select = true;
        if (typeof select === 'boolean') {
          $(this).toggleClass(ROW_SEL, select);
        }
      });

      allrows.removeClass(ROW_PREV);
      row.addClass(ROW_PREV);

      selected = allrows.filter('.'+ROW_SEL);

      self.trigger('select', [ selected ]);

      return selected;
    },
    _updateCursor: function (dir, mod) {
      var self = this,
          row = self.getRows('.'+ROW_PREV),
          first, cur;

      if (!row.length) {
        cur = row = self.getRows(':first');
        if (!row.length) return;
        first = true;
      }

      if (dir) {
        if (!first) {
          cur = row[first || dir < 0 ? 'prev' : 'next']();
          if (!cur.length) cur = row;
        }
      } else {
        if (mod === 1) {
          self.getRows().removeClass(ROW_ORIG+' '+ROW_PREV);
          row.toggleClass(ROW_SEL+' '+ROW_ORIG+' '+ROW_PREV);
          self.trigger('select', [ self.getSelected() ]);
        }
        return;
      }

      if (!mod) {
        self.getRows().removeClass(ROW_SEL+' '+ROW_ORIG+' '+ROW_PREV);
        cur.addClass(ROW_SEL+' '+ROW_ORIG+' '+ROW_PREV);
        self.trigger('select', [ cur ]);
      } else if (mod === 1) { // ctrl
        row.removeClass(ROW_PREV);
        cur.addClass(ROW_PREV);
        // selection don't change here
      } else if (mod === 4) {
        self._selectFromOrigin(cur);
      }
    },
    _initShortcuts: function () {
      var self = this;

      self._scDisabled = 0;
      doc.on('shown.bs.modal shown.ptcontextmenu', function (e) {
        self._scDisabled++;
      }).on('hidden.bs.modal hidden.ptcontextmenu', function (e) {
        self._scDisabled = Math.max(0, self._scDisabled - 1);
      }).on('keydown.list-shortcuts', function (evt) {
        if (self._scDisabled) return; // needed for overlay operations.
        if (self._body.hasClass(DRAG)) return; // ignore shortcuts when d&d
        if ($(evt.target).closest('a,button,input,textarea,.dialog').length) return;

        var shortcuts = self.options.shortcuts,
            mod = partage.modMask(evt),
            key = evt.keyCode || evt.which,
            action, args = [], group;

        group = shortcuts[key];

        if (!group) return;

        action = (mod in group) ? group[mod] : group['*'];
        if (typeof action === 'string') action = { eventname: action };

        if (!action || !action.eventname) return;

        if (action.args) {
          $.merge(args, action.args);
        }
        if (action.mods) {
          args.push(mod);
        }
        if (action.rows != null) {
          args.push(self.getRows(action.rows));
        }

        evt.preventDefault(); // prevent weird side effects
        self.trigger(action.eventname, args);
      });
    },
    _initLists: function () {
      var self = this;

      self.on('selectall', function () {
        var rows = self.getRows();
        rows.removeClass(ROW_ORIG).addClass(ROW_SEL);
        self.trigger('select', [ rows ]);
      }).on('unselectall', function () {
        self.getRows()
          .removeClass(ROW_SEL+' '+ROW_ORIG);
        self.trigger('select', [ $() ]);
      }).on('cursorprevious', function (mod) {
        self._updateCursor(-1, mod);
      }).on('cursornext', function (mod) {
        self._updateCursor(1, mod);
      }).on('cursortoggle', function () {
        self._updateCursor(0, 1);
      });

      self.viewContents.on('mousedown', '.'+ROW, function(evt) {
        if (evt.which !== 1) return; // left button only

        var row = $(this),
            rowWasSelected = row.hasClass(ROW_SEL),
            mod = partage.modMask(evt),
            orig_i = -1, prev_i = -1, row_i = -1,
            uStart_i , uEnd_i,
            sStart_i, sEnd_i,
            list = row.closest('.list'),
            allrows = list.children('.list-body').children('.'+ROW),
            prev = allrows.filter('.'+ROW_PREV),
            orig = allrows.filter('.'+ROW_ORIG),
            selected = allrows.filter('.'+ROW_SEL);

        function updateSimpleSelect(mod) {
          mod = mod||0;

          prev.removeClass(ROW_PREV);
          orig.removeClass(ROW_ORIG);
          prev = orig = row.addClass(ROW_PREV+' '+ROW_ORIG);

          if (!(mod&1)) {
            selected.removeClass(ROW_SEL);
          }

          row.toggleClass(ROW_SEL, (mod&1) ? undefined : true);

          selected = allrows.filter('.'+ROW_SEL);
          self.trigger('select', [ selected ]);
        }

        function initDrag() {
          var droppable = null,
          sX = evt.pageX,
          sY = evt.pageY,
          started, dndbox, dbdcount, rows;

          // check if copy allowed for current list
          doc.on('keydown.viewdrag keyup.viewdrag', function (evt) {
            self._body.toggleClass(D_COPY, evt.ctrlKey);
          });

          win.on('mousemove.viewdrag', function (evt) {
            var target;
            if (!started) {
              started = abs(sX - evt.pageX) + abs(sY - evt.pageY) > 2;
              if (!started) return;
              self._body.addClass(DRAG).toggleClass(D_COPY, evt.ctrlKey);
              selected.addClass(ROW_DRAG);
              dndbox = self._dragInit(row, selected, evt.pageX, evt.pageY);
            }

            if (droppable) droppable.removeClass(D_HOVER);

            target = $(evt.target).closest('.view-droppable');
            target = target.not('.active,.'+ROW_SEL);
            droppable = target.length ? target : null;

            if (droppable) {
              // ensure the drop target is not being dragged in
              dndbox.each(function () {
                var src = $(this).data('dnd-row-src'),
                    t = src.data('target');

                if (t && t === droppable.data('target')) {
                  droppable = null;
                  return false;
                }
              });
              if (droppable) droppable.addClass(D_HOVER);
            }
          }).on('mouseup.viewdrag', function (evt) {
            if (evt.which !== 1) return; // left button only

            selected.removeClass(ROW_DRAG);
            self._body.removeClass(DRAG+' '+D_COPY);

            win.off('.viewdrag');
            doc.off('.viewdrag');

            if (dndbox) dndbox.remove();

            if (droppable) {
              droppable.removeClass(D_HOVER);
              // TODO: handle drop
            } else if (!started && !(mod&4)) {
              updateSimpleSelect();
            }
          });
        }

        if (rowWasSelected && !(mod&1)) initDrag();

        if ((mod&5) === 5) return;
        if (mod&4) {
          selected = self._selectFromOrigin(prev = row, allrows);
        } else if ((mod&1) || !rowWasSelected) {
          updateSimpleSelect(mod);
          if (!(mod&1)) initDrag();
        }
      }).on('dblclick', '.'+ROW, function (evt) {
        self.trigger('activate', [ $(this) ]);
      }).on('mousedown', function (evt) {
        if (evt.which !== 1) return; // left button only
        if ($(evt.target).closest('.'+ROW).length) return;
        self.trigger('unselectall');
      })
      
      if (self.contextMenu) {
        self.contextMenu.contextMenu({
          click: function (e) {
            var action = $(this).data('action');
            if (action) self.trigger('action', [ action ]);
            self.contextMenu.contextMenu('hide');
          }
        });

        self.viewContents.on('contextmenu', function (evt) {
          var mod = partage.modMask(evt),
              row = $(evt.target).closest('.list-row'),
              menu = self._contextMenu;

          if (!mod || (mod & 2)) evt.preventDefault();
          if (mod) return;

          evt.stopPropagation();

          if (!row.hasClass(ROW_SEL)) {
            self.getRows().removeClass(ROW_SELC);
            row.addClass(ROW_SELC);
            self.trigger('select', [ row ]);
          }

          if (!self._contextIsInit) {
            self.trigger('menuinit', [ self.contextMenu.children('ul') ]);
            self._contextIsInit = true;
          }

          self.trigger('viewmenu', [
            self.contextMenu.children('ul'),
            evt.selected || self.getSelected()
          ]);

          self.contextMenu.contextMenu('show', evt);
        });
      }
    },
    _dragRow: function (srcRow, other) {
      var dragRow = $('<div class="dnd-row"/>').toggleClass('dnd-row-other', !!other),
          cell = srcRow.children('.list-cell:eq(0)').children('.list-cell-content'),
          offset, w;

      dragRow.append(cell.clone());
      dragRow.data('dnd-row-src', srcRow);
      this._body.append(dragRow);

      // setup initial position and size
      offset = srcRow.offset();
      w = srcRow.innerWidth();
      dragRow.offset(offset).width(w);

      // TODO: animation

      return dragRow.on('movetopointer.viewdrag', function (evt) {
        var newOff = {
          'left': evt.pageX + 1 + (other ? 3 : 0),
          'top': evt.pageY + 1 + (other ? 3 : 0)
        };
        if (!partage.support.pointerEvents) newOff.left += 20; // IE9- hack
        dragRow.offset(newOff);
      }).get(0);
    },
    _dragInit: function (row, selected, pX, pY) {
      var self = this,
          dndbox = $(),
          mvEvt = $.Event('movetopointer.viewdrag');

      mvEvt.pageX = pX;
      mvEvt.pageY = pY;

      selected.each(function (i) {
        dndbox = dndbox.add(self._dragRow($(this), this !== row.get(0)));
      });
      dndbox.width(0).trigger(mvEvt);
      if (dndbox.length > 1) {
        var count = $('<div class="dnd-count"/>').text(dndbox.length);
        dndbox.not('.dnd-row-other').append(count.hide().fadeIn());
      }
      win.on('mousemove.viewdrag', function (evt) {
        mvEvt.pageX = evt.pageX;
        mvEvt.pageY = evt.pageY;
        dndbox.trigger(mvEvt);
      });
      return dndbox.hide().fadeIn(200);
    },
    _initDropZone: function () {
      var self = this;
      if (!self.options.dropzone) return;
      setupDnD(self);
    },
    reloadActive: function () {
      var self = this,
          uid = self.viewActive.data('uid');

      if (uid == null) return;

      if (self._reloading) {
        if (self._reloadPending) return;
        self._reloadPending = setTimeout(function () {
          delete self._reloadPending;

          if (self.viewActive.data('uid') === uid) {
            self.reloadActive();
          }
        }, 1000);
        return;
      }

      self._reloading = uid;
      self.loadTarget(uid, self.viewActive);
      self.trigger('reload-aside', [ uid ]);
    },
    loadTarget: function (uid, item) {
      var self = this,
          id = self.options.listIdPrefix + uid,
          list = $('#'+id),
          _r = self._reloading;

      if (_r != null && self._loadPendingUid && self._loadPendingUid !== _r) return;

      if (self.viewActive.data('uid') === uid && _r == null) return;

      self.trigger('unselectall');

      self.viewActive.fadeOut('fast', function () {
        self.trigger('releaseview', [ $(this) ]);
      });

      if (list.length && _r == null) {
        self.viewActive = list.fadeIn('fast');
        self.trigger('view', [ self.viewActive ]);
        self.trigger('select', [ $() ]);
        return;
      }
      self.loader.show();
      self.viewActive = $();

      self._loadPendingUid = uid;

      var _once = false;
      function onLoad(err, list) {
        if (self._reloading === uid) {
          self._reloading = null;
        }
        if (_once || self._loadPendingUid !== uid) {
          return; // expired onLoad()
        }
        _once = true;
        self._loadPendingUid = null;

        if (err) {
          // TODO: display loading error message
          return;
        }

        // ensure id is consistent with the one expected
        /* list.attr('id', self.options.listIdPrefix + uid); */
        self.viewActive = list.hide().appendTo(self.viewContents);

        self.trigger('view', [ self.viewActive ]);
        self.trigger('select', [ $() ]);
        self.loader.hide();
        list.fadeIn('fast');
      }

      self.trigger('load', [ uid, item, onLoad ]);
    }
  });
})(jQuery, window);
