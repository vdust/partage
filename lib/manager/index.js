/* partage
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * ISC Licensed
 */

"use strict";

var EventEmitter = require('events');
var fs = require('fs-extra');
var resolve = require('path').resolve;
var pathJoin = require('path').join;
var basename = require('path').basename;
var dirname = require('path').dirname;
var util = require('util');

var async = require('async');
var mime = require('mime-types');

var error = require('../error');
var asyncLog = require('../utils').asyncLog;
var compareResource = require('../utils/compare').resource;

var Access = require('./access');
var ctlInit = require('./ctl');
var Folder = require('./folder');
var Resource = require('./resource');
var Trash = require('./trash');
var Uploads = require('./uploads');
var User = require('./user');


function Manager() {
  EventEmitter.call(this);
  Manager.prototype._create.apply(this, arguments);
}
util.inherits(Manager, EventEmitter);


// Exports
module.exports = Manager;


var proto = Manager.prototype;

proto._create = function (usersfile, root, specials) {
  var manager = this;

  Object.defineProperties(this, {
    root: {
      enumerable: true,
      writable: true,
      value: resolve(root)
    },
    users: {
      enumerable: true,
      writable: true,
      value: {}
    },
    folders: {
      enumerable: true,
      value: {}
    },
    // ---
    _usersfile: {
      value: usersfile
    }
  });

  // Need previous properties
  Object.defineProperties(this, {
    trash: {
      enumerable: true,
      value: new Trash(this, specials.trash.path, specials.trash)
    },
    uploads: {
      enumerable: true,
      value: new Uploads(this, specials.uploads.path, specials.uploads)
    }
  });

  ctlInit(this, true);

  this._ctl.updateUsersPending = {};
};

proto.init = function init(callback) {
  var manager = this;

  var done = this._ctlSharedAction('init', callback);

  if (!done) return;

  async.waterfall([
    this.checkRoot.bind(this),
    asyncLog(' Initialize trash location'),
    this.trash.init.bind(this.trash),
    asyncLog(' Initialize uploads location'),
    this.uploads.init.bind(this.uploads),
    asyncLog(' Load users database'),
    this.loadUsers.bind(this),
    asyncLog(' Load shared folders'),
    this.loadFolders.bind(this),
  ], done);
};

proto.checkRoot = function checkRoot(callback) {
  var root = this.root;

  var done = this._ctlSharedAction('checkroot', callback);

  if (!done) return;

  fs.lstat(root, function (err, stats) {
    if (!err && !stats.isDirectory()) {
      err = "Not a directory" + (stats.isSymbolicLink() ? " (symlink not allowed)" : "");
      err = new Error(err);
      err.path = root;
      err.code = 'ENOTDIR';
    }

    done(err);
  });
};

proto.loadUsers = function loadUsers(callback) {
  var manager = this;
  var done = this._ctlSharedAction('loadusers', callback);

  if (!done) return;

  this.lock('__usersfile', function (err, release) {
    if (err) return done(err);

    fs.readFile(manager._usersfile, 'utf8', function (err, data) {
      if (!err) {
        // Save file contents to prevent useless writes in the future
        manager._ctl.usersFileLastWrite = data;

        manager.users = {};
        data.split("\n").forEach(function (row) {
          var user;
          row = row.trim();
          if (!row || row[0] === '#') return;
          user = new User(row);
          if (!user.name) return;
          manager.users[user.name] = user;
        });
      }

      release();
      done(err);
    });
  });
};

proto.userUpdate = function updateUser(user, callback) {
  this._ctl.updateUsersPending[user.name] = user.clone();
  this.saveUsers(callback);
};

proto.userDelete = function userDelete(user, callback) {
  if (typeof user === 'object') {
    user = user.name || user.username;
  }

  this._ctl.updateUsersPending[user] = null;

  this.saveUsers(callback);
};

