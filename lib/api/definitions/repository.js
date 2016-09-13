/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

"use strict";

var async = require('async');
var fs = require('fs-extra');
var basename = require('path').basename;
var dirname = require('path').dirname;

var conf = require('../../config');
var error = require('../../error');
var Folder = require('../../manager/folder');
var Resource = require('../../manager/resource');
var Uploads = require('../../manager/uploads');
var utils = require('../../utils');

var ACCESS_SPEC = {
  doc: "An access list (prefix usernames with '!' for readonly)",
  type: [ 'array', 'object' ],
  split: ',',
  validate: Folder.checkAccessList
};

function _Check(can) {
  can = can.toLowerCase();

  if (can !== 'read' && can !== 'write') {
    throw new Error("Invalid folder access type. Must be 'read' or 'write'.");
  }

  return function (req, res, next) {
    var f = this.folder(req.params.folder);

    if (!f) return next(error.notFound());

    if (!f.can(can, req.user)) {
      if (can !== 'read' && f.can('read', req.user)) {
        return next(error.forbidden('folder.readonly', "Forbidden (read-only)"));
      }
      return next(error.notFound());
    }

    try {
      req.resource = f.resource(req.params.path);
    } catch (e) {
      return next(e);
    }

    // Make sure we release the resource at the end
    var end = res.end;
    res.end = function () {
      req.resource.unref();
      return end.apply(this, arguments);
    };

    req.folder = f;
    process.nextTick(next);
  }
}

/* use as preparePath.bind(type) */
function preparePath(req, res, next) {
  req.resourceType = this;
  process.nextTick(next);
}

/**
 * FileGet(req, res)
 */
function fileGet(req, res, next) {
  if (req.query.attachment) {
    res.attachment(req.resource.name);
  } else {
    res.type(req.resource.name);
  }

  res.sendFile(req.resource.abspath, function (err) {
    if (err) {
      if (err.code === 'ECONNABORTED' || err.syscall === 'write') {
        return;
      }

      if (res.headersSent) {
        return res.end(); 
      }

      // Needed to generate json response
      res.removeHeader('Content-Disposition');
      res.removeHeader('Content-Type');

      next(Resource.createError(err));
    }
  });
}

function fileSave(req, res, next) {
  var manager = this;

  /* Check body can be read and decoded. */
  try {
    Uploads.checkStream(req);
  } catch (e) {
    return next(e);
  }

  req.resource.stat(function (err, stats) {
    var exist, replace;

    if (err) {
      if (err.error.code !== 'ENOENT') return next(err);
      fs.stat(dirname(req.resource.abspath), function (err, stats) {
        if (!err && !stats.isDirectory()) {
          err = new Error("Not a directory");
          err.code = 'ENOTDIR';
        }
        if (err) return next(Resource.createError.call('resource.path.', err));
        save();
      });
    } else if (stats.type === 'folder' && req.query.replace) {
      next(error.conflict('resource.isdir', "Not a file"));
    } else {
      exist = true;
      replace = !!req.query.replace;
      save();
    }

    function save() {
      manager.uploads.save(req, function (err, tmp) {
        if (err) return next(err);

        var tmpres = manager.uploads.root.resource(tmp);

        manager.rename(tmpres, req.user, req.resource, {
          rename: replace ? false : true,
          replace: !!replace,
          parents: true
        }, (err, infos) => {
          if (err) return next(err);

          res.status(200).send(infos);
        });
      });
    }
  });
}

function folderCreate(req, res, next) {
  var path = req.resourcePath;

  req.resource.mkdir(req.query, function (err) {
    if (err) return next(err);
    res.status(200).send(req.resource.toJSON(req.user));
  });
}

function folderList(req, res, next) {
  var opts = {};
  if (req.query.tree) {
    opts.recursive = true;
    opts.dirsOnly = true;
  }
  req.resource.scan(opts, function (err, dirs, files) {
    if (err) return next(err);

    var infos = req.resource.toJSON(req.user);

    if (!infos.mime) {
      infos.mime = 'inode/directory';
      infos.type = 'folder';
    }

    infos.dirs = dirs;
    if (!opts.recursive) infos.files = files;

    res.status(200).send(infos);
  });
}

function repoCreate(req, res, next) {
  var f = this.folder(req.body.name, function (err, folder) {
    if (err) return next(err);

    res.status(200).send(folder.toJSON(req.user));
  }, req.body);

  if (f) {
    next(error.conflict('folder.exists', "Folder already exists"));
  }
}

