/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

(function ($, window, undefined) {
  'use strict';

  var filehub = window['filehub'];
  if (!filehub) throw Error("filehub is not defined.");

  var View = filehub.createClass('View', {
    options: {
      viewResize: '#view-resize',
      viewContents: '#view-contents'
    },
    _init: function () {
      var self = this;

      self._body = $(window.document.body);

      self.sidePanel = new filehub.Aside(self.options.aside);
      self.sidePanel.on('select', function () {
        self.loadTarget.apply(self, arguments);
      });

      self.nav = new filehub.Nav(self.options.nav);
      self.nav.on('activate', function (uid) {
        self.sidePanel.select(uid);
      });

      self.viewResize = $('#view-resize');
      self.viewContents = $('#view-contents');
      self.viewActive = self.viewContents.children('.list-box:visible');
      self.loader = new filehub.ListLoader({
        container: self.viewContents
      });

      self._initResize();
      self._initLists();
    },
    _initResize: function () {
      var self = this,
          sidePannel = self.sidePanel,
          nav = self.nav,
          startWidth, startX,
          handle = self.viewResize.children('.view-handle');

      handle.on('mousedown', function (evt) {
        if (evt.which !== 1) return; // left button only
        startWidth = sidePanel.width();
        startX = evt.pageX;

        $(window).on('mousemove.resize', function (evt) {
          var dX = evt.pageX - startX;
          w = Math.max(0, startWidth + dX);
          sidePanel.resize(w); // TODO: SizePanel.resize()
          nav.padding(w);
        }).on('mouseup.resize', function (evt) {
          if (evt.which !== 1) return; // left button only
          $(window).off('.resize');
        });
      });
    },
    _initLists: function () {

    },
    loadTarget: function (uid, item) {
    }
  });
})(jQuery, window);
