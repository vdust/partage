/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

"use strict";

var crypto = require('crypto');
var EventEmitter = require('events');
var fs = require('fs-extra');
var resolve = require('path').resolve;
var basename = require('path').basename;
var dirname = require('path').dirname;
var joinPath = require('path').join;
var util = require('util');

var mime = require('mime-types');

var utils = require('../utils');

var ctlInit = require('./ctl');
var Resource = require('./resource');
var User = require('./user');


function Folder() {
  EventEmitter.call(this);
  Folder.prototype._create.apply(this, arguments);
}
util.inherits(Folder, EventEmitter);


// Exports
module.exports = Folder;


var proto = Folder.prototype;

// Used in tests to get predictable UIDs
Folder._resetUidGenerator = function (lastUid) {
  var last_uid = (+lastUid) || 0;

  Folder.nextuid = function () {
    return ++last_uid;
  };
};
Folder._resetUidGenerator();

proto._create = function _create(path, callback) {
  var folder = this;
  var resource;

  if (path[0] !== '/') path = resolve(path);

  Object.defineProperties(this, {
    name: {
      configurable: true,
      enumerable: true,
      value: Resource.sanitizeName(basename(path))
    },
    root: {
      enumerable: false,
      value: dirname(path)
    },
    abspath: {
      enumerable: true,
      get: function () {
        return joinPath(folder.root, folder.name)
      }
    },
    uid: {
      enumerable: true,
      value: Folder.nextuid()
    },
    // Infos
    access: {
      enumerable: true,
      writable: true,
      value: {}
    },
    description: {
      enumerable: true,
      writable: true,
      value: ''
    },
    tasks: {
      enumerable: true,
      writable: true,
      value: {}
    },
    // Resources tracking (with folder resource registered by default)
    _resources: { value: {} }
  });

  ctlInit(this, true);

  // Resource() needs previous properties to be setup
  Object.defineProperty(this, '_', { value: (new Resource(this)).ref() });
  this._resources['.'] = this._;

  if (typeof (callback) === 'function') {
    this.loadConfig(callback);
  }
};

proto.exist = function exist() {
  return !!this._ctl.exist;
};

proto.synced = function synced() {
  return !!this._ctl.synced;
}

proto.pathRelative = function pathRelative() {
  var withFolder = false, offset = 0;
  var fp, p, args;

  if (typeof arguments[0] === 'boolean') {
    withFolder = arguments[0];
    offset = 1;
  }

  fp = this.abspath;
  args = utils.cleanIterable(Array.prototype.slice.call(arguments, offset));
  args.unshift(fp);
  p = resolve.apply(null, args);

  if (fp === p) return withFolder ? this.name : '.';

  if ((p+'/').substr(0, fp.length+1) !== (fp+'/')) return;

  return (withFolder ? this.name + '/' : '') + p.substr(fp.length+1);
};
proto.getRelativePath = proto.pathRelative;

proto._configFile = function _configFile(ext) {
  return joinPath(this.abspath, '.fhconfig'+(ext||''));
};

proto.toJSON = function toJSON(user) {
  var inf = {
    name: this.name,
    uid: Resource.pathUid(this),
    description: this.description,
    type: 'folder',
    mime: 'inode/directory',
    path: this.name
  };

  if (user) {
    inf.canread = this.canread(user);
    inf.canwrite = this.canwrite(user);
    inf.canedit = user.is('admin');
    if (inf.canedit) inf.access = this.access;
  }

  return inf;
};
proto.toObject = proto.toJSON; // XXX Deprecated

proto.accessToList = function accessToList() {
  var list = [];
  var keys, k, i;

  keys = Object.keys(this.access);
  for (i = 0; i < keys.length; i++) {
    k = keys[i];
    if (!this.access[k]) continue;
    else if (this.access[k] === 'readonly') k = '!'+k;
    list.push(k);
  }
  list.sort(function (a, b) {
    a = a[0] === '!' ? a.substr(1) : a;
    b = b[0] === '!' ? b.substr(1) : b;
    return a < b ? -1 : (a > b ? 1 : 0);
  });

  return list;
};

proto.configure = function configure(conf, all) {
  var modified = false;

  if (typeof conf === 'boolean') {
    all = conf;
    conf = {};
  } else {
    conf = conf||{};
  }

  if (all || 'description' in conf) {
    this.description = conf.description||'';
    modified = true;
  }
  if (all || 'accessList' in conf) {
    this.access = Folder.cleanAccess(conf.accessList);
    modified = true;
  }
  if (all || 'tasks' in conf) {
    this.tasks = conf.tasks||{};
    modified = true;
  }
  if (modified) this._ctlClean('synced');
  return modified;
};
proto.setInfos = proto.configure;