function repoList(req, res) {
  var re;

  if (req.query.pattern) {
    var type = req.query.type || 'glob';
    try {
      switch (type) {
        case 'regexp':
          re = new RegExp(req.query.pattern);
          break;
        case 'glob':
        default:
          re = require('minimatch').makeRe(req.query.pattern);
          break;
      }
    } catch (e) {
      e = error.createError(400, 'query.property.value', "Invalid "+type+" pattern", {
        key: 'pattern'
      });
      return next(e);
    }
  }

  this.userFolders(req.user, function (err, list) {
    if (err) return next(err);

    if (re) {
      list = list.filter( (f) => re.test(f.name) );
    }

    res.status(200).send(list);
  });
}

function resourceDelete(req, res, next) {
  var manager = this;

  manager.trash.trash(req.user, req.resource, function (err, uid) {
    if (err) return next(err);

    res.status(200).send({
      origin: req.resource.path,
      trashUid: uid
    });
  }, req.resourceType);
}

/**
 * Check if a resource exists.
 *
 * Possible response http code:
 *   - 204: Resource exists and is of the right type
 *   - 404: Resource doesn't exist
 *   - 409: Resource exists but is not of the right type
 */
function resourceExist(req, res) {
  var type = req.resourceType || 'folder';
  req.resource.stat(function (err, stats) {
    if (err) {
      res.status(err.statusCode);
    } else {
      res.status(stats.type === type ? 204 : 409);
    }
    res.end();
  });
}

function checkSrcPath(path) {
  var ctx = typeof this === 'string' ? this : '';

  if (typeof path === 'string') {
    Resource.checkPath.call(ctx, path);
  } else if (Array.isArray(path)) {
    if (!path.length) { // Must contain at least one element.
      throw error.createError(400, ctx+'empty',
        "Non empty array of strings expected", {
          length: 0,
          expectedLength: '1+'
        });
    }
    for (var i = 0; i < path.length; i++) {
      if (typeof path[i] !== 'string') {

        throw error.createError(400, ctx+'type.invalid',
          "Array of string expected, got " + typeof path[i] + " in array", {
            expect: [ 'array', 'string' ],
            got: 'array:' + typeof path[i],
          });
      }
      Resource.checkPath.call(ctx+i+'.', path[i]);
    }
  } else {
    throw error.createError(400, ctx+'type.invalid',
      "String or Array expected, got " + typeof path, {
        expect: [ 'array', 'string' ],
        got: typeof path
      });
  }
}

function resourceRename(req, res, next) {
  var manager = this;
  var sources = req.body.src;
  var dest;

  var isArray = Array.isArray(sources);
  var options = {
    rename: !!req.body.rename,
    replace: !!req.body.replace,
    parents: !!req.body.parents
  };
  var results = [], errors = 0;
  var src, i;

  if (isArray) {
    // Shared folder must exist with batch renaming (moveTo)
    dest = manager.resource(req.body.dest);

    if (!dest || !dest.folder.canwrite(req.user)) {
      if (dest || !req.user.is('admin')) {
        next(error.forbidden('resource.forbidden', "Write access required"));
      } else {
        next(error.notfound('resource.notfound', "Destination folder not found"));
      }
      return;
    }

    // Check that dest is a directory if it exists
    dest.stat((err, stats) => {
      if (err && err.code === 'resource.notfound') {
        err = null;
      } else if (!err && stats.type !== 'folder') {
        err = error.createError(409, 'resource.notdir', "Destination is not a directory");
      }

      if (err) {
        err.path = dest.path;
        dest.unref();
        return next(err);
      }

      series();
    });
  } else {
    dest = manager.resource(req.body.dest, true);
    sources = [ sources ];
    series();
  }

  function series() {
    async.eachSeries(sources, (item, _n) => {
      var src = manager.resource(item);

      if (!src || !src.folder.canread(req.user)) {
        results.push(error.notFound('resource.notfound', "Resource not found", {
          path: src ? src.path : item.replace(/\/+$/, '')
        }));
        errors++;
        return _n();
      }

      var d = isArray ? dest.resource(src.name) : dest.ref();

      manager.rename(src, req.user, d, options, (err, infos) => {
        if (err) {
          errors++;
          err.path = item;
        }
        results.push(err ? err : infos);
        d.unref();
        _n();
      });
    }, (err) => {
      dest.unref();

      if (err) return next(err);
      if (errors && !isArray) return next(results[0]);

      res.status(200).send(isArray ? results : results[0]);
    });
  }
}

function resourceStat(req, res, next) {
  var p = utils.partition(req.query.path, '/');
  var folder = this.folder(p[0]);

  if (!folder || !folder.canread(req.user)) {
    return next(error.notFound('resource.notfound', "Resource not found"));
  }

  try {
    var resource = folder.resource(p[2]);
  } catch (e) {
    return next(e);
  }

  resource.stat(function (err, stats) {
    if (err) return next(err);
    res.status(200).send(resource.toJSON(req.user));
  });
}

function sharedUpdate(req, res, next) {
  req.body.tasks = {}; // XXX reserved for future.
  req.folder.configure(req.body);
  req.folder.saveConfig(function (err) {
    if (err) return next(err);
    res.status(200).send(req.folder.toJSON(req.user));
  });
}

