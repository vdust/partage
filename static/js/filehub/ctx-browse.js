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
    }).on('update', function (uid) {
    });
  });
})(jQuery, window);
