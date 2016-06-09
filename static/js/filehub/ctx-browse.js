/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

(function ($, window, undefined) {
  'use strict';

  var filehub = window['filehub'];
  if (!filehub) throw Error("filehub is not defined.");

  filehub.register('browse', function () {
    var View = filehub.View;

    return new View({
    }).on('select', function (uid, item) {
      var navlist = [], tree
      do {
        navlist.unshift({
          label: item.children('.tree-label').text(),
          cls: 'subdir',
          data: { uid: item.data('uid') }
        });

        tree = item.closest('.tree');
        item = tree.prev('.tree-item');
      } while (item.length);
      this.nav.update(navlist);
    });
  });
})(jQuery, window);
