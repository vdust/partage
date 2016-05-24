/*!
 *
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

'use strict';

module.exports = {
  safeDecode: safeDecode,
  safeEncode: safeEncode
};

var _safe = { '/': '_', '+': '-', '_': '/', '-': '+' };
var _safeSub = (m) => _safe[m] || m;

function safeDecode(string, enc) {
  var buffer = new Buffer(string.replace(/[_-]/g, _safeSub), 'base64');
  return buffer.toString(enc||'utf-8');
}

function safeEncode(string, enc) {
  var buffer = new Buffer(string, enc||'utf-8');
  return buffer.toString('base64').replace(/[\/+]/g, _safeSub);
}
