/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

(function ($, window, undefined) {
  'use strict';

  var filehub = window['filehub'];
  if (!PROD && !filehub) throw Error("filehub is not defined.");

  var Nav = filehub.createClass('Nav', {
    options: {
      nav: '#nav',
      navPadding: '#nav-padding',
      navPath: '#nav-path',
      navTools: '#nav-tools',
      pathSeparator: '<span class="fa fa-chevron-right"/>'
    },
    _init: function () {
      var self = this,
          opts = self.options;

      $.each(['nav', 'navPadding', 'navPath', 'navTools'], function (i, key) {
        self[key] = $(opts[key]);
      });

      self.nav.on('contextmenu', function (e) {
        e.preventDefault();
      });
      self.navPath.on('click', '.navitem', function (evt) {
        var navitem = $(this);

        evt.preventDefault();
        evt.stopPropagation();

        var uid = navitem.data('uid');
        if (uid != null && navitem.hasClass('act')) {
          self.trigger('activate', [''+uid, navitem]);
        } else if (navitem.hasClass('menu-last')) {
          self.trigger('menu', [ navitem ]);
        }
      });

      self.navTools.on('click', '.view-action', function (evt) {
        var act = $(this);
        self.trigger('action', [ act.data('action'), act ]);
      });
    },
    actions: function () {
      return this.navTools.children('.view-action');
    },
    padding: function (width) {
      this.navPadding.width(width);
    },
    /**
     * update([{ label: '', cls: '', data: { uid: 'xxx' } }, 'flat'])
     *
     * The array can start with null values to preserve first items in the path
     */
    update: function (list) {
      var self = this,
          items = self.navPath.children().detach(),
          separator = $(self.options.pathSeparator||'<span/>');

      if (!list) {
        list = [];
      } else if (!$.isArray(list)) {
        list = [ list ];
      }

      for (var i = 0; i < list.length; i++) {
        var p = list[i];

        if (i < items.length) {
          if (p == null) {
            self.navPath.append(items.get(i));
            continue;
          }
          // Only leading items can be preserved
          items = $();
        }

        if (p == null) {
          p = { };
        } else if (typeof p === 'string') {
          p = { label: p };
        }

        $('<li/>')
          .navItem(i == 0, p.label || '-', p.cls || '', p.data || {}, separator)
          .appendTo(self.navPath);
      }
    }
  });

  $.fn.navItem = function (first, label, cls, data, separatorObj) {
    if (typeof first !== 'boolean') {
      data = cls;
      cls = label;
      label = first;
      first = false;
    }

    this.empty();

    if (!first && separatorObj) {
      separatorObj.clone().appendTo(this);
    }

    $('<span class="navitem"/>')
      .addClass(cls || '')
      .data(data || {})
      .text(label || '')
      .append('<span class="fa fa-caret-down"/>')
      .appendTo(this);

    return this;
  };
})(jQuery, window);
