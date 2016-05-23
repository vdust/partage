/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

"use strict";

var resolve = require('path').resolve;
var pathJoin = require('path').join;

var i18n = require('./i18n');

function deprecate(fn) {
  return function () {
    if (fn.name) console.warn("Function %s is deprecated", fn.name);
    return fn.apply(this, arguments);
  }
}

function cleanIterable(iterable) {
  return Array.prototype.filter.call(iterable, function (v) {
    return v !== undefined;
  });
}
function cleanEnumerable() { return cleanIterable.apply(this, arguments); }

function cleanStack(stack) {
  return stack.split('\n').slice(1).map(function (s) {
    return s.trim();
  });
}

function compareFileLowerCase(af, bf) {
  var a = typeof af === 'string' ? af : af.name,
      b = typeof bf === 'string' ? bf : bf.name;
  var ai = a.toLowerCase(), bi = b.toLowerCase();
  return ai < bi ? -1 : (ai > bi ? 1 : (a < b ? -1 : (a > b ? 1 : 0)));
}

function comparePath(p1, p2) {
  var cmp = 0,
      sp1 = p1.split('/'),
      l1 = sp1.length,
      sp2 = p2.split('/'),
      l2 = sp2.length,
      i;
  for (i = 0; !cmp && i < l1 && i < l2; i++) {
    cmp = compareFileLowerCase(sp1[i], sp2[i]);
  }
  return cmp ? cmp : (l1 < l2 ? -1 : (l1 > l2 ? 1 : 0));
}

function pathIn(path, _in) {
  path = path.replace(/\/$/, '').split('/');
  _in = _in.replace(/\/$/, '').split('/');

  if (_in.length >= path.length) return false;

  for (var i = 0; i < _in.length; i++) {
    if (_in[i] !== path[i]) return false;
  }

  return true;
}

function decodeSafeBase64(string, enc) {
  var buffer = new Buffer(string.replace(/_/g, '/').replace(/-/g, '+'), 'base64');
  return buffer.toString(enc||'utf-8');
}

function encodeSafeBase64(string) {
  var buffer = new Buffer(string);
  return buffer.toString('base64').replace(/\//g, '_').replace(/\+/g, '-');
}

function formatSize(size) {
  var s, units = 'ukmgt'.split(''), u = -1;

  do {
    s = size;
    u++;
    size = size / 1024;
  } while (u < units.length - 1 && size > 0.9);

  if (s < 10 && u) {
    s = Math.round(s * 10)/10;
  } else {
    s = Math.round(s);
  }

  return ''+s+' '+i18n.t('filehub.size.'+units[u]);
}

function merge(recursive, dest) {
  var args = Array.prototype.slice.call(arguments, 1);

  if (typeof recursive !== 'boolean') {
    dest = recursive;
    recursive = false;
  } else {
    args.shift();
  }

  args.forEach(function (obj) {
    if (obj === undefined || obj === null) return;
    var v, k, i, keys = Object.keys(obj);
    for (i = 0; i < keys.length; i++) {
      k = keys[i];
      v = obj[k];

      if (!recursive || typeof dest[k] !== 'object' || Array.isArray(dest[k])) {
        dest[k] = null;
      }

      if (!recursive || typeof v !== 'object' || Array.isArray(v) || !dest[k]) {
        dest[k] = v;
      } else {
        merge(true, dest[k], v);
      }
    }
  });

  return dest;
}

function partition(string, sep) {
  var p = string.indexOf(sep);
  if (p < 0) return [ string, '', '' ];
  return [ string.substr(0, p), sep, string.substr(p + sep.length) ];
}

function regexpEscape(string) {
  return string.replace(/([$^\\.(|)\[\]{}*+?])/g, '\\$1');
}

/**
 * makeTree([root,] tree, cb);
 *
 * Create a directories and files.
 *
 * Example:
 *
 *     makeTree('/tmp', {
 *       'file.txt': 'contents',
 *       'data.json': { mtime: new Date(), data: {a: 42 } },
 *       'subdir/': {}
 *     }, (err) => null);
 *
 * @param {Object} tree  files and directories to create.
 *                       Keys contain files and directories names. A directory
 *                       name MUST contain a trailing slash
 *                       Values contain file data or an object describing the
 *                       directory subtree (use an empty object to create an
 *                       empty directory).
 */
function makeTree(root, tree, callback) {
  var async = require('async');
  var fs = require('fs-extra');

  if (typeof root !== 'string') {
    callback = tree;
    tree = root;
    root = '.';
  }

  if (typeof tree !== 'object') {
    throw new TypeError("tree must a an object");
  }

  if (typeof callback !== 'function') {
    throw new TypeError("callback is not a function");
  }

  root = resolve(root);

  var actions = [
    (next) => fs.ensureDir(root, (err) => next(err))
  ];

  var stack = [ { dir: root, tree: tree, keys: Object.keys(tree) } ];
  var current, k, obj, p, data, ts;

  while (stack.length) {
    current = stack.pop();
    /* console.error('>> pop context %s', current.dir); */
    while (current.keys.length) {
      k = current.keys.pop();
      /* console.error('-> pop key %s', k); */
      obj = current.tree[k];
      p = pathJoin(current.dir, k);
      if (k.substr(-1) === '/') {
        if (current.tree.hasOwnProperty(k.slice(0, -1))) {
          throw new Error("Name conflict: '"+k.slice(0, -1)+"' and '"+k+"' defined.");
        }
        /* console.error("-- ensureDir('%s')", p); */
        (function (x) { // Needed to preserve path value
          actions.push((next) => fs.ensureDir(x, (err) => next(err)));
        }(p));
        stack.push(current);
        /* console.error('<< stack context %s', current.dir); */
        current = { dir: p, tree: obj, keys: Object.keys(obj) };
        /* console.error('== new context %s', current.dir); */
      } else {
        if (obj instanceof Buffer || typeof obj !== 'object') {
          obj = { data: obj };
        }

        data = obj.data;

        /* console.error("-- writeFile('%s')", p); */
        if (data instanceof Buffer) {
          actions.push(fs.writeFile.bind(null, p, data));
        } else if (typeof data !== 'string') {
          data = JSON.stringify(data);
        }

        if (typeof data === 'string') {
          actions.push(fs.writeFile.bind(null, p, data, 'utf-8'));
        }

        if (obj.mtime) { // Force mtime/atime
          if (obj.mtime instanceof Date) {
            ts = Math.floor(obj.mtime.getTime()/1000);
          } else {
            ts = +obj.mtime;
          }

          if (ts) actions.push(fs.utimes.bind(null, p, ts, ts));
        }
      }
    }
  }

  async.waterfall(actions, callback);
}

module.exports = {
  cleanEnumerable: deprecate(cleanEnumerable),
  cleanIterable: cleanIterable,
  cleanStack: cleanStack,
  compareFileLowerCase: compareFileLowerCase,
  compareResource: compareFileLowerCase,
  comparePath: comparePath,
  pathIn: pathIn,
  deprecate: deprecate,
  decodeSafeBase64: decodeSafeBase64,
  encodeSafeBase64: encodeSafeBase64,
  formatSize: formatSize,
  merge: merge,
  makeTree: makeTree,
  partition: partition,
  regexpEscape: regexpEscape
};