proto.saveUsers = function saveUsers(callback) {
  var manager = this;

  if (this._ctl.usersFileProtected) {
    var err = error.unexpected('user.save',
      "Can't save users file. Contact a server administrator.");

    return process.nextTick(callback, err);
  }

  var pending = this._ctl.updateUsersPending;
  var done = this._ctlSharedAction({
    eventName: 'saveusers',
    done: function (err) {
      if (err) return;
      Object.keys(pending).forEach(function (u) {
        if (!pending[u]) {
          delete manager.users[u];
        } else {
          manager.users[u] = pending[u];
        }
      });
    },
    pending: this.saveUsers.bind(this)
  }, callback);

  if (!done) return;

  if (!Object.keys(pending).length) return process.nextTick(done);

  this._ctl.updateUsersPending = {};

  var all = {};
  Object.keys(this.users).forEach(function (u) {
    all[u] = manager.users[u];
  });
  Object.keys(pending).forEach(function (u) {
    if (!pending[u]) {
      delete all[u];
    } else {
      all[u] = pending[u];
    }
  });

  var users = Object.keys(all).sort();
  var rows = [];
  for (var i = 0; i < users.length; i++) {
    rows.push(all[users[i]].csv());
  }

  rows.push('');
  rows = rows.join('\n');

  if (rows === this._ctl.usersFileLastWrite) {
    /* No changes. Report success */
    return setImmediate(done);
  }

  this.lock('__usersfile', true, function (err, release) {
    if (err) return done(err);

    function _done(err) { release(); done(err); }

    fs.copy(manager._usersfile, manager._usersfile+'-', function (err) {
      if (err && err.code !== 'ENOENT') {
        console.error("Failed to backup %s: %s", manager._usersfile, e.toString());
        return _done(error.unexpected('usersave.unexpected', "Failed to save users"));
      }

      fs.writeFile(manager._usersfile, rows, 'utf8', function (err) {
        if (err) {
          // TODO: finer control of errors: Some won't corrupt the users file and
          // can be hot-fixed (no app restart necessary)
          console.log("Failed to write users file: %s", err.toString());
          // Prevent any further write attempts to make sure the backup is not
          // overwritter with potentially corrupted data.
          manager._ctl.usersFileProtected = true;
        } else {
          manager._ctl.usersFileLastWrite = rows;
        }
        _done(err && error.unexpected('usersave.unexpected', "Failed to save users"));
      });
    });
  });
};

proto.user = function user(username, edit) {
  var u = this.users[username];
  return (u && edit) ? u.clone() : u;
};

proto.userCanCreate = function userCanCreate(username) {
  return !this.users[username] && !this._ctl.updateUsersPending[username];
};

proto.loadFolders = function loadFolders(refresh, callback) {
  var manager = this;

  if (typeof refresh === 'function') {
    callback = refresh;
    refresh = false;
  }

  var done = this._ctlSharedAction({
    eventName: 'loadfolders',
    once: true
  }, callback);

  if (!done) return;

  fs.readdir(this.root, function (err, files) {
    if (err) return done(err);

    files.sort(compareResource);

    async.eachSeries(files, function statDir(f, next) {
      if (f[0] === '.') return process.nextTick(next);
      var path = pathJoin(manager.root, f);
      var folder = new Folder(path);
      if (folder.name !== f) return process.nextTick(next);

      // Refresh only files that are not already in the database.
      if (refresh && folder.name in manager.folders) {
        return process.nextTick(next);
      }

      fs.stat(path, function (err, stats) {
        if (err || !stats.isDirectory()) return next();

        manager.folderRegister(folder);

        folder.loadConfig(function (err) {
          if (err) {
            console.log("ERROR: folder %s: %s", folder.name, err.toString());
            folder.loadError = err;
          }
          next();
        });
      });
    }, done);
  });
};

proto.folderRegister = function folderRegister(folder) {
  var manager = this;

  if (!folder || folder.name in this.folders) return;

  this.folders[folder.name] = folder;

  function clean() {
    folder.removeListener('trash', clean);
    folder.removeListener('renamed', clean);

    delete manager.folders[folder.name];
    folder._cleanResources();
    // Allow the folder to be registered again.
    folder.once('register', () => { manager.folderRegister(folder); });
  }

  folder.on('trash', clean).on('renamed', clean);
};

proto.folder = function folder(foldername, create, infos) {
  var manager = this;
  var f, nf;

  foldername = foldername.trim().replace(/\/+$/, '');
  if (!foldername) return;

  f = this.folders[foldername];

  if (!f && typeof create === 'function') {
    nf = new Folder(pathJoin(this.root, foldername));

    this.lock('folderedit', true, function (err, release) {
      if (nf.name in manager.folders) {
        nf = manager.folders[nf.name];
        release();
        return create(null, nf);
      }
      if (infos) nf.setInfos(infos);
      nf.save(function (err) {
        if (err) nf = null;
        manager.folderRegister(nf);
        release();
        create(err, nf);
      });
    });
  }

  return f;
};

