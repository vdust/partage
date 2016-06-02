/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

(function ($, window, undefined) {
  'use strict';

  var filehub = window['filehub'];
  if (!filehub) throw Error("filehub is not defined.");

  var View = filehub.View;

  filehub.register('users', function () {
    return new View({
    }).on('update', function (uid) {
      // this == View instance
    });
  });
})(jQuery, window);
