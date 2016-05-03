/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Roussea
 * MIT Licensed
 */

"use strict";

var EventEmitter = require('events');
var fs = require('fs');
var joinPath = require('path').join;
var util = require('util');

var async = require('async');
var mime = require('mime-types');

var utils = require('../utils');
var createError = require('../error').createError;
var notImplemented = require('../error').notImplemented;

var Resource = require('./resource');
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
  var err;

  if (type !== 'file' && resource.relpath === '.' && !user.is('admin')) {
    err = createError(403, 'resource.forbidden', "Need admin rights to trash a shared folder");
  } else if (type === 'file' && resource.relpath === '.') {
    err = createError(409, 'resource.isdir', "The resource is not a file");
  }

  if (err) return process.nextTick(callback, err);

  resource.stat(function (err, stats) {
    var uid;

    if (!err && type && type !== stats.type) {
      if (type === 'file') {
        err = createError(409, 'resource.isdir', "The resource is not a file");
      } else if (type === 'folder') {
        err = createError(409, 'resource.isfile', "The resource is not a directory");
      }
    }

    if (err) return callback(err);

    uid = Trash.itemUid(resource.folder, resource.relpath, stats.type === 'folder');

    fs.rename(resource.abspath, joinPath(trash.abspath, uid), function (err) {
      if (err) {
        console.warn(err.toString());
        return cb(Resource.createError(err));
      }

      callback(null, uid);
    });
  });
};

proto.get = function get(uid, user) {
  var infos = Trash.itemInfos(uid);

  if (!infos) throw createError(400, 'trash.uid.invalid', "Invalid trash item uid");

  var f = this.manager.folder(infos.folder);
  if (!user.is('admin') && (!f || !f.canwrite(user))) {
    throw createError(404, 'trash.uid.notfound', "Item not found");
  }

  return infos;
};

proto.stat = function stat(user, uid, callback) {
  var infos;

  try {
    infos = this.get(uid, user);
  } catch (e) {
    return process.nextTick(callback, e);
  }

  fs.stat(joinPath(this.abspath, uid), function (err, stats) {
    if (err) return callback(Resource.createError.call('trash.uid.', err));
    callback(null, infos);
  });
};

proto.empty = function empty(user, callback) {
  var trash = this;

  this.lock('trash-remove', true, function (err, release) {
    function _done(err) { release(); callback(err); }

    this.scan(user, function (err, items) {
      if (err || !items.length) return _done(err);

      async.eachLimit(items, Resource.asyncLimit, function (item, next) {
        fs.remove(joinPath(trash.abspath, item.uid), function (err) {
          if (err && err.code !== 'ENOENT') {
            console.error("Trash remove error on %s: %s", item.uid, err.toString());
          }
          next();
        });
      }, _done);
    });
  });
};

proto.remove = function remove(user, uid, callback) {
  var infos;

  try {
    infos = this.get(uid, user);
  } catch (e) {
    return process.nextTick(callback, e);
  }

  this.lock('trash-remove', true, function (err, release) {
    fs.remove(joinPath(trash.abspath, uid), function (err) {
      if (err && err.code === 'ENOENT') err = null;

      release();
      callback(err && Resource.createError.call('trash.uid.', err));
    });
  });
};

proto.restore = function restore(user, uid, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  /* TODO: restore file */
  done(notImplemented());
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
