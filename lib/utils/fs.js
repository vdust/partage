/* partage
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * ISC Licensed
 */

'use strict';

var fs = require('fs-extra');
var path = require('path');

var async = require('async');

module.exports = {
  makeTree: makeTree
};

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
  if (typeof root !== 'string') {
    callback = tree;
    tree = root;
    root = '.';
  }

  if (typeof tree !== 'object') {
    throw new TypeError("tree must be an object");
  }

  if (typeof callback !== 'function') {
    throw new TypeError("callback must be a function");
  }

  root = path.resolve(root);

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
      p = path.join(current.dir, k);
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
