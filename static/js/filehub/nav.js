/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

(function ($, window, undefined) {
  'use strict';

  var filehub = window['filehub'];
  if (!filehub) throw Error("filehub is not defined.");

  var Nav = filehub.createClass('Nav', {
    options: {
      nav: '#nav',
      navPadding: '#nav-padding',
      navPath: '#nav-path',
      navTools: 'nav-tools',
      pathSeparator: '<span class="fa fa-chevron-right"/>'
    },
    _init: function () {
      var self = this,
          opts = self.options;

      $.each(['nav', 'navPadding', 'navPath', 'navTools'], function (i, key) {
        self[key] = $(opts[key]);
      });

      self.navPath.on('click', '.navitem', function (evt) {
        var navitem = $(this),
            handler = navitem.data('handler') || 'navActivate';

        evt.preventDefault();
        evt.stopPropagation();

        self.handle(handler, navitem.closest('.navitem'));
      });
    },
    padding: function (width) {
      this.navPadding.width(w);
    },
    /**
     * update([{ label: '', cls: '', data: { url: 'foo/bar' } }, 'flat'])
     *
     * The array can start with null values to preserve first items in the path
     */
    update: function (path) {
      var self = this,
          items = self.navPath.children().remove(),
          separator = $(self.options.pathSeparator||'<span/>');

      if (!path) {
        path = [];
      } else if (!$.isArray(path)) {
        path = [ path ];
      }

      for (var p, i = 0; i < path; i++) {
        p = path[i];

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

    if (first && separatorObj) {
      separatorObj.clone().appendTo(this);
    }

    $('<span class="navitem"/>')
      .addClass(cls || '')
      .data(data || {})
      .text(label || '')
      .appendTo(this);

    return this;
  };
})(jQuery, window);
