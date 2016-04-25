/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

'use strict';

var expect = require('expect');

describe('REST api:', function () {
  [
    'auth',
    'users'
  ].forEach(function (a) {
    if (!a) return;
    require('./_api/'+a);
  });
});
