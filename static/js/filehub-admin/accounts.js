/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

(function ($, window, undefined) {
  'use strict';

  var filehub = window['filehub'];
  if (!filehub) throw Error("filehub is not defined.");

  filehub.register('accounts', function () {
    var View = filehub.View;

    return new View({
    }).on('select', function (uid, item) {
      this.nav.update([ null, {
        label: item.children('.tree-label').text(),
        data: { uid: item.data('uid') }
      } ]);
    });
  });
})(jQuery, window);
