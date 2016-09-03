/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

"use strict";

var crypto = require('crypto');
var EventEmitter = require('events');
var fs = require('fs-extra');
var _path = require('path');
var resolve = _path.resolve;
var basename = _path.basename;
var dirname = _path.dirname;
var joinPath = _path.join;
var util = require('util');

var async = require('async');
var mime = require('mime-types');

var error = require('../error');
var merge = require('../utils').merge;
var compare = require('../utils/compare');

var ctlInit = require('./ctl');

var freeze = typeof Object.freeze === 'function' ? Object.freeze : Object;

function Resource() {
  EventEmitter.call(this);
  Resource.prototype._create.apply(this, arguments);
}
util.inherits(Resource, EventEmitter);

Resource.asyncLimit = 4;

// Exports
module.exports = Resource;


var proto = Resource.prototype;

function initRef(resource) {
  var ref = 0;

  resource.ref = function (callback) {
    if (ref < 0) {
      throw new Error("Resource expired ["+this.path+"]");
    }
    ref++;

    return typeof callback === 'function' ? function () {
      var r = callback.apply(this, arguments);
      resource.unref();
      return r;
    } : resource;
  };

  resource.unref = function () {
    if ((--ref) > 0) return;
    if (ref === 0) resource.emit('release');
    ref = -1;
  };
}

proto._create = function _create(folder, path) {
  var p = folder.pathRelative(path);

  if (!p) {
    throw error.createError(400, 'resource.invalid', "Invalid path "+p);
  }

  var resource = this;
  Object.defineProperties(this, {
    folder: {
      configurable: true,
      enumerable: true,
      writable: false,
      value: folder
    },
    relpath: {
      enumerable: true,
      writable: false,
      value: p
    },
    name: {
      configurable: true,
      enumerable: true,
      writable: false,
      value: p === '.' ? folder.name : basename(p)
    },
    path: {
      enumerable: true,
      get: function () {
        return joinPath(resource.folder.name, resource.relpath);
      }
    },
    uid: {
      enumerable: true,
      writable: false,
      value: Resource.pathUid(folder, p)
    },
    abspath: {
      enumerable: true,
      get: function () {
        return joinPath(resource.folder.abspath, resource.relpath);
      }
    }
  });

  initRef(this);
  ctlInit(this);
};

proto.expire = function expire(onRelease) {
  if (onRelease) this.once('release', onRelease);
  this.emit('expire');
};

// To be overridden for special cases like move from trash operations
// where this.relpath doesn't mean the same thing.
proto._isFolderProxy = null;
proto.isFolder = function isFolder() {
  return (typeof this._isFolderProxy === 'function')
       ? this._isFolderProxy()
       : this.relpath === '.';
};

proto.toJSON = function toJSON(user) {
  if (this.isFolder()) {
    return this.folder.toJSON(user);
  }

  var stats = this.stats || {};
  return {
    folder: this.folder.name,
    dirname: dirname(this.relpath),
    name: basename(this.relpath),
    uid: this.uid,
    path: this.path,
    type: stats.type,
    mime: stats.mime,
    mtime: stats.mtime,
    size: stats.size
  };
};

proto.stat = function stat(callback) {
  var resource = this;

  var done = this._ctlSharedAction('stat', this.ref(callback));

  if (!done) return;

  Resource._statQueue.push(this, function (err, stats) {
    if (err) {
      delete resource.stats;
      return done(Resource.createError(err));
    }

    resource.stats = freeze({
      mtime: stats.mtime,
      type: stats.isDirectory() ? 'folder' : 'file',
      mime: stats.isFile() ? mime.lookup(resource.name) : 'inode/directory',
      size: stats.isFile() ? stats.size : undefined
    });

    done(null, resource.stats);
  });
};

