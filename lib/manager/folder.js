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
    accessList: {
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
  var obj = {
    name: this.name,
    uid: Resource.pathUid(this),
    description: this.description,
    type: 'folder',
    mime: 'inode/directory',
    path: this.name
  };

  if (user) {
    obj.canread = this.canread(user);
    obj.canwrite = this.canwrite(user);
    obj.canedit = user.is('admin');
    if (obj.canedit) obj.accessList = this.accessList;
  }

  return obj;
};
proto.toObject = proto.toJSON; // XXX Deprecated

proto.accessToArray = function accessToArray() {
  var list = [];
  var keys, k, i;

  keys = Object.keys(this.accessList);
  for (i = 0; i < keys.length; i++) {
    k = keys[i];
    if (this.accessList[k] === 'rw') k = '+'+k;
    list.push(k);
  }
  list.sort(function (a, b) {
    a = a[0] === '+' ? a.substr(1) : a;
    b = b[0] === '+' ? b.substr(1) : b;
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
    this.accessList = Folder.cleanAccessList(conf.accessList);
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
    accessList: this.accessToArray(),
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
      return this.accessList.hasOwnProperty(user.name);
    case 'write':
      return this.accessList[user.name] === 'rw';
    default:
      throw new Error("First argument must be 'read' or 'write'.");
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



Folder.cleanAccessList = function cleanAccessList(accessList) {
  var keys, i, ret = {}, u, v;

  if (typeof accessList === 'string') {
    accessList = accessList.trim().split(/ *, */);
  }

  if (Array.isArray(accessList)) {
    for (i = 0; i < accessList.length; i++) {
      v = 'ro';
      u = accessList[i];
      if (!u) return;
      if (u[0] === '+') {
        v = 'rw';
        u = u.substr(1);
      }
      ret[u] = v;
    }
  } else if (typeof accessList === 'object') {
    keys = Object.keys(accessList);
    for (i = 0; i < keys.length; i++) {
      v = accessList[keys[i]];
      if (typeof v === 'boolean') {
        ret[keys[i]] = v ? 'rw' : 'ro';
      } else if (v === 'ro' || v === 'rw') {
        ret[keys[i]] = v;
      }
    }
  }

  return ret;
};

Folder.checkAccessList = function checkAccessList(accessList, errMerge) {
  var ctx = typeof this === 'string' ? this : 'accesslist.';
  var i, keys, u, errDetails = {};
  var t = typeof accessList;

  if (!accessList) return;

  if (t === 'string') {
    accessList = accessList.trim().split(/ *, */);
  }

  if (errMerge) utils.merge(errDetails, errMerge);

  if (Array.isArray(accessList)) {
    for (i = 0; i < accessList.length; i++) {
      u = accessList[i];
      t = typeof u;

      if (t === 'undefined' || u === '') continue;

      errDetails.index = i;

      if (t !== 'string') {
        errDetails.expect = 'string';
        errDetails.got = t;
        throw error.createError(400, ctx+"array.type",
          "Access list must contain strings only", errDetails);
      }

      if (u[0] === '+') u = u.substr(1);

      User.checkName.call(ctx+'array.', u, errDetails);
    }
  } else if (t === 'object') {
    keys = Object.keys(accessList);
    for (i = 0; i < keys.length; i++) {
      errDetails.key = keys[i];
      User.checkName.call(ctx+'object.key.', keys[i], errDetails);

      u = accessList[keys[i]];

      if (u === 'ro' || u === 'rw' || u === null || u === undefined) continue;

      if (typeof u !== 'boolean') {
        errDetails.allowed = [ false, true, 'ro', 'rw' ];
        throw error.createError(400, ctx+'object.value.invalid',
          "Access object values must be booleans, 'ro' or 'rw'", errDetails);
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

Folder.accessListIsValid = function accessListIsValid(accessList) {
  try {
    this.checkAccess(accessList);
  } catch (e) {
    return false;
  }
  return true;
};
