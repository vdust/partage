/* partage
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * ISC Licensed
 */

'use strict';

module.exports = {
  path: comparePath,
  pathIn: pathIn,
  resource: compareResource
};


function comparePath(path1, path2) {
  var cmp = 0,
  split1 = path1.split('/'),
  len1 = split1.length,
  split2 = path2.split('/'),
  len2 = split2.length,
  i = 0;

  for (; !cmp && i < len1 && i < len2; i++) {
    cmp = compareResource(split1[i], split2[i]);
  }

  return cmp ? cmp : (len1 < len2 ? -1 : (len1 > len2 ? 1 : 0));
}

function compareResource(resource1, resource2) {
  var a = typeof resource1 === 'string' ? resource1 : resource1.name,
      b = typeof resource2 === 'string' ? resource2 : resource2.name,
      ai = a.toLowerCase(), bi = b.toLowerCase();

  return ai < bi ? -1 : (ai > bi ? 1 : (a < b ? -1 : (a > b ? 1 : 0)));
}

function pathIn(strict, path, _in) {
  if (typeof strict !== 'boolean') {
    _in = path;
    path = strict;
    strict = true;
  }

  path = path.replace(/\/+$/, '').split('/');
  _in = _in.replace(/\/$/, '').split('/');

  var pathlen = path.length, inlen = _in.length;

  if (inlen > pathlen || strict && inlen === pathlen) return false;

  for (var i = 0; i < inlen; i++) {
    if (_in[i] !== path[i]) return false;
  }

  return true;
}
