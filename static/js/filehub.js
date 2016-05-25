/**
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * @license MIT
 */

(function ($, window, undefined) {
  "use strict";

  var baseUrl = window['FILEHUB_BASEURL'] || '';

  /* Picked up from answer to http://stackoverflow.com/questions/7263590/ */
  var pointerEventsSupported = (function(){
    var element = document.createElement('x'),
        documentElement = document.documentElement,
        getComputedStyle = window.getComputedStyle,
        supports;
    if(!('pointerEvents' in element.style)){
        return false;
    }
    element.style.pointerEvents = 'auto';
    element.style.pointerEvents = 'x';
    documentElement.appendChild(element);
    supports = getComputedStyle && 
        getComputedStyle(element, '').pointerEvents === 'auto';
    documentElement.removeChild(element);
    return !!supports;
  })();

  function easeInOutQuad(t, p, dp, d) {
    if (!(d > 0)) return p + dp; /* end position immediately */
    t /= d/2;
    if (t < 1) return p + t * t * dp/2;
    t--;
    return p - (t * (t-2) - 1) * dp/2;
  }

  function messageBoxInit(div, infos, prefix) {
    var title, wrap;
    prefix = prefix||'message';
    div.addClass(prefix+'-box');
    if (!div.children().length) {
      /* message box structure (jade-style):
       *   .#{prefix}-box
       *     .#{prefix}-wrap
       *       .padding-box1
       *       .fixed-box
       *         .info-box
       *           h1
       *           p.note
       *       .padding-box2
       */
      infos = infos||'-';
      title = $('<h1/>').text(typeof infos === 'string' ? infos : (infos.title || '-'));
      infos = infos.message ? $('<p class="note"/>').text(infos.message) : $();
      infos = $('<div class="info-box"/>').append(title, infos);
      wrap = $('<div/>').addClass(prefix+'-wrap');
      wrap.html('<div class="padding-box1"/>'
               +'<div class="fixed-box"/>'
               +'<div class="padding-box2"/>');
      wrap.children('.fixed-box').append(infos);
      div.append(wrap);
    }
    return div;
  }
  function errorBoxInit(div, err) {
    return messageBoxInit(div, {
      title: (err && err.title) || 'Unexpected error',
      message: (err && err.message) || 'An unexpected error occured.'
    }, 'error');
  }

  var init = window['filehubInit'] = function init() {
    var ctx = window['FILEHUB_CTX'];
    if (ctx && typeof (init[ctx]) === 'function') {
      /* explicitly exports for closure */
      window['FILEHUB_OBJ'] = init[ctx]();
    }
  };

  function View(handlers) {
   if (!this._init) return new View(handlers);
   this._init.call(this, handlers);
  }
  init.View = View;
  View.prototype = {
    _init: function (handlers) {
      this._handlers = handlers||{};

      this._body = $(window.document.body);
      this.nav = $('#nav');
      this.navPadding = $('#nav-padding');
      this.navPath = $('#nav-path')
      this.navTools = $('#nav-tools');
      this.sidePanel = $('#view-aside');
      this.buttonBox = this.sidePanel.children('.button-box');
      this.treeBox = this.sidePanel.children('.tree-box');
      this.treeIdPrefix = this.treeBox.data('id-prefix')||'t-';
      this.viewResize = $('#view-resize');
      this.viewContents = $('#view-contents');
      this.currentActive = this.viewContents.children('.list-box:visible');
      this.loader = this.viewContents.children('.list-loader').hide();

      this._initNav();
      this._initResize();
      this._initSidePanel();
      this._initLists();
    },
    _initNav: function () {
      var handler = this._handlers['navInit'];
      if (typeof handler === 'function') handler.call(this);
    },
    _initResize: function () {
      var sidePanel = this.sidePanel,
          navPadding = this.navPadding,
          startWidth, startX,
          handle = this.viewResize.children('.view-handle');
      /* resize side panel */
      handle.on('mousedown', function (evt) {
        if (evt.which !== 1) return; /* left button only */
        startWidth = sidePanel.width();
        startX = evt.pageX;
        $(window).on('mousemove.resize', function (evt) {
          var dX = evt.pageX - startX,
              w = Math.max(0, startWidth + dX);
          sidePanel.width(w);
          navPadding.width(w);
        }).on('mouseup.resize', function (evt) {
          if (evt.which !== 1) return; /* left button only */
          $(window).off('.resize');
        });
      });
    },
    _initSidePanel: function () {
      var self = this;
      self.buttonBox.on('click', 'button', function (evt) {
        var button = $(this),
            handler = button.data('handler');

        if (button.prop('disabled')) return;

        handler = self._handlers[handler];

        if (typeof handler !== 'function') return;

        handler.call(self, self.currentActive);
      });

      self.treeBox.on('click', '.tree-item-subtree > .tree-expand', function (evt) {
        var fa = $(this).children('.fa');
        fa.toggleClass('fa-caret-down fa-caret-right');
        $(this).closest('.tree-item').next('.tree').slideToggle(300);
      }).on('click', '.tree-item', function (evt) {
        var item = $(this);

        if ($(evt.target).closest('.tree-expand').length || item.hasClass('active')) {
          return;
        }

        var targetId = item.data('target'),
            handler = item.data('handler');

        self.loadTarget(targetId, handler, item);
      });
    },
    _treeActivate: function (item) {
      var handler = this._handlers['navUpdate'], p;
      this.treeBox.find('.active').removeClass('active');
      if (item.hasClass('tree-item')) {
        item.addClass('active');
        p = item.parent('.tree');
        while (p.length && !p.is(':visible')) {
          p = p.prev('.tree-item');
          p.children('.tree-expand').click();
          p = p.parent('.tree');
        }
      }
      if (typeof handler === 'function') handler.call(this, item);
    },
    _dndRow: function (srcRow, other) {
      var dndbox = $('<div class="dnd-row"/>').toggleClass('dnd-row-other', !!other),
          cell = srcRow.children('.list-cell:eq(0)').children('.list-cell-content'),
          offset, w;

      dndbox.append(cell.clone());
      dndbox.data('dnd-row-src', srcRow);
      this._body.append(dndbox);

      /* setup initial position and size */
      offset = srcRow.offset();
      w = srcRow.innerWidth();
      dndbox.offset(offset).width(w);

      /* todo: animation */

      dndbox.on('movetopointer.viewdnd', function (evt) {
        var newOff = {
          'left': evt.pageX + 1 + (other ? 3 : 0),
          'top': evt.pageY + 1 + (other ? 3 : 0)
        };
        if (!pointerEventsSupported) newOff.left += 20; /* IE9- hack */
        dndbox.offset(newOff);
      });
      return dndbox.get(0);
    },
    _dndInit: function (row, selected, pX, pY) {
      var self = this,
          dndbox = $(),
          mvEvt = $.Event('movetopointer.viewdnd');

      mvEvt.pageX = pX;
      mvEvt.pageY = pY;

      selected.each(function (i) {
        dndbox = dndbox.add(self._dndRow($(this), this !== row.get(0)));
      });
      dndbox.width(0).trigger(mvEvt);
      if (dndbox.length > 1) {
        var count = $('<div class="dnd-count"/>').text(dndbox.length);
        dndbox.not('.dnd-row-other').append(count.hide().fadeIn());
      }
      $(window).on('mousemove.viewdnd', function (evt) {
        mvEvt.pageX = evt.pageX;
        mvEvt.pageY = evt.pageY;
        dndbox.trigger(mvEvt);
      });
      return dndbox.hide().fadeIn(200);
    },
    _initLists: function () {
      var self = this;

      $(window.document).on('keydown.list-shortcuts', function (evt) {
        if (self._body.hasClass('on-drag')) return; /* ignore shortcuts */
        if ($(evt.target).closest('button,input,textarea').length) return;

        var ctrl = evt.ctrlKey,
            alt = evt.altKey,
            shift = evt.shiftKey;

        switch (evt.keyCode || evt.which) {
          case 65: /* A */
            if (ctrl && !alt) self.selectAll();
            break;
          case 46: /* Delete */
            self.deleteSelected();
            break;
          case 13: /* Enter */
            self.activateSelected();
            break;
        }
      });

      self.viewContents.on('mousedown', '.list-row', function (evt) {
        if (evt.which !== 1) return; /* left button only */
        var row = $(this),
            rowWasSelected = row.is('.list-row-selected'),
            ctrl = evt.ctrlKey,
            shift = evt.shiftKey,
            orig_i = -1, last_i = -1, row_i = -1,
            ustart_i, uend_i,
            sstart_i, send_i,
            list = row.closest('.list'),
            group = list.children('.list-group'),
            allrows = group.children('.list-row'),
            last = allrows.filter('.list-row-last'),
            orig = allrows.filter('.list-row-orig'),
            selected = allrows.filter('.list-row-selected');

        function updateSimpleSelect(_ctrl) {
          last.removeClass('list-row-last');
          orig.removeClass('list-row-orig');
          row.addClass('list-row-last list-row-orig');
          if (!_ctrl) {
            selected.removeClass('list-row-selected');
          }
          row.toggleClass('list-row-selected', ctrl ? undefined : true);

          self.updateTools(allrows.filter('.list-row-selected'));
        }

        function initDnD() {
          var droppable = null,
              sX = evt.pageX,
              sY = evt.pageY,
              started, dndbox, dndcount, rows;

          /* check if copy allowed for current list */
          $(window.document).on('keydown.viewdnd', function (evt) {
            self._body.toggleClass('on-drag-copy', evt.ctrlKey);
          }).on('keyup.viewdnd', function (evt) {
            self._body.toggleClass('on-drag-copy', evt.ctrlKey);
          });

          $(window).on('mousemove.viewdnd', function (evt) {
            var target;
            if (!started) {
              started = Math.abs(sX - evt.pageX) + Math.abs(sY - evt.pageY) > 2;
              if (!started) return;
              self._body.addClass('on-drag').toggleClass('on-drag-copy', evt.ctrlKey);
              selected.addClass('list-row-dragged');
              dndbox = self._dndInit(row, selected, evt.pageX, evt.pageY);
            }

            if (droppable) droppable.removeClass('view-droppable-hover');

            target = $(evt.target).closest('.view-droppable');
            target = target.not('.active,.list-row-selected');
            droppable = target.length ? target : null;

            if (droppable) {
              /* ensure the drop target is not being dragged in */
              dndbox.each(function () {
                var src = $(this).data('dnd-row-src'),
                    t = src.data('target');

                if (t && t === droppable.data('target')) {
                  droppable = null;
                  return false;
                }
              });
              if (droppable) droppable.addClass('view-droppable-hover');
            }
          }).on('mouseup.viewdnd', function (evt) {
            if (evt.which !== 1) return; /* left button only */
            selected.removeClass('list-row-dragged');
            self._body.removeClass('on-drag on-drag-copy');

            $(window).off('.viewdnd');
            $(window.document).off('.viewdnd');

            if (dndbox) dndbox.remove();

            if (droppable) {
              droppable.removeClass('view-droppable-hover');
              /* handle drop */
            } else if (!started && !shift) {
              updateSimpleSelect();
            }
          });
        }

        if (rowWasSelected && !ctrl) initDnD();

        if (shift && ctrl) return;
        if (shift) {
          allrows.each(function (i) {
            var el = $(this);
            if (this === row.get(0)) row_i = i;
            if (el.hasClass('list-row-last')) last_i = i;
            if (el.hasClass('list-row-orig')) orig_i = i;
            return !(last_i >= 0 && orig_i >= 0 && row_i >= 0);
          });

          if (row_i < 0) return; /* should not occur */

          orig_i = orig_i < 0 ? 0 : orig_i;
          last_i = last_i < 0 ? orig_i : last_i;
          ustart_i = Math.min(orig_i, last_i);
          uend_i = Math.max(orig_i, last_i);
          sstart_i = Math.min(row_i, orig_i);
          send_i = Math.max(row_i, orig_i);

          allrows.each(function (i) {
            var select;
            if (i >= ustart_i && i <= uend_i) select = false;
            if (i >= sstart_i && i <= send_i) select = true;
            if (typeof select === 'boolean') {
              $(this).toggleClass('list-row-selected', select);
            }
          });

          last.removeClass('list-row-last');
          row.addClass('list-row-last');

          selected = allrows.filter('.list-row-selected');
          self.updateTools(selected);
        } else if (ctrl || !rowWasSelected) {
          updateSimpleSelect(ctrl);
        }
      }).on('dblclick', '.list-row', function (evt) {
        self.activateSelected($(this));
      }).on('mousedown', function (evt) {
        if (evt.which !== 1) return; /* left button only */
        var group;
        if ($(evt.target).closest('.list-row').length) return;
        group = self.currentActive.children('.list').children('.list-group');
        group.children('.list-row-selected').removeClass('list-row-selected');
        group.children('.list-row-last').removeClass('list-row-last');
        self.updateTools($());
      });
    },
    _listHandler: function (src, data, _default) {
      var list = src.closest('.list'), handler;
      if (!list.length) return;
      handler = this._handlers[list.data(data) || _default];
      return typeof handler === 'function' ? handler.bind(this) : null;
    },
    treeItemFromTargetId: function (targetId) {
      return $(document.getElementById(this.treeIdPrefix+targetId));
    },
    loadTarget: function (targetId, handler, activator) {
      var self = this,
          target = targetId ? $(document.getElementById(targetId)) : null;
      if (target && !target.length) target = null;

      handler = self._handlers[handler];

      if (target) {
        self.unselectAll();
        self.currentActive.fadeOut(200);
        self.currentActive = target;
        target.fadeIn(200);
      } else if (typeof handler === 'function') {
        self.unselectAll();
        self.currentActive.fadeOut(200);
        self.loader.fadeIn(200);
        handler(activator, function (html, err) {
          var div = $('<div/>');
          self.loader.fadeOut(200);
          /* we try to load html in all cases, since it can contain error
           * infos instead of list data */
          div.html(html||'');
          target = div.children('.list-box:eq(0)');
          if (targetId) target.attr('id', targetId);
          if (target.length) {
            self.currentActive = target;
            self.viewContents.append(target.hide().fadeIn(200));
          } else {
            /* handler can return error data as html */
            self.viewContents.children('.error-box').remove();
            self.currentActive = errorBoxInit(div, err);
            self.viewContents.append(div);
          }
        });
      } else {
        console.error("Unbound tree item (unknown target, no handler)");
        return;
      }

      self._treeActivate(activator);
    },
    updateTools: function (selected) {
      var type, list = selected.closest('.list-box');
      selected.each(function () {
        var el = $(this),
            _type = el.data('type');
        type = !type || type === _type ? _type : '_mixed_';
        return _type !== '_mixed_';
      });
      this.navTools.children('.view-action').each(function () {
        var act = $(this),
            l = selected.length,
            show = false,
            sel = act.data('select'),
            atype = act.data('type').split('|'),
            filter = atype[1];
        atype = atype[0];

        if (!filter || list.is(filter)) {
          show = !sel
              || ((!atype || atype === '*' || atype === type)
               && (sel === 'always'
                || (l > 0 && sel === 'multi') 
                || (l == 1 && sel === 'single')
               )
              );
        }
        act.toggle(show);
      });
    },
    treeGetPathTo: function (item) {
      /* return a jQuery object that contains all items in the path down to the
       * provided item */
      var result = [], tree, up = $(item);
      while (up.length && up.hasClass('tree-item')) {
        result.unshift(up.get(0));
        tree = up.parent('.tree');
        up = tree.prev('.tree-item');
      }
      return $(result);
    },
    getSelected: function () {
      return this.currentActive
        .children('.list')
        .children('.list-group')
        .children('.list-row-selected');
    },
    getAll: function () {
      return this.currentActive
        .children('.list')
        .children('.list-group')
        .children('.list-row');
    },
    rowActivateHandler: function (src) {
      return this._listHandler(src, 'row-activate', 'rowActivate');
    },
    rowDeleteHandler: function (src) {
      return this._listHandler(src, 'row-delete', 'rowDelete');
    },
    activateSelected: function (forcerow) {
      var row = (forcerow || this.getSelected()).eq(0),
          handler = this.rowActivateHandler(row);

      if (!row.length || !handler) return;

      handler(row);
    },
    selectAll: function () {
      var all = this.getAll().addClass('list-row-selected');
      all.removeClass('list-row-last list-row-orig');
      all.eq(0).addClass('list-row-orig');
      all.eq(-1).addClass('list-row-last');
      this.updateTools(all);
    },
    unselectAll: function () {
      var all = this.getAll().removeClass('list-row-selected');
      all.removeClass('list-row-last list-row-orig');
      all.eq(0).addClass('list-row-orig list-row-last');
      this.updateTools($());
    },
    deleteSelected: function () {
      var selected = this.getSelected(),
          handler = this.rowDeleteHandler(selected);

      if (!selected.length) return;

      handler = handler || function (rows, done) { done(); };

      handler(rows, function (err, undo) {
        if (err) {
          /* TODO: user feedback */
          return;
        }

        selected.remove();

        if (typeof undo === 'function') {
          /* TODO: user feedback to undo removal */
          return;
        }
      });
    }
  };

  init['browse'] = function () {
    var handlers = {};
    handlers['rowActivate'] = function (row) {
      /* assumes row exist. (checked by caller) */
      var type, item, target;
      if (row.hasClass('tree-item')) {
        type='folder';
      } else {
        type = row.data('type');
      }
      target = row.data('target');
      switch (type) {
        case 'folder':
          item = this.treeItemFromTargetId(target);
          if (!item.length) item = row;
          this.loadTarget(target, 'folderQuery', item);
          break;
        case 'file':
          /* download / preview file */
          break;
      }
    };
    handlers['folderQuery'] = function (activator, done) {
      $.get(baseUrl+'/'+activator.data('url'), { 'list-only': 1 }, function (data, st) {
        done(data);
      }).fail(function () {
        console.log(arguments);
        done('', {
          title: "Resource unavailable",
          message: "failed to retrieve the requested resource."
        });
      });
    }
    handlers['navUpdate'] = function (item) {
      var url = item.data('url').split('/'), c, p = [],
          base, li, fa, navitem,
          items = this.navPath.children(), path;
      items.remove();
      items = items.eq(0);
      this.navPath.append(items); /* reinject 'Folders' or specials */
      items.children('.navitem').data('path', '');
      path = this.treeGetPathTo(item);
      if (path.length) {
        path = path.eq(0);
        items.children('.navitem').text(path.children('.tree-label').text());
      }
      url.shift();
      base = items.children('.navitem').data('base-url');
      while (c = url.shift()) {
        c = decodeURIComponent(c);
        if (c[0] === '.') {
          items.children('.navitem').data('path', c);
          return; /* special paths are applied on root element */
        }
        p.push(c);
        li = $('<li/>');
        fa = $('<span class="fa fa-chevron-right"/>').appendTo(li);
        navitem = $('<span class="navitem subdir"/>').appendTo(li);
        navitem.data('base-url', base).data('path', p.join('/'));
        navitem.text(c);
        this.navPath.append(li);
      }
    }
    return new View(handlers);
  };

  function Profile(handlers) {
    if (!this._init) return new View(handlers);
    this._init.call(this, handlers);
  }
  init.Profile = Profile;

  Profile.prototype = {
    _init: function (handlers) {
      this._handlers = handlers;
    }
  };

  init['profile'] = function () {
    var handlers = {};
    return new Profile(handlers);
  };

  $(init);
})(jQuery, window);
