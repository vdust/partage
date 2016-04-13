/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Roussea
 * MIT Licensed
 */

"use strict";

var EventEmitter = require('events');
var fs = require('fs');
var resolve = require('path').resolve;
var util = require('util');

var mime = require('mime-types');

var utils = require('../utils');

var Special = require('./special');

function Trash() {
  Special.apply(this, arguments);
}
util.inherits(Trash, Special);


// Exports
module.exports = Trash;


var proto = Trash.prototype;

proto.list = function list(user, done) {
  var trash = this;
  var items = [];

  fs.readdir(this.path, function (err, files) {
    if (err) { /* assumes trash is empty */
      console.log(err.toString());
      return done(null, items);
    }

    files.forEach(function (f) {
      if (f[0] === '.') return;

      var item = Trash.itemInfos(f);
      var folder;

      if (!item) return; /* malformed file name => Ignore the file */

      if (!user.is('admin')) {
        /* non-admin can't manipulate root folders */
        if (item.isFolder) return;

        /* need write access to view and manipulate trashed files */
        folder = trash._manager.folder(item.folder);
        if (!(folder && folder.canwrite(user))) return;
      }

      items.push(item);
    });

    items.sort(function (a, b) {
      var cmp = utils.compareFileLowerCase(a.name, b.name);
      if (!cmp) {
        cmp = utils.comparePath(a.origin, b.origin);
      }
      return cmp;
    });

    done(null, items);
  });
};

proto.trash = function trash(user, folder, path, cb, type) {
  var trash = this;
  var relPath = folder.getRelativePath(path);
  var e;

  if (!relPath) {
    e = new Error("Invalid path "+path);
    e.status = e.statusCode = 404;
    e.details = {
      code: 'trash.invalid'
    };
  } else if (type !== 'file' && relPath === '.' && !user.is('admin')) {
    e = new Error("Need admin rights to trash a shared folder");
    e.status = e.statusCode = 403;
    e.details = {
      code: 'trash.forbidden'
    };
  } else if (type === 'file' && relPath === '.') {
    e = new Error("Not a file");
    e.status = e.statusCode = 409;
    e.details = {
      code: 'file.isdir',
    };
  }

  if (e) return process.nextTick(cb, e);

  var absPath = folder.getPath(path);

  fs.stat(absPath, function (err, stats) {
    var e, uid, isdir, isfile;

    if (err) {
      if (err.code === 'ENOENT') {
        e = new Error("Resource not found");
        e.status = e.statusCode = 404;
        e.details = {
          code: 'notfound'
        };
      } else {
        console.log(err.toString());
        e = new Error("Unexpected error");
        e.status = e.statusCode = 500;
        e.details = {
          code: 'unexpected'
        };
      }
      return cb(e);
    }

    isdir = stats.isDirectory();
    isfile = stats.isFile();

    if (!isdir && !isfile) {
      e = new Error("Resource not found");
      e.status = e.statusCode = 404;
      e.details = {
        code: 'notfound'
      };
    } else if (type === 'file' && isdir) {
      e = new Error("Not a file");
      e.status = e.statusCode = 409;
      e.details = {
        code: 'file.isdir',
      };
    } else if (type === 'folder' && isfile) {
      e = new Error("Not a directory");
      e.status = e.statusCode = 409;
      e.details = {
        code: 'folder.isfile',
      };
    }

    if (e) return cb(e);

    uid = Trash.itemUid(folder, path, stats.isDirectory());

    fs.rename(absPath, resolve(trash.path, uid), function (err) {
      if (err) {
        console.log(err.toString());
        e = new Error("Unexpected error");
        e.status = e.statusCode = 500;
        e.details = {
          code: 'unexpected'
        };
        return cb(e);
      }

      cb(null, uid);
    });
  });
};

proto.restore = function restore(user, uid, options, cb) {
  var done = cb;
  var opts = options || {};

  if (typeof options === 'function') {
    done = options;
    opts = {};
  }

  /* TODO: restore file */
  done(new Error("Not implemented"));
};


Trash.checkUid = function (itemUid, exc) {
  var decoded = utils.decodeSafeBase64(itemUid);
  var check = utils.encodeSafeBase64(decoded);
  var infos = utils.partition(decoded, ':');
  var path = infos[2] ? infos[2].split('/') : [];
  var name = path.slice(-1)[0];
  var r = (decoded === check && name);

  if (!r && (arguments.length < 2 || exc)) {
    var e = new Error("Trash item uid invalid");
    e.details = {
      code: 'trash.invalid'
    };
    throw e;
  }

  return r;
};

Trash.itemInfos = function (itemUid) {
  var decoded = utils.decodeSafeBase64(itemUid);
  var check = utils.encodeSafeBase64(decoded);
  var infos = utils.partition(decoded, ':');
  var flags = infos[0] || '';
  var path = infos[2] ? infos[2].split('/') : [];
  var name = path.slice(-1)[0];
  var timestamp;

  if (itemUid !== check || !name) return;

  timestamp = flags.split('|');
  flags = timestamp[0];
  timestamp = parseInt(timestamp[1], 36) || 0;

  return {
    uid: itemUid,
    name: name,
    mime: flags[0] === 'd' ? 'inode/directory' : mime.lookup(name),
    timestamp: timestamp,
    folder: path[0],
    isFolder: path.length === 1,
    origin: path.slice(0, -1).join('/')
  };
}

Trash.itemUid = function (folder, path, isDir) {
  var relpath = folder.getRelativePath(true, path);
  var decoded;

  if (!relpath) return;

  decoded = (isDir?'d':'f')+'|'+(new Date()).getTime().toString(36) + ':' + relpath;
  return utils.encodeSafeBase64(decoded);
};
