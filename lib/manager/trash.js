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
var createError = require('../error').createError;

var Special = require('./special');

function Trash() {
  Special.apply(this, arguments);
}
util.inherits(Trash, Special);


// Exports
module.exports = Trash;


var proto = Trash.prototype;

proto.scan = function scan(user, callback) {
  var trash = this;
  var items = [];

  var done = this._ctlSharedAction('scan', callback);

  if (!done) return;

  fs.readdir(this.abspath, function (err, files) {
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
        folder = trash.manager.folder(item.folder);
        if (!(folder && folder.canwrite(user))) return;
      }

      items.push(item);
    });

    items.sort(function (a, b) {
      return utils.compareFileLowerCase(a.name, b.name)
          || utils.comparePath(a.origin, b.origin);
    });

    done(null, items);
  });
};
proto.list = proto.scan;

proto.trash = function trash(user, resource, callback, type) {
  var trash = this;
  var relPath = folder.getRelativePath(path);
  var err;

  if (type !== 'file' && resource.relpath === '.' && !user.is('admin')) {
    err = createError(403, 'trash.forbidden', "Need admin rights to trash a shared folder");
  } else if (type === 'file' && resource.relpath === '.') {
    err = createError(409, 'resource.isdir', "The resource is not a file");
  }

  if (err) return process.nextTick(callback, err);

  resource.stat(function (err, stats) {
    var uid, isdir, isfile;

    if (!err) {
      isdir = stats.isDirectory();
      isfile = stats.isFile();

      if (!isdir && !isfile) {
        err = createError(404, 'resource.notfound', "Resource not found");
      } else if (type === 'file' && isdir) {
        err = createError(409, 'resource.isdir', "The resource is not a file");
      } else if (type === 'folder' && isfile) {
        err = createError(409, 'resource.isfile', "The resource is not a directory");
      }
    }
    if (err) return callback(err);

    uid = Trash.itemUid(folder, path, stats.isDirectory());

    fs.rename(resource.abspath, resolve(trash.abspath, uid), function (err) {
      if (err) {
        console.warn(err.toString());
        return cb(Resource.createError(err));
      }

      callback(null, uid);
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


Trash.checkUid = function (itemUid, errMerge) {
  var decoded = utils.decodeSafeBase64(itemUid);
  var check = utils.encodeSafeBase64(decoded);
  var infos = utils.partition(decoded, ':');
  var path = infos[2] ? infos[2].split('/') : [];
  var name = path.slice(-1)[0];

  if (decoded !== check || !name) {
    throw createError(400, 'trash.uid.invalid', "Invalid trash item uid", errMerge);
  }
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
