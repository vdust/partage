/* partage
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * ISC Licensed
 */

(function ($, window, undefined) {
  'use strict';

  var partage = window['partage'];
  if (!PROD && !partage) throw Error("partage is not defined.");

  var Loader = partage.createClass('ListLoader', {
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
