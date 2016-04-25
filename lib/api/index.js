/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

"use strict";

var buildAPI = require('./build');

module.exports = exports = function api(manager, app) {
  var api = require('express').Router({
    caseSensitive: true,
    strict: true
  });

  var definitions = [
    'auth',
    'repository',
    'trash',
    'users'
  ];
  var apiDefs = [];

  definitions.forEach(function (src) {
    (require('./definitions/'+src)(manager, app)||[]).forEach(function (def) {
      /* TODO: Validate definition */
      if (def) apiDefs.push(def);
    });
  });

  buildAPI(api, apiDefs);

  return api;
}