module.exports = function (manager) {
  // --- Handlers

  var checkRead =  _Check('read').bind(manager);
  var checkWrite = _Check('write').bind(manager);

  return [
    { path: "/repo/",
      authAs: "user",
      methods: {
        get: { doc: "List shared folders",
          query: {
            pattern: { doc: "Glob pattern or regular expression to match folders against",
              type: [ 'glob', 'regexp' ] },
            type: { doc: "Regular expression to match folder names against",
              type: 'enum', 'enum': [ 'glob', 'regexp' ] }
          },
          handle: repoList.bind(manager)
        },
        post: { doc: "Create a shared folder",
          authAs: "admin",
          body: {
            name: { doc: "Folder name",
              required: true, validate: Resource.checkName },
            description: { doc: "Folder description" },
            accessList: ACCESS_SPEC,
          },
          handle: repoCreate.bind(manager)
        }
      }
    },
    { path: "/repo/rename",
      authAs: "user",
      methods: {
        post: { doc: "rename a resource",
          body: {
            src: { doc: "Path to a resource",
              type: [ 'array', 'string' ],
              required: true,
              validate: checkSrcPath },
            dest: { doc: "New path of the resource",
              required: true, validate: Resource.checkPath },
            rename: { doc: "If src is an array, renamed resources will be "
              + "prefixed if target exists in dest",
              type: 'flag' },
            replace: { doc: "Replace target if src and dest are files",
              type: 'flag' },
            parents: { doc: "Create missing parents (excluding shared folder)",
              type: 'flag' }
          },
          handle: resourceRename.bind(manager)
        }
      }
    },
    { path: "/repo/stat",
      authAs: "user",
      methods: {
        get: { doc: "Get infos about a resource",
          query: {
            path: { doc: "Resource path",
              validate: Resource.checkPath }
          },
          handle: resourceStat.bind(manager)
        }
      }
    },
    { path: "/repo/:folder/",
      authAs: "user",
      params: {
        folder: { doc: "Folder name",
          validate: Resource.checkName }
      },
      methods: {
        get: { doc: "List contents of shared folder",
          query: {
            tree: { doc: "List subdirectories only (recursive)",
              type: 'flag' }
          },
          handle: [ checkRead, folderList ]
        },
        head: { doc: "Check if a shared folder exists",
          handle: [ checkRead, resourceExist ]
        },
        put: { doc: "Update shared folder",
          authAs: "admin",
          body: {
            description: { doc: "Folder description" },
            accessList: ACCESS_SPEC,
          },
          handle: [ checkWrite, sharedUpdate.bind(manager) ]
        },
        'delete': { doc: "Delete shared folder",
          authAs: "admin",
          handle: [ checkWrite, resourceDelete.bind(manager) ]
        }
      }
    },
    { path: "/repo/:folder/:path+",
      authAs: "user",
      handle: preparePath.bind('file'),
      params: {
        folder: { doc: "Folder name",
          validate: Resource.checkName },
        path: { doc: "Path to a file",
          validate: Resource.checkPath }
      },
      methods: {
        get: { doc: "Get (download) a file",
          'content-type': '*',
          query: {
            attachment: { doc: "If set, the file will be sent as an attachment",
              type: 'flag' }
          },
          handle: [ checkRead, fileGet ]
        },
        head: { doc: "Check is a file exists",
          handle: [ checkRead, resourceExist ]
        },
        put: { doc: "Send a file",
          query: {
            replace: { doc: "Replace file if it exists already. Default is to rename file.",
              type: 'flag' }
          },
          handle: [ checkWrite, fileSave.bind(manager) ]
        },
        'delete': { doc: "Delete a file",
          handle: [ checkWrite, resourceDelete.bind(manager) ]
        }
      }
    },
    { path: "/repo/:folder/:path+/",
      authAs: "user",
      handle: preparePath.bind('folder'),
      params: {
        folder: { doc: "Folder name",
          validate: Resource.checkName },
        path: { doc: "Path to a sub-directory",
          validate: Resource.checkPath }
      },
      methods: {
        get: { doc: "List files and directory in path",
          query: {
            tree: { doc: "List subdirectories only (recursive)",
              type: 'flag' }
          },
          handle: [ checkRead, folderList ]
        },
        head: { doc: "Check if a directory exists",
          handle: [ checkRead, resourceExist ]
        },
        put: { doc: "Create a directory",
          query: {
            parents: { doc: "Create missing parents",
              type: 'flag' }
          },
          handle: [ checkWrite, folderCreate ]
        },
        'delete': { doc: "Delete directory",
          handle: [ checkWrite, resourceDelete.bind(manager) ]
        }
      }
    }
  ];
};
