/* partage
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * ISC Licensed
 */

'use strict';

var expect = require('expect');

describe('REST api:', function () {
  [
    'auth',
    'accounts',
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