proto.serializeConfig = function serializeConfig() {
  var data = {
    accessList: this.accessToList(),
    description: this.description,
    tasks: this.tasks
  };
  return JSON.stringify(data);
};

proto.loadConfig = function loadConfig(callback) {
  var folder = this;

  var done = this._ctlSharedAction({
    eventName: 'loadconfig',
    cond: ['synced']
  }, callback);

  if (!done) return;

  this.lock('config', function (err, release) {
    if (err) return done(err);

    function _done (err) { release(); done(err); }

    folder._.stat(function (err, stats) {
      if (err) {
        folder._ctlClean('exist');
        return _done(err);
      }

      folder._ctlFlag('exist');

      fs.readFile(folder._configFile(), 'utf8', function (err, data) {
        if (err && err.code !== 'ENOENT') {
          return _done(Resource.createError(err));
        }

        var conf = {};
        if (data) {
          try {
            conf = JSON.parse(data);
          } catch (e) {
            // Don't fail. Just ignore bad conf and assumes empty one
            console.warn(folder._configFile()+": "+e.toString());
          }
        }

        folder.configure(conf, true); // set all (reset undefined)

        _done();
      });
    });
  });
};
proto.loadInfos = proto.loadConfig;

proto.saveConfig = function saveConfig(callback) {
  var folder = this;

  var done = this._ctlSharedAction({
    eventName: 'saveconfig',
    cond: ['synced'],
    pending: this.saveConfig.bind(this)
  }, callback);

  if (!done) return;

  var data = this.serializeConfig();
  var conffile = this._configFile();

  this.lock('config', true, function (err, release) {
    if (err) return done(err);

    function _done (err) { release(); done(err); }

    fs.copy(conffile, conffile+'-', { clobber: true }, function (err) {
      if (err && err.code !== 'ENOENT') {
        return _done(Resource.createError(err));
      }
      fs.writeFile(conffile, data, 'utf8', function (err) {
        _done(err && Resource.createError(err));
      });
    });
  });
};
proto.saveInfos = proto.saveConfig;

proto.save = function save(callback) {
  var folder = this;

  var done = this._ctlSharedAction('save', callback);

  this._.mkdir(function (err) {
    if (err) {
      folder._ctlClean('exist');
      return done(err);
    }
    folder.saveConfig(done);
  });
};
proto.create = proto.save;

proto.rename = function rename(newname, callback) {
  var folder = this;

  callback = typeof callback === 'function' ? callback : function () {};

  if (this._ctl._rename) {
    console.warn("Concurrent folder rename detected. Must sync with lock explicitly.");
    setImmediate(callback, utils.createError(500, 'folder.internal', "Internal error"));
    return;
  }
  this._ctl._rename = true;

  newname = Resource.sanitizeName(newname);

  var origPath = this.abspath;
  var newPath = joinPath(this.root, newname);

  function done(err) {
    folder._ctlClean('_rename');
    if (!err) folder.emit('rename', newname, basename(origPath));
    callback(err && Resource.createError(err));
  }

  fs.rename(origPath, newPath, function (err) {
    if (err) return done(err);

    Object.defineProperty(folder, 'name', {
      configurable: true,
      enumerable: true,
      value: newname
    });

    folder._.stats = freeze({
      mtime: new Date(),
      type: 'folder',
      mime: 'inode/directory'
    });

    done();
  });
};

proto.can = function can(can, user) {
  if (arguments.length < 2) {
    user = can;
    can = 'read';
  }

  if (user.is('admin')) return true;

  switch (can.toLowerCase()) {
    case 'read':
      return this.access[user.name] && user.is('visitor');
    case 'write':
      return this.access[user.name] === true && user.is('contributor');
    default:
      console.log("Invalid access type. Must be 'read' or 'write'. Denying access.");
      return false;
  }
};

proto.canread = function canread(user) {
  return this.can('read', user);
};

proto.canwrite = function canwrite(user) {
  return this.can('write', user);
};

proto.resource = function resource(path) {
  var folder = this;
  var relpath = this.pathRelative(path);

  if (!relpath) throw error.createError(400, 'resource.invalid', "Invalid path "+path);

  if (!(relpath in this._resources)) {
    var resource = new Resource(this, path);
    this._resources[relpath] = resource;
    resource.once('release', function () {
      delete folder._resources[relpath];
    });
  }

  return this._resources[relpath].ref();
};



Folder.cleanAccess = function cleanAccess(access) {
  var keys, i, ret = {}, u, v;

  if (typeof access === 'string') {
    access = access.trim().split(/ *, */);
  }

  if (Array.isArray(access)) {
    for (i = 0; i < access.length; i++) {
      v = true;
      u = access[i];
      if (!u) return;
      if (u[0] === '!') {
        v = 'readonly';
        u = u.substr(1);
      }
      ret[u] = v;
    }
  } else if (typeof access === 'object') {
    keys = Object.keys(access);
    for (i = 0; i < keys.length; i++) {
      v = access[keys[i]];
      if (v === 'readonly' || v === true) {
        ret[keys[i]] = v;
      }
    }
  }

  return ret;
};