proto.scan = function scan(options, callback) {
  var resource = this;

  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  // We have 4 distinct cases to handle based on options (recursive, dirsonly):
  //   scan00, scan10, scan01, scan11
  // => 4 distinct actions that can be shared but must be handled separatly
  var shdId = 'scan' + (options.recursive ? 1 : 0) + (options.dirsOnly ? 1 : 0);
  var done = this._ctlSharedAction(shdId, this.ref(callback));

  if (!done) return;

  fs.readdir(this.abspath, function (err, all) {
    if (err) {
      delete resource.dirs;
      delete resource.files;
      return done(Resource.createError(err));
    }

    var dirs = [];
    var files = [];

    function add(res, _dirs, _files) {
      var list = res.stats.type === 'folder' ? dirs : files;
      var infos = res.toJSON();
      if (_dirs) infos.dirs = _dirs;
      if (_files && !options.dirsOnly) infos.files = _files;
      list.push(freeze(infos));
    }

    async.each(all, function statFile(f, next) {
      var res;

      if (f[0] === '.') return process.nextTick(next);

      res = new Resource(resource.folder, joinPath(resource.relpath, f));

      res.stat(function (err, stat) {
        if (err) {
          console.log("scan %s: %s", res.abspath, err.toString());
        } else if (stat.type === 'folder' && options.recursive) {
          return res.scan(options, function (err, _dirs, _files) {
            if (err) return next(err);
            add(res, _dirs, _files);
            next();
          });
        } else if (!options.dirsOnly || stat.type === 'folder') {
          add(res);
        }
        next();
      });
    }, function (err) {
      if (err) return done(Resource.createError(err));

      dirs.sort(compare.resource);
      files.sort(compare.resource);
      resource.dirs = freeze(dirs);
      resource.files = freeze(files);
      done(null, dirs, files);
    });
  });
};

/**
 * Create the resource as a directory
 *
 * mkdir([options,] [callback])
 *
 * @param options {object}
 *        Options for directory creation:
 *        - parents: 
 * @param callback(err) {function}
 *        Asynchronous callback function. \a err is set if an error occurs
 * @param strict {boolean}
 */
proto.mkdir = function (options, callback) {
  var resource = this;

  if (typeof options === 'function') {
    callback = options;
    options = {};
  } else {
    options = options || {};
  }

  var done = this._ctlSharedAction('mkdir', this.ref(callback));

  if (!done) return;

  this.stat(function (err, stats) {
    if (!err) {
      if (stats.type !== 'folder') {
        err = new Error("Not a directory");
        err.code = 'ENOTDIR';
      } else if (options.strict) {
        err = new Error("Directory already exist");
        err.code = 'EEXIST';
      }
      if (err) err = Resource.createError(err);
    }

    if (err && err.error && err.error.code === 'ENOENT') {
      var fn = (options.parents ? fs.ensureDir : fs.mkdir);
      return fn(resource.abspath, function (err) {
        if (!err) {
          resource.stats = freeze({
            mtime: new Date(),
            type: 'folder',
            mime: 'inode/directory'
          });
        }
        done(err ? Resource.createError(err) : null);
      });
    }

    done(err);
  });
};

/**
 * resource(path)
 *
 * Get a resource object for a path relative to this resource.
 */
proto.resource = function (path) {
  return this.folder.resource(joinPath(this.abspath, path));
};

/**
 * rename(user, dest, [options,] cb)
 *
 * Any locking must be handled by the caller.
 *
 * replace.trash and replace.restore functions in options must ensure
 * no deadlock is possible.
 *
 *  options: {
 *    // Used only if replace is unset: Generate new name if dest exists.
 *    rename: true,
 *    // or (defaults if set to true, all mandatory if explicit object):
 *    rename: { 
 *      regexp: /^()\[ *#([0-9]+) *\] *(.*)$/,
 *      gen: (name, num) => (util.format('[#%s] ', num) + name)
 *    },
 *
 *    // Needed when renaming is required, in order to create resource object.
 *    resource: (path) => null,
 *
 *    // If set, replace existing files instead of renaming.
 *    // Unset by default.
 *    // Must be false or an object. Empty object => fs.rename called directly.
 *    replace: {
 *     trash: (user, dest, (err, uid) => null) => null,
 *     restore: (user, uid, (err) => null)
 *    },
 *
 *    // if true, create missing parent folders.
 *    parents: false
 *  }
 */
