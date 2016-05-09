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
    'users',
    'repo',
    'repo-folder',
    'repo-files',
    'repo-dirs',
    'trash'
  ].forEach(function (a) {
    if (!a) return;
    require('./_api/'+a);
  });
});