Folder.checkAccessList = function checkAccessList(access, errMerge) {
  var ctx = typeof this === 'string' ? this : 'access.';
  var i, keys, u, errDetails = {};
  var t = typeof access;

  if (!access) return;

  if (t === 'string') {
    access = access.trim().split(/ *, */);
  }

  if (errMerge) utils.merge(errDetails, errMerge);

  if (Array.isArray(access)) {
    for (i = 0; i < access.length; i++) {
      u = access[i];
      t = typeof u;

      if (t === 'undefined' || u === '') continue;

      errDetails.index = i;

      if (t !== 'string') {
        errDetails.expect = 'string';
        errDetails.got = t;
        throw error.createError(400, ctx+"array.type",
          "Access list must contain strings only", errDetails);
      }

      if (u[0] === '!') u = u.substr(1);

      User.checkName.call(ctx+'array.', u, errDetails);
    }
  } else if (t === 'object') {
    keys = Object.keys(access);
    for (i = 0; i < keys.length; i++) {
      errDetails.key = keys[i];
      User.checkName.call(ctx+'object.key.', keys[i], errDetails);

      u = access[keys[i]];

      if (u === 'readonly' || u === null || u === undefined) continue;

      if (typeof u !== 'boolean') {
        errDetails.allowed = [ true, false, 'readonly' ];
        throw error.createError(400, ctx+'object.value.invalid',
          "Access object values must be booleans or 'readonly'", errDetails);
      }
    }
  } else {
    errDetails.expect = [ 'string', 'array', 'object' ];
    errDetails.got = t;
    throw error.createError(400, ctx+'type',
      "Array list must be a string, an array or an object", errDetails);
  }

  return;
}
Folder.checkAccess = Folder.checkAccessList;

Folder.accessListIsValid = function testAccess(access) {
  try {
    this.checkAccess(access);
  } catch (e) {
    return false;
  }
  return true;
};




return;
// XXX Removed Deprecations below


// XXX Should be deprecated
proto.getPath = function () {
  console.log( "DEPRECATE SOON: Folder."+arguments.callee.name+"()" );
  var args = utils.cleanEnumerable(arguments);

  args.unshift(this.abspath);
  return resolve.apply(null, args);
};

// XXX Use Resource.pathUid() instead
proto.getPathUid = function (path) {
  console.log( "DEPRECATED: Folder."+arguments.callee.name+"()" );
  var p = this.getPath() + '/';
  path = resolve(p, path||'') + '/';
  if (path === p || path.substr(0, p.length) === p) {
    path = path.substr(p.length);
  } else {
    return false;
  }
  return '' + this.uid + (path ? '-'+Folder.pathHash(path) : '');
};

// XXX Use Folder.resource() and catch instanciation errors
proto.isSubPath = function (path) {
  var p = this.abspath + '/';
  path = resolve(p, path)+'/';
  return path === p || path.substr(0, p.length) === p;
};

// XXX deprecated. See Resource.toJSON()
proto.pathInfos = function pathInfos(type, path, user) {
  console.log( "DEPRECATED: Folder."+arguments.callee.name+"()" );
  if (typeof path !== 'string') {
    user = path;
    path = type;
    type = 'file';
  }

  var rel = this.getRelativePath(path);
  var infos;

  if (rel === '.') {
    infos = this.toJSON(user);
  } else {
    infos = {
      folder: this.name,
      dirname: dirname(rel),
      name: basename(rel),
      uid: this.getPathUid(path),
      path: this.name + '/' + rel,
      type: type,
      mime: mime.lookup(basename(rel))
    };

    if (user) {
      infos.canread = this.canread(user);
      infos.canwrite = this.canwrite(user);
    }
  }

  return infos;
};

// XXX Deprecated. See Resource.scan()
proto.list = function list(subpath, cb) {
  console.log( "DEPRECATED: Folder."+arguments.callee.name+"()" );
  var self = this, p = this.getPath(subpath);

  if (!this.isSubPath(p)) {
    var e = new Error("Invalid subpath "+subpath);
    e.code = 'EINVALID'; /* for localized error messages */
    e.fatal = true; /* can't allow path lookup */
    return cb(e);
  }

  fs.readdir(p, function (err, all) {
    var dirs = [], files = [];
    if (err) return cb(err);

    function addFile(f, stats) {
      files.push({
        mime: mime.lookup(f),
        name: f,
        type: 'file',
        stats: {
          size: stats.size,
          mtime: stats.mtime
        }
      });
    }
    function addDir(d, stats) {
      dirs.push({
        mime: 'inode/directory',
        name: d,
        type: 'folder',
        stats: {
          mtime: stats.mtime
        }
      });
    }

    function statNext() {
      var f = all.pop();

      if (!f) {
        files.sort(utils.compareFileLowerCase);
        dirs.sort(utils.compareFileLowerCase);
        return cb(null, files, dirs);
      }

      if (f[0] === '.') return statNext();

      fs.stat(resolve(p, f), function (err, stats) {
        if (err) return cb(err);
        if (stats.isDirectory()) {
          addDir(f, stats);
        } else if (stats.isFile()) {
          addFile(f, stats);
        }
        statNext();
      });
    }
    statNext();
  });
};