proto.rename = function rename(user, dest, options, callback) {
  var src = this;
  var trash, rename, restore, resource;
  var _err;

  if (typeof options === 'function') {
    callback= options;
    options = {};
  }

  resource = options.resource;

  if (options.rename === true) {
    rename = Resource.renamePrefixBuilder();
  } else if (options.rename && options.rename.prefix && options.rename.gen) {
    rename = Resource.renamePrefixBuilder(options.rename.prefix, options.rename.gen);
  }
  if (rename && typeof resource !== 'function') {
    throw new Error("options.resource rquired when renaming is enabled.");
  }

  if (options.replace) {
    trash = options.replace.trash;
    restore = options.replace.restore;
  }

  if (!src.folder.canwrite(user)) {
    _err = error.createError(403, 'resource.forbidden',
      "Need write access on resource");
  } else if (!dest.folder.canwrite(user)) {
    _err = error.createError(403, 'resource.forbidden',
      "Need write access on destination to rename resource");
  } else if (src.isFolder() && dest.isFolder()) {
    _err = (user && user.is('admin'))
         ? null
         : error.createError(403, 'resource.forbidden',
             "Need admin rights to rename shared folder");
  } else if (src.isFolder()) {
    _err = error.createError(409, 'resource.conflict',
       "Can't move a shared folder to another folder");
  } else if (dest.isFolder()) {
    _err = error.createError(409, 'resource.conflict',
       "Can't create a non-shared folder from a shared folder");
  }

  if (_err) {
    return process.nextTick(callback, _err);
  }

  async.waterfall([
    src.stat.bind(src),
    (srcStats, next) => {
      var err;

      if (src.path === dest.path) {
        err = 'skip';
      } else if (compare.pathIn(src.path, dest.path)) {
        err = error.conflict('resource.conflict', "Source path in destination path");
      } else if (compare.pathIn(dest.path, src.path)) {
        err = error.conflict('resource.conflict', "Destination path in source path");
      } else {
        return next(null, srcStats);
      }

      next(err);
    },
    (srcStats, next) => {
      // Lookup destination andloop to rename
      var _ready;

      dest.ref(); // required because we may create dest resources later

      async.until(() => _ready, (loop) => {
        var ready = (rep) => ((_ready = true) && loop(null, dest, rep || null));

        dest.stat((err, stats) => {
          if (!err) {
            if (options.replace) {
              if (typeof trash === 'function') {
                return trash(user, dest, (err, uid) => {
                  if (err) {
                    dest.unref();
                    return loop(err);
                  }
                  ready({ origin: dest.path, itemUid: uid });
                });
              }
              // Fallback to fs standard replacement process.
            } else if (rename) {
              dest.unref(); // Object still usable as far as node is concerned;
              dest = resource(rename(dest.path), true);
              return loop(); // Will stat the new resource.
            } else {
              // No rename, no replace => conflict
              err = new Error();
              err.code = 'EEXIST';
              err = Resource.createError(err);
            }
          }

          if (err && err.code !== 'resource.notfound') {
            dest.unref();
            return loop(err);
          }

          /* Ready to rename now */
          ready();
        });
      }, next);
    },
    (dest, replaced, next) => {
      if (options.parents && !dest.isFolder()) {
        // Shared folders can't be restored implicitly.
        dest.folder._.stat(function (err) {
          if (err) {
            dest.unref();
            err.code = err.code.replace('resource.', 'folder.');
            return next(err);
          }
          next(null, dest, replaced);
        });
      } else {
        next(null, dest, replaced);
      }
    },
    (dest, replaced, next) => {
      if (options.parents) {
        fs.ensureDir(dirname(dest.abspath), (err) => next(err, dest, replaced));
      } else {
        next(null, dest, replaced);
      }
    },
    (dest, replaced, next) => {
      // We can now rename the resource
      fs.rename(src.abspath, dest.abspath, (err) => {
        if (err) {
          dest.unref();

          err = Resource.createError(err);

          if (replaced && typeof restore === 'function') {
            restore(user, replaced.itemUid, () => next(err));
          } else {
            next(err);
          }
        } else {
          next(null, dest, replaced);
        }
      });
    },
    (dest, replaced, next) => {
      if (src.isFolder()) {
        src.folder.emit('renamed');
      }

      if (dest.isFolder()) {
        dest.unref(); // still usable in the following code

        dest.folder.loadConfig(function (err) {
          if (err) return next(err);

          try {
            dest.folder.emit('register');
            next(null, dest.folder._.ref(), replaced);
          } catch (e) {
            next(error.createError(500, 'unexpected', "Unexpected error"));
          }
        });
      } else {
        next(null, dest, replaced);
      }
    },
    (dest, replaced, next) => dest.stat(() => next(null, dest, replaced))
  ], (err, dest, replaced) => {
    var infos;

    if (err === 'skip') {
      dest = src.ref();
      replaced = undefined;
      err = null;
    } else if (err) {
      dest = undefined, replaced = undefined;
    }

    if (!err) {
      infos = dest.toJSON(user);
      if (replaced) infos.replaced = replaced;
    }

    err ? callback(err) : callback(null, infos, dest, replaced);

    if (dest) dest.unref();
  });
};

