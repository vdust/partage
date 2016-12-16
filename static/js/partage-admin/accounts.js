/* partage
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * ISC Licensed
 */

(function ($, window, undefined) {
  'use strict';

  var partage = window['partage'];
  if (!partage) throw Error("partage is not defined.");

  partage.register('accounts', function () {
    var View = partage.View;

    return new View({
    }).on('refresh', function (uid, item) {
      this.nav.update([ null, {
        label: item.children('.tree-label').text(),
        data: { uid: item.data('uid') }
      } ]);
    });
  });
})(jQuery, window);