// XXX Deprecated. See Resource.stat()
proto.stat = function stat(path, cb) {
  console.log( "DEPRECATED: Folder."+arguments.callee.name+"()" );
  var p = this.getPath(path);

  if (!this.isSubPath(path)) {
    var e = new Error("Invalid path "+path);
    e.code = 'EINVALID';
    return cb(e);
  }

  fs.stat(p, cb);
};

// XXX deprecated. See Resource.mkdir
proto.createSubdir = function createSubdir(subpath, cb) {
  console.log( "DEPRECATED: Folder."+arguments.callee.name+"()" );
  var self = this, p, dir;
  p = dirname(subpath);
  dir = basename(subpath);
  dir = Folder.sanitizeName(dir);
  p = self.getPath(p, dir);

  if (!self.isSubPath(p)) {
    var e = new Error("Invalid path "+subpath);
    e.code = 'EINVALID'; /* for localized error messages */
    e.fatal = true;
    return cb(e);
  }

  fs.stat(p, function (err, stats) {
    if (err) {
      fs.mkdir(p, function (err) {
        if (err) return cb(err);
        cb();
      });
    } else if (stats.isDirectory()) {
      /* directory exists. Assume success */
      cb();
    } else {
      var e = new Error("File with same name already exists");
      e.code = 'EEXIST';
      cb("File with same name already exists");
    }
  });
};

// XXX Use Resource.sanitizeName() instead
Folder.sanitizeName = function sanitizeName(name) {
  console.log( "DEPRECATED: Folder."+arguments.callee.name+"()" );
  return name.replace(/^[.]/, '_') /* no leading dot allowed */
             .replace(/[\\\/:\0-\u001f\u007f]+/g, '-')
             .replace(/-+/g, '-')
             .trim();
};

// XXX Use Resource.checkName() instead
Folder.checkName = function checkName(name, exc) {
  console.log( "DEPRECATED: Folder."+arguments.callee.name+"()" );
  if (arguments.length < 2) exc = true;
  var r = /^[^\\\/:\0-\u001f\u007f. ][^\\\/:\0-\u001f\u007f]*$/.test(name);
  if (!r && exc) {
    throw utils.error("File name contains illegal characters", {
      code: 'illegal',
      minLength: 1,
      allowedFirst: "[^\\\\/:\\0-\\u001f\\u007f. ]",
      allowed: "[^\\\\/:\\0-\\u001f\\u007f]"
    });
  }

  return r;
};

// XXX Use utils.compareFileLowerCase() instead
Folder.compare = function compare(f1, f2) {
  console.log( "DEPRECATED: Folder."+arguments.callee.name+"()" );
  var n1 = f1.name,
      l1 = n1.toLowerCase(),
      n2 = f2.name,
      l2 = n2.toLowerCase();
  return l1 < l2 ? -1 : (l1 > l2 ? 1 : (n1 < n2 ? -1 : (n1 > n2 ? 1 : 0)));
};

// XXX Use Resource.checkPath() instead
Folder.checkPath = function checkPath(p, exc) {
  console.log( "DEPRECATED: Folder."+arguments.callee.name+"()" );
  var cp, e;

  if (arguments.length < 2) exc = true;

  p = p.replace(/\/+$/, '').replace(/\/\/+/g, '/');
  cp = resolve("/"+p).substr(1), i;

  if (!cp) {
    e = utils.error("Empty path not allowed", {
      code: 'empty'
    });
  } else if (p !== cp) {
    e = utils.error("Path must be relative and must not contain . or ..", {
      code: 'illegal',
    });
  } else {
    cp = cp.split("/");
    for (var i = 0; i < cp.length; i++) {
      try {
        Folder.checkName(cp[i]);
      } catch (_e) {
        if (_e.details) {
          _e.details.code = 'path.'+_e.details.code;
          _e.details.index = i;
        }
        break;
      }
    }
  }

  if (exc && e) throw e;

  return true;
};

// XXX Use Resource.pathHash() instead
Folder.pathHash = function (p) {
  console.log( "DEPRECATED: Folder."+arguments.callee.name+"()" );
  var hash = crypto.createHash('sha1');
  hash.update(p);
  return hash.digest('hex');
};