Resource.renamePrefixBuilder = function renamePrefixBuilder(patternRe, patternGen) {
  var pattern, gen;

  if (patternRe && patternGen) {
    pattern = patternRe;
    if (!(pattern instanceof RegExp)) pattern = new RegExp(''+pattern);
    gen = patternGen;
  } else {
    pattern = /^()\[ *#([0-9]+) *\] *(.*)$/;
    gen = ((n, num) => (util.format('[#%s] ', num) + n));
  }

  return function (path) {
    var lastPrefix = 0;
    var dir = dirname(path);
    var name = basename(path);

    if (pattern) {
      var m = name.match(pattern);
      if (m) {
        lastPrefix = +m[2];
        name = m[1]+m[3];
      }
    }

    return joinPath(dir, gen(name, lastPrefix+1));
  };
};

Resource.sanitizeName = function sanitizeName(name) {
  return name.replace(/^[.]/, '_') /* no leading dot allowed */
             .replace(/[\\\/:\0-\u001f\u007f]+/g, '-')
             .replace(/-+/g, '-')
             .trim();
};

Resource.checkName = function checkName(name, errMerge) {
  var ctx = typeof this === 'string' ? this : 'resource.';
  var r = /^[^\\\/:\0-\u001f\u007f. ][^\\\/:\0-\u001f\u007f]*$/.test(name);

  if (!r) {
    var msg;

    if (name[0] === ' ' || name[0] === '.') {
      msg = "Resources starting with a dot or a space are not allowed";
    } else {
      msg = "Resource name contains illegal characters";
    }

    throw error.createError(400, ctx+'name', msg, merge({
      minLength: 1,
      allowedFirst: "[^\\\\/:\\0-\\u001f\\u007f. ]",
      allowed: "[^\\\\/:\\0-\\u001f\\u007f]"
    }, errMerge));
  }
};

Resource.checkPath = function checkPath(allowEmpty, path, errMerge) {
  var ctx = typeof this === 'string' ? this : 'resource.path.';

  if (typeof allowEmpty !== 'boolean') {
    errMerge = path;
    path = allowEmpty;
    allowEmpty = false;
  }

  path = path.replace(/\/+$/, '').replace(/\/\/+/g, '/');

  var rpath = resolve("/"+path).substr(1);

  if (path !== rpath) {
      throw error.createError(400, ctx+"illegal", "Path must be relative and must not contain . or ..", errMerge);
  } else if (!rpath && !allowEmpty) {
    throw error.createError(400, ctx+"empty", "Empty path not allowed", errMerge);
  } else if (rpath) {
    rpath = rpath.split("/");
    for (var i = 0; i < rpath.length; i++) {
      Resource.checkName.call(ctx+i+'.', rpath[i], merge({ index : i }, errMerge));
    }
  }
};

Resource.checkPathEmpty = function checkPathEmpty() {
  var args = ([ true ]).concat(Array.prototype.slice.call(arguments));
  return Resource.checkPath.apply(this, args);
};

Resource.compare = function compare(res1, res2) {
  return compare.path(res1.path, res2.path);
};

Resource.createError = function createError(err, stackOpt) {
  var ctx = typeof this === 'string' ? this : 'resource.';
  var statusCode, errorCode, message;

  if (!err || error.isLibError(err)) return err;

  if (!stackOpt) stackOpt = Resource.createError;

  switch (err.code) {
    case 'ENOENT':
      statusCode = 404;
      errorCode = 'notfound';
      message = "Resource not found";
      break;
    case 'ENOTDIR':
      statusCode = 409;
      errorCode = 'notdir';
      message = "An element in the path is not a directory";
      break;
    case 'EISDIR':
      statusCode = 409;
      errorCode = 'isdir';
      message = "The resource is not a file";
      break;
    case 'ENOTEMPTY': // When renaming directories
    case 'EEXIST':
      statusCode = 409;
      errorCode = 'exist';
      message = "The resource already exists";
      break;
    case 'EACCES':
    case 'EPERM':
      statusCode = 500;
      errorCode = 'configuration';
      message = "Configuration error";
      break;
    default:
      statusCode = 500;
      errorCode = 'internal';
      message = "Internal error";
  }

  var errObj = new error.LibError(statusCode, ctx+errorCode, message, {}, stackOpt);

  Object.defineProperty(errObj, 'error', { value: err });

  return errObj;
};

Resource.pathHash = function pathHash(path) {
  var hash = crypto.createHash('sha1');
  hash.update(path);
  return hash.digest('hex');
};

Resource.pathUid = function pathUid(folder, path) {
  return (!path || path === '.')
       ? folder.uid
       : Resource.pathHash(joinPath(folder.name, path));
};

Resource._statQueue = async.queue(function (resource, next) {
  fs.stat(resource.abspath, next);
}, 4);
