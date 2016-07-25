/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

(function ($, window, undefined) {
  'use strict';

  var filehub = window['filehub'];
  if (!PROD && !filehub) throw Error("filehub is not defined.");

  var Loader = filehub.createClass('ListLoader', {
    options: {
      container: null
    },
    _init: function () {
      var self = this,
          opts = self.options;

      self.container = $(opts.container||[]);
      self.loader = self.container.children('.list-loader');
      self.hide();
    },
    show: function () {
      this.loader.fadeIn('fast');
    },
    hide: function () {
      this.loader.fadeOut('fast');
    }
  });
})(jQuery, window);