proto.userFolders = function userFolders(user, options, callback) {
  var self = this, list = [];

  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  var can = options.can || 'read';

  var shdId = 'ufolds' + (options.recursive ? 1 : 0) + (options.dirsOnly ? 1 : 0)
            + '-' + can + '-' + user.name;
  var done = this._ctlSharedAction(shdId, callback);

  if (!done) return;

  async.each(Object.keys(self.folders), function (k, next) {
    var folder = self.folders[k];

    if (!folder.can(can, user)) return process.nextTick(next);

    folder._.stat(function (err, stat) {
      if (err) return next(err);

      var obj = folder.toJSON(user);
      list.push(obj);
      if (options.recursive) {
        folder._.scan(options, function (err, dirs, files) {
          if (err) return next(err);
          if (dirs) obj.dirs = dirs;
          if (files) obj.files = files;
          next();
        });
      } else {
        next();
      }
    });
  }, function (err) {
    if (err) return done(err);

    list.sort(compareResource);
    done(null, list);
  });
};

proto.resource = function resource(path, mockFolder) {
  if (typeof path === 'boolean') {
    var _t = mockFolder;
    mockFolder = path;
    path = _t;
  }
  path = resolve('/'+path).split('/').slice(1);

  var foldName = path[0];
  var relpath = path.slice(1).join('/');
  var folder = this.folder(foldName);

  if (!folder) {
    if (!mockFolder) return null;
    // this folder is not registered and is to be used in cases a non existing
    // resource is needed (e.g. renaming or restoration of a folder)
    folder = new Folder(pathJoin(this.root, foldName));
    folder.once('register', () => { this.folderRegister(folder); });
  }

  return folder.resource(relpath);
};

proto.listUsers = function listUsers(categories, exclude) {
  var lists = {};
  var users = this.users;
  var compare = Access.compare;
  var i;

  if (typeof categories === 'string' || typeof categories === 'number') {
    exclude = categories;
    categories = null;
  }
  exclude = Access.level(exclude||'special');

  if (!categories) {
    categories = Access.list(true);
  } else {
    if (categories instanceof Array) {
      categories = categories.slice();
    } else {
      categories = Object.keys(categories);
    }

    categories.sort(compare);
  }

  if (exclude) {
    categories.filter(function (a) {
      return Access.limit(a, exclude);
    });
  }

  for (i = 0; i < categories.length; i++) {
    if (compare(categories[i], exclude) < 0) {
      lists[categories[i]] = [];
    }
  }

  Object.keys(users).forEach(function (k) {
    var user = users[k], i, c;

    if (exclude && user.is(exclude)) return;

    for (i = 0; i < categories.length && compare(categories[i], exclude) < 0; i++) {
      if (user.is(categories[i])) c = categories[i];
    }
    if (c) lists[c].push(user);
  });

  Object.keys(lists).forEach(function (k) {
    lists[k].sort(compareResource);
  });

  return lists;
};

/* folderAccessHandler(can[, errorCode[, template]])
 *   can: 'read' or 'write'
 *   errorCode: http 4xx code [default: 404]
 *   template: [default: 'error']
 *
 *   returned handler set req.folder and req.folderPath for next handler.
 */
proto.folderAccessHandler = function (can, errorCode, template, create) {
  var self = this;
  can = can.toLowerCase();

  switch (can) {
    case 'read':
    case 'write':
      break;
    default:
      throw new Error("Invalid access type '"+can+"'");
  }

  return function (req, res, next) {
    var path = decodeURIComponent(req.path), p, hash;

    function sendError(code, msg) {
      res.status(code||404);
      if (template === false) {
        return res.send({ error: msg || "Unexpected error" });
      }
      return res.render(template||'error');
    }

    /* normalize the path. Remove trailing slashes. */
    p = resolve('/'+path).split('/');
    var folder = self.folder(p[1]);

    if (!req.user) return sendError(403, "Forbidden");

    if (can === 'write' && create && req.user.is('admin')) {
      if (!folder && p[2]) return sendError(404, "Root folder not found");
      folder = null;
      req.folderCreate = p[1];
    } else if (!folder || !folder['can'+can](req.user)) {
      return sendError(errorCode, "Resource Not Found");
    }

    req.folder = folder;
    req.folderPath = p.slice(2);

    process.nextTick(next);
  };
};

proto.rename = function (src, user, dest, options, callback) {
  // TODO: proper resource locking.

  return src.rename(user, dest, {
    rename: options.rename,
    resource: this.resource.bind(this, true),
    replace: options.replace ? {
      trash: this.trash.trash.bind(this.trash),
      restore: (u, uid, opts, cb) => this.trash.restore(u, uid, {
        rename: false,
        replace: true
      }, typeof opts === 'function' ? opts : cb)
    } : null,
    parents: options.parents
  }, callback);
};
