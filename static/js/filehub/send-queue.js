/**
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * License: MIT
 */

(function ($, window, undefined) {
  'use strict';
  
  var filehub = window['filehub'];
  if (!PROD && !filehub) throw Error("filehub is not defined.");

  var SendQueue = filehub.createClass('SendQueue', {
    options: {
      api: null, // default to 'new filehub.Api()'
      container: '#send-queue'
    },
    _init: function () {
      this._queue = [];
    },
    startNext: function () {
      var next = this._queue.shift();
    },
    queue: function (files) {
      if (!files.length) {

      }
    },
  });
}(jQuery, window));
