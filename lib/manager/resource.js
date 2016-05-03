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
var utils = require('../utils');

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

proto.toJSON = function toJSON(user) {
  if (this.relpath === '.') {
    return this.folder.toJSON(user);
  }

  var stats = this.stats || {};
  var mtime = stats.mtime;
  return {
    folder: this.folder.name,
    dirname: dirname(this.relpath),
    name: basename(this.relpath),
    uid: this.uid,
    path: this.path,
    type: stats.type,
    mime: stats.mime,
    mtime: stats.type === 'file' ? mtime : undefined,
    size: stats.size
  };
};

proto.stat = function stat(callback) {
  var resource = this;

  var done = this._ctlSharedAction('stat', this.ref(callback));

  if (!done) return;

  fs.stat(this.abspath, function (err, stats) {
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

proto.scan = function scan(callback) {
  var resource = this;

  var done = this._ctlSharedAction('scan', this.ref(callback));

  if (!done) return;

  fs.readdir(this.abspath, function (err, all) {
    if (err) {
      delete resource.dirs;
      delete resource.files;
      return done(Resource.createError(err));
    }

    var dirs = [];
    var files = [];

    function add(res) {
      var list = res.stats.type === 'folder' ? dirs : files;
      list.push(freeze(res.toJSON()));
    }

    async.eachLimit(all, Resource.asyncLimit, function statFile(f, next) {
      var res;

      if (f[0] === '.') return process.nextTick(next);

      res = new Resource(resource.folder, joinPath(resource.relpath, f));

      res.stat(function (err) {
        if (err) {
          console.log("scan %s: %s", res.abspath, err.toString());
        } else {
          add(res);
        }
        next();
      });
    }, function (err) {
      if (err) return done(Resource.createError(err));

      dirs.sort(utils.compareResource);
      files.sort(utils.compareResource);
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
      if (!stats.isDirectory()) {
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

    done('mkdir', err);
  });
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

    throw error.createError(400, ctx+'name', msg, utils.merge({
      minLength: 1,
      allowedFirst: "[^\\\\/:\\0-\\u001f\\u007f. ]",
      allowed: "[^\\\\/:\\0-\\u001f\\u007f]"
    }, errMerge));
  }
};

Resource.checkPath = function checkPath(path, errMerge) {
  var ctx = typeof this === 'string' ? this : 'resource.path.';

  path = path.replace(/\/+$/, '').replace(/\/\/+/g, '/');

  var rpath = resolve("/"+path).substr(1);

  if (!rpath) {
    throw error.createError(400, ctx+"empty", "Empty path not allowed", errMerge);
  } else if (path !== rpath) {
    throw error.createError(400, ctx+"illegal", "Path must be relative and must not contain . or ..", errMerge);
  } else {
    rpath = rpath.split("/");
    for (var i = 0; i < rpath.length; i++) {
      Resource.checkName.call(ctx+i+'.', rpath[i], utils.merge({ index : i }, errMerge));
    }
  }
};

Resource.compare = function compare(res1, res2) {
  return utils.comparePath(res1.path, res2.path);
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
  return '' + folder.uid + ((path && path !== '.') ? '-'+Resource.pathHash(path) : '');
};
