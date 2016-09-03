/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Roussea
 * MIT Licensed
 */

"use strict";

var EventEmitter = require('events');
var fs = require('fs-extra');
var pathJoin = require('path').join;
var dirname = require('path').dirname;
var basename = require('path').basename;
var util = require('util');

var async = require('async');
var mime = require('mime-types');

var merge = require('../utils').merge;
var partition = require('../utils').partition;
var b64 = require('../utils/base64');
var compare = require('../utils/compare');
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
        /* non-admin can't manipulate shared folders */
        if (item.isFolder) return;

        /* need write access to view and manipulate trashed files */
        folder = trash.manager.folder(item.folder);
        if (!(folder && folder.canwrite(user))) return;
      }

      items.push(item);
    });

    items.sort(function (a, b) {
      return compare.resource(a, b) || compare.path(a.origin, b.origin);
    });

    done(null, items);
  });
};
proto.list = proto.scan;

proto.trash = function trash(user, resource, callback, type) {
  var trash = this;
  var err;

  if (type !== 'file' && resource.isFolder() && !user.is('admin')) {
    err = createError(403, 'resource.forbidden', "Need admin rights to trash a shared folder");
  } else if (type === 'file' && resource.isFolder()) {
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

    fs.rename(resource.abspath, pathJoin(trash.abspath, uid), function (err) {
      if (err) {
        return cb(Resource.createError(err));
      }

      if (resource.isFolder()) {
        resource.folder.emit('trash');
      }

      callback(null, uid);
    });
  });
};

proto.get = function get(uid, user) {
  var infos = Trash.itemInfos(uid);

  if (!infos) throw createError(400, 'trash.uid.invalid', "Invalid trash item uid");

  var f = this.manager.folder(infos.folder);
  if (!user.is('admin') && (!f || !f.canwrite(user) || infos.isFolder)) {
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

  fs.stat(pathJoin(this.abspath, uid), function (err, stats) {
    if (err) return callback(Resource.createError.call('trash.uid.', err));
    callback(null, infos);
  });
};

proto.empty = function empty(user, callback) {
  var trash = this;

  this.lock('trash', true, function (err, release) {
    function _done(err) { release(); callback(err); }

    trash.scan(user, function (err, items) {
      if (err || !items.length) return _done(err);

      async.eachLimit(items, Resource.asyncLimit, function (item, next) {
        fs.remove(pathJoin(trash.abspath, item.uid), function (err) {
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
  var trash = this;
  var infos;

  try {
    infos = this.get(uid, user);
  } catch (e) {
    return process.nextTick(callback, e);
  }

  this.lock('trash', true, function (err, release) {
    fs.remove(pathJoin(trash.abspath, uid), function (err) {
      if (err && err.code === 'ENOENT') err = null;

      release();
      callback(err && Resource.createError.call('trash.uid.', err));
    });
  });
};

proto.restore = function(user, uid, options, callback) {
  var trash = this;
  var manager = trash.manager;

  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  if (!options.hasOwnProperty('rename')) options.rename = true;

  var lock;
  if (options.reentrant) {
    lock = process.nextTick.bind(process);
  } else {
    lock = this.lock.bind(this, 'trash', true);
  }

  lock((err, release) => {
    if (err) return callback(err);

    var origin, src;

    async.waterfall([
      trash.stat.bind(trash, user, uid),
      (infos, next) => {
        origin = (infos.origin + '/' + infos.name).replace(/^\//, '');
        var dest = manager.resource(options.path || origin, true);

        origin = manager.resource(origin, true);
        src = trash.root.resource(uid);
        src._isFolderProxy = () => origin.isFolder();

        var err;

        if (dest.isFolder() && !user.is('admin')) {
          err = createError(403, 'trash.forbidden',
            "Can't restore resource as a shared folder");
        }

        if (!err && origin.isFolder() !== dest.isFolder()) {
          err = createError(409, 'trash.conflict',
            origin.isFolder()
              ? "Must restore a shared folder as a shared folder"
              : "Can't restore resource as a shared folder");
        }

        if (err) {
          dest.unref();
          return next(err);
        }

        if (dest.isFolder()) {
          var foldLock;

          // Replacing a shared folder can't be implicit.
          delete options.replace;
          delete options.parents;

          if (options.reentrant) {
            foldLock = process.nextTick.bind(process);
          } else {
            foldLock = manager.lock.bind(manager, 'folderedit', true);
          }
          // We need to prevent concurrent editions on folders at this point.
          foldLock(function (err, _release) {
            if (err) {
              dest.unref();
              return next(err);
            }

            // We can now have 2 locks to release.
            // Ensure we transparently do both at the end.
            if (_release) {
              if (release) {
                var chainRelease = release;
                release = (() => {
                  _release();
                  chainRelease();
                });
              } else {
                release = _release;
              }
            }

            next(null, dest);
          });
        } else {
          process.nextTick(next, null, dest);
        }
      },
      (dest, next) => {
        src.rename(user, dest, {
          rename: options.rename,
          resource: manager.resource.bind(manager, true),
          replace: options.replace ? {
            trash: trash.trash.bind(trash),
            restore: (u, uid, opts, cb) => {
              var o = {
                reentrant: true,
                rename: false,
                replace: true
              };

              if (typeof opts === 'function') {
                cb = opts;
              }

              trash.restore(u, uid, o, cb);
            }
          } : null,
          parents: options.parents
        }, (err, i, d, r) => {
          if (err) {
            dest.unref();
            next(err);
          } else {
            d.ref();
            dest.unref();
            next(err, i, d, r);
          }
        });
      }
    ], (err, infos, dest, replaced) => {
      if (src) src.unref();
      if (origin) origin.unref();

      release();

      callback.apply(null, err ? [ err ] : [ null, dest, replaced ]);

      if (dest) dest.unref();
    });
  });
};

Trash.checkUid = function (itemUid, errMerge) {
  var decoded = b64.safeDecode(itemUid);
  var check = b64.safeEncode(decoded);
  var infos = partition(decoded, ':');
  var path = infos[2] ? infos[2].split('/') : [];
  var name = path.slice(-1)[0];

  if (itemUid !== check || !name) {
    throw createError(400, 'trash.uid.invalid', "Invalid trash item uid", errMerge);
  }
};

Trash.itemInfos = function (itemUid) {
  var decoded = b64.safeDecode(itemUid);
  var check = b64.safeEncode(decoded);
  var infos = partition(decoded, ':');
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
    type: flags[0] === 'd' ? 'folder' : 'file',
    mime: flags[0] === 'd' ? 'inode/directory' : mime.lookup(name),
    timestamp: timestamp,
    folder: path[0],
    isFolder: path.length === 1,
    origin: path.slice(0, -1).join('/')
  };
}

Trash.itemUid = function itemUid(folder, path, isDir) {
  var relpath = folder.getRelativePath(true, path);

  if (!relpath) return;

  return Trash.buildUid(isDir, new Date(), relpath);
};

Trash.buildUid = function buildUid(isDir, date, relpath) {
  var decoded = (isDir?'d':'f')+'|' + date.getTime().toString(36) + ':' + relpath;

  return b64.safeEncode(decoded);
}
